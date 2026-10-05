(()=>{
const S_KEY='getlog_sessao',enc=new TextEncoder();
const b2u=b=>{const s=atob(b);const u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u};
const u2b=u=>{u=new Uint8Array(u);let s='';for(let i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);return btoa(s)};
const $=s=>document.querySelector(s);const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N=n=>Number(n||0).toLocaleString('pt-BR');const norm=s=>String(s||'').trim().toLowerCase();
async function kek(pw,salt,iter){const b=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:iter,hash:'SHA-256'},b,{name:'AES-GCM',length:256},false,['decrypt'])}
async function prof(raw,u){const k=await crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['decrypt']);return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:b2u(u.p.iv)},k,b2u(u.p.ct))))}
async function db(){const r=await fetch('/data/users.json?t='+Date.now(),{cache:'no-store'});return r.json()}
$('#f').addEventListener('submit',async e=>{e.preventDefault();const m=$('#m'),go=$('#go');m.textContent='';go.disabled=true;go.textContent='Verificando...';
try{const D=await db();const u=D.users.find(x=>x.login===norm($('#u').value));if(!u||u.role!=='fornecedor'||u.active===false)throw 0;
const k=await kek($('#p').value,b2u(u.salt),D.iter);const raw=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:b2u(u.iv)},k,b2u(u.key)));const p=await prof(raw,u);
sessionStorage.setItem(S_KEY,JSON.stringify({login:u.login,role:'fornecedor',name:p.name,cliente:p.cliente}));app()}
catch(x){m.textContent='Usuário ou senha incorretos.';go.disabled=false;go.textContent='Entrar'}});
let s=null;try{s=JSON.parse(sessionStorage.getItem(S_KEY))}catch(e){}if(s&&s.role==='fornecedor')app();else $('#u').focus();
function app(){const S=JSON.parse(sessionStorage.getItem(S_KEY));const d=GL_DEMO.days(30);const keys=Object.keys(d).sort().reverse();
const rows=k=>{const v=d[k],c=v.colunas,ix=n=>c.indexOf(n);return v.linhas.filter(r=>r[ix('CLIENTE')]===S.cliente).map(r=>({s:r[ix('SELLER')],m:(r[ix('MOTORISTA OFICIAL')]||'').replace(/^.*? - /,''),r:r[ix('REGIÃO')],p:r[ix('PREVISTO')],c:r[ix('COLETADO TOTAL')],st:r[ix('STATUS DO SELLER')],h:r[ix('HORA')]}))};
$('#login').hidden=true;const A=$('#app');A.hidden=false;
A.innerHTML=`<header class="hd"><div class="w"><div class="hd-row"><span class="chip-logo"><img src="/assets/logo-getlog.webp" alt="GETLOG" width="84" height="34"></span><button class="out" id="sair">Sair</button></div>
<h1>Coletas ${esc(S.name)}</h1><p>Previsto, coletado e status de cada seller atendido pela GETLOG.</p><span class="upd"><i></i><span id="upd"></span></span><div class="demo">Protótipo com dados fictícios.</div></div></header>
<main class="w body"><div class="bar"><select id="dt" aria-label="Data">${keys.map(k=>`<option value="${k}">${k.split('-').reverse().join('/')}</option>`).join('')}</select><select id="fs" aria-label="Situação"><option value="">Todas as situações</option><option value="ok">Coletado</option><option value="warn">Em rota ou parcial</option><option value="bad">Não coletado</option></select><input id="q" type="search" placeholder="Buscar seller ou motorista" aria-label="Buscar"></div>
<div class="kp" id="kp"></div><section class="card"><h2>Sellers do dia</h2><p class="sub" id="sub"></p><div class="tw"><table><thead><tr><th>Seller</th><th class="hide-m">Motorista</th><th class="hide-m">Região</th><th class="n">Previsto</th><th class="n">Coletado</th><th>Status</th></tr></thead><tbody id="tb"></tbody></table></div></section>
<p class="ft">GETLOG Transportes · Dúvidas: WhatsApp +55 11 98914-1009</p></main>`;
$('#sair').onclick=()=>{sessionStorage.removeItem(S_KEY);location.reload()};
const cls=r=>r.st==='Em rota'?['warn','Em rota']:r.c>=r.p?['ok','Coletado']:r.c>0?['warn','Parcial']:['bad',r.st==='Coletado'?'Não coletado':r.st];
const run=()=>{const k=$('#dt').value,q=norm($('#q').value),fs=$('#fs').value;const all=rows(k);const R=all.filter(r=>(!q||norm(r.s+' '+r.m).includes(q))&&(!fs||cls(r)[0]===fs));
const [dd,hh]=d[k].atualizado_em.split(' ');$('#upd').textContent='Última atualização: '+dd.split('-').reverse().join('/')+' às '+hh.slice(0,5);
const P=all.reduce((a,r)=>a+r.p,0),C=all.reduce((a,r)=>a+Math.min(r.c,r.p),0),pc=P?C/P*100:0,col=pc>=98?'var(--ok)':pc>=80?'var(--warn)':'var(--bad)';
const vis=new Set(all.filter(r=>r.c>0).map(r=>r.s)).size,tot=new Set(all.map(r=>r.s)).size;
$('#kp').innerHTML=`<div class="k"><small>Previsto</small><b>${N(P)}</b></div><div class="k"><small>Coletado do previsto</small><b>${N(C)}</b></div><div class="k pc" style="--c:${col}"><small>Aproveitamento</small><b>${pc.toFixed(1).replace('.',',')}%</b><div class="ring"><i style="width:${Math.min(100,pc)}%"></i></div></div><div class="k"><small>Sellers coletados</small><b>${vis} de ${tot}</b></div>`;
$('#sub').textContent=R.length+' registros';
$('#tb').innerHTML=R.sort((a,b)=>b.p-a.p).map(r=>{const [c,l]=cls(r);return `<tr><td>${esc(r.s)}</td><td class="hide-m">${esc(r.m)}</td><td class="hide-m">${esc(r.r)}</td><td class="n">${N(r.p)}</td><td class="n">${N(r.c)}</td><td><span class="s ${c}">${esc(l)}</span></td></tr>`}).join('')||'<tr><td colspan="6" class="emp">Nenhuma coleta encontrada.</td></tr>'};
['dt','fs'].forEach(i=>$('#'+i).onchange=run);$('#q').oninput=run;run()}
})();
