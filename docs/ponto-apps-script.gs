/**
 * GETLOG - Planilha do ponto
 * Cole este código em: Planilha "GETLOG - Ponto" → Extensões → Apps Script.
 * Troque o TOKEN abaixo pelo mesmo texto que for colocado no portal (Usuários → Planilha do ponto).
 * Implantar → Nova implantação → App da Web → Executar como: Eu · Quem pode acessar: Qualquer pessoa.
 */
const TOKEN = 'TROQUE-ESTE-TOKEN';
const PASTA_FOTOS = 'GETLOG - Fotos do ponto';
const FUSO = 'America/Sao_Paulo';
const MARC = { entrada: 'Início da jornada', almoco: 'Saída para almoço', retorno: 'Retorno do almoço', saida: 'Fim da jornada' };
const CAB = ['Data', 'Hora', 'Nome', 'Login', 'Tipo de usuário', 'Marcação', 'Endereço', 'Latitude', 'Longitude', 'Precisão (m)', 'Foto', 'ID', 'Horário (ISO)'];

function aba_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName('Marcações');
  if (!sh) { sh = ss.insertSheet('Marcações'); sh.appendRow(CAB); sh.setFrozenRows(1); sh.getRange(1, 1, 1, CAB.length).setFontWeight('bold'); }
  return sh;
}
function pasta_() {
  const it = DriveApp.getFoldersByName(PASTA_FOTOS);
  return it.hasNext() ? it.next() : DriveApp.createFolder(PASTA_FOTOS);
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
const txt_ = v => v instanceof Date ? Utilities.formatDate(v, FUSO, 'yyyy-MM-dd') : String(v);

function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  if (d.token !== TOKEN) return json_({ ok: false, erro: 'token' });
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = aba_();
    const n = sh.getLastRow() - 1;
    if (n > 0 && sh.getRange(2, 12, n, 1).getValues().some(r => r[0] === d.id)) return json_({ ok: true, repetido: true });
    let foto = '';
    if (d.foto) {
      const blob = Utilities.newBlob(Utilities.base64Decode(d.foto.split(',')[1]), 'image/jpeg', `${d.dia} ${d.login} ${d.tipo}.jpg`);
      foto = pasta_().createFile(blob).getUrl();
    }
    const t = new Date(d.ts);
    sh.appendRow(["'" + d.dia, Utilities.formatDate(t, FUSO, 'HH:mm:ss'), d.name, d.login, d.role, MARC[d.tipo] || d.tipo,
      d.end, d.lat, d.lon, Math.round(d.acc || 0), foto, d.id, "'" + d.ts]);
    return json_({ ok: true });
  } finally { lock.releaseLock(); }
}

function doGet(e) {
  const p = e.parameter;
  if (p.token !== TOKEN) return json_({ ok: false, erro: 'token' });
  if (p.foto) {
    const id = (p.foto.match(/[-\w]{25,}/) || [])[0];
    const b = DriveApp.getFileById(id).getBlob();
    return json_({ ok: true, foto: 'data:image/jpeg;base64,' + Utilities.base64Encode(b.getBytes()) });
  }
  const tipo = Object.fromEntries(Object.entries(MARC).map(([k, v]) => [v, k]));
  const desde = p.desde || '';
  const itens = aba_().getDataRange().getValues().slice(1)
    .map(r => ({ dia: txt_(r[0]), name: r[2], login: r[3], role: r[4], tipo: tipo[r[5]] || r[5], end: r[6], lat: +r[7], lon: +r[8], acc: +r[9], fotoUrl: r[10], id: r[11], ts: String(r[12]) }))
    .filter(x => x.dia >= desde);
  return json_({ ok: true, itens });
}
