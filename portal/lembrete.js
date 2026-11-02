/* Lembrete sonoro do ponto. Funciona enquanto o portal estiver aberto (aba aberta, mesmo em segundo plano).
   Config e histórico ficam só neste aparelho (localStorage, por login). */
(()=>{
const KEY=l=>'gl_alm_'+l,NOMES={entrada:'Início da jornada',almoco:'Saída para almoço',retorno:'Retorno do almoço',saida:'Fim da jornada'};
const ORD=['entrada','almoco','retorno','saida'],PAD=n=>String(n).padStart(2,'0'),hhmm=d=>PAD(d.getHours())+':'+PAD(d.getMinutes());
const ld=()=>{try{return JSON.parse(localStorage.getItem(KEY(ME.login)))||{}}catch(e){return {}}};
const sv=s=>{try{localStorage.setItem(KEY(ME.login),JSON.stringify(s))}catch(e){}};
const dh=h=>{const [a,b]=String(h||'').split(':').map(Number);if(isNaN(a)||isNaN(b))return null;const d=new Date();d.setHours(a,b,0,0);return d.getTime()};
const padrao=()=>{const e=ESCALAS.find(x=>x.id===(DB.users.find(u=>u.login===ME.login)?._p?.escala));return {entrada:e?.ent||'08:00',almoco:'12:00',retorno:'13:00',saida:e?.sai||'17:00'}};
const cfg=()=>{const s=ld();return {on:!!s.on,t:{...padrao(),...(s.t||{})},adia:s.adia||{},ult:s.ult||0,off:s.off||'',log:s.log||[],dia:s.dia||''}};
let CTX=null,SOM=null,TT=null,MOD=null,TIT=document.title;
const ctx=()=>{try{CTX=CTX||new (window.AudioContext||window.webkitAudioContext)();if(CTX.state==='suspended')CTX.resume()}catch(e){}return CTX};
document.addEventListener('click',()=>{if(ld&&typeof ME!=='undefined'&&ME&&cfg().on)ctx()},{passive:true});
const bip=()=>{const c=ctx();if(!c)return;const t=c.currentTime;[0,.25,.5].forEach(o=>{const os=c.createOscillator(),g=c.createGain();os.type='square';os.frequency.value=o===.25?1100:880;g.gain.setValueAtTime(.0001,t+o);g.gain.exponentialRampToValueAtTime(.4,t+o+.02);g.gain.exponentialRampToValueAtTime(.0001,t+o+.2);os.connect(g);g.connect(c.destination);os.start(t+o);os.stop(t+o+.22)});if(navigator.vibrate)navigator.vibrate([300,150,300])};
const parar=()=>{clearInterval(SOM);SOM=null;clearInterval(TT);TT=null;document.title=TIT};
const fechar=()=>{parar();MOD?.remove();MOD=null};
const log=(s,tipo,acao,obs)=>{s.log=[{em:new Date().toISOString(),tipo,acao,obs:obs||''},...(s.log||[])].slice(0,30)};
function tocar(tipo){
  if(MOD)return;const s=cfg(),prev=localStorage.getItem(KEY(ME.login));const raw=ld();raw.ult=Date.now();sv(raw);
  const hx=tipo==='saida',base=new Date(Date.now()+3600e3);
  MOD=document.createElement('div');MOD.className='modal';MOD.style.zIndex=300;
  MOD.innerHTML=`<div class="mbox" role="alertdialog" aria-label="Lembrete de ponto"><div class="mhead"><h3>⏰ Hora de bater o ponto</h3></div><p><b>${NOMES[tipo]}</b> · programado para ${s.t[tipo]}</p>
  <div class="field" style="margin:12px 0"><label for="al-o">Comentário (opcional)</label><textarea id="al-o" rows="2" maxlength="200" placeholder="Ex.: cliente na doca, volto em 15 min"></textarea></div>
  <div style="display:grid;gap:10px"><button class="btn btn-primary" id="al-go">Bater o ponto agora</button><button class="btn btn-ghost" id="al-stop">Parar o som (toca de novo em 20 min)</button>
  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span>${hx?'Vou fazer hora extra até':'Agendar para'}</span><input type="time" id="al-h" value="${hhmm(base)}" style="min-height:40px"><button class="btn btn-ghost btn-sm" id="al-ag">${hx?'Hora extra':'Agendar'}</button></div>
  <button class="btn btn-ghost btn-sm" id="al-off">Hoje não vou bater (desligar por hoje)</button></div></div>`;
  document.body.appendChild(MOD);
  const o=()=>MOD.querySelector('#al-o').value.trim().slice(0,200);
  bip();SOM=setInterval(bip,2500);let f=0;TT=setInterval(()=>{document.title=(f++%2?TIT:'⏰ BATER O PONTO')},1000);
  try{if(document.hidden&&window.Notification&&Notification.permission==='granted')new Notification('GETLOG · Hora de bater o ponto',{body:NOMES[tipo],tag:'gl-ponto',requireInteraction:true})}catch(e){}
  MOD.querySelector('#al-stop').onclick=()=>{const r=ld();log(r,tipo,'Parou o som',o());sv(r);fechar()};
  MOD.querySelector('#al-go').onclick=()=>{const r=ld();log(r,tipo,'Foi bater',o());sv(r);fechar();location.hash='ponto';if(typeof CUR!=='undefined'&&CUR==='ponto')VIEWS.ponto()};
  MOD.querySelector('#al-ag').onclick=()=>{const h=MOD.querySelector('#al-h').value,t=dh(h);if(!t||t<=Date.now()){toast('Escolha um horário futuro.');return}const r=ld();r.adia={...(r.adia||{}),[tipo]:{ate:t,dia:new Date().toDateString()}};log(r,tipo,(hx?'Hora extra até ':'Agendou para ')+h,o());sv(r);fechar();toast('Lembrete agendado para '+h+'.')};
  MOD.querySelector('#al-off').onclick=()=>{const r=ld();r.off=new Date().toDateString();log(r,tipo,'Desligou por hoje',o());sv(r);fechar()};
}
function tick(){
  if(typeof ME==='undefined'||!ME||!DB||MOD)return;
  let s;try{s=cfg()}catch(e){return}
  if(!s.on||s.off===new Date().toDateString())return;
  let mine;try{mine=marcasHoje()}catch(e){return}
  const next=ORD.find(t=>!mine.has(t));if(!next)return;
  const ag=s.adia[next],hoje=new Date().toDateString();
  const due=ag&&ag.dia===hoje?ag.ate:dh(s.t[next]);
  if(!due||Date.now()<due)return;
  if(Date.now()-s.ult<20*60e3)return;
  tocar(next);
}
setInterval(tick,15000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick()});
/* Caixa de configuração na tela "Bater ponto" */
window.GL_ALARME=function(host){
  if(!host||!ME)return;const s=cfg();
  host.innerHTML=`<div class="box mt"><div class="box-head"><div><h3>⏰ Lembrete sonoro</h3><p>Toca até você parar e repete a cada 20 min se o ponto não for batido. Funciona com o portal aberto.</p></div></div>
  <label class="check"><input type="checkbox" id="lm-on"${s.on?' checked':''}> Ativar lembrete neste aparelho</label>
  <div id="lm-box" style="display:${s.on?'grid':'none'};gap:10px;margin-top:12px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">${ORD.map(t=>`<label class="field"><span>${NOMES[t]}</span><input type="time" data-lt="${t}" value="${s.t[t]}"></label>`).join('')}</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary btn-sm" id="lm-sv">Salvar horários</button><button class="btn btn-ghost btn-sm" id="lm-test">Testar som</button></div>
  ${s.log.length?`<details><summary>Últimos avisos e comentários</summary><ul style="margin:8px 0 0;padding-left:18px;font-size:.88rem">${s.log.slice(0,8).map(l=>`<li>${new Date(l.em).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})} · ${NOMES[l.tipo]} · ${esc(l.acao)}${l.obs?' — “'+esc(l.obs)+'”':''}</li>`).join('')}</ul></details>`:''}</div></div>`;
  const on=host.querySelector('#lm-on'),bx=host.querySelector('#lm-box');
  on.onchange=()=>{const r=ld();r.on=on.checked;sv(r);bx.style.display=on.checked?'grid':'none';if(on.checked){ctx();bip();try{window.Notification&&Notification.permission==='default'&&Notification.requestPermission()}catch(e){}toast('Lembrete ativado.')}else toast('Lembrete desligado.')};
  host.querySelector('#lm-sv').onclick=()=>{const r=ld();r.t={};host.querySelectorAll('[data-lt]').forEach(i=>{if(i.value)r.t[i.dataset.lt]=i.value});r.ult=0;sv(r);toast('Horários salvos.')};
  host.querySelector('#lm-test').onclick=()=>{ctx();bip()};
};
})();
