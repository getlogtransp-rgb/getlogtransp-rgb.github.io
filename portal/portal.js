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
let CFG={},DB=null,MASTER=null,MASTER_RAW=null,ME=null,AVISOS=[],ESCALAS=[],ROWS=null,UPD='';
const ROLE_LBL={admin:'Administrador',colaborador:'Colaborador',ajudante:'Ajudante',motorista:'Motorista',fornecedor:'Fornecedor'};
const VEIC=['Fiorino','Van','VUC','HR','3/4','Carreta','Carro','Moto'];
const ACC={admin:['dash','coletados','perf','forecast','ponto','pontoadm','avisos','usuarios','escalas','app'],colaborador:['dash','coletados','perf','forecast','ponto','avisos','app'],ajudante:['coletados','ponto','avisos','app'],motorista:['perf','avisos','app']};
async function kek(pw,salt,iter){const base=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:iter,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
async function seal(obj){const iv=rnd(12);return {iv:u2b(iv),ct:u2b(await crypto.subtle.encrypt({name:'AES-GCM',iv},MASTER,enc.encode(JSON.stringify(obj))))}}
async function open_(o){return JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:b2u(o.iv)},MASTER,b2u(o.ct))))}
async function wrapFor(pw){const salt=rnd(16),iv=rnd(12);const k=await kek(pw,salt,DB.iter);return {salt:u2b(salt),iv:u2b(iv),key:u2b(await crypto.subtle.encrypt({name:'AES-GCM',iv},k,MASTER_RAW))}}
const getJSON=async p=>{const r=await fetch(p+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('db');return r.json()};
async function loadDB(){DB=await getJSON('/data/users.json')}
async function profiles(){for(const u of DB.users){if(u._p)continue;try{u._p=await open_(u.p)}catch(e){u._p={}}}}
async function loadShared(){try{AVISOS=await open_(await getJSON('/data/avisos.json'))}catch(e){AVISOS=[]}try{ESCALAS=await open_(await getJSON('/data/escalas.json'))}catch(e){ESCALAS=[]}try{CFG=await open_(await getJSON('/data/config.json'))}catch(e){CFG={}}}
async function senhaPlan(login){if(!DB.senhaUrl)return null;try{const c=new AbortController();setTimeout(()=>c.abort(),7000);const j=await (await fetch(DB.senhaUrl+'?senha='+encodeURIComponent(login),{signal:c.signal})).json();return j.ok&&j.dados&&j.dados.key?j.dados:null}catch(e){return null}}
async function login(u,pw){await loadDB();const usr=DB.users.find(x=>x.login===norm(u));if(!usr)throw new Error('cred');let raw;
const sp=await senhaPlan(usr.login);const novo=sp&&(!usr.pwEm||sp.em>usr.pwEm);const tries=novo?[sp]:[usr];
for(const w of tries){try{const k=await kek(pw,b2u(w.salt),DB.iter);raw=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:b2u(w.iv)},k,b2u(w.key)));usr._troca=usr.mustChange&&w===usr;break}catch(e){}}
if(!raw)throw new Error('cred')
if(usr.active===false)throw new Error('off');return {usr,raw}}
async function start(usr,raw){
MASTER_RAW=raw;MASTER=await crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt']);
await profiles();const p=usr._p||{};
ME={login:usr.login,role:usr.role,name:p.name||usr.login,ref:p.ref||'',cliente:p.cliente||''};
sessionStorage.setItem(S_KEY,JSON.stringify({...ME,k:u2b(raw),troca:!!usr._troca}));
if(ME.role==='fornecedor'){location.replace('/cliente/');return}
await loadShared();$('#login').hidden=true;$('#app').hidden=false;document.title='Portal | GETLOG Transportes';shell();popupAvisos();
}
const form=$('#loginForm'),msg=$('#msg'),go=$('#go');
$('#eye').addEventListener('click',()=>{const p=$('#p');const s=p.type==='password';p.type=s?'text':'password';$('#eye').setAttribute('aria-label',s?'Ocultar senha':'Mostrar senha')});
form.addEventListener('submit',async e=>{e.preventDefault();const u=$('#u').value,p=$('#p').value;
if(!u.trim()||!p){msg.className='msg err';msg.textContent='Preencha usuário e senha.';return}
go.disabled=true;go.textContent='Verificando...';msg.textContent='';
try{const {usr,raw}=await login(u,p);await start(usr,raw)}catch(err){msg.className='msg err';msg.textContent=err.message==='off'?'Este acesso está desativado. Fale com o administrador.':err.message==='db'?'Não foi possível carregar os acessos. Verifique a conexão e tente de novo.':'Usuário ou senha incorretos.';go.disabled=false;go.textContent='Entrar'}});
(async()=>{const s=sessionStorage.getItem(S_KEY);if(!s){$('#u').focus();return}
try{const o=JSON.parse(s);await loadDB();const usr=DB.users.find(x=>x.login===o.login);if(!usr||usr.active===false)throw 0;await start(usr,b2u(o.k))}catch(e){sessionStorage.removeItem(S_KEY)}})();
const ic=d=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC={dash:ic('<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>'),coletados:ic('<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>'),perf:ic('<path d="M4 18a8 8 0 1 1 16 0"/><path d="m12 18 4-6"/>'),forecast:ic('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),ponto:ic('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>'),pontoadm:ic('<path d="M9 5H5v14h14v-4"/><path d="M9 13l3 3 9-9"/>'),avisos:ic('<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>'),usuarios:ic('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.8.7 3 2.5 3.5 5.2"/>'),escalas:ic('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 13h3M8 17h8"/>'),app:ic('<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>'),menu:ic('<path d="M4 7h16M4 12h16M4 17h16"/>'),x:ic('<path d="M6 6l12 12M18 6 6 18"/>'),cam:ic('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>')};
const NAV=[['Visão geral',[['dash','Dashboard']]],['Operação',[['coletados','Pacotes coletados'],['perf','Performance'],['forecast','Forecast']]],['Pessoas',[['ponto','Bater ponto'],['pontoadm','Controle de ponto']]],['Comunicação',[['avisos','Avisos']]],['Gestão',[['usuarios','Usuários e acessos'],['escalas','Escalas']]],['Aplicativo',[['app','App GETLOG']]]];
const SHORT={dash:'Início',coletados:'Coletados',perf:'Performance',forecast:'Forecast',ponto:'Ponto',avisos:'Avisos',app:'App'};
const can=v=>ACC[ME.role].includes(v);
function shell(){
const groups=NAV.map(([g,items])=>{const it=items.filter(([v])=>can(v));if(!it.length)return '';return `<h5>${g}</h5>`+it.map(([v,l])=>`<button data-view="${v}">${IC[v]}<span>${l}</span>${v==='app'?'<span class="badge">Em breve</span>':''}</button>`).join('')}).join('');
const mob=ACC[ME.role].filter(v=>SHORT[v]).slice(0,4);
$('#app').innerHTML=`<div class="app"><aside class="side" aria-label="Menu do portal"><a class="logo-chip" href="/"><img src="/assets/logo-getlog.webp" alt="GETLOG Transportes" width="88" height="36"></a>${groups}
<div class="who"><b>${esc(ME.name)}</b><span>${ROLE_LBL[ME.role]}</span><div class="row"><a href="/">Ver site</a><button class="out" id="sair" type="button">Sair</button></div></div></aside>
<div class="scrim" id="scrim"></div><main class="main" id="main"></main>
<nav class="bnav" aria-label="Navegação rápida">${mob.map(v=>`<button data-view="${v}">${IC[v]}<span>${SHORT[v]}</span></button>`).join('')}<button id="more">${IC.menu}<span>Menu</span></button></nav></div>`;
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.view)));
$('#sair').onclick=()=>{sessionStorage.removeItem(S_KEY);location.reload()};
$('#more').onclick=()=>{$('.side').classList.add('open');$('#scrim').classList.add('on')};
$('#scrim').onclick=()=>{$('.side').classList.remove('open');$('#scrim').classList.remove('on')};
const h=location.hash.slice(1);show(can(h)?h:ACC[ME.role][0]);
}
addEventListener('hashchange',()=>{const h=location.hash.slice(1);if(ME&&can(h)&&h!==CUR)show(h)});
let CUR='';function show(v){if(!can(v))return;CUR=v;if(location.hash.slice(1)!==v)location.hash=v;document.title=(SHORT[v]||'Portal')+' | GETLOG';$$('[data-view]').forEach(b=>b.dataset.view===v?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current'));$('.side').classList.remove('open');$('#scrim').classList.remove('on');scrollTo(0,0);if(v==='forecast'){if(!LOADF)M().innerHTML='<p class="hint">Carregando dados…</p>';loadF(false).then(()=>{if(CUR===v)VIEWS[v]()});return}
if(['dash','coletados'].includes(v)&&!LOADING){M().innerHTML='<p class="hint">Carregando dados…</p>';loadReal().then(()=>VIEWS[v]())}else if(LOADING&&['dash','coletados'].includes(v))LOADING.then(()=>VIEWS[v]());else VIEWS[v]()}
const M=()=>$('#main');
const top=(t,sub,upd)=>`<div class="topbar"><div><h1>${t}</h1><p>${sub}</p></div><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">${upd?`<span class="upd"><i></i>Última atualização: ${esc(upd)}</span>`:''}${['dash','coletados','forecast'].includes(CUR)?`<button class="btn btn-ghost btn-sm" type="button" data-glref>↻ Atualizar</button>`:''}</div></div>`;
const demoNote='<div class="notice"><b>Protótipo com dados fictícios.</b> Os números reais entram quando a API dos dados oficiais for conectada.</div>';
let REAL=false,LOADING=null;
// Monta as linhas a partir de {dia:{colunas,linhas,atualizado_em}}. "t" = pacotes da GETLOG que chegaram na DS FM NOR.
function build(d){const out=[];let up='';
for(const [k,v] of Object.entries(d)){if(!v||!Array.isArray(v.colunas))continue;const c=v.colunas,ix=n=>c.indexOf(n);const I={s:ix('SELLER'),c:ix('CLIENTE'),r:ix('REGIÃO'),mo:ix('MOTORISTA OFICIAL'),ma:ix('MOTORISTA ATRIBUÍDO'),st:ix('STATUS DO SELLER'),p:ix('PREVISTO'),t:ix('COLETADO TOTAL'),fm:ix('COLETADO DS FM NOR'),a:ix('AJUDANTE'),b:ix('BAIRRO'),ci:ix('CIDADE'),cep:ix('CEP'),pri:ix('TIPO DE PRIORIDADE')};
const g=(r,i)=>i<0?'':r[i];if(v.atualizado_em&&(!up||v.atualizado_em>up))up=v.atualizado_em;
for(const r of v.linhas){const m=g(r,I.mo)||g(r,I.ma);out.push({d:k,s:g(r,I.s),c:g(r,I.c),r:g(r,I.r),m,ma:g(r,I.ma),st:g(r,I.st),p:+g(r,I.p)||0,t:String(m).toUpperCase().startsWith('GET')?(+(I.fm>=0?g(r,I.fm):g(r,I.t))||0):0,a:g(r,I.a),b:g(r,I.b),ci:g(r,I.ci),cep:g(r,I.cep),pri:g(r,I.pri)})}}
if(up){const [dd,hh='']=up.split(' ');UPD=dd.split('-').reverse().join('/')+(hh?' às '+hh.slice(0,5):'')}return out.sort((a,b)=>a.d<b.d?-1:1)}
function rows(){if(!ROWS)ROWS=build(GL_DEMO.days(62));return ROWS}
async function openDay(o){let raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:b2u(o.iv)},MASTER,b2u(o.ct));
if(o.z==='gzip')raw=await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();return JSON.parse(dec.decode(raw))}
// Lê os dias publicados pela automação do Drive (portal/dados). Sem arquivos, fica nos dados de exemplo.
let FORCE=false,SIGP='',ROWSF=null,LOADF=null,UPDF='',SIGF='';
function loadReal(){return LOADING||(LOADING=(async()=>{try{const L=await GL_API.lista(FORCE);SIGP=L.map(x=>x.dia+x.modificadoEm).join('|');const all={};
await Promise.all(L.map(async x=>{const m=x.dia.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);if(!m)return;try{const r=await GL_API.dia(x.dia,FORCE);if(!r)return;const d=JSON.parse(r.txt);
if(Array.isArray(d.colunas))all[`${m[3]}-${m[2]}-${m[1]}`]=d;else Object.assign(all,d)}catch(e){console.warn('dia ilegível',x.dia,e)}}));
const b=build(all);if(b.length){ROWS=b;REAL=true}}catch(e){}})())}
function buildF(g){const c=g.colunas,ix=n=>c.indexOf(n);const I={d:ix('DATA'),s:ix('SELLER'),b:ix('BAIRRO'),ci:ix('CIDADE'),m:ix('MOTORISTA'),pri:ix('PRIORIDADE ?'),a:ix('AJUDANTE?')};
const CL=['SHEIN BRA','SHEIN D2D','TIKTOK','KWAI'].map(n=>[n,ix(n)]).filter(x=>x[1]>=0);const g2=(r,i)=>i<0?'':String(r[i]??'').trim();const out=[];
for(const r of g.linhas){const d=g2(r,I.d);if(!/^\d{4}-\d{2}-\d{2}$/.test(d))continue;for(const [cn,ci] of CL){const p=+g2(r,ci).replace(',','.')||0;if(!p)continue;out.push({d,s:g2(r,I.s),c:cn,r:g2(r,I.ci),b:g2(r,I.b),ci:g2(r,I.ci),m:g2(r,I.m)||'SEM MOTORISTA',p,pri:g2(r,I.pri),a:g2(r,I.a)})}}return out}
function loadF(reload,force){if(LOADF&&!reload)return LOADF;LOADF=(async()=>{try{const j=await GL_API.geral(!!force);const sig=j.dados.arquivos.map(a=>a.arquivo+':'+a.linhas).join('|');ROWSF=buildF(j.dados);SIGF=sig;const [dd,hh='']=String(j.atualizadoEm).split('T');UPDF=dd.split('-').reverse().join('/')+(hh?' às '+hh.slice(0,5):'')}catch(e){console.warn('geral',e);if(!ROWSF)ROWSF=[]}})();return LOADF}
async function refreshData(force){const v=CUR;
if(v==='forecast'){const s0=SIGF;await loadF(true,force);if(force||SIGF!==s0)if(CUR===v)VIEWS[v]();return}
if(['dash','coletados'].includes(v)){const s0=SIGP;FORCE=!!force;LOADING=null;await loadReal();FORCE=false;if(force||SIGP!==s0)if(CUR===v)VIEWS[v]()}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-glref]');if(!b)return;b.disabled=true;b.textContent='Atualizando…';
if(CUR==='perf'){const f=$('#pf');Promise.resolve(f&&f.contentWindow&&f.contentWindow.checkUpdates&&f.contentWindow.checkUpdates(true)).finally(()=>{b.disabled=false;b.textContent='Atualizar'});return}
refreshData(true).finally(()=>{b.disabled=false;b.textContent='Atualizar'})});
setInterval(()=>{if(document.hidden||!ME)return;if(CUR==='forecast'&&GL_API.naJanela('geral'))refreshData(false);else if(['dash','coletados'].includes(CUR)&&GL_API.naJanela('performance'))refreshData(false)},GL_API.INTERVALO_MS);
const dn=()=>REAL?'':demoNote;
const nm=m=>{m=String(m||'');const i=m.indexOf(' - ');return i>0?m.slice(i+3):m};
const keyD=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const today=()=>keyD(new Date());
const lblD=k=>k.split('-').reverse().slice(0,2).join('/');
function periodUI(id,modes){const t=today(),mo=t.slice(0,7),q=+t.slice(8)<=15?1:2;
return `<div class="per" id="${id}"><select class="pm" aria-label="Período">${modes.map(m=>`<option value="${m}">${({dia:'Dia',semana:'Semana',quinzena:'Quinzena',mes:'Mês'})[m]}</option>`).join('')}</select>
<input type="date" class="pd" value="${t}" aria-label="Data"><input type="month" class="pmo" value="${mo}" hidden aria-label="Mês"><select class="pq" hidden aria-label="Quinzena"><option value="1"${q===1?' selected':''}>1ª quinzena (1 a 15)</option><option value="2"${q===2?' selected':''}>2ª quinzena (16 ao fim)</option></select></div>`}
function periodRange(el){const m=$('.pm',el).value;const d=$('.pd',el),mo=$('.pmo',el),q=$('.pq',el);
d.hidden=!(m==='dia'||m==='semana');mo.hidden=!(m==='mes'||m==='quinzena');q.hidden=m!=='quinzena';
if(m==='dia')return [d.value,d.value,'Dia '+lblD(d.value)];
if(m==='semana'){const x=new Date(d.value+'T12:00');const w=(x.getDay()+6)%7;x.setDate(x.getDate()-w);const a=keyD(x);x.setDate(x.getDate()+6);const b=keyD(x);return [a,b,'Semana de '+lblD(a)+' a '+lblD(b)]}
const [Y,Mn]=mo.value.split('-').map(Number);const last=new Date(Y,Mn,0).getDate();const ML=new Date(Y,Mn-1,1).toLocaleDateString('pt-BR',{month:'long'});
if(m==='mes')return [mo.value+'-01',mo.value+'-'+last,ML+' de '+Y];
return q.value==='1'?[mo.value+'-01',mo.value+'-15','1ª quinzena de '+ML]:[mo.value+'-16',mo.value+'-'+last,'2ª quinzena de '+ML]}
const opts=(arr,all)=>`<option value="">${all}</option>`+[...new Set(arr)].sort().map(x=>`<option>${esc(x)}</option>`).join('');
function hbars(list,max){max=max||Math.max(1,...list.map(x=>x[1]));return '<div class="hb">'+list.map(([l,v])=>`<div class="hbr"><span class="hbl" title="${esc(l)}">${esc(l)}</span><span class="hbt"><i style="width:${Math.max(2,v/max*100)}%"></i></span><b>${N(v)}</b></div>`).join('')+'</div>'}
function vbars(list){const max=Math.max(1,...list.map(x=>x[1]));const sm=list.length>16;return `<div class="vb${sm?' sm':''}">`+list.map(([l,v],i)=>`<div class="vbc${i===list.length-1?' hot':''}" title="${esc(l)}: ${N(v)}"><em>${sm&&v>=1000?(v/1000).toFixed(1).replace('.',',')+'k':N(v)}</em><i style="height:${Math.max(3,v/max*100)}%"></i><span>${esc(l)}</span></div>`).join('')+'</div>'}
const group=(arr,f,val)=>{const m=new Map();for(const r of arr){const k=f(r);m.set(k,(m.get(k)||0)+val(r))}return [...m]};
const VIEWS={};
VIEWS.dash=()=>{const R=rows();const dates=[...new Set(R.map(r=>r.d))];const t=dates.at(-1),prevD=dates.at(-2);
const tot=k=>R.filter(r=>r.d===k).reduce((a,r)=>a+r.t,0);const hoje=tot(t),ont=tot(prevD);const var_=ont?((hoje-ont)/ont*100):0;
const rt=R.filter(r=>r.d===t);
M().innerHTML=top('Visão geral da operação','Acompanhamento diário da GETLOG',UPD)+dn()+`
<div class="kpi-grid"><div class="kpi"><small>Pacotes coletados hoje</small><b>${N(hoje)}</b><span class="${var_>=0?'up':'down'}">${var_>=0?'+':''}${var_.toFixed(1).replace('.',',')}% comparado ao dia anterior</span></div>
<div class="kpi"><small>Clientes em operação</small><b>${new Set(rt.map(r=>r.c)).size}</b><span>Com coleta hoje</span></div>
<div class="kpi"><small>Sellers atendidos</small><b>${new Set(rt.map(r=>r.s)).size}</b><span>Capital e Grande SP</span></div>
<div class="kpi"><small>Motoristas em rota</small><b>${new Set(rt.map(r=>r.m)).size}</b><span>Frota GETLOG</span></div></div>
<div class="grid-2"><div class="box"><div class="box-head"><div><h3>Pacotes coletados por dia</h3><p>Quantidade total coletada</p></div><div class="seg" id="seg"><button data-n="7" aria-pressed="true">7 dias</button><button data-n="15" aria-pressed="false">15 dias</button><button data-n="30" aria-pressed="false">30 dias</button></div></div><div id="dch"></div></div>
<div class="box"><div class="box-head"><div><h3>Por cliente hoje</h3><p>Pacotes coletados</p></div></div>${hbars(group(rt,r=>r.c,r=>r.t).sort((a,b)=>b[1]-a[1]))}</div></div>
<div class="grid-2 eq"><div class="box"><div class="box-head"><div><h3>Por região hoje</h3><p>Pacotes coletados</p></div></div>${hbars(group(rt,r=>r.r,r=>r.t).sort((a,b)=>b[1]-a[1]))}</div>
<div class="box"><div class="box-head"><div><h3>Avisos recentes</h3><p>Comunicados para você</p></div><button class="btn btn-ghost btn-sm" data-go="avisos">Ver todos</button></div><div class="news">${myAvisos().slice(0,3).map(avHTML).join('')||'<p class="empty">Nenhum aviso no momento.</p>'}</div></div></div>`;
const draw=n=>{$('#dch').innerHTML=vbars(dates.slice(-n).map(k=>[lblD(k),tot(k)]))};draw(7);
$$('#seg button').forEach(b=>b.onclick=()=>{$$('#seg button').forEach(x=>x.setAttribute('aria-pressed',x===b));draw(+b.dataset.n)});
$$('[data-go]').forEach(b=>b.onclick=()=>show(b.dataset.go))};
VIEWS.coletados=()=>{const R=rows();const own=ME.role==='ajudante';const base=own?R.filter(r=>norm(r.a)===norm(ME.ref)):R;
M().innerHTML=top(own?'Meus pacotes coletados':'Pacotes coletados',own?'Somente as coletas em que você participou':'Pacotes da GETLOG recebidos na DS FM NOR',UPD)+dn()+`<p style="margin:-6px 0 14px"><a class="btn btn-ghost" style="padding:8px 14px" href="${GL_API.PASTA_COLETADOS}" target="_blank" rel="noopener">Acessar pasta dos coletados</a></p>
<div class="filters">${periodUI('per',['dia','semana','quinzena','mes'])}${own?'':`<select id="fm" aria-label="Motorista">${opts(base.map(r=>nm(r.m)),'Todos os motoristas')}</select>`}
<select id="fr" aria-label="Região">${opts(base.map(r=>r.r),'Todas as regiões')}</select><input id="fs" type="search" placeholder="Buscar seller" aria-label="Seller"></div><div id="cout"></div>`;
const run=()=>{const [a,b,lbl]=periodRange($('#per'));const fm=own?'':$('#fm').value,fr=$('#fr').value,fs=norm($('#fs').value);
const f=base.filter(r=>r.d>=a&&r.d<=b&&(!fm||nm(r.m)===fm)&&(!fr||r.r===fr)&&(!fs||norm(r.s).includes(fs)));
const tot=f.reduce((x,r)=>x+r.t,0);const days=[...new Set(f.map(r=>r.d))];const sel=group(f,r=>r.s+'|'+r.c+'|'+r.r+'|'+nm(r.m),r=>r.t).sort((a,b)=>b[1]-a[1]).filter(x=>x[1]>0);
$('#cout').innerHTML=`<div class="kpi-grid"><div class="kpi"><small>Pacotes coletados</small><b>${N(tot)}</b><span>${esc(lbl)}</span></div><div class="kpi"><small>Dias com coleta</small><b>${days.length}</b><span>No período</span></div><div class="kpi"><small>Média por dia</small><b>${N(Math.round(tot/Math.max(1,days.length)))}</b><span>Pacotes</span></div><div class="kpi"><small>Sellers atendidos</small><b>${N(new Set(f.map(r=>r.s)).size)}</b><span>No período</span></div></div>
${days.length?`<div class="box mt"><div class="box-head"><div><h3>Pacotes coletados por dia</h3><p>${esc(lbl)}</p></div></div>${vbars(group(f,r=>lblD(r.d),r=>r.t))}</div>
<div class="grid-2 eq">${own?'':`<div class="box"><div class="box-head"><div><h3>Ranking de motoristas</h3><p>Top 10 no período</p></div></div>${hbars(group(f,r=>nm(r.m),r=>r.t).sort((a,b)=>b[1]-a[1]).slice(0,10))}</div>`}
<div class="box"><div class="box-head"><div><h3>Top sellers</h3><p>Top 10 no período</p></div></div>${hbars(group(f,r=>r.s,r=>r.t).sort((a,b)=>b[1]-a[1]).slice(0,10))}</div>
<div class="box"><div class="box-head"><div><h3>Por região</h3><p>Pacotes coletados</p></div></div>${hbars(group(f,r=>r.r,r=>r.t).sort((a,b)=>b[1]-a[1]))}</div>
<div class="box"><div class="box-head"><div><h3>Por cliente</h3><p>Pacotes coletados</p></div></div>${hbars(group(f,r=>r.c,r=>r.t).sort((a,b)=>b[1]-a[1]))}</div></div>
<div class="box mt"><div class="box-head"><div><h3>Detalhe por seller</h3><p>${N(sel.length)} sellers com coleta${sel.length>200?' · mostrando os 200 maiores':''}</p></div></div><div class="table-wrap"><table><thead><tr><th>Seller</th><th>Cliente</th><th>Região</th>${own?'':'<th>Motorista</th>'}<th class="n">Pacotes</th></tr></thead><tbody>${sel.slice(0,200).map(([k,v])=>{const [s,c,r,m]=k.split('|');return `<tr><td>${esc(s)}</td><td>${esc(c)}</td><td>${esc(r)}</td>${own?'':`<td>${esc(m)}</td>`}<td class="n">${N(v)}</td></tr>`}).join('')}</tbody></table></div></div>`:'<p class="empty box mt">Nenhuma coleta encontrada para esse filtro. Troque o período ou limpe os filtros.</p>'}`};
$$('#per select,#per input,#fm,#fr').forEach(e=>e&&e.addEventListener('change',run));$('#fs').addEventListener('input',run);run()};
VIEWS.perf=()=>{M().innerHTML=`<div class="perf-wrap"><iframe src="/portal/performance.html?v=8" title="Performance de coleta" id="pf"></iframe></div>`;
const f=$('#pf');const fit=()=>{try{const h=f.contentDocument.documentElement.scrollHeight;if(h)f.style.height=Math.max(h,innerHeight-40)+'px'}catch(e){}};f.addEventListener('load',()=>{fit();try{new ResizeObserver(fit).observe(f.contentDocument.body)}catch(e){}})};
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
M().innerHTML=top('Forecast','Sellers e pacotes previstos por motorista e cidade · aba GERAL',UPDF)+`
<div class="filters"><select id="xd" aria-label="Dia">${dates.map(d=>`<option value="${d}">${d.split('-').reverse().join('/')}</option>`).join('')}</select>
<select id="xr" aria-label="Região"></select><select id="xm" aria-label="Motorista"></select><select id="xc" aria-label="Cliente"></select><select id="xp" aria-label="Prioridade"></select><input id="xs" type="search" placeholder="Buscar seller ou bairro" aria-label="Buscar"></div>
<div id="xk"></div><div class="grid-2"><div class="box"><div class="box-head"><div><h3>Mapa dos sellers previstos</h3><p>Cada cor é um motorista · círculo maior = mais pacotes · posição aproximada pelo bairro</p></div></div><div id="xmap" style="height:460px;border-radius:12px"></div><p class="hint" id="xgeo"></p></div>
<div class="box"><div class="box-head"><div><h3>Motoristas</h3><p>Clique para filtrar</p></div></div><div id="xleg" style="max-height:470px;overflow:auto"></div></div></div>
<div class="grid-2"><div class="box"><div class="box-head"><div><h3>Por região</h3><p>Sellers · pacotes previstos</p></div></div><div id="xreg"></div></div><div class="box"><div class="box-head"><div><h3>Por cliente</h3><p>Pacotes previstos</p></div></div><div id="xcli"></div></div></div>`;
const day=()=>R.filter(r=>r.d===$('#xd').value);
const fill=()=>{const D=day();for(const [id,f,l] of [['xr',r=>r.r,'Todas as regiões'],['xm',r=>nm(r.m),'Todos os motoristas'],['xc',r=>r.c,'Todos os clientes'],['xp',r=>r.pri,'Todas as prioridades']]){const el=$('#'+id),v=el.value;el.innerHTML=opts(D.map(f).filter(Boolean),l);el.value=[...el.options].some(o=>o.value===v)?v:''}};
const color=new Map();const col=m=>{if(!color.has(m))color.set(m,PAL[color.size%PAL.length]);return color.get(m)};
let map=null,layer=null,run_id=0;
const run=async()=>{const id=++run_id;const fr=$('#xr').value,fm=$('#xm').value,fc=$('#xc').value,fp=$('#xp').value,fs=norm($('#xs').value);
const f=day().filter(r=>(!fr||r.r===fr)&&(!fm||nm(r.m)===fm)&&(!fc||r.c===fc)&&(!fp||r.pri===fp)&&(!fs||norm(r.s+' '+r.b).includes(fs)));
const sel=new Map();for(const r of f){const k=r.s;const o=sel.get(k)||{s:r.s,c:r.c,r:r.r,b:r.b,ci:r.ci,m:nm(r.m),p:0};o.p+=r.p;sel.set(k,o)}const S=[...sel.values()];
const mots=group(S,x=>x.m,x=>x.p).sort((a,b)=>b[1]-a[1]);mots.forEach(([m])=>col(m));
$('#xk').innerHTML=`<div class="kpi-grid"><div class="kpi"><small>Pacotes previstos</small><b>${N(S.reduce((a,x)=>a+x.p,0))}</b><span>${lblD($('#xd').value)}</span></div><div class="kpi"><small>Sellers previstos</small><b>${N(S.length)}</b><span>No filtro</span></div><div class="kpi"><small>Motoristas</small><b>${mots.length}</b><span>Com seller previsto</span></div><div class="kpi"><small>Regiões</small><b>${new Set(S.map(x=>x.r)).size}</b><span>Atendidas</span></div></div>`;
$('#xleg').innerHTML='<div class="hb">'+mots.map(([m,v])=>`<div class="hbr" data-m="${esc(m)}" style="cursor:pointer"><span class="hbl" title="${esc(m)}"><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${col(m)};margin-right:6px"></i>${esc(m)}</span><small>${S.filter(x=>x.m===m).length} sellers</small><b>${N(v)}</b></div>`).join('')+'</div>';
$$('#xleg [data-m]').forEach(e=>e.onclick=()=>{$('#xm').value=$('#xm').value===e.dataset.m?'':e.dataset.m;run()});
$('#xreg').innerHTML=hbars(group(S,x=>x.r+' · '+S.filter(y=>y.r===x.r).length+' sellers',x=>x.p).sort((a,b)=>b[1]-a[1]));
$('#xcli').innerHTML=hbars(group(S,x=>x.c,x=>x.p).sort((a,b)=>b[1]-a[1]));
try{await loadOnce('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css');await loadOnce('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js')}catch(e){$('#xmap').innerHTML='<p class="hint">Não foi possível carregar o mapa.</p>';return}
if(id!==run_id||!$('#xmap'))return;
if(!map||!document.body.contains(map.getContainer())){map=L.map('xmap').setView([-23.55,-46.63],10);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap'}).addTo(map);layer=L.layerGroup().addTo(map)}
layer.clearLayers();const pts=[];let miss=0,done=0;const tot=S.length;
for(const x of S){const c=await geo(x.b,x.ci);if(id!==run_id)return;done++;
if(!c){miss++}else{const h=hsh(x.s);const ll=[c[0]+((h&1023)/1023-.5)*.012,c[1]+(((h>>10)&1023)/1023-.5)*.012];pts.push(ll);
L.circleMarker(ll,{radius:Math.min(18,4+Math.sqrt(x.p)),color:'#fff',weight:1,fillColor:col(x.m),fillOpacity:.85}).bindPopup(`<b>${esc(x.s)}</b><br>${esc(x.c)} · ${esc(x.b)} – ${esc(x.ci)}<br>Motorista: ${esc(x.m)}<br>Previsto: <b>${N(x.p)}</b> pacotes`).addTo(layer)}
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
(async()=>{await profiles();$('#av-u').innerHTML=DB.users.filter(u=>u.role!=='fornecedor').map(u=>`<option value="${esc(u.login)}">${esc(u._p.name||u.login)} (${ROLE_LBL[u.role]})</option>`).join('')})();
$('#av-p').onchange=()=>$('#av-uw').hidden=$('#av-p').value!=='user';
$('#avf').onsubmit=async e=>{e.preventDefault();const p=$('#av-p').value;AVISOS.push({id:u2b(rnd(6)),titulo:$('#av-t').value.trim(),msg:$('#av-m').value.trim(),para:p==='user'?'user:'+$('#av-u').value:p,ate:$('#av-a').value||'',em:new Date().toISOString()});await saveFile('data/avisos.json',await seal(AVISOS),'Aviso enviado.');keepMsg(VIEWS.avisos)};
$$('[data-del]').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir este aviso?'))return;AVISOS=AVISOS.filter(a=>a.id!==b.dataset.del);await saveFile('data/avisos.json',await seal(AVISOS),'Aviso excluído.');keepMsg(VIEWS.avisos)})};
const TIPOS=[['entrada','Início da jornada'],['almoco','Saída para almoço'],['retorno','Retorno do almoço'],['saida','Fim da jornada']];
const pontoAll=()=>{try{return JSON.parse(localStorage.getItem(PONTO_KEY))||[]}catch(e){return []}};
const PLAN=()=>CFG.pontoUrl&&CFG.pontoToken;
// Envia para a planilha as marcações deste aparelho que ainda não foram. As já enviadas de dias anteriores saem do celular.
let SYNC=null;const syncPonto=()=>SYNC||(SYNC=syncPonto_().finally(()=>SYNC=null));
async function syncPonto_(){if(!PLAN())return 0;const all=pontoAll();let mud=false;
for(const p of all){if(p.sent)continue;if(!p.id)p.id=u2b(rnd(9));try{const r=await fetch(CFG.pontoUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...p,token:CFG.pontoToken})});const j=await r.json();if(j.ok){p.sent=true;mud=true}}catch(e){break}}
const keep=all.filter(p=>!p.sent||p.dia===today());if(mud||keep.length<all.length)try{localStorage.setItem(PONTO_KEY,JSON.stringify(keep))}catch(e){}return keep.filter(p=>!p.sent).length}
const plan=async q=>{const r=await fetch(CFG.pontoUrl+'?token='+encodeURIComponent(CFG.pontoToken)+'&'+q);const j=await r.json();if(!j.ok)throw new Error(j.erro||'planilha');return j};
const hm=ts=>new Date(ts).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
let CLK=null;
VIEWS.ponto=()=>{syncPonto();const consent=localStorage.getItem(CONS_KEY+'_'+ME.login);
const mine=pontoAll().filter(p=>p.login===ME.login&&p.dia===today());const next=TIPOS.find(([t])=>!mine.some(p=>p.tipo===t));
const esc_=ESCALAS.find(e=>e.id===(DB.users.find(u=>u.login===ME.login)?._p?.escala));
M().innerHTML=top('Bater ponto',new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'}))+`${PLAN()?'':'<div class="banner">A planilha do ponto ainda não foi configurada: as marcações ficam guardadas neste aparelho e serão enviadas quando ela for ligada.</div>'}
${consent?'':`<div class="box consent"><h3>Antes de começar</h3><p>Para registrar o ponto, a GETLOG coleta uma foto do seu rosto, sua localização (endereço, latitude e longitude) e o horário de cada marcação. Esses dados são usados somente para controle de jornada e ficam visíveis apenas para a administração.</p><label class="check"><input type="checkbox" id="cs"> Li e autorizo o uso desses dados para o controle de ponto.</label><button class="btn btn-primary" id="csb" disabled>Continuar</button></div>`}
<div class="ponto-grid${consent?'':' dim'}"><div class="box clock"><div class="clk" id="clk"></div><p class="clk-d">${esc_?`Escala: ${esc(esc_.nome)} (${esc_.ent} às ${esc_.sai})`:'Sem escala definida'}</p>
${next?`<button class="btn btn-primary big" id="mark"${consent?'':' disabled'}>${IC.cam}Registrar ${next[1].toLowerCase()}</button><p class="hint">Exige foto do rosto e localização ativada.</p>`:'<p class="done">Jornada de hoje concluída.</p>'}</div>
<div class="box"><div class="box-head"><div><h3>Marcações de hoje</h3><p>${mine.length} de 4</p></div></div><ol class="marks">${TIPOS.map(([t,l])=>{const p=mine.find(x=>x.tipo===t);return `<li class="${p?'ok':''}">${p?`<img src="${p.foto}" alt="Foto da marcação">`:'<span class="ph"></span>'}<div><b>${l}</b><small>${p?hm(p.ts)+' · '+esc(p.end):'Pendente'}</small>${p?`<small class="geo">${p.lat.toFixed(5)}, ${p.lon.toFixed(5)} (±${Math.round(p.acc)} m)</small>`:''}</div></li>`}).join('')}</ol></div></div>`;
clearInterval(CLK);const tick=()=>{const c=$('#clk');if(!c)return clearInterval(CLK);c.textContent=new Date().toLocaleTimeString('pt-BR')};CLK=setInterval(tick,1000);tick();
if(!consent){$('#cs').onchange=e=>$('#csb').disabled=!e.target.checked;$('#csb').onclick=()=>{localStorage.setItem(CONS_KEY+'_'+ME.login,new Date().toISOString());VIEWS.ponto()}}
if(next&&consent)$('#mark').onclick=()=>capture(next)};
async function capture([tipo,label]){
const d=document.createElement('div');d.className='modal';d.innerHTML=`<div class="mbox cam" role="dialog" aria-modal="true" aria-label="Registrar ponto"><div class="mhead"><h3>${label}</h3><button class="icon-x" id="cx" aria-label="Cancelar">${IC.x}</button></div>
<div class="vid"><video id="cv" playsinline muted autoplay></video><div class="oval"></div></div><div class="geo-st" id="gs">Obtendo localização...</div><div class="msg err" id="cm"></div><div class="mfoot"><button class="btn btn-primary" id="shot" disabled>Tirar foto e registrar</button></div></div>`;
document.body.appendChild(d);let stream=null,pos=null,end='',geoEnd=0,gW=null;
const close=()=>{stream&&stream.getTracks().forEach(t=>t.stop());if(gW!=null)navigator.geolocation.clearWatch(gW);gW=null;d.remove()};$('#cx').onclick=close;
const fail=t=>{$('#cm').textContent=t};const ready=()=>{$('#shot').disabled=!(stream&&pos)};
try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640}},audio:false});$('#cv').srcObject=stream;ready()}catch(e){fail('Câmera bloqueada. Libere o acesso à câmera nas permissões do navegador para registrar o ponto.')}
const gotPos=async c=>{if(!d.isConnected)return;const first=!pos;if(pos&&c.accuracy>=pos.accuracy)return;pos=c;$('#gs').textContent=`Localização: ${pos.latitude.toFixed(5)}, ${pos.longitude.toFixed(5)} (±${Math.round(pos.accuracy)} m)`;ready();
if(c.accuracy<=50&&gW!=null){navigator.geolocation.clearWatch(gW);gW=null}
const my=++geoEnd;try{const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&lat=${pos.latitude}&lon=${pos.longitude}`,{headers:{'Accept-Language':'pt-BR'}});const j=await r.json();if(my!==geoEnd)return;const a=j.address||{};end=[a.road,a.house_number].filter(Boolean).join(', ')+(a.suburb?' - '+a.suburb:'')+(a.city||a.town?' - '+(a.city||a.town):'');$('#gs').textContent=(end||'Endereço não identificado')+` (${pos.latitude.toFixed(5)}, ${pos.longitude.toFixed(5)} ±${Math.round(pos.accuracy)} m)`}catch(e){}};
const geoErr=e=>{if(pos||!d.isConnected)return;if(e&&e.code===1)fail('Localização bloqueada. iPhone: Ajustes → Privacidade → Serviços de Localização → ative e, em "Sites do Safari", escolha "Durante o uso". Android: toque no cadeado ao lado do endereço → Permissões → Localização → Permitir. Depois recarregue a página.');else $('#gs').innerHTML='Não foi possível obter a localização. <button type="button" class="btn btn-ghost btn-sm" id="geo-again">Tentar de novo</button>',$('#geo-again').onclick=startGeo};
// 1) posição rápida (rede/última conhecida) para liberar o botão; 2) GPS refinando por até 30 s.
const startGeo=()=>{if(!window.isSecureContext){fail('Conexão não segura: o celular só libera a localização em página com cadeado (https). Avise o administrador.');return}$('#gs').textContent='Obtendo localização…';navigator.geolocation.getCurrentPosition(p=>gotPos(p.coords),()=>{},{enableHighAccuracy:false,timeout:8000,maximumAge:120000});
if(gW!=null)navigator.geolocation.clearWatch(gW);gW=navigator.geolocation.watchPosition(p=>gotPos(p.coords),geoErr,{enableHighAccuracy:true,timeout:30000,maximumAge:0});
setTimeout(()=>{if(gW!=null){navigator.geolocation.clearWatch(gW);gW=null}if(!pos)geoErr()},30000)};startGeo();
$('#shot').onclick=()=>{const v=$('#cv');if(!v.videoWidth){fail('A câmera ainda está iniciando. Tente de novo em um instante.');return}const W=320,H=Math.round(W*v.videoHeight/v.videoWidth);const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.translate(W,0);x.scale(-1,1);x.drawImage(v,0,0,W,H);
const all=pontoAll();all.push({id:u2b(rnd(9)),login:ME.login,name:ME.name,role:ME.role,tipo,dia:today(),ts:new Date().toISOString(),lat:pos.latitude,lon:pos.longitude,acc:pos.accuracy,end:end||'Endereço não identificado',foto:c.toDataURL('image/jpeg',.72)});
try{localStorage.setItem(PONTO_KEY,JSON.stringify(all))}catch(e){fail('Memória do aparelho cheia. Fale com o administrador.');return}close();syncPonto().then(n=>{VIEWS.ponto();return n}).then(n=>{if(PLAN())toastP(n?'Sem internet: a marcação será enviada assim que a conexão voltar.':'Marcação salva na planilha.')})}}
const toastP=t=>{const d=document.createElement('div');d.className='notice';d.style.cssText='position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:99;display:block!important';d.textContent=t;document.body.appendChild(d);setTimeout(()=>d.remove(),4000)};
function demoPonto(){const out=[];const R=rows();const ppl=[...GL_DEMO.AJU.map(n=>({name:n,role:'ajudante'})),{name:'LETICIA A. FARIAS',role:'colaborador'},{name:'GUSTAVO P. LEAL',role:'colaborador'}];
const days=[...new Set(R.map(r=>r.d))];let s=7;const rr=()=>{s=(s*16807)%2147483647;return s/2147483647};
for(const k of days)for(const p of ppl){if(rr()<.12)continue;const b=new Date(k+'T08:00:00');const mk=(t,min)=>({name:p.name,role:p.role,tipo:t,dia:k,ts:new Date(b.getTime()+min*60000).toISOString(),lat:-23.53+rr()*.02,lon:-46.61-rr()*.02,acc:8+rr()*20,end:'Rua Exemplo, '+(100+Math.floor(rr()*900))+' - Brás - São Paulo',foto:'',demo:1});
out.push(mk('entrada',Math.round(rr()*25-10)),mk('almoco',240+Math.round(rr()*30)),mk('retorno',300+Math.round(rr()*30)));if(k!==today()||rr()<.3)out.push(mk('saida',540+Math.round(rr()*40)))}return out}
VIEWS.pontoadm=async()=>{let all,erro='';if(PLAN()){M().innerHTML='<p class="hint">Carregando a planilha do ponto…</p>';await syncPonto();try{const d=new Date();d.setDate(d.getDate()-62);all=(await plan('desde='+keyD(d))).itens}catch(e){erro='Não foi possível ler a planilha do ponto. Mostrando só as marcações deste aparelho.';all=pontoAll()}}else all=[...demoPonto(),...pontoAll()];const names=[...new Set(all.map(p=>p.name))].sort();const R=rows();
M().innerHTML=top('Controle de ponto','Marcações com foto, localização e horário',UPD)+`${erro?`<div class="banner">${erro}</div>`:PLAN()?'':'<div class="banner">Planilha do ponto não configurada: inclui marcações fictícias. Configure em Usuários e acessos → Planilha do ponto.</div>'}
<div class="filters">${periodUI('pp',['dia','semana','quinzena','mes'])}<select id="pn" aria-label="Pessoa"><option value="">Todas as pessoas</option>${names.map(n=>`<option>${esc(n)}</option>`).join('')}</select><button class="btn btn-ghost btn-sm" id="prt">Gerar relatório</button></div><div id="pout"></div>`;
const hrs=l=>{const m=l.m;if(!m.entrada||!m.saida)return null;let t=new Date(m.saida.ts)-new Date(m.entrada.ts);if(m.almoco&&m.retorno)t-=new Date(m.retorno.ts)-new Date(m.almoco.ts);return t/36e5};
const fmtH=h=>h==null?'—':Math.floor(h)+'h'+String(Math.round(h%1*60)).padStart(2,'0');
const bip=l=>l.role==='ajudante'?R.filter(r=>r.d===l.dia&&norm(r.a)===norm(l.name)).reduce((x,r)=>x+r.t,0):null;
const run=()=>{const [a,b,lbl]=periodRange($('#pp'));const pn=$('#pn').value;const f=all.filter(p=>p.dia>=a&&p.dia<=b&&(!pn||p.name===pn));
const g=new Map();for(const p of f){const k=p.name+'|'+p.dia;if(!g.has(k))g.set(k,{name:p.name,role:p.role,dia:p.dia,m:{}});g.get(k).m[p.tipo]=p}
const lin=[...g.values()].sort((x,y)=>x.dia===y.dia?x.name.localeCompare(y.name):x.dia<y.dia?1:-1);const totH=lin.reduce((x,l)=>x+(hrs(l)||0),0);
$('#pout').innerHTML=`<div class="kpi-grid"><div class="kpi"><small>Pessoas que trabalharam</small><b>${new Set(lin.map(l=>l.name)).size}</b><span>${esc(lbl)}</span></div><div class="kpi"><small>Jornadas registradas</small><b>${lin.length}</b><span>Dias x pessoas</span></div><div class="kpi"><small>Horas trabalhadas</small><b>${fmtH(totH)}</b><span>Soma do período</span></div><div class="kpi"><small>Jornadas incompletas</small><b>${lin.filter(l=>Object.keys(l.m).length<4).length}</b><span>Faltou alguma marcação</span></div></div>
<div class="box mt" id="rep"><div class="box-head"><div><h3>Relatório de ponto</h3><p>${esc(lbl)}${pn?' · '+esc(pn):''} · clique em uma linha para ver fotos e localização</p></div></div><div class="table-wrap"><table><thead><tr><th>Data</th><th>Pessoa</th><th>Tipo</th><th>Início</th><th>Almoço</th><th>Retorno</th><th>Fim</th><th class="n">Horas</th><th class="n">Pacotes bipados</th><th>Local do início</th></tr></thead><tbody>
${lin.map((l,i)=>`<tr data-i="${i}" class="clk-row"><td>${lblD(l.dia)}</td><td>${esc(l.name)}</td><td>${ROLE_LBL[l.role]||''}</td>${TIPOS.map(([t])=>`<td>${l.m[t]?hm(l.m[t].ts):'<span class="miss">—</span>'}</td>`).join('')}<td class="n">${fmtH(hrs(l))}</td><td class="n">${bip(l)==null?'—':N(bip(l))}</td><td class="loc">${esc(l.m.entrada?.end||'—')}</td></tr>`).join('')||'<tr><td colspan="10" class="empty">Nenhuma marcação no período.</td></tr>'}</tbody></table></div></div>`;
$$('.clk-row').forEach(tr=>tr.onclick=async()=>{const l=lin[+tr.dataset.i];if(PLAN()){tr.style.opacity=.5;await Promise.all(Object.values(l.m).map(async p=>{if(!p.foto&&p.fotoUrl)try{p.foto=(await plan('foto='+encodeURIComponent(p.fotoUrl))).foto}catch(e){}}));tr.style.opacity=''}detail(l)})};
const detail=l=>{const d=document.createElement('div');d.className='modal';d.innerHTML=`<div class="mbox wide" role="dialog" aria-modal="true" aria-label="Detalhe das marcações"><div class="mhead"><h3>${esc(l.name)} · ${lblD(l.dia)}</h3><button class="icon-x" aria-label="Fechar">${IC.x}</button></div><div class="det">${TIPOS.map(([t,lb])=>{const p=l.m[t];return `<div class="dcard">${p?.foto?`<img src="${p.foto}" alt="Foto">`:'<span class="ph big">'+(p?'Foto fictícia':'Sem marcação')+'</span>'}<b>${lb}</b><small>${p?hm(p.ts):'—'}</small>${p?`<small>${esc(p.end)}</small><a href="https://www.google.com/maps?q=${p.lat},${p.lon}" target="_blank" rel="noopener">${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}</a>`:''}</div>`}).join('')}</div></div>`;document.body.appendChild(d);d.onclick=e=>{if(e.target===d||e.target.closest('.icon-x'))d.remove()}};
$$('#pp select,#pp input,#pn').forEach(e=>e.addEventListener('change',run));$('#prt').onclick=()=>print();run()};
async function ghToken(){const s=localStorage.getItem(GH_KEY);if(!s)return null;try{const o=JSON.parse(s);return dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:b2u(o.iv)},MASTER,b2u(o.ct)))}catch(e){return null}}
async function setToken(t){const iv=rnd(12);localStorage.setItem(GH_KEY,JSON.stringify({iv:u2b(iv),ct:u2b(await crypto.subtle.encrypt({name:'AES-GCM',iv},MASTER,enc.encode(t)))}))}
let LAST=['',''];
async function saveFile(path,obj,note){if(obj===DB&&CFG.pontoUrl)DB.senhaUrl=CFG.pontoUrl;const body=JSON.stringify(obj,(k,v)=>k==='_p'?undefined:v,2)+'\n';const tk=await ghToken();
const say=(c,t)=>{LAST=[c,t];const o=$('#u-msg');if(o){o.className='msg '+c;o.textContent=t}};
if(!tk){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([body],{type:'application/json'}));a.download=path.split('/').pop();a.click();say('err',note+' Para valer no site, conecte o GitHub em Usuários e acessos (ou envie o arquivo baixado para a pasta '+path.split('/')[0]+' do repositório).');return}
say('','Salvando...');const api='https://api.github.com/repos/'+REPO+'/contents/'+path;const h={Authorization:'Bearer '+tk,Accept:'application/vnd.github+json'};
try{const cur=await fetch(api+'?ref=main',{headers:h,cache:'no-store'});const sha=cur.ok?(await cur.json()).sha:undefined;
const r=await fetch(api,{method:'PUT',headers:h,body:JSON.stringify({message:note,content:u2b(enc.encode(body)),sha,branch:'main'})});if(!r.ok)throw new Error(r.status);say('ok',note+' Salvo. O site atualiza em cerca de 1 minuto.')}
catch(e){say('err','Não foi possível salvar no GitHub (erro '+e.message+'). Confira se o token é válido e tem permissão de escrita.')}}
async function keepMsg(fn){await fn();const o=$('#u-msg');if(o){o.className='msg '+LAST[0];o.textContent=LAST[1]}}
const pwGen=()=>{const a='abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';return [...rnd(10)].map(x=>a[x%a.length]).join('')};
const cpfOk=c=>{c=String(c).replace(/\D/g,'');if(c.length!==11||/^(\d)\1+$/.test(c))return false;const d=n=>{let s=0;for(let i=0;i<n;i++)s+=+c[i]*(n+1-i);const r=s*10%11;return r===10?0:r};return d(9)===+c[9]&&d(10)===+c[10]};
const placaOk=p=>/^[A-Z]{3}-?\d[A-Z0-9]\d{2}$/.test(String(p||'').toUpperCase().trim());
function validate(u){const e=[];if(!u.name)e.push('nome');if(!/^[a-z0-9._-]{3,40}$/.test(u.login))e.push('login (3 a 40 caracteres: letras, números, ponto, hífen)');
if(u.role==='motorista'){if(!placaOk(u.placa))e.push('placa (ex.: ABC1D23)');if(!VEIC.includes(u.modelo))e.push('modelo do veículo');}
if(u.role==='fornecedor'&&!u.cliente)e.push('cliente');return e}
const PW_PADRAO='123456';
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
function trocarSenha(obrig){return new Promise(done=>{const d=modal(obrig?'Crie sua senha':'Trocar senha',`<form class="uform" id="tsf">${obrig?'<p class="hint">Este é seu primeiro acesso (ou sua senha foi redefinida). Crie uma senha pessoal para continuar.</p>':''}
<div class="field"><label for="ts1">Nova senha</label><input id="ts1" type="password" required minlength="6" autocomplete="new-password"></div><div class="field"><label for="ts2">Repita a nova senha</label><input id="ts2" type="password" required minlength="6" autocomplete="new-password"></div>
<p class="msg" id="tsm"></p><button class="btn btn-primary">Salvar senha</button></form>`);
const x=d.querySelector('.icon-x');if(obrig)x.remove();else x.onclick=()=>{d.remove();done(false)};
d.querySelector('#tsf').onsubmit=async e=>{e.preventDefault();const a=$('#ts1').value,b=$('#ts2').value,m=$('#tsm');m.className='msg err';
if(a!==b){m.textContent='As duas senhas não são iguais.';return}if(a.length<6||a===PW_PADRAO){m.textContent='Use pelo menos 6 caracteres e diferente de '+PW_PADRAO+'.';return}
if(!PLAN()){m.textContent='A planilha do ponto ainda não está conectada. Fale com o administrador.';return}
m.className='msg';m.textContent='Salvando…';try{const w=await wrapFor(a);const r=await fetch(CFG.pontoUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({token:CFG.pontoToken,acao:'senha',login:ME.login,...w,em:new Date().toISOString()})});const j=await r.json();if(!j.ok)throw new Error(j.erro);
d.remove();done(true)}catch(x){m.className='msg err';m.textContent='Não foi possível salvar agora. Verifique a internet e tente de novo.'}}})}
const mkProf=u=>({name:u.name,tel:u.tel||'',placa:String(u.placa||'').toUpperCase().replace('-',''),modelo:u.modelo||'',escala:u.escala||'',cliente:u.cliente||'',ref:u.role==='motorista'?'GET - '+u.name.toUpperCase():u.role==='ajudante'?u.name.toUpperCase():''});
async function addUser(u,pw){const prof=mkProf(u);
const rec={login:u.login,role:u.role,active:true,...await wrapFor(pw),pwEm:new Date().toISOString(),p:await seal(prof),created:new Date().toISOString()};rec._p=prof;DB.users.push(rec)}
VIEWS.usuarios=async()=>{await profiles();const tk=await ghToken();
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
${DB.users.map(u=>{const p=u._p||{};return `<tr><td>${esc(p.name||'')}</td><td>${esc(u.login)}</td><td>${ROLE_LBL[u.role]}</td><td>${p.placa?esc(p.placa+' · '+p.modelo):p.cliente?esc(p.cliente):'—'}</td><td><span class="st ${u.active===false?'off':'ok'}">${u.active===false?'Desativado':'Ativo'}</span></td><td><div class="row-actions"><button class="btn btn-ghost btn-sm" data-act="ed" data-l="${esc(u.login)}">Editar</button>${u.login===ME.login?'<small>Você</small>':`<button class="btn btn-ghost btn-sm" data-act="pw" data-l="${esc(u.login)}">Resetar senha</button><button class="btn btn-ghost btn-sm" data-act="tg" data-l="${esc(u.login)}">${u.active===false?'Ativar':'Desativar'}</button><button class="btn btn-danger btn-sm" data-act="rm" data-l="${esc(u.login)}">Excluir</button>`}</div></td></tr>`}).join('')}</tbody></table></div>
<details class="gh"${tk?'':' open'}><summary>${tk?'GitHub conectado: alterações são salvas direto no site':'Conectar ao GitHub para salvar alterações no site'}</summary><p class="hint">Cole um token do GitHub com permissão de escrita em Contents no repositório ${REPO}. Ele fica guardado criptografado apenas neste navegador.</p><form class="uform two" id="ghf"><div class="field"><label for="gh-t">Token do GitHub</label><input id="gh-t" type="password" autocomplete="off"></div><button class="btn btn-ghost">${tk?'Trocar token':'Conectar'}</button></form></details><details class="gh"><summary>Chave da automação de Performance</summary><p class="hint">Copie esta chave e cole no GitHub como segredo <b>GETLOG_MASTER_KEY</b> (Settings → Secrets and variables → Actions). Ela tranca os dados de performance antes de irem para o site. Não envie para ninguém.</p><button type="button" class="btn btn-ghost" id="mk-copy">Copiar chave</button></details><details class="gh"${PLAN()?'':' open'}><summary>${PLAN()?'Planilha do ponto conectada':'Conectar a planilha do ponto'}</summary><p class="hint">Cole o endereço do App da Web do Apps Script e o mesmo token colocado no código. Fica guardado criptografado no site.</p><form class="uform two" id="plf"><div class="field"><label for="pl-u">Endereço do App da Web</label><input id="pl-u" type="url" placeholder="https://script.google.com/macros/s/.../exec" value="${esc(CFG.pontoUrl||'')}"></div><div class="field"><label for="pl-t">Token</label><input id="pl-t" type="password" autocomplete="off" value="${esc(CFG.pontoToken||'')}"></div><button class="btn btn-ghost">Salvar e testar</button></form><p class="msg" id="pl-m"></p></details></div>`;
const role=$('#n-role');const vis=()=>{const r=role.value;$$('[data-for]').forEach(f=>{const t=f.dataset.for;f.hidden=!(t==='p'&&['colaborador','ajudante','motorista'].includes(r)||t==='m'&&r==='motorista'||t==='e'&&['colaborador','ajudante'].includes(r)||t==='f'&&r==='fornecedor')})};role.onchange=vis;vis();
$('#nu').onsubmit=async e=>{e.preventDefault();const u={name:$('#n-nome').value.trim(),login:norm($('#n-login').value),role:role.value,tel:$('#n-tel').value.trim(),placa:$('#n-placa').value,modelo:$('#n-mod').value,escala:$('#n-esc').value,cliente:$('#n-cli').value};
const m=$('#u-msg');const er=validate(u);if(er.length){m.className='msg err';m.textContent='Confira: '+er.join(', ')+'.';return}if(DB.users.some(x=>x.login===u.login)){m.className='msg err';m.textContent='Esse login já existe.';return}
await addUser(u,$('#n-pw').value);await saveFile('data/users.json',DB,'Acesso de '+u.name+' cadastrado.');keepMsg(VIEWS.usuarios)};
$('#ub').oninput=e=>{const q=norm(e.target.value);$$('#ut tbody tr').forEach(tr=>tr.hidden=q&&!norm(tr.textContent).includes(q))};
$$('[data-act]').forEach(b=>b.onclick=async()=>{const u=DB.users.find(x=>x.login===b.dataset.l);if(!u)return;const n=u._p?.name||u.login;
if(b.dataset.act==='rm'){if(!confirm('Excluir o acesso de '+n+'?'))return;DB.users=DB.users.filter(x=>x!==u);await saveFile('data/users.json',DB,'Acesso de '+n+' excluído.')}
if(b.dataset.act==='tg'){u.active=u.active===false;await saveFile('data/users.json',DB,'Acesso de '+n+(u.active?' ativado.':' desativado.'))}
if(b.dataset.act==='pw'){if(!confirm('Resetar a senha de '+n+' para '+PW_PADRAO+'?'))return;Object.assign(u,await wrapFor(PW_PADRAO),{pwEm:new Date().toISOString()});await saveFile('data/users.json',DB,'Senha de '+n+' resetada para '+PW_PADRAO+'.')}
if(b.dataset.act==='ed'){if(!await editUser(u))return}
keepMsg(VIEWS.usuarios)});
$('#plf').onsubmit=async e=>{e.preventDefault();const u=$('#pl-u').value.trim(),t=$('#pl-t').value.trim(),m=$('#pl-m');m.className='msg';m.textContent='Testando…';try{const r=await fetch(u+'?token='+encodeURIComponent(t)+'&desde=9999');const j=await r.json();if(!j.ok)throw new Error(j.erro)}catch(x){m.className='msg err';m.textContent='Não funcionou: confira o endereço e se o token é igual ao do código.';return}CFG={...CFG,pontoUrl:u,pontoToken:t};await saveFile('data/config.json',await seal(CFG),'Planilha do ponto conectada.');keepMsg(VIEWS.usuarios)};$('#mk-copy').onclick=async()=>{try{await navigator.clipboard.writeText(u2b(MASTER_RAW));$('#mk-copy').textContent='Chave copiada'}catch(e){prompt('Copie a chave:',u2b(MASTER_RAW))}};$('#ghf').onsubmit=async e=>{e.preventDefault();const t=$('#gh-t').value.trim();if(t){await setToken(t);VIEWS.usuarios()}};
const xlsx=()=>window.XLSX?Promise.resolve():new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=ok;s.onerror=no;document.head.appendChild(s)});
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
(async()=>{let x=null;try{x=JSON.parse(sessionStorage.getItem(S_KEY))}catch(e){}if(!x||!x.k)return;
try{await loadDB();const usr=DB.users.find(u=>u.login===x.login);if(usr&&usr.active!==false){usr._troca=!!x.troca;await start(usr,b2u(x.k))}}catch(e){sessionStorage.removeItem(S_KEY)}})();
})();
