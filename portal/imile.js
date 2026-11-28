/* GETLOG – Operações em lote no IMILE (migrado da extensão "IMILE & GETLOG").
   Telas: Troca de motorista (por seller e por planilha), Atribuição, Motoristas (editar / desativar / ativar) e Desatribuição de 21 dias.
   Tudo passa pelo robô do IMILE (Cloudflare Worker, docs/imile-worker.js); o portal só guarda a regra e a tela. */
(() => {
  'use strict';
  const HUB = 'S21074701', ESTACAO = 'DS FM NOR', MOTIVO = 'Troca de Motorista', DIAS_TRANSITO = 31, ABA_ATRIB = 'ATRIBUIÇÕES';
  const COL = {
    waybill: ['WAYBILL', 'WAYBILL NO', 'WAYBILL NO.', 'WAYBILL NUMBER', 'PACOTE'],
    motorista: ['MOTORISTA', 'NOVO MOTORISTA', 'DRIVER', 'DRIVER NAME'],
    driverCode: ['DRIVER CODE', 'DRIVERCODE', 'CODIGO', 'CODIGO MOTORISTA', 'CODIGO DO MOTORISTA'],
    novoNome: ['NOVO NOME', 'NOME NOVO', 'NOVO NOME MOTORISTA', 'NOME'],
    novoTelefone: ['NOVO TELEFONE', 'TELEFONE NOVO', 'TELEFONE', 'TEL', 'TEL.', 'CELULAR', 'NOVO CELULAR'],
    novoCpf: ['NOVO CPF', 'CPF NOVO', 'NOVO RG', 'NOVO DOCUMENTO', 'NOVO CPF/RG'],
    novaCnh: ['NOVA CNH', 'CNH NOVA', 'NOVO NUMERO CNH', 'NOVO NUMERO DA CNH'],
    ativar: ['ATIVAR APOS EDITAR', 'ATIVAR DEPOIS DE EDITAR', 'ATIVAR'],
    desativarDuplicado: ['DESATIVAR DUPLICADO', 'DESATIVAR CONFLITANTE', 'DESATIVAR CONTA DUPLICADA'],
    novoVeiculo: ['NOVO TIPO VEICULO', 'TIPO VEICULO', 'TIPO DE VEICULO', 'NOVO VEICULO', 'VEICULO', 'WORK VEHICLE TYPE', 'VEHICLE TYPE'],
  };
  const MODOS = {
    atribuir: { titulo: 'Atribuição', colunas: 'Aba ATRIBUIÇÕES', formato: '1 coluna = 1 motorista (nome no topo, pacotes abaixo)', dica: 'Escolha a planilha do dia (GETLOG - COLETA GERAL) com a aba ATRIBUIÇÕES.', botao: 'Iniciar atribuição', resumo: 'RESUMO ATRIBUIÇÃO IMILE.xlsx' },
    troca: { titulo: 'Por planilha', colunas: 'WAYBILL + MOTORISTA', formato: '1 linha = 1 pacote', dica: 'O pacote é desatribuído de quem estiver e atribuído ao MOTORISTA informado. As demais colunas são ignoradas.', botao: 'Iniciar troca de motorista', resumo: 'RESUMO TROCA DE MOTORISTA IMILE.xlsx' },
    editar: { titulo: 'Editar motorista', colunas: 'DRIVER CODE + NOVO NOME / NOVO TELEFONE / NOVO TIPO VEICULO / NOVO CPF / NOVA CNH / ATIVAR APOS EDITAR', formato: '1 linha = 1 motorista', dica: 'Célula vazia mantém o valor atual. Telefone com DDD + número, sem +55. Tipo de veículo = Work vehicle type (ex.: Fiorino, VAN, VUC, HR, 3/4, TOCO, Truck, CARRETA).', botao: 'Iniciar edição', resumo: 'RESUMO EDIÇÃO MOTORISTAS IMILE.xlsx' },
    desativar: { titulo: 'Desativar', colunas: 'DRIVER CODE', formato: '1 linha = 1 motorista', dica: 'Planilha com a coluna DRIVER CODE (ex.: D21050999001).', botao: 'Iniciar desativação', resumo: 'RESUMO DESATIVAÇÃO MOTORISTAS IMILE.xlsx' },
    ativar: { titulo: 'Ativar', colunas: 'DRIVER CODE + NOVO CPF (opcional) + DESATIVAR DUPLICADO (opcional)', formato: '1 linha = 1 motorista', dica: 'Se o IMILE recusar por CPF/documento duplicado com outra conta ativa, SIM na coluna DESATIVAR DUPLICADO desativa a outra conta e ativa esta.', botao: 'Iniciar ativação', resumo: 'RESUMO ATIVAÇÃO MOTORISTAS IMILE.xlsx' },
  };
  const MODELOS = {
    atribuir: { arquivo: 'MODELO - ATRIBUICAO.xlsx', aba: ABA_ATRIB, larg: [34, 34, 34], linhas: [['GET - NOME DO MOTORISTA 1', 'GET - NOME DO MOTORISTA 2', 'GET - NOME DO MOTORISTA 3'], ['3320000000001', '3320000000004', '6100000000001'], ['3320000000002', '3320000000005', ''], ['3320000000003', '', '']] },
    troca: { arquivo: 'MODELO - TROCA DE MOTORISTA.xlsx', aba: 'TROCA DE MOTORISTA', larg: [20, 38, 30, 40, 12], linhas: [['WAYBILL', 'MOTORISTA', 'SELLER', 'ENDEREÇO', 'CEP'], ['3320000000001', 'GET - NOME DO NOVO MOTORISTA', 'NOME DO SELLER', 'RUA EXEMPLO, 100', '01000-000'], ['3320000000002', 'GET - NOME DO NOVO MOTORISTA', 'NOME DO SELLER', 'RUA EXEMPLO, 100', '01000-000']] },
    editar: { arquivo: 'MODELO - EDITAR MOTORISTA.xlsx', aba: 'EDITAR MOTORISTA', larg: [18, 38, 18, 22, 18, 18, 22], linhas: [['DRIVER CODE', 'NOVO NOME', 'NOVO TELEFONE', 'NOVO TIPO VEICULO', 'NOVO CPF', 'NOVA CNH', 'ATIVAR APOS EDITAR'], ['D21050000001', 'GET - NOME COMPLETO DO MOTORISTA', '11999999999', 'Fiorino', '', '', ''], ['D21050000002', '', '11988888888', '', '', '', ''], ['D21050000003', 'GET - OUTRO NOME DE MOTORISTA', '', '', '', '', ''], ['D21050000004', '', '', 'VAN', '12345678900', '', 'SIM']] },
    desativar: { arquivo: 'MODELO - DESATIVAR MOTORISTAS.xlsx', aba: 'DESATIVAR', larg: [18], linhas: [['DRIVER CODE'], ['D21050000001'], ['D21050000002']] },
    ativar: { arquivo: 'MODELO - ATIVAR MOTORISTAS.xlsx', aba: 'ATIVAR', larg: [18, 18, 24], linhas: [['DRIVER CODE', 'NOVO CPF', 'DESATIVAR DUPLICADO'], ['D21050000001', '', ''], ['D21050000002', '12345678900', ''], ['D21050000003', '', 'SIM']] },
  };

  // ---------- utilidades ----------
  let CF = { url: '', token: '', usuario: '' };
  const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
  const codigo = (v) => {
    if (v === null || v === undefined) return '';
    let t = String(v).trim().replace(/\.0$/, '');
    if (/^\d+(\.\d+)?E\+\d+$/i.test(t)) t = BigInt(Math.round(Number(t))).toString();
    return t;
  };
  const idxCol = (cab, nomes) => { const a = nomes.map(norm); return cab.findIndex((c) => a.includes(norm(c))); };
  const SIM = ['SIM', 'S', 'YES', 'Y', '1', 'TRUE', 'X'];
  const fmtData = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fimDia = () => fmtData(new Date()) + ' 23:59:59';
  const iniDia = (dias) => { const d = new Date(); d.setDate(d.getDate() - dias); return fmtData(d) + ' 00:00:00'; };
  const listaCurta = (l) => l.slice(0, 15).join(', ') + (l.length > 15 ? ` ... (+${l.length - 15})` : '');
  const carregarXlsx = () => window.XLSX ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement('script'); s.src = '/assets/vendor/xlsx/xlsx.full.min.js'; s.onload = ok; s.onerror = () => no(new Error('Não consegui carregar o leitor de planilhas.')); document.head.appendChild(s); });

  // ---------- comunicação com o robô ----------
  const robo = async (corpo, limite = 60000) => {
    const c = new AbortController(), t = setTimeout(() => c.abort(), limite);
    try {
      const r = await fetch(CF.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ t: CF.token, usuario: CF.usuario, ...corpo }), signal: c.signal, cache: 'no-store' });
      try { return await r.json(); } catch (e) { return { ok: false, erro: r.status >= 500 ? `O robô do Cloudflare falhou (HTTP ${r.status}). Se repetir, o plano gratuito pode não aguentar a lista: ative o Workers Paid.` : 'Resposta inválida do robô.' }; }
    } catch (e) { return { ok: false, erro: e.name === 'AbortError' ? 'Demorou demais. Confira no IMILE antes de repetir.' : 'Sem conexão com o robô do IMILE.' }; }
    finally { clearTimeout(t); }
  };
  const bruto = async (u, corpo, rec, id) => {
    const j = await robo({ acao: 'chamar', u, corpo, rec, id });
    if (j && j.erro && !('status' in j)) return { ok: false, status: 0, json: null, erroRede: j.erro === 'token' ? 'Token do robô inválido.' : j.erro };
    return j;
  };
  const sucesso = (r) => r.ok && r.json && r.json.status === 'success';
  const motivo = (r, acao) => r.erroRede || r.json?.message || r.textoBruto || `Falha ao ${acao} (HTTP ${r.status}).`;
  const ocupada = (r) => {
    const m = String(r?.json?.message || r?.textoBruto || r?.erroRede || '').toLowerCase(), st = Number(r?.status || 0);
    return st === 0 || st === 408 || st === 425 || st === 429 || st >= 500 || /busy|too many|frequent|timeout|timed out|try again/.test(m);
  };
  const chamar = async (u, corpo, rec = 'LMOrderManage', id) => {
    let r = await bruto(u, corpo, rec, id);
    for (let t = 0; t < 10 && !sucesso(r) && ocupada(r) && !/Token do robô|Sessão do IMILE/.test(r.erroRede || ''); t++) { await pausa(Math.min(1000 * 2 ** t, 15000)); r = await bruto(u, corpo, rec, id); }
    return r;
  };
  const paralelo = async (corpos, u, rec, n) => {
    const res = new Array(corpos.length); let p = 0;
    await Promise.all(Array.from({ length: Math.min(n, corpos.length) }, async () => { while (p < corpos.length) { const i = p++; res[i] = await bruto(u, corpos[i], rec); } }));
    return res;
  };

  // ---------- planilhas ----------
  const lerAbas = async (arquivo) => {
    await carregarXlsx();
    const wb = XLSX.read(await arquivo.arrayBuffer(), { type: 'array' });
    return wb.SheetNames.map((n) => ({ nome: n, linhas: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '', raw: true }) }));
  };
  const baixarXlsx = async (aba, linhas, larg, nome) => {
    await carregarXlsx();
    const ws = XLSX.utils.aoa_to_sheet(linhas);
    if (larg) ws['!cols'] = larg.map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, aba.slice(0, 31));
    XLSX.writeFile(wb, nome);
  };
  const achaCabecalho = (aba, fn) => { for (let h = 0; h < Math.min(aba.linhas.length, 10); h++) { const r = fn(aba.linhas[h] || [], h); if (r) return r; } return null; };

  const lerAtribuicoes = async (arq) => {
    const aba = (await lerAbas(arq)).find((a) => (a.nome || '').trim().toUpperCase() === ABA_ATRIB);
    if (!aba) throw new Error(`A aba "${ABA_ATRIB}" não foi encontrada na planilha selecionada.`);
    const linhas = aba.linhas;
    if (!linhas.length) throw new Error(`A aba "${ABA_ATRIB}" está vazia.`);
    const cab = linhas[0] || [], lotes = [];
    for (let c = 0; c < cab.length; c++) {
      const nome = String(cab[c] || '').trim();
      if (!nome) continue;
      const pacotes = [];
      for (let l = 1; l < linhas.length; l++) { const v = codigo(linhas[l]?.[c]); if (v) pacotes.push(v); }
      if (pacotes.length) lotes.push({ motorista: nome, pacotes });
    }
    if (!lotes.length) throw new Error(`Nenhum pacote foi encontrado na aba "${ABA_ATRIB}".`);
    return lotes;
  };
  const lerTroca = async (arq) => {
    for (const aba of await lerAbas(arq)) {
      const r = achaCabecalho(aba, (cab, h) => {
        const iW = idxCol(cab, COL.waybill), iM = idxCol(cab, COL.motorista);
        if (iW < 0 || iM < 0) return null;
        const por = new Map();
        for (let l = h + 1; l < aba.linhas.length; l++) { const w = codigo(aba.linhas[l]?.[iW]), m = String(aba.linhas[l]?.[iM] ?? '').trim(); if (w && m) por.set(w, m); }
        if (!por.size) throw new Error(`A aba "${aba.nome}" tem as colunas WAYBILL e MOTORISTA, mas nenhuma linha preenchida.`);
        const lotes = new Map();
        for (const [w, m] of por) { const k = m.toUpperCase(); if (!lotes.has(k)) lotes.set(k, { motorista: m, pacotes: [] }); lotes.get(k).pacotes.push(w); }
        return [...lotes.values()];
      });
      if (r) return r;
    }
    throw new Error('Não encontrei as colunas WAYBILL e MOTORISTA em nenhuma aba da planilha.');
  };
  const lerCodigos = async (arq) => {
    for (const aba of await lerAbas(arq)) {
      const r = achaCabecalho(aba, (cab, h) => {
        const iC = idxCol(cab, COL.driverCode);
        if (iC < 0) return null;
        const iD = idxCol(cab, COL.desativarDuplicado), iP = idxCol(cab, COL.novoCpf), out = [], vistos = new Set();
        for (let l = h + 1; l < aba.linhas.length; l++) {
          const c = codigo(aba.linhas[l]?.[iC]).toUpperCase();
          if (!c || vistos.has(c)) continue;
          vistos.add(c);
          out.push({ codigo: c, cpf: iP >= 0 ? codigo(aba.linhas[l]?.[iP]).replace(/[^0-9A-Za-z]/g, '').toUpperCase() : '', desativarDuplicado: iD >= 0 && SIM.includes(norm(aba.linhas[l]?.[iD])) });
        }
        if (!out.length) throw new Error(`A aba "${aba.nome}" tem a coluna DRIVER CODE, mas nenhuma linha preenchida.`);
        return out;
      });
      if (r) return r;
    }
    throw new Error('Não encontrei a coluna DRIVER CODE em nenhuma aba da planilha.');
  };
  const telefoneNorm = (v) => { let d = codigo(v).replace(/\D/g, ''); if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2); return d; };
  const lerEdicao = async (arq) => {
    for (const aba of await lerAbas(arq)) {
      const r = achaCabecalho(aba, (cab, h) => {
        const iC = idxCol(cab, COL.driverCode), iN = idxCol(cab, COL.novoNome), iT = idxCol(cab, COL.novoTelefone), iV = idxCol(cab, COL.novoVeiculo), iP = idxCol(cab, COL.novoCpf), iH = idxCol(cab, COL.novaCnh), iA = idxCol(cab, COL.ativar);
        if (iC < 0 || (iN < 0 && iT < 0 && iV < 0 && iP < 0 && iH < 0 && iA < 0)) return null;
        const por = new Map(), doc = (i, l) => (i >= 0 ? codigo(aba.linhas[l]?.[i]).replace(/[^0-9A-Za-z]/g, '').toUpperCase() : '');
        for (let l = h + 1; l < aba.linhas.length; l++) {
          const c = codigo(aba.linhas[l]?.[iC]).toUpperCase();
          if (!c) continue;
          const nome = iN >= 0 ? String(aba.linhas[l]?.[iN] ?? '').replace(/\s+/g, ' ').trim() : '';
          const telefone = iT >= 0 ? telefoneNorm(aba.linhas[l]?.[iT]) : '';
          const veiculo = iV >= 0 ? String(aba.linhas[l]?.[iV] ?? '').replace(/\s+/g, ' ').trim() : '';
          const cpf = doc(iP, l), cnh = doc(iH, l), ativar = iA >= 0 && SIM.includes(norm(aba.linhas[l]?.[iA]));
          if (nome || telefone || veiculo || cpf || cnh || ativar) por.set(c, { codigo: c, nome, telefone, veiculo, cpf, cnh, ativar });
        }
        if (!por.size) throw new Error(`A aba "${aba.nome}" tem DRIVER CODE, mas nenhuma linha com dados para editar.`);
        return [...por.values()];
      });
      if (r) return r;
    }
    throw new Error('Não encontrei a coluna DRIVER CODE junto com NOVO NOME / NOVO TELEFONE / NOVO TIPO VEICULO / NOVO CPF / NOVA CNH em nenhuma aba da planilha.');
  };

  // ---------- motoristas (nomes) ----------
  const PART = new Set(['DA', 'DE', 'DO', 'DAS', 'DOS', 'E']);
  const prefixo = (n) => (norm(n).match(/^([A-Z]{2,4})\s*-\s*/) || [])[1] || '';
  const tokens = (n) => norm(n).replace(/^[A-Z]{2,4}\s*-\s*/, '').replace(/\(\s*AJ\s*\)/g, ' ').replace(/-\s*A\s*$/, ' ').replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter((t) => t && !PART.has(t));
  const tokOk = (a, b) => a === b || (a.length === 1 && b.startsWith(a)) || (b.length === 1 && a.startsWith(b));
  const nivel = (a0, b0) => {
    if (prefixo(a0) && prefixo(a0) !== prefixo(b0)) return 0; // prefixo (ex.: GET -) é opcional ao digitar
    const a = tokens(a0), b = tokens(b0);
    if (!a.length || !b.length || a[0] !== b[0]) return 0;
    const m = Math.min(a.length, b.length);
    for (let i = 0; i < m; i++) if (!tokOk(a[i], b[i])) return 0;
    return a.length === b.length ? 2 : m >= 2 ? 1 : 0;
  };
  const listarMotoristas = async (chave) => {
    const r = await chamar('motorista', { ocCodeList: [HUB], keyword: chave, isDriver: 1 });
    if (!sucesso(r)) return { erro: motivo(r, 'buscar motorista') };
    return { lista: Array.isArray(r.json.resultObject) ? r.json.resultObject : [] };
  };
  const buscarMotorista = async (nome) => {
    const alvo = norm(nome), cand = new Map();
    for (const chave of [nome.trim(), tokens(nome)[0]].filter(Boolean)) {
      const r = await listarMotoristas(chave);
      if (r.erro) return { encontrado: false, motivo: r.erro };
      for (const m of r.lista) if (m && m.userCode) cand.set(m.userCode, m);
      const ex = [...cand.values()].filter((m) => norm(m.userName) === alvo);
      if (ex.length) return { encontrado: true, userCode: ex[0].userCode, userName: ex[0].userName };
    }
    const lista = [...cand.values()];
    for (const n of [2, 1]) {
      const a = lista.filter((m) => nivel(nome, m.userName || '') === n);
      if (a.length === 1) return { encontrado: true, userCode: a[0].userCode, userName: a[0].userName, aprox: true };
      if (a.length > 1) return { encontrado: false, motivo: `O nome "${nome}" bate com mais de um motorista no IMILE: ${a.map((m) => `${m.userName} (${m.userCode})`).join('; ')}. Ajuste o nome para o nome exato do IMILE.` };
    }
    const par = lista.filter((m) => !prefixo(nome) || prefixo(m.userName || '') === prefixo(nome)).slice(0, 8).map((m) => m.userName);
    return { encontrado: false, motivo: `Motorista "${nome}" não existe no IMILE (${ESTACAO}).${par.length ? ' Parecidos: ' + par.join('; ') + '.' : ''} Ajuste o nome.` };
  };
  const buscarMotoristaAtrib = async (nome) => {
    const r = await chamar('motorista', { ocCodeList: [HUB], keyword: nome, isDriver: 1 });
    if (!sucesso(r)) return { encontrado: false, motivo: motivo(r, 'buscar motorista') };
    const lista = r.json.resultObject;
    if (!Array.isArray(lista) || !lista.length) return { encontrado: false, motivo: 'Nenhum motorista foi encontrado com esse nome no IMILE.' };
    const alvo = nome.trim().toUpperCase();
    let esc = lista.find((m) => (m.userName || '').trim().toUpperCase() === alvo);
    if (!esc && lista.length === 1) esc = lista[0];
    if (!esc) return { encontrado: false, motivo: `O nome achou ${lista.length} motoristas parecidos e nenhum bateu exatamente com "${nome}".` };
    return { encontrado: true, userCode: esc.userCode, userName: esc.userName };
  };

  // ---------- pacotes ----------
  const buscarEmTransito = async (waybills, prog) => {
    const mapa = new Map();
    for (let i = 0; i < waybills.length; i += 100) {
      const numeros = waybills.slice(i, i + 100);
      if (prog) prog(i, waybills.length);
      let pagina = 1, totalPaginas = 1;
      do {
        const r = await chamar('emTransito', { currentPage: pagina, showCount: 100, numberSearchType: 'waybillNo', numbers: numeros, startDate: iniDia(DIAS_TRANSITO), endDate: fimDia(), dateSearchType: 'createDate', queryType: 'waybillNo', consignorZipCodes: [] });
        if (!sucesso(r)) throw new Error('Não consegui consultar os pacotes em Pickup In-Transit: ' + motivo(r, 'consultar Pickup In-Transit'));
        const ro = r.json.resultObject || {};
        for (const x of ro.results || []) if (x && x.waybillNo) mapa.set(String(x.waybillNo), { id: x.id, driverName: x.driverName || '', driverCode: x.driverCode || '' });
        const pg = ro.pagination || {};
        totalPaginas = Math.max(1, Math.ceil((pg.totalResult || 0) / (pg.showCount || 100)));
        pagina++;
      } while (pagina <= totalPaginas);
    }
    return mapa;
  };
  const desatribuirRegistros = async (regs, prog) => {
    const falhas = new Map(), corpo = (l) => ({ operateType: 'bySelected', recordIds: l.map((x) => x.id), cancelReason: MOTIVO });
    for (let i = 0; i < regs.length; i += 200) {
      const lote = regs.slice(i, i + 200);
      prog(i);
      if (sucesso(await chamar('desatribuir', corpo(lote)))) continue;
      const rs = await paralelo(lote.map((x) => corpo([x])), 'desatribuir', 'LMOrderManage', 10);
      rs.forEach((r, k) => { if (!sucesso(r)) falhas.set(lote[k].waybill, motivo(r, 'desatribuir')); });
    }
    prog(regs.length);
    return falhas;
  };
  const corpoAtribuir = (pacotes, m) => ({
    operateType: 'byQuery',
    lmPickUpQueryDTO: { queryType: 'order', numberSearchType: 'waybillNo', numbers: pacotes, startDate: '2000-01-01 00:00:00', endDate: fimDia(), routeCode: '', dateSearchType: 'createDate', consignorZipCodes: [], type: 1 },
    pickupCode: m.userCode, pickupName: m.userName, stationCode: HUB, stationName: ESTACAO,
  });
  const atribuir = async (pacotes, m) => { const r = await chamar('atribuir', corpoAtribuir(pacotes, m)); return sucesso(r) ? { sucesso: true } : { sucesso: false, motivo: motivo(r, 'atribuir') }; };
  const confirmarPendencias = async (pacotes) => {
    const r = await bruto('pendentes', { currentPage: 1, showCount: 1, queryType: 'order', numberSearchType: 'waybillNo', numbers: pacotes, startDate: '2000-01-01 00:00:00', endDate: fimDia(), routeCode: '', dateSearchType: 'createDate', consignorZipCodes: [] }, 'LMOrderManage');
    if (!sucesso(r)) return { restantes: null };
    const t = r.json.resultObject?.pagination?.totalResult;
    return { restantes: typeof t === 'number' ? t : null };
  };

  // ---------- fluxos (devolvem a lista de resultados) ----------
  const processarAtribuicao = async (arq, ui) => {
    ui.prog(0, 1, 'Lendo a planilha...');
    const lotes = await lerAtribuicoes(arq), res = [];
    ui.prog(0, lotes.length, `${lotes.length} lote(s) de motorista encontrados na planilha`);
    for (let i = 0; i < lotes.length; i++) {
      const l = lotes[i], rot = `${l.pacotes.length} pacote(s)`;
      ui.prog(i, lotes.length, `Buscando motorista: ${l.motorista}`);
      const m = await buscarMotoristaAtrib(l.motorista);
      if (!m.encontrado) { ui.reg(res, rot, l.motorista, 'ERRO', m.motivo); ui.prog(i + 1, lotes.length, `${i + 1} de ${lotes.length} processados`); continue; }
      ui.prog(i, lotes.length, `Atribuindo ${l.pacotes.length} pacote(s): ${l.motorista}`);
      const a = await atribuir(l.pacotes, m);
      if (!a.sucesso) { ui.reg(res, rot, l.motorista, 'ERRO', a.motivo); ui.prog(i + 1, lotes.length, `${i + 1} de ${lotes.length} processados`); continue; }
      await pausa(400);
      const c = await confirmarPendencias(l.pacotes);
      let status = 'SUCESSO', det = `${l.pacotes.length} pacote(s) atribuído(s).`;
      if (c.restantes === null) det += ' (Não consegui reconfirmar automaticamente, mas o sistema aceitou a atribuição.)';
      else if (c.restantes > 0) { status = 'PARCIAL'; det = `${c.restantes} de ${l.pacotes.length} pacote(s) continuam pendentes após a atribuição — vale conferir manualmente.`; }
      ui.reg(res, rot, l.motorista, status, det);
      ui.prog(i + 1, lotes.length, `${i + 1} de ${lotes.length} processados`);
      await pausa(400);
    }
    return res;
  };

  const processarTroca = async (arq, ui) => {
    ui.prog(0, 1, 'Lendo a planilha...');
    const lotes = await lerTroca(arq), res = [];
    ui.prog(0, lotes.length, `${lotes.reduce((s, l) => s + l.pacotes.length, 0)} pacote(s) para ${lotes.length} motorista(s)`);
    for (let i = 0; i < lotes.length; i++) {
      const l = lotes[i], rot = `${l.pacotes.length} pacote(s)`;
      ui.prog(i, lotes.length, `Buscando motorista: ${l.motorista}`);
      const dest = await buscarMotorista(l.motorista);
      if (!dest.encontrado) { ui.reg(res, rot, l.motorista, 'ERRO', dest.motivo); continue; }
      const nomeDest = dest.userName.trim().toUpperCase(), certo = (r) => r.driverName.trim().toUpperCase() === nomeDest || (r.driverCode && r.driverCode === dest.userCode);
      const antes = await buscarEmTransito(l.pacotes, (f, t) => ui.prog(f, t, `Consultando Pickup In-Transit: ${f} de ${t} - ${dest.userName}`));
      const jaCorretos = [], aTrocar = [], fora = [];
      for (const w of l.pacotes) { const r = antes.get(w); if (!r) fora.push(w); else if (certo(r)) jaCorretos.push(w); else aTrocar.push({ waybill: w, id: r.id }); }
      const falhasDes = aTrocar.length ? await desatribuirRegistros(aTrocar, (f) => ui.prog(f, aTrocar.length, `Desatribuindo do motorista atual: ${f} de ${aTrocar.length} - ${dest.userName}`)) : new Map();
      const paraAtribuir = [...aTrocar.map((x) => x.waybill).filter((w) => !falhasDes.has(w)), ...fora];
      let erroAtrib = '';
      for (let k = 0; k < paraAtribuir.length; k += 300) {
        ui.prog(i, lotes.length, `Atribuindo ${paraAtribuir.length} pacote(s) para ${dest.userName}`);
        const a = await atribuir(paraAtribuir.slice(k, k + 300), dest);
        if (!a.sucesso) erroAtrib = a.motivo;
      }
      ui.prog(i, lotes.length, `Conferindo resultado: ${dest.userName}`);
      const depois = await buscarEmTransito(l.pacotes, (f, t) => ui.prog(f, t, `Conferindo resultado: ${f} de ${t} - ${dest.userName}`));
      const conf = [], outro = [], nao = [];
      for (const w of l.pacotes) { const r = depois.get(w); if (!r) nao.push(w); else if (certo(r)) conf.push(w); else outro.push(`${w} (${r.driverName})`); }
      const partes = [`${conf.length} de ${l.pacotes.length} pacote(s) confirmados com ${dest.userName}`];
      if (jaCorretos.length) partes.push(`${jaCorretos.length} já estavam com ele antes`);
      if (outro.length) partes.push(`Continuam com outro motorista (${outro.length}): ${listaCurta(outro)}${falhasDes.size ? ' - ' + [...falhasDes.values()][0] : ''}`);
      if (nao.length) partes.push(`Não estão em Pickup In-Transit (já coletados, com falha de coleta ou fora da station) (${nao.length}): ${listaCurta(nao)}`);
      if (erroAtrib) partes.push(`Erro na atribuição: ${erroAtrib}`);
      ui.reg(res, rot, dest.userName, conf.length === l.pacotes.length ? 'SUCESSO' : conf.length === 0 ? 'ERRO' : 'PARCIAL', partes.join('. ') + '.');
      ui.prog(i + 1, lotes.length, `${i + 1} de ${lotes.length} motorista(s) processados`);
    }
    return res;
  };

  // --- motoristas: cadastro ---
  const corpoListaDrivers = (cod, status) => ({ currentPage: 1, showCount: 20, showSubOrganizationEmployee: 1, isDtl: '', multiDriverCode: '', vehicleModels: [], driverCode: cod, driverName: '', functional: '', vendorCode: '', stationCode: HUB, status, deptCode: '', postCode: '', employeeTypeList: [], auditStatus: 'PASS', auditType: '' });
  const buscarDriver = async (cod, status, estacao) => {
    const corpo = corpoListaDrivers(cod, status);
    if (estacao !== undefined) corpo.stationCode = estacao;
    const r = await chamar('drivers', corpo, 'DriverManageCenter');
    if (!sucesso(r)) return { erro: motivo(r, 'buscar motorista') };
    return { driver: (r.json.resultObject?.results || []).find((d) => String(d.driverCode || '').toUpperCase() === cod) || null };
  };
  const buscarDriverQualquer = async (cod) => { for (const s of ['ACTIVE', 'DISABLED']) { const r = await buscarDriver(cod, s); if (r.erro || r.driver) return r; } return { driver: null }; };
  const v0 = (x) => (x === null || x === undefined ? '' : x);
  const montarCorpoEdicao = (d, registro) => {
    const v = v0, b = {};
    b.vehicleModel = v(d.vehicleModel); b.driverType = d.driverType; b.driverName = d.driverName; b.functionals = d.functionals; b.postId = v(d.postId);
    b.employmentType = d.employmentType; b.phoneAreaCode = v(d.phoneAreaCode); b._driverPhone = d.driverPhone; b.hubCode = d.hubCode; b.managementType = registro.managementType;
    for (const k of ['driverProvinceCode', 'driverCityCode', 'driverProvince', 'driverCity', 'driverLicenseCityCode', 'driverLicenseCity', 'driverLicenseProvinceCode', 'driverLicenseProvince', 'driverAddress', 'birthDate']) b[k] = v(d[k]);
    const bi = d.bankInfo || {};
    b.bankCode = v(bi.bankCode); b.branchNumber = v(bi.branchNumber);
    b.bankAccounts = bi.bankAccount || bi.bankAccountCheckDigit ? v(bi.bankAccount) + '-' + v(bi.bankAccountCheckDigit) : '-';
    b.accountName = v(bi.accountName); b.bankName = v(bi.bankName); b.bankBranch = v(bi.bankBranch); b.accountNames = v(bi.accountNames); b.accountNumber = v(bi.accountNumber); b.swiftCode = v(bi.swiftCode);
    const ti = d.taxInfo || {};
    b.taxType = ti.taxType ?? null; b.gstRegistered = ti.gstRegistered ?? null; b.abnName = v(ti.abnName); b.abnNumber = v(ti.abnNumber);
    b.vendorName = d.vendorName; b.vendorCode = d.vendorCode; b.vendorOrgId = v(d.vendorOrgId); b.dtlUserCode = v(d.dtlUserCode); b.deviceIds = d.deviceIds;
    b.otpVerificationMode = v(d.otpVerificationMode); b.faceInfoDTO = d.faceInfo ?? null;
    const dadosCert = {};
    for (const t of Object.keys(d.certificates || {})) {
      const c = d.certificates[t] || {}, img = (url, chave) => (url ? [{ url, httpUrl: url, urlPath: chave }] : []);
      b[t + '-type'] = c.type; b[t + '-number'] = c.number; b[t + '-effectiveTime'] = c.effectiveTime || null; b[t + '-expirationTime'] = c.expirationTime || null;
      b[t + '-imageUrl1'] = c.imageUrl1; b[t + '-imageFileKey1'] = c.imageFileKey1; b[t + '-imageUrl2'] = c.imageUrl2; b[t + '-imageFileKey2'] = c.imageFileKey2;
      dadosCert[t] = { label: c.typeDesc, type: c.type, number: c.number, effectiveTime: v(c.effectiveTime), expirationTime: v(c.expirationTime), images: { front: img(c.imageUrl1, c.imageFileKey1), back: img(c.imageUrl2, c.imageFileKey2) } };
    }
    b.facePathList = {}; b.certificateData = dadosCert; b.certUpdateDate = String(Date.now());
    b.hubName = d.hubName; b.postNameEn = d.postId ? v(d.postNameEn) : ''; b.postNameCn = d.postId ? v(d.postNameCn) : '';
    b.id = d.id; b.driverCode = d.driverCode;
    b.taxInfo = { taxPayingCountry: d.countryCode, taxType: v(ti.taxType), gstRegistered: v(ti.gstRegistered), abnName: v(ti.abnName), abnNumber: v(ti.abnNumber) };
    const certs = {};
    for (const t of Object.keys(dadosCert)) {
      const c = dadosCert[t];
      certs[t] = { ...c, imageUrl1: c.images.front[0]?.urlPath, imageFileKey1: c.images.front[0]?.urlPath };
      if (c.images.back.length) { certs[t].imageUrl2 = c.images.back[0].urlPath; certs[t].imageFileKey2 = c.images.back[0].urlPath; }
    }
    b.certificates = certs;
    b.bankInfo = { bankCode: v(bi.bankCode), branchNumber: v(bi.branchNumber), bankAccount: v(bi.bankAccount), bankAccountCheckDigit: v(bi.bankAccountCheckDigit), accountName: v(bi.accountName) };
    return b;
  };
  const editarPorAPI = async (item, registro) => {
    const det = await chamar('detalhe', null, 'DriverManageCenter', registro.id);
    if (!sucesso(det) || !det.json.resultObject) return { ok: false, erro: 'Não consegui ler o cadastro completo: ' + motivo(det, 'ler cadastro') };
    const d = det.json.resultObject;
    if (String(d.driverCode || '').toUpperCase() !== item.codigo) return { ok: false, erro: 'O cadastro retornado não corresponde ao Driver code.' };
    const corpo = montarCorpoEdicao(d, registro);
    if (item.nome) corpo.driverName = item.nome;
    if (item.telefone) corpo.driverPhone = item.telefone;
    if (item.veiculo) corpo.vehicleModel = item.veiculo;
    for (const [tipo, num] of [['ID_CARD', item.cpf], ['DRIVING_LICENSE', item.cnh]]) {
      if (!num) continue;
      if (!corpo.certificateData[tipo]) return { ok: false, erro: `O cadastro não tem o documento ${tipo === 'ID_CARD' ? 'RG/CPF' : 'CNH'} para alterar o número.` };
      corpo[tipo + '-number'] = num; corpo.certificateData[tipo].number = num; corpo.certificates[tipo].number = num;
    }
    if (!corpo.phoneAreaCode) corpo.phoneAreaCode = '+55';
    const r = await chamar('salvar', corpo, 'DriverManageCenter');
    return sucesso(r) ? { ok: true, antes: d } : { ok: false, erro: motivo(r, 'salvar') };
  };
  const lerDocumentos = async (id) => {
    const det = await chamar('detalhe', null, 'DriverManageCenter', id);
    if (!sucesso(det) || !det.json.resultObject) return null;
    const c = det.json.resultObject.certificates || {};
    return { cpf: String(c.ID_CARD?.number || '').toUpperCase(), cnh: String(c.DRIVING_LICENSE?.number || '').toUpperCase() };
  };
  const ativarMotorista = async (cod) => {
    const b = await buscarDriverQualquer(cod);
    if (!b.driver) return { ok: false, erro: 'não encontrado para ativar' };
    if (b.driver.status === 'ACTIVE') return { ok: true, nota: 'já estava ativo' };
    const r = await chamar('status', { id: b.driver.id, driverCode: b.driver.driverCode, status: 'ACTIVE' }, 'DriverManageCenter');
    if (!sucesso(r)) return { ok: false, erro: motivo(r, 'ativar') };
    return (await buscarDriver(cod, 'ACTIVE')).driver ? { ok: true, nota: 'ativado' } : { ok: false, erro: 'o IMILE aceitou, mas a listagem não mostrou ativo' };
  };
  const telefoneConfere = (mask, tel) => {
    const m = String(mask || '').replace(/\s/g, '');
    if (!m) return false;
    if (!m.includes('*')) return m.replace(/\D/g, '').endsWith(tel);
    const [ini, fim] = [m.split('*')[0], m.split('*').pop()];
    return tel.startsWith(ini.replace(/\D/g, '')) && tel.endsWith(fim.replace(/\D/g, ''));
  };

  const processarEdicao = async (arq, ui) => {
    ui.prog(0, 1, 'Lendo a planilha...');
    const itens = await lerEdicao(arq), res = [];
    ui.prog(0, itens.length, `${itens.length} motorista(s) na planilha`);
    let tipos = [];
    if (itens.some((x) => x.veiculo)) {
      const r = await chamar('veiculos', null, 'DriverManageCenter');
      if (!sucesso(r)) throw new Error('Não consegui carregar a lista de tipos de veículo do IMILE: ' + motivo(r, 'listar tipos de veículo'));
      tipos = (Array.isArray(r.json.resultObject) ? r.json.resultObject : []).map((v) => String(v.vehicleModel || '').trim()).filter(Boolean);
      if (!tipos.length) throw new Error('O IMILE não retornou nenhum tipo de veículo para BRA.');
    }
    for (let i = 0; i < itens.length; i++) {
      const it = itens[i];
      ui.prog(i, itens.length, `Editando ${it.codigo}`);
      if (it.veiculo) {
        const of = tipos.find((t) => t.toUpperCase() === it.veiculo.toUpperCase());
        if (!of) { ui.reg(res, it.codigo, it.nome, 'ERRO', `Tipo de veículo "${it.veiculo}" não existe no IMILE. Válidos: ${tipos.join(', ')}.`); continue; }
        it.veiculo = of;
      }
      if (it.telefone && !/^\d{10,11}$/.test(it.telefone)) { ui.reg(res, it.codigo, it.nome, 'ERRO', `Telefone inválido "${it.telefone}": use DDD + número (10 ou 11 dígitos).`); continue; }
      const antesBusca = await buscarDriverQualquer(it.codigo);
      if (antesBusca.erro) { ui.reg(res, it.codigo, it.nome, 'ERRO', antesBusca.erro); continue; }
      if (!antesBusca.driver) { ui.reg(res, it.codigo, it.nome, 'ERRO', 'Driver code não encontrado nesta station.'); continue; }
      const antes = { ...antesBusca.driver };
      const nomeIgual = !it.nome || (antes.driverName || '').trim().toUpperCase() === it.nome.toUpperCase();
      const foneIgual = !it.telefone || (telefoneConfere(antes.driverPhone, it.telefone) && !String(antes.driverPhone || '').includes('*'));
      const veiIgual = !it.veiculo || String(antes.vehicleModel || '').trim().toUpperCase() === it.veiculo.toUpperCase();
      const docsAntes = it.cpf || it.cnh ? await lerDocumentos(antes.id) : null;
      const docsIguais = (!it.cpf || docsAntes?.cpf === it.cpf) && (!it.cnh || docsAntes?.cnh === it.cnh);
      if (nomeIgual && foneIgual && veiIgual && docsIguais) {
        if (it.ativar) { const at = await ativarMotorista(it.codigo); ui.reg(res, it.codigo, antes.driverName || '', at.ok ? 'SUCESSO' : 'ERRO', `Dados já estavam corretos. Ativação: ${at.ok ? at.nota : at.erro}.`); }
        else ui.reg(res, it.codigo, antes.driverName || '', 'IGNORADO', 'Já estava com os dados informados.');
        continue;
      }
      const tela = await editarPorAPI(it, antesBusca.driver);
      if (!tela.ok) { ui.reg(res, it.codigo, antes.driverName || '', 'ERRO', tela.erro); continue; }
      const depois = await buscarDriverQualquer(it.codigo), d = depois.driver, falhas = [];
      if (!d) falhas.push('não consegui reler o cadastro após salvar');
      else {
        if (it.nome && (d.driverName || '').trim().toUpperCase() !== it.nome.toUpperCase()) falhas.push(`nome na listagem: "${d.driverName}"`);
        if (it.telefone && !telefoneConfere(d.driverPhone, it.telefone)) falhas.push(`telefone na listagem: "${d.driverPhone}"`);
        if (it.veiculo && String(d.vehicleModel || '').trim().toUpperCase() !== it.veiculo.toUpperCase()) falhas.push(`tipo de veículo na listagem: "${d.vehicleModel || 'vazio'}" (o IMILE não gravou o veículo para este motorista)`);
        if (it.cpf || it.cnh) {
          const docs = await lerDocumentos(d.id);
          if (!docs) falhas.push('não consegui reler os documentos');
          else { if (it.cpf && docs.cpf !== it.cpf) falhas.push(`CPF/RG no cadastro: "${docs.cpf}"`); if (it.cnh && docs.cnh !== it.cnh) falhas.push(`CNH no cadastro: "${docs.cnh}"`); }
        }
      }
      const alterado = [it.nome ? `nome "${antes.driverName}" -> "${it.nome}"` : '', it.telefone ? `telefone -> ${it.telefone}` : '', it.veiculo ? `tipo de veículo "${antes.vehicleModel || 'vazio'}" -> "${it.veiculo}"` : '', it.cpf ? `CPF/RG "${docsAntes?.cpf || ''}" -> "${it.cpf}"` : '', it.cnh ? `CNH "${docsAntes?.cnh || ''}" -> "${it.cnh}"` : ''].filter(Boolean).join('; ');
      let nota = '', falhouAt = false;
      if (it.ativar && !falhas.length) { const at = await ativarMotorista(it.codigo); nota = ` Ativação: ${at.ok ? at.nota : at.erro}.`; falhouAt = !at.ok; }
      if (falhas.length) ui.reg(res, it.codigo, it.nome || antes.driverName || '', 'PARCIAL', `Salvo, mas a conferência divergiu: ${falhas.join('; ')}.`);
      else ui.reg(res, it.codigo, it.nome || antes.driverName || '', falhouAt ? 'PARCIAL' : 'SUCESSO', `Alterado: ${alterado}.${nota}`);
      ui.prog(i + 1, itens.length, `${i + 1} de ${itens.length} processados`);
    }
    return res;
  };

  const processarStatus = (alvo) => async (arq, ui) => {
    const origem = alvo === 'DISABLED' ? 'ACTIVE' : 'DISABLED', acao = alvo === 'DISABLED' ? 'desativado' : 'ativado';
    ui.prog(0, 1, 'Lendo a planilha...');
    const cods = await lerCodigos(arq), res = [];
    ui.prog(0, cods.length, `${cods.length} motorista(s) na planilha`);
    for (let i = 0; i < cods.length; i++) {
      const { codigo: cod, desativarDuplicado, cpf } = cods[i];
      ui.prog(i, cods.length, `Processando ${cod}`);
      const busca = await buscarDriver(cod, origem);
      if (busca.erro) { ui.reg(res, cod, '', 'ERRO', busca.erro); continue; }
      if (!busca.driver) {
        const ja = await buscarDriver(cod, alvo);
        if (ja.driver) ui.reg(res, cod, ja.driver.driverName || '', 'IGNORADO', `Já estava ${acao}.`);
        else ui.reg(res, cod, '', 'ERRO', 'Driver code não encontrado nesta station.');
        continue;
      }
      const d = busca.driver;
      let notaCpf = '';
      if (cpf && alvo === 'ACTIVE') {
        const docs = await lerDocumentos(d.id);
        if (!docs || docs.cpf !== cpf) {
          const ed = await editarPorAPI({ codigo: cod, nome: '', telefone: '', veiculo: '', cpf, cnh: '' }, d);
          if (!ed.ok) { ui.reg(res, cod, d.driverName || '', 'ERRO', `Não consegui gravar o NOVO CPF por API: ${ed.erro}`); continue; }
          const conf = await lerDocumentos(d.id);
          if (!conf || conf.cpf !== cpf) { ui.reg(res, cod, d.driverName || '', 'ERRO', `O IMILE aceitou, mas o CPF no cadastro continua "${conf?.cpf || ''}".`); continue; }
          notaCpf = ` CPF atualizado por API de "${docs?.cpf || ''}" para "${cpf}".`;
        }
      }
      let r = await chamar('status', { id: d.id, driverCode: d.driverCode, status: alvo }, 'DriverManageCenter'), notaDup = '';
      if (!sucesso(r) && alvo === 'ACTIVE') {
        const mot = motivo(r, 'alterar status'), conflito = /duplicat/i.test(mot) ? (mot.match(/\b(D\d{8,})\b/i) || [])[1] : null;
        if (conflito && !desativarDuplicado) { ui.reg(res, cod, d.driverName || '', 'ERRO', `CPF/documento igual ao da conta ATIVA ${conflito.toUpperCase()}. O IMILE não permite duas contas ativas com o mesmo documento. Para ativar esta e desativar a ${conflito.toUpperCase()} automaticamente, preencha SIM na coluna DESATIVAR DUPLICADO.`); continue; }
        if (conflito && desativarDuplicado) {
          const c2 = conflito.toUpperCase();
          let outro = await buscarDriver(c2, 'ACTIVE');
          if (!outro.driver) outro = await buscarDriver(c2, 'ACTIVE', '');
          if (!outro.driver) { ui.reg(res, cod, d.driverName || '', 'ERRO', `CPF/documento igual ao da conta ATIVA ${c2}. Essa conta não aparece para este login em nenhuma station (Driver management e Staff management), então não pode ser desativada por aqui; enquanto ela estiver ativa, o IMILE não ativa ${cod}.`); continue; }
          const des = await chamar('status', { id: outro.driver.id, driverCode: outro.driver.driverCode, status: 'DISABLED' }, 'DriverManageCenter');
          if (!sucesso(des)) { ui.reg(res, cod, d.driverName || '', 'ERRO', `Não consegui desativar a conta duplicada ${c2}: ${motivo(des, 'desativar')}`); continue; }
          notaDup = ` Conta duplicada ${c2} (${outro.driver.driverName || ''}) foi desativada antes.`;
          r = await chamar('status', { id: d.id, driverCode: d.driverCode, status: alvo }, 'DriverManageCenter');
        }
      }
      if (!sucesso(r)) { ui.reg(res, cod, d.driverName || '', 'ERRO', motivo(r, 'alterar status') + notaCpf + notaDup); continue; }
      if ((await buscarDriver(cod, alvo)).driver) ui.reg(res, cod, d.driverName || '', 'SUCESSO', `Motorista ${acao}.${notaCpf}${notaDup}`);
      else ui.reg(res, cod, d.driverName || '', 'PARCIAL', `O sistema aceitou, mas não confirmou o status ${alvo} na listagem.`);
      ui.prog(i + 1, cods.length, `${i + 1} de ${cods.length} processados`);
    }
    return res;
  };
  const FLUXOS = { atribuir: processarAtribuicao, troca: processarTroca, editar: processarEdicao, desativar: processarStatus('DISABLED'), ativar: processarStatus('ACTIVE') };

  // ---------- telas ----------
  let A = null; // ambiente do portal: { M, top, esc, $, toast, CFG, ME }
  const esc = (s) => A.esc(s);
  const q = (s, r = document) => r.querySelector(s);
  const aviso = (ok) => (ok ? '' : '<p class="msg err">A conexão com o IMILE ainda não foi configurada (administrador: Usuários e acessos › Configurações do sistema).</p>');
  const abas = (itens, ativo) => `<div class="im-tabs" role="tablist">${itens.map(([k, t]) => `<button type="button" role="tab" class="btn btn-sm ${k === ativo ? 'btn-primary' : 'btn-ghost'}" data-aba="${k}" aria-selected="${k === ativo}">${esc(t)}</button>`).join('')}</div>`;
  const linhaLog = (r) => `<tr><td>${esc(r.item)}</td><td>${esc(r.motorista)}</td><td><span class="im-p im-${esc(r.status)}">${esc(r.status)}</span></td><td>${esc(r.detalhe)}</td></tr>`;
  const tabelaLog = '<table class="im-log"><thead><tr><th>Item</th><th>Motorista</th><th>Status</th><th>Detalhe</th></tr></thead><tbody></tbody></table>';
  const blocoProgresso = '<div class="im-prog" hidden><div class="im-info"><span class="im-t">Preparando...</span><b class="im-pc">0%</b></div><div class="im-bar"><i></i></div></div><div class="im-msg msg" aria-live="polite"></div>';

  // Controle de interface de uma execução (progresso, mensagens e tabela)
  const criarUI = (raiz) => {
    const prog = q('.im-prog', raiz), t = q('.im-t', raiz), pc = q('.im-pc', raiz), bar = q('.im-bar i', raiz), msg = q('.im-msg', raiz), tb = q('.im-log tbody', raiz);
    return {
      prog(a, total, texto) { prog.hidden = false; const p = total ? Math.min(100, Math.round((a / total) * 100)) : 0; t.textContent = texto || ''; pc.textContent = p + '%'; bar.style.width = p + '%'; },
      reg(res, item, motorista, status, detalhe) { const r = { item, motorista, status, detalhe }; res.push(r); tb.insertAdjacentHTML('beforeend', linhaLog(r)); },
      msg(texto, tipo) { msg.className = 'im-msg msg' + (tipo ? ' ' + tipo : ''); msg.textContent = texto || ''; },
      limpar() { tb.innerHTML = ''; msg.textContent = ''; prog.hidden = true; },
      linhas(rs) { tb.innerHTML = rs.map(linhaLog).join(''); },
    };
  };

  // Execução por planilha (atribuição, troca, editar, desativar, ativar)
  const montarArquivo = (raiz, modo) => {
    const M = MODOS[modo], m = MODELOS[modo], ok = !!(CF.url && CF.token);
    raiz.innerHTML = `<div class="box"><div class="box-head"><div><h3>${esc(M.titulo)}</h3><p>${esc(M.dica)}</p></div></div>${aviso(ok)}
<div class="im-regras"><div><span>Colunas lidas</span><b>${esc(M.colunas)}</b></div><div><span>Formato</span><b>${esc(M.formato)}</b></div></div>
<label class="drop"><input type="file" class="im-arq" accept=".xlsx,.xls,.csv"><span class="im-nome">Escolher planilha (.xlsx)</span></label>
<div class="im-botoes"><button type="button" class="btn btn-ghost im-modelo">Baixar modelo (Excel)</button><button type="button" class="btn btn-primary im-ini" disabled>${esc(M.botao)}</button><button type="button" class="btn btn-ghost im-res" disabled>Baixar resumo (Excel)</button></div>
${blocoProgresso}${tabelaLog}</div>`;
    const ui = criarUI(raiz), arq = q('.im-arq', raiz), ini = q('.im-ini', raiz), bres = q('.im-res', raiz);
    let file = null, resultados = [], rodando = false;
    arq.onchange = () => { file = arq.files[0] || null; q('.im-nome', raiz).textContent = file ? file.name : 'Escolher planilha (.xlsx)'; ini.disabled = !file || !ok || rodando; };
    q('.im-modelo', raiz).onclick = () => baixarXlsx(m.aba, m.linhas, m.larg, m.arquivo).then(() => ui.msg(`Modelo baixado: ${m.arquivo}. Substitua as linhas de exemplo pelos seus dados.`, 'ok'));
    bres.onclick = () => baixarXlsx('RESUMO', [['ITEM', 'MOTORISTA', 'STATUS', 'DETALHE'], ...resultados.map((r) => [r.item, r.motorista, r.status, r.detalhe || ''])], [22, 38, 14, 90], M.resumo);
    ini.onclick = async () => {
      if (!file || rodando) return;
      rodando = true; ini.disabled = true; bres.disabled = true; ui.limpar();
      try {
        resultados = await FLUXOS[modo](file, ui);
        const c = (s) => resultados.filter((r) => r.status === s).length, erros = c('ERRO');
        ui.prog(1, 1, 'Concluído');
        ui.msg(`Concluído: ${c('SUCESSO')} sucesso, ${c('PARCIAL')} parcial, ${c('IGNORADO')} ignorado, ${erros} erro.`, erros ? 'err' : 'ok');
        bres.disabled = !resultados.length;
      } catch (e) { ui.msg(e.message || String(e), 'err'); }
      rodando = false; ini.disabled = !file;
    };
  };

  // Lista suspensa com busca (aparece ao clicar; filtra ao digitar; setas + Enter; Esc fecha)
  const combo = (input, extra) => {
    const wrap = document.createElement('div');
    wrap.className = 'im-cb';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    const seta = document.createElement('button');
    seta.type = 'button'; seta.className = 'im-seta'; seta.tabIndex = -1; seta.setAttribute('aria-label', 'Abrir lista'); seta.textContent = '▾';
    const dd = document.createElement('div');
    dd.className = 'im-dd'; dd.hidden = true; dd.setAttribute('role', 'listbox'); dd.id = (input.id || 'cb') + '-dd';
    wrap.append(seta, dd);
    input.setAttribute('role', 'combobox'); input.setAttribute('aria-expanded', 'false'); input.setAttribute('aria-controls', dd.id); input.setAttribute('aria-autocomplete', 'list');
    let itens = [], vis = [], ativo = -1;
    const fecha = () => { dd.hidden = true; input.setAttribute('aria-expanded', 'false'); ativo = -1; };
    const marca = () => dd.querySelectorAll('[role=option]').forEach((o, i) => o.classList.toggle('on', i === ativo));
    const desenha = () => {
      const f = norm(input.value);
      vis = itens.filter((i) => !f || norm(i.v).includes(f));
      const mostra = vis.slice(0, 300);
      dd.innerHTML = mostra.length ? mostra.map((i, k) => `<div role="option" class="im-op" data-k="${k}"><span>${esc(i.v)}</span>${i.x ? `<small>${esc(i.x)}</small>` : ''}</div>`).join('') + (vis.length > 300 ? `<div class="im-mais">+${vis.length - 300} — continue digitando para filtrar</div>` : '') : `<div class="im-mais">${itens.length ? 'Nenhum resultado. Você pode digitar o nome completo.' : (extra && extra.vazio) || 'Carregando a lista...'}</div>`;
      dd.hidden = false; input.setAttribute('aria-expanded', 'true'); ativo = -1;
    };
    const escolhe = (k) => { const i = vis[k]; if (!i) return; input.value = i.v; fecha(); };
    input.addEventListener('focus', desenha);
    input.addEventListener('click', () => { if (dd.hidden) desenha(); });
    input.addEventListener('input', desenha);
    seta.addEventListener('mousedown', (e) => e.preventDefault());
    seta.addEventListener('click', () => { if (dd.hidden) { input.focus(); desenha(); } else fecha(); });
    dd.addEventListener('mousedown', (e) => { e.preventDefault(); const o = e.target.closest('.im-op'); if (o) escolhe(+o.dataset.k); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { fecha(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (dd.hidden) { desenha(); return; }
        const n = Math.min(vis.length, 300);
        if (!n) return;
        ativo = e.key === 'ArrowDown' ? (ativo + 1) % n : (ativo - 1 + n) % n;
        marca(); const o = dd.querySelectorAll('[role=option]')[ativo]; if (o) o.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && !dd.hidden && ativo >= 0) { e.preventDefault(); escolhe(ativo); }
    });
    input.addEventListener('blur', () => setTimeout(fecha, 120));
    return { set(l) { itens = l; if (!dd.hidden) desenha(); } };
  };
  // Troca de motorista: escolher seller + motorista e trocar. Listas, troca e conferência ficam no robô;
  // a página só pede a lista pronta, manda "trocar" e mostra o histórico do dia.
  const CK_CAT = 'getlog_im_cat';
  const hh = (ms) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const statusTxt = (e) => (e.estado === 'concluido' ? '100%' : e.estado === 'andamento' ? `${e.pct}% (trocando)` : e.estado === 'erro' ? `Erro: ${e.msg || 'falhou'}` : `${e.pct}%${e.msg ? ' — ' + e.msg : ''}`);
  const montarSeller = (raiz) => {
    const ok = !!(CF.url && CF.token);
    raiz.innerHTML = `<div class="box im-troca">${aviso(ok)}<form id="im-sf" class="im-linha"><div class="field"><label for="tr-s">Seller</label><input id="tr-s" required maxlength="120" autocomplete="off" placeholder="Escolher seller"></div><div class="field"><label for="tr-m">Novo motorista</label><input id="tr-m" required maxlength="120" autocomplete="off" placeholder="Escolher motorista"></div><button class="btn btn-primary im-bt" id="tr-b"${ok ? '' : ' disabled'}>Trocar motorista</button></form><p class="msg" id="tr-r" aria-live="polite"></p>
<div class="im-pg" id="tr-pg" hidden><div class="im-pg-top"><b>Preparando as listas</b><span class="im-pg-pc">0%</span></div><div class="im-pg-bar" role="progressbar" aria-label="Preparando as listas" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i class="im-pg-fill"></i></div><div class="im-pg-txt">Conectando ao robô...</div></div>
<p class="hint im-nota" id="tr-nm"></p></div>
<div class="box im-hist"><div class="box-head"><div><h3>Histórico de hoje</h3></div><button type="button" class="btn btn-ghost btn-sm" id="tr-x" disabled>Baixar (Excel)</button></div><div id="tr-h"><p class="hint">Carregando...</p></div></div>`;
    const R = q('#tr-r', raiz), B = q('#tr-b', raiz), vivo = () => document.body.contains(raiz);
    const msg = (t, tipo) => { R.className = 'msg' + (tipo ? ' ' + tipo : ''); R.textContent = t || ''; };
    const cbS = combo(q('#tr-s', raiz), { vazio: 'Preparando a lista de sellers...' }), cbM = combo(q('#tr-m', raiz), { vazio: 'Preparando a lista de motoristas...' });
    // listas prontas: abrem na hora da cópia guardada; o robô atualiza em segundo plano e, na 1ª vez, mostra o progresso real
    const t0 = performance.now(), PG = q('#tr-pg', raiz), nota = q('#tr-nm', raiz), seg = (ms) => (ms / 1000).toFixed(1).replace('.', ',') + ' s';
    const aplica = (c) => { cbS.set(c.sellers.map(([n, k]) => ({ v: n, x: k + ' pacote(s)' }))); cbM.set(c.motoristas.map((n) => ({ v: n }))); };
    let doCache = false;
    try { const g = JSON.parse(sessionStorage.getItem(CK_CAT)); if (g && g.sellers) { aplica(g); doCache = true; nota.textContent = `${g.sellers.length} seller(s) · ${g.motoristas.length} motorista(s) · abertos na hora (atualizando...)`; } } catch (e) { /* sem cópia guardada */ }
    let etaFim = 0, tick = null;
    const barra = (p) => { // p = progresso informado pelo robô: { pct, eta, texto }
      PG.hidden = false;
      const pct = p ? Math.max(2, Math.min(99, Math.round(p.pct))) : 3;
      q('.im-pg-pc', PG).textContent = pct + '%'; q('.im-pg-fill', PG).style.width = pct + '%'; q('.im-pg-bar', PG).setAttribute('aria-valuenow', pct);
      if (p && p.eta) etaFim = Date.now() + p.eta * 1000;
      const texto = p && p.texto ? p.texto : 'Conectando ao robô';
      const pinta = () => { const f = etaFim ? Math.max(1, Math.ceil((etaFim - Date.now()) / 1000)) : 0; q('.im-pg-txt', PG).textContent = texto + (f ? ` · falta${f > 1 ? 'm' : ''} ~${f} s` : '...'); };
      pinta(); clearInterval(tick); tick = setInterval(() => { if (!vivo()) clearInterval(tick); else pinta(); }, 500);
    };
    const fim = () => { clearInterval(tick); q('.im-pg-pc', PG).textContent = '100%'; q('.im-pg-fill', PG).style.width = '100%'; setTimeout(() => { PG.hidden = true; }, 500); };
    const carregar = async (tent) => {
      if (!ok || !vivo()) return;
      const c = await robo({ acao: 'lista', rotas: A.CFG.rotasUrl && A.CFG.rotasToken ? { url: A.CFG.rotasUrl, token: A.CFG.rotasToken } : undefined });
      if (c.ok && !c.vazio) {
        aplica(c); try { sessionStorage.setItem(CK_CAT, JSON.stringify(c)); } catch (e) { /* ok */ }
        if (!PG.hidden) fim();
        nota.textContent = `${c.sellers.length} seller(s) · ${c.motoristas.length} motorista(s) · ${doCache ? 'atualizados' : 'prontos'} em ${seg(performance.now() - t0)}`;
        return;
      }
      if (c.erro === 'ação') { msg('O robô do Cloudflare está na versão antiga: rode o texto TEXTO-ATUALIZAR-ROBO para atualizá-lo.', 'err'); return; }
      if (c.erro && tent >= 3) msg('O robô ainda não montou a lista: ' + c.erro, 'err');
      if (!doCache) barra(c.progresso || null);
      if (tent < 90) setTimeout(() => carregar(tent + 1), 1000);
    };
    carregar(0);
    // histórico do dia (só do dia; vive no robô e aparece para todos)
    let ultimo = [], timer = null;
    const desenha = (itens) => {
      ultimo = itens; q('#tr-x', raiz).disabled = !itens.length;
      q('#tr-h', raiz).innerHTML = itens.length ? `<div class="table-wrap"><table class="im-log"><thead><tr><th>Seller</th><th>Motorista atual</th><th>Horário</th><th>Status</th></tr></thead><tbody>${itens.map((e) => `<tr><td>${esc(e.seller)}</td><td>${esc(e.motorista)}</td><td>${hh(e.hora)}</td><td><span class="im-p im-${e.estado === 'concluido' ? 'SUCESSO' : e.estado === 'erro' ? 'ERRO' : 'PARCIAL'}">${esc(statusTxt(e))}</span>${e.estado === 'andamento' ? `<span class="im-mini" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${e.pct}"><i style="width:${e.pct}%"></i></span>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="hint">Nenhuma troca hoje.</p>';
    };
    const atualiza = async () => {
      if (!ok || !vivo()) return;
      const r = await robo({ acao: 'hist' });
      if (r.ok) desenha(r.itens); else if (r.erro === 'ação') { q('#tr-h', raiz).innerHTML = '<p class="hint">Robô desatualizado: o histórico aparece depois de atualizá-lo.</p>'; }
      clearTimeout(timer);
      timer = setTimeout(atualiza, r.ok && r.itens.some((e) => e.estado === 'andamento') ? 3000 : 30000);
    };
    if (ok) atualiza(); else q('#tr-h', raiz).innerHTML = '<p class="hint">Sem conexão com o robô.</p>';
    q('#tr-x', raiz).onclick = () => baixarXlsx('HISTÓRICO', [['SELLER', 'MOTORISTA ATUAL', 'HORÁRIO', 'STATUS'], ...ultimo.map((e) => [e.seller, e.motorista, hh(e.hora), statusTxt(e)])], [34, 38, 12, 44], 'HISTORICO TROCAS ' + new Date().toLocaleDateString('pt-BR').replace(/\//g, '-') + '.xlsx');
    // botão: 1º clique pede confirmação (sem ler nada), 2º clique envia ao robô
    let armado = null, tarm = null;
    const desarma = () => { clearTimeout(tarm); armado = null; B.textContent = 'Trocar motorista'; B.classList.remove('im-conf'); };
    q('#im-sf', raiz).onsubmit = async (e) => {
      e.preventDefault();
      const s = q('#tr-s', raiz).value.trim(), m = q('#tr-m', raiz).value.trim();
      if (!s || !m) return;
      if (!armado || armado.s !== s || armado.m !== m) {
        desarma(); armado = { s, m }; B.textContent = 'Confirmar troca'; B.classList.add('im-conf');
        msg(`${s} → ${m}. Clique em "Confirmar troca" para passar todos os pacotes atribuídos desse seller.`);
        tarm = setTimeout(() => { desarma(); msg(''); }, 8000);
        return;
      }
      desarma(); B.disabled = true; msg('Enviando ao robô...');
      const r = await robo({ acao: 'trocar', seller: s, motorista: m });
      B.disabled = !ok;
      if (!r.ok) { msg(r.erro || 'Não consegui iniciar a troca.', 'err'); return; }
      msg('Troca iniciada. Acompanhe no histórico; você já pode trocar outro seller.', 'ok');
      q('#tr-s', raiz).value = ''; q('#tr-m', raiz).value = '';
      atualiza();
    };
  };

  // Desatribuição de 21 dias (manual + automática às 23:00)
  const dh = (ms) => { const d = new Date(ms); const p = (n) => String(n).padStart(2, '0'); return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`; };
  const montarDesatribuir = (raiz) => {
    const ok = !!(CF.url && CF.token);
    raiz.innerHTML = `<div class="box"><div class="box-head"><div><h3>Desatribuir 21 dias</h3><p>Tira de todos os motoristas os pacotes em Pickup In-Transit (${esc(ESTACAO)}) criados de hoje − 20 dias até hoje. Quem faz é o robô.</p></div></div>${aviso(ok)}
<div class="im-auto"><label class="im-sw"><input type="checkbox" id="im-auto"${ok ? '' : ' disabled'}><span>Automático todo dia às 23:00</span></label><small class="im-prox"></small><div class="im-ult"></div></div>
<div class="im-botoes"><button type="button" class="btn btn-primary im-ini"${ok ? '' : ' disabled'}>Desatribuir agora</button><button type="button" class="btn btn-ghost im-res" disabled>Baixar resumo (Excel)</button></div>
<p class="msg im-msg" aria-live="polite"></p>${tabelaLog}</div>`;
    const chk = q('#im-auto', raiz), ult = q('.im-ult', raiz), prox = q('.im-prox', raiz), ini = q('.im-ini', raiz), bres = q('.im-res', raiz), tb = q('.im-log tbody', raiz), msg = q('.im-msg', raiz);
    let itens = [], timer = null;
    const vivo = () => document.body.contains(raiz);
    const proxima = () => { const a = new Date(), d = new Date(a); d.setHours(23, 0, 0, 0); if (d <= a) d.setDate(d.getDate() + 1); return (d.getDate() === a.getDate() ? 'hoje' : 'amanhã') + ' às 23:00'; };
    const mostra = (r) => {
      if (!r) { ult.textContent = 'Ainda não houve execução.'; ult.className = 'im-ult'; return; }
      const ok2 = !r.erro && !(r.itens || []).some((x) => x.status === 'ERRO');
      ult.className = 'im-ult ' + (ok2 ? 'ok' : 'falha');
      ult.textContent = `Última execução (${r.origem}) em ${dh(r.fim || r.inicio)}: ${r.erro ? 'ERRO — ' + r.erro : `${r.desatribuidos} de ${r.total} pacote(s) desatribuído(s).`}`;
      itens = (r.itens || []).slice(); if (r.erro) itens.push({ item: '-', motorista: '-', status: 'ERRO', detalhe: r.erro });
      tb.innerHTML = itens.slice(0, 500).map(linhaLog).join(''); bres.disabled = !itens.length;
    };
    const estado = async () => {
      if (!ok || !vivo()) return;
      const g = await robo({ acao: 'autoGet' });
      clearTimeout(timer);
      if (!g.ok) { ult.textContent = g.erro || 'Não consegui ler o estado do robô.'; return; }
      const an = g.andamento && typeof g.andamento === 'object' ? g.andamento : g.andamento ? {} : null;
      chk.checked = !!g.ligado; ini.disabled = !!an;
      prox.textContent = an ? '' : g.ligado ? 'Próxima execução: ' + proxima() + '.' : 'Automático desligado.';
      msg.className = 'msg im-msg'; msg.textContent = an ? `Robô desatribuindo${an.origem ? ' (' + an.origem + ')' : ''}${an.fase ? ': ' + an.fase : ''}${an.total ? ' — ' + an.i + ' de ' + an.total : ''}...` : '';
      mostra(g.ultima);
      if (an) timer = setTimeout(estado, 3000);
    };
    estado();
    chk.onchange = async () => { prox.textContent = 'Salvando...'; const g = await robo({ acao: 'autoSet', ligado: chk.checked }); if (!g.ok) chk.checked = !chk.checked; estado(); };
    bres.onclick = () => baixarXlsx('RESUMO', [['ITEM', 'MOTORISTA', 'STATUS', 'DETALHE'], ...itens.map((r) => [r.item, r.motorista, r.status, r.detalhe || ''])], [22, 38, 14, 90], MODOS.desatribuir_resumo);
    ini.onclick = async () => {
      if (!confirm('Desatribuir TODOS os pacotes em Pickup In-Transit dos últimos 21 dias?')) return;
      ini.disabled = true; msg.textContent = 'Enviando ao robô...';
      const r = await robo({ acao: 'desatribuirAgora' });
      if (!r.ok) { msg.className = 'msg im-msg err'; msg.textContent = r.erro || 'Falhou.'; ini.disabled = false; return; }
      estado();
    };
  };
  MODOS.desatribuir_resumo = 'RESUMO DESATRIBUIÇÃO 21 DIAS IMILE.xlsx';

  // Entrada: monta a tela pedida pelo portal
  const TELAS = {
    troca: { titulo: 'Troca de motorista', sub: 'Escolha o seller e o novo motorista', abas: null },
    atrib: { titulo: 'Atribuição', sub: 'Atribui ou troca pacotes a partir da planilha', abas: [['atribuir', 'Atribuição'], ['troca', 'Troca por planilha']] },
    moto: { titulo: 'Motoristas IMILE', sub: 'Edição, ativação e desativação de motoristas em lote', abas: [['editar', 'Editar motorista'], ['desativar', 'Desativar'], ['ativar', 'Ativar']] },
    desat: { titulo: 'Desatribuição', sub: 'Limpa os pacotes atribuídos dos últimos 21 dias, agora ou todo dia às 23:00', abas: null },
  };
  window.GL_IMILE = {
    // Abre a tela de Troca na hora: guarda a lista pronta do robô enquanto o usuário faz outra coisa
    async preaquecer(amb) {
      CF = { url: amb.CFG.imileUrl || '', token: amb.CFG.imileToken || '', usuario: amb.ME.name };
      if (!CF.url || !CF.token) return;
      const c = await robo({ acao: 'lista', rotas: amb.CFG.rotasUrl && amb.CFG.rotasToken ? { url: amb.CFG.rotasUrl, token: amb.CFG.rotasToken } : undefined });
      if (c.ok && !c.vazio) { try { sessionStorage.setItem(CK_CAT, JSON.stringify(c)); } catch (e) { /* ok */ } }
    },
    montar(view, amb) {
      A = amb;
      CF = { url: amb.CFG.imileUrl || '', token: amb.CFG.imileToken || '', usuario: amb.ME.name };
      const T = TELAS[view];
      amb.M().innerHTML = amb.top(T.titulo, T.sub) + `<div id="im-raiz">${T.abas ? abas(T.abas, T.abas[0][0]) + '<div id="im-corpo"></div>' : ''}</div>`;
      const raiz = q('#im-raiz');
      const desenhar = (k) => {
        const corpo = T.abas ? q('#im-corpo', raiz) : raiz;
        if (view === 'troca') return montarSeller(corpo);
        if (view === 'atrib') return montarArquivo(corpo, k);
        if (view === 'moto') return montarArquivo(corpo, k);
        return montarDesatribuir(corpo);
      };
      if (T.abas) raiz.querySelectorAll('[data-aba]').forEach((b) => { b.onclick = () => { raiz.querySelectorAll('[data-aba]').forEach((x) => { const a = x === b; x.className = 'btn btn-sm ' + (a ? 'btn-primary' : 'btn-ghost'); x.setAttribute('aria-selected', a); }); desenhar(b.dataset.aba); }; });
      desenhar(T.abas ? T.abas[0][0] : null);
    },
  };
})();
