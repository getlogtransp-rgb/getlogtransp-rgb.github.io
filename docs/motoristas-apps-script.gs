/**
 * GETLOG — lista de motoristas com o MODELO DO VEÍCULO (planilha "MOTORISTA - DADOS", aba GET).
 * Cole este arquivo INTEIRO como arquivo novo no MESMO projeto do script do Drive que o portal já usa
 * e, no começo do doGet, logo abaixo da linha do rotaColetados_, acrescente:
 *     var rm = rotaMotoristas_(e); if (rm) return rm;
 * Depois: Implantar > Gerenciar implantações > lápis > Nova versão > Implantar (mesma URL).
 * Devolve { ok:true, dados:{ motoristas:[{nome, modelo, placa}] } }. Só lê; nunca grava nada.
 */
var MOT_ID = '1PFKysChl21loaMAwn1vM65wA9RNBmkNW';
function motJson_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function motNrm_(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim(); }
function rotaMotoristas_(e) {
  if (!(e && e.parameter && e.parameter.fonte === 'motoristas')) return null;
  try { return motJson_({ ok: true, dados: { motoristas: motoristas_() } }); }
  catch (err) { return motJson_({ ok: false, erro: String(err) }); }
}
function motLer_(sheets) {
  var sh = sheets.filter(function (x) { return motNrm_(x.getName()).indexOf('GET') === 0; })[0];
  if (!sh) return [];
  var v = sh.getDataRange().getValues(), h = v[0].map(motNrm_);
  var cN = h.indexOf('NOME');
  var cM = -1, cP = -1;
  h.forEach(function (t, i) {
    if (cM < 0 && /MODELO|VEICULO|TIPO DE VEICULO/.test(t) && !/PLACA/.test(t)) cM = i;
    if (cP < 0 && /PLACA/.test(t)) cP = i;
  });
  var out = [];
  v.slice(1).forEach(function (r) {
    var n = String(r[cN] == null ? '' : r[cN]).trim();
    if (n) out.push({ nome: n, modelo: cM >= 0 ? String(r[cM] == null ? '' : r[cM]).trim() : '', placa: cP >= 0 ? String(r[cP] == null ? '' : r[cP]).trim() : '' });
  });
  return out;
}
function motoristas_() {
  var f = DriveApp.getFileById(MOT_ID), C = CacheService.getScriptCache();
  var ck = 'mot_veic_' + MOT_ID + '_' + f.getLastUpdated().getTime(), salvo = C.get(ck);
  if (salvo) return JSON.parse(salvo);
  var out;
  if (f.getMimeType() === MimeType.GOOGLE_SHEETS) out = motLer_(SpreadsheetApp.openById(MOT_ID).getSheets());
  else {
    var tmp = Drive.Files.create({ name: 'tmp motoristas veiculo', mimeType: MimeType.GOOGLE_SHEETS }, f.getBlob());
    try { out = motLer_(SpreadsheetApp.openById(tmp.id).getSheets()); } finally { DriveApp.getFileById(tmp.id).setTrashed(true); }
  }
  try { C.put(ck, JSON.stringify(out), 21600); } catch (e) {}
  return out;
}
