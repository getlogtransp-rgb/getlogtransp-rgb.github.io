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
const WA='https://wa.me/5511989141009?text='+encodeURIComponent('Olá, GETLOG! Sou cliente e preciso de ajuda com as coletas.');
const P1=n=>(Math.round(n*10)/10).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
const pcCor=p=>p>=98?'var(--ok)':p>=85?'var(--warn)':'var(--bad)';
const fmtD=k=>k.split('-').reverse().join('/');
// Hora "14:32", "22/10/2026 14:32" ou fração do Excel → hora inteira (0–23) ou -1.
const hr=h=>{if(h==null||h==='')return -1;if(typeof h==='number'||/^\d*\.\d+$/.test(h)){const f=+h%1;return f?Math.floor(f*24):-1}const m=String(h).match(/(\d{1,2}):\d{2}/);return m&&+m[1]<24?+m[1]:-1};
// Cache do dia no aparelho (versão = modificadoEm do Drive): reabrir é instantâneo e só baixa o que mudou.
const CK='getlog_cli2_';const lerC=(d,v)=>{try{const o=JSON.parse(localStorage.getItem(CK+d));return o&&o.v===v?o.r:null}catch(e){return null}};
const gravaC=(d,v,r)=>{try{localStorage.setItem(CK+d,JSON.stringify({v,r}))}catch(e){try{Object.keys(localStorage).filter(k=>k.startsWith(CK)).forEach(k=>localStorage.removeItem(k))}catch(x){}}};
async function app(){const S=JSON.parse(sessionStorage.getItem(S_KEY));const C=window.GL_CORE;
$('#login').hidden=true;const A=$('#app');A.hidden=false;
A.innerHTML=`<header class="hd"><div class="w"><div class="hd-row"><span class="chip-logo"><img src="/assets/logo-getlog.webp" alt="GETLOG" width="84" height="34"></span><div class="hd-act"><a class="out wa-top" href="${WA}" target="_blank" rel="noopener">Fale conosco</a><button class="out" id="sair">Sair</button></div></div>
<h1>Coletas ${esc(S.name)}</h1><p>Performance de coleta e de visita, em tempo real, da operação GETLOG.</p><span class="upd"><i></i><span id="upd">Conectando ao Drive...</span></span></div></header>
<main class="w body"><section class="flt"><div class="chips" id="per" role="group" aria-label="Período">${[['1','Último dia'],['2','2 dias'],['7','7 dias'],['15','15 dias'],['30','30 dias'],['c','Personalizado']].map(([v,l])=>`<button type="button" data-p="${v}">${l}</button>`).join('')}</div>
<div class="rng" id="rng" hidden><label>De <input type="date" id="d1"></label><label>Até <input type="date" id="d2"></label></div>
<div class="fl"><select id="fr" aria-label="Região"></select><select id="fm" aria-label="Motorista"></select><select id="fp" aria-label="Prioridade"></select><select id="fs" aria-label="Situação"><option value="">Todas as situações</option><option value="ok">Coletado</option><option value="warn">Parcial / em rota</option><option value="bad">Não coletado</option></select><input id="q" type="search" placeholder="Buscar seller, motorista ou bairro" aria-label="Buscar"></div>
<div class="prog" id="prog" hidden><i></i></div></section>
<div class="kp" id="kp"></div><section class="card t45" id="t45" hidden></section>
<div class="g2"><section class="card"><h2>Performance por dia</h2><p class="sub">Previsto × coletado e % de coleta e visita</p><div class="ch" id="chD"></div></section>
<section class="card"><h2>Coletas por hora</h2><p class="sub">Pacotes coletados em cada hora e acumulado do previsto</p><div class="ch" id="chH"></div></section></div>
<div class="g2"><section class="card"><h2>Performance por região</h2><p class="sub">% de coleta do previsto</p><div class="ch" id="chR"></div></section>
<section class="card"><h2>Mapa da operação</h2><p class="sub" id="mapS">Bairros atendidos; cor = performance de coleta</p><div id="map"></div></section></div>
<section class="card"><div class="tb-h"><div><h2>Sellers</h2><p class="sub" id="sub"></p></div><button class="btn2" id="csv" type="button">Baixar planilha (CSV)</button></div><div class="tw"><table><thead><tr><th data-o="dk">Data</th><th data-o="s">Seller</th><th class="hide-m" data-o="m">Motorista</th><th class="hide-m" data-o="r">Região</th><th class="hide-m" data-o="b">Bairro</th><th class="hide-m" data-o="pr">Prior.</th><th class="n" data-o="p">Previsto</th><th class="n" data-o="c">Coletado</th><th class="n hide-m" data-o="h">Hora</th><th>Status</th></tr></thead><tbody id="tb"></tbody></table></div><div class="more" id="more"></div></section>
<p class="ft">GETLOG Transportes · <a href="${WA}" target="_blank" rel="noopener">WhatsApp +55 11 98914-1009</a></p></main>
<a class="wa" href="${WA}" target="_blank" rel="noopener" aria-label="Fale conosco no WhatsApp"><svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true"><path fill="#fff" d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3zm0 23.6c-2 0-4-.5-5.7-1.6l-.4-.2-3.9 1 1-3.8-.3-.4A10.6 10.6 0 1 1 16 26.6zm5.8-7.9c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2l-1 1.2c-.2.2-.4.2-.7.1a8.7 8.7 0 0 1-4.3-3.8c-.3-.6.3-.5 1-1.7.1-.2 0-.4 0-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4s-1.2 1.1-1.2 2.8 1.2 3.2 1.4 3.5c.2.2 2.4 3.6 5.8 5.1 2.2.9 3 1 4.1.8.7-.1 1.9-.8 2.2-1.5s.3-1.4.2-1.5c-.1-.1-.3-.2-.6-.3z"/></svg><span>Fale conosco</span></a>`;
$('#sair').onclick=sai;
const kp=$('#kp');kp.innerHTML='<div class="k sk"></div>'.repeat(6);
let LS=[];try{LS=(await get('fonte=lista',S.t)).filter(x=>/^\d{2}\.\d{2}\.\d{4}$/.test(x.dia)).map(x=>({...x,k:dk(x.dia)})).sort((a,b)=>a.k<b.k?1:-1).slice(0,60)}
catch(e){$('#upd').textContent='Sem conexão com o Drive';kp.innerHTML='<div class="k err">Não foi possível carregar os dados agora. <button class="btn2" onclick="location.reload()">Tentar de novo</button></div>';return}
if(!LS.length){$('#upd').textContent='Nenhum dia publicado';kp.innerHTML='';return}
const ult=LS.reduce((m,x)=>{const t=new Date(x.modificadoEm).getTime();return t>m?t:m},0);if(ult){const e=new Date(ult);$('#upd').textContent='Última atualização: '+e.toLocaleDateString('pt-BR')+' às '+e.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
// Cliente vazio ou TODOS (ex.: iMile, cliente principal) vê a operação inteira.
const tudo=!S.cliente||norm(S.cliente)==='todos'||/imile/.test(norm(S.cliente+' '+S.login));
const MEM={};
const carrega=it=>MEM[it.dia]||(MEM[it.dia]=(async()=>{const h=lerC(it.dia,it.modificadoEm);if(h)return h;
const j=await get('fonte=performance&dia='+encodeURIComponent(it.dia),S.t);const R=C.normRows(C.toRecords(j.conteudo),it.k);const eu=tudo?null:C.casar([S.cliente],R.map(r=>r.cli));
// Linha compacta: data, seller, motorista, região, bairro, cidade, status, hora, previsto, coletado do previsto, total, justificado
const out=R.filter(r=>tudo||eu.has(r.cli)).map(r=>[it.k,r.seller,r.mo.replace(/^.*? - /,''),r.reg,r.bai,r.cid,r.st,r.hora,r.prev,r.col,r.tot,r.jus,r.pri]);gravaC(it.dia,it.modificadoEm,out);return out})().catch(e=>{delete MEM[it.dia];throw e}));
const kmin=LS[LS.length-1].k,kmax=LS[0].k;$('#d1').min=$('#d2').min=kmin;$('#d1').max=$('#d2').max=kmax;$('#d1').value=$('#d2').value=kmax;
let per='1',ROWS=[],GEN=0,ORD={o:'p',d:-1},LIM=50;
const dias=()=>per==='c'?(()=>{let a=$('#d1').value||kmin,b=$('#d2').value||kmax;if(a>b)[a,b]=[b,a];return LS.filter(x=>x.k>=a&&x.k<=b)})():LS.slice(0,+per);
const prog=$('#prog');
async function load(){const g=++GEN,D=dias();let feitos=0;prog.hidden=false;prog.firstChild.style.width='4%';
const res=new Array(D.length);let i=0,falhas=0;
await Promise.all(Array.from({length:Math.min(4,D.length)},async()=>{while(i<D.length){const k=i++;try{res[k]=await carrega(D[k])}catch(e){res[k]=[];falhas++}if(g!==GEN)return;prog.firstChild.style.width=(++feitos/D.length*100)+'%'}}));
if(g!==GEN)return;prog.hidden=true;ROWS=res.flat().map(a=>({dk:a[0],s:a[1],m:a[2],r:a[3],b:a[4],ci:a[5],st:a[6],hs:a[7],h:hr(a[7]),p:a[8],c:a[9],t:a[10],j:a[11],pr:String(a[12]||'').toUpperCase()}));
if(falhas)$('#upd').textContent='Alguns dias não carregaram ('+falhas+'). Tente atualizar.';
const FP=$('#fp').value;const opt=(id,lbl,vals)=>{const el=$('#'+id),v=el.value;el.innerHTML=`<option value="">${lbl}</option>`+[...new Set(vals.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')).map(x=>`<option${x===v?' selected':''}>${esc(x)}</option>`).join('')};
opt('fr','Todas as regiões',ROWS.map(r=>r.r));opt('fm','Todos os motoristas',ROWS.map(r=>r.m));opt('fp','Todas as prioridades',ROWS.map(r=>r.pr).filter(x=>x&&x!=='—'));if(ROWS.some(r=>/T\s?[45]/.test(r.pr))){const f=$('#fp');f.insertAdjacentHTML('beforeend','<option value="T45">Só T4 e T5</option>');if(FP==='T45')f.value='T45'}LIM=50;run()}
const cls=r=>r.st==='Em rota'?['warn','Em rota']:r.p>0&&r.c>=r.p?['ok','Coletado']:r.c>0||r.t>0?['warn','Parcial']:['bad',r.j>0?'Justificado':r.st&&r.st!=='—'&&r.st!=='Coletado'?r.st:'Não coletado'];
const vis=r=>r.t>0||r.j>0||r.c>0;
const filtra=()=>{const q=norm($('#q').value),fr=$('#fr').value,fm=$('#fm').value,fs=$('#fs').value,fp=$('#fp').value;return ROWS.filter(r=>(!fp||(fp==='T45'?/T\s?[45]/.test(r.pr):r.pr===fp))&&(!fr||r.r===fr)&&(!fm||r.m===fm)&&(!fs||cls(r)[0]===fs)&&(!q||norm(r.s+' '+r.m+' '+r.b+' '+r.ci).includes(q)))};
const agr=(R,key)=>{const M=new Map();for(const r of R){const k=key(r);let o=M.get(k);if(!o)M.set(k,o={k,p:0,c:0,t:0,n:0,v:0});o.p+=r.p;o.c+=Math.min(r.c,r.p);o.t+=r.t;o.n++;if(vis(r))o.v++}return [...M.values()]};
let F=[];
function run(){F=filtra();const P=F.reduce((a,r)=>a+r.p,0),Cc=F.reduce((a,r)=>a+Math.min(r.c,r.p),0),T=F.reduce((a,r)=>a+r.t,0),pc=P?Cc/P*100:0,V=F.filter(vis).length,pv=F.length?V/F.length*100:0;
const pend=F.filter(r=>cls(r)[0]==='bad').length;
const K=(l,v,s,c)=>`<div class="k${c?' pc':''}"${c?` style="--c:${c}"`:''}><small>${l}</small><b>${v}</b>${s||''}</div>`;const ring=p=>`<div class="ring"><i style="width:${Math.min(100,p)}%"></i></div>`;
kp.innerHTML=K('Pacotes previstos',N(P))+K('Coletados do previsto',N(Cc),`<span class="ks">Total coletado: ${N(T)}</span>`)+K('Performance de coleta',P1(pc),ring(pc),pcCor(pc))+K('Performance de visita',P1(pv),ring(pv),pcCor(pv))+K('Sellers visitados',N(V)+' <em>de '+N(F.length)+'</em>')+K('Não coletados',N(pend),'',pend?'var(--bad)':'var(--ok)');
charts();t45();tabela();mapa()}
// ---- Gráficos (SVG desenhado na largura real do quadro: textos nunca se sobrepõem) ----
const W=el=>Math.max(260,el.clientWidth-24);
function chD(){const el=$('#chD'),A=agr(F,r=>r.dk).sort((a,b)=>a.k<b.k?-1:1);if(!A.length){el.innerHTML='<p class="emp">Sem dados no período.</p>';return}
const w=W(el),h=230,pl=44,pr=40,pt=14,pb=34,cw=w-pl-pr,ch=h-pt-pb,mx=Math.max(1,...A.map(a=>a.p)),bw=cw/A.length,x=i=>pl+i*bw;const y=v=>pt+ch-v/mx*ch,yp=v=>pt+ch-v/100*ch;
const every=Math.ceil(A.length/Math.floor(cw/52));let s=`<svg width="${w}" height="${h}" role="img" aria-label="Performance por dia">`;
for(let i=0;i<=4;i++){const v=mx*i/4;s+=`<line x1="${pl}" x2="${w-pr}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="${pl-6}" y="${y(v)+4}" class="ax" text-anchor="end">${v>=1000?(v/1000).toFixed(1).replace('.0','')+'k':Math.round(v)}</text><text x="${w-pr+6}" y="${yp(i*25)+4}" class="ax">${i*25}%</text>`}
const b=Math.min(26,bw*.36);A.forEach((a,i)=>{const cx=x(i)+bw/2;s+=`<rect x="${cx-b}" y="${y(a.p)}" width="${b}" height="${pt+ch-y(a.p)}" rx="3" class="bp"><title>${fmtD(a.k)} · Previsto ${N(a.p)}</title></rect><rect x="${cx}" y="${y(a.c)}" width="${b}" height="${pt+ch-y(a.c)}" rx="3" class="bc"><title>${fmtD(a.k)} · Coletado ${N(a.c)}</title></rect>`;if(i%every===0)s+=`<text x="${cx}" y="${h-12}" class="ax" text-anchor="middle">${fmtD(a.k).slice(0,5)}</text>`});
const ln=(f,c)=>{const pts=A.map((a,i)=>[x(i)+bw/2,yp(f(a))]);return `<polyline points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${c}" stroke-width="2.5"/>`+pts.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${c}"><title>${fmtD(A[i].k)} · ${P1(f(A[i]))}</title></circle>`).join('')};
s+=ln(a=>a.p?a.c/a.p*100:0,'#f86800')+ln(a=>a.n?a.v/a.n*100:0,'#11834e')+'</svg>';
el.innerHTML=s+`<div class="lg2"><span><i class="bp"></i>Previsto</span><span><i class="bc"></i>Coletado</span><span><i style="background:#f86800"></i>% coleta</span><span><i style="background:#11834e"></i>% visita</span></div>`}
function chH(){const el=$('#chH'),H=new Array(24).fill(0);let P=0;for(const r of F){P+=r.p;if(r.h>=0)H[r.h]+=r.t}const ini=H.findIndex(v=>v>0);if(ini<0){el.innerHTML='<p class="emp">Sem horários de coleta no período.</p>';return}
const fim=23-[...H].reverse().findIndex(v=>v>0),hs=[];for(let i=ini;i<=fim;i++)hs.push(i);
const w=W(el),h=230,pl=44,pr=40,pt=14,pb=34,cw=w-pl-pr,ch=h-pt-pb,mx=Math.max(1,...hs.map(i=>H[i])),bw=cw/hs.length,y=v=>pt+ch-v/mx*ch,yp=v=>pt+ch-Math.min(100,v)/100*ch;
const every=Math.ceil(hs.length/Math.floor(cw/38));let s=`<svg width="${w}" height="${h}" role="img" aria-label="Coletas por hora">`;
for(let i=0;i<=4;i++){const v=mx*i/4;s+=`<line x1="${pl}" x2="${w-pr}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="${pl-6}" y="${y(v)+4}" class="ax" text-anchor="end">${Math.round(v)}</text><text x="${w-pr+6}" y="${yp(i*25)+4}" class="ax">${i*25}%</text>`}
let ac=0;const pts=[];hs.forEach((hh,i)=>{const cx=pl+i*bw+bw/2,b=Math.min(34,bw*.7);s+=`<rect x="${cx-b/2}" y="${y(H[hh])}" width="${b}" height="${pt+ch-y(H[hh])}" rx="3" class="bc"><title>${hh}h · ${N(H[hh])} pacotes</title></rect>`;ac+=H[hh];pts.push([cx,yp(P?ac/P*100:0),hh,ac]);if(i%every===0)s+=`<text x="${cx}" y="${h-12}" class="ax" text-anchor="middle">${hh}h</text>`});
s+=`<polyline points="${pts.map(p=>p[0]+','+p[1]).join(' ')}" fill="none" stroke="#f86800" stroke-width="2.5"/>`+pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="#f86800"><title>Até ${p[2]}h · ${N(p[3])} (${P1(P?p[3]/P*100:0)})</title></circle>`).join('');
const pk=hs.reduce((a,b)=>H[b]>H[a]?b:a,hs[0]);el.innerHTML=s+`</svg><div class="lg2"><span><i class="bc"></i>Pacotes na hora</span><span><i style="background:#f86800"></i>% acumulado do previsto</span><span class="pk">Pico: <b>${pk}h</b> (${N(H[pk])})</span></div>`}
function chR(){const el=$('#chR'),A=agr(F,r=>r.r||'Sem região').sort((a,b)=>b.p-a.p);if(!A.length){el.innerHTML='<p class="emp">Sem dados.</p>';return}
el.innerHTML=`<div class="rg">${A.map(a=>{const p=a.p?a.c/a.p*100:0,v=a.n?a.v/a.n*100:0;return `<button type="button" class="rr${$('#fr').value===a.k?' on':''}" data-r="${esc(a.k)}"><span class="rn">${esc(a.k)}</span><span class="rb"><i style="width:${Math.min(100,p)}%;background:${pcCor(p)}"></i></span><b style="color:${pcCor(p)}">${P1(p)}</b><small>${N(a.c)} de ${N(a.p)} · visita ${P1(v)}</small></button>`}).join('')}</div>`;
el.querySelectorAll('.rr').forEach(b=>b.onclick=()=>{const f=$('#fr');f.value=f.value===b.dataset.r?'':b.dataset.r;run()})}
function charts(){chD();chH();chR()}
let rt=0;addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{if(F.length||ROWS.length){charts();MAP&&MAP.invalidateSize()}},150)});
// ---- Destaque T4/T5: sellers prioritários ----
function t45(){const el=$('#t45'),is=r=>/\bT\s?[45]\b/.test(r.pr);const X=F.filter(is);if(!X.length){el.hidden=true;return}el.hidden=false;
const g=['T4','T5'].map(t=>{const R=X.filter(r=>r.pr.replace(/\s/g,'').includes(t)),P=R.reduce((a,r)=>a+r.p,0),Cc=R.reduce((a,r)=>a+Math.min(r.c,r.p),0),pc=P?Cc/P*100:0,v=R.length?R.filter(vis).length/R.length*100:0;
return `<div class="tk"><span class="tg">${t}</span><b style="color:${pcCor(pc)}">${R.length?P1(pc):'—'}</b><small>coleta · ${N(Cc)} de ${N(P)} pacotes</small><small>visita ${R.length?P1(v):'—'} · ${N(R.length)} sellers</small></div>`}).join('');
const pend=X.filter(r=>cls(r)[0]!=='ok').sort((a,b)=>b.p-a.p);
el.innerHTML=`<div class="tb-h"><div><h2>Sellers prioritários T4 e T5</h2><p class="sub">Acompanhamento em destaque dos sellers de maior prioridade</p></div><button class="btn2" type="button" id="t45f">${$('#fp').value==='T45'?'Ver todos':'Ver só T4 e T5'}</button></div>
<div class="tks">${g}</div>${pend.length?`<p class="sub"><b>${N(pend.length)}</b> ainda sem coleta completa:</p><div class="tw"><table><tbody>${pend.slice(0,5).map(r=>`<tr><td><span class="tg">${esc(r.pr)}</span></td><td class="sl">${esc(r.s)}</td><td class="hide-m">${esc(r.m)}</td><td class="n">${N(r.c)}/${N(r.p)}</td><td><span class="s ${cls(r)[0]}">${esc(cls(r)[1])}</span></td></tr>`).join('')}</tbody></table></div>`:'<p class="sub ok-t">Todos os sellers T4 e T5 foram coletados. ✔</p>'}`;
$('#t45f').onclick=()=>{const f=$('#fp');f.value=f.value==='T45'?'':'T45';LIM=50;run()}}
// ---- Tabela ----
function tabela(){const o=ORD.o,d=ORD.d;const R=[...F].sort((a,b)=>{const x=a[o],y=b[o];return (typeof x==='number'?x-y:String(x).localeCompare(String(y),'pt-BR'))*d});
$('#sub').textContent=N(F.length)+' registros';
document.querySelectorAll('th[data-o]').forEach(th=>{th.classList.toggle('so',th.dataset.o===o);th.dataset.d=d>0?'▲':'▼'});
$('#tb').innerHTML=R.length?R.slice(0,LIM).map(r=>{const [c,l]=cls(r);return `<tr><td>${fmtD(r.dk).slice(0,5)}</td><td class="sl">${esc(r.s)}</td><td class="hide-m">${esc(r.m)}</td><td class="hide-m">${esc(r.r)}</td><td class="hide-m">${esc(r.b)}</td><td class="hide-m">${/T[45]/.test(r.pr)?`<span class="tg">${esc(r.pr)}</span>`:esc(r.pr)}</td><td class="n">${N(r.p)}</td><td class="n">${N(r.c)}</td><td class="n hide-m">${r.h>=0?esc(String(r.hs).match(/\d{1,2}:\d{2}/)?.[0]||''):''}</td><td><span class="s ${c}">${esc(l)}</span></td></tr>`}).join(''):'<tr><td colspan="10" class="emp">Nenhuma coleta encontrada.</td></tr>';
$('#more').innerHTML=R.length>LIM?`<button class="btn2" type="button" id="mais">Mostrar mais (${N(R.length-LIM)} restantes)</button>`:'';if($('#mais'))$('#mais').onclick=()=>{LIM+=300;tabela()}}
document.querySelectorAll('th[data-o]').forEach(th=>th.onclick=()=>{ORD=ORD.o===th.dataset.o?{o:ORD.o,d:-ORD.d}:{o:th.dataset.o,d:['p','c','h','dk'].includes(th.dataset.o)?-1:1};tabela()});
$('#csv').onclick=()=>{const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';const t=[['Data','Seller','Motorista','Região','Bairro','Cidade','Previsto','Coletado do previsto','Coletado total','Hora','Status'].map(q).join(';'),...F.map(r=>[fmtD(r.dk),r.s,r.m,r.r,r.b,r.ci,r.p,r.c,r.t,r.hs,cls(r)[1]].map(q).join(';'))].join('\r\n');
const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+t],{type:'text/csv;charset=utf-8'}));a.download='coletas-getlog.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)};
// ---- Mapa: bairros atendidos (posição pelo bairro/cidade, guardada no aparelho) ----
let MAP=null,LAY=null,GEO={},GQ=Promise.resolve(),MG=0;try{GEO=JSON.parse(localStorage.getItem('getlog_geo')||'{}')}catch(e){}
const geo=k=>k in GEO?Promise.resolve(GEO[k]):(GQ=GQ.then(async()=>{if(k in GEO)return GEO[k];let v=null;try{const r=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q='+encodeURIComponent(k));const j=await r.json();if(j[0])v=[+j[0].lat,+j[0].lon]}catch(e){return null}
GEO[k]=v;try{localStorage.setItem('getlog_geo',JSON.stringify(GEO))}catch(e){}await new Promise(r=>setTimeout(r,1100));return v}));
async function mapa(){if(!window.L)return;const g=++MG;if(!MAP){MAP=L.map('map',{scrollWheelZoom:false}).setView([-23.55,-46.63],10);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap'}).addTo(MAP);LAY=L.layerGroup().addTo(MAP)}
LAY.clearLayers();const A=agr(F.filter(r=>r.b||r.ci),r=>[r.b,r.ci||'São Paulo'].filter(Boolean).join(', ')).sort((a,b)=>b.p-a.p).slice(0,60);const mx=Math.max(1,...A.map(a=>a.p));const pts=[];
$('#mapS').textContent=A.length?'Bairros atendidos ('+A.length+'); tamanho = volume, cor = performance de coleta':'Sem endereço nos dados do período.';
for(const a of A){const c=await geo(a.k+', SP');if(g!==MG)return;if(!c)continue;const p=a.p?a.c/a.p*100:0,cor=p>=98?'#11834e':p>=85?'#d18a00':'#c62828';pts.push(c);
L.circleMarker(c,{radius:6+Math.sqrt(a.p/mx)*16,color:cor,weight:2,fillColor:cor,fillOpacity:.35}).bindPopup(`<b>${esc(a.k)}</b><br>Previsto: ${N(a.p)}<br>Coletado: ${N(a.c)}<br>Coleta: <b>${P1(p)}</b> · Visita: ${P1(a.n?a.v/a.n*100:0)}`).addTo(LAY);
if(pts.length===1||pts.length===8)MAP.fitBounds(pts.length===1?L.latLng(c).toBounds(8000):pts,{padding:[24,24],maxZoom:13})}
if(pts.length>1)MAP.fitBounds(pts,{padding:[24,24],maxZoom:13})}
// ---- Filtros ----
const setPer=v=>{per=v;document.querySelectorAll('#per button').forEach(b=>b.classList.toggle('on',b.dataset.p===v));$('#rng').hidden=v!=='c';load()};
document.querySelectorAll('#per button').forEach(b=>b.onclick=()=>setPer(b.dataset.p));
['d1','d2'].forEach(i=>$('#'+i).onchange=()=>load());['fr','fm','fs','fp'].forEach(i=>$('#'+i).onchange=()=>{LIM=50;run()});
let qt=0;$('#q').oninput=()=>{clearTimeout(qt);qt=setTimeout(()=>{LIM=50;run()},200)};
setPer('1')}
})();
