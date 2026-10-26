const P = PropertiesService.getScriptProperties();
const BASES = {
  semana: { prop: 'ID_SEMANA', arquivo: 'ROTEIRIZAÇÃO -  COLETA GERAL.xlsx' },
  sabado: { prop: 'ID_SABADO', arquivo: 'ROTEIRIZAÇÃO -  COLETA GERAL SABADO.xlsx' },
  ee: { prop: 'ID_EE', arquivo: 'ROTEIRIZAÇÃO - EU ENTREGO.csv' }
};
const COL_MOT = 12;
const COLS_VOLUME = [6, 7, 8, 9, 10];
const CAB_EE = ['SELLER ID', 'CPF DO MOTORISTA', 'PLACA DO VEÍCULO', 'NOME DO MOTORISTA'];
function resposta(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function abrir(base) {
  return SpreadsheetApp.openById(P.getProperty(BASES[base].prop));
}
function chaveGeral(r) {
  return [r[0], r[1]].join('|');
}
function veiculos(ss, v, ix) {
  const m = {};
  v.slice(1).forEach(r => { if (r[ix.nome]) m[r[ix.nome]] = [String(r[ix.cpf]), String(r[ix.placa])]; });
  const extra = ss.getSheetByName('_VEICULOS');
  if (extra) extra.getDataRange().getValues().slice(1).forEach(r => { if (r[0]) m[r[0]] = [String(r[1]), String(r[2])]; });
  return m;
}
function indicesEE(h) {
  const i = n => h.indexOf(n);
  return { id: i('SELLER ID'), cpf: i('CPF DO MOTORISTA'), placa: i('PLACA DO VEÍCULO'), nome: i('NOME DO MOTORISTA'), seller: i('SELLER NAME'), end: i('ENDEREÇO'), bairro: i('BAIRRO'), cep: i('CEP'), cidade: i('CIDADE') };
}
function doGet_(e) {
  const q = e.parameter;
  if (q.token !== P.getProperty('TOKEN') || !BASES[q.base]) return resposta({ erro: 'acesso' });
  const ss = abrir(q.base);
  if (q.base === 'ee') {
    const v = ss.getSheetByName('EE').getDataRange().getValues();
    const ix = indicesEE(v[0]);
    const linhas = v.slice(1).filter(r => r[ix.id]).map(r => ({
      k: String(r[ix.id]),
      seller: r[ix.seller],
      endereco: r[ix.end],
      bairro: r[ix.bairro],
      cep: String(r[ix.cep]),
      cidade: r[ix.cidade],
      clientes: ['SHEIN'],
      media: 0,
      motorista: r[ix.nome]
    }));
    return resposta({ linhas, motoristas: Object.keys(veiculos(ss, v, ix)).sort() });
  }
  const v = ss.getSheetByName('GERAL').getDataRange().getValues();
  const h = v[0];
  const vistos = new Set();
  const linhas = v.slice(1).filter(r => r[0] && !vistos.has(chaveGeral(r)) && vistos.add(chaveGeral(r))).map(r => ({
    k: chaveGeral(r),
    seller: r[0],
    endereco: r[2],
    bairro: r[3],
    cep: String(r[4]),
    cidade: r[5],
    clientes: COLS_VOLUME.filter(i => Number(r[i]) > 0).map(i => h[i]),
    media: COLS_VOLUME.reduce((a, i) => a + (Number(r[i]) || 0), 0),
    motorista: r[COL_MOT - 1]
  }));
  const motoristas = ss.getSheetByName('_MOTORISTAS').getDataRange().getValues().map(r => r[0]).filter(String);
  return resposta({ linhas, motoristas });
}
function doPost_(e) {
  const d = JSON.parse(e.postData.contents);
  if (d.token !== P.getProperty('TOKEN') || !BASES[d.base] && d.acao !== 'sincronizar') return resposta({ erro: 'acesso' });
  if (d.acao === 'sincronizar') return resposta(sincronizarRotas());
  if (!Array.isArray(d.mudancas) || d.mudancas.length > 2000) return resposta({ erro: 'dados inválidos' });
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = abrir(d.base);
    const ee = d.base === 'ee';
    const sh = ss.getSheetByName(ee ? 'EE' : 'GERAL');
    const v = sh.getDataRange().getValues();
    const ix = ee ? indicesEE(v[0]) : null;
    const veic = ee ? veiculos(ss, v, ix) : null;
    const validos = ee ? null : new Set(ss.getSheetByName('_MOTORISTAS').getDataRange().getValues().map(r => r[0]));
    const idx = new Map();
    v.forEach((r, i) => {
      if (!i || !r[ee ? ix.id : 0]) return;
      const k = ee ? String(r[ix.id]) : chaveGeral(r);
      if (!idx.has(k)) idx.set(k, []);
      idx.get(k).push(i);
    });
    const colNome = v.map(r => [r[ee ? ix.nome : COL_MOT - 1]]);
    const colCpf = ee ? v.map(r => [r[ix.cpf]]) : null;
    const colPlaca = ee ? v.map(r => [r[ix.placa]]) : null;
    const log = [];
    const rejeitados = [];
    d.mudancas.forEach(m => {
      const is = idx.get(m.k);
      const ok = ee ? !!veic[m.motorista] : validos.has(m.motorista);
      if (is === undefined || !ok) { rejeitados.push(m.k); return; }
      is.forEach(i => {
        const ant = colNome[i][0];
        if (ant === m.motorista) return;
        colNome[i][0] = m.motorista;
        if (ee) { colCpf[i][0] = veic[m.motorista][0]; colPlaca[i][0] = veic[m.motorista][1]; }
        log.push([new Date(), d.usuario, d.base, ee ? v[i][ix.seller] : v[i][0], ee ? v[i][ix.end] : v[i][2], ee ? v[i][ix.cep] : v[i][4], ant, m.motorista]);
      });
    });
    if (log.length) {
      const n = colNome.length;
      sh.getRange(1, (ee ? ix.nome : COL_MOT - 1) + 1, n, 1).setValues(colNome);
      if (ee) {
        sh.getRange(1, ix.cpf + 1, n, 1).setNumberFormat('@').setValues(colCpf);
        sh.getRange(1, ix.placa + 1, n, 1).setValues(colPlaca);
      }
      const l = SpreadsheetApp.openById(P.getProperty('ID_LOG')).getSheetByName('HISTORICO');
      l.getRange(l.getLastRow() + 1, 1, log.length, 8).setValues(log);
    }
    return resposta({ ok: true, salvos: log.length, rejeitados });
  } finally {
    lock.releaseLock();
  }
}
/** Qualquer falha vira uma resposta {erro} legível (nunca uma página de erro do Google). */
function doGet(e) {
  try { return doGet_(e); } catch (err) { return resposta({ erro: String(err) }); }
}
function doPost(e) {
  try { return doPost_(e); } catch (err) { return resposta({ erro: String(err) }); }
}
function blobEE(ss) {
  const v = ss.getSheetByName('EE').getDataRange().getValues();
  const ix = indicesEE(v[0]);
  const cpf = c => { const s = String(c); return /^\d+$/.test(s) ? s.padStart(11, '0') : s; };
  const linhas = [CAB_EE].concat(v.slice(1).filter(r => r[ix.id]).map(r => [r[ix.id], cpf(r[ix.cpf]), r[ix.placa], r[ix.nome]]));
  return Utilities.newBlob('', 'text/csv', BASES.ee.arquivo).setDataFromString(linhas.map(l => l.join(';')).join('\r\n') + '\r\n', 'windows-1252');
}
function exportar() {
  const pasta = DriveApp.getFolderById(P.getProperty('ID_PASTA'));
  Object.keys(BASES).forEach(b => {
    const id = P.getProperty(BASES[b].prop);
    if (!id) return;
    const nome = BASES[b].arquivo;
    const blob = b === 'ee'
      ? blobEE(SpreadsheetApp.openById(id))
      : UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + id + '/export?format=xlsx', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } }).getBlob().setName(nome);
    const it = pasta.getFilesByName(nome);
    if (it.hasNext()) Drive.Files.update({}, it.next().getId(), blob);
    else Drive.Files.create({ name: nome, parents: [pasta.getId()] }, blob);
  });
}
function instalarGatilho() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'exportar') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('exportar').timeBased().everyDays(1).atHour(6).create();
}

// ===== Sincronização diária de sellers (docs/rotas-sincronizar.gs) =====
/**
 * GETLOG — ROTAS: sincronização diária (nenhum seller fora da relação).
 *
 * Cole este arquivo INTEIRO como um arquivo novo no MESMO projeto Apps Script do Code.gs das Rotas.
 * Depois: rode UMA vez "sincronizarRotas" (autorize) e UMA vez "instalarGatilhoSincronia" (agenda todo dia 07h).
 *
 * O que faz, todo dia:
 *  1. Lê as bases de coletados mais recentes (até 5 dias; pasta do Drive "Coleta - dd.mm.aaaa.xlsx"), para nenhum seller ficar de fora.
 *  2. Para cada seller + cliente que NÃO está na aba GERAL, acrescenta uma linha no mesmo layout da planilha
 *     (seller, coluna B, bairro, volume do cliente, motorista). Rua, CEP e cidade ficam em branco para completar.
 *  3. Nunca duplica seller + cliente e nunca altera linhas que já existem (o motorista só muda pela tela Rotas).
 *  4. Motorista = SOMENTE nome que começa com "GET" (o último que coletou aquele seller + cliente).
 *     Motorista GET que não estiver na aba _MOTORISTAS é incluído lá.
 *  5. Volumes das colunas dos clientes (G a K: SHEIN BRA, SHEIN D2D, TIKTOK, KWAI, ARTENY) = MÉDIA DOS ÚLTIMOS 7 DIAS
 *     de pacotes coletados daquele seller + cliente SOMENTE por motoristas GETLOG (nome começa com "GET").
 *     Coleta de terceiros não entra. Média = total GET dos 7 dias ÷ nº de dias lidos (arredondada). Atualiza todas as linhas.
 *
 * Segurança: se a coluna B da aba GERAL não for "cliente" ou "ID do seller" (pelo cabeçalho), nada é gravado.
 * Usa o serviço avançado "Drive API" (o mesmo do exportar()).
 */
var SYNC = {
  pasta: '1ZiJ-SJaMvL_qJIiYQdLxZWVhR-2Aan_A',
  nome: /^Coleta - (\d{2})\.(\d{2})\.(\d{4})\.xlsx?$/i,
  cols: { cliente: 'Client Name', sid: 'Seller ID', seller: 'Seller Name', motorista: 'Collection Driver Name', bairro: 'Shipping Area', hora: 'Scan Time' },
  tz: 'America/Sao_Paulo',
  dias: 7,
  orcamentoMs: 300000
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

/** Um item por seller + cliente do dia: {seller, sid, cliente, bairro, qtd, mot}. Cada linha da base entra em um item. */
function lerColetaSync_(f) {
  var tmp = Drive.Files.create({ name: 'tmp rotas ' + f.getName(), mimeType: MimeType.GOOGLE_SHEETS }, f.getBlob());
  try {
    var sh = SpreadsheetApp.openById(tmp.id).getSheets()[0];
    var n = sh.getLastRow() - 1;
    if (n < 1) return [];
    var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    var col = {};
    for (var k in SYNC.cols) {
      var i = cab.indexOf(SYNC.cols[k]);
      if (i < 0) throw new Error('Coluna não encontrada na base: ' + SYNC.cols[k]);
      col[k] = sh.getRange(2, i + 1, n, 1).getValues();
    }
    var g = {}, ordem = [];
    for (var r = 0; r < n; r++) {
      var seller = limpaSync_(col.seller[r][0]) || limpaSync_(col.sid[r][0]);
      if (!seller) continue;
      var cliente = limpaSync_(col.cliente[r][0]) || 'SEM CLIENTE';
      var id = nrmSync_(seller) + '|' + nrmSync_(cliente), o = g[id];
      if (!o) { o = g[id] = { seller: seller, sid: limpaSync_(col.sid[r][0]), cliente: cliente, bairro: '', qtd: 0, qGet: 0, mot: '', motHora: '' }; ordem.push(id); }
      o.qtd++;
      if (!o.bairro) o.bairro = limpaSync_(col.bairro[r][0]);
      var h = col.hora[r][0];
      var hm = h instanceof Date ? Utilities.formatDate(h, SYNC.tz, 'HH:mm:ss') : String(h || '').slice(11, 19);
      var m = limpaSync_(col.motorista[r][0]);
      if (ehGetSync_(m)) o.qGet++; // só coleta de motorista GETLOG entra na média
      if (ehGetSync_(m) && (!o.mot || hm >= o.motHora)) { o.mot = m; o.motHora = hm; }
    }
    return ordem.map(function (x) { return g[x]; });
  } finally {
    DriveApp.getFileById(tmp.id).setTrashed(true);
  }
}

/**
 * RAPIDEZ: converter o .xlsx da coleta é o que demora (~1 min por arquivo). O resumo de cada arquivo fica guardado
 * na aba oculta _CACHE_COLETA (id do arquivo + data de modificação). Arquivo que não mudou não é convertido de novo:
 * na rodada diária só o dia novo é lido; o resto vem pronto em segundos.
 */
var CACHE_COLS = ['arquivo', 'modificado', 'seller', 'sid', 'cliente', 'bairro', 'qtd', 'qGet', 'mot', 'motHora'];
function abaCache_(ss) {
  var sh = ss.getSheetByName('_CACHE_COLETA');
  if (!sh) { sh = ss.insertSheet('_CACHE_COLETA'); sh.appendRow(CACHE_COLS); sh.hideSheet(); }
  return sh;
}
function lerCache_(sh) {
  var n = sh.getLastRow() - 1, m = {};
  if (n < 1) return m;
  sh.getRange(2, 1, n, CACHE_COLS.length).getValues().forEach(function (r) {
    var k = String(r[0]) + '@' + String(r[1]);
    (m[k] = m[k] || []).push({ seller: String(r[2]), sid: String(r[3]), cliente: String(r[4]), bairro: String(r[5]), qtd: Number(r[6]) || 0, qGet: Number(r[7]) || 0, mot: String(r[8]), motHora: String(r[9]) });
  });
  return m;
}
/** Regrava a aba de cache só com os arquivos em uso (os antigos saem). */
function gravaCache_(sh, usados) {
  var linhas = [];
  usados.forEach(function (u) { u.itens.forEach(function (o) { linhas.push([u.id, u.mod, seguroSync_(o.seller), seguroSync_(o.sid), seguroSync_(o.cliente), seguroSync_(o.bairro), o.qtd, o.qGet, seguroSync_(o.mot), o.motHora]); }); });
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, CACHE_COLS.length).clearContent();
  if (linhas.length) sh.getRange(2, 1, linhas.length, CACHE_COLS.length).setValues(linhas);
}

function sincronizarRotas() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var t0 = Date.now();
    var arqs = arquivosRecentesSync_();
    if (!arqs.length) throw new Error('Nenhuma base "Coleta - dd.mm.aaaa.xlsx" encontrada.');
    var mapa = {}, ordem = [], lidos = [], somaGet = {}, convertidos = 0;
    var ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('ID_SEMANA'));
    var shC = abaCache_(ss), cache = lerCache_(shC), usados = [];
    for (var ai = 0; ai < arqs.length; ai++) {
      var fid = arqs[ai].f.getId(), fmod = String(arqs[ai].f.getLastUpdated().getTime()), itensDia = cache[fid + '@' + fmod];
      if (!itensDia) {
        if (convertidos > 0 && Date.now() - t0 > SYNC.orcamentoMs) break; // respeita o limite de tempo do Apps Script
        itensDia = lerColetaSync_(arqs[ai].f); convertidos++;
      }
      usados.push({ id: fid, mod: fmod, itens: itensDia });
      itensDia.forEach(function (o) {
        var id = nrmSync_(o.seller) + '|' + nrmSync_(o.cliente), x = mapa[id];
        somaGet[id] = (somaGet[id] || 0) + o.qGet;
        if (!x) { mapa[id] = Object.assign({}, o); ordem.push(id); return; } // cópia: o cache do dia não é alterado
        if (!x.mot && o.mot) { x.mot = o.mot; x.motHora = o.motHora; } // motorista GET do dia mais recente que tiver
        if (!x.bairro && o.bairro) x.bairro = o.bairro;
      });
      lidos.push(arqs[ai].dia);
    }
    try { gravaCache_(shC, usados); } catch (ec) { Logger.log('cache não gravado: ' + ec); }
    var itens = ordem.map(function (id) { return mapa[id]; });
    var nDias = Math.max(1, lidos.length);
    var media = function (seller, cliente) { var t = somaGet[nrmSync_(seller) + '|' + nrmSync_(cliente)] || 0; return Math.round(t / nDias); };
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
      if (modo === 'cliente') { tem[nome + '|' + b] = 1; for (var c = 6; c <= 10; c++) if (Number(r[c]) > 0) tem[nome + '|' + nrmSync_(h[c])] = 1; }
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
      r[0] = seguroSync_(String(o.seller).toUpperCase()); // nome do seller sempre em caixa alta
      r[1] = seguroSync_(modo === 'cliente' ? o.cliente : o.sid);
      r[3] = seguroSync_(o.bairro);
      var ci = -1;
      for (var c = 6; c <= 10; c++) if (nrmSync_(h[c]) === cli) ci = c;
      if (ci >= 0) r[ci] = media(o.seller, o.cliente); else semColuna.push(o.seller + ' / ' + o.cliente);
      if (o.mot) r[11] = seguroSync_(mots[nrmSync_(o.mot)]);
      linhas.push(r);
    });
    if (linhas.length) sh.getRange(sh.getLastRow() + 1, 1, linhas.length, largura).setValues(linhas);

    // Volumes G a K de TODAS as linhas = média de 7 dias de coleta GETLOG do seller + cliente da coluna (terceiros não entram).
    // Linha sem coleta GET no período fica 0. Só as colunas cujo cabeçalho é um cliente são escritas.
    var cliCols = [];
    for (var cc = 6; cc <= 10; cc++) if (String(h[cc] || '').trim()) cliCols.push(cc);
    var vAtual = sh.getDataRange().getValues(), atualizadas = 0;
    if (vAtual.length > 1 && cliCols.length) {
      var bloco = vAtual.slice(1).map(function (r) {
        return [6, 7, 8, 9, 10].map(function (c) {
          if (cliCols.indexOf(c) < 0 || !r[0]) return r[c];
          // coluna B = cliente: cada linha é um seller + cliente, então só a coluna do próprio cliente recebe volume (sem duplicar)
          if (modo === 'cliente' && nrmSync_(r[1]) !== nrmSync_(h[c])) return 0;
          return media(r[0], h[c]);
        });
      });
      sh.getRange(2, 7, bloco.length, 5).setValues(bloco);
      atualizadas = bloco.length;
    }

    // Nenhum seller fica sem motorista: linha em branco recebe o motorista que mais atende a mesma região
    // (mesmo CEP de 5 dígitos, depois mesmo bairro, depois mesma cidade). Linha que já tem motorista nunca é alterada.
    var vM = sh.getDataRange().getValues(), preenchidos = 0, semRegiao = [];
    var reg = { cep: {}, bai: {}, cid: {} };
    var chv = function (r) { return { cep: String(r[4] || '').replace(/\D/g, '').slice(0, 5), bai: nrmSync_(r[3]), cid: nrmSync_(r[5]) }; };
    vM.slice(1).forEach(function (r) {
      var m = nrmSync_(r[11]);
      if (!r[0] || !m || !mots[m]) return;
      var k = chv(r);
      ['cep', 'bai', 'cid'].forEach(function (t) { if (k[t]) { reg[t][k[t]] = reg[t][k[t]] || {}; reg[t][k[t]][m] = (reg[t][k[t]][m] || 0) + 1; } });
    });
    var melhor = function (c) { var b = '', n = 0; for (var m in (c || {})) if (c[m] > n) { n = c[m]; b = m; } return b; };
    var colL = vM.map(function (r) { return [r[11]]; }), mudouL = false;
    vM.forEach(function (r, i) {
      if (!i || !r[0] || String(r[11] || '').trim()) return;
      var k = chv(r), m = (k.cep && melhor(reg.cep[k.cep])) || (k.bai && melhor(reg.bai[k.bai])) || (k.cid && melhor(reg.cid[k.cid])) || '';
      if (m) { colL[i][0] = seguroSync_(mots[m]); mudouL = true; preenchidos++; } else semRegiao.push(r[0]);
    });
    if (mudouL) sh.getRange(1, 12, colL.length, 1).setValues(colL);

    // Conferência final: todo seller + cliente da base precisa estar na relação; linhas sem motorista / com motorista fora da lista
    var v2 = sh.getDataRange().getValues(), tem2 = {}, semMot = 0, motInvalido = 0;
    v2.slice(1).forEach(function (r) {
      if (!r[0]) return;
      var nome = nrmSync_(r[0]);
      tem2['N:' + nome] = 1; tem2['I:' + nrmSync_(r[1])] = 1; tem2[nome + '|' + nrmSync_(r[1])] = 1;
      for (var c = 6; c <= 10; c++) if (Number(r[c]) > 0) tem2[nome + '|' + nrmSync_(h[c])] = 1;
      if (!String(r[11] || '').trim()) semMot++; else if (!mots[nrmSync_(r[11])]) motInvalido++;
    });
    var faltantes = itens.filter(function (o) {
      var nome = nrmSync_(o.seller);
      return modo === 'cliente' ? !tem2[nome + '|' + nrmSync_(o.cliente)] : !(tem2['N:' + nome] || (o.sid && tem2['I:' + nrmSync_(o.sid)]));
    }).map(function (o) { return o.seller + ' / ' + o.cliente; });
    var antigo = Number(arqs[0].k) < Number(Utilities.formatDate(new Date(Date.now() - 3 * 86400000), SYNC.tz, 'yyyyMMdd'));
    var resumo = { ok: faltantes.length === 0 && semMot === 0, bases: lidos, diasNaMedia: nDias, arquivosConvertidosAgora: convertidos, segundos: Math.round((Date.now() - t0) / 1000), linhasComVolumeAtualizado: atualizadas, sellersClientesNaBase: itens.length, linhasNovas: linhas.length, motoristasNovos: novosMot.length, motoristasPreenchidos: preenchidos, semMotorista: semMot, semMotoristaLista: semRegiao.slice(0, 20), motoristaForaDaLista: motInvalido, faltantes: faltantes.slice(0, 20), semColunaDoCliente: semColuna.slice(0, 20), baseDesatualizada: antigo };
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
      erro ? 'Erro: ' + erro : 'Sellers que ficaram de fora: ' + JSON.stringify(res.faltantes) + ' | Sem motorista (sem região parecida para sugerir): ' + JSON.stringify(res.semMotoristaLista));
  } catch (em) { Logger.log('Aviso não enviado: ' + em); }
}

/** Agenda a sincronização todo dia às 07h, sem apagar os outros gatilhos (o exportar() continua). */
function instalarGatilhoSincronia() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'sincronizarAgendado' || t.getHandlerFunction() === 'sincronizarRotas') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('sincronizarAgendado').timeBased().everyDays(1).atHour(7).create();
}

/**
 * Botão "Sincronizar com a planilha" da tela Rotas (já ligado no doPost do docs/rotas-code-completo.gs):
 *   if (d.acao === 'sincronizar') return resposta(sincronizarRotas());
 */
