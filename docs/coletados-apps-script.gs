/**
 * GETLOG — leitura da BASE DE COLETADOS (pasta do Drive com "Coleta - dd.mm.aaaa.xlsx").
 *
 * Cole este arquivo INTEIRO como um arquivo novo no MESMO projeto do script do Drive que o portal já usa
 * (o da Performance) e siga o passo a passo em docs/coletados-apps-script.md.
 *
 * O que ele faz: abre a planilha do dia, conta os pacotes por cliente + seller + motorista + bairro
 * (com o 1º e o último bip e quantos já foram descarregados) e devolve só esse resumo (~200 KB em vez de 24 MB).
 * O resumo fica guardado numa pasta de cache e só é refeito quando o arquivo do dia muda no Drive.
 * Nenhum pacote é descartado: cada linha da planilha entra em exatamente um grupo.
 */
var COLETA_PASTA = '1ZiJ-SJaMvL_qJIiYQdLxZWVhR-2Aan_A';
var COLETA_NOME = /^Coleta - (\d{2})\.(\d{2})\.(\d{4})\.xlsx?$/i;
var COLETA_CACHE = 'GETLOG - cache coletados (não apagar)';
var COLETA_TZ = 'America/Sao_Paulo';
// Colunas lidas da planilha (pelo nome do cabeçalho)
var COLETA_COLS = {
  cliente: 'Client Name', sid: 'Seller ID', seller: 'Seller Name', motorista: 'Collection Driver Name',
  bairro: 'Shipping Area', hora: 'Scan Time', desc: 'Status de descarregamento'
};

function coletaJson_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** Chame no começo do doGet: devolve a resposta se a chamada for de coletados, ou null para seguir o resto do script. */
function rotaColetados_(e) {
  var f = e && e.parameter && e.parameter.fonte;
  if (f === 'lista_coletados') return coletaJson_({ ok: true, dados: listaColetados_() });
  if (f === 'coletados') {
    try {
      var d = coletados_(String(e.parameter.dia || ''));
      return coletaJson_(d ? { ok: true, dados: d } : { ok: false, erro: 'sem arquivo' });
    } catch (err) { return coletaJson_({ ok: false, erro: String(err) }); }
  }
  return null;
}

function listaColetados_() {
  var out = [], it = DriveApp.getFolderById(COLETA_PASTA).getFiles();
  while (it.hasNext()) {
    var f = it.next(), m = COLETA_NOME.exec(f.getName());
    if (m) out.push({ dia: m[1] + '.' + m[2] + '.' + m[3], modificadoEm: f.getLastUpdated().toISOString() });
  }
  return out;
}

function pastaCacheColeta_() {
  var it = DriveApp.getFoldersByName(COLETA_CACHE);
  return it.hasNext() ? it.next() : DriveApp.createFolder(COLETA_CACHE);
}

function arquivoColeta_(dia) {
  var it = DriveApp.getFolderById(COLETA_PASTA).getFiles();
  while (it.hasNext()) {
    var f = it.next(), m = COLETA_NOME.exec(f.getName());
    if (m && m[1] + '.' + m[2] + '.' + m[3] === dia) return f;
  }
  return null;
}

function coletados_(dia) {
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(dia)) return null;
  var f = arquivoColeta_(dia);
  if (!f) return null;
  var sig = f.getLastUpdated().toISOString();
  var cache = pastaCacheColeta_(), nomeCache = dia + '.json';
  var ci = cache.getFilesByName(nomeCache);
  var velho = ci.hasNext() ? ci.next() : null;
  if (velho && velho.getDescription() === sig) return JSON.parse(velho.getBlob().getDataAsString());

  var dados = resumirColeta_(f);
  dados.modificadoEm = sig;
  var txt = JSON.stringify(dados);
  if (velho) { velho.setContent(txt); velho.setDescription(sig); }
  else cache.createFile(nomeCache, txt, MimeType.PLAIN_TEXT).setDescription(sig);
  return dados;
}

function resumirColeta_(f) {
  // Converte o .xlsx numa planilha Google temporária para ler (precisa do serviço avançado "Drive API").
  var tmp = Drive.Files.create({ name: 'tmp coleta ' + f.getName(), mimeType: MimeType.GOOGLE_SHEETS }, f.getBlob());
  try {
    var sh = SpreadsheetApp.openById(tmp.id).getSheets()[0];
    var n = sh.getLastRow() - 1, cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    if (n < 1) return { colunas: [], linhas: [], total: 0 };
    var col = {};
    for (var k in COLETA_COLS) {
      var i = cab.indexOf(COLETA_COLS[k]);
      if (i < 0) throw new Error('Coluna não encontrada: ' + COLETA_COLS[k]);
      col[k] = sh.getRange(2, i + 1, n, 1).getValues();
    }
    var g = {}, total = 0, horas = [];
    for (var hh = 0; hh < 24; hh++) horas.push(0);
    for (var r = 0; r < n; r++) {
      var h = col.hora[r][0];
      var hm = h instanceof Date ? Utilities.formatDate(h, COLETA_TZ, 'HH:mm:ss') : String(h || '').slice(11, 19);
      var chave = [col.cliente[r][0], col.sid[r][0], col.seller[r][0], col.motorista[r][0], col.bairro[r][0]].map(function (x) { return String(x || '').trim(); });
      var id = chave.join('\u0001'), o = g[id];
      if (!o) o = g[id] = chave.concat([0, 0, hm, hm]);
      o[5]++; total++;
      if (hm) horas[+hm.slice(0, 2)]++;
      if (/^j[aá] descarregado/i.test(String(col.desc[r][0] || ''))) o[6]++;
      if (hm && (!o[7] || hm < o[7])) o[7] = hm;
      if (hm && hm > o[8]) o[8] = hm;
    }
    var linhas = []; for (var x in g) linhas.push(g[x]);
    return { colunas: ['cliente', 'sid', 'seller', 'motorista', 'bairro', 'qtd', 'descarregados', 'ini', 'fim'], linhas: linhas, total: total, horas: horas };
  } finally {
    DriveApp.getFileById(tmp.id).setTrashed(true);
  }
}

/** Opcional: acionador a cada 30 min para deixar o resumo de hoje pronto (o portal abre mais rápido). */
function aquecerColetados() {
  var hoje = Utilities.formatDate(new Date(), COLETA_TZ, 'dd.MM.yyyy');
  coletados_(hoje);
}
