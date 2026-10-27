const P = PropertiesService.getScriptProperties();
const BASES = {
  semana: { prop: 'ID_SEMANA', aba: 'GERAL', arquivo: 'ROTEIRIZAÇÃO -  COLETA GERAL.xlsx' },
  sabado: { prop: 'ID_SEMANA', aba: 'SÁBADO' },
  ee: { prop: 'ID_EE', csv: true },
  ee_sabado: { prop: 'ID_EE_SABADO', csv: true }
};
const CACHE_TTL = 21600;
const CACHE_PEDACO = 40000;
function resposta(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function nrm_(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
}
function sidKey_(s) {
  return String(s == null ? '' : s).trim().toUpperCase().replace(/^D/, '');
}
function cacheGeracao_(base) {
  return CacheService.getScriptCache().get('r_gen_' + base) || '0';
}
function cacheLimpar_(base) {
  CacheService.getScriptCache().put('r_gen_' + base, String(Date.now()), CACHE_TTL);
}
function versaoBase_(base) {
  const extra = BASES[base].csv ? DriveApp.getFileById(P.getProperty('ID_SEMANA')).getLastUpdated().getTime() : '';
  return DriveApp.getFileById(P.getProperty(BASES[base].prop)).getLastUpdated().getTime() + '_' + extra + '_' + cacheGeracao_(base);
}
function cacheLer_(base, ver) {
  const c = CacheService.getScriptCache();
  const raiz = 'r13_' + base + '_' + ver;
  const n = Number(c.get(raiz) || 0);
  if (!n) return null;
  const ks = [];
  for (let i = 0; i < n; i++) ks.push(raiz + '_' + i);
  const got = c.getAll(ks);
  let s = '';
  for (let i = 0; i < n; i++) { if (got[ks[i]] == null) return null; s += got[ks[i]]; }
  return s;
}
function respostaCache_(base, ver, o) {
  const s = JSON.stringify(o);
  try {
    const raiz = 'r13_' + base + '_' + ver;
    const partes = {};
    let n = 0;
    for (let i = 0; i < s.length; i += CACHE_PEDACO) partes[raiz + '_' + (n++)] = s.slice(i, i + CACHE_PEDACO);
    const c = CacheService.getScriptCache();
    c.putAll(partes, CACHE_TTL);
    c.put(raiz, String(n), CACHE_TTL);
  } catch (e) { Logger.log('Cache não gravado: ' + e); }
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.JSON);
}
function layoutGeral_(h) {
  const H = h.map(nrm_);
  const mot = H.indexOf('MOTORISTA');
  if (mot < 0) throw new Error('Coluna MOTORISTA não encontrada');
  const cid = H.indexOf('CIDADE');
  const alt = H.indexOf('MOTORISTA ALTERNATIVO');
  const vols = [];
  for (let i = (cid < 0 ? 5 : cid) + 1; i < mot; i++) vols.push(i);
  return { mot, alt: alt < 0 ? mot + 1 : alt, temAlt: alt >= 0, vols };
}
function chaveGeral(r) {
  return [r[0], r[1]].join('|');
}
function lerCsv_(id) {
  const blob = DriveApp.getFileById(id).getBlob();
  let enc = 'UTF-8', txt = blob.getDataAsString('UTF-8');
  if (txt.indexOf('\ufffd') >= 0) { enc = 'windows-1252'; txt = blob.getDataAsString(enc); }
  txt = txt.replace(/^\ufeff/, '');
  const l1 = txt.split(/\r?\n/)[0];
  const delim = [';', '\t', ','].sort((a, b) => l1.split(b).length - l1.split(a).length)[0];
  const rows = Utilities.parseCsv(txt, delim).filter(r => r.some(c => String(c).trim()));
  return { rows, enc, delim, bom: blob.getDataAsString('UTF-8').charCodeAt(0) === 0xFEFF };
}
function gravarCsv_(id, info) {
  const q = c => { c = String(c == null ? '' : c); return (c.indexOf(info.delim) >= 0 || /["\r\n]/.test(c)) ? '"' + c.replace(/"/g, '""') + '"' : c; };
  const txt = (info.bom ? '\ufeff' : '') + info.rows.map(r => r.map(q).join(info.delim)).join('\r\n') + '\r\n';
  const f = DriveApp.getFileById(id);
  Drive.Files.update({}, id, Utilities.newBlob('', 'text/csv', f.getName()).setDataFromString(txt, info.enc));
}
function indicesEE(h) {
  const H = h.map(nrm_);
  const i = n => H.indexOf(n);
  return { id: i('SELLER ID'), cep: i('CEP'), cpf: i('CPF DO MOTORISTA'), placa: i('PLACA DO VEICULO'), nome: i('NOME DO MOTORISTA') };
}
function infoSellers_() {
  const m = {};
  const sh = SpreadsheetApp.openById(P.getProperty('ID_SEMANA')).getSheetByName('_SELLER_ID');
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().forEach(r => { if (r[0]) m[sidKey_(r[0])] = r; });
  return m;
}
function cepGeral_() {
  const m = {}, n = {}, sh = {};
  SpreadsheetApp.openById(P.getProperty('ID_SEMANA')).getSheetByName('GERAL').getDataRange().getValues().slice(1).forEach(r => {
    const c = String(r[4] || '').trim();
    if (!c || !r[0]) return;
    if (r[3]) { const k = c + '|' + r[3] + '|' + r[5]; if (!n[c]) { n[c] = k; m[c] = [r[3], r[5]]; } else if (n[c] !== k) m[c] = []; }
    if (/SHEIN/i.test(String(r[1])) || Number(r[6]) > 0 || Number(r[7]) > 0) { const s = nrm_(r[0]); if (!sh[c]) sh[c] = { s, d: [r[0], r[2], r[3], r[5]] }; else if (sh[c].s !== s) sh[c].d = null; }
  });
  const shein = {};
  Object.keys(sh).forEach(c => { if (sh[c].d) shein[c] = sh[c].d; });
  return { loc: m, shein };
}
function mesclarSid_(sidM, itens) {
  itens.forEach(function (o) {
    if (!o.sid) return;
    var k = sidKey_(o.sid), a = sidM[k] || [o.sid, '', '', '', '', ''], n = [o.sid, o.seller, o.endereco, o.bairro, o.cep, o.cidade];
    for (var z = 1; z < 6; z++) if (!String(a[z] == null ? '' : a[z]).trim() && n[z]) a[z] = seguroSync_(n[z]);
    sidM[k] = a;
  });
}
function completarSellerIds() {
  var t0 = Date.now(), feitos = JSON.parse(P.getProperty('SID_LIDOS') || '[]');
  var it = DriveApp.getFolderById(SYNC.pasta).getFiles(), l = [];
  while (it.hasNext()) { var f = it.next(), mm = SYNC.nome.exec(f.getName()); if (mm && feitos.indexOf(f.getId()) < 0) l.push({ f: f, k: Number(mm[3] + mm[2] + mm[1]) }); }
  l.sort(function (a, b) { return b.k - a.k; });
  var sh = SpreadsheetApp.openById(P.getProperty('ID_SEMANA')).getSheetByName('_SELLER_ID'), sidM = {}, n = 0;
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().forEach(function (r) { if (r[0]) sidM[sidKey_(r[0])] = r.map(String); });
  for (var i = 0; i < l.length && Date.now() - t0 < 240000; i++) { try { mesclarSid_(sidM, lerColetaSync_(l[i].f)); } catch (e) { Logger.log(l[i].f.getName() + ': ' + e); } feitos.push(l[i].f.getId()); n++; }
  var lin = Object.keys(sidM).map(function (k) { return sidM[k].map(String); });
  if (lin.length) sh.getRange(2, 1, lin.length, 6).setNumberFormat('@').setValues(lin);
  P.setProperty('SID_LIDOS', JSON.stringify(feitos));
  cacheLimpar_('ee'); cacheLimpar_('ee_sabado');
  Logger.log(JSON.stringify({ basesLidas: n, faltam: l.length - n, sellerIds: lin.length }));
  if (l.length - n <= 0) ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'completarSellerIds') ScriptApp.deleteTrigger(t); });
}
function iniciarCompletarSellerIds() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'completarSellerIds') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('completarSellerIds').timeBased().everyMinutes(10).create();
}
function veiculos_(rows, ix) {
  const m = {};
  rows.slice(1).forEach(r => { const n = String(r[ix.nome] || '').trim(), c = String(r[ix.cpf] || '').trim(), p = String(r[ix.placa] || '').trim(); if (n && p && /^\d{11}$/.test(/^\d+$/.test(c) ? c.padStart(11, '0') : c)) m[n] = [c, p]; });
  return m;
}
function doGet_(e) {
  const q = e.parameter;
  if (q.token !== P.getProperty('TOKEN') || !BASES[q.base]) return resposta({ erro: 'acesso' });
  if (!P.getProperty(BASES[q.base].prop)) return resposta({ linhas: [], motoristas: [], aviso: 'base ainda não configurada' });
  const ver = versaoBase_(q.base);
  const salvo = cacheLer_(q.base, ver);
  if (salvo) return ContentService.createTextOutput(salvo).setMimeType(ContentService.MimeType.JSON);
  if (BASES[q.base].csv) {
    const c = lerCsv_(P.getProperty(BASES[q.base].prop));
    const ix = indicesEE(c.rows[0]);
    if (ix.id < 0 || ix.nome < 0 || ix.cpf < 0 || ix.placa < 0 || ix.cep < 0) throw new Error('CSV fora do formato: ' + c.rows[0].join('|'));
    const vistos = new Set();
    const linhas = [];
    c.rows.slice(1).forEach(r => {
      const id = String(r[ix.id] || '').trim();
      if (!id) return;
      const cel = i => String(r[i] == null ? '' : r[i]).trim();
      const l = { k: id, sid: id, seller: id, endereco: '', bairro: '', cep: cel(ix.cep), cidade: '', cpf: cel(ix.cpf), placa: cel(ix.placa), clientes: ['SHEIN'], media: 0, motorista: cel(ix.nome), alternativo: '' };
      const chave = [l.k, l.cep, l.cpf, l.placa, l.motorista].join('|');
      if (vistos.has(chave)) return;
      vistos.add(chave);
      linhas.push(l);
    });
    const veic = veiculos_(c.rows, ix);
    return respostaCache_(q.base, ver, { linhas, motoristas: Object.keys(veic).sort(), veiculos: veic });
  }
  const ss = SpreadsheetApp.openById(P.getProperty(BASES[q.base].prop));
  const v = ss.getSheetByName(BASES[q.base].aba).getDataRange().getValues();
  const h = v[0], L = layoutGeral_(h);
  const porK = new Map();
  v.slice(1).forEach(r => {
    if (!r[0]) return;
    const k = chaveGeral(r), cl = L.vols.filter(i => Number(r[i]) > 0).map(i => h[i]), md = L.vols.reduce((a, i) => a + (Number(r[i]) || 0), 0);
    const x = porK.get(k);
    if (x) { cl.forEach(c => { if (x.clientes.indexOf(c) < 0) x.clientes.push(c); }); x.media += md; return; }
    porK.set(k, { k, seller: r[0], endereco: r[2], bairro: r[3], cep: String(r[4]), cidade: r[5], clientes: cl, media: md, motorista: r[L.mot], alternativo: (L.temAlt ? r[L.alt] : '') || '' });
  });
  const linhas = [...porK.values()];
  const motoristas = [...new Set(ss.getSheetByName('_MOTORISTAS').getDataRange().getValues().map(r => String(r[0]).trim()).concat(linhas.map(l => String(l.motorista || '').trim())).filter(String))].sort();
  return respostaCache_(q.base, ver, { linhas, motoristas });
}
function doPost_(e) {
  const d = JSON.parse(e.postData.contents);
  if (d.token !== P.getProperty('TOKEN') || !BASES[d.base] && d.acao !== 'sincronizar') return resposta({ erro: 'acesso' });
  if (d.acao === 'sincronizar') return resposta(sincronizarRotas());
  if (!Array.isArray(d.mudancas) || d.mudancas.length > 6000) return resposta({ erro: 'dados inválidos' });
  if (!P.getProperty(BASES[d.base].prop)) return resposta({ erro: 'base ainda não configurada' });
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const rejeitados = [];
    let salvos = 0;
    if (BASES[d.base].csv) {
      const id = P.getProperty(BASES[d.base].prop);
      const c = lerCsv_(id);
      const ix = indicesEE(c.rows[0]);
      const veic = veiculos_(c.rows, ix);
      d.mudancas.forEach(m => {
        const novo = veic[m.motorista];
        let achou = false;
        if (m.campo === 'alt' || !novo) { rejeitados.push(m.k); return; }
        c.rows.forEach((r, i) => {
          if (!i || String(r[ix.id]).trim() !== String(m.k)) return;
          achou = true;
          if (String(r[ix.nome]).trim() === m.motorista) return;
          r[ix.nome] = m.motorista; r[ix.cpf] = novo[0]; r[ix.placa] = novo[1]; salvos++;
        });
        if (!achou) rejeitados.push(m.k);
      });
      if (salvos) { gravarCsv_(id, c); cacheLimpar_(d.base); }
      return resposta({ ok: true, salvos, rejeitados });
    }
    const ss = SpreadsheetApp.openById(P.getProperty(BASES[d.base].prop));
    const sh = ss.getSheetByName(BASES[d.base].aba);
    const v = sh.getDataRange().getValues();
    const L = layoutGeral_(v[0]);
    const validos = new Set(ss.getSheetByName('_MOTORISTAS').getDataRange().getValues().map(r => String(r[0]).trim()).concat(v.slice(1).map(r => String(r[L.mot] || '').trim())).filter(String));
    const idx = new Map();
    v.forEach((r, i) => {
      if (!i || !r[0]) return;
      const k = chaveGeral(r);
      if (!idx.has(k)) idx.set(k, []);
      idx.get(k).push(i);
    });
    const colNome = v.map(r => [r[L.mot]]);
    const colAlt = v.map(r => [r[L.alt] === undefined ? '' : r[L.alt]]);
    let nNome = 0, nAlt = 0;
    d.mudancas.forEach(m => {
      const is = idx.get(m.k);
      const alt = m.campo === 'alt';
      if (is === undefined || !(validos.has(m.motorista) || (alt && m.motorista === ''))) { rejeitados.push(m.k); return; }
      is.forEach(i => {
        const col = alt ? colAlt : colNome;
        if (col[i][0] === m.motorista) return;
        col[i][0] = m.motorista;
        if (alt) nAlt++; else nNome++;
      });
    });
    if (nAlt) {
      if (sh.getMaxColumns() < L.alt + 1) sh.insertColumnsAfter(sh.getMaxColumns(), L.alt + 1 - sh.getMaxColumns());
      if (!String(colAlt[0][0] || '').trim()) colAlt[0][0] = 'MOTORISTA ALTERNATIVO';
      sh.getRange(1, L.alt + 1, colAlt.length, 1).setValues(colAlt);
    }
    if (nNome) sh.getRange(1, L.mot + 1, colNome.length, 1).setValues(colNome);
    salvos = nNome + nAlt;
    if (salvos) cacheLimpar_(d.base);
    return resposta({ ok: true, salvos, rejeitados });
  } finally {
    lock.releaseLock();
  }
}
function doGet(e) {
  try { return doGet_(e); } catch (err) { return resposta({ erro: String(err) }); }
}
function doPost(e) {
  try { return doPost_(e); } catch (err) { return resposta({ erro: String(err) }); }
}
function exportar() {
  const pasta = DriveApp.getFolderById(P.getProperty('ID_PASTA'));
  Object.keys(BASES).filter(b => BASES[b].arquivo).forEach(b => {
    const id = P.getProperty(BASES[b].prop);
    if (!id) return;
    const nome = BASES[b].arquivo;
    const blob = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + id + '/export?format=xlsx', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } }).getBlob().setName(nome);
    const it = pasta.getFilesByName(nome);
    if (it.hasNext()) Drive.Files.update({}, it.next().getId(), blob);
    else Drive.Files.create({ name: nome, parents: [pasta.getId()] }, blob);
  });
}
function instalarGatilho() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'exportar') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('exportar').timeBased().everyDays(1).atHour(6).create();
}

// ===== Sincronização diária de sellers =====
var SYNC = {
  pasta: '1ZiJ-SJaMvL_qJIiYQdLxZWVhR-2Aan_A',
  nome: /^Coleta - (\d{2})\.(\d{2})\.(\d{4})\.xlsx?$/i,
  cols: { cliente: 'Client Name', sid: 'Seller ID', seller: 'Seller Name', motorista: 'Collection Driver Name', bairro: 'Shipping Area', hora: 'Scan Time' },
  tz: 'America/Sao_Paulo',
  dias: 5,
  opc: { endereco: 'Address', cep: 'Sender zipcode', cidade: 'Shipper City' },
  orcamentoMs: 200000
};

function nrmSync_(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').replace(/^'/, '').trim();
}
function limpaSync_(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
}
/** Evita que um texto da base vire fórmula na planilha (=, +, -, @ no começo). */
function seguroSync_(s) {
  s = String(s == null ? '' : s);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
var CLIENTES_SYNC = [
  [/TIK ?TOK/, 'TIKTOK', 'TIKTOK'],
  [/KWAI/, 'KWAI', 'KWAI'],
  [/SHEIN.*D2D/, 'SHEIN', 'SHEIN D2D'],
  [/SHEIN/, 'SHEIN', 'SHEIN BRA'],
  [/SMART ?ENVIO/, 'SMARTENVIOS', 'SMARTENVIOS']
];
function clienteSync_(c) {
  var bruto = limpaSync_(c) || 'SEM CLIENTE', x = nrmSync_(bruto);
  for (var i = 0; i < CLIENTES_SYNC.length; i++) if (CLIENTES_SYNC[i][0].test(x)) return { b: CLIENTES_SYNC[i][1], vol: CLIENTES_SYNC[i][2] };
  return { b: bruto, vol: bruto };
}
function ehGetSync_(m) {
  return /^GET\b/i.test(limpaSync_(m));
}

/** Arquivos "Coleta - dd.mm.aaaa" mais novos primeiro (até SYNC.dias). */
function arquivosRecentesSync_() {
  var it = DriveApp.getFolderById(SYNC.pasta).getFiles(), l = [];
  while (it.hasNext()) {
    var f = it.next(), m = SYNC.nome.exec(f.getName());
    if (m) l.push({ f: f, k: Number(m[3] + m[2] + m[1]), dia: m[1] + '.' + m[2] + '.' + m[3] });
  }
  l.sort(function (a, b) { return b.k - a.k; });
  return l.slice(0, SYNC.dias);
}

/** Um item por seller + cliente do dia: {seller, sid, cliente, bairro, qtd, mot}. Cada linha da base entra em um item. Resultado guardado em cache por arquivo + última atualização. */
function cacheBaseSync_(f) { return 'sy14_' + f.getId() + '_' + f.getLastUpdated().getTime(); }
function lerColetaSync_(f) {
  var C = CacheService.getScriptCache(), ck = cacheBaseSync_(f), n0 = C.get(ck + '_n');
  if (n0) {
    var keys = [], i0;
    for (i0 = 0; i0 < Number(n0); i0++) keys.push(ck + '_' + i0);
    var got = C.getAll(keys), txt = '';
    for (i0 = 0; i0 < keys.length; i0++) { if (got[keys[i0]] == null) { txt = null; break; } txt += got[keys[i0]]; }
    if (txt !== null) return JSON.parse(txt);
  }
  var tmp = Drive.Files.create({ name: 'tmp rotas ' + f.getName(), mimeType: MimeType.GOOGLE_SHEETS }, f.getBlob());
  try {
    var sh = SpreadsheetApp.openById(tmp.id).getSheets()[0];
    var tudo = sh.getDataRange().getValues();
    if (tudo.length < 2) return [];
    var cab = tudo[0].map(String);
    var col = {};
    for (var k in SYNC.cols) {
      var nomes = { motorista: ['Collection Driver Name', 'Operator'], bairro: ['Shipping Area'], hora: ['Scan Time'] }[k] || [SYNC.cols[k]], i = -1;
      for (var a = 0; a < nomes.length && i < 0; a++) i = cab.indexOf(nomes[a]);
      if (i < 0) { if (k === 'bairro' || k === 'hora') { col[k] = -1; continue; } throw new Error('Coluna não encontrada na base: ' + nomes.join(' / ')); }
      col[k] = i;
    }
    for (var q in SYNC.opc) col[q] = cab.indexOf(SYNC.opc[q]);
    var g = {}, ordem = [];
    for (var r = 1; r < tudo.length; r++) {
      var L = tudo[r];
      var seller = limpaSync_(L[col.seller]) || limpaSync_(L[col.sid]);
      if (!seller) continue;
      var cc = clienteSync_(L[col.cliente]);
      var cliente = cc.b;
      var id = nrmSync_(seller) + '|' + nrmSync_(cliente), o = g[id];
      if (!o) { o = g[id] = { seller: seller, sid: limpaSync_(L[col.sid]), cliente: cliente, bairro: '', endereco: '', cep: '', cidade: '', qtd: 0, vols: {}, mot: '', motHora: '' }; ordem.push(id); }
      o.qtd++;
      o.vols[cc.vol] = (o.vols[cc.vol] || 0) + 1;
      if (!o.bairro) o.bairro = col.bairro < 0 ? '' : limpaSync_(L[col.bairro]);
      for (var q2 in SYNC.opc) if (!o[q2] && col[q2] >= 0) o[q2] = limpaSync_(L[col[q2]]);
      var h = col.hora < 0 ? '' : L[col.hora];
      var hm = h instanceof Date ? Utilities.formatDate(h, SYNC.tz, 'HH:mm:ss') : String(h || '').slice(11, 19);
      var m = limpaSync_(L[col.motorista]);
      if (ehGetSync_(m) && (!o.mot || hm >= o.motHora)) { o.mot = m; o.motHora = hm; }
    }
    var res = ordem.map(function (x) { return g[x]; });
    try {
      var s = JSON.stringify(res), pcs = {}, np = 0;
      for (var p = 0; p < s.length; p += 40000) { pcs[ck + '_' + np] = s.substr(p, 40000); np++; }
      pcs[ck + '_n'] = String(np);
      C.putAll(pcs, 21600);
    } catch (ec) { Logger.log('cache base: ' + ec); }
    return res;
  } finally {
    DriveApp.getFileById(tmp.id).setTrashed(true);
  }
}

function sincronizarRotas() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var t0 = Date.now();
    var arqs = arquivosRecentesSync_();
    if (!arqs.length) throw new Error('Nenhuma base "Coleta - dd.mm.aaaa.xlsx" encontrada.');
    var mapa = {}, ordem = [], lidos = [];
    for (var ai = 0; ai < arqs.length; ai++) {
      if (ai > 0 && Date.now() - t0 > SYNC.orcamentoMs) break; // respeita o limite de tempo do Apps Script
      lerColetaSync_(arqs[ai].f).forEach(function (o) {
        var id = nrmSync_(o.seller) + '|' + nrmSync_(o.cliente), x = mapa[id];
        if (!x) { mapa[id] = o; ordem.push(id); return; }
        if (!x.mot && o.mot) { x.mot = o.mot; x.motHora = o.motHora; } // motorista GET do dia mais recente que tiver
        if (!x.bairro && o.bairro) x.bairro = o.bairro;
        ['endereco', 'cep', 'cidade'].forEach(function (f) { if (!x[f] && o[f]) x[f] = o[f]; });
      });
      lidos.push(arqs[ai].dia);
    }
    var itens = ordem.map(function (id) { return mapa[id]; });
    var ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('ID_SEMANA'));
    var sh = ss.getSheetByName('GERAL');
    var v = sh.getDataRange().getValues();
    var h = v[0].map(String);
    var modo = /client/i.test(h[1]) ? 'cliente' : /(^|\W)id(\W|$)|seller/i.test(h[1]) ? 'id' : '';
    if (!modo) throw new Error('A coluna B da aba GERAL não é cliente nem ID do seller (cabeçalho: "' + h[1] + '"). Nada foi gravado.');

    // Seller + cliente que já existem (por nome e por ID, sem diferenciar maiúsculas/acentos)
    var tem = {};
    v.slice(1).forEach(function (r) {
      if (!r[0]) return;
      var nome = nrmSync_(r[0]), b = nrmSync_(r[1]);
      if (modo === 'cliente') { tem[nome + '|' + b] = 1; for (var c = 6; c <= 10; c++) if (Number(r[c]) > 0) { tem[nome + '|' + nrmSync_(h[c])] = 1; tem[nome + '|' + nrmSync_(clienteSync_(h[c]).b)] = 1; } }
      else { tem['N:' + nome] = 1; tem['I:' + b] = 1; }
    });

    // Motoristas válidos (aba _MOTORISTAS) + os GET novos da base
    var shM = ss.getSheetByName('_MOTORISTAS');
    var mots = {};
    shM.getDataRange().getValues().forEach(function (r) { if (r[0]) mots[nrmSync_(r[0])] = String(r[0]); });
    var novosMot = [];
    itens.forEach(function (o) {
      if (o.mot && !mots[nrmSync_(o.mot)]) { mots[nrmSync_(o.mot)] = o.mot; novosMot.push([seguroSync_(o.mot)]); }
    });
    if (novosMot.length) shM.getRange(shM.getLastRow() + 1, 1, novosMot.length, 1).setValues(novosMot);

    // Linhas novas, no layout da planilha (só o que a base sabe; o resto fica em branco)
    var linhas = [], semColuna = [], largura = Math.max(h.length, 12);
    itens.forEach(function (o) {
      var nome = nrmSync_(o.seller), cli = nrmSync_(o.cliente);
      // coluna B = cliente: um registro por seller + cliente; coluna B = ID: o seller só entra se ainda não existir
      var chaves = modo === 'cliente' ? [nome + '|' + cli] : ['N:' + nome].concat(o.sid ? ['I:' + nrmSync_(o.sid)] : []);
      if (chaves.some(function (k) { return tem[k]; })) return;
      chaves.forEach(function (k) { tem[k] = 1; });
      var r = []; for (var z = 0; z < largura; z++) r.push('');
      r[0] = seguroSync_(o.seller);
      r[1] = seguroSync_(modo === 'cliente' ? o.cliente : o.sid);
      r[2] = seguroSync_(o.endereco);
      r[3] = seguroSync_(o.bairro);
      r[4] = seguroSync_(o.cep);
      r[5] = seguroSync_(o.cidade);
      Object.keys(o.vols).forEach(function (vk) {
        var ci = -1;
        for (var c = 6; c <= 10; c++) if (nrmSync_(h[c]) === nrmSync_(vk)) ci = c;
        if (ci >= 0) r[ci] = o.vols[vk]; else semColuna.push(o.seller + ' / ' + vk);
      });
      if (o.mot) r[11] = seguroSync_(mots[nrmSync_(o.mot)]);
      linhas.push(r);
    });
    var preenchidos = 0;
    if (modo === 'cliente' && v.length > 1) {
      var blocoCF = v.slice(1).map(function (r) { return [r[2], r[3], r[4], r[5]]; });
      v.slice(1).forEach(function (r, ix) {
        if (!r[0]) return;
        var o = mapa[nrmSync_(r[0]) + '|' + nrmSync_(r[1])];
        if (!o) return;
        var b = blocoCF[ix], mud = false;
        [[0, 'endereco'], [1, 'bairro'], [2, 'cep'], [3, 'cidade']].forEach(function (p) { if (!String(b[p[0]] == null ? '' : b[p[0]]).trim() && o[p[1]]) { b[p[0]] = seguroSync_(o[p[1]]); mud = true; } });
        if (mud) preenchidos++;
      });
      var cepB = {};
      blocoCF.forEach(function (b) { var c = String(b[2] == null ? '' : b[2]).trim(), x = String(b[1] == null ? '' : b[1]).trim(); if (c && x) (cepB[c] = cepB[c] || {})[x] = 1; });
      blocoCF.forEach(function (b, ix) { var c = String(b[2] == null ? '' : b[2]).trim(); if (!v[ix + 1][0] || String(b[1] == null ? '' : b[1]).trim() || !cepB[c]) return; var ops = Object.keys(cepB[c]); if (ops.length === 1) { b[1] = ops[0]; preenchidos++; } });
      linhas.forEach(function (r) { var c = String(r[4] || '').trim(); if (!r[3] && cepB[c] && Object.keys(cepB[c]).length === 1) r[3] = Object.keys(cepB[c])[0]; });
      if (preenchidos) sh.getRange(2, 3, blocoCF.length, 4).setValues(blocoCF);
    }
    if (linhas.length) sh.getRange(sh.getLastRow() + 1, 1, linhas.length, largura).setValues(linhas);
    if (linhas.length || novosMot.length || preenchidos) cacheLimpar_('semana');

    // Conferência final: todo seller + cliente da base precisa estar na relação; linhas sem motorista / com motorista fora da lista
    var v2 = sh.getDataRange().getValues(), tem2 = {}, semMot = 0, motInvalido = 0;
    v2.slice(1).forEach(function (r) {
      if (!r[0]) return;
      var nome = nrmSync_(r[0]);
      tem2['N:' + nome] = 1; tem2['I:' + nrmSync_(r[1])] = 1; tem2[nome + '|' + nrmSync_(r[1])] = 1;
      for (var c = 6; c <= 10; c++) if (Number(r[c]) > 0) { tem2[nome + '|' + nrmSync_(h[c])] = 1; tem2[nome + '|' + nrmSync_(clienteSync_(h[c]).b)] = 1; }
      if (!String(r[11] || '').trim()) semMot++; else if (!mots[nrmSync_(r[11])]) motInvalido++;
    });
    var faltantes = itens.filter(function (o) {
      var nome = nrmSync_(o.seller);
      return modo === 'cliente' ? !tem2[nome + '|' + nrmSync_(o.cliente)] : !(tem2['N:' + nome] || (o.sid && tem2['I:' + nrmSync_(o.sid)]));
    }).map(function (o) { return o.seller + ' / ' + o.cliente; });
    var antigo = Number(arqs[0].k) < Number(Utilities.formatDate(new Date(Date.now() - 3 * 86400000), SYNC.tz, 'yyyyMMdd'));
    try {
      var shS = ss.getSheetByName('_SELLER_ID') || ss.insertSheet('_SELLER_ID');
      var sidM = {};
      if (shS.getLastRow() > 1) shS.getRange(2, 1, shS.getLastRow() - 1, 6).getValues().forEach(function (r) { if (r[0]) sidM[sidKey_(r[0])] = r; });
      itens.forEach(function (o) {
        if (!o.sid) return;
        var k = sidKey_(o.sid), a = sidM[k] || [o.sid, '', '', '', '', ''], n = [o.sid, o.seller, o.endereco, o.bairro, o.cep, o.cidade];
        for (var z = 1; z < 6; z++) if (!String(a[z] == null ? '' : a[z]).trim() && n[z]) a[z] = seguroSync_(n[z]);
        sidM[k] = a;
      });
      var linS = Object.keys(sidM).map(function (k) { return sidM[k].map(String); });
      shS.clearContents();
      shS.getRange(1, 1, 1, 6).setValues([['SELLER ID', 'SELLER', 'ENDEREÇO', 'BAIRRO', 'CEP', 'CIDADE']]);
      if (linS.length) shS.getRange(2, 1, linS.length, 6).setNumberFormat('@').setValues(linS);
      if (!shS.isSheetHidden()) shS.hideSheet();
      cacheLimpar_('ee'); cacheLimpar_('ee_sabado');
    } catch (es) { Logger.log('_SELLER_ID: ' + es); }
    var resumo = { ok: faltantes.length === 0, bases: lidos, sellersClientesNaBase: itens.length, linhasNovas: linhas.length, enderecosPreenchidos: preenchidos, motoristasNovos: novosMot.length, semMotorista: semMot, motoristaForaDaLista: motInvalido, faltantes: faltantes.slice(0, 20), semColunaDoCliente: semColuna.slice(0, 20), baseDesatualizada: antigo };
    try {
      var aud = ss.getSheetByName('_SINCRONIA') || ss.insertSheet('_SINCRONIA');
      if (!aud.getLastRow()) aud.appendRow(['Data', 'Bases lidas', 'Na base', 'Linhas novas', 'Motoristas novos', 'Sem motorista', 'Motorista fora da lista', 'Faltantes', 'Base desatualizada']);
      aud.appendRow([new Date(), lidos.join(', '), itens.length, linhas.length, novosMot.length, semMot, motInvalido, faltantes.length, antigo ? 'SIM' : 'não']);
    } catch (ea) { /* auditoria é opcional */ }
    Logger.log(JSON.stringify(resumo));
    return resumo;
  } finally {
    lock.releaseLock();
  }
}

/** Rodada agendada: tenta de novo uma vez e, se continuar com erro ou seller faltando, avisa por e-mail o dono do script. */
function sincronizarAgendado() {
  var res, erro = '';
  for (var t = 0; t < 2; t++) {
    try { res = sincronizarRotas(); erro = ''; if (res.ok) return; } catch (e) { erro = String(e); }
    if (t === 0) Utilities.sleep(60000);
  }
  try {
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'GETLOG Rotas: a sincronização precisa de atenção',
      erro ? 'Erro: ' + erro : 'Sellers que ficaram de fora: ' + JSON.stringify(res.faltantes));
  } catch (em) { Logger.log('Aviso não enviado: ' + em); }
}

/** Agenda a sincronização todo dia às 06:30, sem apagar os outros gatilhos (o exportar() continua). */
function instalarGatilhoSincronia() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'sincronizarAgendado' || t.getHandlerFunction() === 'sincronizarRotas') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('sincronizarAgendado').timeBased().everyDays(1).atHour(6).nearMinute(30).create();
}

