/**
 * GETLOG - Planilha do ponto (versão 2)
 * Cole este código em: Planilha "GETLOG - Ponto" → Extensões → Apps Script (substitua todo o código antigo).
 * Mantenha o mesmo TOKEN que já está no portal (Usuários e acessos → Configurações do sistema → Planilha do ponto).
 * Implantar → Gerenciar implantações → editar (lápis) → Versão: Nova versão → Implantar. O endereço continua o mesmo.
 *
 * O que esta versão garante no servidor (não depende do navegador):
 *  - Cada pessoa se identifica com uma credencial derivada da própria senha (o servidor guarda só o hash).
 *  - Acesso desativado/excluído é negado na hora (aba Acessos + cadastro publicado no site).
 *  - Uma ação gera uma única marcação (mesmo id ou mesma pessoa/dia/tipo não duplica).
 *  - Só o administrador lista tudo, corrige marcações e decide ajustes; tudo vai para a aba Auditoria.
 */
var TOKEN = 'TROQUE-ESTE-TOKEN';
// Se o projeto não foi aberto pela planilha (Extensões → Apps Script), coloque aqui o ID da planilha (parte do endereço entre /d/ e /edit).
var PLANILHA_ID = '';
var SITE = 'https://getlogbr.com.br';
var VERSAO = 2;
var PASTA_FOTOS = 'GETLOG - Fotos do ponto';
var FUSO = 'America/Sao_Paulo';
var MARC = { entrada: 'Início da jornada', almoco: 'Saída para almoço', retorno: 'Retorno do almoço', saida: 'Fim da jornada' };
var CAB = ['Data', 'Hora', 'Nome', 'Login', 'Tipo de usuário', 'Marcação', 'Endereço', 'Latitude', 'Longitude', 'Precisão (m)', 'Foto', 'ID', 'Horário (ISO)', 'Situação', 'Origem'];
var CAB_AJ = ['ID', 'Solicitado em', 'Login', 'Nome', 'Tipo de usuário', 'Data', 'Hora', 'Marcação', 'Motivo', 'Foto', 'Latitude', 'Longitude', 'Precisão (m)', 'Endereço', 'Situação', 'Decidido por', 'Decidido em', 'Observação', 'ID da marcação'];
var CAB_AUD = ['Quando', 'Quem', 'Alteração', 'ID', 'Pessoa', 'Antes', 'Depois', 'Motivo'];
var INATIVAS = ['Excluída', 'Substituída'];
function aba_(nome, cab) {
    var ss = (PLANILHA_ID ? SpreadsheetApp.openById(PLANILHA_ID) : SpreadsheetApp.getActive());
    var sh = ss.getSheetByName(nome);
    if (!sh) {
        sh = ss.insertSheet(nome);
        sh.appendRow(cab);
        sh.setFrozenRows(1);
        sh.getRange(1, 1, 1, cab.length).setFontWeight('bold');
    }
    else if (sh.getLastColumn() < cab.length)
        sh.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold');
    return sh;
}
var marcacoes_ = function () { return aba_('Marcações', CAB); };
var senhas_ = function () { return aba_('Senhas', ['Login', 'salt', 'iv', 'key', 'Trocada em', 'Credencial (hash)']); };
var acessos_ = function () { return aba_('Acessos', ['Login', 'Ativo', 'Alterado por', 'Em']); };
var ajustes_ = function () { return aba_('Ajustes', CAB_AJ); };
var auditoria_ = function () { return aba_('Auditoria', CAB_AUD); };
function pasta_() { var it = DriveApp.getFoldersByName(PASTA_FOTOS); return it.hasNext() ? it.next() : DriveApp.createFolder(PASTA_FOTOS); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
var txt_ = function (v) { return v instanceof Date ? Utilities.formatDate(v, FUSO, 'yyyy-MM-dd') : String(v); };
var agora_ = function () { return new Date().toISOString(); };
var hoje_ = function () { return Utilities.formatDate(new Date(), FUSO, 'yyyy-MM-dd'); };
// Texto vindo do portal entra sempre como texto puro (nunca vira fórmula da planilha).
var T_ = function (v) { return "'" + String(v == null ? '' : v); };
var falha_ = function (c) { var e = new Error(c); e.codigo = c; return e; };
var hash_ = function (s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8).map(function (b) { return ((b + 256) % 256).toString(16).padStart(2, '0'); }).join(''); };
function salvaFoto_(dataUrl, nome) {
    if (!dataUrl)
        return '';
    var blob = Utilities.newBlob(Utilities.base64Decode(String(dataUrl).split(',')[1]), 'image/jpeg', nome + '.jpg');
    return pasta_().createFile(blob).getUrl();
}
// ---------- Identidade ----------
// Cadastro publicado no site (login, tipo, ativo, data da senha definida pelo admin e hash da credencial dessa senha).
function usuarios_() {
    var c = CacheService.getScriptCache(), k = c.get('usuarios');
    if (k)
        return JSON.parse(k);
    var r = UrlFetchApp.fetch(SITE + '/data/users.json?t=' + Date.now(), { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200)
        throw falha_('site');
    var m = {};
    JSON.parse(r.getContentText()).users.forEach(function (u) { m[u.login] = { role: u.role, active: u.active !== false, pwEm: u.pwEm || '', ah: u.ah || '' }; });
    c.put('usuarios', JSON.stringify(m), 60);
    return m;
}
function bloqueado_(login) {
    var v = acessos_().getDataRange().getValues();
    var r = v.find(function (x, k) { return k > 0 && x[0] === login; });
    return !!r && r[1] === false;
}
function linhaSenha_(login) {
    var sh = senhas_(), v = sh.getDataRange().getValues();
    var i = v.findIndex(function (r, k) { return k > 0 && r[0] === login; });
    return i > 0 ? { i: i + 1, key: String(v[i][3] || ''), em: String(v[i][4] || ''), ah: String(v[i][5] || '') } : null;
}
// Confere quem está pedindo. A senha vigente é a mais recente entre a definida pelo admin (site) e a trocada pela pessoa (aba Senhas).
function quem_(d) {
    var u = usuarios_()[d.login];
    if (!u || !u.active || bloqueado_(d.login))
        throw falha_('acesso');
    var s = linhaSenha_(d.login);
    var daPessoa = s && s.em && (!u.pwEm || s.em > u.pwEm);
    var ref = daPessoa ? s.ah : u.ah;
    var h = hash_(d.av || '');
    if (!d.av)
        throw falha_('credencial');
    if (!ref) {
        // Conta anterior à versão 2 (sem credencial registrada): registra a primeira apresentada.
        if (daPessoa)
            senhas_().getRange(s.i, 6).setValue("'" + h);
        else if (s)
            senhas_().getRange(s.i, 1, 1, 6).setValues([[d.login, '', '', '', "'" + agora_(), "'" + h]]);
        else
            senhas_().appendRow([d.login, '', '', '', "'" + agora_(), "'" + h]);
        return { login: d.login, role: u.role };
    }
    if (h !== ref)
        throw falha_('credencial');
    return { login: d.login, role: u.role };
}
var soAdmin_ = function (eu) { if (eu.role !== 'admin')
    throw falha_('permissao'); };
function audita_(eu, op, id, alvo, antes, depois, motivo) {
    auditoria_().appendRow(["'" + agora_(), eu.login, op, T_(id), T_(alvo), antes ? T_(JSON.stringify(antes)) : '', depois ? T_(JSON.stringify(depois)) : '', T_(motivo)]);
}
// ---------- Marcações ----------
var item_ = function (r) { return ({ dia: txt_(r[0]), name: r[2], login: r[3], role: r[4], tipo: TIPO_[r[5]] || r[5], end: r[6], lat: +r[7], lon: +r[8], acc: +r[9], fotoUrl: r[10], id: r[11], ts: String(r[12]), situacao: r[13] || 'Ativa', origem: r[14] || 'App' }); };
var TIPO_ = Object.fromEntries(Object.entries(MARC).map(function (_a) {
    var k = _a[0], v = _a[1];
    return [v, k];
}));
var ativa_ = function (r) { return !INATIVAS.includes(r[13]); };
function existe_(v, login, dia, tipo) { return v.findIndex(function (r, k) { return k > 0 && ativa_(r) && r[3] === login && txt_(r[0]) === dia && r[5] === MARC[tipo]; }); }
function grava_(m) {
    var t = new Date(m.ts);
    marcacoes_().appendRow(["'" + m.dia, Utilities.formatDate(t, FUSO, 'HH:mm:ss'), T_(m.name), m.login, m.role, MARC[m.tipo], T_(m.end), m.lat || '', m.lon || '', Math.round(m.acc || 0), m.foto || '', "'" + m.id, "'" + m.ts, 'Ativa', m.origem || 'App']);
}
var hora_ = function (r) { return Utilities.formatDate(new Date(String(r[12])), FUSO, 'HH:mm'); };
var tsDe_ = function (dia, hora) { return new Date(dia + 'T' + hora + ':00-03:00').toISOString(); };
var valida_ = function (d) { if (!MARC[d.tipo] || !/^\d{4}-\d{2}-\d{2}$/.test(d.dia || '') || (d.hora !== undefined && !/^\d{2}:\d{2}$/.test(d.hora)))
    throw falha_('dados'); };
function marcar_(d, eu) {
    valida_(d);
    var sh = marcacoes_(), v = sh.getDataRange().getValues();
    // Idempotência: o mesmo envio (id) ou a mesma marcação do dia nunca entra duas vezes.
    var ja = v.findIndex(function (r, k) { return k > 0 && r[11] === d.id; });
    if (ja > 0)
        return { ok: true, repetido: true, id: d.id };
    var dup = existe_(v, eu.login, d.dia, d.tipo);
    if (dup > 0)
        return { ok: true, repetido: true, id: v[dup][11] };
    var foto = salvaFoto_(d.foto, "".concat(d.dia, " ").concat(eu.login, " ").concat(d.tipo));
    grava_(Object.assign({}, d, { login: eu.login, role: eu.role, foto: foto, origem: 'App' }));
    return { ok: true };
}
function listar_(d, eu) {
    var desde = d.desde || '';
    var itens = marcacoes_().getDataRange().getValues().slice(1).filter(function (r) { return ativa_(r) && txt_(r[0]) >= desde && (eu.role === 'admin' || r[3] === eu.login); }).map(item_);
    return { ok: true, itens: itens };
}
function foto_(d, eu) {
    var url = String(d.url || '');
    var mr = marcacoes_().getDataRange().getValues().find(function (r) { return r[10] === url; });
    var ar = mr ? null : ajustes_().getDataRange().getValues().find(function (r) { return r[9] === url; });
    if (!url || (!mr && !ar))
        throw falha_('foto');
    var login = mr ? mr[3] : ar[2];
    if (eu.role !== 'admin' && login !== eu.login)
        throw falha_('permissao');
    var id = (url.match(/[-\w]{25,}/) || [])[0];
    return { ok: true, foto: 'data:image/jpeg;base64,' + Utilities.base64Encode(DriveApp.getFileById(id).getBlob().getBytes()) };
}
// Correção direta do administrador: sem foto/localização, sempre auditada.
function adm_(d, eu) {
    soAdmin_(eu);
    if (!String(d.motivo || '').trim())
        throw falha_('motivo');
    var sh = marcacoes_(), v = sh.getDataRange().getValues();
    if (d.op === 'incluir') {
        valida_(d);
        if (!usuarios_()[d.alvo])
            throw falha_('dados');
        if (existe_(v, d.alvo, d.dia, d.tipo) > 0)
            throw falha_('duplicada');
        var m = { id: Utilities.getUuid(), dia: d.dia, ts: tsDe_(d.dia, d.hora), name: d.name, login: d.alvo, role: d.role, tipo: d.tipo, origem: 'Incluída pelo administrador' };
        grava_(m);
        audita_(eu, 'Incluiu marcação', m.id, d.alvo, null, { dia: d.dia, tipo: MARC[d.tipo], hora: d.hora }, d.motivo);
        return { ok: true, id: m.id };
    }
    var i = v.findIndex(function (r, k) { return k > 0 && r[11] === d.id && ativa_(r); });
    if (i < 0)
        throw falha_('nao_encontrada');
    var r = v[i], antes = { dia: txt_(r[0]), tipo: r[5], hora: hora_(r) };
    if (d.op === 'editar') {
        if (!/^\d{2}:\d{2}$/.test(d.hora || ''))
            throw falha_('dados');
        var ts = tsDe_(antes.dia, d.hora);
        sh.getRange(i + 1, 2).setValue(d.hora + ':00');
        sh.getRange(i + 1, 13).setValue("'" + ts);
        sh.getRange(i + 1, 15).setValue('Corrigida pelo administrador');
        audita_(eu, 'Editou marcação', d.id, r[3], antes, Object.assign({}, antes, { hora: d.hora }), d.motivo);
        return { ok: true };
    }
    if (d.op === 'excluir') {
        sh.getRange(i + 1, 14).setValue('Excluída');
        audita_(eu, 'Excluiu marcação', d.id, r[3], antes, null, d.motivo);
        return { ok: true };
    }
    throw falha_('dados');
}
// ---------- Ajustes ----------
var ajuste_ = function (r) { return ({ id: r[0], em: String(r[1]), login: r[2], name: r[3], role: r[4], dia: txt_(r[5]), hora: String(r[6]), tipo: TIPO_[r[7]] || r[7], motivo: r[8], fotoUrl: r[9], lat: r[10], lon: r[11], acc: r[12], end: r[13], situacao: r[14], por: r[15], decididoEm: String(r[16] || ''), obs: r[17] }); };
function pedirAjuste_(d, eu) {
    valida_(d);
    if (!d.hora || !String(d.motivo || '').trim() || d.dia > hoje_())
        throw falha_('dados');
    if (eu.role !== 'admin' && (!d.foto || !isFinite(+d.lat) || d.lat === '' || d.lat == null))
        throw falha_('foto');
    var sh = ajustes_();
    if (sh.getDataRange().getValues().some(function (r, k) { return k > 0 && r[0] === d.id; }))
        return { ok: true, repetido: true };
    var foto = salvaFoto_(d.foto, "ajuste ".concat(d.dia, " ").concat(eu.login, " ").concat(d.tipo));
    sh.appendRow(["'" + (d.id || Utilities.getUuid()), "'" + agora_(), eu.login, T_(d.name || eu.login), eu.role, "'" + d.dia, "'" + d.hora, MARC[d.tipo], T_(String(d.motivo).slice(0, 400)), foto, +d.lat || '', +d.lon || '', Math.round(d.acc || 0), T_(d.end), 'Pendente', '', '', '', '']);
    return { ok: true };
}
function listarAjustes_(d, eu) {
    var itens = ajustes_().getDataRange().getValues().slice(1).map(ajuste_)
        .filter(function (a) { return (eu.role === 'admin' || a.login === eu.login) && (!d.situacao || a.situacao === d.situacao); }).reverse();
    return { ok: true, itens: itens };
}
function decidir_(d, eu) {
    soAdmin_(eu);
    var sh = ajustes_(), v = sh.getDataRange().getValues();
    var i = v.findIndex(function (r, k) { return k > 0 && r[0] === d.id; });
    if (i < 0)
        throw falha_('nao_encontrada');
    var a = ajuste_(v[i]);
    if (a.situacao !== 'Pendente')
        throw falha_('decidido');
    var idMarc = '';
    if (d.aprovar) {
        var mh = marcacoes_(), mv = mh.getDataRange().getValues();
        var j = existe_(mv, a.login, a.dia, a.tipo);
        if (j > 0) {
            mh.getRange(j + 1, 14).setValue('Substituída');
            audita_(eu, 'Substituiu marcação (ajuste aprovado)', mv[j][11], a.login, { dia: a.dia, tipo: MARC[a.tipo], hora: hora_(mv[j]) }, null, 'Ajuste ' + a.id);
        }
        idMarc = Utilities.getUuid();
        grava_({ id: idMarc, dia: a.dia, ts: tsDe_(a.dia, a.hora), name: a.name, login: a.login, role: a.role, tipo: a.tipo, end: a.end, lat: a.lat, lon: a.lon, acc: a.acc, foto: a.fotoUrl, origem: 'Ajuste aprovado' });
    }
    sh.getRange(i + 1, 15, 1, 5).setValues([[d.aprovar ? 'Aprovado' : 'Rejeitado', eu.login, "'" + agora_(), T_(String(d.obs || '').slice(0, 300)), idMarc]]);
    audita_(eu, d.aprovar ? 'Aprovou ajuste' : 'Rejeitou ajuste', a.id, a.login, { situacao: 'Pendente' }, { situacao: d.aprovar ? 'Aprovado' : 'Rejeitado', dia: a.dia, tipo: MARC[a.tipo], hora: a.hora }, d.obs || a.motivo);
    return { ok: true, id: idMarc };
}
// Rode esta função uma vez no editor (▷ Executar) para o Google pedir as permissões.
function autorizar() { usuarios_(); marcacoes_(); pasta_(); console.log('Tudo autorizado.'); }
// ---------- Entrada ----------
function doPost(e) {
    var d;
    try {
        d = JSON.parse(e.postData.contents);
    }
    catch (x) {
        return json_({ ok: false, erro: 'dados' });
    }
    if (d.token !== TOKEN)
        return json_({ ok: false, erro: 'token' });
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
        var eu = quem_(d);
        switch (d.acao) {
            case 'eu': return json_({ ok: true, role: eu.role });
            case 'senha': {
                if (!d.key || !d.ah)
                    throw falha_('dados');
                var s = linhaSenha_(eu.login), linha = [eu.login, "'" + d.salt, "'" + d.iv, "'" + d.key, "'" + d.em, "'" + d.ah];
                if (s)
                    senhas_().getRange(s.i, 1, 1, 6).setValues([linha]);
                else
                    senhas_().appendRow(linha);
                return json_({ ok: true });
            }
            case 'listar': return json_(listar_(d, eu));
            case 'foto': return json_(foto_(d, eu));
            case 'acesso': {
                soAdmin_(eu);
                if (d.alvo === eu.login)
                    throw falha_('permissao');
                var sh = acessos_(), v = sh.getDataRange().getValues(), i = v.findIndex(function (r, k) { return k > 0 && r[0] === d.alvo; });
                var linha = [d.alvo, !!d.ativo, eu.login, "'" + agora_()];
                if (i > 0)
                    sh.getRange(i + 1, 1, 1, 4).setValues([linha]);
                else
                    sh.appendRow(linha);
                audita_(eu, d.ativo ? 'Liberou acesso' : 'Bloqueou acesso', '', d.alvo, null, null, '');
                return json_({ ok: true });
            }
            case 'adm': return json_(adm_(d, eu));
            case 'ajuste': return json_(pedirAjuste_(d, eu));
            case 'ajustes': return json_(listarAjustes_(d, eu));
            case 'decidir': return json_(decidir_(d, eu));
            case 'auditoria': {
                soAdmin_(eu);
                var itens = auditoria_().getDataRange().getValues().slice(1).slice(-200).reverse()
                    .map(function (r) { return ({ em: String(r[0]), por: r[1], op: r[2], id: r[3], alvo: r[4], antes: r[5], depois: r[6], motivo: r[7] }); });
                return json_({ ok: true, itens: itens });
            }
            default: return json_(marcar_(d, eu)); // 'marcar' (e envios de versões antigas do portal)
        }
    }
    catch (x) {
        if (!x.codigo)
            console.error(x);
        return json_({ ok: false, erro: x.codigo || 'interno' });
    }
    finally {
        lock.releaseLock();
    }
}
function doGet(e) {
    var p = e.parameter;
    // Chave trancada pela senha (só abre com a senha da pessoa). Usada no login.
    if (p.senha) {
        var s = linhaSenha_(p.senha);
        return json_({ ok: true, dados: s && s.key ? (function (r) { return ({ salt: r[1], iv: r[2], key: r[3], em: String(r[4]) }); })(senhas_().getRange(s.i, 1, 1, 5).getValues()[0]) : null });
    }
    if (p.versao)
        return json_({ ok: true, versao: VERSAO });
    if (p.token !== TOKEN)
        return json_({ ok: false, erro: 'token' });
    return json_({ ok: true, itens: [], versao: VERSAO }); // teste de conexão do portal; dados só via POST autenticado
}
