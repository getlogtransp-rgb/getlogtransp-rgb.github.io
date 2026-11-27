// GETLOG – servidor rápido dos dados (Cloudflare Worker + R2, plano gratuito).
// De 2 em 2 minutos busca no Apps Script do Drive só o que mudou e guarda no R2; o portal lê daqui em milésimos.
// Variáveis: TOKEN (segredo = token do script do Drive), binding R2 chamado DADOS.
const ORIGEM = 'https://script.google.com/macros/s/AKfycbzBrdB2u8IlJJ0o9OclHWPcpA3JUi8n5D_ebIkZ6Kzagwt01zmvsaHU50PrA2C9MzCwdA/exec';
const SITE = 'https://getlogbr.com.br';
const MAX_BUSCAS = 24; // por rodada (limite do plano gratuito: 50 chamadas)
const cors = { 'Access-Control-Allow-Origin': SITE, 'Vary': 'Origin' };

export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: { ...cors, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '86400' } });
    if (!env.TOKEN || u.searchParams.get('t') !== env.TOKEN) return new Response('{"ok":false,"erro":"token"}', { status: 401, headers: { ...cors, 'content-type': 'application/json' } });
    const f = u.searchParams.get('fonte'), d = u.searchParams.get('dia');
    const chave = f === 'performance' && d ? 'performance/' + d : f === 'coletados' && d ? 'coletados/' + d : ['lista', 'lista_coletados', 'geral'].includes(f) ? f : null;
    if (!chave || /[^\w./-]/.test(chave)) return new Response('{"ok":false,"erro":"fonte"}', { status: 404, headers: { ...cors, 'content-type': 'application/json' } });
    const o = await env.DADOS.get(chave);
    if (!o) return new Response('{"ok":false,"erro":"ainda"}', { status: 404, headers: { ...cors, 'content-type': 'application/json' } });
    return new Response(o.body, { headers: { ...cors, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-cache' } });
  },

  async scheduled(ev, env, ctx) { ctx.waitUntil(sync(env)); },
};

async function buscar(env, q) {
  const r = await fetch(ORIGEM + '?' + q + '&force=1&t=' + encodeURIComponent(env.TOKEN), { redirect: 'follow' });
  if (!r.ok) throw new Error('http ' + r.status);
  return r;
}

async function sync(env) {
  let n = 0;
  const ordem = L => [...L].filter(x => /^\d{2}\.\d{2}\.\d{4}$/.test(x.dia)).sort((a, b) => (a.dia.split('.').reverse().join('') < b.dia.split('.').reverse().join('') ? 1 : -1)).slice(0, 62);
  async function fonte(nomeLista, prefixo, fonteDia) {
    try {
      const r = await buscar(env, 'fonte=' + nomeLista); n++;
      const txt = await r.text(); const j = JSON.parse(txt);
      if (!j.ok || !Array.isArray(j.dados)) return;
      await env.DADOS.put(nomeLista, txt);
      for (const x of ordem(j.dados)) {
        if (n >= MAX_BUSCAS) break;
        const k = prefixo + '/' + x.dia, h = await env.DADOS.head(k);
        if (h && h.customMetadata && h.customMetadata.m === String(x.modificadoEm)) continue;
        try { const rd = await buscar(env, 'fonte=' + fonteDia + '&dia=' + encodeURIComponent(x.dia)); n++; await env.DADOS.put(k, rd.body, { customMetadata: { m: String(x.modificadoEm) } }); } catch (e) { console.log('dia', x.dia, e.message); }
      }
    } catch (e) { console.log(nomeLista, e.message); }
  }
  await fonte('lista', 'performance', 'performance');
  await fonte('lista_coletados', 'coletados', 'coletados');
  try { const r = await buscar(env, 'fonte=geral'); await env.DADOS.put('geral', r.body); } catch (e) { console.log('geral', e.message); }
}
