// GETLOG – robô do IMILE (Cloudflare Worker). Faz TODO o trabalho pesado: listas prontas, trocas de motorista e desatribuição.
// A página só pede a lista pronta, manda "trocar" e mostra o histórico do dia; nada de pacote passa pelo navegador.
// Recomendado: plano Workers Paid (US$ 5/mês) + variável PLANO_PAGO=1. No gratuito o limite de processamento (10 ms) não aguenta listas grandes.
// Segredos: TOKEN (o mesmo do portal), IMILE_USERCODE, IMILE_USER + IMILE_PASS (login automático) ou IMILE_TOKEN (sessão colada, vence). Binding KV: SESSAO. Cron: "* * * * *".
// Login automático (variáveis de texto): IMILE_LOGIN_URL, IMILE_LOGIN_BODY (modelo JSON com {{USER}}, {{PASS}}, {{PASS_MD5}}, {{PASS_SHA256}}, {{PASS_B64}}),
// IMILE_TOKEN_PATH (caminho do token na resposta, ex.: resultObject.accessToken, ou cookie:NOME), IMILE_LOGIN_HEADERS (JSON opcional), IMILE_TOKEN_TTL_MIN (padrão 360).
// Ações (POST JSON): ping | lista | trocar | hist | chamar | autoGet | autoSet | desatribuirAgora | loginTeste
const SITE = 'https://getlogbr.com.br';
const BASE = 'https://ds.imile.com/';
const HUB = 'S21074701';
const ESTACAO = 'DS FM NOR';
const MOTIVO = 'Troca de Motorista';
const DIAS_TROCA = 31;
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
const orcamento = (env) => (env.PLANO_PAGO ? 800 : 40); // chamadas ao IMILE por etapa (plano gratuito: máx. 50 por pedido)
const TTL = 172800; // histórico e tarefas somem em 2 dias (a tela mostra só o dia)

export default {
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: { ...cors, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Max-Age': '86400' } });
    if (req.method !== 'POST') return json({ ok: false, erro: 'método' }, 405);
    let b;
    try { b = await req.json(); } catch (e) { return json({ ok: false, erro: 'pedido inválido' }, 400); }
    if (!env.TOKEN || b.t !== env.TOKEN) return json({ ok: false, erro: 'token' }, 401);
    try {
      if (b.acao === 'ping') return json({ ok: true });
      if (!env.SESSAO && b.acao !== 'chamar') return json({ ok: false, erro: 'KV "SESSAO" não está ligado ao robô.' });
      if (b.acao === 'lista') return json(await lista(env, ctx, b));
      if (b.acao === 'trocar') return json(await trocar(env, ctx, b));
      if (b.acao === 'hist') return json(await hist(env, ctx));
      if (b.acao === 'loginTeste') return json(await loginTeste(env));
      if (b.acao === 'autoGet') return json(await autoGet(env));
      if (b.acao === 'autoSet') { await env.SESSAO.put('auto', b.ligado ? '1' : '0'); return json(await autoGet(env)); }
      if (b.acao === 'desatribuirAgora') return json(await desatribuirAgora(env, ctx));
      if (b.acao === 'chamar') return json(await proxy({ env, sessao: await sessao(env), n: 0 }, b));
      return json({ ok: false, erro: 'ação' }, 400);
    } catch (e) {
      return json({ ok: false, erro: String(e.message || e) });
    }
  },
  // A cada minuto: desatribuição às 23:00 (Brasília), continua tarefas paradas e mantém a lista pronta.
  async scheduled(ev, env, ctx) {
    if (!env.SESSAO) return;
    ctx.waitUntil((async () => {
      const t = new Date(ev.scheduledTime);
      let job = await lerJob(env);
      if (!job && t.getUTCHours() === 2 && t.getUTCMinutes() === 0 && (await env.SESSAO.get('auto')) === '1') job = novoJobDesat('AUTOMÁTICO');
      if (job) { try { await etapaDesat({ env, sessao: await sessao(env), n: 0 }, job); } catch (e) { await fecharDesat(env, job, String(e.message || e)); } }
      await continuarTrocas(env, ctx, 20000);
      await atualizarCatalogo(env, false);
    })());
  },
};

// ---------- sessão e chamadas ao IMILE ----------
const loginConfigurado = (env) => !!(env.IMILE_USER && env.IMILE_PASS && env.IMILE_LOGIN_URL);
async function sessao(env) {
  const tok = env.SESSAO ? await env.SESSAO.get('token') : null;
  if (tok) return tok;
  if (loginConfigurado(env)) return entrar(env);
  if (env.IMILE_TOKEN) return env.IMILE_TOKEN;
  throw new Error('Sessão do IMILE ausente: configure o login automático do robô (IMILE_USER, IMILE_PASS, IMILE_LOGIN_URL...) ou o segredo IMILE_TOKEN.');
}
// Login automático no IMILE: monta o pedido pelo modelo configurado, guarda o token no KV e o renova sozinho quando vence (401/403).
async function entrar(env) {
  if (!loginConfigurado(env)) throw new Error('Login automático do IMILE não configurado (IMILE_USER, IMILE_PASS, IMILE_LOGIN_URL).');
  if (env.SESSAO) { // evita vários logins ao mesmo tempo
    if (await env.SESSAO.get('login_lock')) { for (let i = 0; i < 10; i++) { await pausa(1000); const t = await env.SESSAO.get('token'); if (t) return t; } }
    await env.SESSAO.put('login_lock', '1', { expirationTtl: 60 });
  }
  try {
    const pass = String(env.IMILE_PASS), tpl = env.IMILE_LOGIN_BODY || '{"username":"{{USER}}","password":"{{PASS}}"}';
    const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
    const dg = async (alg) => hex(await crypto.subtle.digest(alg, new TextEncoder().encode(pass)));
    const subs = { USER: String(env.IMILE_USER), PASS: pass };
    if (tpl.includes('{{PASS_MD5}}')) subs.PASS_MD5 = await dg('MD5');
    if (tpl.includes('{{PASS_SHA256}}')) subs.PASS_SHA256 = await dg('SHA-256');
    if (tpl.includes('{{PASS_B64}}')) subs.PASS_B64 = btoa(pass);
    const corpo = tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in subs ? JSON.stringify(subs[k]).slice(1, -1) : ''));
    let extra = {};
    try { extra = JSON.parse(env.IMILE_LOGIN_HEADERS || '{}'); } catch (e) { /* ignora */ }
    const r = await fetch(env.IMILE_LOGIN_URL, { method: env.IMILE_LOGIN_METHOD || 'POST', headers: { accept: 'application/json, text/plain, */*', 'content-type': 'application/json', ...extra }, body: corpo });
    const tx = await r.text();
    let j = null;
    try { j = JSON.parse(tx); } catch (e) { /* sem json */ }
    const caminho = env.IMILE_TOKEN_PATH || 'resultObject.accessToken';
    let tok = '';
    if (caminho.startsWith('cookie:')) { const m = (r.headers.get('set-cookie') || '').match(new RegExp(caminho.slice(7) + '=([^;]+)')); tok = m ? decodeURIComponent(m[1]) : ''; }
    else tok = caminho.split('.').reduce((o, k) => (o == null ? o : o[k]), j);
    if (!tok || typeof tok !== 'string') throw new Error(`O login do IMILE não devolveu o token (HTTP ${r.status}${j && j.message ? ': ' + String(j.message).slice(0, 120) : ''}). Confira IMILE_TOKEN_PATH e o corpo do login.`);
    tok = tok.replace(/^Bearer\s+/i, '');
    if (env.SESSAO) await env.SESSAO.put('token', tok, { expirationTtl: Math.max(60, Number(env.IMILE_TOKEN_TTL_MIN || 360) * 60) });
    return tok;
  } finally { if (env.SESSAO) await env.SESSAO.delete('login_lock'); }
}
// Testa o login de ponta a ponta (força um login novo e faz uma leitura inofensiva). Nunca devolve o token.
async function loginTeste(env) {
  if (!loginConfigurado(env)) return { ok: false, erro: 'Login automático não configurado (faltam IMILE_USER, IMILE_PASS ou IMILE_LOGIN_URL).' };
  if (env.SESSAO) await env.SESSAO.delete('token');
  const tok = await entrar(env), ctx = { env, sessao: tok, n: 0 };
  const r = await api(ctx, 'motorista', { ocCodeList: [HUB], keyword: 'GET', isDriver: 1 });
  return { ok: r.ok, login: true, leitura: r.ok, motoristasEncontrados: r.ok ? (r.json.resultObject || []).length : 0, erro: r.ok ? '' : r.motivo, tamanhoDoToken: tok.length };
}
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const cab = (ctx, recurso) => ({
  accept: 'application/json, text/plain, */*', 'content-type': 'application/json',
  authorization: 'Bearer ' + ctx.sessao,
  'front-sec': JSON.stringify({ orgId: 10, entId: 10, userCode: ctx.env.IMILE_USERCODE || '', moduleId: 10007, client: 'pc' }),
  hubcode: HUB, lang: 'pt_BR', 'resource-code': recurso, 'sys-name': 'DS', 'sys-portal': 'DS', timezone: '-3',
  'x-page-path': BASE + '#/OrderManagement/LMOrderManage?tab=pickingUpGoods',
});
async function proxy(ctx, b) {
  const base = ROTAS[b.u];
  if (!base) return { ok: false, status: 0, erroRede: 'rota não permitida' };
  let url = base;
  if (b.u === 'detalhe') {
    const id = String(b.id || '');
    if (!/^[\w-]{1,40}$/.test(id)) return { ok: false, status: 0, erroRede: 'id inválido' };
    url += '?id=' + encodeURIComponent(id);
  }
  const get = GETS.has(b.u), recurso = RECURSOS.has(b.rec) ? b.rec : 'LMOrderManage';
  const enviar = () => fetch(url, { method: get ? 'GET' : 'POST', headers: cab(ctx, recurso), body: get ? undefined : JSON.stringify(b.corpo ?? {}) });
  ctx.n = (ctx.n || 0) + 1;
  try {
    let r = await enviar();
    if ((r.status === 401 || r.status === 403) && loginConfigurado(ctx.env) && (ctx.relogos || 0) < 3) { // sessão venceu: entra de novo e repete a chamada
      ctx.relogos = (ctx.relogos || 0) + 1;
      if (ctx.env.SESSAO) await ctx.env.SESSAO.delete('token');
      ctx.sessao = await entrar(ctx.env);
      ctx.n++;
      r = await enviar();
    }
    const tx = await r.text();
    let j = null;
    try { j = JSON.parse(tx); } catch (e) {}
    if ((r.status === 401 || r.status === 403) && ctx.env.SESSAO) await ctx.env.SESSAO.delete('token');
    return { ok: r.ok, status: r.status, json: j, textoBruto: j ? null : tx.slice(0, 300) };
  } catch (e) {
    return { ok: false, status: 0, erroRede: `${e.name}: ${e.message}` };
  }
}
const sucesso = (r) => r.ok && r.json && r.json.status === 'success';
const motivo = (r) => r.erroRede || (r.json && r.json.message) || r.textoBruto || 'HTTP ' + r.status;
const ocupada = (r) => r.status === 0 || r.status === 429 || r.status >= 500 || /busy|too many|frequent|timeout|try again/i.test(motivo(r));
async function api(ctx, chave, corpo, recurso = 'LMOrderManage') {
  let ultimo = '';
  for (let t = 0; t < 6; t++) {
    const r = await proxy(ctx, { u: chave, corpo, rec: recurso });
    if (sucesso(r)) return { ok: true, json: r.json };
    ultimo = motivo(r);
    if (r.status === 401 || r.status === 403) return { ok: false, motivo: 'Sessão do IMILE expirou. ' + ultimo };
    if (!ocupada(r)) return { ok: false, motivo: ultimo };
    await pausa(Math.min(500 * 2 ** t, 6000));
  }
  return { ok: false, motivo: ultimo || 'IMILE ocupado.' };
}
const dataFmt = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
const brasilia = (dias = 0) => new Date(Date.now() - 3 * 3600e3 - dias * 864e5);
const hoje = () => dataFmt(brasilia());
const corpoLista = (pagina, dias) => ({
  currentPage: pagina, showCount: 1000, numberSearchType: 'waybillNo', numbers: [],
  startDate: dataFmt(brasilia(dias)) + ' 00:00:00', endDate: dataFmt(brasilia()) + ' 23:59:59',
  dateSearchType: 'createDate', queryType: 'waybillNo', consignorZipCodes: [],
});
const corpoCancela = (ids) => ({ operateType: 'bySelected', recordIds: ids, cancelReason: MOTIVO });

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
    if (a.length > 1) throw new Error(`O nome "${nome}" bate com mais de um motorista: ${a.map((m) => m.userName).join('; ')}.`);
  }
  const par = lista.filter((m) => !prefixo(nome) || prefixo(m.userName || '') === prefixo(nome)).slice(0, 8).map((m) => m.userName);
  throw new Error(`Motorista "${nome}" não encontrado no IMILE.${par.length ? ' Parecidos: ' + par.join('; ') + '.' : ''}`);
}

// ---------- leitura da lista de pacotes atribuídos (confere com o total informado; relê se "escorregar") ----------
const CH_SELLER = /(consignor|seller|shipper|sender|customer|merchant|client|store|shop|vendor)/i;
const CH_FORA = /(zip|code|phone|mobile|tel|mail|address|addr|city|province|district|street|id$|no$|date|time|type|count|status)/i;
function compacto(x) {
  const vs = [];
  for (const k of Object.keys(x)) if (CH_SELLER.test(k) && !CH_FORA.test(k) && typeof x[k] === 'string' && x[k].trim()) vs.push(norm(x[k]));
  return { id: x.id, w: String(x.waybillNo || ''), d: x.driverName || '', dc: x.driverCode || '', vs };
}
async function escanear(ctx, dias, prog) {
  const par = Math.max(1, Number(ctx.env.ESCANEAR_PARALELO || 6));
  let itens = [], total = 0;
  for (let tent = 1; tent <= 3; tent++) {
    const vistos = new Map();
    const pegar = async (pagina) => {
      const r = await api(ctx, 'emTransito', corpoLista(pagina, dias));
      if (!r.ok) throw new Error('Não consegui listar os pacotes atribuídos: ' + r.motivo);
      const ro = r.json.resultObject || {}, lista = ro.results || [];
      for (const x of lista) if (x && x.id != null && !vistos.has(x.id)) vistos.set(x.id, compacto(x));
      return { total: Number(ro.pagination?.totalResult || 0), n: lista.length };
    };
    const p1 = await pegar(1); // a 1ª página informa o total; as demais são lidas várias ao mesmo tempo
    total = p1.total;
    const paginas = p1.n >= 1000 ? Math.min(300, Math.max(1, Math.ceil(total / 1000))) : 1;
    if (prog) prog(1, paginas, vistos.size);
    if (paginas > 1) {
      let prox = 2, feitas = 1;
      await Promise.all(Array.from({ length: Math.min(par, paginas - 1) }, async () => {
        while (prox <= paginas) { const pg = prox++; await pegar(pg); feitas++; if (prog) prog(feitas, paginas, vistos.size); }
      }));
    }
    itens = [...vistos.values()];
    if (itens.length >= total) return { itens, incompleto: false, paginas };
    await pausa(500 * tent);
  }
  return { itens, incompleto: itens.length < total };
}
function escolherSeller(itens, seller) {
  const q = norm(seller), exato = new Set(), parcial = new Set();
  for (const x of itens) for (const v of x.vs) { if (v === q) exato.add(v); else if (v.includes(q) || (q.includes(v) && v.length > 3)) parcial.add(v); }
  const nomes = exato.size ? exato : parcial;
  if (!nomes.size) throw new Error(`Seller "${seller}" não encontrado entre os pacotes atribuídos.`);
  if (nomes.size > 1) throw new Error(`"${seller}" bate com mais de um seller: ${[...nomes].slice(0, 8).join('; ')}.`);
  return [...nomes][0];
}

// ---------- listas prontas (sellers e motoristas), atualizadas pelo robô em segundo plano ----------
async function atualizarCatalogo(env, forcar) {
  const antigo = await lerJSON(env, 'catalogo');
  if (!forcar && antigo && Date.now() - antigo.em < 5 * 60000) return antigo;
  if (!forcar && (await env.SESSAO.get('cat_lock'))) return antigo;
  await env.SESSAO.put('cat_lock', '1', { expirationTtl: 120 });
  const inicio = Date.now();
  let ultimo = 0;
  // Progresso real para a barra da tela (só quando ainda não existe lista pronta; depois a atualização é silenciosa)
  const gravar = (o, forcarGravar) => {
    if (antigo || (!forcarGravar && Date.now() - ultimo < 600)) return;
    ultimo = Date.now();
    env.SESSAO.put('cat_prog', JSON.stringify({ ...o, inicio, em: ultimo }), { expirationTtl: 300 }).catch(() => {});
  };
  try {
    gravar({ fase: 'iniciando', pct: 3, eta: 0, texto: 'Conectando ao IMILE' }, true);
    const ctx = { env, sessao: await sessao(env), n: 0 };
    const nomes = new Map(), add = (n) => { const t = String(n || '').trim(), k = norm(t); if (k && !nomes.has(k)) nomes.set(k, t); };
    const [scan, rotas, imile] = await Promise.all([
      escanear(ctx, DIAS_TROCA, (feitas, paginas, qtd) => {
        const dec = (Date.now() - inicio) / 1000, falta = Math.max(1, Math.round((dec / feitas) * (paginas - feitas)) + 1);
        gravar({ fase: 'lendo', feitas, paginas, itens: qtd, pct: Math.min(88, Math.round(5 + 83 * (feitas / paginas))), eta: feitas >= paginas ? 1 : falta, texto: `Lendo pacotes do IMILE: página ${feitas} de ${paginas}` });
      }),
      nomesRotas(env).catch(() => []),
      api(ctx, 'motorista', { ocCodeList: [HUB], keyword: 'GET', isDriver: 1 }).catch(() => ({ ok: false })),
    ]);
    gravar({ fase: 'montando', pct: 94, eta: 1, texto: 'Organizando sellers e motoristas' }, true);
    const cont = new Map();
    for (const x of scan.itens) for (const v of new Set(x.vs)) cont.set(v, (cont.get(v) || 0) + 1);
    const sellers = [...cont.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const n of rotas) add(n);
    if (imile.ok) for (const m of imile.json.resultObject || []) add(m.userName);
    const cat = { em: Date.now(), ms: Date.now() - inicio, sellers, motoristas: [...nomes.values()].sort((a, b) => a.localeCompare(b)) };
    await env.SESSAO.put('catalogo', JSON.stringify(cat));
    await env.SESSAO.delete('cat_prog');
    return cat;
  } catch (e) {
    await env.SESSAO.put('cat_erro', String(e.message || e).slice(0, 200), { expirationTtl: 600 });
    return antigo;
  } finally { await env.SESSAO.delete('cat_lock'); }
}
// Nomes de motoristas da base de Rotas (o portal informa o endereço/token da Rotas uma vez; o robô busca e guarda por 6 h)
async function nomesRotas(env) {
  const c = await lerJSON(env, 'rotas_nomes');
  if (c && Date.now() - c.em < 6 * 3600e3) return c.nomes;
  const cfg = await lerJSON(env, 'rotas_cfg');
  if (!cfg || !/^https:\/\/script\.google(usercontent)?\.com\//.test(cfg.url || '')) return c ? c.nomes : [];
  try {
    const r = await fetch(cfg.url + '?token=' + encodeURIComponent(cfg.token) + '&base=semana', { redirect: 'follow' });
    const j = await r.json();
    const nomes = Array.isArray(j.motoristas) ? j.motoristas.map(String) : [];
    if (nomes.length) await env.SESSAO.put('rotas_nomes', JSON.stringify({ em: Date.now(), nomes }));
    return nomes.length ? nomes : c ? c.nomes : [];
  } catch (e) { return c ? c.nomes : []; }
}
async function lista(env, ctx, b) {
  if (b.rotas && typeof b.rotas.url === 'string' && typeof b.rotas.token === 'string') {
    const atual = await lerJSON(env, 'rotas_cfg');
    if (!atual || atual.url !== b.rotas.url || atual.token !== b.rotas.token) await env.SESSAO.put('rotas_cfg', JSON.stringify({ url: b.rotas.url, token: b.rotas.token }));
  }
  const cat = await lerJSON(env, 'catalogo');
  if (!cat || Date.now() - cat.em > 5 * 60000) ctx.waitUntil(atualizarCatalogo(env, false)); // o cadeado evita montagens em paralelo
  return cat ? { ok: true, em: cat.em, ms: cat.ms, sellers: cat.sellers, motoristas: cat.motoristas } : { ok: true, vazio: true, progresso: await lerJSON(env, 'cat_prog'), erro: await env.SESSAO.get('cat_erro') };
}
async function lerJSON(env, k) { try { const v = await env.SESSAO.get(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }

// ---------- troca de motorista por seller (tarefa em etapas; roda no robô; o portal só acompanha) ----------
const idNovo = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
async function trocar(env, ctx, b) {
  const seller = String(b.seller || '').trim(), motorista = String(b.motorista || '').trim();
  if (!seller || !motorista || seller.length > 120 || motorista.length > 120) return { ok: false, erro: 'Informe o seller e o motorista.' };
  const ativos = (await listarHist(env)).filter((e) => e.estado === 'andamento' && norm(e.seller) === norm(seller));
  if (ativos.length) return { ok: false, erro: `O seller ${seller} já está sendo trocado. Aguarde terminar.` };
  const id = idNovo(), dia = hoje();
  const e = { id, dia, seller: norm(seller), motorista, hora: Date.now(), total: 0, feitos: 0, estado: 'andamento', msg: '', atualizado: Date.now(), usuario: String(b.usuario || '').slice(0, 80) };
  const job = { id, dia, seller, motorista, fase: 'resolver', rodada: 1, todos: [], antes: {}, falhas: {}, inicio: Date.now(), achados: 0 };
  await Promise.all([hput(env, e), jput(env, job), env.SESSAO.put('tem_ativo', '1', { expirationTtl: TTL })]);
  ctx.waitUntil(avancarTroca(env, id, Date.now() + 25000));
  return { ok: true, id };
}
const hput = (env, e) => env.SESSAO.put('h:' + e.dia + ':' + e.id, JSON.stringify(e), { expirationTtl: TTL });
const jput = (env, j) => env.SESSAO.put('j:' + j.id, JSON.stringify(j), { expirationTtl: TTL });
async function listarHist(env) {
  const l = await env.SESSAO.list({ prefix: 'h:' + hoje() + ':' });
  const out = await Promise.all(l.keys.slice(-40).map((k) => lerJSON(env, k.name)));
  return out.filter(Boolean).sort((a, b) => b.hora - a.hora);
}
async function hist(env, ctx) {
  const lista = await listarHist(env);
  for (const e of lista) if (e.estado === 'andamento' && Date.now() - e.atualizado > 20000) ctx.waitUntil(avancarTroca(env, e.id, Date.now() + 25000));
  return { ok: true, itens: lista.map((e) => ({ id: e.id, seller: e.seller, motorista: e.motorista, hora: e.hora, estado: e.estado, pct: e.total ? Math.min(100, Math.floor((e.feitos / e.total) * 100)) : e.estado === 'concluido' ? 100 : 0, total: e.total, msg: e.msg })) };
}
async function continuarTrocas(env, ctx, ms) {
  if (!(await env.SESSAO.get('tem_ativo'))) return;
  const ativas = (await listarHist(env)).filter((e) => e.estado === 'andamento' && Date.now() - e.atualizado > 20000);
  if (!ativas.length) { if (!(await listarHist(env)).some((e) => e.estado === 'andamento')) await env.SESSAO.delete('tem_ativo'); return; }
  await Promise.all(ativas.map((e) => avancarTroca(env, e.id, Date.now() + ms)));
}
async function avancarTroca(env, id, limite) {
  const job = await lerJSON(env, 'j:' + id);
  if (!job || job.fase === 'fim') return;
  if (job.trava && job.trava > Date.now()) return; // outra execução já está cuidando
  job.trava = Date.now() + 40000;
  await jput(env, job);
  const e = await lerJSON(env, 'h:' + job.dia + ':' + id);
  if (!e) return;
  const ctx = { env, sessao: null, n: 0 };
  try {
    ctx.sessao = await sessao(env);
    const dest = () => job.destino;
    const certo = (x) => norm(x.d) === norm(dest().userName) || (x.dc && x.dc === dest().userCode);
    while (job.fase !== 'fim' && Date.now() < limite && ctx.n < orcamento(env) + 60) {
      if (job.fase === 'resolver') {
        job.destino = await acharMotorista(ctx, job.motorista);
        e.motorista = job.destino.userName; job.fase = 'listar';
      } else if (job.fase === 'listar') {
        const { itens } = await escanear(ctx, DIAS_TROCA);
        if (job.rodada === 1) job.nomeSeller = escolherSeller(itens, job.seller);
        const meus = itens.filter((x) => x.vs.includes(job.nomeSeller)), atual = new Map(meus.map((x) => [x.w, x]));
        for (const x of meus) if (!(x.w in job.antes) && (job.rodada === 1 || !certo(x))) { job.antes[x.w] = x.d; job.todos.push(x.w); if (job.rodada > 1) job.achados++; }
        const faltam = job.todos.filter((w) => !(atual.has(w) && certo(atual.get(w))));
        job.finais = {}; for (const w of job.todos) { const x = atual.get(w); job.finais[w] = x ? [x.d, certo(x) ? 'OK' : 'OUTRO'] : ['', 'FORA']; }
        job.feitos = job.todos.length - faltam.length;
        e.seller = job.nomeSeller; e.total = job.todos.length; e.feitos = job.feitos; e.atualizado = Date.now();
        if (!faltam.length || job.rodada > 3) { job.fase = 'fim'; break; }
        job.cancelar = faltam.filter((w) => atual.has(w)).map((w) => ({ id: atual.get(w).id, w }));
        job.pend = faltam.filter((w) => !atual.has(w));
        job.ci = 0; job.ind = []; job.ik = 0; job.atribuir = []; job.ak = 0; job.fase = 'cancelar';
        await hput(env, e); await jput(env, job);
      } else if (job.fase === 'cancelar') {
        if (job.ind.length) {
          const g = job.ind.slice(job.ik, job.ik + 10);
          const rs = await Promise.all(g.map((x) => api(ctx, 'desatribuir', corpoCancela([x.id]))));
          rs.forEach((r, k) => { if (r.ok) job.atribuir.push(g[k].w); else job.falhas[g[k].w] = r.motivo; });
          job.ik += 10; if (job.ik >= job.ind.length) { job.ind = []; job.ik = 0; }
        } else if (job.ci >= job.cancelar.length) {
          job.atribuir.push(...job.pend); job.fase = 'atribuir';
        } else {
          const lote = job.cancelar.slice(job.ci, job.ci + 200);
          const r = await api(ctx, 'desatribuir', corpoCancela(lote.map((x) => x.id)));
          if (r.ok) job.atribuir.push(...lote.map((x) => x.w)); else job.ind = lote;
          job.ci += 200;
        }
        e.atualizado = Date.now(); await hput(env, e); await jput(env, job);
      } else if (job.fase === 'atribuir') {
        if (job.ak >= job.atribuir.length) { job.rodada++; job.fase = 'listar'; await pausa(1500); continue; }
        const q = job.atribuir.slice(job.ak, job.ak + 300);
        const r = await api(ctx, 'atribuir', {
          operateType: 'byQuery',
          lmPickUpQueryDTO: { queryType: 'order', numberSearchType: 'waybillNo', numbers: q, startDate: '2000-01-01 00:00:00', endDate: hoje() + ' 23:59:59', routeCode: '', dateSearchType: 'createDate', consignorZipCodes: [], type: 1 },
          pickupCode: job.destino.userCode, pickupName: job.destino.userName, stationCode: HUB, stationName: ESTACAO,
        });
        job.erroAtrib = r.ok ? '' : r.motivo; job.ak += 300;
        e.feitos = Math.min(e.total, (job.feitos || 0) + Math.min(job.ak, job.atribuir.length)); e.atualizado = Date.now(); await hput(env, e); await jput(env, job);
      }
    }
    if (job.fase === 'fim') {
      const f = Object.values(job.finais || {});
      e.feitos = f.filter((x) => x[1] === 'OK').length; e.total = job.todos.length;
      e.estado = e.feitos === e.total ? 'concluido' : 'pendencias';
      e.msg = e.estado === 'concluido' ? '' : `${f.filter((x) => x[1] === 'OUTRO').length} com outro motorista, ${f.filter((x) => x[1] === 'FORA').length} fora do In-Transit`;
      e.resultado = { outro: Object.entries(job.finais).filter(([, v]) => v[1] === 'OUTRO').slice(0, 30).map(([w, v]) => w + ' (' + v[0] + ')'), fora: Object.entries(job.finais).filter(([, v]) => v[1] === 'FORA').map(([w]) => w).slice(0, 30), achados: job.achados, rodadas: job.rodada };
    }
  } catch (err) {
    const m = String(err.message || err);
    if (/Sessão do IMILE|ocupado|Não consegui listar/.test(m) && job.rodada <= 3 && (job.tentativas = (job.tentativas || 0) + 1) < 5) { /* tenta de novo no próximo ciclo */ }
    else { job.fase = 'fim'; e.estado = 'erro'; e.msg = m.slice(0, 200); }
  }
  e.atualizado = Date.now(); job.trava = 0;
  await Promise.all([hput(env, e), jput(env, job)]);
}

// ---------- desatribuição dos últimos 21 dias (etapas de até "orçamento" chamadas; cron continua) ----------
const lerJob = (env) => lerJSON(env, 'job');
const novoJobDesat = (origem) => ({ origem, fase: 'listar', pagina: 1, itens: [], i: 0, ind: [], ik: 0, rodada: 1, falhas: {}, resto: [], inicio: Date.now(), periodo: { inicio: dataFmt(brasilia(DIAS_DESATRIBUIR - 1)) + ' 00:00:00', fim: dataFmt(brasilia()) + ' 23:59:59' } });
async function desatribuirAgora(env, ctx) {
  if (await lerJob(env)) return { ok: false, erro: 'Já existe uma desatribuição em andamento.' };
  const job = novoJobDesat('MANUAL');
  await env.SESSAO.put('job', JSON.stringify(job));
  ctx.waitUntil((async () => { try { await etapaDesat({ env, sessao: await sessao(env), n: 0 }, job); } catch (e) { await fecharDesat(env, job, String(e.message || e)); } })());
  return { ok: true };
}
async function etapaDesat(ctx, job) {
  const falta = () => ctx.n < orcamento(ctx.env);
  const corpo = (pagina) => corpoLista(pagina, DIAS_DESATRIBUIR - 1);
  while (falta() && job.fase !== 'fim') {
    if (job.fase === 'listar' || job.fase === 'verificar') {
      const r = await proxy(ctx, { u: 'emTransito', corpo: corpo(job.pagina) });
      if (!sucesso(r)) { if (ocupada(r)) { await salvarJob(ctx, job); return; } throw new Error('Não consegui listar os pacotes atribuídos: ' + motivo(r)); }
      const ro = r.json.resultObject || {}, lista = ro.results || [];
      const dest = job.fase === 'listar' ? job.itens : job.resto, vistos = new Set(dest.map((x) => x.id));
      for (const x of lista) if (x && x.id != null && !vistos.has(x.id)) dest.push({ id: x.id, w: String(x.waybillNo || ''), d: x.driverName || '' });
      const total = Number(ro.pagination?.totalResult || 0);
      if (!lista.length || lista.length < 1000 || dest.length >= total) {
        job.pagina = 1;
        if (job.fase === 'listar') { job.total = job.itens.length; job.fase = job.itens.length ? 'cancelar' : 'fim'; job.i = 0; }
        else {
          const pend = new Set(job.resto.map((x) => x.id));
          job.resto = job.itens.filter((x) => pend.has(x.id));
          if (job.resto.length && job.rodada === 1) { job.rodada = 2; job.fase = 'cancelar'; job.i = 0; job.alvo = job.resto; job.resto = []; } else job.fase = 'fim';
        }
      } else job.pagina++;
    } else if (job.fase === 'cancelar') {
      const alvo = job.alvo || job.itens;
      if (job.ind.length) {
        const g = job.ind.slice(job.ik, job.ik + 10);
        if (!g.length) { job.ind = []; job.ik = 0; continue; }
        if (ctx.n + g.length > orcamento(ctx.env)) break;
        const rs = await Promise.all(g.map((x) => proxy(ctx, { u: 'desatribuir', corpo: corpoCancela([x.id]) })));
        rs.forEach((r, k) => { if (!sucesso(r)) job.falhas[g[k].w] = motivo(r); });
        job.ik += 10; if (job.ik >= job.ind.length) { job.ind = []; job.ik = 0; }
        continue;
      }
      if (job.i >= alvo.length) { job.fase = 'verificar'; job.pagina = 1; job.resto = []; continue; }
      const lote = alvo.slice(job.i, job.i + 200);
      const r = await proxy(ctx, { u: 'desatribuir', corpo: corpoCancela(lote.map((x) => x.id)) });
      if (!sucesso(r) && ocupada(r)) { await salvarJob(ctx, job); return; }
      if (!sucesso(r)) { job.ind = lote; job.ik = 0; }
      job.i += 200;
    }
  }
  if (job.fase === 'fim') await fecharDesat(ctx.env, job, '');
  else await salvarJob(ctx, job);
}
const salvarJob = (ctx, job) => ctx.env.SESSAO.put('job', JSON.stringify(job));
async function fecharDesat(env, job, erro) {
  const pend = new Set((job.resto || []).map((x) => x.id));
  const itens = (job.itens || []).map((x) => { const p = pend.has(x.id); return { item: x.w, motorista: x.d, status: p ? 'ERRO' : 'SUCESSO', detalhe: p ? job.falhas[x.w] || 'Continua atribuído após a desatribuição.' : 'Desatribuído.' }; });
  await env.SESSAO.put('ultima', JSON.stringify({ origem: job.origem, inicio: job.inicio, fim: Date.now(), periodo: job.periodo, total: job.total || 0, desatribuidos: itens.filter((x) => x.status === 'SUCESSO').length, itens: erro ? [] : itens.slice(0, 2000), erro }));
  await env.SESSAO.delete('job');
}
async function autoGet(env) {
  const [a, u, j] = await Promise.all([env.SESSAO.get('auto'), lerJSON(env, 'ultima'), lerJSON(env, 'job')]);
  return { ok: true, kv: true, ligado: a === '1', ultima: u, andamento: j ? { fase: j.fase, total: j.total || 0, i: j.i || 0, origem: j.origem } : null };
}
