(()=>{
const S_KEY='getlog_sessao',enc=new TextEncoder();
const b2u=b=>{const s=atob(b);const u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u};
const u2b=u=>{u=new Uint8Array(u);let s='';for(let i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);return btoa(s)};
const $=s=>document.querySelector(s);const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N=n=>Number(n||0).toLocaleString('pt-BR');const norm=s=>String(s||'').trim().toLowerCase();
async function kek(pw,salt,iter){const b=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:iter,hash:'SHA-256'},b,{name:'AES-GCM',length:256},false,['decrypt'])}
async function prof(raw,u){const k=await crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['decrypt']);return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:b2u(u.p.iv)},k,b2u(u.p.ct))))}
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
$('#f').addEventListener('submit',async e=>{e.preventDefault();const m=$('#m'),go=$('#go');m.textContent='';go.disabled=true;go.textContent='Verificando...';
let D,u,raw,p;try{D=await db();u=D.users.find(x=>x.login===norm($('#u').value));if(!u||u.role!=='fornecedor'||u.active===false)throw 0;
const k=await kek($('#p').value,b2u(u.salt),D.iter);raw=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:b2u(u.iv)},k,b2u(u.key)));p=await prof(raw,u)}
catch(x){m.textContent='Usuário ou senha incorretos.';go.disabled=false;go.textContent='Entrar';return}
let cfg={};try{const r=await fetch('/data/config.json?t='+Date.now(),{cache:'no-store'});cfg=await abre(raw,await r.json())}catch(x){}
if($('#p').value===PW_PADRAO)await trocaSenha(u.login,PW_PADRAO,raw,D.iter,cfg);
sessionStorage.setItem(S_KEY,JSON.stringify({login:u.login,role:'fornecedor',name:p.name,cliente:p.cliente,t:cfg.driveToken||''}));app()});
let s=null;try{s=JSON.parse(sessionStorage.getItem(S_KEY))}catch(e){}if(s&&s.role==='fornecedor')ativo(s).then(v=>v?app():sai());else $('#u').focus();
// Confere a cada abertura se o acesso continua ativo.
async function ativo(s){try{const u=(await db()).users.find(x=>x.login===s.login);return !!u&&u.role==='fornecedor'&&u.active!==false}catch(e){return true}}
function sai(){sessionStorage.removeItem(S_KEY);location.reload()}
const get=async(q,t)=>{const r=await fetch(API+'?'+q+(t?'&t='+encodeURIComponent(t):''),{credentials:'omit',cache:'no-store'});if(!r.ok)throw new Error('http '+r.status);const j=await r.json();if(!j.ok)throw new Error(j.erro||'erro');return j.dados};
const dk=d=>d.split('.').reverse().join('-');
async function app(){const S=JSON.parse(sessionStorage.getItem(S_KEY));const C=window.GL_CORE;
$('#login').hidden=true;const A=$('#app');A.hidden=false;A.innerHTML='<p class="w body">Carregando...</p>';
let L=[];try{L=(await get('fonte=lista',S.t)).filter(x=>/^\d{2}\.\d{2}\.\d{4}$/.test(x.dia)).sort((a,b)=>dk(a.dia)<dk(b.dia)?1:-1).slice(0,31)}catch(e){A.innerHTML='<p class="w body">Não foi possível carregar os dados agora. Tente de novo em instantes.</p>';return}
const keys=L.map(x=>x.dia),CACHE={};
const carrega=d=>CACHE[d]||(CACHE[d]=get('fonte=performance&dia='+encodeURIComponent(d),S.t).then(j=>{const R=C.normRows(C.toRecords(j.conteudo),dk(d));// Cliente vazio ou TODOS (ex.: iMile, cliente principal) vê a operação inteira.
const tudo=!S.cliente||norm(S.cliente)==='todos',eu=tudo?null:C.casar([S.cliente],R.map(r=>r.cli));
return {em:j.modificadoEm,rows:R.filter(r=>tudo||eu.has(r.cli)).map(r=>({s:r.seller,m:r.mo.replace(/^.*? - /,''),r:r.reg,p:r.prev,c:r.col,st:r.st,h:r.hora}))}}).catch(e=>{delete CACHE[d];throw e}));
$('#login').hidden=true;
A.innerHTML=`<header class="hd"><div class="w"><div class="hd-row"><span class="chip-logo"><img src="/assets/logo-getlog.webp" alt="GETLOG" width="84" height="34"></span><button class="out" id="sair">Sair</button></div>
<h1>Coletas ${esc(S.name)}</h1><p>Previsto, coletado e status de cada seller atendido pela GETLOG.</p><span class="upd"><i></i><span id="upd"></span></span></div></header>
<main class="w body"><div class="bar"><select id="dt" aria-label="Data">${keys.map(k=>`<option value="${k}">${k.replace(/\./g,'/')}</option>`).join('')}</select><select id="fs" aria-label="Situação"><option value="">Todas as situações</option><option value="ok">Coletado</option><option value="warn">Em rota ou parcial</option><option value="bad">Não coletado</option></select><input id="q" type="search" placeholder="Buscar seller ou motorista" aria-label="Buscar"></div>
<div class="kp" id="kp"></div><section class="card"><h2>Sellers do dia</h2><p class="sub" id="sub"></p><div class="tw"><table><thead><tr><th>Seller</th><th class="hide-m">Motorista</th><th class="hide-m">Região</th><th class="n">Previsto</th><th class="n">Coletado</th><th>Status</th></tr></thead><tbody id="tb"></tbody></table></div></section>
<p class="ft">GETLOG Transportes · Dúvidas: WhatsApp +55 11 98914-1009</p></main>`;
$('#sair').onclick=sai;
const cls=r=>r.st==='Em rota'?['warn','Em rota']:r.c>=r.p?['ok','Coletado']:r.c>0?['warn','Parcial']:['bad',r.st==='Coletado'?'Não coletado':r.st];
const run=async()=>{const k=$('#dt').value,q=norm($('#q').value),fs=$('#fs').value;let V;try{V=await carrega(k)}catch(e){$('#sub').textContent='Não foi possível carregar este dia.';$('#tb').innerHTML='';return}if(k!==$('#dt').value)return;const all=V.rows;const R=all.filter(r=>(!q||norm(r.s+' '+r.m).includes(q))&&(!fs||cls(r)[0]===fs));
const em=new Date(V.em);$('#upd').textContent=isNaN(em)?'':'Última atualização: '+em.toLocaleDateString('pt-BR')+' às '+em.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
const P=all.reduce((a,r)=>a+r.p,0),C=all.reduce((a,r)=>a+Math.min(r.c,r.p),0),pc=P?C/P*100:0,col=pc>=98?'var(--ok)':pc>=80?'var(--warn)':'var(--bad)';
const vis=new Set(all.filter(r=>r.c>0).map(r=>r.s)).size,tot=new Set(all.map(r=>r.s)).size;
$('#kp').innerHTML=`<div class="k"><small>Previsto</small><b>${N(P)}</b></div><div class="k"><small>Coletado do previsto</small><b>${N(C)}</b></div><div class="k pc" style="--c:${col}"><small>Aproveitamento</small><b>${pc.toFixed(1).replace('.',',')}%</b><div class="ring"><i style="width:${Math.min(100,pc)}%"></i></div></div><div class="k"><small>Sellers coletados</small><b>${vis} de ${tot}</b></div>`;
$('#sub').textContent=R.length+' registros';
$('#tb').innerHTML=R.sort((a,b)=>b.p-a.p).map(r=>{const [c,l]=cls(r);return `<tr><td>${esc(r.s)}</td><td class="hide-m">${esc(r.m)}</td><td class="hide-m">${esc(r.r)}</td><td class="n">${N(r.p)}</td><td class="n">${N(r.c)}</td><td><span class="s ${c}">${esc(l)}</span></td></tr>`}).join('')||'<tr><td colspan="6" class="emp">Nenhuma coleta encontrada.</td></tr>'};
['dt','fs'].forEach(i=>$('#'+i).onchange=run);$('#q').oninput=run;run()}
})();
