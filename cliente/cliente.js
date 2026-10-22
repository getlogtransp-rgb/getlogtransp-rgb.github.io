(()=>{
const S_KEY='getlog_sessao',enc=new TextEncoder();
const b2u=b=>{const s=atob(b);const u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u};
const u2b=u=>{u=new Uint8Array(u);let s='';for(let i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);return btoa(s)};
const $=s=>document.querySelector(s);const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N=n=>Number(n||0).toLocaleString('pt-BR');const norm=s=>String(s||'').trim().toLowerCase();
async function kek(pw,salt,iter){const b=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:iter,hash:'SHA-256'},b,{name:'AES-GCM',length:256},false,['decrypt'])}
async function prof(raw,u){const k=await crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['decrypt']);return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:b2u(u.p.iv)},k,b2u(u.p.ct))))}
async function senhaPlan(D,login){if(!D.senhaUrl)return null;try{const c=new AbortController(),t=setTimeout(()=>c.abort(),15000);const r=await fetch(D.senhaUrl+'?senha='+encodeURIComponent(login),{signal:c.signal,cache:'no-store'});clearTimeout(t);const j=await r.json();return j.ok&&j.dados&&j.dados.key?j.dados:null}catch(e){return null}}
async function db(){const r=await fetch('/data/users.json?t='+Date.now(),{cache:'no-store'});return r.json()}
const API='https://script.google.com/macros/s/AKfycbzBrdB2u8IlJJ0o9OclHWPcpA3JUi8n5D_ebIkZ6Kzagwt01zmvsaHU50PrA2C9MzCwdA/exec',PW_PADRAO='123456';
const rnd=n=>crypto.getRandomValues(new Uint8Array(n));
const hashHex=async s=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s)))].map(b=>b.toString(16).padStart(2,'0')).join('');
async function credencial(login,pw){const b=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveBits']);return u2b(await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode('getlog-auth|'+login),iterations:100000,hash:'SHA-256'},b,256))}
async function kekE(pw,salt,iter){const b=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:iter,hash:'SHA-256'},b,{name:'AES-GCM',length:256},false,['encrypt'])}
async function abre(raw,o){const k=await crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['decrypt']);return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:b2u(o.iv)},k,b2u(o.ct))))}
// Senha padrão: obriga a criar uma senha pessoal (grava pelo servidor do ponto, igual ao portal).
function trocaSenha(login,pwVelha,raw,iter,cfg){return new Promise((ok,falha)=>{const c=$('.lg-card');c.innerHTML=`<img src="/assets/logo-getlog.webp" alt="GETLOG Transportes" width="120" height="48" class="lg-logo"><h1>Crie sua senha</h1><p>Primeiro acesso (ou senha redefinida). Crie uma senha pessoal para continuar.</p>
<form id="tf" novalidate><label for="n1">Nova senha</label><input id="n1" type="password" autocomplete="new-password" minlength="6" required><label for="n2">Repita a nova senha</label><input id="n2" type="password" autocomplete="new-password" required><div id="m" class="m" role="status" aria-live="polite"></div><button id="go">Salvar senha</button></form>`;$('#n1').focus();
$('#tf').onsubmit=async e=>{e.preventDefault();const a=$('#n1').value,b=$('#n2').value,m=$('#m'),go=$('#go');
if(a!==b){m.textContent='As duas senhas não são iguais.';return}if(a.length<6||a===PW_PADRAO){m.textContent='Use pelo menos 6 caracteres e diferente de '+PW_PADRAO+'.';return}
if(!cfg.pontoUrl){m.textContent='Não foi possível trocar a senha agora. Fale com a GETLOG.';return}
go.disabled=true;go.textContent='Salvando...';m.textContent='';
try{const salt=rnd(16),iv=rnd(12),k=await kekE(a,salt,iter);const av=await credencial(login,a);
const dados={salt:u2b(salt),iv:u2b(iv),key:u2b(await crypto.subtle.encrypt({name:'AES-GCM',iv},k,raw)),em:new Date().toISOString(),ah:await hashHex(av)};
const r=await fetch(cfg.pontoUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({token:cfg.pontoToken,acao:'senha',login,av:await credencial(login,pwVelha),...dados})});const j=await r.json();if(!j.ok)throw new Error(j.erro);ok()}
catch(x){go.disabled=false;go.textContent='Salvar senha';m.textContent='Não foi possível salvar (erro: '+(x.message||'rede')+'). Tente de novo.'}}})}
// Proteção contra tentativa de senha: após 5 erros, bloqueia o login neste aparelho por alguns minutos.
const TRV='getlog_cli_trv',trv=()=>{try{return JSON.parse(localStorage.getItem(TRV))||{n:0,ate:0}}catch(e){return {n:0,ate:0}}},trvSet=o=>{try{localStorage.setItem(TRV,JSON.stringify(o))}catch(e){}};
$('#f').addEventListener('submit',async e=>{e.preventDefault();const m=$('#m'),go=$('#go');const tv=trv();if(tv.ate>Date.now()){m.textContent='Muitas tentativas. Tente de novo em '+Math.ceil((tv.ate-Date.now())/60000)+' min.';return}m.textContent='';go.disabled=true;go.textContent='Verificando...';
let D,u,raw,p;try{D=await db();u=D.users.find(x=>x.login===norm($('#u').value));if(!u||u.role!=='fornecedor'||u.active===false)throw 0;
const pw=$('#p').value;const abreW=async w=>{try{const k=await kek(pw,b2u(w.salt),D.iter);return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:b2u(w.iv)},k,b2u(w.key)))}catch(e){return null}};
// Senha pessoal (criada pelo próprio usuário) fica no servidor do ponto; a do site só vale se for mais nova. Igual ao portal.
const sp=await senhaPlan(D,u.login);raw=sp&&(!u.pwEm||sp.em>u.pwEm)?await abreW(sp):null;if(!raw)raw=await abreW(u);if(!raw&&sp)raw=await abreW(sp);if(!raw)throw 0;p=await prof(raw,u)}
catch(x){const t=trv();t.n++;if(t.n>=5){t.ate=Date.now()+5*60000*Math.min(6,t.n-4);}trvSet(t);m.textContent=t.n>=5?'Muitas tentativas. Login bloqueado por alguns minutos.':'Usuário ou senha incorretos.';go.disabled=false;go.textContent='Entrar';return}
trvSet({n:0,ate:0});
let cfg={};try{const r=await fetch('/data/config.json?t='+Date.now(),{cache:'no-store'});cfg=await abre(raw,await r.json())}catch(x){}
if($('#p').value===PW_PADRAO)await trocaSenha(u.login,PW_PADRAO,raw,D.iter,cfg);
sessionStorage.setItem(S_KEY,JSON.stringify({login:u.login,role:'fornecedor',name:p.name,cliente:p.cliente,t:cfg.driveToken||''}));app()});
$('#eye').onclick=()=>{const i=$('#p'),v=i.type==='password';i.type=v?'text':'password';$('#eye').setAttribute('aria-label',v?'Ocultar senha':'Mostrar senha');$('#eye').classList.toggle('on',v);i.focus()};
let s=null;try{s=JSON.parse(sessionStorage.getItem(S_KEY))}catch(e){}// Já logado: abre o painel na hora (sem piscar a tela de login) e confere o acesso em segundo plano.
if(s&&s.role==='fornecedor'){$('#login').hidden=true;Promise.resolve().then(app);ativo(s).then(v=>{if(!v)sai()})}else $('#u').focus();
// Confere a cada abertura se o acesso continua ativo.
async function ativo(s){try{const u=(await db()).users.find(x=>x.login===s.login);return !!u&&u.role==='fornecedor'&&u.active!==false}catch(e){return true}}
function sai(){sessionStorage.removeItem(S_KEY);try{localStorage.removeItem('getlog_cli_lista');indexedDB.deleteDatabase('getlog_cli5');indexedDB.deleteDatabase('getlog_cli4');indexedDB.deleteDatabase('getlog_cli3');indexedDB.deleteDatabase('getlog_cli2');indexedDB.deleteDatabase('getlog_cli')}catch(e){}location.reload()}
const get=async(q,t)=>{const c=new AbortController(),tm=setTimeout(()=>c.abort(),60000);try{const r=await fetch(API+'?'+q+(t?'&t='+encodeURIComponent(t):''),{credentials:'omit',cache:'no-store',signal:c.signal});if(!r.ok)throw new Error('http '+r.status);const j=await r.json();if(!j.ok)throw new Error(j.erro||'erro');return j.dados}finally{clearTimeout(tm)}};
const dk=d=>d.split('.').reverse().join('-');
const WA='https://wa.me/5511989141009?text='+encodeURIComponent('Olá, GETLOG! Sou cliente e preciso de ajuda com as coletas.');
const P1=n=>(Math.round(n*10)/10).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
const pcCor=p=>p>=98?'var(--ok)':p>=85?'var(--warn)':'var(--bad)';
const fmtD=k=>k.split('-').reverse().join('/');
// Hora "14:32", "22/10/2026 14:32" ou fração do Excel → hora inteira (0–23) ou -1.
const hr=h=>{if(h==null||h==='')return -1;if(typeof h==='number'||/^\d*\.\d+$/.test(h)){const f=+h%1;return f?Math.floor(f*24):-1}const m=String(h).match(/(\d{1,2}):\d{2}/);return m&&+m[1]<24?+m[1]:-1};
// Cache do dia no aparelho (versão = modificadoEm do Drive): reabrir é instantâneo e só baixa o que mudou.
// Cache dos dias no aparelho (IndexedDB, cabe muito mais que o localStorage). Sair apaga.
const IDB=new Promise(ok=>{try{const q=indexedDB.open('getlog_cli5',1);q.onupgradeneeded=()=>q.result.createObjectStore('d');q.onsuccess=()=>ok(q.result);q.onerror=()=>ok(null)}catch(e){ok(null)}});
const lerC=async(d,v)=>{const db=await IDB;if(!db)return null;return new Promise(ok=>{try{const q=db.transaction('d').objectStore('d').get(d);q.onsuccess=()=>{const o=q.result;ok(o&&o.v===v?o.r:null)};q.onerror=()=>ok(null)}catch(e){ok(null)}})};
const gravaC=async(d,v,r)=>{const db=await IDB;if(!db)return;try{db.transaction('d','readwrite').objectStore('d').put({v,r},d)}catch(e){}};
async function app(){const S=JSON.parse(sessionStorage.getItem(S_KEY));const C=window.GL_CORE;
$('#login').hidden=true;const A=$('#app');A.hidden=false;
A.innerHTML=`<header class="hd"><div class="w"><div class="hd-row"><span class="chip-logo"><img src="/assets/logo-getlog.webp" alt="GETLOG" width="84" height="34"></span>${/imile/.test(norm(S.name+' '+S.login))?'<span class="chip-logo cli"><img src="/assets/clientes/imile.svg?v=2" alt="iMile Delivery" width="80" height="34" style="width:auto;height:34px"></span>':''}<div class="hd-t"><h1>Coletas ${esc(S.name)}</h1><span class="upd"><i></i><span id="upd">Conectando ao Drive...</span></span><span class="upd prx" id="prx"></span></div><div class="hd-act">${window.GL_LANG?GL_LANG.btn():''}<a class="out wa-top" href="${WA}" target="_blank" rel="noopener">Fale conosco</a>${window.GL_TEMA?GL_TEMA.btn('out ic'):''}<button class="out atu" id="atu" type="button" title="Buscar os dados mais recentes do Drive"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5"/></svg><span>Atualizar</span></button><button class="out ic" id="ajuda" type="button" aria-label="Como usar" title="Como usar">?</button><button class="out" id="sair">Sair</button></div></div>
</div></header>
<main class="w body"><section class="flt"><div class="pr"><div class="dp" id="dp"><button type="button" class="dpb" id="dpb" aria-haspopup="dialog"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg><span><small id="dpn">Período</small><b id="dpl">—</b></span><i>▾</i></button></div>
<button type="button" class="t45b" id="t45b" aria-pressed="false"><span class="tg">T4</span><span class="tg">T5</span> Só T4 e T5</button><div class="qw"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="q" type="search" placeholder="Buscar seller, motorista, bairro…" aria-label="Buscar"></div><button type="button" class="lmp" id="lmp" disabled><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M3 5h18l-7 8v6l-4 2v-8z"/><path d="m16 3 5 5M21 3l-5 5"/></svg><span>Limpar filtros</span></button></div><input type="hidden" id="d1"><input type="hidden" id="d2">
<div class="fms" id="fms"></div><div class="fa" id="fa" hidden></div>
<div class="prog" id="prog" hidden><i></i></div></section><div class="ld" id="ld" hidden role="status" aria-live="polite"><span class="sp"></span><span id="ldt">Carregando dados…</span></div>
<div class="kw"><div class="dn" id="dn"></div><div class="kp" id="kp"></div></div><section class="card t45" id="t45" hidden></section>
<section class="card"><h2>Performance por semana</h2><p class="sub" id="chWs">% de visita por semana (últimas 8, segunda a domingo) · coleta em cinza como referência</p><div class="ch" id="chW"></div></section>
<div class="g2"><section class="card"><h2>Performance por dia</h2><p class="sub">% de visita por dia da operação inteira (não segue os filtros) · coleta em cinza como referência</p><div class="ch" id="chD"></div></section>
<section class="card"><h2>Coletas por hora</h2><p class="sub">Barras: pacotes coletados na hora (número embaixo) · linha: % acumulado do previsto</p><div class="ch" id="chH"></div></section></div>
<div class="g2"><section class="card"><h2>Performance por região</h2><p class="sub">% de visita (sellers) · coleta em segundo plano · clique para filtrar</p><div class="ch" id="chR"></div></section>
<section class="card"><h2>Mapa da operação</h2><p class="sub" id="mapS">Bairros atendidos; cor = performance de coleta</p><div id="map"></div></section></div>
<section class="card" id="tbl"><div class="tb-h"><div><h2>Sellers</h2><p class="sub" id="sub"></p></div><button class="btn2 xl" id="csv" type="button">Baixar Excel (.xlsx)</button></div><div class="tw"><table><thead><tr><th data-o="dk">Data</th><th data-o="s">Seller</th><th class="hide-m" data-o="m">Motorista</th><th class="hide-m" data-o="r">Região</th><th class="hide-m" data-o="b">Bairro</th><th class="hide-m" data-o="pr">Prior.</th><th class="n" data-o="p">Previsto</th><th class="n" data-o="c">Coletado</th><th class="n hide-m" data-o="h">Hora</th><th>Status</th></tr></thead><tbody id="tb"></tbody></table></div><div class="more" id="more"></div></section>
</main><footer class="fz"><div class="w"><div class="fz-top"><div class="fz-b"><img src="/assets/logo-getlog.webp" alt="GETLOG Transportes" width="96" height="38"><p>Transporte e logística de primeira milha. Acompanhamento de coletas em tempo real para nossos clientes.</p></div><div class="fz-s"><div class="sl2"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg><span><b>Conexão segura</b><small>HTTPS · TLS</small></span></div><div class="sl2"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg><span><b>Dados criptografados</b><small>AES-256 no aparelho</small></span></div><div class="sl2"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg><span><b>Acesso restrito</b><small>Login individual e sessão com tempo</small></span></div><div class="sl2"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 12h6M9 16h6M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/></svg><span><b>LGPD</b><small>Só os dados da sua operação</small></span></div></div></div><div class="fz-bot"><span>© ${new Date().getFullYear()} GETLOG Transportes · Todos os direitos reservados</span><span><a href="https://getlogbr.com.br/" target="_blank" rel="noopener">getlogbr.com.br</a> · <a href="${WA}" target="_blank" rel="noopener">Suporte ao cliente</a></span></div></div></footer>
<a class="wa" href="${WA}" target="_blank" rel="noopener" aria-label="Fale conosco no WhatsApp"><svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true"><path fill="#fff" d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3zm0 23.6c-2 0-4-.5-5.7-1.6l-.4-.2-3.9 1 1-3.8-.3-.4A10.6 10.6 0 1 1 16 26.6zm5.8-7.9c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2l-1 1.2c-.2.2-.4.2-.7.1a8.7 8.7 0 0 1-4.3-3.8c-.3-.6.3-.5 1-1.7.1-.2 0-.4 0-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4s-1.2 1.1-1.2 2.8 1.2 3.2 1.4 3.5c.2.2 2.4 3.6 5.8 5.1 2.2.9 3 1 4.1.8.7-.1 1.9-.8 2.2-1.5s.3-1.4.2-1.5c-.1-.1-.3-.2-.6-.3z"/></svg><span>Fale conosco</span></a>`;
$('#sair').onclick=sai;
// Sessão encerra sozinha após 30 min sem uso (protege tela esquecida aberta).
let ina=0;const mexeu=()=>{clearTimeout(ina);ina=setTimeout(sai,30*60000)};['pointerdown','keydown','scroll','touchstart'].forEach(ev=>addEventListener(ev,mexeu,{passive:true}));mexeu();
const kp=$('#kp');kp.innerHTML='<div class="k sk"></div>'.repeat(4);$('#fms').innerHTML=['Cliente','Região','Motorista','Prioridade','Status do seller','Visita'].map(l=>`<div class="ms"><button type="button" class="msb" disabled><span>${l}</span><em>Carregando…</em><i>▾</i></button></div>`).join('');
const prepL=d=>d.filter(x=>/^\d{2}\.\d{2}\.\d{4}$/.test(x.dia)).map(x=>({...x,k:dk(x.dia)})).sort((a,b)=>a.k<b.k?1:-1).slice(0,70);
const novaL=get('fonte=lista',S.t).then(d=>{try{localStorage.setItem('getlog_cli_lista',JSON.stringify(d))}catch(e){}return prepL(d)});
// Abre na hora com a última lista guardada; a nova chega em segundo plano e só recarrega o que mudou.
// Aviso de carregamento: some quando os dados chegam; se demorar, avisa que a conexão de quem acessa está lenta.
let LDT=[];const carregando=on=>{const el=$('#ld');LDT.forEach(clearTimeout);LDT=[];if(!on){el.hidden=true;return}el.hidden=false;el.className='ld';$('#ldt').textContent='Carregando dados…';
LDT.push(setTimeout(()=>{el.className='ld slow';$('#ldt').textContent='Sua internet parece lenta. Ainda carregando os dados…'},6000));
LDT.push(setTimeout(()=>{$('#ldt').innerHTML='A conexão está muito lenta. Aguarde ou <button type="button" class="btn2" onclick="location.reload()">tente de novo</button>'},25000))};
const falhou=()=>{const el=$('#ld');LDT.forEach(clearTimeout);el.hidden=false;el.className='ld err';$('#ldt').innerHTML=(navigator.onLine===false?'Você está sem internet.':'Não foi possível carregar: internet lenta ou instável.')+' <button type="button" class="btn2" onclick="location.reload()">Tentar de novo</button>'};
let LS=null;try{const c=JSON.parse(localStorage.getItem('getlog_cli_lista'));if(Array.isArray(c)&&c.length)LS=prepL(c)}catch(e){}
if(!LS)try{carregando(true);LS=await novaL;carregando(false)}catch(e){falhou();$('#upd').textContent='Sem conexão com o Drive';kp.innerHTML='<div class="k err">Não foi possível carregar os dados agora. <button class="btn2" onclick="location.reload()">Tentar de novo</button></div>';return}
// Última/próxima atualização: mesma agenda do portal (GL_CORE.agenda). A próxima só avança quando o Drive confirma o arquivo novo.
let ULT=0;const mostraUlt=()=>{ULT=LS.reduce((m,x)=>{const t=new Date(x.modificadoEm).getTime();return t>m?t:m},0);if(!ULT)return;const e=new Date(ULT),a=C.agenda(e),st=C.ESTADO_TXT[a.estado];
$('#upd').textContent='Atualizado '+e.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})+' '+e.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
$('#prx').textContent='Próxima: '+a.proxima.label+(st?' · '+st:'');$('#prx').className='upd prx '+a.estado};mostraUlt();
// No horário previsto, confere a lista do Drive a cada 2 min até a atualização entrar; aí recarrega sozinho.
let VER=0;setInterval(async()=>{if(!ULT||document.hidden)return;mostraUlt();const a=C.agenda(new Date(ULT));if(Date.now()<a.proxima.ms||Date.now()-VER<120000)return;VER=Date.now();
try{const d=await get('fonte=lista&force=1',S.t);const N2=prepL(d);const ant=new Map(LS.map(x=>[x.dia,x.modificadoEm]));if(N2.some(x=>ant.get(x.dia)!==x.modificadoEm)){try{localStorage.setItem('getlog_cli_lista',JSON.stringify(d))}catch(e){}LS=N2;SEMC=false;SEMR=null;mostraUlt();load()}}catch(e){}},60000);
// Cliente vazio ou TODOS (ex.: iMile, cliente principal) vê a operação inteira.
const tudo=!S.cliente||norm(S.cliente)==='todos'||/imile/.test(norm(S.cliente+' '+S.login));
// Visita: mesma regra da Performance do portal. Conta por SELLER (nome + cliente) no dia: visitado = coletou algo ou justificou
// (status de justificativa, motivo na observação ou coluna JUSTIFICADO); baixa indevida sem coleta/justificativa fica pendente.
const nS=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
const JST=new Set(['LOJA FECHADA','FECHADA','PRODUTO INDISPONIVEL','CODIGO DE COLETA NAO INFORMADO','ENDERECO DIVERGENTE','NAO LOCALIZEI O ENDERECO','ERRO DO SISTEMA','PACOTE CANCELADO','KWAI - ERRO NA OCORRENCIA','DROP RECEBEU','DROP CANCELADO OU FORA DA DS FM NOR','PACOTE CANCELADO OU FORA DA DS FM NOR']);
const isJ=x=>{const v=nS(x);return JST.has(v)||v==='MISS SCAN'||v.startsWith('MISS SCAN /')};const mPac=v=>v.startsWith('MISS SCAN')||v.includes('CANCELADO');
const motivo=rows=>{for(const r of rows){const v=nS(r.st);if(isJ(r.st)&&!mPac(v))return 1}for(const r of rows)for(const p of String(r.jtxt||'').split(' / ')){const m=p.trim().match(/^(.*?)\s*\((\d+)\)$/);if(m&&+m[2]&&isJ(m[1])&&!mPac(nS(m[1])))return 1}return 0};
function visitados(R){const G=new Map();for(const r of R){const k=nS(r.seller)+'|'+r.cli;let g=G.get(k);if(!g)G.set(k,g={rows:[],pen:0});g.rows.push(r);g.pen+=r.pen}const out=new Map();
for(const [k,g] of G){const col=g.rows.some(r=>r.col>0||r.tot>0),just=!!motivo(g.rows)||(g.pen<=0&&g.rows.some(r=>isJ(r.st)||(r.jus>0&&nS(r.st)!=='BAIXA INDEVIDA'))),vis=col||just;
const bx=g.rows.some(r=>nS(r.st)==='BAIXA INDEVIDA');if(bx&&!col&&!g.rows.some(r=>r.jus>0&&nS(r.st)!=='BAIXA INDEVIDA')){out.set(k,false);continue}out.set(k,vis||g.pen<=0)}return out}
const MEM={};const key=it=>it.dia+'|'+it.modificadoEm;
const carrega=it=>MEM[key(it)]||(MEM[key(it)]=(async()=>{const h=await lerC(it.dia,it.modificadoEm);if(h)return h;
const j=await get('fonte=performance&dia='+encodeURIComponent(it.dia),S.t);const RC=C.toRecords(j.conteudo),R=C.normRows(RC,it.k);
// Classe do seller (T1…T5): procura em qualquer coluna (TIPO DE PRIORIDADE, classe, tier…), não só numa.
const TIER=new Map();for(const o of RC){let t='';for(const [k,v] of Object.entries(o)){const m=String(v??'').match(/^\s*T\s?-?([1-9])\s*$/i)||(/prior|tier|classe|categ|curva|tipo/i.test(k)?String(v??'').match(/\bT\s?-?([1-9])\b/i):null);if(m){t='T'+m[1];break}}if(t){const sid=String(o['SELLER ID']??'').trim(),sn=String(o['SELLER']??'').trim();if(sid)TIER.set('i'+sid,t);if(sn)TIER.set('n'+sn,t)}}
const tierOf=r=>{const m=String(r.pri).match(/T\s?-?([1-9])/i);return TIER.get('i'+r.sid)||TIER.get('n'+r.seller)||(m?'T'+m[1]:r.pri)};const eu=tudo?null:C.casar([S.cliente],R.map(r=>r.cli));
// Linha compacta: data, seller, motorista, região, bairro, cidade, status, hora, previsto, coletado do previsto, total, justificado
const RR=R.filter(r=>tudo||eu.has(r.cli)),VZ=visitados(RR);const out=RR.map(r=>{const g=nS(r.seller)+'|'+r.cli;return [it.k,r.seller,r.mo.replace(/^.*? - /,''),r.reg,r.bai,r.cid,r.st,r.hora,r.prev,r.col,r.tot,r.jus,tierOf(r),r.cep,g,VZ.get(g)?1:0,r.cli]});gravaC(it.dia,it.modificadoEm,out);return out})().catch(e=>{delete MEM[key(it)];throw e}));
const kmin=LS[LS.length-1].k,kmax=LS[0].k;$('#d1').min=$('#d2').min=kmin;$('#d1').max=$('#d2').max=kmax;$('#d1').value=$('#d2').value=kmax;
let per='1',ROWS=[],GEN=0,ORD={o:'p',d:-1},LIM=50;
const semIni=k=>{const d=new Date(k+'T12:00:00');d.setDate(d.getDate()-((d.getDay()+6)%7));return d.toISOString().slice(0,10)};
const mesK=(o)=>{const d=new Date(LS[0].k+'T12:00:00');d.setDate(1);d.setMonth(d.getMonth()+o);return d.toISOString().slice(0,7)};
const dias=()=>per==='mes'?LS.filter(x=>x.k.slice(0,7)===mesK(0)):per==='mp'?LS.filter(x=>x.k.slice(0,7)===mesK(-1)):per==='sem'?LS.filter(x=>x.k>=semIni(LS[0].k)):per==='sp'?(()=>{const a=semIni(LS[0].k),d=new Date(a+'T12:00:00');d.setDate(d.getDate()-7);const b=d.toISOString().slice(0,10);return LS.filter(x=>x.k>=b&&x.k<a)})():per==='c'?(()=>{let a=$('#d1').value||kmin,b=$('#d2').value||kmax;if(a>b)[a,b]=[b,a];return LS.filter(x=>x.k>=a&&x.k<=b)})():LS.slice(0,+per);
const lin=a=>({dk:a[0],s:a[1],m:a[2],r:a[3],b:a[4],ci:a[5],st:a[6],hs:a[7],h:hr(a[7]),p:a[8],c:a[9],t:a[10],j:a[11],pr:String(a[12]||'').toUpperCase(),cep:String(a[13]||'').replace(/\D/g,''),g:a[0]+'|'+(a[14]||a[1]),vz:!!a[15],cl:a[16]||'Sem cliente'});
const prog=$('#prog');
async function load(){const g=++GEN,D=dias();let feitos=0;prog.hidden=false;carregando(true);prog.firstChild.style.width='4%';
const res=new Array(D.length);let i=0,falhas=0;
let pt=0;const parcial=()=>{if(g!==GEN||feitos===D.length)return;clearTimeout(pt);pt=setTimeout(()=>{if(g===GEN&&feitos<D.length)monta(res.filter(Boolean),0,true)},120)};
await Promise.all(Array.from({length:Math.min(6,D.length)},async()=>{while(i<D.length){const k=i++;try{res[k]=await carrega(D[k])}catch(e){res[k]=[];falhas++}if(g!==GEN)return;prog.firstChild.style.width=(++feitos/D.length*100)+'%';parcial()}}));
if(g!==GEN)return;prog.hidden=true;carregando(false);if(falhas===D.length&&D.length){falhou();return}monta(res,falhas)}
// Monta a tela com o que já chegou (os dias aparecem conforme carregam).
function monta(res,falhas,parc){ROWS=res.flat().map(lin);
if(!parc)mostraUlt();if(falhas)$('#upd').textContent='Alguns dias não carregaram ('+falhas+'). Tente atualizar.';
montaFiltros();if(!parc)LIM=50;run();if(!parc)setTimeout(adiantar,300)}
// Depois de abrir, deixa os últimos 7 dias prontos em segundo plano (trocar de período fica instantâneo).
function adiantar(){const F7=LS.slice(0,7);let i=0;for(let n=0;n<3;n++)(async()=>{while(i<F7.length)await carrega(F7[i++]).catch(()=>{})})()}
const cls=r=>r.p>0&&r.c>=r.p?['ok','Coletado']:r.p<=0&&r.t>0?['ok','Coleta extra']:r.c>0||r.t>0?['warn','Parcial']:r.vz?['jus','Justificado']:r.st==='Em rota'?['warn','Em rota']:['bad','Não visitado'];
const vis=r=>r.vz;
// Status como vem da planilha (Loja fechada, Coletado por ULG, Drop recebeu…), com a primeira letra maiúscula.
const stx=r=>{const v=String(r.st||'').trim();if(!v||v==='—')return '';return v.charAt(0).toUpperCase()+v.slice(1).toLowerCase()};
// Sellers contados uma vez por dia (seller + cliente), só os com previsto.
const sel=R=>{const a=new Set,v=new Set;for(const r of R)if(r.p>0){a.add(r.g);if(r.vz)v.add(r.g)}return [a.size,v.size]};const semCol=r=>r.p>0&&r.c<=0&&r.t<=0;
// ---- Filtros: menus com pesquisa e seleção múltipla ----
const FD=[['fc','Cliente',r=>r.cl],['fr','Região',r=>r.r||'Sem região'],['fm','Motorista',r=>r.m||'Sem motorista'],['fp','Prioridade',r=>r.pr&&r.pr!=='—'?r.pr:'Sem prioridade'],['fst','Status do seller',r=>r.st&&r.st!=='—'?r.st:'Sem status'],['fs','Situação da coleta',r=>cls(r)[1]],['fv','Visita',r=>vis(r)?'Visitado':'Não visitado']];
const SEL={};FD.forEach(([i])=>SEL[i]=new Set());let ABERTO=null;
const passa=(r,exc)=>FD.every(([i,,f])=>i===exc||!SEL[i].size||SEL[i].has(f(r)));
const filtra=()=>{const q=norm($('#q').value);return ROWS.filter(r=>passa(r)&&(!q||norm(r.s+' '+r.m+' '+r.b+' '+r.ci+' '+r.r+' '+r.cl).includes(q)))};
function montaFiltros(){if($('#fr'))return rotulos();const box=$('#fms');box.innerHTML=FD.filter(([i])=>i!=='fs').map(([i,l])=>`<div class="ms" id="${i}"><button type="button" class="msb" aria-haspopup="listbox"><span>${l}</span><em></em><i>▾</i></button></div>`).join('');
FD.forEach(([i])=>{const w=$('#'+i);if(!w)return;w.querySelector('.msb').onclick=e=>{e.stopPropagation();ABERTO===i?fecha():abre(i)}});rotulos()}
function rotulos(){FD.forEach(([i])=>{const n=SEL[i].size,em=$('#'+i+' em');if(!em)return;em.textContent=n?(n===1?[...SEL[i]][0]:n+' selecionados'):'Todos';$('#'+i).classList.toggle('on',!!n)})}
function fecha(){document.querySelectorAll('.msp').forEach(x=>x.remove());ABERTO=null}
function abre(id){fecha();ABERTO=id;const [,l,f]=FD.find(x=>x[0]===id);const cnt=new Map();for(const r of ROWS)if(passa(r,id)){const k=f(r);cnt.set(k,(cnt.get(k)||0)+1)}
for(const k of SEL[id])if(!cnt.has(k))cnt.set(k,0);const ops=[...cnt].sort((a,b)=>id==='fp'?a[0].localeCompare(b[0],'pt-BR',{numeric:true}):b[1]-a[1]||a[0].localeCompare(b[0],'pt-BR'));
const pn=document.createElement('div');pn.className='msp';pn.onclick=e=>e.stopPropagation();
pn.innerHTML=`<input type="search" placeholder="Pesquisar ${esc(l.toLowerCase())}…" aria-label="Pesquisar"><div class="msa"><button type="button" data-a="t">Marcar visíveis</button><button type="button" data-a="l">Limpar</button></div><div class="msl" role="listbox"></div>`;
const lst=pn.querySelector('.msl'),inp=pn.querySelector('input');
const desenha=()=>{const q=norm(inp.value);const V=ops.filter(([k])=>!q||norm(k).includes(q));lst.innerHTML=V.length?V.map(([k,n])=>`<label><input type="checkbox" value="${esc(k)}"${SEL[id].has(k)?' checked':''}><span>${esc(k)}</span><small>${N(n)}</small></label>`).join(''):'<p class="emp">Nada encontrado.</p>';
lst.querySelectorAll('input').forEach(c=>c.onchange=()=>{c.checked?SEL[id].add(c.value):SEL[id].delete(c.value);aplica()});return V};
inp.oninput=desenha;pn.querySelector('[data-a="t"]').onclick=()=>{desenha().forEach(([k])=>SEL[id].add(k));desenha();aplica()};pn.querySelector('[data-a="l"]').onclick=()=>{SEL[id].clear();desenha();aplica()};
$('#'+id).appendChild(pn);desenha();if(matchMedia('(hover:hover)').matches)inp.focus()}
let AT=0;const aplica=()=>{rotulos();clearTimeout(AT);AT=setTimeout(()=>{LIM=50;run()},120)};
document.addEventListener('click',fecha);document.addEventListener('keydown',e=>{if(e.key==='Escape')fecha()});
const agr=(R,key)=>{const M=new Map();for(const r of R){const k=key(r);let o=M.get(k);if(!o)M.set(k,o={k,p:0,c:0,t:0,n:0,v:0});o.p+=r.p;o.c+=Math.min(r.c,r.p);o.t+=r.t;if(r.p>0){(o.A||(o.A=new Set)).add(r.g);if(r.vz)(o.B||(o.B=new Set)).add(r.g)}}for(const o of M.values()){o.n=o.A?o.A.size:0;o.v=o.B?o.B.size:0}return [...M.values()]};
let F=[];
function run(){F=filtra();const at=FD.filter(([i])=>SEL[i].size).map(([i,l])=>`<button type="button" data-x="${i}">${l}: ${esc([...SEL[i]].slice(0,2).join(', '))}${SEL[i].size>2?' +'+(SEL[i].size-2):''} ✕</button>`);if($('#q').value)at.push(`<button type="button" data-x="q">Busca: ${esc($('#q').value)} ✕</button>`);const fa=$('#fa');fa.hidden=!at.length;$('#lmp').disabled=!at.length;fa.innerHTML=at.join('')+(at.length>1?'<button type="button" class="cl" data-x="*">Limpar tudo</button>':'');fa.querySelectorAll('button').forEach(b=>b.onclick=e=>{e.stopPropagation();const x=b.dataset.x;if(x==='*'||x==='q')$('#q').value='';if(x==='*')FD.forEach(([i])=>SEL[i].clear());else if(x!=='q')SEL[x].clear();rotulos();LIM=50;run()});const P=F.reduce((a,r)=>a+r.p,0),Cc=F.reduce((a,r)=>a+Math.min(r.c,r.p),0),T=F.reduce((a,r)=>a+r.t,0),pc=P?Cc/P*100:0,[nSel,V]=sel(F),pv=nSel?V/nSel*100:0;
const pend=F.filter(semCol).length;
const sC=new Set(F.filter(r=>r.p>0&&(r.c>0||r.t>0)).map(r=>r.g)).size,nV=nSel-V;
// Cartões clicáveis: filtram a tela (clicar de novo tira o filtro).
const K=(l,v,s,c,f)=>{const on=f&&SEL[f[0]].size===1&&SEL[f[0]].has(f[1]);return `<${f?'button type="button"':'div'} class="k${c?' pc':''}${f?' kb':''}${on?' on':''}"${f?` data-f="${f[0]}" data-v="${esc(f[1])}" title="Clique para filtrar"`:''}${c?` style="--c:${c}"`:''}><small>${l}</small><b>${v}</b>${s||''}</${f?'button':'div'}>`};const ring=p=>`<div class="ring"><i style="width:${Math.min(100,p)}%"></i></div>`;
kp.innerHTML=K('Previsto',N(P)+' <em>pacotes</em>',`<span class="ks"><b>${N(nSel)}</b> sellers</span>`)+K('Coletado do previsto',N(Cc)+' <em>pacotes</em>',`<span class="ks"><b>${N(sC)}</b> sellers coletados · total ${N(T)} pac.</span>`,'',['fs','Coletado'])+K('Sellers visitados',N(V),`<span class="ks">clique para ver a lista</span>`,'var(--ok)',['fv','Visitado'])+K('Sellers não visitados',N(nV),`<span class="ks">clique para ver a lista</span>`,nV?'var(--bad)':'var(--ok)',['fv','Não visitado']);
// Roscas: % de coleta (pacotes) e % de visita (sellers), cada uma com o seu número no centro.
{const grad=p=>p>=98?['#0f9d58','#34d399']:p>=85?['#d98e04','#fbbf24']:['#c62828','#f87171'];const ros=(t,p,cor,sub,tip)=>{const r=46,c=2*Math.PI*r,id='rg'+t;return `<div class="rs" data-t="${tip}"><svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${cor[0]}"/><stop offset="1" stop-color="${cor[1]}"/></linearGradient></defs><circle cx="60" cy="60" r="${r}" class="dt" stroke-width="12"/><circle cx="60" cy="60" r="${r}" fill="none" stroke="url(#${id})" stroke-width="12" stroke-linecap="round" stroke-dasharray="${c*Math.min(100,p)/100} ${c}" transform="rotate(-90 60 60)"/><text x="60" y="66" text-anchor="middle" class="dv">${P1(p)}</text></svg><b>${t}</b><small>${sub}</small></div>`};
$('#dn').innerHTML=ros('Visita',pv,grad(pv),`${N(V)} de ${N(nSel)} sellers`,`Visita: ${P1(pv)}\n${N(V)} de ${N(nSel)} sellers`)+ros('Coleta',pc,grad(pc),`${N(Cc)} de ${N(P)} pac.`,`Coleta: ${P1(pc)}\n${N(Cc)} de ${N(P)} pacotes`)}
$('#t45b').classList.toggle('on',SEL.fp.size===2&&SEL.fp.has('T4')&&SEL.fp.has('T5'));
kp.querySelectorAll('.kb').forEach(b=>b.onclick=()=>{const f=b.dataset.f,v=b.dataset.v,on=SEL[f].size===1&&SEL[f].has(v);SEL[f].clear();if(!on)SEL[f].add(v);rotulos();LIM=50;run();if(!on)$('#tbl').scrollIntoView({behavior:'smooth',block:'start'})});
charts();t45();tabela();mapa()}
// ---- Gráficos (SVG desenhado na largura real do quadro: textos nunca se sobrepõem) ----
const W=el=>Math.max(260,el.clientWidth-24);
const kfmt=v=>v>=1e6?(v/1e6).toFixed(1).replace('.',',')+' mi':v>=1e4?Math.round(v/1e3)+' mil':v>=1e3?(v/1e3).toFixed(1).replace('.',',')+' mil':String(Math.round(v));
// Gráfico combinado (barras + linhas de %): rótulos que não brigam com o desenho e dica com todos os números da coluna.
function combo(el,o){const n=o.cats.length;if(!n){el.innerHTML='<p class="emp">Sem dados no período.</p>';return}
const w=W(el),h=(o.h||280)+(o.under?14:0),pl=o.bars.length?48:14,pr=o.lines&&o.lines.length?46:12,pt=30,pb=o.under?50:38,cw=w-pl-pr,ch=h-pt-pb,bw=cw/n;
const mx=Math.max(1,...o.bars.flatMap(b=>b.v))*1.12,y=v=>pt+ch-v/mx*ch,LO=o.bars.length?0:Math.max(0,Math.floor((Math.min(100,...(o.lines||[]).flatMap(l=>l.v).filter(v=>v!=null))-6)/10)*10),yp=v=>pt+ch-(Math.max(LO,Math.min(100,v))-LO)/(100-LO)*ch,cx=i=>pl+i*bw+bw/2;
const nb=o.bars.length,gap=Math.min(4,bw*.06),bwi=Math.min(34,(bw*.72-gap*(nb-1))/nb),tot=nb*bwi+gap*(nb-1);
const passo=Math.max(1,Math.ceil(n/Math.max(1,Math.floor(cw/(o.minLbl||54)))));
let s=`<svg width="${w}" height="${h}" role="img" aria-label="${esc(o.titulo||'')}"><defs>${o.bars.map((b,k)=>`<linearGradient id="g${o.id}${k}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${b.c}"/><stop offset="1" stop-color="${b.c}" stop-opacity=".78"/></linearGradient>`).join('')}</defs>`;
for(let i=0;i<=4;i++){const v=mx/1.12*i/4;s+=(o.bars.length?`<line x1="${pl}" x2="${w-pr}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="${pl-8}" y="${y(v)+4}" class="ax" text-anchor="end">${kfmt(v)}</text>`:`<line x1="${pl}" x2="${w-pr}" y1="${yp(LO+(100-LO)*i/4)}" y2="${yp(LO+(100-LO)*i/4)}" class="gl"/>`)+(pr>12?`<text x="${w-pr+8}" y="${yp(LO+(100-LO)*i/4)+4}" class="ax">${Math.round(LO+(100-LO)*i/4)}%</text>`:'')}
for(let i=0;i<n;i++){const x0=cx(i)-tot/2;s+=`<rect class="hz" x="${pl+i*bw}" y="${pt-8}" width="${bw}" height="${ch+8}" data-t="${esc(o.tip(i))}"/>`;
o.bars.forEach((b,k)=>{const v=b.v[i],yy=y(v),hh=pt+ch-yy;s+=`<rect class="bar" x="${x0+k*(bwi+gap)}" y="${yy}" width="${bwi}" height="${Math.max(0,hh)}" rx="${Math.min(5,bwi/3)}" fill="url(#g${o.id}${k})"/>`;
if(b.lbl&&o.under){if(k===0)s+=`<text x="${cx(i)}" y="${h-2}" class="vl sm" text-anchor="middle">${kfmt(v)}</text>`}else if(b.lbl&&bw>=34&&v>0){const lx=x0+k*(bwi+gap)+bwi/2;const tw=kfmt(v).length*6.4+6;s+=hh>=22&&bwi>=tw?`<text x="${lx}" y="${pt+ch-7}" class="vl in" text-anchor="middle">${kfmt(v)}</text>`:`<text x="${lx}" y="${yy-5}" class="vl" text-anchor="middle">${kfmt(v)}</text>`}});
if(i%passo===0)s+=`<text x="${cx(i)}" y="${h-(o.under?20:14)}" class="ax" text-anchor="middle">${esc(o.cats[i])}</text>`}
(o.lines||[]).forEach((l,li)=>{const P=l.v.map((v,i)=>v==null?null:[cx(i),yp(v)]);const seg=P.filter(Boolean);if(!seg.length)return;
s+=`<polyline points="${seg.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${l.c}" stroke-width="${l.w||2.5}" stroke-linejoin="round" stroke-linecap="round" class="ln"/>`;
P.forEach((p,i)=>{if(!p)return;s+=`<circle cx="${p[0]}" cy="${p[1]}" r="${l.w?5.5:3.5}" fill="${l.c}" class="pt"/>`;if(l.lbl&&bw>=36){const out=(o.lines||[]).find((x,k)=>k!==li&&x.v[i]!=null);const up=!out||l.v[i]>out.v[i]||(l.v[i]===out.v[i]&&li===0);if(out&&l.v[i]===out.v[i]&&li>0)return;s+=`<text x="${p[0]}" y="${up?p[1]-10:p[1]+18}" class="vl pc" fill="${l.c}" text-anchor="middle">${String(Math.round(l.v[i]*10)/10).replace('.',',')}%</text>`}})});
el.innerHTML=s+'</svg>'+`<div class="lg2">${o.bars.map(b=>`<span><i style="background:${b.c}"></i>${b.n}</span>`).join('')}${(o.lines||[]).map(l=>`<span><i class="lnI" style="background:${l.c}"></i>${l.n}</span>`).join('')}${o.extra||''}</div>`}
let CP,CC,CO='#f86800',CV;const cores=()=>{const dk=document.documentElement.dataset.theme==='dark';CP=dk?'#3b4f78':'#93a8d2';CC=dk?'#6f9bff':'#002060';CV=dk?'#3ccf8e':'#11834e'};cores();
// Ao trocar o tema, redesenha os gráficos com as cores certas.
new MutationObserver(()=>{cores();if(ROWS.length)run()}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
const pcs=(c,p)=>p?c/p*100:null;
function tipo(t,a){return `${t}\nPrevisto: ${N(a.p)} pacotes\nColetado: ${N(a.c)} pacotes\nColeta: ${P1(a.p?a.c/a.p*100:0)}\nSellers: ${N(a.n)} · visitados ${N(a.v)} (${P1(a.n?a.v/a.n*100:0)})`}
// Por dia: sempre a operação inteira do período (não segue os filtros), só as taxas de coleta e de visita.
function chD(){const A=agr(ROWS,r=>r.dk).sort((a,b)=>a.k<b.k?-1:1);combo($('#chD'),{id:'d',titulo:'Performance por dia',cats:A.map(a=>fmtD(a.k).slice(0,5)),tip:i=>tipo(fmtD(A[i].k),A[i]),
bars:[],lines:[{n:'% visita',c:CV,v:A.map(a=>pcs(a.v,a.n)),lbl:1,w:4},{n:'% coleta (referência)',c:'#b9c3d6',v:A.map(a=>pcs(a.c,a.p))}]})}
function chH(){const H=new Array(24).fill(0),S=new Array(24).fill(0);let P=0;for(const r of F){P+=r.p;if(r.h>=0){H[r.h]+=r.t;S[r.h]++}}const ini=H.findIndex(v=>v>0);if(ini<0){$('#chH').innerHTML='<p class="emp">Sem horários de coleta no período.</p>';return}
const fim=23-[...H].reverse().findIndex(v=>v>0),hs=[];for(let i=ini;i<=fim;i++)hs.push(i);let ac=0;const AC=hs.map(x=>(ac+=H[x],P?ac/P*100:0));const pk=hs.reduce((a,b)=>H[b]>H[a]?b:a,hs[0]);
combo($('#chH'),{id:'h',titulo:'Coletas por hora',minLbl:34,under:1,cats:hs.map(x=>x+'h'),tip:i=>`${hs[i]}h às ${hs[i]}h59\nColetados na hora: ${N(H[hs[i]])} pacotes\nSellers com coleta: ${N(S[hs[i]])}\nAcumulado: ${P1(AC[i])} do previsto`,
bars:[{n:'Pacotes coletados na hora',c:CC,v:hs.map(x=>H[x]),lbl:1}],lines:[{n:'% acumulado do previsto',c:CO,v:AC,lbl:1}],extra:`<span class="pk">Pico ${pk}h · ${N(H[pk])} pac.</span>`})}
// Semanas: sempre as últimas 8 (carregadas em segundo plano), com os filtros aplicados.
let SEMR=null,SEMC=false;
async function carregaSem(){if(SEMC)return;SEMC=true;const lim=new Date(LS[0].k+'T12:00:00');lim.setDate(lim.getDate()-55);const lk=lim.toISOString().slice(0,10);const D=LS.filter(x=>x.k>=semIni(lk));
const out=new Array(D.length);let i=0;await Promise.all([0,1,2].map(async()=>{while(i<D.length){const k=i++;try{out[k]=await carrega(D[k])}catch(e){out[k]=[]}}}));SEMR=out.flat().map(lin);chW()}
function chW(){const el=$('#chW');if(!SEMR){el.innerHTML='<p class="emp"><span class="sp"></span> Carregando as últimas semanas…</p>';carregaSem();return}
const q=norm($('#q').value),R=SEMR.filter(r=>passa(r)&&(!q||norm(r.s+' '+r.m+' '+r.b+' '+r.ci+' '+r.r+' '+r.cl).includes(q)));const A=agr(R,r=>semIni(r.dk)).sort((a,b)=>a.k<b.k?-1:1);
const fim=k=>{const d=new Date(k+'T12:00:00');d.setDate(d.getDate()+6);return d.toISOString().slice(0,10)};
combo(el,{id:'w',titulo:'Performance por semana',minLbl:70,cats:A.map(a=>fmtD(a.k).slice(0,5)+'–'+fmtD(fim(a.k)).slice(0,5)),tip:i=>{const a=A[i],b=A[i-1],p=a.p?a.c/a.p*100:0,pb=b&&b.p?b.c/b.p*100:null;return tipo('Semana '+fmtD(a.k)+' a '+fmtD(fim(a.k)),a)+(pb==null?'':`\nvs. semana anterior: ${p>=pb?'▲':'▼'} ${P1(Math.abs(p-pb)).replace('%',' p.p.')}`)},
bars:[],lines:[{n:'% visita',c:CV,v:A.map(a=>pcs(a.v,a.n)),lbl:1,w:4},{n:'% coleta (referência)',c:'#b9c3d6',v:A.map(a=>pcs(a.c,a.p))}]})}
function chR(){const el=$('#chR'),A=agr(F,r=>r.r||'Sem região').sort((a,b)=>b.n-a.n);if(!A.length){el.innerHTML='<p class="emp">Sem dados.</p>';return}
el.innerHTML=`<div class="rg">${A.map(a=>{const p=a.p?a.c/a.p*100:0,v=a.n?a.v/a.n*100:0;return `<button type="button" class="rr${SEL.fr.has(a.k)?' on':''}" data-r="${esc(a.k)}"><span class="rn">${esc(a.k)}</span><span class="rb"><i style="width:${Math.min(100,v)}%;background:${pcCor(v)}"></i></span><b style="color:${pcCor(v)}">${P1(v)}</b><small>visita · ${N(a.v)} de ${N(a.n)} sellers · coleta <b style="color:${pcCor(p)}">${P1(p)}</b> (${N(a.c)} de ${N(a.p)} pac.)</small></button>`}).join('')}</div>`;
el.querySelectorAll('.rr').forEach(b=>b.onclick=()=>{const k=b.dataset.r,on=SEL.fr.size===1&&SEL.fr.has(k);SEL.fr.clear();if(!on)SEL.fr.add(k);rotulos();LIM=50;run()})}
function charts(){chW();chD();chH();chR();document.querySelectorAll('.ch title').forEach(t=>{t.parentNode.setAttribute('data-t',t.textContent);t.remove()})}
// Dica com os números ao passar o mouse (ou tocar) em barras e pontos.
const TIP=document.createElement('div');TIP.className='tip';TIP.hidden=true;document.body.appendChild(TIP);
const mostraTip=e=>{const el=e.target.closest&&e.target.closest('[data-t]');if(!el){TIP.hidden=true;document.querySelectorAll('.hz.on').forEach(x=>x.classList.remove('on'));return}TIP.textContent=el.getAttribute('data-t');document.querySelectorAll('.hz.on').forEach(x=>x!==el&&x.classList.remove('on'));el.classList.add('on');TIP.hidden=false;const x=e.clientX,y=e.clientY,w=TIP.offsetWidth;TIP.style.left=Math.max(8,Math.min(innerWidth-w-8,x-w/2))+'px';TIP.style.top=Math.max(8,y-TIP.offsetHeight-14)+'px'};
A.addEventListener('pointermove',mostraTip);A.addEventListener('pointerdown',mostraTip);A.addEventListener('pointerleave',()=>TIP.hidden=true);addEventListener('scroll',()=>TIP.hidden=true,{passive:true});
let rt=0;addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{if(F.length||ROWS.length){charts();MAP&&MAP.invalidateSize()}},150)});
// ---- Destaque T4/T5: sellers prioritários ----
function t45(){const el=$('#t45'),is=r=>/^T[45]$/.test(r.pr);const X=F.filter(is);el.hidden=false;if(!X.length){el.innerHTML='<div class="tb-h"><div><h2>Foco: sellers T4 e T5</h2><p class="sub">Nenhum seller T4 ou T5 encontrado no período e filtros escolhidos.</p></div></div>';return}
// T4 e T5 são um grupo só: um cartão com o resultado somado (clique filtra os dois).
const g=(()=>{const R=X,P=R.reduce((a,r)=>a+r.p,0),Cc=R.reduce((a,r)=>a+Math.min(r.c,r.p),0),pc=P?Cc/P*100:0,[rn,rv]=sel(R),v=rn?rv/rn*100:0,nc=rn-rv,cg=new Set(R.filter(r=>r.p>0&&(r.c>0||r.t>0)).map(r=>r.g)),jg=rv-[...cg].filter(g=>R.some(r=>r.g===g&&r.vz)).length,on=SEL.fp.size===2&&SEL.fp.has('T4')&&SEL.fp.has('T5');
return `<button type="button" class="tk tk1${on?' on':''}" id="tkx" title="Clique para ver só T4 e T5"><div class="tkh"><span><span class="tg">T4</span> <span class="tg">T5</span></span><span class="tkp" style="color:${pcCor(v)}">${P1(v)}<small>visita</small></span></div><div class="ring" style="--c:${pcCor(v)}"><i style="width:${Math.min(100,v)}%"></i></div>
<div class="tkm"><span><small>Sellers visitados</small><b>${N(rv)}</b><em>de ${N(rn)}</em></span><span><small>Coleta (pacotes)</small><b style="color:${pcCor(pc)}">${P1(pc)}</b><em>${N(Cc)} de ${N(P)}</em></span><span class="${nc?'bad':'ok'}"><small>Não visitados</small><b>${N(nc)}</b><em>sellers</em></span><span class="jz"><small>Justificados</small><b>${N(jg)}</b><em>visitados sem coleta</em></span></div></button>`})();
// Pendentes = sellers T4/T5 NÃO visitados (sem coleta e sem justificativa), um por seller no dia.
const GP=new Map();for(const r of X){if(r.vz||r.p<=0)continue;let o=GP.get(r.g);if(!o)GP.set(r.g,o={...r,p:0,c:0,t:0});o.p+=r.p;o.c+=r.c;o.t+=r.t}const pend=[...GP.values()].sort((a,b)=>b.p-a.p);
el.innerHTML=`<div class="tb-h"><div><h2>Foco: sellers T4 e T5</h2><p class="sub">Acompanhamento em destaque dos sellers de maior prioridade</p></div><button class="btn2" type="button" id="t45f">${SEL.fp.size&&[...SEL.fp].every(x=>/^T[45]$/.test(x))?'Ver todos':'Ver só T4 e T5'}</button></div>
<div class="tks">${g}</div>${pend.length?`<p class="sub"><b>${N(pend.length)}</b> sellers T4/T5 ainda não visitados (sem coleta e sem justificativa):</p><div class="tw"><table><tbody>${pend.slice(0,5).map(r=>`<tr><td><span class="tg">${esc(r.pr)}</span></td><td class="sl">${esc(r.s)}</td><td class="hide-m">${esc(r.m)}</td><td class="n">${N(r.p)} pac.</td><td><span class="s ${cls(r)[0]}">${esc(cls(r)[1])}</span></td></tr>`).join('')}</tbody></table></div>`:'<p class="sub ok-t">Todos os sellers T4 e T5 foram visitados. ✔</p>'}`;
$('#tkx').onclick=()=>$('#t45f').click();
$('#t45f').onclick=()=>{const so=SEL.fp.size&&[...SEL.fp].every(x=>/^T[45]$/.test(x));SEL.fp.clear();if(!so){SEL.fp.add('T4');SEL.fp.add('T5')}rotulos();LIM=50;run()}}
// ---- Tabela ----
function tabela(){const o=ORD.o,d=ORD.d;const R=[...F].sort((a,b)=>{const x=a[o],y=b[o];return (typeof x==='number'?x-y:String(x).localeCompare(String(y),'pt-BR'))*d});
$('#sub').textContent=N(F.length)+' registros';
document.querySelectorAll('th[data-o]').forEach(th=>{th.classList.toggle('so',th.dataset.o===o);th.dataset.d=d>0?'▲':'▼'});
$('#tb').innerHTML=R.length?R.slice(0,LIM).map(r=>{const [c,l]=cls(r);return `<tr><td>${fmtD(r.dk).slice(0,5)}</td><td class="sl">${esc(r.s)}</td><td class="hide-m">${esc(r.m)}</td><td class="hide-m">${esc(r.r)}</td><td class="hide-m">${esc(r.b)}</td><td class="hide-m">${/^T[45]$/.test(r.pr)?`<span class="tg">${esc(r.pr)}</span>`:r.pr&&r.pr!=='—'?`<span class="pz" title="${esc(r.pr)}">${esc(r.pr.charAt(0)+r.pr.slice(1).toLowerCase())}</span>`:''}</td><td class="n">${N(r.p)}</td><td class="n">${N(r.c)}</td><td class="n hide-m">${r.h>=0?esc(String(r.hs).match(/\d{1,2}:\d{2}/)?.[0]||''):''}</td><td><span class="s ${c}" title="${esc(l)}">${esc(stx(r)||l)}</span></td></tr>`}).join(''):'<tr><td colspan="10" class="emp">Nenhuma coleta encontrada.</td></tr>';
$('#more').innerHTML=R.length>LIM?`<button class="btn2" type="button" id="mais">Mostrar mais (${N(R.length-LIM)} restantes)</button>`:'';if($('#mais'))$('#mais').onclick=()=>{LIM+=300;tabela()}}
document.querySelectorAll('th[data-o]').forEach(th=>th.onclick=()=>{ORD=ORD.o===th.dataset.o?{o:ORD.o,d:-ORD.d}:{o:th.dataset.o,d:['p','c','h','dk'].includes(th.dataset.o)?-1:1};tabela()});
// Excel: a biblioteca só é baixada na hora do clique (não pesa na abertura do site).
let XL=null;const xlsx=()=>XL||(XL=new Promise((ok,err)=>{if(window.XLSX)return ok(window.XLSX);const sc=document.createElement('script');sc.src='/assets/vendor/xlsx/xlsx.full.min.js';sc.onload=()=>ok(window.XLSX);sc.onerror=()=>{XL=null;err()};document.head.appendChild(sc)}));
$('#csv').onclick=async()=>{const b=$('#csv');b.disabled=true;b.textContent='Gerando…';try{const X=await xlsx();
const lin=F.map(r=>({'Data':fmtD(r.dk),'Seller':r.s,'Cliente':r.cl,'Prioridade':r.pr,'Motorista':r.m,'Região':r.r,'Bairro':r.b,'Cidade':r.ci,'Previsto':r.p,'Coletado do previsto':r.c,'Coletado total':r.t,'Hora':r.hs,'Visitado':vis(r)?'Sim':'Não','Situação':cls(r)[1],'Status do seller':r.st}));
const ws=X.utils.json_to_sheet(lin);ws['!cols']=[10,30,14,10,24,18,18,14,10,12,12,10,9,14,18].map(w=>({wch:w}));ws['!autofilter']={ref:ws['!ref']};
const wb=X.utils.book_new();X.utils.book_append_sheet(wb,ws,'Coletas');
const rs=agr(F,r=>r.r||'Sem região').map(a=>({'Região':a.k,'Previsto':a.p,'Coletado':a.c,'% coleta':a.p?+(a.c/a.p*100).toFixed(1):0,'Sellers':a.n,'Visitados':a.v,'% visita':a.n?+(a.v/a.n*100).toFixed(1):0}));X.utils.book_append_sheet(wb,X.utils.json_to_sheet(rs),'Por região');
const ds=agr(F,r=>r.dk).sort((a,b)=>a.k<b.k?-1:1).map(a=>({'Data':fmtD(a.k),'Previsto':a.p,'Coletado':a.c,'% coleta':a.p?+(a.c/a.p*100).toFixed(1):0,'Sellers':a.n,'Visitados':a.v,'% visita':a.n?+(a.v/a.n*100).toFixed(1):0}));X.utils.book_append_sheet(wb,X.utils.json_to_sheet(ds),'Por dia');
X.writeFile(wb,'coletas-getlog-'+new Date().toISOString().slice(0,10)+'.xlsx')}catch(e){alert('Não foi possível gerar o Excel agora. Tente de novo.')}b.disabled=false;b.textContent='Baixar Excel (.xlsx)'};
// ---- Mapa: bairros atendidos (posição pelo bairro/cidade, guardada no aparelho) ----
let MAP=null,LAY=null,GEO={},GQ=Promise.resolve(),MG=0;try{GEO=JSON.parse(localStorage.getItem('getlog_geo')||'{}')}catch(e){}
const geo=k=>k in GEO?Promise.resolve(GEO[k]):(GQ=GQ.then(async()=>{if(k in GEO)return GEO[k];let v=null;try{const r=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q='+encodeURIComponent(k));const j=await r.json();if(j[0])v=[+j[0].lat,+j[0].lon]}catch(e){return null}
GEO[k]=v;try{localStorage.setItem('getlog_geo',JSON.stringify(GEO))}catch(e){}await new Promise(r=>setTimeout(r,1100));return v}));
async function mapa(){if(!window.L)return;const g=++MG;if(!MAP){MAP=L.map('map',{scrollWheelZoom:false}).setView([-23.55,-46.63],10);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,referrerPolicy:'strict-origin-when-cross-origin',attribution:'© OpenStreetMap'}).addTo(MAP);LAY=L.layerGroup().addTo(MAP)}
LAY.clearLayers();const lugar=r=>r.b?r.b+', '+(r.ci||'São Paulo'):r.cep.length>=5?'CEP '+r.cep.slice(0,5)+'-'+(r.cep.slice(5,8)||'000'):r.ci?r.ci:'';const A=agr(F.filter(lugar),lugar).sort((a,b)=>b.p-a.p).slice(0,70);const mx=Math.max(1,...A.map(a=>a.p));const pts=[];
$('#mapS').textContent=A.length?'Bairros atendidos ('+A.length+'); tamanho = volume, cor = performance de coleta':'Sem endereço nos dados do período.';
for(const a of A){const c=await geo(a.k.startsWith('CEP ')?a.k.slice(4)+', Brasil':a.k+', SP');if(g!==MG)return;if(!c)continue;const p=a.p?a.c/a.p*100:0,cor=p>=98?'#11834e':p>=85?'#d18a00':'#c62828';pts.push(c);
L.circleMarker(c,{radius:6+Math.sqrt(a.p/mx)*16,color:cor,weight:2,fillColor:cor,fillOpacity:.35}).bindPopup(`<b>${esc(a.k)}</b><br>Previsto: ${N(a.p)}<br>Coletado: ${N(a.c)}<br>Coleta: <b>${P1(p)}</b> · Visita: ${P1(a.n?a.v/a.n*100:0)}`).addTo(LAY);
if(pts.length===1||pts.length===8)MAP.fitBounds(pts.length===1?L.latLng(c).toBounds(8000):pts,{padding:[24,24],maxZoom:13})}
if(pts.length>1)MAP.fitBounds(pts,{padding:[24,24],maxZoom:13})}
// ---- Filtros ----
const PRE=[['1','Hoje'],['2','Hoje e ontem'],['sem','Esta semana'],['sp','Semana passada'],['7','Últimos 7 dias'],['15','Últimos 15 dias'],['30','Últimos 30 dias'],['mes','Este mês'],['mp','Mês passado'],['56','Últimas 8 semanas']];
const rotPer=()=>{const D=dias();const nome=per==='c'?'Personalizado':(PRE.find(x=>x[0]===per)||[,''])[1];$('#dpn').textContent=nome;$('#dpl').textContent=D.length?(D.length===1?fmtD(D[0].k):fmtD(D[D.length-1].k)+' – '+fmtD(D[0].k))+' · '+D.length+(D.length>1?' dias':' dia'):'Sem dias com dados'};
const setPer=v=>{per=v;document.querySelectorAll('#per button').forEach(b=>b.classList.toggle('on',b.dataset.p===v));rotPer();load()};
$('#t45b').onclick=()=>{const so=SEL.fp.size===2&&SEL.fp.has('T4')&&SEL.fp.has('T5');SEL.fp.clear();if(!so){SEL.fp.add('T4');SEL.fp.add('T5')}rotulos();LIM=50;run()};
// Calendário profissional: atalhos + 2 meses, só dias com dados ficam ativos.
let CAL=null;const fechaCal=()=>{if(CAL){CAL.remove();CAL=null}};document.addEventListener('click',e=>{if(CAL&&!e.target.closest('#dp'))fechaCal()});document.addEventListener('keydown',e=>{if(e.key==='Escape')fechaCal()});
$('#dpb').onclick=e=>{e.stopPropagation();if(CAL)return fechaCal();fecha();const AV=new Set(LS.map(x=>x.k));const D=dias();let a=D.length?D[D.length-1].k:null,b=D.length?D[0].k:null,hov=null;
let mes=new Date((b||LS[0].k)+'T12:00:00');mes.setDate(1);if(innerWidth>720)mes.setMonth(mes.getMonth()-1);
CAL=document.createElement('div');CAL.className='cal';CAL.setAttribute('role','dialog');CAL.onclick=e=>e.stopPropagation();$('#dp').appendChild(CAL);
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const mesH=m=>{const ini=new Date(m),dow=(ini.getDay()+6)%7,ult=new Date(m.getFullYear(),m.getMonth()+1,0).getDate();let c='';for(let i=0;i<dow;i++)c+='<span></span>';
for(let d=1;d<=ult;d++){const k=iso(new Date(m.getFullYear(),m.getMonth(),d)),e2=b||hov,lo=a&&e2?(a<e2?a:e2):a,hi=a&&e2?(a<e2?e2:a):a;const cl=['dd'];if(!AV.has(k))cl.push('off');if(lo&&k>=lo&&k<=hi)cl.push('in');if(k===lo)cl.push('ini');if(k===hi)cl.push('fim');if(k===LS[0].k)cl.push('hj');
c+=`<button type="button" class="${cl.join(' ')}" data-k="${k}"${AV.has(k)?'':' disabled'}>${d}</button>`}
return `<div class="mo"><b>${m.toLocaleDateString(window.GL_LANG&&GL_LANG.lang==='zh'?'zh-CN':'pt-BR',{month:'long',year:'numeric'})}</b><div class="wd">${(window.GL_LANG&&GL_LANG.lang==='zh'?['一','二','三','四','五','六','日']:['S','T','Q','Q','S','S','D']).map(x=>`<span>${x}</span>`).join('')}</div><div class="gd">${c}</div></div>`};
const desenha=()=>{const m2=new Date(mes);m2.setMonth(m2.getMonth()+1);const dois=innerWidth>720;
CAL.innerHTML=`<div class="cp">${PRE.map(([v,l])=>`<button type="button" data-p="${v}"${per===v?' class="on"':''}>${l}</button>`).join('')}</div><div class="cm"><div class="cn"><button type="button" data-n="-1" aria-label="Mês anterior">‹</button><button type="button" data-n="1" aria-label="Próximo mês">›</button></div><div class="ms2">${mesH(mes)}${dois?mesH(m2):''}</div>
<div class="cf"><span>${a?fmtD(a)+(b&&b!==a?' – '+fmtD(b):''):'Escolha o início'}${a&&!b?' · escolha o fim':''}</span><button type="button" class="btn2" data-x="c">Cancelar</button><button type="button" class="btn2 pri" data-x="a"${a?'':' disabled'}>Aplicar</button></div></div>`;
CAL.querySelectorAll('.cp button').forEach(x=>x.onclick=()=>{fechaCal();setPer(x.dataset.p)});
CAL.querySelectorAll('.cn button').forEach(x=>x.onclick=()=>{mes.setMonth(mes.getMonth()+ +x.dataset.n);desenha()});
CAL.querySelectorAll('.dd:not(.off)').forEach(x=>{x.onclick=()=>{const k=x.dataset.k;if(!a||b){a=k;b=null}else{if(k<a){b=a;a=k}else b=k}hov=null;desenha()};x.onmouseenter=()=>{if(a&&!b){hov=x.dataset.k;CAL.querySelectorAll('.dd').forEach(y=>{const k=y.dataset.k,lo=a<hov?a:hov,hi=a<hov?hov:a;y.classList.toggle('in',k>=lo&&k<=hi)})}}});
CAL.querySelector('[data-x="c"]').onclick=fechaCal;CAL.querySelector('[data-x="a"]').onclick=()=>{if(!a)return;$('#d1').value=a;$('#d2').value=b||a;fechaCal();document.querySelectorAll('#per button').forEach(x=>x.classList.remove('on'));per='c';rotPer();load()}};desenha()};
let qt=0;$('#q').oninput=()=>{clearTimeout(qt);qt=setTimeout(()=>{LIM=50;run()},200)};
setPer('1');
// Passo a passo rápido: aparece no 1º acesso de cada dia (e pelo botão "?").
const TOUR=[['#dpb','Período','Escolha o dia ou o intervalo: hoje, semana, mês ou datas no calendário.'],['#t45b','T4 e T5','Um clique mostra só os sellers T4 e T5 em toda a tela.'],['#fms','Filtros','Região, motorista, status, visita… Cada menu tem pesquisa e aceita vários itens.'],['.kw','Indicadores','% de coleta e de visita. Clique nos cartões para filtrar a lista.'],['#t45','Foco T4 e T5','Resultado de cada grupo. Clique no cartão para ver só ele.'],['#chW','Gráficos','Passe o mouse (ou toque) nas colunas para ver todos os números.'],['#csv','Excel','Baixa a lista filtrada em planilha.'],['.wa','Fale conosco','Fala direto com a GETLOG no WhatsApp.']];
function tour(){let i=0;const ov=document.createElement('div');ov.className='tour';ov.innerHTML='<div class="th"></div><div class="tc" role="dialog" aria-live="polite"></div>';document.body.appendChild(ov);const H=document.documentElement,ovf=H.style.overflow;H.style.overflow='hidden';const trava=e=>e.preventDefault();ov.addEventListener('wheel',trava,{passive:false});ov.addEventListener('touchmove',trava,{passive:false});
const fim=()=>{ov.remove();H.style.overflow=ovf;removeEventListener('resize',pos);removeEventListener('scroll',pos);try{localStorage.setItem('getlog_tour',new Date().toDateString())}catch(e){}};
const pos=()=>{const [sel,t,d]=TOUR[i],el=$(sel);if(!el||!el.getClientRects().length){i++;return i<TOUR.length?pos():fim()}const r=el.getBoundingClientRect(),h=ov.querySelector('.th'),c=ov.querySelector('.tc');
Object.assign(h.style,{left:r.left-6+'px',top:r.top-6+'px',width:r.width+12+'px',height:r.height+12+'px'});
c.innerHTML=`<small>${i+1} de ${TOUR.length}</small><b>${t}</b><p>${d}</p><div><button type="button" class="btn2" data-a="s">Pular</button><button type="button" class="btn2 pri" data-a="n">${i===TOUR.length-1?'Começar':'Próximo'}</button></div>`;
const cw=Math.min(320,innerWidth-24),abaixo=r.bottom+12+170<innerHeight;Object.assign(c.style,{width:cw+'px',left:Math.max(12,Math.min(innerWidth-cw-12,r.left))+'px',top:(abaixo?r.bottom+14:Math.max(12,r.top-14-c.offsetHeight))+'px'});
c.querySelector('[data-a="s"]').onclick=fim;c.querySelector('[data-a="n"]').onclick=()=>{i++;i<TOUR.length?ir():fim()}};
const ir=()=>{const el=$(TOUR[i][0]);if(el)el.scrollIntoView({block:'center'});requestAnimationFrame(pos);setTimeout(pos,200)};addEventListener('resize',pos);addEventListener('scroll',pos,{passive:true});ir()}
// Atualizar: pede a lista nova ao Drive (sem cache) e recarrega o que mudou.
$('#lmp').onclick=()=>{$('#q').value='';FD.forEach(([i])=>SEL[i].clear());rotulos();LIM=50;run()};
$('#atu').onclick=async()=>{const b=$('#atu');if(b.disabled)return;b.disabled=true;b.classList.add('gir');
try{const d=await get('fonte=lista&force=1',S.t);try{localStorage.setItem('getlog_cli_lista',JSON.stringify(d))}catch(e){}LS=prepL(d);for(const k in MEM)delete MEM[k];SEMC=false;SEMR=null;mostraUlt();await load()}catch(e){falhou()}
b.disabled=false;b.classList.remove('gir')};
$('#ajuda').onclick=()=>{if(!$('.tour'))tour()};
let vt='';try{vt=localStorage.getItem('getlog_tour')}catch(e){}if(vt!==new Date().toDateString())setTimeout(()=>{if(!$('.tour'))tour()},1200);
novaL.then(N2=>{const ant=new Map(LS.map(x=>[x.dia,x.modificadoEm]));const mud=N2.some(x=>ant.get(x.dia)!==x.modificadoEm)||N2.length!==LS.length;LS=N2;mostraUlt();if(mud){const k1=LS[LS.length-1].k,k2=LS[0].k;$('#d1').min=$('#d2').min=k1;$('#d1').max=$('#d2').max=k2;SEMC=false;SEMR=null;load()}}).catch(()=>{})}
})();
