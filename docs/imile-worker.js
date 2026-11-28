// GETLOG – robô do IMILE (Cloudflare Worker, plano gratuito). Ponte entre o portal e o IMILE + desatribuição automática às 23:00.
// O portal (portal/imile.js) faz cada chamada separada pelo robô (1 chamada = 1 pedido, sem o limite de 50 do plano gratuito).
// Segredos: TOKEN (o mesmo colado no portal), IMILE_TOKEN (sessão do IMILE) ou IMILE_USER + IMILE_PASS, IMILE_USERCODE.
// Binding KV: SESSAO. Cron (Triggers): "* * * * *" (a cada minuto; só trabalha se houver tarefa) – 23:00 de Brasília = 02:00 UTC.
// Ações (POST JSON): ping | chamar | autoGet | autoSet | ultimaSet
const SITE = 'https://getlogbr.com.br';
const BASE = 'https://ds.imile.com/';
const HUB = 'S21074701';
const MOTIVO = 'Troca de Motorista';
const DIAS_DESATRIBUIR = 21;
const ORCAMENTO = 40; // chamadas ao IMILE por etapa (limite do plano gratuito = 50)
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
      if (b.acao === 'ultimaSet') {
        if (env.SESSAO && b.ultima && typeof b.ultima === 'object') await env.SESSAO.put('ultima', JSON.stringify(b.ultima).slice(0, 5e6));
        return json({ ok: true });
      }
      if (b.acao === 'chamar') return json(await proxy({ env, sessao: await sessao(env), n: 0 }, b));
      return json({ ok: false, erro: 'ação' }, 400);
    } catch (e) {
      return json({ ok: false, erro: String(e.message || e) });
    }
  },
  // Roda a cada minuto: inicia a desatribuição às 23:00 de Brasília (se ligada) e avança a tarefa em etapas pequenas.
  async scheduled(ev, env, ctx) {
    if (!env.SESSAO) return;
    ctx.waitUntil((async () => {
      let job = await lerJob(env);
      const t = new Date(ev.scheduledTime);
      if (!job && t.getUTCHours() === 2 && t.getUTCMinutes() === 0 && (await env.SESSAO.get('auto')) === '1') {
        job = { origem: 'AUTOMÁTICO', fase: 'listar', pagina: 1, itens: [], i: 0, ind: [], ik: 0, rodada: 1, falhas: {}, resto: [], inicio: Date.now(), periodo: { inicio: dataFmt(brasilia(DIAS_DESATRIBUIR - 1)) + ' 00:00:00', fim: dataFmt(brasilia()) + ' 23:59:59' } };
      }
      if (!job) return;
      try { await etapa({ env, sessao: await sessao(env), n: 0 }, job); }
      catch (e) { await fechar(env, job, String(e.message || e)); }
    })());
  },
};

async function lerJob(env) { try { const j = await env.SESSAO.get('job'); return j ? JSON.parse(j) : null; } catch (e) { return null; } }

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
const cab = (ctx, recurso) => ({
  accept: 'application/json, text/plain, */*', 'content-type': 'application/json',
  authorization: 'Bearer ' + ctx.sessao,
  'front-sec': JSON.stringify({ orgId: 10, entId: 10, userCode: ctx.env.IMILE_USERCODE || '', moduleId: 10007, client: 'pc' }),
  hubcode: HUB, lang: 'pt_BR', 'resource-code': recurso, 'sys-name': 'DS', 'sys-portal': 'DS', timezone: '-3',
  'x-page-path': BASE + '#/OrderManagement/LMOrderManage?tab=pickingUpGoods',
});
// Repassa uma chamada permitida ao IMILE e devolve a resposta crua (o portal decide as retentativas).
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
  ctx.n = (ctx.n || 0) + 1;
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
const sucesso = (r) => r.ok && r.json && r.json.status === 'success';
const motivo = (r) => r.erroRede || (r.json && r.json.message) || r.textoBruto || 'HTTP ' + r.status;
const dataFmt = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
const brasilia = (dias = 0) => new Date(Date.now() - 3 * 3600e3 - dias * 864e5);
const corpoLista = (pagina) => ({
  currentPage: pagina, showCount: 1000, numberSearchType: 'waybillNo', numbers: [],
  startDate: dataFmt(brasilia(DIAS_DESATRIBUIR - 1)) + ' 00:00:00', endDate: dataFmt(brasilia()) + ' 23:59:59',
  dateSearchType: 'createDate', queryType: 'waybillNo', consignorZipCodes: [],
});
const corpoCancela = (ids) => ({ operateType: 'bySelected', recordIds: ids, cancelReason: MOTIVO });

// ---------- desatribuição automática, em etapas ----------
// Fases: listar (páginas) → cancelar (lotes de 200; falha de lote → um a um) → verificar (lista de novo) → fim.
// Cada etapa usa no máximo ORCAMENTO chamadas e grava o andamento no KV; o cron do minuto seguinte continua.
async function etapa(ctx, job) {
  const falta = () => ctx.n < ORCAMENTO;
  while (falta() && job.fase !== 'fim') {
    if (job.fase === 'listar' || job.fase === 'verificar') {
      const r = await proxy(ctx, { u: 'emTransito', corpo: corpoLista(job.pagina) });
      if (!sucesso(r)) { if (ocupada(r)) { await salvar(ctx, job); return; } throw new Error('Não consegui listar os pacotes atribuídos: ' + motivo(r)); }
      const ro = r.json.resultObject || {}, lista = ro.results || [];
      const dest = job.fase === 'listar' ? job.itens : job.resto;
      const vistos = new Set(dest.map((x) => x.id));
      for (const x of lista) if (x && x.id != null && !vistos.has(x.id)) dest.push({ id: x.id, w: String(x.waybillNo || ''), d: x.driverName || '' });
      const total = Number(ro.pagination?.totalResult || 0);
      if (!lista.length || lista.length < 1000 || dest.length >= total) {
        job.pagina = 1;
        if (job.fase === 'listar') { job.total = job.itens.length; job.fase = job.itens.length ? 'cancelar' : 'fim'; job.i = 0; }
        else {
          const pend = new Set(job.resto.map((x) => x.id));
          job.resto = job.itens.filter((x) => pend.has(x.id));
          if (job.resto.length && job.rodada === 1) { job.rodada = 2; job.fase = 'cancelar'; job.i = 0; job.alvo = job.resto; job.resto = []; }
          else job.fase = 'fim';
        }
      } else job.pagina++;
    } else if (job.fase === 'cancelar') {
      const alvo = job.alvo || job.itens;
      if (job.ind.length) { // modo um a um (após falha de lote)
        const grupo = job.ind.slice(job.ik, job.ik + 10);
        if (!grupo.length) { job.ind = []; job.ik = 0; continue; }
        if (ctx.n + grupo.length > ORCAMENTO) break;
        const rs = await Promise.all(grupo.map((x) => proxy(ctx, { u: 'desatribuir', corpo: corpoCancela([x.id]) })));
        rs.forEach((r, k) => { if (!sucesso(r)) job.falhas[grupo[k].w] = motivo(r); });
        job.ik += 10;
        if (job.ik >= job.ind.length) { job.ind = []; job.ik = 0; }
        continue;
      }
      if (job.i >= alvo.length) { job.fase = 'verificar'; job.pagina = 1; job.resto = []; continue; }
      const lote = alvo.slice(job.i, job.i + 200);
      const r = await proxy(ctx, { u: 'desatribuir', corpo: corpoCancela(lote.map((x) => x.id)) });
      if (!sucesso(r) && ocupada(r)) { await salvar(ctx, job); return; }
      if (!sucesso(r)) { job.ind = lote; job.ik = 0; }
      job.i += 200;
    }
  }
  if (job.fase === 'fim') await fechar(ctx.env, job, '');
  else await salvar(ctx, job);
}
const ocupada = (r) => r.status === 0 || r.status === 429 || r.status >= 500 || /busy|too many|frequent|timeout|try again/i.test(motivo(r));
async function salvar(ctx, job) { await ctx.env.SESSAO.put('job', JSON.stringify(job)); }
async function fechar(env, job, erro) {
  const pend = new Set((job.resto || []).map((x) => x.id));
  const itens = (job.itens || []).map((x) => { const p = pend.has(x.id); return { item: x.w, motorista: x.d, status: p ? 'ERRO' : 'SUCESSO', detalhe: p ? job.falhas[x.w] || 'Continua atribuído após a desatribuição.' : 'Desatribuído.' }; });
  const res = { origem: job.origem, inicio: job.inicio, fim: Date.now(), periodo: job.periodo, total: job.total || 0, desatribuidos: itens.filter((x) => x.status === 'SUCESSO').length, itens: erro ? [] : itens, erro };
  await env.SESSAO.put('ultima', JSON.stringify(res));
  await env.SESSAO.delete('job');
}
async function autoGet(env) {
  if (!env.SESSAO) return { ok: true, kv: false, ligado: false, ultima: null, andamento: false };
  const [a, u, j] = await Promise.all([env.SESSAO.get('auto'), env.SESSAO.get('ultima'), env.SESSAO.get('job')]);
  let ultima = null;
  try { ultima = u ? JSON.parse(u) : null; } catch (e) {}
  return { ok: true, kv: true, ligado: a === '1', ultima, andamento: !!j };
}
