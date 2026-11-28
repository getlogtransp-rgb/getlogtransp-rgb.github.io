// GETLOG – robô do IMILE (Cloudflare Worker). Troca todos os pacotes atribuídos de um seller para um motorista.
// Variáveis (segredos): TOKEN (o mesmo colado no portal), IMILE_TOKEN (sessão do IMILE) ou IMILE_USER + IMILE_PASS,
// IMILE_USERCODE (código do usuário no IMILE). Binding KV opcional: SESSAO (guarda a sessão entre chamadas).
// Ações (POST, JSON): { t, acao: 'prever' | 'executar', seller, motorista, usuario }
const SITE = 'https://getlogbr.com.br';
const BASE = 'https://ds.imile.com/';
const HUB = 'S21074701';
const ESTACAO = 'DS FM NOR';
const MOTIVO = 'Troca de Motorista';
const DIAS = 31;
const U_LISTA = BASE + 'lm/express/ops/v1/lm/pickup/listPickingUp';
const U_CANCELA = BASE + 'lm/express/ops/v1/lm/pickup/cancelAssignmentNew';
const U_ATRIBUI = BASE + 'lm/express/ops/v1/lm/pickup/assignNew';
const U_MOTORISTA = BASE + 'hrms/user/associate/list';
const cors = { 'Access-Control-Allow-Origin': SITE, 'Vary': 'Origin' };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'content-type': 'application/json; charset=utf-8' } });

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: { ...cors, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Max-Age': '86400' } });
    if (req.method !== 'POST') return json({ ok: false, erro: 'método' }, 405);
    let b;
    try { b = await req.json(); } catch (e) { return json({ ok: false, erro: 'pedido inválido' }, 400); }
    if (!env.TOKEN || b.t !== env.TOKEN) return json({ ok: false, erro: 'token' }, 401);
    const seller = String(b.seller || '').trim(), motorista = String(b.motorista || '').trim();
    if (b.acao === 'ping') return json({ ok: true });
    if (!seller || !motorista || seller.length > 120 || motorista.length > 120) return json({ ok: false, erro: 'Informe o seller e o motorista.' }, 400);
    try {
      const ctx = { env, sessao: await sessao(env) };
      const plano = await planejar(ctx, seller, motorista);
      if (!plano.ok || b.acao === 'prever') return json(resumo(plano));
      if (b.acao !== 'executar') return json({ ok: false, erro: 'ação' }, 400);
      return json(await executar(ctx, plano, String(b.usuario || '')));
    } catch (e) {
      return json({ ok: false, erro: String(e.message || e) });
    }
  },
};

// ---------- sessão no IMILE ----------
async function sessao(env) {
  let tok = env.SESSAO ? await env.SESSAO.get('token') : null;
  if (!tok) tok = env.IMILE_TOKEN || (await entrar(env));
  return tok;
}
async function entrar(env) {
  // O endereço/formato do login do IMILE precisa ser confirmado com a conta do robô; até lá use o segredo IMILE_TOKEN.
  throw new Error('Sessão do IMILE ausente: configure IMILE_TOKEN (ou o login automático do robô).');
}

// ---------- chamadas ----------
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(ctx, url, corpo, recurso = 'LMOrderManage') {
  const h = {
    accept: 'application/json, text/plain, */*', 'content-type': 'application/json',
    authorization: 'Bearer ' + ctx.sessao,
    'front-sec': JSON.stringify({ orgId: 10, entId: 10, userCode: ctx.env.IMILE_USERCODE || '', moduleId: 10007, client: 'pc' }),
    hubcode: HUB, lang: 'pt_BR', 'resource-code': recurso, 'sys-name': 'DS', 'sys-portal': 'DS', timezone: '-3',
    'x-page-path': BASE + '#/OrderManagement/LMOrderManage?tab=pickingUpGoods',
  };
  let ultimo = '';
  for (let t = 0; t < 6; t++) {
    try {
      const r = await fetch(url, { method: 'POST', headers: h, body: JSON.stringify(corpo) });
      const tx = await r.text();
      let j = null;
      try { j = JSON.parse(tx); } catch (e) {}
      if (r.ok && j && j.status === 'success') return { ok: true, json: j };
      ultimo = (j && j.message) || tx.slice(0, 300) || 'HTTP ' + r.status;
      if (r.status === 401 || r.status === 403) { if (ctx.env.SESSAO) await ctx.env.SESSAO.delete('token'); return { ok: false, motivo: 'Sessão do IMILE expirou. ' + ultimo }; }
      if (!(r.status === 429 || r.status >= 500 || /busy|too many|frequent|timeout|try again/i.test(ultimo))) return { ok: false, motivo: ultimo };
    } catch (e) { ultimo = e.message; }
    await pausa(Math.min(500 * 2 ** t, 6000));
  }
  return { ok: false, motivo: ultimo || 'IMILE ocupado.' };
}
const dataFmt = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
const brasilia = (dias = 0) => new Date(Date.now() - 3 * 3600e3 - dias * 864e5);

async function listarAtribuidos(ctx) {
  const mapa = new Map();
  for (let pagina = 1; pagina <= 200; pagina++) {
    const r = await api(ctx, U_LISTA, {
      currentPage: pagina, showCount: 1000, numberSearchType: 'waybillNo', numbers: [],
      startDate: dataFmt(brasilia(DIAS)) + ' 00:00:00', endDate: dataFmt(brasilia()) + ' 23:59:59',
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

// ---------- nomes ----------
const norm = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
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
    const r = await api(ctx, U_MOTORISTA, { ocCodeList: [HUB], keyword: chave, isDriver: 1 });
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

// ---------- seller ----------
const CH_SELLER = /(consignor|seller|shipper|sender|customer|merchant|client|store|shop|vendor)/i;
const CH_FORA = /(zip|code|phone|mobile|tel|mail|address|addr|city|province|district|street|id$|no$|date|time|type|count|status)/i;
const valoresSeller = (x) => {
  const v = [];
  for (const k of Object.keys(x)) if (CH_SELLER.test(k) && !CH_FORA.test(k) && typeof x[k] === 'string' && x[k].trim()) v.push(norm(x[k]));
  return v;
};
function filtrarSeller(lista, seller) {
  const q = norm(seller), exato = new Set(), parcial = new Set();
  for (const x of lista) for (const v of valoresSeller(x)) { if (v === q) exato.add(v); else if (v.includes(q) || q.includes(v) && v.length > 3) parcial.add(v); }
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

// ---------- plano / execução ----------
async function planejar(ctx, seller, motorista) {
  const [atribuidos, dest] = await Promise.all([listarAtribuidos(ctx), acharMotorista(ctx, motorista)]);
  const s = filtrarSeller(atribuidos, seller);
  const certo = (x) => norm(x.driverName) === norm(dest.userName) || (x.driverCode && x.driverCode === dest.userCode);
  const aTrocar = s.itens.filter((x) => !certo(x));
  const porMotorista = {};
  for (const x of aTrocar) porMotorista[x.driverName || '(sem nome)'] = (porMotorista[x.driverName || '(sem nome)'] || 0) + 1;
  return { ok: true, seller: s.nome, destino: dest, total: s.itens.length, jaCorretos: s.itens.length - aTrocar.length, aTrocar, todos: s.itens, porMotorista };
}
const resumo = (p) => (p.ok ? { ok: true, seller: p.seller, motorista: p.destino.userName, total: p.total, jaCorretos: p.jaCorretos, aTrocar: p.aTrocar.length, porMotorista: p.porMotorista } : p);

async function executar(ctx, p, usuario) {
  const falhas = new Map();
  const TAM = 200;
  for (let i = 0; i < p.aTrocar.length; i += TAM) {
    const lote = p.aTrocar.slice(i, i + TAM);
    const corpo = (l) => ({ operateType: 'bySelected', recordIds: l.map((x) => x.id), cancelReason: MOTIVO });
    const r = await api(ctx, U_CANCELA, corpo(lote));
    if (r.ok) continue;
    for (let k = 0; k < lote.length; k += 10) {
      const grupo = lote.slice(k, k + 10);
      const rs = await Promise.all(grupo.map((x) => api(ctx, U_CANCELA, corpo([x]))));
      rs.forEach((res, j) => { if (!res.ok) falhas.set(String(grupo[j].waybillNo), res.motivo); });
    }
  }
  const atribuir = p.aTrocar.map((x) => String(x.waybillNo)).filter((w) => !falhas.has(w));
  let erroAtrib = '';
  for (let i = 0; i < atribuir.length; i += 300) {
    const r = await api(ctx, U_ATRIBUI, {
      operateType: 'byQuery',
      lmPickUpQueryDTO: { queryType: 'order', numberSearchType: 'waybillNo', numbers: atribuir.slice(i, i + 300), startDate: '2000-01-01 00:00:00', endDate: dataFmt(brasilia()) + ' 23:59:59', routeCode: '', dateSearchType: 'createDate', consignorZipCodes: [], type: 1 },
      pickupCode: p.destino.userCode, pickupName: p.destino.userName, stationCode: HUB, stationName: ESTACAO,
    });
    if (!r.ok) erroAtrib = r.motivo;
  }
  const depois = await listarAtribuidos(ctx);
  const nosso = new Set(p.todos.map((x) => String(x.waybillNo)));
  const ficou = depois.filter((x) => nosso.has(String(x.waybillNo)));
  const certo = (x) => norm(x.driverName) === norm(p.destino.userName) || (x.driverCode && x.driverCode === p.destino.userCode);
  const confirmados = ficou.filter(certo).length;
  const comOutro = ficou.filter((x) => !certo(x)).map((x) => `${x.waybillNo} (${x.driverName})`);
  return {
    ok: true, executado: true, seller: p.seller, motorista: p.destino.userName, total: p.total, confirmados,
    jaCorretos: p.jaCorretos, comOutro: comOutro.slice(0, 20), falhas: [...falhas.entries()].slice(0, 20), erroAtribuicao: erroAtrib, usuario,
  };
}
