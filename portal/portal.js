(()=>{
const REPO='getlogtransp-rgb/getlogtransp-rgb.github.io';
const USERS_PATH='data/users.json';
const S_KEY='getlog_sessao';
const GH_KEY='getlog_gh';
const enc=new TextEncoder(),dec=new TextDecoder();
const b2u=b=>{const s=atob(b);const u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u};
const u2b=u=>{u=new Uint8Array(u);let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)};
const rnd=n=>crypto.getRandomValues(new Uint8Array(n));
const $=s=>document.querySelector(s);
let DB=null,MASTER=null,MASTER_RAW=null,ME=null;
async function kek(pw,salt,iter){
const base=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveKey']);
return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:iter,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function importMaster(raw){return crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt'])}
async function wrapFor(pw){
const salt=rnd(16),iv=rnd(12);
const k=await kek(pw,salt,DB.iter);
const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},k,MASTER_RAW);
return {salt:u2b(salt),iv:u2b(iv),key:u2b(ct)};
}
async function loadDB(){
const r=await fetch('/'+USERS_PATH+'?t='+Date.now(),{cache:'no-store'});
if(!r.ok)throw new Error('db');
DB=await r.json();
}
const norm=s=>s.trim().toLowerCase();
async function login(u,pw){
await loadDB();
const usr=DB.users.find(x=>x.login===norm(u));
if(!usr)throw new Error('cred');
let raw;
try{const k=await kek(pw,b2u(usr.salt),DB.iter);raw=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:b2u(usr.iv)},k,b2u(usr.key)))}catch(e){throw new Error('cred')}
if(usr.active===false)throw new Error('off');
return {usr,raw};
}
async function openVault(){
const r=await fetch('/portal/vault.json?t='+Date.now(),{cache:'no-store'});
const v=await r.json();
const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:b2u(v.iv)},MASTER,b2u(v.ct));
return dec.decode(pt);
}
async function start(usr,raw){
MASTER_RAW=raw;MASTER=await importMaster(raw);ME={login:usr.login,name:usr.name,role:usr.role};
sessionStorage.setItem(S_KEY,JSON.stringify({...ME,k:u2b(raw)}));
const html=await openVault();
$('#login').hidden=true;const app=$('#app');app.innerHTML=html;app.hidden=false;
document.title='Portal | GETLOG Transportes';
wire();
}
const form=$('#loginForm'),msg=$('#msg'),go=$('#go');
$('#eye').addEventListener('click',()=>{const p=$('#p');const s=p.type==='password';p.type=s?'text':'password';$('#eye').setAttribute('aria-label',s?'Ocultar senha':'Mostrar senha')});
form.addEventListener('submit',async e=>{
e.preventDefault();
const u=$('#u').value,p=$('#p').value;
if(!u.trim()||!p){msg.className='msg err';msg.textContent='Preencha usuário e senha.';return}
go.disabled=true;go.textContent='Verificando...';msg.textContent='';
try{const {usr,raw}=await login(u,p);await start(usr,raw)}
catch(err){
msg.className='msg err';
msg.textContent=err.message==='off'?'Este acesso está desativado. Fale com o administrador.':err.message==='db'?'Não foi possível carregar os acessos. Verifique a conexão e tente de novo.':'Usuário ou senha incorretos.';
go.disabled=false;go.textContent='Entrar';
}
});
(async()=>{
const s=sessionStorage.getItem(S_KEY);
if(!s){$('#u').focus();return}
try{const o=JSON.parse(s);await loadDB();const usr=DB.users.find(x=>x.login===o.login);if(!usr||usr.active===false)throw 0;await start(usr,b2u(o.k))}
catch(e){sessionStorage.removeItem(S_KEY)}
})();
function show(view){
document.querySelectorAll('.side [data-view]').forEach(b=>{if(b.dataset.view===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!=='view-'+view);
$('.side').classList.remove('open');
scrollTo(0,0);
if(view==='usuarios')renderUsers();
}
function wire(){
$('#who-name').textContent=ME.name;
$('#who-role').textContent=ME.role==='admin'?'Administrador':'Funcionário';
document.querySelectorAll('[data-admin]').forEach(el=>el.hidden=ME.role!=='admin');
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.view)));
$('#sair').addEventListener('click',()=>{sessionStorage.removeItem(S_KEY);location.reload()});
const mb=$('#menu-btn');if(mb)mb.addEventListener('click',()=>$('.side').classList.toggle('open'));
const now=new Date();$('#hoje').textContent=now.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
const days=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
const draw=n=>{
let vals,labels;
if(n===7){vals=[96210,98340,101120,99870,102480,64320,18200];labels=days}
else{vals=[];labels=[];for(let i=n;i>=1;i--){const d=new Date(now);d.setDate(d.getDate()-i+1);const wd=d.getDay();vals.push(wd===0?15000+((i*7919)%6000):wd===6?60000+((i*104729)%9000):92000+((i*7919)%11000));labels.push(String(d.getDate()).padStart(2,'0'))}}
const max=Math.max(...vals);
$('#bars').innerHTML=vals.map((v,i)=>`<div class="bar${i===vals.length-1?' hot':''}" title="${labels[i]}: ${v.toLocaleString('pt-BR')} pacotes">${n===7?`<em>${(v/1000).toFixed(0)} mil</em>`:''}<i style="height:${Math.max(4,v/max*100)}%"></i><span>${labels[i]}</span></div>`).join('');
};
document.querySelectorAll('#periodo button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('#periodo button').forEach(x=>x.setAttribute('aria-pressed',x===b));draw(+b.dataset.n)}));
draw(7);
const q=$('#busca');if(q)q.addEventListener('input',()=>{const t=q.value.trim().toLowerCase();document.querySelectorAll('#tabela-coletados tbody tr').forEach(tr=>tr.hidden=t&&!tr.textContent.toLowerCase().includes(t))});
show('dashboard');
}
async function ghToken(){
const s=localStorage.getItem(GH_KEY);if(!s)return null;
try{const o=JSON.parse(s);return dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:b2u(o.iv)},MASTER,b2u(o.ct)))}catch(e){return null}
}
async function setToken(t){
const iv=rnd(12);const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},MASTER,enc.encode(t));
localStorage.setItem(GH_KEY,JSON.stringify({iv:u2b(iv),ct:u2b(ct)}));
}
async function saveDB(note){
const out=$('#u-msg');
const body=JSON.stringify(DB,null,2)+'\n';
const tk=await ghToken();
if(!tk){
const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([body],{type:'application/json'}));a.download='users.json';a.click();
out.className='msg err';out.textContent=note+' Para valer no site, conecte o GitHub abaixo (ou envie o users.json baixado para a pasta data do repositório).';
return;
}
out.className='msg';out.textContent='Salvando no site...';
const api='https://api.github.com/repos/'+REPO+'/contents/'+USERS_PATH;
const h={Authorization:'Bearer '+tk,Accept:'application/vnd.github+json'};
try{
const cur=await fetch(api+'?ref=main',{headers:h,cache:'no-store'});
if(!cur.ok)throw new Error(cur.status);
const sha=(await cur.json()).sha;
const r=await fetch(api,{method:'PUT',headers:h,body:JSON.stringify({message:'Acessos: '+note,content:u2b(enc.encode(body)),sha,branch:'main'})});
if(!r.ok)throw new Error(r.status);
out.className='msg ok';out.textContent=note+' Salvo. O site atualiza em cerca de 1 minuto.';
}catch(e){
out.className='msg err';out.textContent='Não foi possível salvar no GitHub (erro '+e.message+'). Confira se o token é válido e tem permissão de escrita no repositório.';
}
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function renderUsers(){
if(ME.role!=='admin')return;
const box=$('#view-usuarios .users-body');
const tk=await ghToken();
box.innerHTML=`<div class="box">
<div class="box-head"><div><h3>Cadastrar novo acesso</h3><p>O usuário entra com o login e a senha definidos aqui.</p></div></div>
<form class="uform" id="nu">
<div class="field"><label for="nu-nome">Nome</label><input id="nu-nome" required></div>
<div class="field"><label for="nu-login">Usuário</label><input id="nu-login" required autocapitalize="none" spellcheck="false" placeholder="nome.sobrenome"></div>
<div class="field"><label for="nu-pw">Senha inicial</label><input id="nu-pw" required minlength="8" autocomplete="new-password"></div>
<div class="field"><label for="nu-role">Perfil</label><select id="nu-role"><option value="funcionario">Funcionário</option><option value="admin">Administrador</option></select></div>
<button class="btn btn-primary" type="submit">Cadastrar</button>
</form>
<div class="msg" id="u-msg" role="status" aria-live="polite"></div>
</div>
<div class="box" style="margin-top:14px">
<div class="box-head"><div><h3>Acessos cadastrados</h3><p>${DB.users.length} usuário(s)</p></div></div>
<div class="table-wrap"><table><thead><tr><th>Nome</th><th>Usuário</th><th>Perfil</th><th>Situação</th><th></th></tr></thead><tbody>
${DB.users.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.login)}</td><td>${u.role==='admin'?'Administrador':'Funcionário'}</td><td><span class="st ${u.active===false?'off':'ok'}">${u.active===false?'Desativado':'Ativo'}</span></td><td><div class="row-actions">${u.login===ME.login?'<small style="color:var(--muted)">Você</small>':`<button class="btn btn-ghost btn-sm" data-act="pw" data-l="${esc(u.login)}">Nova senha</button><button class="btn btn-ghost btn-sm" data-act="tg" data-l="${esc(u.login)}">${u.active===false?'Ativar':'Desativar'}</button><button class="btn btn-danger btn-sm" data-act="rm" data-l="${esc(u.login)}">Excluir</button>`}</div></td></tr>`).join('')}
</tbody></table></div>
<details class="gh"${tk?'':' open'}><summary>${tk?'GitHub conectado: alterações são salvas direto no site':'Conectar ao GitHub para salvar os acessos no site'}</summary>
<p style="color:var(--muted);font-size:.9rem;margin-top:10px">Cole um token do GitHub com permissão de escrita em Contents no repositório ${REPO}. Ele fica guardado criptografado apenas neste navegador.</p>
<form class="uform" id="ghf"><div class="field"><label for="gh-t">Token do GitHub</label><input id="gh-t" type="password" autocomplete="off" placeholder="github_pat_..."></div><button class="btn btn-ghost" type="submit">${tk?'Trocar token':'Conectar'}</button></form>
</details>
</div>`;
$('#nu').addEventListener('submit',async e=>{
e.preventDefault();
const name=$('#nu-nome').value.trim(),login=norm($('#nu-login').value),pw=$('#nu-pw').value,role=$('#nu-role').value;
const m=$('#u-msg');
if(!/^[a-z0-9._-]{3,40}$/.test(login)){m.className='msg err';m.textContent='Usuário deve ter de 3 a 40 caracteres: letras, números, ponto, hífen ou sublinhado.';return}
if(pw.length<8){m.className='msg err';m.textContent='A senha precisa de pelo menos 8 caracteres.';return}
if(DB.users.some(u=>u.login===login)){m.className='msg err';m.textContent='Esse usuário já existe.';return}
DB.users.push({login,name,role,active:true,...await wrapFor(pw),created:new Date().toISOString()});
await saveDB('Acesso de '+name+' cadastrado.');renderUsersKeepMsg();
});
box.querySelectorAll('[data-act]').forEach(b=>b.addEventListener('click',async()=>{
const u=DB.users.find(x=>x.login===b.dataset.l);if(!u)return;
if(b.dataset.act==='rm'){if(!confirm('Excluir o acesso de '+u.name+'?'))return;DB.users=DB.users.filter(x=>x!==u);await saveDB('Acesso de '+u.name+' excluído.')}
if(b.dataset.act==='tg'){u.active=u.active===false;await saveDB('Acesso de '+u.name+(u.active?' ativado.':' desativado.'))}
if(b.dataset.act==='pw'){const pw=prompt('Nova senha para '+u.name+' (mínimo 8 caracteres):');if(!pw)return;if(pw.length<8){alert('A senha precisa de pelo menos 8 caracteres.');return}Object.assign(u,await wrapFor(pw));await saveDB('Senha de '+u.name+' alterada.')}
renderUsersKeepMsg();
}));
$('#ghf').addEventListener('submit',async e=>{e.preventDefault();const t=$('#gh-t').value.trim();if(!t)return;await setToken(t);renderUsers()});
}
async function renderUsersKeepMsg(){const m=$('#u-msg');const c=m.className,t=m.textContent;await renderUsers();const n=$('#u-msg');n.className=c;n.textContent=t}
})();
