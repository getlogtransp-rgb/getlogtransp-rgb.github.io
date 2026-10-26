/**
 * GETLOG — ROTAS: sincronização diária (nenhum seller fora da relação).
 *
 * Cole este arquivo INTEIRO como um arquivo novo no MESMO projeto Apps Script do Code.gs das Rotas.
 * Depois: rode UMA vez "sincronizarRotas" (autorize) e UMA vez "instalarGatilhoSincronia" (agenda todo dia 07h).
 *
 * O que faz, todo dia:
 *  1. Lê a base de coletados mais recente (pasta do Drive "Coleta - dd.mm.aaaa.xlsx").
 *  2. Para cada seller + cliente que NÃO está na aba GERAL, acrescenta uma linha no mesmo layout da planilha
 *     (seller, coluna B, bairro, volume do cliente, motorista). Rua, CEP e cidade ficam em branco para completar.
 *  3. Nunca duplica seller + cliente e nunca altera linhas que já existem (o motorista só muda pela tela Rotas).
 *  4. Motorista = SOMENTE nome que começa com "GET" (o último que coletou aquele seller + cliente).
 *     Motorista GET que não estiver na aba _MOTORISTAS é incluído lá.
 *
 * Segurança: se a coluna B da aba GERAL não for "cliente" ou "ID do seller" (pelo cabeçalho), nada é gravado.
 * Usa o serviço avançado "Drive API" (o mesmo do exportar()).
 */
var SYNC = {
  pasta: '1ZiJ-SJaMvL_qJIiYQdLxZWVhR-2Aan_A',
  nome: /^Coleta - (\d{2})\.(\d{2})\.(\d{4})\.xlsx?$/i,
  cols: { cliente: 'Client Name', sid: 'Seller ID', seller: 'Seller Name', motorista: 'Collection Driver Name', bairro: 'Shipping Area', hora: 'Scan Time' },
  tz: 'America/Sao_Paulo'
};

function nrmSync_(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').replace(/^'/, '').trim();
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

function arquivoRecenteSync_() {
  var it = DriveApp.getFolderById(SYNC.pasta).getFiles(), melhor = null, mk = 0;
  while (it.hasNext()) {
    var f = it.next(), m = SYNC.nome.exec(f.getName());
    if (!m) continue;
    var k = Number(m[3] + m[2] + m[1]);
    if (k > mk) { mk = k; melhor = f; }
  }
  return melhor;
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
      if (!o) { o = g[id] = { seller: seller, sid: limpaSync_(col.sid[r][0]), cliente: cliente, bairro: '', qtd: 0, mot: '', motHora: '' }; ordem.push(id); }
      o.qtd++;
      if (!o.bairro) o.bairro = limpaSync_(col.bairro[r][0]);
      var h = col.hora[r][0];
      var hm = h instanceof Date ? Utilities.formatDate(h, SYNC.tz, 'HH:mm:ss') : String(h || '').slice(11, 19);
      var m = limpaSync_(col.motorista[r][0]);
      if (ehGetSync_(m) && (!o.mot || hm >= o.motHora)) { o.mot = m; o.motHora = hm; }
    }
    return ordem.map(function (x) { return g[x]; });
  } finally {
    DriveApp.getFileById(tmp.id).setTrashed(true);
  }
}

function sincronizarRotas() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var f = arquivoRecenteSync_();
    if (!f) throw new Error('Nenhuma base "Coleta - dd.mm.aaaa.xlsx" encontrada.');
    var itens = lerColetaSync_(f);
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
      r[0] = seguroSync_(o.seller);
      r[1] = seguroSync_(modo === 'cliente' ? o.cliente : o.sid);
      r[3] = seguroSync_(o.bairro);
      var ci = -1;
      for (var c = 6; c <= 10; c++) if (nrmSync_(h[c]) === cli) ci = c;
      if (ci >= 0) r[ci] = o.qtd; else semColuna.push(o.seller + ' / ' + o.cliente);
      if (o.mot) r[11] = seguroSync_(mots[nrmSync_(o.mot)]);
      linhas.push(r);
    });
    if (linhas.length) sh.getRange(sh.getLastRow() + 1, 1, linhas.length, largura).setValues(linhas);

    var resumo = { base: f.getName(), sellersClientesNaBase: itens.length, linhasNovas: linhas.length, motoristasNovos: novosMot.length, semColunaDoCliente: semColuna.slice(0, 20) };
    Logger.log(JSON.stringify(resumo));
    return resumo;
  } finally {
    lock.releaseLock();
  }
}

/** Agenda a sincronização todo dia às 07h, sem apagar os outros gatilhos (o exportar() continua). */
function instalarGatilhoSincronia() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'sincronizarRotas') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('sincronizarRotas').timeBased().everyDays(1).atHour(7).create();
}

/**
 * Botão "Sincronizar com a planilha" da tela Rotas.
 * No doPost do Code.gs, logo DEPOIS da linha que confere o token e ANTES de "const lock", acrescente:
 *   if (d.acao === 'sincronizar') return resposta(sincronizarRotas());
 */
