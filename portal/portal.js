(()=>{
const REPO='getlogtransp-rgb/getlogtransp-rgb.github.io',S_KEY='getlog_sessao',GH_KEY='getlog_gh',PONTO_KEY='getlog_ponto',CONS_KEY='getlog_consent';
const enc=new TextEncoder(),dec=new TextDecoder();
const b2u=b=>{const s=atob(b);const u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u};
const u2b=u=>{u=new Uint8Array(u);let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)};
const rnd=n=>crypto.getRandomValues(new Uint8Array(n));
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N=n=>Number(n||0).toLocaleString('pt-BR');
const norm=s=>String(s||'').trim().toLowerCase();
let CFG={},DB=null,MASTER=null,MASTER_RAW=null,ME=null,AVISOS=[],ESCALAS=[],FIN=null,ROWS=null;
const ROLE_LBL={admin:'Administrador',colaborador:'Colaborador',ajudante:'Ajudante',motorista:'Motorista',fornecedor:'Fornecedor'};
const VEIC=['Fiorino','Van','VUC','HR','3/4','Carreta','Carro','Moto'];
const LIVE=['dash','coletados','equipe','financeiro'];
const ACC={admin:['dash','coletados','equipe','perf','forecast','ponto','pontoadm','avisos','usuarios','escalas','financeiro','app'],colaborador:['dash','coletados','equipe','perf','forecast','ponto','avisos','app'],ajudante:['coletados','ponto','avisos','app'],motorista:['perf','avisos','app']};
async function kek(pw,salt,iter){const base=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:iter,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
async function seal(obj){const iv=rnd(12);return {iv:u2b(iv),ct:u2b(await crypto.subtle.encrypt({name:'AES-GCM',iv},MASTER,enc.encode(JSON.stringify(obj))))}}
async function open_(o){return JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:b2u(o.iv)},MASTER,b2u(o.ct))))}
async function wrapFor(pw){const salt=rnd(16),iv=rnd(12);const k=await kek(pw,salt,DB.iter);return {salt:u2b(salt),iv:u2b(iv),key:u2b(await crypto.subtle.encrypt({name:'AES-GCM',iv},k,MASTER_RAW))}}
const getJSON=async p=>{const r=await fetch(p+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('db');return r.json()};
async function loadDB(){DB=await getJSON('/data/users.json')}
async function profiles(){for(const u of DB.users){if(u._p)continue;try{u._p=await open_(u.p)}catch(e){u._p={}}}}
async function loadShared(){try{AVISOS=await open_(await getJSON('/data/avisos.json'))}catch(e){AVISOS=[]}try{ESCALAS=await open_(await getJSON('/data/escalas.json'))}catch(e){ESCALAS=[]}try{CFG=await open_(await getJSON('/data/config.json'))}catch(e){CFG={}}if(ME?.role==='admin')try{FIN=await open_(await getJSON('/data/financeiro.json'))}catch(e){FIN=null}}
async function senhaPlan(login){if(!DB.senhaUrl)return null;try{const c=new AbortController();setTimeout(()=>c.abort(),7000);const j=await (await fetch(DB.senhaUrl+'?senha='+encodeURIComponent(login),{signal:c.signal})).json();return j.ok&&j.dados&&j.dados.key?j.dados:null}catch(e){return null}}
// ---- Sessão do dia: vale até 23:59 neste aparelho, mas cai na hora se o acesso for revogado ----
const fimDoDia=()=>{const d=new Date();d.setHours(23,59,59,999);return d.getTime()};
const sessGet=()=>{try{const o=JSON.parse(localStorage.getItem(S_KEY)||sessionStorage.getItem(S_KEY));return o&&o.k&&o.exp>Date.now()?o:null}catch(e){return null}};
const sessSet=o=>{const t=JSON.stringify(o);try{localStorage.setItem(S_KEY,t)}catch(e){}try{sessionStorage.setItem(S_KEY,t)}catch(e){}};
// Chave do aparelho: gerada no navegador, NÃO exportável e guardada no IndexedDB. A chave mestra da sessão só é gravada cifrada
// com ela — copiar o localStorage (ou um print/arquivo) não revela nada. Ao sair, a chave do aparelho e o cache de dados são apagados.
const IDB=window.GL_IDB;
const devKey=async()=>{let k=await IDB.get('dev');if(!k){k=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);await IDB.put('dev',k)}return k};
const wrapSess=async raw=>{const iv=rnd(12);return {iv:u2b(iv),ct:u2b(await crypto.subtle.encrypt({name:'AES-GCM',iv},await devKey(),raw))}};
const unwrapSess=async o=>new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:b2u(o.iv)},await devKey(),b2u(o.ct)));
const sessDel=()=>{try{localStorage.removeItem(S_KEY)}catch(e){}try{sessionStorage.removeItem(S_KEY)}catch(e){}IDB.limpar()};
let SESS=null,BLOQ=false;
// Credencial do servidor do ponto: derivada da senha, separada da chave dos dados. O servidor guarda só o hash dela.
async function credencial(login,pw){const b=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveBits']);return u2b(await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode('getlog-auth|'+login),iterations:100000,hash:'SHA-256'},b,256))}
const hashHex=async s=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s)))].map(b=>b.toString(16).padStart(2,'0')).join('');
async function login(u,pw){await loadDB();const usr=DB.users.find(x=>x.login===norm(u));if(!usr)throw new Error('cred');let raw;
const sp=await senhaPlan(usr.login);const novo=sp&&(!usr.pwEm||sp.em>usr.pwEm);const tries=novo?[sp]:[usr];
for(const w of tries){try{const k=await kek(pw,b2u(w.salt),DB.iter);raw=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:b2u(w.iv)},k,b2u(w.key)));break}catch(e){}}
if(!raw)throw new Error('cred');if(usr.active===false)throw new Error('off');
return {usr,raw,x:{troca:pw===PW_PADRAO,av:await credencial(usr.login,pw)}}}
async function start(usr,raw,x){
MASTER_RAW=raw;MASTER=await crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt']);IDB.chave=MASTER;IDB.dono=usr.login;
await profiles();const p=usr._p||{};
ME={login:usr.login,role:usr.role,name:p.name||usr.login,ref:p.ref||'',cliente:p.cliente||''};
SESS={...ME,k:await wrapSess(raw),exp:x.exp||fimDoDia(),pwEm:usr.pwEm||'',av:x.av||'',troca:!!x.troca};sessSet(SESS);
if(ME.role==='fornecedor'){location.replace('/cliente/');return}
await loadShared();GL_API.setToken(CFG.driveToken||'');$('#login').hidden=true;$('#app').hidden=false;
if(SESS.troca){BLOQ=true;$('#app').innerHTML='';await trocarSenha(true);BLOQ=false;SESS.troca=false;sessSet(SESS)}
document.title='Portal | GETLOG Transportes';shell();popupAvisos();vigiar();pontoSave(pontoAll());
}
// Encerra a sessão (saída, revogação ou senha redefinida) recarregando a página: nada do estado anterior sobrevive.
function encerrar(motivo){sessDel();try{if(motivo)sessionStorage.setItem('getlog_msg',motivo)}catch(e){}location.replace('/portal/')}
const form=$('#loginForm'),msg=$('#msg'),go=$('#go');
$('#eye').addEventListener('click',()=>{const p=$('#p');const s=p.type==='password';p.type=s?'text':'password';$('#eye').setAttribute('aria-label',s?'Ocultar senha':'Mostrar senha')});
form.addEventListener('submit',async e=>{e.preventDefault();if(go.disabled)return;const u=$('#u').value,p=$('#p').value;
if(!u.trim()||!p){msg.className='msg err';msg.textContent='Preencha usuário e senha.';return}
go.disabled=true;go.textContent='Verificando...';msg.textContent='';
try{const {usr,raw,x}=await login(u,p);await start(usr,raw,x)}catch(err){console.warn('login',err);msg.className='msg err';msg.textContent=err.message==='off'?'Este acesso está desativado. Fale com o administrador.':err.message==='db'?'Não foi possível carregar os acessos. Verifique a conexão e tente de novo.':'Usuário ou senha incorretos.';go.disabled=false;go.textContent='Entrar'}});
// Volta para a sessão do dia sem pedir senha, conferindo antes se o acesso continua valendo.
(async()=>{let m='';try{m=sessionStorage.getItem('getlog_msg')||'';sessionStorage.removeItem('getlog_msg')}catch(e){}if(m){msg.className='msg err';msg.textContent=m}
const fim=()=>{document.documentElement.classList.remove('sess');sessDel();$('#u').focus()};
const x=sessGet();if(!x){fim();return}
try{await loadDB();const usr=DB.users.find(u=>u.login===x.login);
if(!usr||usr.active===false||usr.role!==x.role||(usr.pwEm||'')!==(x.pwEm||''))throw new Error('revogado');
await start(usr,typeof x.k==='string'?b2u(x.k):await unwrapSess(x.k),x)}catch(e){console.warn('sessão',e);fim()}})();
// ---- Autorização no servidor do ponto (Apps Script) ----
const PLAN=()=>CFG.pontoUrl&&CFG.pontoToken;
let PV=null;const versao=()=>PV||(PV=fetch(CFG.pontoUrl+'?versao=1',{cache:'no-store'}).then(r=>r.json()).then(j=>j.versao||1).catch(()=>{PV=null;return 0}));
const v2=async()=>PLAN()&&await versao()>=2;
const NEGADO={acesso:'Seu acesso foi desativado. Fale com o administrador.',credencial:'Sua senha foi alterada. Entre novamente.'};
async function api(acao,dados={}){const r=await fetch(CFG.pontoUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({token:CFG.pontoToken,acao,login:ME.login,av:SESS.av,...dados})});
const j=await r.json();if(!j.ok){if(NEGADO[j.erro])encerrar(NEGADO[j.erro]);const e=new Error(j.erro||'planilha');e.code=j.erro;throw e}return j}
// Confere se o acesso continua valendo: site (users.json) e, se disponível, o servidor do ponto (bloqueio imediato).
let VIG=0,VIGT=0,VIGP=null;
const conferirAcesso=forcar=>{if(!ME)return Promise.resolve(false);if(VIGP)return VIGP;if(!forcar&&Date.now()-VIG<5000)return Promise.resolve(true);VIG=Date.now();return VIGP=conferir_().finally(()=>VIGP=null)};
async function conferir_(){let motivo='';
try{const db=await getJSON('/data/users.json');const u=db.users.find(x=>x.login===ME.login);
if(!u||u.active===false)motivo=NEGADO.acesso;else if(u.role!==ME.role)motivo='Seu tipo de acesso foi alterado. Entre novamente.';else if((u.pwEm||'')!==(SESS.pwEm||''))motivo='Sua senha foi redefinida pelo administrador. Entre novamente.'}catch(e){}
if(motivo){encerrar(motivo);return false}
if(await v2())try{await api('eu')}catch(e){if(NEGADO[e.code])return false}
if(Date.now()>SESS.exp){encerrar('Sua sessão do dia terminou. Entre novamente.');return false}
return true}
function vigiar(){clearInterval(VIGT);VIGT=setInterval(()=>{if(!document.hidden)conferirAcesso()},5*60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)conferirAcesso()})}
const ic=d=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC={dash:ic('<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>'),coletados:ic('<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>'),equipe:ic('<circle cx="12" cy="7" r="3.5"/><path d="M5 21c.8-4 3.6-6.5 7-6.5s6.2 2.5 7 6.5"/>'),financeiro:ic('<rect x="2" y="6" width="20" height="13" rx="2"/><circle cx="12" cy="12.5" r="2.5"/><path d="M6 9.5h.01M18 15.5h.01"/>'),perf:ic('<path d="M4 18a8 8 0 1 1 16 0"/><path d="m12 18 4-6"/>'),forecast:ic('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),ponto:ic('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>'),pontoadm:ic('<path d="M9 5H5v14h14v-4"/><path d="M9 13l3 3 9-9"/>'),avisos:ic('<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>'),usuarios:ic('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.8.7 3 2.5 3.5 5.2"/>'),escalas:ic('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 13h3M8 17h8"/>'),app:ic('<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>'),menu:ic('<path d="M4 7h16M4 12h16M4 17h16"/>'),x:ic('<path d="M6 6l12 12M18 6 6 18"/>'),cam:ic('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>')};
const NAV=[['Visão geral',[['dash','Dashboard']]],['Operação',[['coletados','Pacotes coletados'],['perf','Performance'],['forecast','Forecast']]],['Pessoas',[['ponto','Bater ponto'],['pontoadm','Controle de ponto'],['equipe','Tempo de operação'],['escalas','Escalas']]],['Comunicação',[['avisos','Avisos']]],['Gestão',[['usuarios','Usuários e acessos'],['financeiro','Financeiro']]],['Aplicativo',[['app','App GETLOG']]]];
const SLUG={coletados:'pacotes-coletados',perf:'performance',equipe:'tempo-de-operacao'};const deSlug=h=>Object.keys(SLUG).find(k=>SLUG[k]===h)||h;
const TITULO={coletados:'Pacotes coletados',perf:'Performance',forecast:'Forecast',equipe:'Tempo de operação'};
const SHORT={dash:'Início',coletados:'Coletados',equipe:'Tempo de operação',financeiro:'Financeiro',perf:'Performance',forecast:'Forecast',ponto:'Ponto',avisos:'Avisos',app:'App'};
const can=v=>ACC[ME.role].includes(v);
function shell(){
const groups=NAV.map(([g,items])=>{const it=items.filter(([v])=>can(v));if(!it.length)return '';return `<h5>${g}</h5>`+it.map(([v,l])=>`<button data-view="${v}">${IC[v]}<span>${l}</span>${v==='app'?'<span class="badge">Em breve</span>':v==='financeiro'?'<span class="badge">Em desenv.</span>':''}</button>`).join('')}).join('');
const mob=ACC[ME.role].filter(v=>SHORT[v]&&!['equipe','financeiro'].includes(v)).slice(0,4);
$('#app').innerHTML=`<div class="app"><aside class="side" aria-label="Menu do portal"><a class="logo-chip" href="/"><img src="/assets/logo-getlog.webp" alt="GETLOG Transportes" width="88" height="36"></a><nav class="side-nav">${groups}</nav>
<div class="who"><b>${esc(ME.name)}</b><span>${ROLE_LBL[ME.role]}</span><div class="row"><button type="button" id="tsenha">Trocar senha</button><button class="out" id="sair" type="button">Sair</button></div></div></aside>
<div class="scrim" id="scrim"></div><main class="main" id="main"></main>
<nav class="bnav" aria-label="Navegação rápida">${mob.map(v=>`<button data-view="${v}">${IC[v]}<span>${SHORT[v]}</span></button>`).join('')}<button id="more" aria-label="Abrir menu">${IC.menu}<span>Menu</span></button></nav></div>`;
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.view)));
$('#sair').onclick=()=>encerrar('');
$('#tsenha').onclick=()=>{fechaMenu();trocarSenha(false).then(ok=>ok&&toast('Senha alterada.'))};
$('#more').onclick=()=>{$('.side').classList.add('open');$('#scrim').classList.add('on');document.body.classList.add('lock')};
$('#scrim').onclick=fechaMenu;
const h=deSlug(location.hash.slice(1));show(can(h)?h:ACC[ME.role][0]);
}
const fechaMenu=()=>{$('.side')?.classList.remove('open');$('#scrim')?.classList.remove('on');document.body.classList.remove('lock')};
addEventListener('hashchange',()=>{const h=deSlug(location.hash.slice(1));if(ME&&!BLOQ&&can(h)&&h!==CUR)show(h)});
// Ciclo de vida das telas: ao trocar de tela, tudo que a anterior ligou (mapa, relógio, assinaturas) é desligado.
let CUR='',GEN=0,LEAVE=[];const onLeave=f=>LEAVE.push(f);const vivo=g=>g===GEN;
function show(v){if(!ME||BLOQ||!can(v))return;const fs=LEAVE;LEAVE=[];for(const f of fs)try{f()}catch(e){console.warn(e)}
GEN++;CUR=v;if(location.hash.slice(1)!==(SLUG[v]||v))location.hash=SLUG[v]||v;document.title=(TITULO[v]||SHORT[v]||'Portal')+' | GETLOG';
$$('[data-view]').forEach(b=>b.dataset.view===v?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current'));fechaMenu();
M().classList.toggle('full',v==='perf');scrollTo(0,0);conferirAcesso();
if(v==='forecast'){const g=GEN;if(ROWSF){VIEWS[v]();if(Date.now()-LOADF_EM>15*60000){const s0=SIGF;loadF(true).then(()=>{if(vivo(g)&&SIGF!==s0)VIEWS[v]()})}}else{M().innerHTML=SKEL;loadF().then(()=>{if(vivo(g))VIEWS[v]()})}return}
if(LIVE.includes(v)){const g=GEN;assinarDados();if(!DIAS.size){M().innerHTML=SKEL;loadReal().then(()=>{if(vivo(g))VIEWS[v]()})}else VIEWS[v]();return}
VIEWS[v]()}
const M=()=>$('#main');
const SKEL='<div class="skel-wrap" aria-busy="true"><span class="sk h"></span><div class="kpi-grid"><span class="sk k"></span><span class="sk k"></span><span class="sk k"></span><span class="sk k"></span></div><span class="sk b"></span></div>';
const toast=t=>{let d=$('#toast');if(!d){d=document.createElement('div');d.id='toast';d.className='toast';d.setAttribute('role','status');document.body.appendChild(d)}d.textContent=t;d.classList.add('on');clearTimeout(d._t);d._t=setTimeout(()=>d.classList.remove('on'),3500)};
// Última/Próxima atualização: a próxima só avança quando a atualização do horário é confirmada nos dados.
let AGENDA=null;
const updHTML=()=>{const a=AGENDA;if(!a)return '';return `<span class="upd" id="upd"><i class="${a.erro?'off':a.estado==='prevista'?'':'wait'}"></i><span>Última atualização: <b>${esc(a.ultima?a.ultima.label:'—')}</b></span><span>Próxima: <b>${esc(a.proxima.label)}</b>${a.estado!=='prevista'?` <em>${C.ESTADO_TXT[a.estado]}</em>`:''}${a.erro?' <em>sem conexão</em>':''}</span></span>`};
const top=(t,sub,live,upd)=>`<div class="topbar"><div><h1>${t}</h1><p>${sub}</p></div><div class="top-act">${GL_TEMA.btn('btn btn-ghost btn-sm tema-btn')}${live?updHTML():upd?`<span class="upd"><i></i>Atualizado: ${esc(upd)}</span>`:''}${[...LIVE,'forecast'].includes(CUR)?`<button class="btn btn-ghost btn-sm" type="button" data-glref aria-label="Atualizar dados">↻ Atualizar</button>`:''}</div></div>`;
const vazio=t=>`<div class="box empty-state"><h3>Sem dados para mostrar</h3><p>${t}</p></div>`;
// ---- Dados operacionais: mesma fonte e mesma leitura da Performance (GL_CORE.normRows) ----
const C=window.GL_CORE;
const DIAS=new Map();let LOADING=null;
// Horário do bip (coluna HORA): aceita 'hh:mm', data com hora ou fração do dia do Excel. Devolve minutos do dia.
const bipMin=v=>{v=String(v??'').trim();if(!v)return null;const m=v.match(/(\d{1,2}):(\d{2})/);if(m)return +m[1]*60+ +m[2];const n=Number(v.replace(',','.'));if(isFinite(n)&&n>0&&n<1)return Math.round(n*1440);return null};
const hhmm=x=>x==null?'—':String(Math.floor(x/60)).padStart(2,'0')+':'+String(Math.round(x%60)).padStart(2,'0');
const dur=x=>x==null?'—':Math.floor(x/60)+'h'+String(Math.round(x%60)).padStart(2,'0');
const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
// Chave do seller (mesma da Performance): nome do seller + cliente.
const sk=r=>String(r.s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim()+'|'+r.c;
// Foto só entra na tela se for imagem embutida ou https (bloqueia endereço malicioso vindo da planilha).
const imgSeg=u=>/^(data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+|https:\/\/[^"'<>\s]+)$/.test(String(u||''))?esc(u):'';
const toRow=r=>({d:r.dk,s:r.seller,sid:r.sid,c:r.cli,r:r.reg,m:r.mo||(r.ma!==C.NAO_ATRIB?r.ma:''),t:C.coletadoGet(r),p:r.prev,cp:r.col,h:bipMin(r.hora),a:r.aju,b:r.bai,ci:r.cid});
const ingestDia=(s,x)=>{const [d,m,y]=s.split('.');DIAS.set(s,C.normRows(C.toRecords(x.json),`${y}-${m}-${d}`).map(toRow));ROWS=null};
// Base de coletados (todos os pacotes bipados, com horário real). Quando existe para o dia, ela é a fonte do "coletado":
// as linhas da Performance ficam só com previsto/coletado do previsto (t=0) e os pacotes vêm da base de coletados.
const COLD=new Map();
const HORAS=new Map();
const ingestCol=(s,x)=>{if(!x||!Array.isArray(x.linhas))return;if(Array.isArray(x.horas))HORAS.set(s.split('.').reverse().join('-'),x.horas);const [d,m,y]=s.split('.');const k=`${y}-${m}-${d}`;
const reg=new Map(),aj=new Map();for(const r of DIAS.get(s)||[]){if(r.sid&&r.r&&!reg.has(r.sid))reg.set(r.sid,r.r);if(r.m&&r.a&&!aj.has(r.m))aj.set(r.m,r.a)}
COLD.set(s,x.linhas.map(a=>({d:k,c:String(a[0]||'SEM CLIENTE'),sid:String(a[1]||''),s:String(a[2]||a[1]||''),m:String(a[3]||(/hub nuvem envio/i.test(String(a[0]))?'GET - HUB NUVEM ENVIO':'')),b:String(a[4]||''),t:+a[5]||0,ds:+a[6]||0,h:bipMin(a[7]),hf:bipMin(a[8]),r:reg.get(String(a[1]||''))||'Sem região',p:0,cp:0,a:aj.get(String(a[3]||''))||'',col:1})));ROWS=null};
function rows(){if(!ROWS){const out=[];for(const [s,R] of DIAS){if(COLD.has(s)){for(const r of R)out.push(r.t?{...r,t:0}:r);out.push(...COLD.get(s))}else out.push(...R)}
for(const [s,R] of COLD)if(!DIAS.has(s))out.push(...R);ROWS=out.sort((a,b)=>a.d<b.d?-1:a.d>b.d?1:0)}return ROWS}
const usaCol=()=>C.veTudo(ME.role);
const loadCol=async ds=>{if(!usaCol())return;const L=await GL_API.listaCol();const tem=new Set(L.map(x=>x.dia));await GL_API.pool(ds.filter(x=>tem.has(x.dia)),3,async x=>{const r=await GL_API.col(x.dia);if(r)ingestCol(x.dia,r)})};
const diaKey=s=>s.split('.').reverse().join('-');
// Abre a semana mais recente e mostra; o restante do histórico entra em segundo plano e atualiza só a tela aberta.
function loadReal(){return LOADING||(LOADING=(async()=>{const L=GL_API.ordem(await GL_API.lista());const lim=keyD(new Date(Date.now()-62*864e5));const ds=L.filter(x=>diaKey(x.dia)>=lim);
const take=list=>GL_API.pool(list,6,async x=>{const r=await GL_API.dia(x.dia);if(r)ingestDia(x.dia,r)});
await take(ds.slice(0,7));await loadCol(ds.slice(0,7)).catch(()=>{});if(ds.length>7)take(ds.slice(7)).then(()=>loadCol(ds.slice(7)).catch(()=>{})).then(()=>{ROWS=null;if(LIVE.includes(CUR))VIEWS[CUR]()});
if(!L.length)LOADING=null})())}
function assinarDados(){const un=GL_API.assinar(async(est,mud)=>{AGENDA=est;let ch=false;
const min=[...DIAS.keys()].map(diaKey).sort()[0]||'';for(const s of mud){if(!DIAS.has(s)&&diaKey(s)<min)continue;try{const r=await GL_API.dia(s);if(r){ingestDia(s,r);ch=true}}catch(e){console.warn('atualização',s,e)}}
if(usaCol()){try{const antes=new Map(((await GL_API.listaCol())||[]).map(x=>[x.dia,x.modificadoEm]));const L=await GL_API.listaCol(true);for(const x of L){if(antes.get(x.dia)===x.modificadoEm&&COLD.has(x.dia))continue;if(!DIAS.has(x.dia)&&!COLD.has(x.dia)&&diaKey(x.dia)<min)continue;const r=await GL_API.col(x.dia);if(r){ingestCol(x.dia,r);ch=true}}}catch(e){console.warn('coletados',e)}}
if(!LIVE.includes(CUR))return;if(ch){VIEWS[CUR]();toast('Dados atualizados')}else{const u=$('#upd');if(u)u.outerHTML=updHTML();if(REFRESH){toast(est.erro?'Sem conexão com os dados. Tente de novo em instantes.':'Os dados já estão atualizados')}}REFRESH=false});onLeave(un)}
let REFRESH=false;
// Forecast (aba GERAL): arquivo único, recarregado ao abrir a tela se tiver mais de 15 min ou pelo botão Atualizar.
let ROWSF=null,LOADF=null,LOADF_EM=0,UPDF='',SIGF='';
function buildF(g){const c=g.colunas,ix=n=>c.indexOf(n);const I={d:ix('DATA'),sid:ix('SELLER ID'),s:ix('SELLER'),b:ix('BAIRRO'),ci:ix('CIDADE'),m:ix('MOTORISTA'),pri:ix('PRIORIDADE ?'),a:ix('AJUDANTE?')};
const CL=['SHEIN BRA','SHEIN D2D','TIKTOK','KWAI'].map(n=>[n,ix(n)]).filter(x=>x[1]>=0);const g2=(r,i)=>i<0?'':String(r[i]??'').trim();const out=[];
for(const r of g.linhas){const d=g2(r,I.d);if(!/^\d{4}-\d{2}-\d{2}$/.test(d))continue;for(const [cn,ci] of CL){const p=+g2(r,ci).replace(',','.')||0;if(!p)continue;out.push({d,s:g2(r,I.s),sid:g2(r,I.sid),c:cn,r:g2(r,I.ci),b:g2(r,I.b),ci:g2(r,I.ci),m:g2(r,I.m)||'SEM MOTORISTA',p,pri:g2(r,I.pri),a:g2(r,I.a)})}}return out}
function loadF(reload,force){if(!LOADF||reload)LOADF=(async()=>{try{const j=await GL_API.geral(!!force,!!reload);const sig=j.dados.arquivos.map(a=>a.arquivo+':'+a.linhas).join('|');if(sig!==SIGF||!ROWSF){ROWSF=buildF(j.dados);SIGF=sig}LOADF_EM=Date.now();const [dd,hh='']=String(j.atualizadoEm).split('T');UPDF=dd.split('-').reverse().join('/')+(hh?' às '+hh.slice(0,5):'')}catch(e){console.warn('geral',e);if(!ROWSF)ROWSF=[];LOADF=null}})();return LOADF}
document.addEventListener('click',e=>{const b=e.target.closest('[data-glref]');if(!b||b.disabled)return;b.disabled=true;b.textContent='Atualizando…';const fim=()=>{if(b.isConnected){b.disabled=false;b.textContent='↻ Atualizar'}};
if(CUR==='forecast'){const s0=SIGF,g=GEN;loadF(true,true).then(()=>{if(!vivo(g))return;if(SIGF!==s0)VIEWS.forecast();else toast('Os dados já estão atualizados')}).finally(fim);return}
REFRESH=true;GL_API.verificar().finally(fim)});
const nm=m=>{m=String(m||'');const i=m.indexOf(' - ');return i>0?m.slice(i+3):m};
const keyD=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const today=()=>keyD(new Date());
const lblD=k=>k.split('-').reverse().slice(0,2).join('/');
function periodUI(id,modes,def){const t=def||today(),mo=t.slice(0,7),q=+t.slice(8)<=15?1:2;
return `<div class="per" id="${id}"><select class="pm" aria-label="Período">${modes.map(m=>`<option value="${m}">${({dia:'Dia',semana:'Semana',quinzena:'Quinzena',mes:'Mês',periodo:'Período (de/até)'})[m]}</option>`).join('')}</select>
<input type="date" class="pd" value="${t}" aria-label="Data"><input type="month" class="pmo" value="${mo}" hidden aria-label="Mês"><select class="pq" hidden aria-label="Quinzena"><option value="1"${q===1?' selected':''}>1ª quinzena (1 a 15)</option><option value="2"${q===2?' selected':''}>2ª quinzena (16 ao fim)</option></select>${modes.includes('periodo')?`<input type="hidden" class="pa" value="${t}"><input type="hidden" class="pb" value="${t}"><button type="button" class="prb" hidden>${lblD(t)} – ${lblD(t)}</button>`:''}</div>`}
// Calendário de período: 1º clique = início, 2º clique = fim; ao fechar o intervalo, aplica o filtro.
document.addEventListener('click',e=>{const b=e.target.closest('.prb');const pop=$('.cal-pop');
if(pop&&!e.target.closest('.cal-pop')&&!b){pop.remove();return}if(!b)return;if(pop){pop.remove();return}
const per=b.closest('.per'),pa=$('.pa',per),pb=$('.pb',per);let ini=null,view=pa.value.slice(0,7);
const c=document.createElement('div');c.className='cal-pop';per.appendChild(c);
const draw=()=>{const [Y,M]=view.split('-').map(Number);const f=new Date(Y,M-1,1),n=new Date(Y,M,0).getDate(),off=(f.getDay()+6)%7;
const a=ini||pa.value,z=ini||pb.value;let h=`<div class="cal-h"><button type="button" data-cm="-1" aria-label="Mês anterior">‹</button><b>${(s=>s[0].toUpperCase()+s.slice(1))(f.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}))}</b><button type="button" data-cm="1" aria-label="Próximo mês">›</button></div><div class="cal-g">${['S','T','Q','Q','S','S','D'].map(x=>`<i>${x}</i>`).join('')}${'<span></span>'.repeat(off)}`;
for(let d=1;d<=n;d++){const k=view+'-'+String(d).padStart(2,'0');h+=`<button type="button" data-cd="${k}" class="${k===a||k===z?'sel':k>a&&k<z?'in':''}">${d}</button>`}
c.innerHTML=h+`</div><p class="cal-t">${ini?'Agora clique no dia final':'Clique no dia inicial'}</p>`};draw();
c.onclick=ev=>{ev.stopPropagation();const m=ev.target.closest('[data-cm]'),d=ev.target.closest('[data-cd]');
if(m){const [Y,M]=view.split('-').map(Number);const x=new Date(Y,M-1+ +m.dataset.cm,1);view=keyD(x).slice(0,7);draw();return}
if(!d)return;const k=d.dataset.cd;if(!ini){ini=k;draw();return}
const [x,y]=k<ini?[k,ini]:[ini,k];pa.value=x;pb.value=y;c.remove();$('.pm',per).dispatchEvent(new Event('change'))}});
function periodRange(el){const m=$('.pm',el).value;const d=$('.pd',el),mo=$('.pmo',el),q=$('.pq',el);
d.hidden=!(m==='dia'||m==='semana');const pr=$('.prb',el);if(pr)pr.hidden=m!=='periodo';
if(m==='periodo'){const a=$('.pa',el).value,b=$('.pb',el).value;pr.textContent=lblD(a)+' – '+lblD(b)+' ▾';return [a,b,a===b?'Dia '+lblD(a):'De '+lblD(a)+' a '+lblD(b)]}mo.hidden=!(m==='mes'||m==='quinzena');q.hidden=m!=='quinzena';
if(m==='dia')return [d.value,d.value,'Dia '+lblD(d.value)];
if(m==='semana'){const x=new Date(d.value+'T12:00');const w=(x.getDay()+6)%7;x.setDate(x.getDate()-w);const a=keyD(x);x.setDate(x.getDate()+6);const b=keyD(x);return [a,b,'Semana de '+lblD(a)+' a '+lblD(b)]}
const [Y,Mn]=mo.value.split('-').map(Number);const last=new Date(Y,Mn,0).getDate();const ML=new Date(Y,Mn-1,1).toLocaleDateString('pt-BR',{month:'long'});
if(m==='mes')return [mo.value+'-01',mo.value+'-'+last,ML+' de '+Y];
return q.value==='1'?[mo.value+'-01',mo.value+'-15','1ª quinzena de '+ML]:[mo.value+'-16',mo.value+'-'+last,'2ª quinzena de '+ML]}
const opts=(arr,all)=>`<option value="">${all}</option>`+[...new Set(arr)].sort().map(x=>`<option>${esc(x)}</option>`).join('');
function hbars(list,max,fmt=N){max=max||Math.max(1,...list.map(x=>x[1]));return '<div class="hb">'+list.map(([l,v])=>`<div class="hbr"><span class="hbl" title="${esc(l)}">${esc(l)}</span><span class="hbt"><i style="width:${Math.max(2,v/max*100)}%"></i></span><b>${fmt(v)}</b></div>`).join('')+'</div>'}
function vbars(list){const max=Math.max(1,...list.map(x=>x[1]));const sm=list.length>16;return `<div class="vb${sm?' sm':''}">`+list.map(([l,v],i)=>`<div class="vbc${i===list.length-1?' hot':''}" title="${esc(l)}: ${N(v)}"><em>${sm&&v>=1000?(v/1000).toFixed(1).replace('.',',')+'k':N(v)}</em><i style="height:${Math.max(3,v/max*100)}%"></i><span>${esc(l)}</span></div>`).join('')+'</div>'}
const group=(arr,f,val)=>{const m=new Map();for(const r of arr){const k=f(r);m.set(k,(m.get(k)||0)+val(r))}return [...m]};
const VIEWS={};
// Visão geral: um dia escolhido (padrão = mais recente) + histórico diário. Conta só o que a GETLOG coletou.
let DASH_DIA='',DASH_N=7;
// Coletado por hora do dia: base de coletados (bip a bip) quando existe; senão, horário de cada linha da Performance.
const porHoraHtml=hs=>{const ix=hs.map((v,i)=>v?i:-1).filter(i=>i>=0);if(!ix.length)return '<p class="empty">Sem horário registrado.</p>';
const a=ix[0],b=ix.at(-1);const L=[];for(let i=a;i<=b;i++)L.push([String(i).padStart(2,'0')+'h',hs[i]]);const pico=L.reduce((m,x)=>x[1]>m[1]?x:m);
return vbars(L)+`<p class="ch-t" style="margin-top:8px">Pico: <b>${pico[0]}</b> com ${N(pico[1])} pacotes · total ${N(hs.reduce((x,y)=>x+y,0))}</p>`};
// Barras agrupadas: pacotes e sellers no mesmo gráfico (cada série na sua própria escala, com o número em cima).
function gbars(list,na,nb){const ma=Math.max(1,...list.map(x=>x[1])),mb=Math.max(1,...list.map(x=>x[2]));const sm=list.length>12;const k=v=>v>=10000||(sm&&v>=1000)?(v/1000).toFixed(1).replace('.',',')+' mil':N(v);
return `<div class="gb-leg"><span><i class="ga"></i>${na}</span><span><i class="gbb"></i>${nb}</span></div><div class="gb${sm?' sm':''}">`+list.map(([l,a,b])=>`<div class="gbc" title="${esc(l)}: ${N(a)} ${na.toLowerCase()} · ${N(b)} ${nb.toLowerCase()}"><div class="gbp"><div><em>${k(a)}</em><i class="ga" style="height:${Math.max(2,a/ma*100)}%"></i></div><div><em>${k(b)}</em><i class="gbb" style="height:${Math.max(2,b/mb*100)}%"></i></div></div><span>${esc(l)}</span></div>`).join('')+'</div>'}
// Visão geral: um dia, um período (últimos 7/15/30 dias) ou geral (todos os dias), sempre comparando com o período anterior de mesmo tamanho.
VIEWS.dash=()=>{const R=rows();if(!R.length){M().innerHTML=top('Visão geral da operação','Acompanhamento diário da GETLOG',true)+vazio('Os dados ainda não foram publicados ou não foi possível carregá-los agora. A tela atualiza sozinha quando a próxima atualização entrar.');return}
const D=new Map();for(const r of R){if(!(r.t>0))continue;let o=D.get(r.d);if(!o)D.set(r.d,o={d:r.d,t:0,s:new Set(),c:new Set(),m:new Set(),rows:[]});o.t+=r.t;o.s.add(sk(r));o.c.add(r.c);if(r.m)o.m.add(r.m);o.rows.push(r)}
const dates=[...D.keys()].sort();if(!dates.length){M().innerHTML=top('Visão geral da operação','Acompanhamento diário da GETLOG',true)+vazio('Ainda não há coletas da GETLOG nos dados publicados.');return}
const PER={p7:7,p15:15,p30:30,geral:dates.length};if(!(DASH_DIA in PER)&&!D.has(DASH_DIA))DASH_DIA=dates.at(-1);
const per=DASH_DIA in PER,n=per?Math.min(PER[DASH_DIA],dates.length):1,fim=per?dates.length:dates.indexOf(DASH_DIA)+1;
const sel=dates.slice(fim-n,fim),antes=dates.slice(Math.max(0,fim-2*n),fim-n);
const junta=ks=>{const o={t:0,s:new Set(),c:new Set(),m:new Set(),rows:[],n:ks.length};for(const k of ks){const x=D.get(k);o.t+=x.t;x.s.forEach(v=>o.s.add(k+'|'+v));x.c.forEach(v=>o.c.add(v));x.m.forEach(v=>o.m.add(v));o.rows.push(...x.rows)}o.su=new Set([...o.s].map(v=>v.slice(11))).size;o.sd=o.s.size;return o};
const o=junta(sel),ant=antes.length===n?junta(antes):null;const t=sel.at(-1);
const nomeSel=per?(DASH_DIA==='geral'?`Geral · ${lblD(sel[0])} a ${lblD(t)} (${n} dias)`:`${lblD(sel[0])} a ${lblD(t)} (${n} dias)`):lblD(t);
const nomeAnt=ant?(per?`${lblD(antes[0])} a ${lblD(antes.at(-1))}`:lblD(antes[0])):'';
const vr=(x,y)=>{if(y==null)return `<span>${per&&DASH_DIA==='geral'?'Todos os dias publicados':'Sem período anterior para comparar'}</span>`;if(!y)return '<span>—</span>';const v=(x-y)/y*100;return `<span class="${v>=0?'up':'down'}">${v>=0?'+':''}${v.toFixed(1).replace('.',',')}% vs ${esc(nomeAnt)}</span>`};
const dsem=k=>['dom','seg','ter','qua','qui','sex','sáb'][new Date(k+'T12:00').getDay()];
const hs=new Array(24).fill(0);let base=true;for(const k of sel){const h=HORAS.get(k);if(h)h.forEach((v,i)=>hs[i]+=v);else{base=false;for(const r of D.get(k).rows)if(r.h!=null)hs[Math.min(23,Math.floor(r.h/60))]+=r.t}}
M().innerHTML=top('Visão geral da operação','Acompanhamento da GETLOG · escolha um dia, um período ou o geral',true)+`
<div class="filters"><select id="dd" aria-label="Período"><optgroup label="Períodos"><option value="geral"${DASH_DIA==='geral'?' selected':''}>Geral (todos os dias)</option>${[['p7','Últimos 7 dias'],['p15','Últimos 15 dias'],['p30','Últimos 30 dias']].map(([v,l])=>`<option value="${v}"${DASH_DIA===v?' selected':''}>${l}</option>`).join('')}</optgroup><optgroup label="Um dia">${[...dates].reverse().map(k=>`<option value="${k}"${!per&&k===t?' selected':''}>${lblD(k)} ${dsem(k)}${k===dates.at(-1)?' · mais recente':''}</option>`).join('')}</optgroup></select></div>
<div class="kpi-grid"><div class="kpi"><small>Pacotes coletados${per?'':t===dates.at(-1)?' hoje':' no dia'}</small><b>${N(o.t)}</b>${vr(o.t,ant?.t)}</div>
<div class="kpi"><small>Sellers atendidos${per?' (soma dos dias)':''}</small><b>${N(o.sd)}</b>${per?`<span>${N(o.su)} sellers diferentes · média ${N(Math.round(o.sd/n))}/dia</span>`:vr(o.sd,ant?.sd)}</div>
<div class="kpi"><small>${per?'Média por dia':'Clientes em operação'}</small><b>${per?N(Math.round(o.t/n)):o.c.size}</b>${per?vr(o.t/n,ant?ant.t/n:null):`<span>Com coleta em ${esc(lblD(t))}</span>`}</div>
<div class="kpi"><small>Motoristas${per?' no período':' em rota'}</small><b>${o.m.size}</b>${vr(o.m.size,ant?.m.size)}</div></div>
<div class="box mt"><div class="box-head"><div><h3>Coletado por hora</h3><p>${per?'Soma de todos os dias do período':'Pacotes bipados em cada hora'} · ${esc(nomeSel)}${base?' · base de coletados':' · pelo horário registrado na Performance'}</p></div></div>${porHoraHtml(hs)}</div>
<div class="box mt"><div class="box-head"><div><h3>Histórico por dia</h3><p>Pacotes coletados e sellers atendidos · clique numa barra para ver o dia</p></div><div class="seg" id="seg">${[7,15,30].map(n=>`<button data-n="${n}" aria-pressed="${n===DASH_N}">${n} dias</button>`).join('')}</div></div><div id="dch"></div></div>
<div class="grid-2"><div class="box"><div class="box-head"><div><h3>Por cliente</h3><p>Pacotes coletados · ${esc(nomeSel)}</p></div></div>${hbars(group(o.rows,r=>r.c,r=>r.t).sort((a,b)=>b[1]-a[1]))}</div>
<div class="box"><div class="box-head"><div><h3>Por região</h3><p>Pacotes coletados · ${esc(nomeSel)}</p></div></div>${hbars(group(o.rows,r=>r.r,r=>r.t).sort((a,b)=>b[1]-a[1]))}</div></div>
<div class="grid-2 eq"><div class="box"><div class="box-head"><div><h3>Resumo dos últimos dias</h3><p>Totais por dia · clique para ver o dia</p></div></div><div class="table-wrap"><table><thead><tr><th>Dia</th><th class="n">Pacotes</th><th class="n">Sellers</th><th class="n">Motoristas</th><th class="n">Clientes</th></tr></thead><tbody>${[...dates].reverse().slice(0,10).map(k=>{const x=D.get(k);return `<tr class="clk-row${sel.includes(k)?' on':''}" data-dd="${k}"><td><b>${esc(lblD(k))}</b> <small>${dsem(k)}</small></td><td class="n">${N(x.t)}</td><td class="n">${N(x.s.size)}</td><td class="n">${x.m.size}</td><td class="n">${x.c.size}</td></tr>`}).join('')}</tbody></table></div></div>
<div class="box"><div class="box-head"><div><h3>Avisos recentes</h3><p>Comunicados para você</p></div><button class="btn btn-ghost btn-sm" data-go="avisos">Ver todos</button></div><div class="news">${myAvisos().slice(0,3).map(avHTML).join('')||'<p class="empty">Nenhum aviso no momento.</p>'}</div></div></div>`;
const draw=n=>{DASH_N=n;const ks=dates.slice(-n);$('#dch').innerHTML=gbars(ks.map(k=>[lblD(k),D.get(k).t,D.get(k).s.size]),'Pacotes coletados','Sellers atendidos');
$$('#dch .gbc').forEach((el,i)=>{el.classList.toggle('hot',sel.includes(ks[i]));el.onclick=()=>{DASH_DIA=ks[i];VIEWS.dash()}})};draw(DASH_N);
$$('#seg button').forEach(b=>b.onclick=()=>{$$('#seg button').forEach(x=>x.setAttribute('aria-pressed',x===b));draw(+b.dataset.n)});
$('#dd').onchange=e=>{DASH_DIA=e.target.value;VIEWS.dash()};$$('[data-dd]').forEach(r=>r.onclick=()=>{DASH_DIA=r.dataset.dd;VIEWS.dash()});
$$('[data-go]').forEach(b=>b.onclick=()=>show(b.dataset.go))};
// Pacotes coletados: as mesmas linhas da Performance, só o que a GETLOG coletou (Coletado total com motorista oficial GET).
// Ajudante recebe da camada de dados apenas as linhas em que está vinculado.
const CF={};
const sellerTxt=(s,id)=>id?s+' | '+id:s;
VIEWS.coletados=()=>{const R=rows();const own=!C.veTudo(ME.role);const ult=[...R].reverse().find(r=>r.t>0)?.d;
M().innerHTML=top(own?'Meus pacotes coletados':'Pacotes coletados',own?'Somente as coletas em que você participou':'Pacotes coletados pela GETLOG · mesma base da Performance',true)+(!R.length?vazio('Os dados ainda não foram publicados ou não foi possível carregá-los agora. A tela atualiza sozinha quando a próxima atualização entrar.'):`${C.veTudo(ME.role)?`<p class="top-link"><a class="btn btn-ghost btn-sm" href="${GL_API.PASTA_COLETADOS}" target="_blank" rel="noopener">Pasta dos arquivos coletados</a></p>`:''}
<div class="filters">${periodUI('per',['dia','periodo','semana','quinzena','mes'],ult)}${own?'':`<select id="fm" aria-label="Motorista">${opts(R.filter(r=>r.t>0).map(r=>nm(r.m)),'Todos os motoristas')}</select>`}
<select id="fr" aria-label="Região">${opts(R.filter(r=>r.t>0).map(r=>r.r),'Todas as regiões')}</select><input id="fs" type="search" placeholder="Buscar seller (nome ou ID)" aria-label="Buscar seller por nome ou ID" autocomplete="off"></div><div id="cout"></div>`);
if(!R.length)return;
// Filtros guardados para sobreviver a atualizações automáticas dos dados.
const CFK=['#per .pm','#per .pd','#per .pmo','#per .pq','#per .pa','#per .pb','#fm','#fr','#fs'];
for(const id of CFK){const el=$(id),v=CF[id];if(el&&v!=null&&(!el.options||[...el.options].some(o=>o.value===v)))el.value=v}
const run=()=>{const [a,b,lbl]=periodRange($('#per'));const fm=own?'':$('#fm').value,fr=$('#fr').value,fs=C.nk($('#fs').value);
for(const id of CFK){const el=$(id);if(el)CF[id]=el.value}
const f=R.filter(r=>r.t>0&&r.d>=a&&r.d<=b&&(!fm||nm(r.m)===fm)&&(!fr||r.r===fr)&&(!fs||C.nk(r.s+' '+r.sid).includes(fs)));
const tot=f.reduce((x,r)=>x+r.t,0);const days=[...new Set(f.map(r=>r.d))];
const sel=group(f,r=>[r.s,r.sid,r.c,r.r,nm(r.m)].join('|'),r=>r.t).sort((a,b)=>b[1]-a[1]);
$('#cout').innerHTML=`<div class="kpi-grid"><div class="kpi"><small>Pacotes coletados</small><b>${N(tot)}</b><span>${esc(lbl)}</span></div><div class="kpi"><small>Dias com coleta</small><b>${days.length}</b><span>No período</span></div><div class="kpi"><small>Média por dia</small><b>${N(Math.round(tot/Math.max(1,days.length)))}</b><span>Pacotes</span></div><div class="kpi"><small>Sellers atendidos</small><b>${N(new Set(f.map(sk)).size)}</b><span>No período</span></div></div>
${days.length?`<div class="box mt"><div class="box-head"><div><h3>Pacotes e sellers coletados por dia</h3><p>${esc(lbl)}</p></div></div>${gbars([...f.reduce((m,r)=>{const k=lblD(r.d);let o=m.get(k);if(!o)m.set(k,o={t:0,s:new Set()});o.t+=r.t;o.s.add(sk(r));return m},new Map())].map(([k,o])=>[k,o.t,o.s.size]),'Pacotes coletados','Sellers coletados')}</div>
<div class="grid-2 eq">${own?'':`<div class="box"><div class="box-head"><div><h3>Ranking de motoristas</h3><p>Top 10 no período</p></div></div>${hbars(group(f,r=>nm(r.m),r=>r.t).sort((a,b)=>b[1]-a[1]).slice(0,10))}</div>`}
<div class="box"><div class="box-head"><div><h3>Top sellers</h3><p>Top 10 no período</p></div></div>${hbars(group(f,r=>sellerTxt(r.s,r.sid),r=>r.t).sort((a,b)=>b[1]-a[1]).slice(0,10))}</div>
<div class="box"><div class="box-head"><div><h3>Por região</h3><p>Pacotes coletados</p></div></div>${hbars(group(f,r=>r.r,r=>r.t).sort((a,b)=>b[1]-a[1]))}</div>
<div class="box"><div class="box-head"><div><h3>Por cliente</h3><p>Pacotes coletados</p></div></div>${hbars(group(f,r=>r.c,r=>r.t).sort((a,b)=>b[1]-a[1]))}</div></div>
<div class="box mt"><div class="box-head"><div><h3>Detalhe por seller</h3><p>${N(sel.length)} linhas${sel.length>200?' · mostrando as 200 maiores (use a busca para achar outras)':''}</p></div></div><div class="table-wrap"><table><thead><tr><th>Seller</th><th>Seller ID</th><th>Cliente</th><th>Região</th>${own?'':'<th>Motorista</th>'}<th class="n">Pacotes</th></tr></thead><tbody>${sel.slice(0,200).map(([k,v])=>{const [s,id,c,r,m]=k.split('|');return `<tr><td>${esc(s)}</td><td>${esc(id||'—')}</td><td>${esc(c)}</td><td>${esc(r)}</td>${own?'':`<td>${esc(m)}</td>`}<td class="n">${N(v)}</td></tr>`}).join('')}</tbody></table></div></div>`:vazio('Nenhuma coleta encontrada para esse filtro. Troque o período ou limpe os filtros.')}`};
$$('#per select,#per input,#fm,#fr').forEach(e=>e&&e.addEventListener('change',run));let tm;$('#fs').addEventListener('input',()=>{clearTimeout(tm);tm=setTimeout(run,180)});run()};
// Quem trabalhou: motoristas GETLOG (GET - ...) que bipararam no período, com 1º e último bip (coluna HORA) e tempo de trabalho.
// Jornada do dia = último bip − primeiro bip. Base para o Financeiro.
function jornadas(a,b,fr){const P=new Map();for(const r of rows()){if(!(r.t>0)||!r.m||/HUB NUVEM ENVIO/i.test(r.m)||r.d<a||r.d>b||(fr&&r.r!==fr))continue;const k=nm(r.m);let x=P.get(k);if(!x)P.set(k,x={m:k,ajd:new Map(),aj:new Set(),dias:new Map(),s:new Set(),rg:new Set(),t:0});
if(r.a&&!/^(n[aã]o|sim|-|0)$/i.test(r.a)){x.aj.add(r.a);let q=x.ajd.get(r.a);if(!q)x.ajd.set(r.a,q=new Set());q.add(r.d)}let d=x.dias.get(r.d);if(!d)x.dias.set(r.d,d={i:null,f:null,t:0});d.t+=r.t;if(r.h!=null){const f=r.hf??r.h;if(d.i==null||r.h<d.i)d.i=r.h;if(d.f==null||f>d.f)d.f=f}x.s.add(sk(r));x.rg.add(r.r);x.t+=r.t}
for(const x of P.values()){const D=[...x.dias.values()].filter(d=>d.i!=null);x.i=avg(D.map(d=>d.i));x.f=avg(D.map(d=>d.f));x.j=avg(D.map(d=>d.f-d.i));x.jt=D.reduce((s,d)=>s+d.f-d.i,0);x.ph=x.jt>=30?x.t/(x.jt/60):null}
return [...P.values()]}
const EF={};
VIEWS.equipe=()=>{const R=rows().filter(r=>r.t>0&&r.m);const ult=R[R.length-1]?.d;
M().innerHTML=top('Tempo de operação','Motoristas GETLOG em operação: do primeiro ao último bip · mesma base da Performance',true)+(!R.length?vazio('Os dados ainda não foram publicados ou não foi possível carregá-los agora.'):`<div class="filters">${periodUI('eper',['dia','periodo','semana','quinzena','mes'],ult)}<select id="er" aria-label="Região">${opts(R.map(r=>r.r),'Todas as regiões')}</select><input id="es" type="search" placeholder="Buscar motorista ou ajudante" aria-label="Buscar motorista ou ajudante" autocomplete="off"></div><div id="eout"></div>`);
if(!R.length)return;
const K=['#eper .pm','#eper .pd','#eper .pmo','#eper .pq','#eper .pa','#eper .pb','#er','#es'];
for(const id of K){const el=$(id),v=EF[id];if(el&&v!=null&&(!el.options||[...el.options].some(o=>o.value===v)))el.value=v}
const run=()=>{const [a,b,lbl]=periodRange($('#eper'));const fr=$('#er').value,fs=C.nk($('#es').value);for(const id of K){const el=$(id);if(el)EF[id]=el.value}
const L=jornadas(a,b,fr).filter(x=>!fs||C.nk(x.m+' '+[...x.aj].join(' ')).includes(fs)).sort((p,q)=>q.t-p.t);
const tot=L.reduce((s,x)=>s+x.t,0);const aj=new Set(L.flatMap(x=>[...x.aj]));const multi=b>a;const H=L.filter(x=>x.j!=null);
const ini=avg(H.map(x=>x.i)),fim=avg(H.map(x=>x.f)),jor=avg(H.map(x=>x.j)),ph=(()=>{const Q=H.filter(x=>x.ph);const m=Q.reduce((s,x)=>s+x.jt,0);return m?Q.reduce((s,x)=>s+x.t,0)/(m/60):null})();
const tot2=H.reduce((s,x)=>s+x.jt,0);
const dias=[...new Set(L.flatMap(x=>[...x.dias.keys()]))].sort();
$('#eout').onclick=e=>{const r=e.target.closest('[data-rd]');if(!r)return;const d=$(`[data-rdd="${r.dataset.rd}"]`);d.hidden=!d.hidden;r.setAttribute('aria-expanded',!d.hidden)};
const resumo=(()=>{const m=new Map();for(const r of rows()){if(r.d<a||r.d>b||(fr&&r.r!==fr))continue;let o=m.get(r.d);if(!o)m.set(r.d,o={d:r.d,p:0,c:0,t:0,mot:0,ii:[],jj:[],nomes:[]});o.p+=r.p||0;o.c+=r.cp||0;o.t+=r.t}
for(const x of L)for(const [d,v] of x.dias){const o=m.get(d);if(!o)continue;o.mot++;o.nomes.push([x.m,v]);if(v.i!=null){o.ii.push(v.i);o.jj.push(v.f-v.i)}}
return [...m.values()].filter(o=>o.p>0||o.t>0||o.mot>0).map(o=>({...o,i:avg(o.ii),j:avg(o.jj)})).sort((p,q)=>p.d<q.d?1:-1)})();
// Escala da linha do tempo: da hora cheia antes do 1º bip até a hora cheia depois do último.
const h0=H.length?Math.floor(Math.min(...H.map(x=>x.i))/60)*60:360,h1=H.length?Math.ceil(Math.max(...H.map(x=>x.f))/60)*60:1320,span=Math.max(60,h1-h0);
const pos=v=>((v-h0)/span*100).toFixed(2);const marks=[];for(let h=h0;h<=h1;h+=60)marks.push(h);
const flag=x=>x.j==null?'':x.j>=600?'<span class="tg tg-r">Jornada longa</span>':x.j<240?'<span class="tg tg-y">Jornada curta</span>':'<span class="tg tg-g">Normal</span>';
const reg=[...H.reduce((m,x)=>{for(const r of x.rg){const o=m.get(r)||{n:0,j:0,i:0,t:0};o.n++;o.j+=x.j;o.i+=x.i;o.t+=x.t;m.set(r,o)}return m},new Map())].sort((p,q)=>q[1].n-p[1].n);
$('#eout').innerHTML=`<div class="kpi-grid"><div class="kpi"><small>Motoristas em operação</small><b>${L.length}</b><span>${esc(lbl)}${aj.size?` · ${aj.size} ajudante${aj.size>1?'s':''}`:''}</span></div><div class="kpi"><small>Tempo médio de operação</small><b>${dur(jor)}</b><span>Do 1º ao último bip · ${dur(tot2||null)} no total</span></div><div class="kpi"><small>Início médio (1º bip)</small><b>${hhmm(ini)}</b><span>Último bip em média: ${hhmm(fim)}</span></div><div class="kpi"><small>Pacotes por hora</small><b>${ph?N(Math.round(ph)):'—'}</b><span>${N(tot)} pacotes no período</span></div></div>
${L.length&&!H.length?`<p class="msg">Este período não trouxe o horário dos bips (coluna HORA). Os horários aparecem assim que a planilha vier com eles.</p>`:''}
${resumo.length?`<div class="box mt"><div class="box-head"><div><h3>Resumo por dia</h3><p>Previsto, coletado e quantas pessoas trabalharam · clique no dia para ver os motoristas</p></div></div><div class="table-wrap"><table><thead><tr><th>Dia</th><th class="n">Motoristas</th><th class="n">Previsto</th><th class="n">Coletado do previsto</th><th class="n">%</th><th class="n">Coletado GETLOG</th><th class="n">Início médio</th><th class="n">Tempo médio</th></tr></thead><tbody>${resumo.map(o=>`<tr class="rd-row" data-rd="${o.d}" tabindex="0" aria-expanded="false"><td><span class="rd-car" aria-hidden="true"></span><b>${esc(lblD(o.d))}</b> <small>${['dom','seg','ter','qua','qui','sex','sáb'][new Date(o.d+'T12:00').getDay()]}</small></td><td class="n"><b>${o.mot}</b></td><td class="n">${N(o.p)}</td><td class="n">${N(o.c)}</td><td class="n">${o.p?(o.c/o.p*100).toFixed(1).replace('.',',')+'%':'—'}</td><td class="n">${N(o.t)}</td><td class="n">${hhmm(o.i)}</td><td class="n">${dur(o.j)}</td></tr><tr class="rd-det" data-rdd="${o.d}" hidden><td colspan="8"><div class="rd-list">${o.nomes.sort((p,q)=>p[0].localeCompare(q[0],'pt-BR')).map(([n,v],i)=>`<div><em>${i+1}</em><span title="${esc(n)}">${esc(n)}</span><small>${v.i!=null?`${hhmm(v.i)}–${hhmm(v.f)}`:'—'}</small></div>`).join('')}</div></td></tr>`).join('')}</tbody></table></div></div>`:''}
${H.length?`<div class="box mt"><div class="box-head"><div><h3>Linha do tempo da operação</h3><p>Cada barra vai do 1º ao último bip do motorista${multi?' (média por dia)':''} · ordenado por quem começou primeiro</p></div></div>
<div class="gantt"><div class="g-axis"><span></span><div>${marks.map(h=>`<i style="left:${pos(h)}%">${hhmm(h)}</i>`).join('')}</div></div>${[...H].sort((p,q)=>p.i-q.i).map(x=>`<div class="g-row"><span title="${esc(x.m)}">${esc(x.m)}</span><div><b class="${x.j>=600?'lg':x.j<240?'ct':''}" style="left:${pos(x.i)}%;width:${Math.max(.8,x.j/span*100).toFixed(2)}%" title="${hhmm(x.i)} – ${hhmm(x.f)} · ${dur(x.j)}"></b><em style="left:calc(${pos(x.f)}% + 6px)">${dur(x.j)}</em></div></div>`).join('')}</div>
<p class="g-leg"><i class="ok"></i>Normal <i class="ct"></i>Menos de 4h <i class="lg"></i>10h ou mais</p></div>`:''}
${L.length&&dias.length>1?`<div class="box mt"><div class="box-head"><div><h3>Dias trabalhados por motorista</h3><p>Tempo de operação de cada dia (do 1º ao último bip) · ✓ = trabalhou sem horário registrado</p></div></div><div class="table-wrap"><table class="mx"><thead><tr><th>Motorista</th><th class="n">Dias</th>${dias.map(d=>`<th class="n">${esc(lblD(d))}</th>`).join('')}</tr></thead><tbody>${[...L].sort((p,q)=>q.dias.size-p.dias.size||p.m.localeCompare(q.m)).map(x=>`<tr><td>${esc(x.m)}</td><td class="n"><b>${x.dias.size}</b></td>${dias.map(d=>{const v=x.dias.get(d);return `<td class="n">${!v?'<span class="mx-0">—</span>':v.i!=null?`<span class="mx-1">${dur(v.f-v.i)}</span>`:'<span class="mx-1">✓</span>'}</td>`}).join('')}</tr>`).join('')}</tbody></table></div></div>`:''}
${L.length?`<div class="box mt"><div class="box-head"><div><h3>Detalhe por motorista</h3><p>${esc(lbl)}${multi?' · horários são médias por dia trabalhado':''}</p></div></div><div class="table-wrap"><table><thead><tr><th>Motorista</th><th>Ajudante</th>${multi?'<th class="n">Dias</th>':''}<th class="n">1º bip</th><th class="n">Último bip</th><th class="n">Tempo${multi?' médio':''}</th>${multi?'<th class="n">Horas no total</th>':''}<th class="n">Sellers</th><th class="n">Pacotes</th><th class="n">Pac./hora</th><th>Situação</th></tr></thead><tbody>${L.map(x=>`<tr><td>${esc(x.m)}</td><td>${esc([...x.aj].join(', ')||'—')}</td>${multi?`<td class="n">${x.dias.size}</td>`:''}<td class="n">${hhmm(x.i)}</td><td class="n">${hhmm(x.f)}</td><td class="n"><b>${dur(x.j)}</b></td>${multi?`<td class="n">${dur(x.jt||null)}</td>`:''}<td class="n">${N(x.s.size)}</td><td class="n">${N(x.t)}</td><td class="n">${x.ph?N(Math.round(x.ph)):'—'}</td><td>${flag(x)}</td></tr>`).join('')}</tbody></table></div></div>
${H.length?`<div class="grid-2 eq"><div class="box"><div class="box-head"><div><h3>Mais produtivos</h3><p>Pacotes por hora de operação</p></div></div>${hbars(H.filter(x=>x.ph).sort((p,q)=>q.ph-p.ph).slice(0,10).map(x=>[x.m,Math.round(x.ph)]))}</div>
<div class="box"><div class="box-head"><div><h3>Por região</h3><p>Motoristas, início e tempo médio</p></div></div><div class="table-wrap"><table><thead><tr><th>Região</th><th class="n">Mot.</th><th class="n">Início</th><th class="n">Tempo</th></tr></thead><tbody>${reg.map(([r,o])=>`<tr><td>${esc(r)}</td><td class="n">${o.n}</td><td class="n">${hhmm(o.i/o.n)}</td><td class="n">${dur(o.j/o.n)}</td></tr>`).join('')}</tbody></table></div></div></div>`:''}`:vazio('Ninguém com coleta nesse filtro. Troque o período ou limpe os filtros.')}`};
$$('#eper select,#eper input,#er').forEach(e=>e&&e.addEventListener('change',run));let tm;$('#es').addEventListener('input',()=>{clearTimeout(tm);tm=setTimeout(run,180)});run()};
// Financeiro (admin): quanto pagar a cada motorista no período = diárias + pacotes + ajudante + bônus − vales/descontos.
// Base: os mesmos dias/pacotes de "Quem trabalhou". Valores e lançamentos ficam em data/financeiro.json (criptografado).
const BRL=v=>(+v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const finD=()=>FIN||(FIN={diaria:0,pacote:0,ajud:0,mot:{},lanc:[]});
const valor=x=>+String(x||'').replace(/\./g,'').replace(',','.')||0;
const LTIPO={bonus:'Bônus / extra',vale:'Vale / adiantamento',desc:'Desconto'};
const FF={};
VIEWS.financeiro=()=>{const F=finD();const R=rows().filter(r=>r.t>0&&r.m);const ult=R[R.length-1]?.d;const mots=[...new Set(R.map(r=>nm(r.m)))].sort();
M().innerHTML=top('Financeiro','Quanto pagar a cada motorista e ajudante no período · em desenvolvimento',true)+`<div class="filters">${periodUI('fper',['semana','quinzena','mes','dia'],ult)}<input id="fsr" type="search" placeholder="Buscar motorista" aria-label="Buscar motorista" autocomplete="off"><button class="btn btn-ghost btn-sm" type="button" id="fcsv">Baixar planilha</button></div><div id="fout"></div>
<div class="grid-2 eq"><div class="box"><div class="box-head"><div><h3>Valores de pagamento</h3><p>Padrão para todos. Use a regra por motorista para quem tem valor diferente.</p></div></div>
<form id="fpad" class="form"><label>Diária do motorista (R$)<input id="f-d" inputmode="decimal" value="${F.diaria||''}" placeholder="0,00"></label><label>Valor por pacote (R$)<input id="f-p" inputmode="decimal" value="${F.pacote||''}" placeholder="0,00"></label><label>Diária do ajudante (R$)<input id="f-a" inputmode="decimal" value="${F.ajud||''}" placeholder="0,00"></label><button class="btn btn-primary">Salvar valores</button></form>
<form id="fmot" class="form mt"><label>Motorista<select id="fm-m">${mots.map(m=>`<option>${esc(m)}</option>`).join('')}</select></label><label>Diária (R$)<input id="fm-d" inputmode="decimal" placeholder="padrão"></label><label>Por pacote (R$)<input id="fm-p" inputmode="decimal" placeholder="padrão"></label><button class="btn btn-ghost">Salvar regra do motorista</button></form>
${Object.keys(F.mot).length?`<div class="table-wrap mt"><table><thead><tr><th>Regra própria</th><th class="n">Diária</th><th class="n">Pacote</th><th></th></tr></thead><tbody>${Object.entries(F.mot).map(([m,v])=>`<tr><td>${esc(m)}</td><td class="n">${v.diaria!=null?BRL(v.diaria):'padrão'}</td><td class="n">${v.pacote!=null?BRL(v.pacote):'padrão'}</td><td><button class="btn btn-ghost btn-sm" data-fdm="${esc(m)}">Remover</button></td></tr>`).join('')}</tbody></table></div>`:''}</div>
<div class="box"><div class="box-head"><div><h3>Lançamentos</h3><p>Bônus, vales/adiantamentos e descontos entram no período da data.</p></div></div>
<form id="flan" class="form"><label>Motorista<select id="fl-m">${mots.map(m=>`<option>${esc(m)}</option>`).join('')}</select></label><label>Tipo<select id="fl-t">${Object.entries(LTIPO).map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}</select></label><label>Data<input id="fl-d" type="date" value="${ult||today()}" required></label><label>Valor (R$)<input id="fl-v" inputmode="decimal" required placeholder="0,00"></label><label>Observação<input id="fl-o" maxlength="80"></label><button class="btn btn-primary">Lançar</button></form><div id="flist"></div></div></div><p class="msg" id="u-msg"></p>`;
const K=['#fper .pm','#fper .pd','#fper .pmo','#fper .pq','#fsr'];for(const id of K){const el=$(id),v=FF[id];if(el&&v!=null&&(!el.options||[...el.options].some(o=>o.value===v)))el.value=v}
let LIN=[];
const run=()=>{const [a,b,lbl]=periodRange($('#fper'));const fs=C.nk($('#fsr').value);for(const id of K){const el=$(id);if(el)FF[id]=el.value}
const J=jornadas(a,b);const lan=F.lanc.filter(l=>l.data>=a&&l.data<=b);const nomes=new Set([...J.map(x=>x.m),...lan.map(l=>l.mot)]);
LIN=[...nomes].map(m=>{const x=J.find(y=>y.m===m)||{dias:new Map(),t:0,ajd:new Map()};const rg=F.mot[m]||{};const di=rg.diaria??F.diaria,pc=rg.pacote??F.pacote;
const ajDias=new Set([...x.ajd.values()].flatMap(q=>[...q])).size;const L=lan.filter(l=>l.mot===m);const sm=t=>L.filter(l=>l.tipo===t).reduce((s,l)=>s+l.valor,0);
const o={m,dias:x.dias.size,t:x.t,vd:x.dias.size*di,vp:x.t*pc,va:ajDias*F.ajud,ajDias,bo:sm('bonus'),de:sm('vale')+sm('desc')};o.tot=o.vd+o.vp+o.va+o.bo-o.de;return o}).filter(o=>!fs||C.nk(o.m).includes(fs)).sort((p,q)=>q.tot-p.tot);
const T=k=>LIN.reduce((s,o)=>s+o[k],0);const AJ=new Map();for(const x of J)for(const [n,q] of x.ajd){AJ.set(n,new Set([...(AJ.get(n)||[]),...q]))}
const semValor=!F.diaria&&!F.pacote&&!Object.keys(F.mot).length;
$('#fout').innerHTML=`${semValor?'<p class="msg err">Defina os valores de pagamento abaixo para calcular os totais.</p>':''}<div class="kpi-grid"><div class="kpi"><small>Total a pagar</small><b>${BRL(T('tot'))}</b><span>${esc(lbl)}</span></div><div class="kpi"><small>Motoristas</small><b>${LIN.length}</b><span>${N(T('dias'))} diárias</span></div><div class="kpi"><small>Pacotes</small><b>${N(T('t'))}</b><span>${BRL(T('vp'))} por pacote</span></div><div class="kpi"><small>Vales e descontos</small><b>${BRL(T('de'))}</b><span>Bônus: ${BRL(T('bo'))}</span></div></div>
${LIN.length?`<div class="box mt"><div class="box-head"><div><h3>A pagar por motorista</h3><p>${esc(lbl)}</p></div></div><div class="table-wrap"><table><thead><tr><th>Motorista</th><th class="n">Dias</th><th class="n">Pacotes</th><th class="n">Diárias</th><th class="n">Pacotes (R$)</th><th class="n">Ajudante</th><th class="n">Bônus</th><th class="n">Vales/desc.</th><th class="n">Total a pagar</th></tr></thead><tbody>${LIN.map(o=>`<tr><td>${esc(o.m)}</td><td class="n">${o.dias}</td><td class="n">${N(o.t)}</td><td class="n">${BRL(o.vd)}</td><td class="n">${BRL(o.vp)}</td><td class="n">${o.ajDias?BRL(o.va)+` <small>(${o.ajDias}d)</small>`:'—'}</td><td class="n">${o.bo?BRL(o.bo):'—'}</td><td class="n">${o.de?'−'+BRL(o.de):'—'}</td><td class="n"><b>${BRL(o.tot)}</b></td></tr>`).join('')}<tr><td><b>Total</b></td><td class="n">${N(T('dias'))}</td><td class="n">${N(T('t'))}</td><td class="n">${BRL(T('vd'))}</td><td class="n">${BRL(T('vp'))}</td><td class="n">${BRL(T('va'))}</td><td class="n">${BRL(T('bo'))}</td><td class="n">−${BRL(T('de'))}</td><td class="n"><b>${BRL(T('tot'))}</b></td></tr></tbody></table></div></div>
${AJ.size?`<div class="box mt"><div class="box-head"><div><h3>Ajudantes</h3><p>Dias trabalhados × diária do ajudante (o valor entra no total do motorista)</p></div></div><div class="table-wrap"><table><thead><tr><th>Ajudante</th><th class="n">Dias</th><th class="n">A pagar</th></tr></thead><tbody>${[...AJ].sort((p,q)=>q[1].size-p[1].size).map(([n,q])=>`<tr><td>${esc(n)}</td><td class="n">${q.size}</td><td class="n">${BRL(q.size*F.ajud)}</td></tr>`).join('')}</tbody></table></div></div>`:''}`:vazio('Ninguém trabalhou nesse período.')}`;
$('#flist').innerHTML=lan.length?`<div class="table-wrap mt"><table><thead><tr><th>Data</th><th>Motorista</th><th>Tipo</th><th class="n">Valor</th><th></th></tr></thead><tbody>${[...lan].sort((p,q)=>p.data<q.data?1:-1).map(l=>`<tr><td>${esc(lblD(l.data))}</td><td>${esc(l.mot)}${l.obs?`<br><small>${esc(l.obs)}</small>`:''}</td><td>${LTIPO[l.tipo]}</td><td class="n">${BRL(l.valor)}</td><td><button class="btn btn-ghost btn-sm" data-fl="${l.id}">Excluir</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="mt">Nenhum lançamento neste período.</p>';
$$('[data-fl]').forEach(x=>x.onclick=async()=>{if(!confirm('Excluir este lançamento?'))return;F.lanc=F.lanc.filter(l=>l.id!==x.dataset.fl);await salvar('Lançamento excluído.')})};
const salvar=async n=>{await saveFile('data/financeiro.json',await seal(F),n);keepMsg(VIEWS.financeiro)};
$('#fpad').onsubmit=async e=>{e.preventDefault();F.diaria=valor($('#f-d').value);F.pacote=valor($('#f-p').value);F.ajud=valor($('#f-a').value);await salvar('Valores de pagamento atualizados.')};
$('#fmot').onsubmit=async e=>{e.preventDefault();const m=$('#fm-m').value;if(!m)return;const d=$('#fm-d').value.trim(),p=$('#fm-p').value.trim();if(!d&&!p)delete F.mot[m];else F.mot[m]={diaria:d?valor(d):null,pacote:p?valor(p):null};await salvar('Regra de '+m+' salva.')};
$$('[data-fdm]').forEach(x=>x.onclick=async()=>{delete F.mot[x.dataset.fdm];await salvar('Regra removida.')});
$('#flan').onsubmit=async e=>{e.preventDefault();const v=valor($('#fl-v').value);if(!v||!$('#fl-m').value)return;F.lanc.push({id:u2b(rnd(6)),mot:$('#fl-m').value,tipo:$('#fl-t').value,data:$('#fl-d').value,valor:v,obs:$('#fl-o').value.trim(),em:new Date().toISOString(),por:ME.login});await salvar('Lançamento registrado.')};
$('#fcsv').onclick=()=>{const q=v=>'"'+String(v).replace(/"/g,'""')+'"';const f=v=>(+v).toFixed(2).replace('.',',');const csv='﻿'+[['Motorista','Dias','Pacotes','Diárias','Pacotes R$','Ajudante','Bônus','Vales/descontos','Total a pagar'].map(q).join(';'),...LIN.map(o=>[q(o.m),o.dias,o.t,f(o.vd),f(o.vp),f(o.va),f(o.bo),f(o.de),f(o.tot)].join(';'))].join('\n');const [a,b]=periodRange($('#fper'));const l=document.createElement('a');l.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));l.download=`pagamento_${a}_${b}.csv`;l.click()};
$$('#fper select,#fper input').forEach(e=>e&&e.addEventListener('change',run));let tm;$('#fsr').addEventListener('input',()=>{clearTimeout(tm);tm=setTimeout(run,180)});run()};
// Performance: página própria num quadro que ocupa a área útil e rola por dentro (cabeçalho fixo, sem cortar o final).
VIEWS.perf=()=>{M().innerHTML=`<div class="perf-wrap"><iframe src="/portal/performance.html?v=29" title="Performance de coleta" id="pf"></iframe></div>`};
const PAL=['#e6194b','#3cb44b','#4363d8','#f58231','#911eb4','#42d4f4','#f032e6','#9a6324','#469990','#800000','#808000','#000075','#bfef45','#dcbeff','#fabed4','#ffd8b1','#aaffc3','#a9a9a9'];
const loadOnce=(()=>{const c={};return u=>c[u]||(c[u]=new Promise((ok,no)=>{const e=u.endsWith('.css')?Object.assign(document.createElement('link'),{rel:'stylesheet',href:u}):Object.assign(document.createElement('script'),{src:u});e.onload=ok;e.onerror=no;document.head.appendChild(e)}))})();
const GEO_KEY='getlog_geo';let GEO={};try{GEO=JSON.parse(localStorage.getItem(GEO_KEY))||{}}catch(e){}
let geoQ=Promise.resolve();
// Coordenada aproximada do bairro (OpenStreetMap), guardada no navegador. Uma consulta por segundo, como pede o serviço.
const geo=(b,ci)=>{const k=(b+'|'+ci).toUpperCase();if(k in GEO)return Promise.resolve(GEO[k]);
return geoQ=geoQ.then(async()=>{if(k in GEO)return GEO[k];let v=null;try{const r=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q='+encodeURIComponent([b,ci,'SP'].filter(Boolean).join(', ')));const j=await r.json();if(j[0])v=[+j[0].lat,+j[0].lon]}catch(e){}
GEO[k]=v;try{localStorage.setItem(GEO_KEY,JSON.stringify(GEO))}catch(e){}await new Promise(t=>setTimeout(t,1100));return v})};
const hsh=s=>{let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))|0;return h};
VIEWS.forecast=()=>{const R=ROWSF||[];const dates=[...new Set(R.map(r=>r.d))].sort().reverse();
M().innerHTML=top('Forecast','Sellers e pacotes previstos por motorista e cidade',false,UPDF)+`
<div class="filters"><select id="xd" aria-label="Dia">${dates.map(d=>`<option value="${d}">${d.split('-').reverse().join('/')}</option>`).join('')}</select>
<select id="xr" aria-label="Região"></select><select id="xm" aria-label="Motorista"></select><select id="xc" aria-label="Cliente"></select><select id="xp" aria-label="Prioridade"></select><input id="xs" type="search" placeholder="Buscar seller (nome ou ID) ou bairro" aria-label="Buscar seller por nome, ID ou bairro"></div>
<div id="xk"></div><div class="grid-2"><div class="box"><div class="box-head"><div><h3>Mapa dos sellers previstos</h3><p>Cada cor é um motorista · círculo maior = mais pacotes · posição aproximada pelo bairro</p></div></div><div id="xmap" class="map"></div><p class="hint" id="xgeo"></p></div>
<div class="box"><div class="box-head"><div><h3>Motoristas</h3><p>Clique para filtrar</p></div></div><div id="xleg" style="max-height:470px;overflow:auto"></div></div></div>
<div class="grid-2"><div class="box"><div class="box-head"><div><h3>Por região</h3><p>Sellers · pacotes previstos</p></div></div><div id="xreg"></div></div><div class="box"><div class="box-head"><div><h3>Por cliente</h3><p>Pacotes previstos</p></div></div><div id="xcli"></div></div></div>`;
const day=()=>R.filter(r=>r.d===$('#xd').value);
const fill=()=>{const D=day();for(const [id,f,l] of [['xr',r=>r.r,'Todas as regiões'],['xm',r=>nm(r.m),'Todos os motoristas'],['xc',r=>r.c,'Todos os clientes'],['xp',r=>r.pri,'Todas as prioridades']]){const el=$('#'+id),v=el.value;el.innerHTML=opts(D.map(f).filter(Boolean),l);el.value=[...el.options].some(o=>o.value===v)?v:''}};
const color=new Map();const col=m=>{if(!color.has(m))color.set(m,PAL[color.size%PAL.length]);return color.get(m)};
let map=null,layer=null,run_id=0;
// Ao sair do Forecast: interrompe a localização dos bairros e desmonta o mapa (camadas, eventos e container).
onLeave(()=>{run_id++;if(map){map.remove();map=null;layer=null}});
const run=async()=>{const id=++run_id;const fr=$('#xr').value,fm=$('#xm').value,fc=$('#xc').value,fp=$('#xp').value,fs=C.nk($('#xs').value);
const f=day().filter(r=>(!fr||r.r===fr)&&(!fm||nm(r.m)===fm)&&(!fc||r.c===fc)&&(!fp||r.pri===fp)&&(!fs||C.nk(r.s+' '+r.sid+' '+r.b).includes(fs)));
const sel=new Map();for(const r of f){const k=sk(r);const o=sel.get(k)||{s:r.s,sid:r.sid,c:r.c,r:r.r,b:r.b,ci:r.ci,m:nm(r.m),p:0};o.p+=r.p;sel.set(k,o)}const S=[...sel.values()];
const mots=group(S,x=>x.m,x=>x.p).sort((a,b)=>b[1]-a[1]);mots.forEach(([m])=>col(m));
$('#xk').innerHTML=`<div class="kpi-grid"><div class="kpi"><small>Pacotes previstos</small><b>${N(S.reduce((a,x)=>a+x.p,0))}</b><span>${lblD($('#xd').value)}</span></div><div class="kpi"><small>Sellers previstos</small><b>${N(S.length)}</b><span>No filtro</span></div><div class="kpi"><small>Motoristas</small><b>${mots.length}</b><span>Com seller previsto</span></div><div class="kpi"><small>Regiões</small><b>${new Set(S.map(x=>x.r)).size}</b><span>Atendidas</span></div></div>`;
$('#xleg').innerHTML='<div class="hb">'+mots.map(([m,v])=>`<div class="hbr" data-m="${esc(m)}" style="cursor:pointer"><span class="hbl" title="${esc(m)}"><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${col(m)};margin-right:6px"></i>${esc(m)}</span><small>${S.filter(x=>x.m===m).length} sellers</small><b>${N(v)}</b></div>`).join('')+'</div>';
$$('#xleg [data-m]').forEach(e=>e.onclick=()=>{$('#xm').value=$('#xm').value===e.dataset.m?'':e.dataset.m;run()});
$('#xreg').innerHTML=hbars(group(S,x=>x.r+' · '+S.filter(y=>y.r===x.r).length+' sellers',x=>x.p).sort((a,b)=>b[1]-a[1]));
$('#xcli').innerHTML=hbars(group(S,x=>x.c,x=>x.p).sort((a,b)=>b[1]-a[1]));
try{await loadOnce('/assets/vendor/leaflet/leaflet.css');await loadOnce('/assets/vendor/leaflet/leaflet.js')}catch(e){$('#xmap').innerHTML='<p class="hint">Não foi possível carregar o mapa.</p>';return}
if(id!==run_id||!$('#xmap'))return;
if(!map||!document.body.contains(map.getContainer())){map=L.map('xmap').setView([-23.55,-46.63],10);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap'}).addTo(map);layer=L.layerGroup().addTo(map)}
layer.clearLayers();const pts=[];let miss=0,done=0;const tot=S.length;
for(const x of S){const c=await geo(x.b,x.ci);if(id!==run_id)return;done++;
if(!c){miss++}else{const h=hsh(x.s);const ll=[c[0]+((h&1023)/1023-.5)*.012,c[1]+(((h>>10)&1023)/1023-.5)*.012];pts.push(ll);
L.circleMarker(ll,{radius:Math.min(18,4+Math.sqrt(x.p)),color:'#fff',weight:1,fillColor:col(x.m),fillOpacity:.85}).bindPopup(`<b>${esc(sellerTxt(x.s,x.sid))}</b><br>${esc(x.c)} · ${esc(x.b)} – ${esc(x.ci)}<br>Motorista: ${esc(x.m)}<br>Previsto: <b>${N(x.p)}</b> pacotes`).addTo(layer)}
if(done%10===0||done===tot)$('#xgeo').textContent=done<tot?`Localizando bairros… ${done} de ${tot}`:(miss?`${miss} seller(s) sem bairro localizado.`:'')}
if(pts.length)map.fitBounds(pts,{padding:[20,20],maxZoom:13})};
$('#xd').onchange=()=>{fill();run()};['xr','xm','xc','xp'].forEach(i=>$('#'+i).onchange=run);$('#xs').oninput=()=>{clearTimeout(run.t);run.t=setTimeout(run,300)};
fill();run()};
function myAvisos(){const now=today();return AVISOS.filter(a=>(!a.ate||a.ate>=now)&&(a.para==='todos'||a.para==='tipo:'+ME.role||a.para==='user:'+ME.login||ME.role==='admin')).sort((a,b)=>a.em<b.em?1:-1)}
const paraLbl=p=>p==='todos'?'Todos':p.startsWith('tipo:')?ROLE_LBL[p.slice(5)]+'s':'@'+p.slice(5);
const avHTML=a=>`<article><div><b>${esc(a.titulo)}</b><p>${esc(a.msg)}</p><small>${new Date(a.em).toLocaleDateString('pt-BR')}${ME.role==='admin'?' · Para: '+esc(paraLbl(a.para)):''}</small></div></article>`;
function popupAvisos(){const k='getlog_vistos_'+ME.login;let seen=[];try{seen=JSON.parse(localStorage.getItem(k))||[]}catch(e){}
const nv=AVISOS.filter(a=>(!a.ate||a.ate>=today())&&(a.para==='todos'||a.para==='tipo:'+ME.role||a.para==='user:'+ME.login)&&!seen.includes(a.id));if(!nv.length)return;
const d=document.createElement('div');d.className='modal';d.innerHTML=`<div class="mbox" role="dialog" aria-modal="true" aria-labelledby="avt"><div class="mhead"><h3 id="avt">${nv.length>1?nv.length+' avisos novos':'Aviso novo'}</h3></div><div class="news">${nv.map(avHTML).join('')}</div><div class="mfoot"><button class="btn btn-primary" id="avok">Entendi</button></div></div>`;
document.body.appendChild(d);$('#avok').focus();$('#avok').onclick=()=>{localStorage.setItem(k,JSON.stringify([...seen,...nv.map(a=>a.id)]));d.remove()}}
VIEWS.avisos=()=>{const adm=ME.role==='admin';
M().innerHTML=top('Avisos','Comunicados internos')+(adm?`<div class="box"><div class="box-head"><div><h3>Enviar aviso</h3><p>O aviso aparece como janela quando a pessoa entrar no portal.</p></div></div>
<form class="uform four" id="avf"><div class="field"><label for="av-t">Título</label><input id="av-t" required maxlength="80"></div>
<div class="field"><label for="av-p">Para</label><select id="av-p"><option value="todos">Todos</option>${['colaborador','ajudante','motorista'].map(r=>`<option value="tipo:${r}">Todos os ${ROLE_LBL[r].toLowerCase()}s</option>`).join('')}<option value="user">Uma pessoa</option></select></div>
<div class="field" id="av-uw" hidden><label for="av-u">Pessoa</label><select id="av-u"></select></div>
<div class="field"><label for="av-a">Exibir até</label><input id="av-a" type="date"></div>
<div class="field full"><label for="av-m">Mensagem</label><textarea id="av-m" required maxlength="600"></textarea></div><div class="full"><button class="btn btn-primary">Enviar aviso</button></div></form><div class="msg" id="u-msg"></div></div>`:'')+
`<div class="box mt"><div class="box-head"><div><h3>${adm?'Avisos ativos':'Seus avisos'}</h3></div></div><div class="news">${myAvisos().map(a=>avHTML(a).replace('</article>',adm?`<button class="btn btn-danger btn-sm" data-del="${a.id}">Excluir</button></article>`:'</article>')).join('')||'<p class="empty">Nenhum aviso.</p>'}</div></div>`;
if(!adm)return;
(async()=>{await profiles();if($('#av-u'))$('#av-u').innerHTML=DB.users.filter(u=>u.role!=='fornecedor').map(u=>`<option value="${esc(u.login)}">${esc(u._p.name||u.login)} (${ROLE_LBL[u.role]})</option>`).join('')})();
$('#av-p').onchange=()=>$('#av-uw').hidden=$('#av-p').value!=='user';
$('#avf').onsubmit=async e=>{e.preventDefault();const p=$('#av-p').value;AVISOS.push({id:u2b(rnd(6)),titulo:$('#av-t').value.trim(),msg:$('#av-m').value.trim(),para:p==='user'?'user:'+$('#av-u').value:p,ate:$('#av-a').value||'',em:new Date().toISOString()});await saveFile('data/avisos.json',await seal(AVISOS),'Aviso enviado.');keepMsg(VIEWS.avisos)};
$$('[data-del]').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir este aviso?'))return;AVISOS=AVISOS.filter(a=>a.id!==b.dataset.del);await saveFile('data/avisos.json',await seal(AVISOS),'Aviso excluído.');keepMsg(VIEWS.avisos)})};
const TIPOS=[['entrada','Início da jornada'],['almoco','Saída para almoço'],['retorno','Retorno do almoço'],['saida','Fim da jornada']];const TIPO_LBL=Object.fromEntries(TIPOS);
const pontoAll=()=>{try{return JSON.parse(localStorage.getItem(PONTO_KEY))||[]}catch(e){return []}};
// Guarda no aparelho só o necessário: marcação já enviada de dias anteriores (com foto e GPS) é apagada; só fica a de hoje e a pendente de envio.
const pontoSave=l=>{const h=today();l=l.filter(p=>!p.sent||p.dia===h);try{localStorage.setItem(PONTO_KEY,JSON.stringify(l));return true}catch(e){return false}};
const plan=async q=>{const r=await fetch(CFG.pontoUrl+'?token='+encodeURIComponent(CFG.pontoToken)+'&'+q);const j=await r.json();if(!j.ok)throw new Error(j.erro||'planilha');return j};
const listar=async desde=>await v2()?(await api('listar',{desde})).itens:(await plan('desde='+desde)).itens;
const fotoDe=async url=>await v2()?(await api('foto',{url})).foto:(await plan('foto='+encodeURIComponent(url))).foto;
// Fila do ponto neste aparelho. Cada marcação nasce com um id único: reenviar nunca duplica na planilha.
let SYNC=null;const syncPonto=()=>SYNC||(SYNC=syncPonto_().finally(()=>SYNC=null));
async function syncPonto_(){if(!PLAN()||!ME)return 0;const ok=new Set(),nova=await v2();
for(const p of pontoAll().filter(p=>!p.sent&&p.login===ME.login)){try{const j=nova?await api('marcar',p):await (await fetch(CFG.pontoUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...p,token:CFG.pontoToken})})).json();if(j.ok)ok.add(p.id)}catch(e){console.warn('ponto',e);break}}
// Regrava relendo o aparelho: uma marcação feita durante o envio não se perde.
const keep=pontoAll().map(p=>ok.has(p.id)?{...p,sent:true}:p).filter(p=>!p.sent||p.dia===today());pontoSave(keep);return keep.filter(p=>!p.sent&&p.login===ME.login).length}
const hm=ts=>new Date(ts).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
let CLK=null,MARCANDO=false,SRV_HOJE=[];
// Marcações de hoje: as confirmadas na planilha + as deste aparelho ainda em envio (uma por tipo).
const marcasHoje=()=>{const loc=pontoAll().filter(p=>p.login===ME.login&&p.dia===today());const m=new Map();
for(const p of SRV_HOJE)if(p.dia===today())m.set(p.tipo,{...p,sent:true,foto:loc.find(x=>x.id===p.id)?.foto||''});for(const p of loc)if(!m.has(p.tipo))m.set(p.tipo,p);return m};
VIEWS.ponto=()=>{const g=GEN;pontoTela();syncPonto().then(async()=>{if(await v2())try{SRV_HOJE=(await api('listar',{desde:today()})).itens.filter(p=>p.login===ME.login)}catch(e){}if(vivo(g)&&!MARCANDO)pontoTela()})};
function pontoTela(){const consent=localStorage.getItem(CONS_KEY+'_'+ME.login);const mine=marcasHoje();const next=TIPOS.find(([t])=>!mine.has(t));
const esc_=ESCALAS.find(e=>e.id===(DB.users.find(u=>u.login===ME.login)?._p?.escala));
M().innerHTML=top('Bater ponto',new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'}))+`${PLAN()?'':'<div class="banner">A planilha do ponto ainda não foi configurada: as marcações ficam guardadas neste aparelho e serão enviadas quando ela for ligada.</div>'}
${consent?'':`<div class="box consent"><h3>Antes de começar</h3><p>Para registrar o ponto, a GETLOG coleta uma foto do seu rosto, sua localização (endereço, latitude e longitude) e o horário de cada marcação. Esses dados são usados somente para controle de jornada e ficam visíveis apenas para a administração.</p><label class="check"><input type="checkbox" id="cs"> Li e autorizo o uso desses dados para o controle de ponto.</label><button class="btn btn-primary" id="csb" disabled>Continuar</button></div>`}
<div class="ponto-grid${consent?'':' dim'}"><div class="box clock"><div class="clk" id="clk"></div><p class="clk-d">${esc_?`Escala: ${esc(esc_.nome)} (${esc_.ent} às ${esc_.sai})`:'Sem escala definida'}</p>
${next?`<button class="btn btn-primary big" id="mark"${consent?'':' disabled'}>${IC.cam}Registrar ${next[1].toLowerCase()}</button><p class="hint">Exige foto do rosto e localização ativada.</p>`:'<p class="done">Jornada de hoje concluída.</p>'}
<button class="btn btn-ghost btn-sm" id="ajb" type="button">Esqueceu ou errou uma marcação? Solicitar ajuste</button></div>
<div class="box"><div class="box-head"><div><h3>Marcações de hoje</h3><p>${mine.size} de 4</p></div></div><ol class="marks">${TIPOS.map(([t,l])=>{const p=mine.get(t);return `<li class="${p?(p.sent?'ok':'wait'):''}">${p&&p.foto?`<img src="${imgSeg(p.foto)}" alt="Foto da marcação">`:'<span class="ph"></span>'}<div><b>${l}</b><small>${p?hm(p.ts)+' · '+esc(p.end):'Pendente'}</small>${p&&!p.sent?'<small class="sending">Enviando para a planilha…</small>':''}</div></li>`}).join('')}</ol></div></div>
<div id="ajx"></div>`;
clearInterval(CLK);const tick=()=>{const c=$('#clk');if(!c)return clearInterval(CLK);c.textContent=new Date().toLocaleTimeString('pt-BR')};CLK=setInterval(tick,1000);tick();onLeave(()=>clearInterval(CLK));
if(!consent){$('#cs').onchange=e=>$('#csb').disabled=!e.target.checked;$('#csb').onclick=()=>{localStorage.setItem(CONS_KEY+'_'+ME.login,new Date().toISOString());pontoTela()}}
$('#ajb').onclick=solicitarAjuste;minhasSolicitacoes();
if(next&&consent)$('#mark').onclick=async e=>{if(MARCANDO)return;MARCANDO=true;const b=e.currentTarget,t0=b.innerHTML;b.disabled=true;b.textContent='Abrindo câmera…';let salvo=false;
try{if(!await conferirAcesso(true))return;const cap=await capturar(next[1]);if(!cap)return;
if(marcasHoje().has(next[0])){toast('Essa marcação já foi registrada.');return}
const p={id:u2b(rnd(9)),login:ME.login,name:ME.name,role:ME.role,tipo:next[0],dia:today(),...cap};
if(!pontoSave([...pontoAll(),p])){toast('Memória do aparelho cheia. Fale com o administrador.');return}salvo=true;
MARCANDO=false;if(CUR==='ponto')pontoTela();
const n=await syncPonto();if(CUR==='ponto')VIEWS.ponto();toast(!PLAN()?'Marcação guardada neste aparelho.':n?'Sem conexão: a marcação será enviada assim que a internet voltar.':'Marcação registrada.')}
finally{MARCANDO=false;if(!salvo&&b.isConnected){b.disabled=false;b.innerHTML=t0}}}}
// Câmera + localização. Devolve {foto,ts,lat,lon,acc,end} ou null se a pessoa cancelar.
function capturar(label){return new Promise(done=>{
const d=document.createElement('div');d.className='modal';d.innerHTML=`<div class="mbox cam" role="dialog" aria-modal="true" aria-label="${esc(label)}"><div class="mhead"><h3>${esc(label)}</h3><button class="icon-x" id="cx" aria-label="Cancelar">${IC.x}</button></div>
<div class="vid"><video id="cv" playsinline muted autoplay></video><div class="oval"></div></div><div class="geo-st" id="gs">Obtendo localização...</div><div class="msg err" id="cm"></div><div class="mfoot"><button class="btn btn-primary" id="shot" disabled>Tirar foto e confirmar</button></div></div>`;
document.body.appendChild(d);let stream=null,pos=null,end='',geoEnd=0,gW=null,gT=0;
const close=v=>{stream&&stream.getTracks().forEach(t=>t.stop());if(gW!=null)navigator.geolocation.clearWatch(gW);gW=null;clearTimeout(gT);d.remove();done(v)};$('#cx').onclick=()=>close(null);
const fail=t=>{$('#cm').textContent=t};const ready=()=>{$('#shot').disabled=!(stream&&pos)};
navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640}},audio:false}).then(s=>{if(!d.isConnected){s.getTracks().forEach(t=>t.stop());return}stream=s;$('#cv').srcObject=s;ready()}).catch(()=>fail('Câmera bloqueada. Libere o acesso à câmera nas permissões do navegador.'));
const gotPos=async c=>{if(!d.isConnected)return;if(pos&&c.accuracy>=pos.accuracy)return;pos=c;$('#gs').textContent=`Localização: ${pos.latitude.toFixed(5)}, ${pos.longitude.toFixed(5)} (±${Math.round(pos.accuracy)} m)`;ready();
if(c.accuracy<=50&&gW!=null){navigator.geolocation.clearWatch(gW);gW=null}
const my=++geoEnd;try{const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&lat=${pos.latitude}&lon=${pos.longitude}`,{headers:{'Accept-Language':'pt-BR'}});const j=await r.json();if(my!==geoEnd||!d.isConnected)return;const a=j.address||{};end=[a.road,a.house_number].filter(Boolean).join(', ')+(a.suburb?' - '+a.suburb:'')+(a.city||a.town?' - '+(a.city||a.town):'');$('#gs').textContent=(end||'Endereço não identificado')+` (±${Math.round(pos.accuracy)} m)`}catch(e){}};
const geoErr=e=>{if(pos||!d.isConnected)return;if(e&&e.code===1)fail('Localização bloqueada. iPhone: Ajustes → Privacidade → Serviços de Localização → ative e, em "Sites do Safari", escolha "Durante o uso". Android: toque no cadeado ao lado do endereço → Permissões → Localização → Permitir. Depois recarregue a página.');else{$('#gs').innerHTML='Não foi possível obter a localização. <button type="button" class="btn btn-ghost btn-sm" id="geo-again">Tentar de novo</button>';$('#geo-again').onclick=startGeo}};
// 1) posição rápida (rede/última conhecida) para liberar o botão; 2) GPS refinando por até 30 s.
const startGeo=()=>{if(!window.isSecureContext){fail('Conexão não segura: o celular só libera a localização em página com cadeado (https). Avise o administrador.');return}$('#gs').textContent='Obtendo localização…';navigator.geolocation.getCurrentPosition(p=>gotPos(p.coords),()=>{},{enableHighAccuracy:false,timeout:8000,maximumAge:120000});
if(gW!=null)navigator.geolocation.clearWatch(gW);gW=navigator.geolocation.watchPosition(p=>gotPos(p.coords),geoErr,{enableHighAccuracy:true,timeout:30000,maximumAge:0});
clearTimeout(gT);gT=setTimeout(()=>{if(gW!=null){navigator.geolocation.clearWatch(gW);gW=null}if(!pos)geoErr()},30000)};startGeo();
$('#shot').onclick=e=>{const v=$('#cv');if(!v.videoWidth){fail('A câmera ainda está iniciando. Tente de novo em um instante.');return}e.currentTarget.disabled=true;const W=320,H=Math.round(W*v.videoHeight/v.videoWidth);const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.translate(W,0);x.scale(-1,1);x.drawImage(v,0,0,W,H);
close({foto:c.toDataURL('image/jpeg',.72),ts:new Date().toISOString(),lat:pos.latitude,lon:pos.longitude,acc:pos.accuracy,end:end||'Endereço não identificado'})}})}
// Formulário em janela. Resolve com os valores dos campos (por id) ou null se fechar.
function pedir(title,html,botao='Confirmar'){return new Promise(done=>{const d=modal(title,`<form class="uform" id="pdf">${html}<p class="msg" id="pd-msg"></p><button class="btn btn-primary">${botao}</button></form>`);
const fim=v=>{d.remove();done(v)};d.querySelector('.icon-x').onclick=()=>fim(null);
d.querySelector('#pdf').onsubmit=e=>{e.preventDefault();const v={};for(const el of d.querySelectorAll('input,select,textarea'))if(el.id)v[el.id]=el.value.trim();fim(v)}})}
const precisaV2=async()=>{if(await v2())return true;toast(PLAN()?'Função disponível depois que o administrador atualizar o script da planilha do ponto.':'A planilha do ponto ainda não está conectada.');return false};
// Solicitação de ajuste: Solicitação → Pendente → ADM aprova/rejeita. Foto e localização obrigatórias (exceto ADM).
async function solicitarAjuste(){if(!await precisaV2()||!await conferirAcesso(true))return;const exige=ME.role!=='admin';
const v=await pedir('Solicitar ajuste de ponto',`<div class="field"><label for="aj-d">Data</label><input id="aj-d" type="date" required max="${today()}" value="${today()}"></div><div class="field"><label for="aj-h">Hora</label><input id="aj-h" type="time" required></div>
<div class="field"><label for="aj-t">Marcação</label><select id="aj-t">${TIPOS.map(([t,l])=>`<option value="${t}">${l}</option>`).join('')}</select></div>
<div class="field"><label for="aj-m">Motivo</label><textarea id="aj-m" required maxlength="400" placeholder="Explique o que aconteceu"></textarea></div>${exige?'<p class="hint">Na próxima etapa tire uma foto do rosto e libere a localização.</p>':''}`,exige?'Continuar':'Enviar solicitação');
if(!v)return;const cap=exige?await capturar('Foto e localização do ajuste'):null;if(exige&&!cap)return;
try{await api('ajuste',{id:u2b(rnd(9)),dia:v['aj-d'],hora:v['aj-h'],tipo:v['aj-t'],motivo:v['aj-m'],name:ME.name,role:ME.role,...(cap||{})});toast('Solicitação enviada para o administrador.');if(CUR==='ponto')minhasSolicitacoes()}
catch(e){if(!NEGADO[e.code])toast(e.code==='foto'?'Foto e localização são obrigatórias.':'Não foi possível enviar agora. Verifique a internet e tente de novo.')}}
const SIT_CLS={Pendente:'warn',Aprovado:'ok',Rejeitado:'off'};
async function minhasSolicitacoes(){const el=$('#ajx');if(!el||!await v2())return;try{const it=(await api('ajustes',{})).itens.filter(a=>a.login===ME.login).slice(0,10);if(!it.length||!el.isConnected)return;
el.innerHTML=`<div class="box mt"><div class="box-head"><div><h3>Minhas solicitações de ajuste</h3><p>As 10 mais recentes</p></div></div><div class="table-wrap"><table><thead><tr><th>Data</th><th>Hora</th><th>Marcação</th><th>Motivo</th><th>Situação</th></tr></thead><tbody>${it.map(a=>`<tr><td>${lblD(a.dia)}</td><td>${esc(a.hora)}</td><td>${esc(TIPO_LBL[a.tipo]||a.tipo)}</td><td class="loc">${esc(a.motivo)}</td><td><span class="st ${SIT_CLS[a.situacao]||''}">${esc(a.situacao)}</span>${a.obs?`<small class="hint"> ${esc(a.obs)}</small>`:''}</td></tr>`).join('')}</tbody></table></div></div>`}catch(e){console.warn('ajustes',e)}}
const PF={};
VIEWS.pontoadm=async()=>{const g=GEN;M().innerHTML=SKEL;let all=[],erro='';const nova=await v2();
if(!PLAN())erro='A planilha do ponto não está conectada. Conecte em Usuários e acessos → Configurações do sistema.';
else{await syncPonto();try{const d=new Date();d.setDate(d.getDate()-62);all=await listar(keyD(d))}catch(e){console.warn('ponto',e);erro='Não foi possível ler a planilha do ponto agora. Tente de novo em instantes.'}}
if(!vivo(g))return;const names=[...new Set(all.map(p=>p.name))].sort();
M().innerHTML=top('Controle de ponto','Marcações com foto, localização e horário · ajustes e correções')+`${erro?`<div class="banner">${erro}</div>`:''}${PLAN()&&!nova?'<div class="banner">Para liberar solicitações de ajuste, correções com auditoria e bloqueio imediato de acessos, atualize o código do Apps Script da planilha do ponto (arquivo ponto-apps-script.gs) e publique uma nova versão.</div>':''}
<div id="ajpend"></div><div class="filters">${periodUI('pp',['dia','semana','quinzena','mes'])}<select id="pn" aria-label="Pessoa"><option value="">Todas as pessoas</option>${names.map(n=>`<option>${esc(n)}</option>`).join('')}</select>${nova?'<button class="btn btn-ghost btn-sm" id="inc" type="button">Incluir marcação</button>':''}<button class="btn btn-ghost btn-sm" id="prt" type="button">Gerar relatório</button></div><div id="pout"></div>
${nova?'<details class="box mt" id="aud"><summary>Histórico de alterações (auditoria)</summary><div id="audl"><p class="hint">Carregando…</p></div></details>':''}`;
for(const id of ['#pp .pm','#pp .pd','#pp .pmo','#pp .pq','#pn']){const el=$(id);if(el&&PF[id]!=null&&(!el.options||[...el.options].some(o=>o.value===PF[id])))el.value=PF[id]}
const hrs=l=>{const m=l.m;if(!m.entrada||!m.saida)return null;let t=new Date(m.saida.ts)-new Date(m.entrada.ts);if(m.almoco&&m.retorno)t-=new Date(m.retorno.ts)-new Date(m.almoco.ts);return t/36e5};
const fmtH=h=>h==null?'—':Math.floor(h)+'h'+String(Math.round(h%1*60)).padStart(2,'0');
const bip=l=>{if(l.role!=='ajudante'||!DIAS.size)return null;const k=C.nk(l.name);return rows().filter(r=>r.d===l.dia&&C.nk(r.a)===k).reduce((x,r)=>x+r.t,0)};
let lin=[];
const run=()=>{if(!vivo(g))return;for(const id of Object.keys(PF).concat(['#pp .pm','#pp .pd','#pp .pmo','#pp .pq','#pn'])){const el=$(id);if(el)PF[id]=el.value}
const [a,b,lbl]=periodRange($('#pp'));const pn=$('#pn').value;const f=all.filter(p=>p.dia>=a&&p.dia<=b&&(!pn||p.name===pn));
const gm=new Map();for(const p of f){const k=(p.login||p.name)+'|'+p.dia;if(!gm.has(k))gm.set(k,{name:p.name,login:p.login,role:p.role,dia:p.dia,m:{}});gm.get(k).m[p.tipo]=p}
lin=[...gm.values()].sort((x,y)=>x.dia===y.dia?x.name.localeCompare(y.name):x.dia<y.dia?1:-1);const totH=lin.reduce((x,l)=>x+(hrs(l)||0),0);
$('#pout').innerHTML=`<div class="kpi-grid"><div class="kpi"><small>Pessoas que trabalharam</small><b>${new Set(lin.map(l=>l.name)).size}</b><span>${esc(lbl)}</span></div><div class="kpi"><small>Jornadas registradas</small><b>${lin.length}</b><span>Dias x pessoas</span></div><div class="kpi"><small>Horas trabalhadas</small><b>${fmtH(totH)}</b><span>Soma do período</span></div><div class="kpi"><small>Jornadas incompletas</small><b>${lin.filter(l=>Object.keys(l.m).length<4).length}</b><span>Faltou alguma marcação</span></div></div>
<div class="box mt" id="rep"><div class="box-head"><div><h3>Relatório de ponto</h3><p>${esc(lbl)}${pn?' · '+esc(pn):''} · toque em uma linha para ver fotos e localização${nova?' ou corrigir':''}</p></div></div><div class="table-wrap"><table><thead><tr><th>Data</th><th>Pessoa</th><th>Tipo</th><th>Início</th><th>Almoço</th><th>Retorno</th><th>Fim</th><th class="n">Horas</th><th class="n">Pacotes bipados</th><th>Local do início</th></tr></thead><tbody>
${lin.map((l,i)=>`<tr data-i="${i}" class="clk-row" tabindex="0"><td>${lblD(l.dia)}</td><td>${esc(l.name)}</td><td>${ROLE_LBL[l.role]||''}</td>${TIPOS.map(([t])=>`<td>${l.m[t]?hm(l.m[t].ts)+(l.m[t].origem&&l.m[t].origem!=='App'?' <small class="hint" title="'+esc(l.m[t].origem)+'">*</small>':''):'<span class="miss">—</span>'}</td>`).join('')}<td class="n">${fmtH(hrs(l))}</td><td class="n">${bip(l)==null?'—':N(bip(l))}</td><td class="loc">${esc(l.m.entrada?.end||'—')}</td></tr>`).join('')||'<tr><td colspan="10" class="empty">Nenhuma marcação no período.</td></tr>'}</tbody></table></div>${nova?'<p class="hint mt">* marcação incluída ou corrigida pelo administrador ou por ajuste aprovado.</p>':''}</div>`;
$$('.clk-row').forEach(tr=>tr.onclick=tr.onkeydown=async e=>{if(e.type==='keydown'&&e.key!=='Enter')return;const l=lin[+tr.dataset.i];tr.style.opacity=.5;await Promise.all(Object.values(l.m).map(async p=>{if(!p.foto&&p.fotoUrl)try{p.foto=await fotoDe(p.fotoUrl)}catch(x){}}));tr.style.opacity='';detail(l)})};
const recarregar=()=>{if(vivo(g))VIEWS.pontoadm()};
// Correção administrativa direta: sem foto/localização, sempre com motivo e auditoria no servidor.
const corrigir=async(op,dados,titulo,html)=>{const v=await pedir(titulo,html+'<div class="field"><label for="ad-m">Motivo</label><textarea id="ad-m" required maxlength="300"></textarea></div>');if(!v)return;
if(!await conferirAcesso(true))return;try{await api('adm',{op,...dados(v),motivo:v['ad-m']});toast('Alteração registrada.');recarregar()}catch(e){if(!NEGADO[e.code])toast(e.code==='duplicada'?'Essa pessoa já tem essa marcação no dia.':'Não foi possível salvar a alteração. Tente de novo.')}};
const horaF=(v='')=>`<div class="field"><label for="ad-h">Hora</label><input id="ad-h" type="time" required value="${v}"></div>`;
const detail=l=>{const d=document.createElement('div');d.className='modal';d.innerHTML=`<div class="mbox wide" role="dialog" aria-modal="true" aria-label="Detalhe das marcações"><div class="mhead"><h3>${esc(l.name)} · ${lblD(l.dia)}</h3><button class="icon-x" aria-label="Fechar">${IC.x}</button></div><div class="det">${TIPOS.map(([t,lb])=>{const p=l.m[t];return `<div class="dcard">${p?.foto?`<img src="${imgSeg(p.foto)}" alt="Foto">`:'<span class="ph big">'+(p?'Sem foto':'Sem marcação')+'</span>'}<b>${lb}</b><small>${p?hm(p.ts):'—'}${p?.origem&&p.origem!=='App'?' · '+esc(p.origem):''}</small>${p?`<small>${esc(p.end||'')}</small>${p.lat?`<a href="https://www.google.com/maps?q=${p.lat},${p.lon}" target="_blank" rel="noopener">Ver no mapa</a>`:''}`:''}
${nova?(p?`<div class="row-actions"><button class="btn btn-ghost btn-sm" data-ed="${t}">Editar</button><button class="btn btn-danger btn-sm" data-rm="${t}">Excluir</button></div>`:`<div class="row-actions"><button class="btn btn-ghost btn-sm" data-in="${t}">Incluir</button></div>`):''}</div>`}).join('')}</div></div>`;document.body.appendChild(d);
d.onclick=async e=>{if(e.target===d||e.target.closest('.icon-x'))return d.remove();const b=e.target.closest('[data-ed],[data-rm],[data-in]');if(!b)return;d.remove();
if(b.dataset.ed){const p=l.m[b.dataset.ed];corrigir('editar',v=>({id:p.id,hora:v['ad-h']}),'Editar '+TIPO_LBL[b.dataset.ed].toLowerCase(),horaF(hm(p.ts)))}
if(b.dataset.rm){const p=l.m[b.dataset.rm];corrigir('excluir',()=>({id:p.id}),'Excluir '+TIPO_LBL[b.dataset.rm].toLowerCase()+' de '+hm(p.ts),'<p class="hint">A marcação sai do relatório, mas continua guardada no histórico.</p>')}
if(b.dataset.in)corrigir('incluir',v=>({alvo:l.login,name:l.name,role:l.role,dia:l.dia,tipo:b.dataset.in,hora:v['ad-h']}),'Incluir '+TIPO_LBL[b.dataset.in].toLowerCase(),horaF())}};
$$('#pp select,#pp input,#pn').forEach(e=>e.addEventListener('change',run));$('#prt').onclick=()=>print();run();
if(!DIAS.size&&all.some(p=>p.role==='ajudante'))loadReal().then(run);
if(!nova)return;
$('#inc').onclick=async()=>{await profiles();const ps=DB.users.filter(u=>u.active!==false&&ACC[u.role]?.includes('ponto'));
corrigir('incluir',v=>{const u=ps.find(x=>x.login===v['ad-p']);return {alvo:u.login,name:u._p?.name||u.login,role:u.role,dia:v['ad-d'],tipo:v['ad-t'],hora:v['ad-h']}},'Incluir marcação',`<div class="field"><label for="ad-p">Pessoa</label><select id="ad-p">${ps.map(u=>`<option value="${esc(u.login)}">${esc(u._p?.name||u.login)}</option>`).join('')}</select></div><div class="field"><label for="ad-d">Data</label><input id="ad-d" type="date" required max="${today()}" value="${today()}"></div><div class="field"><label for="ad-t">Marcação</label><select id="ad-t">${TIPOS.map(([t,l])=>`<option value="${t}">${l}</option>`).join('')}</select></div>`+horaF())};
$('#aud').addEventListener('toggle',async e=>{if(!e.target.open||e.target.dataset.ok)return;try{const it=(await api('auditoria',{})).itens;e.target.dataset.ok=1;
$('#audl').innerHTML=it.length?`<div class="table-wrap mt"><table><thead><tr><th>Quando</th><th>Quem</th><th>Alteração</th><th>Pessoa</th><th>Antes</th><th>Depois</th><th>Motivo</th></tr></thead><tbody>${it.map(a=>`<tr><td>${new Date(a.em).toLocaleString('pt-BR')}</td><td>${esc(a.por)}</td><td>${esc(a.op)}</td><td>${esc(a.alvo)}</td><td class="loc">${esc(a.antes)}</td><td class="loc">${esc(a.depois)}</td><td class="loc">${esc(a.motivo)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="hint">Nenhuma alteração registrada.</p>'}catch(x){$('#audl').innerHTML='<p class="hint">Não foi possível carregar o histórico agora.</p>'}});
// Solicitações pendentes de ajuste: aprovar cria a marcação; rejeitar guarda a decisão. Tudo fica no histórico.
try{const pend=(await api('ajustes',{situacao:'Pendente'})).itens;if(!vivo(g)||!pend.length)return;
$('#ajpend').innerHTML=`<div class="box attn"><div class="box-head"><div><h3>Solicitações de ajuste pendentes</h3><p>${pend.length} aguardando sua análise</p></div></div><div class="news">${pend.map(a=>`<article><div><b>${esc(a.name)} · ${esc(TIPO_LBL[a.tipo]||a.tipo)} em ${lblD(a.dia)} às ${esc(a.hora)}</b><p>${esc(a.motivo)}</p><small>Pedido em ${new Date(a.em).toLocaleString('pt-BR')}${a.end?' · '+esc(a.end):''}${a.lat?` · <a href="https://www.google.com/maps?q=${a.lat},${a.lon}" target="_blank" rel="noopener">mapa</a>`:''}</small></div><div class="row-actions">${a.fotoUrl?`<button class="btn btn-ghost btn-sm" data-fo="${esc(a.fotoUrl)}">Foto</button>`:''}<button class="btn btn-primary btn-sm" data-ok="${esc(a.id)}">Aprovar</button><button class="btn btn-danger btn-sm" data-no="${esc(a.id)}">Rejeitar</button></div></article>`).join('')}</div></div>`;
$('#ajpend').onclick=async e=>{const b=e.target.closest('button');if(!b||b.disabled)return;
if(b.dataset.fo){b.disabled=true;try{const f=await fotoDe(b.dataset.fo);modal('Foto da solicitação',`<img src="${f}" alt="Foto" style="width:100%;border-radius:12px">`).querySelector('.icon-x').onclick=e2=>e2.target.closest('.modal').remove()}catch(x){toast('Não foi possível abrir a foto.')}b.disabled=false;return}
let obs='';if(b.dataset.no){const v=await pedir('Rejeitar solicitação','<div class="field"><label for="rj-m">Motivo da rejeição</label><textarea id="rj-m" required maxlength="300"></textarea></div>','Rejeitar');if(!v)return;obs=v['rj-m']}
if(!await conferirAcesso(true))return;b.disabled=true;try{await api('decidir',{id:b.dataset.ok||b.dataset.no,aprovar:!!b.dataset.ok,obs});toast(b.dataset.ok?'Ajuste aprovado e marcação criada.':'Solicitação rejeitada.');recarregar()}catch(x){b.disabled=false;if(!NEGADO[x.code])toast(x.code==='decidido'?'Essa solicitação já foi analisada.':'Não foi possível salvar a decisão. Tente de novo.')}}}catch(e){console.warn('ajustes',e)}};
async function ghToken(){const s=localStorage.getItem(GH_KEY);if(!s)return null;try{const o=JSON.parse(s);return dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:b2u(o.iv)},MASTER,b2u(o.ct)))}catch(e){return null}}
async function setToken(t){const iv=rnd(12);localStorage.setItem(GH_KEY,JSON.stringify({iv:u2b(iv),ct:u2b(await crypto.subtle.encrypt({name:'AES-GCM',iv},MASTER,enc.encode(t)))}))}
let LAST=['',''];
async function saveFile(path,obj,note){if(obj===DB&&CFG.pontoUrl)DB.senhaUrl=CFG.pontoUrl;const body=JSON.stringify(obj,(k,v)=>k==='_p'?undefined:v,2)+'\n';const tk=await ghToken();
const say=(c,t)=>{LAST=[c,t];const o=$('#u-msg');if(o){o.className='msg '+c;o.textContent=t}};
if(!tk){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([body],{type:'application/json'}));a.download=path.split('/').pop();a.click();say('err',note+' Ainda não foi publicado: conecte o GitHub em Usuários e acessos → Configurações do sistema. Uma cópia foi baixada neste aparelho.');return}
say('','Salvando...');const api='https://api.github.com/repos/'+REPO+'/contents/'+path;const h={Authorization:'Bearer '+tk,Accept:'application/vnd.github+json'};
try{const cur=await fetch(api+'?ref=main',{headers:h,cache:'no-store'});const sha=cur.ok?(await cur.json()).sha:undefined;
const r=await fetch(api,{method:'PUT',headers:h,body:JSON.stringify({message:note,content:u2b(enc.encode(body)),sha,branch:'main'})});if(!r.ok)throw new Error(r.status);say('ok',note+' Salvo. O site atualiza em cerca de 1 minuto.')}
catch(e){console.warn('salvar',path,e);say('err','Não foi possível salvar agora. Confira a internet; se continuar, reconecte o GitHub em Configurações do sistema.')}}
async function keepMsg(fn){await fn();const o=$('#u-msg');if(o){o.className='msg '+LAST[0];o.textContent=LAST[1]}}
const pwGen=()=>{const a='abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';return [...rnd(10)].map(x=>a[x%a.length]).join('')};
const cpfOk=c=>{c=String(c).replace(/\D/g,'');if(c.length!==11||/^(\d)\1+$/.test(c))return false;const d=n=>{let s=0;for(let i=0;i<n;i++)s+=+c[i]*(n+1-i);const r=s*10%11;return r===10?0:r};return d(9)===+c[9]&&d(10)===+c[10]};
const placaOk=p=>/^[A-Z]{3}-?\d[A-Z0-9]\d{2}$/.test(String(p||'').toUpperCase().trim());
function validate(u){const e=[];if(!u.name)e.push('nome');if(!/^[a-z0-9._-]{3,40}$/.test(u.login))e.push('login (3 a 40 caracteres: letras, números, ponto, hífen)');
if(u.role==='motorista'){if(!placaOk(u.placa))e.push('placa (ex.: ABC1D23)');if(!VEIC.includes(u.modelo))e.push('modelo do veículo');}
if(u.role==='fornecedor'&&!u.cliente)e.push('cliente');return e}
const PW_PADRAO='123456';
// Áreas sensíveis (chave mestra): pede a senha de novo antes de liberar.
const confirmaSenha=()=>new Promise(ok=>{const d=modal('Confirme sua senha',`<form id="cs" class="form" style="grid-template-columns:1fr"><p class="hint">Por segurança, digite sua senha para continuar.</p><label>Senha<input id="cs-p" type="password" autocomplete="current-password" required></label><p class="msg err" id="cs-m"></p><button class="btn btn-primary">Confirmar</button></form>`);
const fim=v=>{d.remove();ok(v)};$('.icon-x',d).onclick=()=>fim(false);d.onclick=e=>{if(e.target===d)fim(false)};$('#cs-p',d).focus();
$('#cs',d).onsubmit=async e=>{e.preventDefault();const m=$('#cs-m',d);m.textContent='Conferindo…';try{await login(ME.login,$('#cs-p',d).value);fim(true)}catch(er){m.textContent='Senha incorreta.'}}});
const modal=(title,body)=>{const d=document.createElement('div');d.className='modal';d.innerHTML=`<div class="mbox" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="mhead"><h3>${esc(title)}</h3><button class="icon-x" type="button" aria-label="Fechar">${IC.x}</button></div>${body}</div>`;document.body.appendChild(d);return d};
// Admin edita nome, tipo e dados do cadastro (o login não muda).
function editUser(u){return new Promise(done=>{const p=u._p||{};const d=modal('Editar acesso',`<form class="uform two" id="ef2">
<div class="field"><label for="e-nome">Nome completo</label><input id="e-nome" required value="${esc(p.name||'')}"></div>
<div class="field"><label for="e-role">Tipo</label><select id="e-role"${u.login===ME.login?' disabled':''}>${['colaborador','ajudante','motorista','fornecedor','admin'].map(r=>`<option value="${r}"${r===u.role?' selected':''}>${ROLE_LBL[r]}</option>`).join('')}</select></div>
<div class="field"><label for="e-tel">Telefone</label><input id="e-tel" type="tel" value="${esc(p.tel||'')}"></div>
<div class="field"><label for="e-placa">Placa</label><input id="e-placa" value="${esc(p.placa||'')}"></div><div class="field"><label for="e-mod">Modelo do veículo</label><select id="e-mod"><option value="">—</option>${VEIC.map(v=>`<option${v===p.modelo?' selected':''}>${v}</option>`).join('')}</select></div>
<div class="field"><label for="e-esc">Escala</label><select id="e-esc"><option value="">Sem escala</option>${ESCALAS.map(e=>`<option value="${e.id}"${e.id===p.escala?' selected':''}>${esc(e.nome)}</option>`).join('')}</select></div>
<div class="field"><label for="e-cli">Cliente do fornecedor</label><select id="e-cli"><option value="">—</option>${GL_DEMO.CLI.map(c=>`<option${c===p.cliente?' selected':''}>${c}</option>`).join('')}</select></div>
<div class="full"><p class="msg" id="e-msg"></p><button class="btn btn-primary">Salvar alterações</button></div></form>`);
const fim=v=>{d.remove();done(v)};d.querySelector('.icon-x').onclick=()=>fim(false);
d.querySelector('#ef2').onsubmit=async e=>{e.preventDefault();const n={name:$('#e-nome').value.trim(),login:u.login,role:$('#e-role').value,tel:$('#e-tel').value.trim(),placa:$('#e-placa').value,modelo:$('#e-mod').value,escala:$('#e-esc').value,cliente:$('#e-cli').value};
const er=validate(n);if(er.length){$('#e-msg').className='msg err';$('#e-msg').textContent='Confira: '+er.join(', ')+'.';return}
const prof=mkProf(n);u.role=n.role;u.p=await seal(prof);u._p=prof;fim(true);await saveFile('data/users.json',DB,'Cadastro de '+n.name+' atualizado.')}})}
// Troca da própria senha. Fica guardada na planilha (aba Senhas), porque só o admin grava no site.
// Troca da própria senha. A chave trancada pela nova senha fica na planilha (aba Senhas), porque só o admin grava no site.
// Obrigatória quando a pessoa entra com a senha padrão: a tela não fecha e o portal só abre depois de trocar.
function trocarSenha(obrig){return new Promise(done=>{const d=modal(obrig?'Crie sua senha':'Trocar senha',`<form class="uform" id="tsf">${obrig?'<p class="hint">Este é seu primeiro acesso (ou sua senha foi redefinida). Crie uma senha pessoal para continuar.</p>':''}
<div class="field"><label for="ts1">Nova senha</label><input id="ts1" type="password" required minlength="6" autocomplete="new-password"></div><div class="field"><label for="ts2">Repita a nova senha</label><input id="ts2" type="password" required minlength="6" autocomplete="new-password"></div>
<p class="msg" id="tsm"></p><button class="btn btn-primary">Salvar senha</button>${obrig?'<button type="button" class="btn btn-ghost" id="tsout">Sair</button>':''}</form>`);
const x=d.querySelector('.icon-x');if(obrig){x.remove();d.dataset.fixo=1;d.querySelector('#tsout').onclick=()=>encerrar('')}else x.onclick=()=>{d.remove();done(false)};
d.querySelector('#tsf').onsubmit=async e=>{e.preventDefault();const bt=d.querySelector('#tsf .btn-primary');if(bt.disabled)return;const a=$('#ts1').value,b=$('#ts2').value,m=$('#tsm');m.className='msg err';
if(a!==b){m.textContent='As duas senhas não são iguais.';return}if(a.length<6||a===PW_PADRAO){m.textContent='Use pelo menos 6 caracteres e diferente de '+PW_PADRAO+'.';return}
if(!PLAN()){m.textContent='A planilha do ponto ainda não está conectada. Fale com o administrador.';return}
bt.disabled=true;m.className='msg';m.textContent='Salvando…';
try{const w=await wrapFor(a),av=await credencial(ME.login,a),dados={...w,em:new Date().toISOString(),ah:await hashHex(av)};
if(await v2())await api('senha',dados);else{const r=await fetch(CFG.pontoUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({token:CFG.pontoToken,acao:'senha',login:ME.login,...dados})});const j=await r.json();if(!j.ok)throw new Error(j.erro)}
SESS.av=av;SESS.troca=false;sessSet(SESS);d.remove();done(true)}catch(x){bt.disabled=false;if(!NEGADO[x.code]){m.className='msg err';const c=x.code||x.message||'rede';m.textContent=!PLAN()?'Servidor do ponto não configurado. Fale com o administrador.':c==='token'?'Servidor do ponto recusou a chave (token). Fale com o administrador.':'Não foi possível salvar agora (erro: '+c+'). Tente de novo; se repetir, envie este código ao administrador.'}}}})}
// Nome fica exatamente como digitado; o vínculo com os dados usa o nome normalizado (GL_CORE.casar).
const mkProf=u=>({name:u.name,tel:u.tel||'',placa:String(u.placa||'').toUpperCase().replace('-',''),modelo:u.modelo||'',escala:u.escala||'',cliente:u.cliente||'',ref:['motorista','ajudante'].includes(u.role)?u.name:''});
// ah = hash da credencial do servidor para a senha definida pelo admin (o servidor confere sem conhecer a senha).
const credAdmin=async(login,pw)=>({...await wrapFor(pw),pwEm:new Date().toISOString(),ah:await hashHex(await credencial(login,pw))});
async function addUser(u,pw){const prof=mkProf(u);
const rec={login:u.login,role:u.role,active:true,...await credAdmin(u.login,pw),p:await seal(prof),created:new Date().toISOString()};rec._p=prof;DB.users.push(rec)}
// Avisa o servidor do ponto na hora (sem esperar o site publicar) que um acesso foi bloqueado ou liberado.
const avisaAcesso=async(alvo,ativo)=>{if(await v2())try{await api('acesso',{alvo,ativo})}catch(e){console.warn('acesso',e)}};
VIEWS.usuarios=async()=>{const g=GEN;await profiles();const tk=await ghToken();if(!vivo(g))return;
M().innerHTML=top('Usuários e acessos','Cadastre colaboradores, ajudantes, motoristas e fornecedores')+`
<div class="box"><div class="box-head"><div><h3>Cadastrar acesso</h3><p>Motorista exige placa e modelo do veículo. Fornecedor acessa o site separado do cliente.</p></div></div>
<form class="uform four" id="nu"><div class="field"><label for="n-nome">Nome completo</label><input id="n-nome" required></div><div class="field"><label for="n-login">Login (ID)</label><input id="n-login" required autocapitalize="none" spellcheck="false"></div>
<div class="field"><label for="n-role">Tipo</label><select id="n-role">${['colaborador','ajudante','motorista','fornecedor','admin'].map(r=>`<option value="${r}">${ROLE_LBL[r]}</option>`).join('')}</select></div><div class="field"><label for="n-pw">Senha inicial</label><input id="n-pw" required minlength="4" autocomplete="new-password" value="${PW_PADRAO}"></div>
<div class="field" data-for="p"><label for="n-tel">Telefone</label><input id="n-tel" type="tel"></div>
<div class="field" data-for="m"><label for="n-placa">Placa</label><input id="n-placa" placeholder="ABC1D23"></div><div class="field" data-for="m"><label for="n-mod">Modelo do veículo</label><select id="n-mod"><option value="">Selecione</option>${VEIC.map(v=>`<option>${v}</option>`).join('')}</select></div>
<div class="field" data-for="e"><label for="n-esc">Escala</label><select id="n-esc"><option value="">Sem escala</option>${ESCALAS.map(e=>`<option value="${e.id}">${esc(e.nome)}</option>`).join('')}</select></div>
<div class="field" data-for="f"><label for="n-cli">Cliente do fornecedor</label><select id="n-cli"><option value="">Selecione</option>${GL_DEMO.CLI.map(c=>`<option>${c}</option>`).join('')}</select></div>
<div class="full"><button class="btn btn-primary">Cadastrar</button></div></form><div class="msg" id="u-msg"></div></div>
<div class="box mt"><div class="box-head"><div><h3>Importar planilha</h3><p>Colunas: NOME, TELEFONE, LOGIN, TIPO (Motorista, Colaborador ou Ajudante), PLACA e MODELO (obrigatórios para motorista) e ESCALA (opcional).</p></div><button type="button" class="btn btn-ghost btn-sm" id="dlm">Baixar modelo</button></div>
<label class="drop"><input type="file" id="imp" accept=".xlsx,.xls,.csv"><span>Escolher planilha (.xlsx ou .csv)</span></label><div id="impout"></div></div>
<div class="box mt"><div class="box-head"><div><h3>Acessos cadastrados</h3><p>${DB.users.length} usuários</p></div><input id="ub" class="sbox" type="search" placeholder="Buscar" aria-label="Buscar usuário"></div>
<div class="table-wrap"><table id="ut"><thead><tr><th>Nome</th><th>Login</th><th>Tipo</th><th>Veículo ou cliente</th><th>Situação</th><th></th></tr></thead><tbody>
${DB.users.map(u=>{const p=u._p||{};return `<tr><td>${esc(p.name||'')}</td><td>${esc(u.login)}</td><td>${ROLE_LBL[u.role]}</td><td>${p.placa?esc(p.placa+' · '+p.modelo):p.cliente?esc(p.cliente):'—'}</td><td><span class="st ${u.active===false?'off':'ok'}">${u.active===false?'Desativado':'Ativo'}</span></td><td><div class="row-actions"><button class="btn btn-ghost btn-sm" data-act="ed" data-l="${esc(u.login)}">Editar</button>${u.login===ME.login?'<small>Você</small>':`<button class="btn btn-ghost btn-sm" data-act="pw" data-l="${esc(u.login)}">Resetar senha</button><button class="btn btn-ghost btn-sm" data-act="tg" data-l="${esc(u.login)}">${u.active===false?'Ativar':'Desativar'}</button><button class="btn btn-danger btn-sm" data-act="rm" data-l="${esc(u.login)}">Excluir</button>`}</div></td></tr>`}).join('')}</tbody></table></div></div>
<div class="box mt"><div class="box-head"><div><h3>Configurações do sistema</h3><p>Conexões técnicas do portal. Só o administrador vê esta área.</p></div></div><details class="gh"${tk?'':' open'}><summary>${tk?'GitHub conectado: alterações são salvas direto no site':'Conectar ao GitHub para salvar alterações no site'}</summary><p class="hint">Cole um token do GitHub com permissão de escrita em Contents no repositório ${REPO}. Ele fica guardado criptografado apenas neste navegador.</p><form class="uform two" id="ghf"><div class="field"><label for="gh-t">Token do GitHub</label><input id="gh-t" type="password" autocomplete="off"></div><button class="btn btn-ghost">${tk?'Trocar token':'Conectar'}</button></form></details><details class="gh"><summary>Chave da automação de Performance</summary><p class="hint">Copie esta chave e cole no GitHub como segredo <b>GETLOG_MASTER_KEY</b> (Settings → Secrets and variables → Actions). Ela tranca os dados de performance antes de irem para o site. Não envie para ninguém.</p><button type="button" class="btn btn-ghost" id="mk-copy">Copiar chave</button></details><details class="gh"${PLAN()?'':' open'}><summary>${PLAN()?'Planilha do ponto conectada':'Conectar a planilha do ponto'}<span id="plv" class="hint"></span></summary><p class="hint">Cole o endereço do App da Web do Apps Script e o mesmo token colocado no código. Fica guardado criptografado no site.</p><form class="uform two" id="plf"><div class="field"><label for="pl-u">Endereço do App da Web</label><input id="pl-u" type="password" autocomplete="off" spellcheck="false" placeholder="https://script.google.com/macros/s/.../exec" value="${esc(CFG.pontoUrl||'')}"></div><div class="field"><label for="pl-t">Token</label><input id="pl-t" type="password" autocomplete="off" value="${esc(CFG.pontoToken||'')}"></div><button class="btn btn-ghost">Salvar e testar</button></form><p class="msg" id="pl-m"></p></details><details class="gh"${CFG.driveToken?'':' open'}><summary>${CFG.driveToken?'Dados da Performance protegidos por token':'Proteger os dados da Performance (token)'}</summary><p class="hint">Gere um token, salve aqui e cole o MESMO token no script do Drive (instruções em <b>docs/drive-apps-script-token.md</b>). Depois disso o script só entrega os dados para quem entrou no portal.</p><form class="uform two" id="dtf"><div class="field"><label for="dt-t">Token do script do Drive</label><input id="dt-t" type="password" autocomplete="off" value="${esc(CFG.driveToken||'')}"></div><button type="button" class="btn btn-ghost" id="dt-g">Gerar token</button><button class="btn btn-ghost">Salvar</button></form><p class="msg" id="dt-m"></p></details></div>`;
const role=$('#n-role');const vis=()=>{const r=role.value;$$('[data-for]').forEach(f=>{const t=f.dataset.for;f.hidden=!(t==='p'&&['colaborador','ajudante','motorista'].includes(r)||t==='m'&&r==='motorista'||t==='e'&&['colaborador','ajudante'].includes(r)||t==='f'&&r==='fornecedor')})};role.onchange=vis;vis();
$('#nu').onsubmit=async e=>{e.preventDefault();const u={name:$('#n-nome').value.trim(),login:norm($('#n-login').value),role:role.value,tel:$('#n-tel').value.trim(),placa:$('#n-placa').value,modelo:$('#n-mod').value,escala:$('#n-esc').value,cliente:$('#n-cli').value};
const m=$('#u-msg');const er=validate(u);if(er.length){m.className='msg err';m.textContent='Confira: '+er.join(', ')+'.';return}if(DB.users.some(x=>x.login===u.login)){m.className='msg err';m.textContent='Esse login já existe.';return}
await addUser(u,$('#n-pw').value);await saveFile('data/users.json',DB,'Acesso de '+u.name+' cadastrado.');keepMsg(VIEWS.usuarios)};
$('#ub').oninput=e=>{const q=norm(e.target.value);$$('#ut tbody tr').forEach(tr=>tr.hidden=q&&!norm(tr.textContent).includes(q))};
$$('[data-act]').forEach(b=>b.onclick=async()=>{const u=DB.users.find(x=>x.login===b.dataset.l);if(!u)return;const n=u._p?.name||u.login;
if(b.dataset.act==='rm'){if(!confirm('Excluir o acesso de '+n+'?'))return;DB.users=DB.users.filter(x=>x!==u);await avisaAcesso(u.login,false);await saveFile('data/users.json',DB,'Acesso de '+n+' excluído.')}
if(b.dataset.act==='tg'){u.active=u.active===false;await avisaAcesso(u.login,u.active);await saveFile('data/users.json',DB,'Acesso de '+n+(u.active?' ativado.':' desativado.'))}
if(b.dataset.act==='pw'){if(!confirm('Resetar a senha de '+n+' para '+PW_PADRAO+'?'))return;Object.assign(u,await credAdmin(u.login,PW_PADRAO));await saveFile('data/users.json',DB,'Senha de '+n+' resetada para '+PW_PADRAO+'.')}
if(b.dataset.act==='ed'){if(!await editUser(u))return}
keepMsg(VIEWS.usuarios)});
$('#dt-g').onclick=()=>{const i=$('#dt-t');i.value=u2b(rnd(24)).replace(/[^A-Za-z0-9]/g,'').slice(0,32);i.type='text';$('#dt-m').className='msg';$('#dt-m').textContent='Copie este token para o script do Drive antes de salvar.'};
$('#dtf').onsubmit=async e=>{e.preventDefault();if(!await confirmaSenha())return;CFG={...CFG,driveToken:$('#dt-t').value.trim()};GL_API.setToken(CFG.driveToken);await saveFile('data/config.json',await seal(CFG),'Token dos dados da Performance salvo.');keepMsg(VIEWS.usuarios)};
$('#plf').onsubmit=async e=>{e.preventDefault();const u=$('#pl-u').value.trim(),t=$('#pl-t').value.trim(),m=$('#pl-m');m.className='msg';m.textContent='Testando…';try{const r=await fetch(u+'?token='+encodeURIComponent(t)+'&desde=9999');const j=await r.json();if(!j.ok)throw new Error(j.erro)}catch(x){m.className='msg err';m.textContent='Não funcionou: confira o endereço e se o token é igual ao do código.';return}CFG={...CFG,pontoUrl:u,pontoToken:t};await saveFile('data/config.json',await seal(CFG),'Planilha do ponto conectada.');keepMsg(VIEWS.usuarios)};v2().then(ok=>{const e=$('#plv');if(e&&PLAN())e.textContent=ok?' · script atualizado':' · script desatualizado: publique a versão nova do arquivo ponto-apps-script.gs'});$('#mk-copy').onclick=async()=>{if(!await confirmaSenha())return;try{await navigator.clipboard.writeText(u2b(MASTER_RAW));$('#mk-copy').textContent='Chave copiada';setTimeout(()=>{navigator.clipboard.writeText('').catch(()=>{});const b=$('#mk-copy');if(b)b.textContent='Copiar chave'},60000)}catch(e){toast('Não foi possível copiar. Tente de novo.')}};$('#ghf').onsubmit=async e=>{e.preventDefault();const t=$('#gh-t').value.trim();if(t){await setToken(t);VIEWS.usuarios()}};
const xlsx=()=>window.XLSX?Promise.resolve():new Promise((ok,no)=>{const s=document.createElement('script');s.src='/assets/vendor/xlsx/xlsx.full.min.js';s.onload=ok;s.onerror=no;document.head.appendChild(s)});
$('#dlm').onclick=async()=>{await xlsx();const ws=XLSX.utils.aoa_to_sheet([['NOME','TELEFONE','LOGIN','TIPO','PLACA','MODELO','ESCALA'],['Maria Exemplo da Silva','(11) 98888-7777','maria.silva','Colaborador','','',ESCALAS[0]?.nome||''],['João Exemplo Souza','(11) 97777-6666','joao.souza','Motorista','ABC1D23','Fiorino','']]);ws['!cols']=[30,16,18,18,14,12,12,18].map(w=>({wch:w}));const ins=XLSX.utils.aoa_to_sheet([['Uma pessoa por linha na aba Usuarios.'],['TIPO: Motorista, Colaborador ou Ajudante.'],['Motorista: PLACA e MODELO obrigatórios. MODELO: '+VEIC.join(', ')+'.'],['LOGIN sem espaços (ex.: nome.sobrenome).'],['ESCALA: nome igual ao cadastrado no portal (opcional).'],['Apague as linhas de exemplo antes de importar.']]);ins['!cols']=[{wch:90}];const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Usuarios');XLSX.utils.book_append_sheet(wb,ins,'Instrucoes');XLSX.writeFile(wb,'modelo-usuarios-getlog.xlsx')};
$('#imp').onchange=async e=>{const f=e.target.files[0];if(!f)return;const out=$('#impout');out.innerHTML='<p class="hint">Lendo planilha...</p>';
try{await xlsx();
const wb=XLSX.read(await f.arrayBuffer());const data=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
const K=o=>{const m={};for(const [k,v] of Object.entries(o))m[k.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase()]=String(v).trim();return m};
const tmap={MOTORISTA:'motorista',COLABORADOR:'colaborador',AJUDANTE:'ajudante'};
const items=data.map(K).filter(r=>r.NOME||r.LOGIN).map(r=>{const es=ESCALAS.find(x=>norm(x.nome)===norm(r.ESCALA));return {name:r.NOME,tel:r.TELEFONE,login:norm(r.LOGIN),role:tmap[(r.TIPO||'').toUpperCase()]||'',placa:r.PLACA,modelo:VEIC.find(v=>norm(v)===norm(r.MODELO))||r.MODELO,escala:es?es.id:''}});
const res=items.map(u=>{const er=validate(u);if(!u.role)er.unshift('TIPO');if(DB.users.some(x=>x.login===u.login)||items.filter(x=>x.login===u.login).length>1)er.push('login repetido');return {u,er}});
const okN=res.filter(x=>!x.er.length).length;
out.innerHTML=`<div class="table-wrap mt"><table><thead><tr><th>Nome</th><th>Login</th><th>Tipo</th><th>Situação</th></tr></thead><tbody>${res.map(({u,er})=>`<tr><td>${esc(u.name)}</td><td>${esc(u.login)}</td><td>${esc(ROLE_LBL[u.role]||'—')}</td><td>${er.length?`<span class="st off">Corrigir: ${esc(er.join(', '))}</span>`:'<span class="st ok">Pronto</span>'}</td></tr>`).join('')}</tbody></table></div>
<div class="row-actions mt" style="justify-content:flex-start"><button class="btn btn-primary" id="impgo"${okN?'':' disabled'}>Cadastrar ${okN} acesso(s)</button></div>`;
$('#impgo').onclick=async()=>{$('#impgo').disabled=true;$('#impgo').textContent='Cadastrando...';const creds=[];for(const {u,er} of res){if(er.length)continue;const pw=PW_PADRAO;await addUser(u,pw);creds.push([u.name,u.login,pw])}
await saveFile('data/users.json',DB,creds.length+' acessos importados.');const csv='NOME;LOGIN;SENHA INICIAL\n'+creds.map(c=>c.join(';')).join('\n');
out.innerHTML=`<p class="msg ok">${creds.length} acessos criados. Baixe a lista de senhas iniciais e entregue a cada pessoa.</p><a class="btn btn-primary" download="senhas-iniciais.csv" href="${URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv'}))}">Baixar senhas iniciais</a>`}}
catch(err){out.innerHTML='<p class="msg err">Não foi possível ler a planilha. Use o modelo em .xlsx e tente de novo.</p>'}}};
VIEWS.escalas=()=>{const D=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
M().innerHTML=top('Escalas','Horários de trabalho usados no controle de ponto')+`<div class="box"><div class="box-head"><div><h3>Nova escala</h3></div></div><form class="uform four" id="ef">
<div class="field"><label for="e-n">Nome</label><input id="e-n" required placeholder="Ex.: Comercial 6x1"></div><div class="field"><label for="e-1">Início</label><input id="e-1" type="time" value="08:00" required></div><div class="field"><label for="e-2">Saída almoço</label><input id="e-2" type="time" value="12:00"></div><div class="field"><label for="e-3">Retorno</label><input id="e-3" type="time" value="13:00"></div><div class="field"><label for="e-4">Fim</label><input id="e-4" type="time" value="17:20" required></div>
<div class="field full"><span class="lbl">Dias</span><div class="days">${D.map((d,i)=>`<label><input type="checkbox" value="${i}"${i<6?' checked':''}>${d}</label>`).join('')}</div></div><div class="full"><button class="btn btn-primary">Criar escala</button></div></form><div class="msg" id="u-msg"></div></div>
<div class="box mt"><div class="table-wrap"><table><thead><tr><th>Escala</th><th>Horário</th><th>Almoço</th><th>Dias</th><th></th></tr></thead><tbody>${ESCALAS.map(e=>`<tr><td>${esc(e.nome)}</td><td>${e.ent} às ${e.sai}</td><td>${e.alm?e.alm+' às '+e.ret:'—'}</td><td>${e.dias.map(i=>D[i]).join(', ')}</td><td><div class="row-actions"><button class="btn btn-danger btn-sm" data-e="${e.id}">Excluir</button></div></td></tr>`).join('')||'<tr><td colspan="5" class="empty">Nenhuma escala criada.</td></tr>'}</tbody></table></div></div>`;
$('#ef').onsubmit=async e=>{e.preventDefault();ESCALAS.push({id:u2b(rnd(6)),nome:$('#e-n').value.trim(),ent:$('#e-1').value,alm:$('#e-2').value,ret:$('#e-3').value,sai:$('#e-4').value,dias:$$('.days input:checked').map(x=>+x.value)});await saveFile('data/escalas.json',await seal(ESCALAS),'Escala criada.');keepMsg(VIEWS.escalas)};
$$('[data-e]').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir esta escala?'))return;ESCALAS=ESCALAS.filter(x=>x.id!==b.dataset.e);await saveFile('data/escalas.json',await seal(ESCALAS),'Escala excluída.');keepMsg(VIEWS.escalas)})};
VIEWS.app=()=>{const scr={inicio:`<div class="ph-h"><b>Olá, ${esc(ME.name.split(' ')[0])}</b><small>Rota de hoje</small></div><div class="ph-k"><div><b>18</b><small>Sellers</small></div><div><b>342</b><small>Pacotes</small></div></div><div class="ph-l"><span>Loja Aurora · Brás</span><span>Bella Moda · Tatuapé</span><span>Casa Prime · Osasco</span></div><div class="ph-b">Iniciar rota</div>`,
coletas:`<div class="ph-h"><b>Coleta</b><small>Bella Moda · 42 pacotes</small></div><div class="ph-scan"><span></span></div><div class="ph-l"><span>Bipados: 38 de 42</span></div><div class="ph-b">Finalizar coleta</div>`,
ponto:`<div class="ph-h"><b>Ponto</b><small>${new Date().toLocaleDateString('pt-BR')}</small></div><div class="ph-face"></div><div class="ph-l"><span>Início 07:58</span><span>Almoço pendente</span></div><div class="ph-b">Registrar com foto</div>`};
M().innerHTML=top('App GETLOG','Aplicativo para motoristas, ajudantes e equipe')+`<div class="banner"><b>Em breve.</b> Esboço do aplicativo em fase de desenvolvimento. As telas abaixo servem só para visualizar a ideia.</div>
<div class="app-grid"><div class="phone"><div class="notch"></div><div class="screen" id="scr"></div><div class="ph-nav">${['inicio','coletas','ponto'].map(k=>`<button data-s="${k}">${({inicio:'Início',coletas:'Coletas',ponto:'Ponto'})[k]}</button>`).join('')}</div></div>
<div class="box"><h3>O que o app vai fazer</h3><ul class="feature-list"><li>Rota do dia com os sellers em ordem</li><li>Bipagem dos pacotes pela câmera</li><li>Ponto com foto e localização</li><li>Avisos da operação em tempo real</li><li>Funciona com internet fraca</li></ul><button class="btn btn-ghost mt" disabled>Baixar app (em breve)</button></div></div>`;
const set=k=>{$('#scr').innerHTML=scr[k];$$('[data-s]').forEach(b=>b.dataset.s===k?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current'))};$$('[data-s]').forEach(b=>b.onclick=()=>set(b.dataset.s));set('inicio')};
// Mantém a pessoa logada ao recarregar ou abrir o link de outra tela na mesma aba.
})();
