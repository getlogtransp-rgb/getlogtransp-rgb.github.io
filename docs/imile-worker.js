// GETLOG – robô do IMILE (Cloudflare Worker). Ponte autenticada entre o portal e o IMILE.
// Segredos: TOKEN (o mesmo colado no portal), IMILE_TOKEN (sessão do IMILE) ou IMILE_USER + IMILE_PASS,
// IMILE_USERCODE (código do usuário no IMILE). Binding KV: SESSAO (sessão, desatribuição automática e último resultado).
// Cron (Triggers): "0 2 * * *" = 23:00 de Brasília, desatribuição automática dos últimos 21 dias (se ligada no portal).
// Ações (POST JSON): ping | chamar | prever | executar | desatribuirAgora | autoGet | autoSet
const SITE = 'https://getlogbr.com.br';
const BASE = 'https://ds.imile.com/';
const HUB = 'S21074701';
const ESTACAO = 'DS FM NOR';
const MOTIVO = 'Troca de Motorista';
const DIAS_SELLER = 31;
const DIAS_DESATRIBUIR = 21;
const ROTAS = {
  motorista: BASE + 'hrms/user/associate/list',
  atribuir: BASE + 'lm/express/ops/v1/lm/pickup/assignNew',
  pendentes: BASE + 'lm/express/ops/v1/lm/pickup/listWaitingForAssignment',
  emTransito: BASE + 'lm/express/ops/v1/lm/pickup/listPickingUp',
  desatribuir: BASE + 'lm/express/ops/v1/lm/pickup/cancelAssignmentNew',
  drivers: BASE + 'lm/express/base/v1/biz/driver/page',
  status: BASE + 'lm/express/base/v1/biz/driver/editDriverStatus',
  detalhe: BASE + 'lm/express/base/v1/biz/driver/detail',
  salvar: BASE + 'lm/express/base/v1/biz/driver/saveOrUpdate',
  veiculos: BASE + 'lm/express/base/v1/api/vehicleMode/vehicleModeList?countryCode=BRA',
};
const GETS = new Set(['detalhe', 'veiculos']);
const RECURSOS = new Set(['LMOrderManage', 'DriverManageCenter']);
const cors = { 'Access-Control-Allow-Origin': SITE, 'Vary': 'Origin' };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'content-type': 'application/json; charset=utf-8' } });

let OCUPADO = false; // uma operação de troca/desatribuição por vez (por instância)

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: { ...cors, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Max-Age': '86400' } });
    if (req.method !== 'POST') return json({ ok: false, erro: 'método' }, 405);
    let b;
    try { b = await req.json(); } catch (e) { return json({ ok: false, erro: 'pedido inválido' }, 400); }
    if (!env.TOKEN || b.t !== env.TOKEN) return json({ ok: false, erro: 'token' }, 401);
    try {
      if (b.acao === 'ping') return json({ ok: true });
      if (b.acao === 'autoGet') return json(await autoGet(env));
      if (b.acao === 'autoSet') {
        if (!env.SESSAO) return json({ ok: false, erro: 'KV "SESSAO" não está ligado ao robô.' });
        await env.SESSAO.put('auto', b.ligado ? '1' : '0');
        return json(await autoGet(env));
      }
      const ctx = { env, sessao: await sessao(env) };
      if (b.acao === 'chamar') return json(await proxy(ctx, b));
      if (b.acao === 'desatribuirAgora') return json(await comTrava(() => desatribuir21(ctx, 'MANUAL')));
      const seller = String(b.seller || '').trim(), motorista = String(b.motorista || '').trim();
      if (!seller || !motorista || seller.length > 120 || motorista.length > 120) return json({ ok: false, erro: 'Informe o seller e o motorista.' }, 400);
      if (b.acao !== 'prever' && b.acao !== 'executar') return json({ ok: false, erro: 'ação' }, 400);
      const plano = await planejar(ctx, seller, motorista);
      if (!plano.ok || b.acao === 'prever') return json(resumo(plano));
      return json(await comTrava(() => executar(ctx, plano, String(b.usuario || ''))));
    } catch (e) {
      return json({ ok: false, erro: String(e.message || e) });
    }
  },
  async scheduled(ev, env, ctx) {
    ctx.waitUntil((async () => {
      if (!env.SESSAO || (await env.SESSAO.get('auto')) !== '1') return;
      try { await desatribuir21({ env, sessao: await sessao(env) }, 'AUTOMÁTICO'); }
      catch (e) { await env.SESSAO.put('ultima', JSON.stringify({ origem: 'AUTOMÁTICO', inicio: Date.now(), fim: Date.now(), total: 0, desatribuidos: 0, itens: [], erro: String(e.message || e) })); }
    })());
  },
};

async function comTrava(fn) {
  if (OCUPADO) return { ok: false, erro: 'Já existe uma troca/desatribuição em andamento. Aguarde terminar.' };
  OCUPADO = true;
  try { return await fn(); } finally { OCUPADO = false; }
}

// ---------- sessão no IMILE ----------
async function sessao(env) {
  let tok = env.SESSAO ? await env.SESSAO.get('token') : null;
  if (!tok) tok = env.IMILE_TOKEN || (await entrar(env));
  return tok;
}
async function entrar(env) {
  // O login do IMILE precisa ser confirmado com a conta do robô; até lá use o segredo IMILE_TOKEN.
  throw new Error('Sessão do IMILE ausente: configure IMILE_TOKEN (ou o login automático do robô).');
}

// ---------- chamadas ----------
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const cab = (ctx, recurso) => ({
  accept: 'application/json, text/plain, */*', 'content-type': 'application/json',
  authorization: 'Bearer ' + ctx.sessao,
  'front-sec': JSON.stringify({ orgId: 10, entId: 10, userCode: ctx.env.IMILE_USERCODE || '', moduleId: 10007, client: 'pc' }),
  hubcode: HUB, lang: 'pt_BR', 'resource-code': recurso, 'sys-name': 'DS', 'sys-portal': 'DS', timezone: '-3',
  'x-page-path': BASE + '#/OrderManagement/LMOrderManage?tab=pickingUpGoods',
});
// Ponte: repassa uma chamada permitida ao IMILE e devolve a resposta crua (o portal decide retentativas).
async function proxy(ctx, b) {
  const base = ROTAS[b.u];
  if (!base) return { ok: false, status: 0, erroRede: 'rota não permitida' };
  let url = base;
  if (b.u === 'detalhe') {
    const id = String(b.id || '');
    if (!/^[\w-]{1,40}$/.test(id)) return { ok: false, status: 0, erroRede: 'id inválido' };
    url += '?id=' + encodeURIComponent(id);
  }
  const get = GETS.has(b.u);
  try {
    const r = await fetch(url, { method: get ? 'GET' : 'POST', headers: cab(ctx, RECURSOS.has(b.rec) ? b.rec : 'LMOrderManage'), body: get ? undefined : JSON.stringify(b.corpo ?? {}) });
    const tx = await r.text();
    let j = null;
    try { j = JSON.parse(tx); } catch (e) {}
    if ((r.status === 401 || r.status === 403) && ctx.env.SESSAO) await ctx.env.SESSAO.delete('token');
    return { ok: r.ok, status: r.status, json: j, textoBruto: j ? null : tx.slice(0, 300) };
  } catch (e) {
    return { ok: false, status: 0, erroRede: `${e.name}: ${e.message}` };
  }
}
// Chamada com retentativa (usada pelos fluxos do próprio robô).
async function api(ctx, chave, corpo, recurso = 'LMOrderManage') {
  let ultimo = '';
  for (let t = 0; t < 6; t++) {
    const r = await proxy(ctx, { u: chave, corpo, rec: recurso });
    if (r.ok && r.json && r.json.status === 'success') return { ok: true, json: r.json };
    ultimo = r.erroRede || (r.json && r.json.message) || r.textoBruto || 'HTTP ' + r.status;
    if (r.status === 401 || r.status === 403) return { ok: false, motivo: 'Sessão do IMILE expirou. ' + ultimo };
    if (!(r.status === 0 || r.status === 429 || r.status >= 500 || /busy|too many|frequent|timeout|try again/i.test(ultimo))) return { ok: false, motivo: ultimo };
    await pausa(Math.min(500 * 2 ** t, 6000));
  }
  return { ok: false, motivo: ultimo || 'IMILE ocupado.' };
}
const dataFmt = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
const brasilia = (dias = 0) => new Date(Date.now() - 3 * 3600e3 - dias * 864e5);

async function listarAtribuidos(ctx, dias) {
  const mapa = new Map();
  for (let pagina = 1; pagina <= 200; pagina++) {
    const r = await api(ctx, 'emTransito', {
      currentPage: pagina, showCount: 1000, numberSearchType: 'waybillNo', numbers: [],
      startDate: dataFmt(brasilia(dias)) + ' 00:00:00', endDate: dataFmt(brasilia()) + ' 23:59:59',
      dateSearchType: 'createDate', queryType: 'waybillNo', consignorZipCodes: [],
    });
    if (!r.ok) throw new Error('Não consegui listar os pacotes atribuídos: ' + r.motivo);
    const ro = r.json.resultObject || {};
    const lista = ro.results || [];
    for (const x of lista) if (x && x.id != null) mapa.set(String(x.id), x);
    if (!lista.length || lista.length < 1000 || mapa.size >= Number(ro.pagination?.totalResult || 0)) break;
  }
  return [...mapa.values()];
}
// Desatribui em lotes de 200; se o lote falhar, tenta um a um (10 em paralelo). Devolve Map waybill -> motivo das falhas.
async function cancelar(ctx, lista) {
  const falhas = new Map();
  const corpo = (l) => ({ operateType: 'bySelected', recordIds: l.map((x) => x.id), cancelReason: MOTIVO });
  for (let i = 0; i < lista.length; i += 200) {
    const lote = lista.slice(i, i + 200);
    if ((await api(ctx, 'desatribuir', corpo(lote))).ok) continue;
    for (let k = 0; k < lote.length; k += 10) {
      const grupo = lote.slice(k, k + 10);
      const rs = await Promise.all(grupo.map((x) => api(ctx, 'desatribuir', corpo([x]))));
      rs.forEach((res, j) => { if (!res.ok) falhas.set(String(grupo[j].waybillNo), res.motivo); });
    }
  }
  return falhas;
}

// ---------- desatribuição dos últimos 21 dias ----------
async function desatribuir21(ctx, origem) {
  const res = { origem, inicio: Date.now(), fim: null, periodo: { inicio: dataFmt(brasilia(DIAS_DESATRIBUIR - 1)) + ' 00:00:00', fim: dataFmt(brasilia()) + ' 23:59:59' }, total: 0, desatribuidos: 0, itens: [], erro: '' };
  try {
    const antes = await listarAtribuidos(ctx, DIAS_DESATRIBUIR - 1);
    res.total = antes.length;
    if (antes.length) {
      const falhas = await cancelar(ctx, antes);
      let restantes = await ainda(ctx, antes);
      if (restantes.length) {
        for (const [k, v] of await cancelar(ctx, restantes)) falhas.set(k, v);
        restantes = await ainda(ctx, antes);
      }
      const pend = new Set(restantes.map((x) => String(x.id)));
      for (const x of antes) {
        const p = pend.has(String(x.id));
        res.itens.push({ item: String(x.waybillNo || ''), motorista: x.driverName || '', status: p ? 'ERRO' : 'SUCESSO', detalhe: p ? falhas.get(String(x.waybillNo)) || 'Continua atribuído após a desatribuição.' : 'Desatribuído.' });
      }
      res.desatribuidos = antes.length - pend.size;
    }
  } catch (e) { res.erro = String(e.message || e); }
  res.fim = Date.now();
  if (ctx.env.SESSAO) await ctx.env.SESSAO.put('ultima', JSON.stringify(res));
  return { ok: true, ...res };
}
async function ainda(ctx, registros) {
  const atuais = new Set((await listarAtribuidos(ctx, DIAS_DESATRIBUIR - 1)).map((x) => String(x.id)));
  return registros.filter((x) => atuais.has(String(x.id)));
}
async function autoGet(env) {
  if (!env.SESSAO) return { ok: true, kv: false, ligado: false, ultima: null };
  const [a, u] = await Promise.all([env.SESSAO.get('auto'), env.SESSAO.get('ultima')]);
  let ultima = null;
  try { ultima = u ? JSON.parse(u) : null; } catch (e) {}
  return { ok: true, kv: true, ligado: a === '1', ultima };
}

// ---------- nomes ----------
const norm = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
const PART = new Set(['DA', 'DE', 'DO', 'DAS', 'DOS', 'E']);
const prefixo = (n) => (norm(n).match(/^([A-Z]{2,4})\s*-\s*/) || [])[1] || '';
const tokens = (n) => norm(n).replace(/^[A-Z]{2,4}\s*-\s*/, '').replace(/\(\s*AJ\s*\)/g, ' ').replace(/-\s*A\s*$/, ' ').replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter((t) => t && !PART.has(t));
const tokOk = (a, b) => a === b || (a.length === 1 && b.startsWith(a)) || (b.length === 1 && a.startsWith(b));
function nivel(a0, b0) {
  if (prefixo(a0) && prefixo(a0) !== prefixo(b0)) return 0; // prefixo (ex.: GET -) é opcional ao digitar
  const a = tokens(a0), b = tokens(b0);
  if (!a.length || !b.length || a[0] !== b[0]) return 0;
  const m = Math.min(a.length, b.length);
  for (let i = 0; i < m; i++) if (!tokOk(a[i], b[i])) return 0;
  return a.length === b.length ? 2 : m >= 2 ? 1 : 0;
}
async function acharMotorista(ctx, nome) {
  const alvo = norm(nome), cand = new Map();
  for (const chave of [nome.trim(), tokens(nome)[0]].filter(Boolean)) {
    const r = await api(ctx, 'motorista', { ocCodeList: [HUB], keyword: chave, isDriver: 1 });
    if (!r.ok) throw new Error('Não consegui buscar o motorista: ' + r.motivo);
    for (const m of Array.isArray(r.json.resultObject) ? r.json.resultObject : []) if (m && m.userCode) cand.set(m.userCode, m);
    const ex = [...cand.values()].filter((m) => norm(m.userName) === alvo);
    if (ex.length) return { userCode: ex[0].userCode, userName: ex[0].userName };
  }
  const lista = [...cand.values()];
  for (const n of [2, 1]) {
    const a = lista.filter((m) => nivel(nome, m.userName || '') === n);
    if (a.length === 1) return { userCode: a[0].userCode, userName: a[0].userName };
    if (a.length > 1) throw new Error(`O nome "${nome}" bate com mais de um motorista: ${a.map((m) => m.userName).join('; ')}. Digite o nome completo.`);
  }
  const par = lista.filter((m) => !prefixo(nome) || prefixo(m.userName || '') === prefixo(nome)).slice(0, 8).map((m) => m.userName);
  throw new Error(`Motorista "${nome}" não encontrado no IMILE.${par.length ? ' Parecidos: ' + par.join('; ') + '.' : ''}`);
}

// ---------- troca por seller ----------
const CH_SELLER = /(consignor|seller|shipper|sender|customer|merchant|client|store|shop|vendor)/i;
const CH_FORA = /(zip|code|phone|mobile|tel|mail|address|addr|city|province|district|street|id$|no$|date|time|type|count|status)/i;
const valoresSeller = (x) => {
  const v = [];
  for (const k of Object.keys(x)) if (CH_SELLER.test(k) && !CH_FORA.test(k) && typeof x[k] === 'string' && x[k].trim()) v.push(norm(x[k]));
  return v;
};
function filtrarSeller(lista, seller) {
  const q = norm(seller), exato = new Set(), parcial = new Set();
  for (const x of lista) for (const v of valoresSeller(x)) { if (v === q) exato.add(v); else if (v.includes(q) || (q.includes(v) && v.length > 3)) parcial.add(v); }
  const nomes = exato.size ? exato : parcial;
  if (!nomes.size) {
    const cont = new Map();
    for (const x of lista) for (const v of valoresSeller(x)) cont.set(v, (cont.get(v) || 0) + 1);
    const top = [...cont.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([n, c]) => `${n} (${c})`);
    const diag = top.length ? 'Sellers encontrados: ' + top.join('; ') : 'Não achei o campo do seller. Campos da resposta: ' + Object.keys(lista[0] || {}).join(', ');
    throw new Error(`Seller "${seller}" não encontrado entre os pacotes atribuídos. ${diag}`);
  }
  if (nomes.size > 1) throw new Error(`"${seller}" bate com mais de um seller: ${[...nomes].slice(0, 10).join('; ')}. Digite o nome completo.`);
  const nome = [...nomes][0];
  return { nome, itens: lista.filter((x) => valoresSeller(x).includes(nome)) };
}
async function planejar(ctx, seller, motorista) {
  const [atribuidos, dest] = await Promise.all([listarAtribuidos(ctx, DIAS_SELLER), acharMotorista(ctx, motorista)]);
  const s = filtrarSeller(atribuidos, seller);
  const certo = (x) => norm(x.driverName) === norm(dest.userName) || (x.driverCode && x.driverCode === dest.userCode);
  const aTrocar = s.itens.filter((x) => !certo(x));
  const porMotorista = {};
  for (const x of aTrocar) porMotorista[x.driverName || '(sem nome)'] = (porMotorista[x.driverName || '(sem nome)'] || 0) + 1;
  return { ok: true, seller: s.nome, destino: dest, total: s.itens.length, jaCorretos: s.itens.length - aTrocar.length, aTrocar, todos: s.itens, porMotorista };
}
const resumo = (p) => (p.ok ? { ok: true, seller: p.seller, motorista: p.destino.userName, total: p.total, jaCorretos: p.jaCorretos, aTrocar: p.aTrocar.length, porMotorista: p.porMotorista } : p);

async function executar(ctx, p, usuario) {
  const falhas = await cancelar(ctx, p.aTrocar);
  const atribuir = p.aTrocar.map((x) => String(x.waybillNo)).filter((w) => !falhas.has(w));
  let erroAtrib = '';
  for (let i = 0; i < atribuir.length; i += 300) {
    const r = await api(ctx, 'atribuir', {
      operateType: 'byQuery',
      lmPickUpQueryDTO: { queryType: 'order', numberSearchType: 'waybillNo', numbers: atribuir.slice(i, i + 300), startDate: '2000-01-01 00:00:00', endDate: dataFmt(brasilia()) + ' 23:59:59', routeCode: '', dateSearchType: 'createDate', consignorZipCodes: [], type: 1 },
      pickupCode: p.destino.userCode, pickupName: p.destino.userName, stationCode: HUB, stationName: ESTACAO,
    });
    if (!r.ok) erroAtrib = r.motivo;
  }
  const depois = await listarAtribuidos(ctx, DIAS_SELLER);
  const nosso = new Set(p.todos.map((x) => String(x.waybillNo)));
  const ficou = depois.filter((x) => nosso.has(String(x.waybillNo)));
  const certo = (x) => norm(x.driverName) === norm(p.destino.userName) || (x.driverCode && x.driverCode === p.destino.userCode);
  return {
    ok: true, executado: true, seller: p.seller, motorista: p.destino.userName, total: p.total, confirmados: ficou.filter(certo).length,
    jaCorretos: p.jaCorretos, comOutro: ficou.filter((x) => !certo(x)).map((x) => `${x.waybillNo} (${x.driverName})`).slice(0, 20),
    falhas: [...falhas.entries()].slice(0, 20), erroAtribuicao: erroAtrib, usuario,
  };
}
