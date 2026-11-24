/* GETLOG — roteirização por proximidade (compartilhada). Regras do dono:
   - uma rota por motorista; mais perto primeiro; T4/T5 e grandes volumes (>= 3.000) por último; início 08:00;
   - mesmo endereço (rua + número, sem sala/loja/galpão/-2) = mesma parada;
   - tempo na parada = 3 min + volume / 25 pacotes por minuto (máx. 90); deslocamento ~25 km/h (distância x 1,35).
   Posição: BAIRRO primeiro (rápido, serve a todos) e CEP/endereço (preciso) só para os motoristas no mapa.
   Tudo restrito à região de São Paulo; posições guardadas no aparelho (localStorage getlog_geo2). */
(function(){
"use strict";
const sa=t=>String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const gq=l=>l.startsWith('CEP ')?l.slice(4)+', Brasil':l+', SP';
const lug=r=>r.b?r.b+', '+(r.ci||'São Paulo'):r.cep.length>=5?'CEP '+r.cep.slice(0,5)+'-'+(r.cep.slice(5,8)||'000'):r.ci?r.ci:'';
const hav=(a,b)=>{const R=Math.PI/180,x=(b[0]-a[0])*R,y=(b[1]-a[1])*R,h=Math.sin(x/2)**2+Math.cos(a[0]*R)*Math.cos(b[0]*R)*Math.sin(y/2)**2;return 12742*Math.asin(Math.sqrt(h))};
const minH=m=>{m=Math.round(m);return String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(m%60).padStart(2,'0')};
const vol=r=>Math.max(r.p||0,r.c||0,r.t||0);
const TOP=p=>p==='T5'?2:p==='T4'?1:0;
const rank=r=>r.pr==='T5'?2:(r.pr==='T4'||vol(r)>=3000)?1:0;
const dist=(a,b)=>hav(a.xy,b.xy);
const BOX=(la,lo)=>la<-22.9&&la>-24.4&&lo>-47.4&&lo<-45.6;
function endK(r){let e=sa(r.en).replace(/[.,;]/g,' ').replace(/\s+/g,' ').trim();if(!e)return {k:'u|'+r.s+'|'+r.k,rua:'',n:0};
e=e.replace(/\b(sala|conj|conjunto|loja|lj|galp|galpao|bloco|bl|andar|apto|apt|ap|box|cj|fundos|sl|torre|modulo|mod|casa|sobrado|barracao|predio|edificio|ed|km)\b.*$/,'').trim();
const m=e.match(/^(.*?)(?:\s+(?:n|no|nro|numero)\s*)?\s*(\d+)\b/);let rua=(m?m[1]:e).trim(),n=m?+m[2]:0;
rua=rua.replace(/^(r|rua)\b/,'rua').replace(/^(av|avenida)\b/,'avenida').replace(/^(al|alameda)\b/,'alameda').replace(/^(estr|estrada)\b/,'estrada').replace(/^(rod|rodovia)\b/,'rodovia').replace(/^(tv|travessa)\b/,'travessa').replace(/^(pc|praca)\b/,'praca').replace(/\b(de|da|do|dos|das)\b/g,' ').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
return {k:rua+'|'+n+'|'+sa(r.b)+'|'+sa(r.ci),rua,n}}
// ---- posições (cache) ----
let GEO={};try{GEO=JSON.parse(localStorage.getItem('getlog_geo2')||'{}')}catch(e){}
let SGT=0;const salva=()=>{if(SGT)return;SGT=setTimeout(()=>{SGT=0;try{localStorage.setItem('getlog_geo2',JSON.stringify(GEO))}catch(e){}},2000)};
const PEND=new Map(),INF=new Set(),FAIL=new Set(),NRUN={c:0,n:0};let GQ=Promise.resolve(),RFT=0,CB=null;
const geo=k=>k in GEO?Promise.resolve(GEO[k]):(GQ=GQ.then(async()=>{if(k in GEO)return GEO[k];let v=null;try{const r=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&viewbox=-47.4,-22.9,-45.6,-24.4&bounded=1&q='+encodeURIComponent(k));const j=await r.json();if(j[0]){const la=+j[0].lat,lo=+j[0].lon;if(BOX(la,lo))v=[la,lo]}}catch(e){return null}
GEO[k]=v;salva();await new Promise(r=>setTimeout(r,1100));return v}));
async function geoCep(k){let v=null;try{const r=await fetch('https://cep.awesomeapi.com.br/json/'+k.slice(4));if(r.status===404||r.status===400)v=null;else if(!r.ok){FAIL.add(k);return}else{const j=await r.json(),la=+j.lat,lo=+j.lng;if(la&&lo&&BOX(la,lo))v=[la,lo]}}catch(e){FAIL.add(k);return}
GEO[k]=v;salva()}
const refaz=()=>{if(RFT)return;RFT=setTimeout(()=>{RFT=0;if(CB)CB()},350)};
async function worker(t){NRUN[t]++;try{for(;;){const L=[...PEND.entries()].filter(([q])=>q.startsWith('cep:')===(t==='c')).sort((x,y)=>y[1]-x[1]);if(!L.length)break;const q=L[0][0];PEND.delete(q);INF.add(q);
try{if(t==='c')await geoCep(q);else{await geo(q);if(!(q in GEO))FAIL.add(q)}}finally{INF.delete(q)}refaz()}}finally{NRUN[t]--;if(!NRUN.c&&!NRUN.n)refaz()}}
function busca(){const tem=t=>[...PEND.keys()].some(q=>q.startsWith('cep:')===(t==='c'));while(NRUN.c<6&&tem('c'))worker('c');if(NRUN.n<1&&tem('n'))worker('n')}
function posiciona(r,pri){const fila=(q,w)=>{if(!INF.has(q))PEND.set(q,(PEND.get(q)||0)+w)};
if(pri){const e=endK(r),pr=[];if(r.cep.length>=8)pr.push('cep:'+r.cep.slice(0,8));if(e.rua&&e.n)pr.push(gq(e.rua+' '+e.n+', '+(r.b?r.b+', ':'')+(r.ci||'São Paulo')));
for(const q of pr){if(q in GEO){if(GEO[q])return GEO[q];continue}if(FAIL.has(q))continue;fila(q,vol(r)+1+1e9);break}}
for(const q of [gq(lug(r)),gq(r.ci||'São Paulo')]){if(q in GEO){if(GEO[q])return GEO[q];continue}if(FAIL.has(q))continue;fila(q,vol(r)+1+(pri?2e9:0));return null}return null}
// ---- ordem das paradas ----
function ordena(S){const ok=S.filter(r=>r.xy),cen=ok.length?[ok.reduce((a,r)=>a+r.xy[0],0)/ok.length,ok.reduce((a,r)=>a+r.xy[1],0)/ok.length]:null;let out=[],atual=null;
for(let k=0;k<3;k++){const B=ok.filter(r=>rank(r)===k),X=S.filter(r=>!r.xy&&rank(r)===k).sort((a,b)=>vol(a)-vol(b));if(B.length){
let ini=atual?B.reduce((m,r)=>dist(atual,r)<dist(atual,m)?r:m):B.reduce((m,r)=>hav(cen,r.xy)>hav(cen,m.xy)?r:m);const P=[ini],R=B.filter(x=>x!==ini);
while(R.length){const l=P[P.length-1];let j=0;for(let i=1;i<R.length;i++)if(dist(l,R[i])<dist(l,R[j]))j=i;P.push(R.splice(j,1)[0])}
for(let it=0,ch=true;ch&&it<40;it++){ch=false;for(let i=1;i<P.length-1;i++)for(let j=i+1;j<P.length;j++){const a=P[i-1],b=P[i],c=P[j],d=P[j+1];const g=dist(a,b)+(d?dist(c,d):0)-dist(a,c)-(d?dist(b,d):0);if(g>1e-6){P.splice(i,j-i+1,...P.slice(i,j+1).reverse());ch=true}}}
out=out.concat(P);atual=P[P.length-1]}out=out.concat(X)}return out}
/** items: [{k (chave do motorista), nome, s (seller), b, ci, cep (só dígitos), en, p, c, t, pr ('T4'/'T5'/''), ref}]. MK: Set de chaves de motoristas que aparecem no mapa (ganham a posição precisa).
    Preenche item.rn (nº da parada) e item.eta (minutos desde 00:00). Devolve Map k -> {nome, rows:[paradas], km, fim, nl}. */
function rotear(items,MK,onChange){CB=onChange||CB;const por=new Map();for(const it of items){if(!lug(it))continue;if(!por.has(it.k))por.set(it.k,[]);por.get(it.k).push(it)}
const out=new Map(),svc=c=>Math.min(90,3+vol(c)/25);
for(const [k,S] of por){for(const r of S)r.xy=posiciona(r,MK&&MK.has(k));
const CL=new Map();for(const r of S){const e=endK(r);let c=CL.get(e.k);if(!c)CL.set(e.k,c={its:[],rua:e.rua,n:e.n,xy:r.xy,p:0,c:0,t:0,pr:''});c.its.push(r);c.p+=r.p||0;c.c+=r.c||0;c.t+=r.t||0;if(TOP(r.pr)>TOP(c.pr))c.pr=r.pr;if(!c.xy)c.xy=r.xy}
const C=[...CL.values()].sort((a,b)=>{const x=sa(a.its[0].b),y=sa(b.its[0].b);return x<y?-1:x>y?1:a.rua<b.rua?-1:a.rua>b.rua?1:a.n-b.n});
const O=ordena(C);let t=480,km=0;
O.forEach((c,i)=>{if(i){const q=O[i-1],d=q.xy&&c.xy?hav(q.xy,c.xy)*1.35:0;km+=d;t+=svc(q)+(q.xy&&c.xy?d/25*60:8)}c.rn=i+1;c.eta=t;c.its.forEach(r=>{r.rn=i+1;r.eta=t})});
out.set(k,{nome:S[0].nome||k,rows:O,km,fim:O.length?t+svc(O[O.length-1]):480,nl:S.length})}
if(PEND.size)busca();return out}
const COR=['#002060','#f86800','#11834e','#c62828','#7b1fa2','#0277bd','#8d6e00','#d81b60','#00838f','#5d4037','#455a64','#6a8f00'];
/** Desenha as rotas de `keys` no mapa Leaflet; devolve o HTML do resumo e quantas paradas ainda não têm posição. */
function desenha(L,map,layer,groups,keys){layer.clearLayers();const b=[];let falta=0,res='';
keys.forEach((k,i)=>{const o=groups.get(k);if(!o)return;const cor=COR[i%COR.length],pts=o.rows.filter(c=>c.xy);falta+=o.rows.length-pts.length;
res+=`<span><i style="background:${cor}"></i><b>${esc(o.nome)}</b> ${o.rows.length} paradas (${o.nl} sellers) · ${o.km.toFixed(0)} km · fim ~${minH(o.fim)}</span>`;
if(!pts.length)return;L.polyline(pts.map(c=>c.xy),{color:cor,weight:3,opacity:.75,dashArray:'6 6'}).addTo(layer);
pts.forEach(c=>{b.push(c.xy);L.marker(c.xy,{icon:L.divIcon({className:'rpin',html:`<span style="background:${cor}">${c.rn}</span>`,iconSize:[24,24],iconAnchor:[12,12]})}).bindPopup(`<b>${c.rn}ª parada · ${minH(c.eta)}</b><br>${c.its.map(x=>esc(x.s)).join('<br>')}<br>${esc(c.its[0].en||c.its[0].b||c.its[0].ci||'')}<br>Previsto: ${c.p.toLocaleString('pt-BR')} · Coletado: ${c.c.toLocaleString('pt-BR')}${rank(c)?' · '+esc(/^T/.test(c.pr)?c.pr:'volume alto'):''}`).addTo(layer)})});
if(b.length&&layer._n!==b.length)map.fitBounds(b,{padding:[24,24],maxZoom:14});layer._n=b.length;return {html:res,falta,pend:PEND.size}}
/** Sem motorista filtrado: bairros atendidos (tamanho = volume previsto, cor = % de coleta), como no portal do cliente. */
function bairros(L,map,layer,items){layer.clearLayers();const M=new Map();for(const r of items){const q=lug(r);if(!q)continue;let o=M.get(q);if(!o)M.set(q,o={q,p:0,c:0,n:0,r});o.p+=r.p||0;o.c+=Math.min(r.c||0,r.p||0);o.n++}
const A=[...M.values()].sort((a,b)=>b.p-a.p).slice(0,70),mx=Math.max(1,...A.map(a=>a.p)),pts=[];let falta=0;
for(const a of A){const xy=posiciona(a.r,false);if(!xy){falta++;continue}const p=a.p?a.c/a.p*100:0,cor=p>=98?'#11834e':p>=85?'#d18a00':'#c62828';pts.push(xy);
L.circleMarker(xy,{radius:6+Math.sqrt(a.p/mx)*16,color:cor,weight:2,fillColor:cor,fillOpacity:.35}).bindPopup(`<b>${esc(a.q)}</b><br>Sellers: ${a.n}<br>Previsto: ${a.p.toLocaleString('pt-BR')}<br>Coletado: ${a.c.toLocaleString('pt-BR')}<br>Coleta: <b>${p.toFixed(1).replace('.',',')}%</b>`).addTo(layer)}
if(pts.length&&layer._n!==pts.length){const q=(arr,f)=>{const v=[...arr].sort((a,b)=>a-b);return v[Math.min(v.length-1,Math.max(0,Math.round(f*(v.length-1))))]};const la=pts.map(p=>p[0]),lo=pts.map(p=>p[1]),c=pts.length>=10?[.1,.9]:[0,1];
if(pts.length===1)map.setView(pts[0],13);else map.fitBounds([[q(la,c[0]),q(lo,c[0])],[q(la,c[1]),q(lo,c[1])]],{padding:[18,18],maxZoom:14})}
layer._n=pts.length;return {falta,pend:PEND.size,n:A.length}}
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
window.GL_ROTA={rotear,desenha,bairros,minH,COR,pend:()=>PEND.size};
})();
