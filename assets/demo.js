(()=>{
const COLS=["DATA","SELLER ID","SELLER","CLIENTE","MOTORISTA ATRIBUÍDO","MOTORISTA OFICIAL","WAYBILL REFERÊNCIA","ENDEREÇO","BAIRRO","CIDADE","ESTADO","CEP","REGIÃO","TIPO DE PRIORIDADE","STATUS DO SELLER","HORA","PREVISTO","COLETADO DO PREVISTO","NÃO COLETADO","COLETA ADIANTADA","COLETADO TOTAL","COLETADO DS FM NOR","COLETADO NÃO DESCARREGADO","JUSTIFICADO","NÃO JUSTIFICADO","JUSTIFICATIVA","AJUDANTE"];
const MOT=["CARLOS M. SOUZA","ANA P. LIMA","JOAO R. ALVES","MARCOS T. SILVA","RAFAEL D. COSTA","PAULA F. ROCHA","DIEGO A. NUNES","LUCAS H. PRADO","BRUNO C. DIAS","FERNANDA S. MELO","THIAGO V. RAMOS","JULIANA K. PORTO"];
const AJU=["PEDRO L. SANTOS","MARIANA O. CRUZ","VITOR H. MOURA","CAMILA R. TEIXEIRA"];
const CLI=[["TIKTOK",40],["KWAI",14],["SHEIN BRA",10],["IMILE",10],["NUVEMSHOP",6],["ESTOCA",4]];
const REG=[["SP Capital - Brás","Brás","São Paulo","03008"],["SP Capital - Leste","Tatuapé","São Paulo","03080"],["SP Capital - Oeste","Lapa","São Paulo","05068"],["SP Metro - Oeste","Centro","Osasco","06010"],["SP Metro - Norte","Centro","Guarulhos","07010"],["SP Metro - Sul","Centro","Santo André","09010"]];
const PRI=["Normal","Normal","Normal","Normal","Fora do previsto","Seller Novo - Primeiro Lote","T4T5 - SETEMBRO"];
const A=["UTILIDADES","MODA","SHOP","STORE","CASA","BELEZA","KIDS","TECH","PET","OUTLET","IMPORTS","DECOR","FIT","PRIME","MIX"];
const B=["AURORA","BELLA","NOVA","SOL","VIVA","PRIME","MAIS","CENTRAL","PAULISTA","BRASIL","GLOBAL","DIGITAL","LUA","MAR","RIO"];
const rng=s=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const r0=rng(20261004);const SEL=[];
for(const [c,n] of CLI)for(let i=0;i<n;i++){const g=REG[Math.floor(r0()*REG.length)];SEL.push({id:String(7400000000000000000+Math.floor(r0()*9e15)),nm:B[Math.floor(r0()*B.length)]+" "+A[Math.floor(r0()*A.length)]+" "+(100+Math.floor(r0()*900)),c,g,end:"RUA "+B[Math.floor(r0()*B.length)]+" "+(10+Math.floor(r0()*1900)),cep:g[3]+"-"+String(Math.floor(r0()*999)).padStart(3,"0"),base:2+Math.floor(r0()*r0()*60),m:Math.floor(r0()*MOT.length),a:Math.floor(r0()*AJU.length)})}
const k2=d=>d.toISOString().slice(0,10);
const br=d=>d.toLocaleDateString("pt-BR",{timeZone:"UTC"});
function day(d,isToday){
const r=rng(Number(k2(d).replace(/-/g,"")));const L=[];const wd=d.getUTCDay();const f=wd===6?.55:1;
for(const s of SEL){if(r()>(wd===6?.55:.82))continue;
const prev=Math.max(1,Math.round(s.base*f*(.6+r()*.8)));const mi=r()<.85?s.m:Math.floor(r()*MOT.length);const mot="GET - "+MOT[mi];const atr=r()<.07?"NÃO ATRIBUÍDO NA GERAL":mot;
const roll=r();let st,col,jus=0,just=null;
if(isToday&&roll<.12){st="Em rota";col=0}
else if(roll<.86){st="Coletado";col=prev-(r()<.15?Math.ceil(prev*r()*.2):0)}
else if(roll<.94){st="Produto Indisponível";col=0;jus=prev;just="Produto Indisponível ("+(1+Math.floor(r()*5))+")"}
else if(roll<.97){st="DROP Recebeu";col=prev}
else{st="Coletado";col=Math.floor(prev*.5)}
const nc=prev-col-jus;const adi=r()<.1?1+Math.floor(r()*3):0;const h=7+Math.floor(r()*10),m=Math.floor(r()*60),sx=Math.floor(r()*60);
const hora=st==="Em rota"?"":String(h).padStart(2,"0")+":"+String(m).padStart(2,"0")+":"+String(sx).padStart(2,"0");
const tot=col+adi;
L.push([br(d),s.id,s.nm,s.c,atr,st==="Em rota"?atr:mot,String(3320000000000+Math.floor(r()*9e11)),s.end,s.g[1],s.g[2],"São Paulo",s.cep,s.g[0],PRI[Math.floor(r()*PRI.length)],st,hora,prev,col,nc>0&&!jus?nc:0,adi,tot,tot,0,jus,nc>0&&!jus?nc:0,just,AJU[s.a]])}
return L}
const cache={};
window.GL_DEMO={COLS,MOT:MOT.map(x=>"GET - "+x),AJU,CLI:CLI.map(x=>x[0]),REG:REG.map(x=>x[0]),
days(n){const out={};const t=new Date();const base=Date.UTC(t.getFullYear(),t.getMonth(),t.getDate(),12);
for(let i=0;i<n;i++){const d=new Date(base-i*864e5);if(d.getUTCDay()===0)continue;const k=k2(d);
if(!cache[k])cache[k]={atualizado_em:i===0?k+" "+String(Math.min(t.getHours(),18)).padStart(2,"0")+":30:00":k+" 20:00:00",colunas:COLS,linhas:day(d,i===0),simulado:true};out[k]=cache[k]}
return out}};
})();
