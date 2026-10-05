// Regras únicas de leitura dos dados operacionais (Performance, Pacotes coletados, Dashboard e Forecast)
// e de vínculo pessoa ↔ dados. Usado pelo portal e pela Performance: uma só interpretação do mesmo dado.
(()=>{
const COLS={DATA:"DATA",SID:"SELLER ID",SELLER:"SELLER",CLI:"CLIENTE",MA:"MOTORISTA ATRIBUÍDO",MO:"MOTORISTA OFICIAL",WB:"WAYBILL REFERÊNCIA",END:"ENDEREÇO",BAI:"BAIRRO",CID:"CIDADE",CEP:"CEP",REG:"REGIÃO",PRI:"TIPO DE PRIORIDADE",ST:"STATUS DO SELLER",HORA:"HORA",CDP:"COLETADO DO PREVISTO",NC:"NÃO COLETADO",ADI:"COLETA ADIANTADA",TOT:"COLETADO TOTAL",NOR:"COLETADO DS FM NOR",NDES:"COLETADO NÃO DESCARREGADO",JUS:"JUSTIFICADO",NJ:"NÃO JUSTIFICADO",JTXT:"JUSTIFICATIVA"};
const NAO_ATRIB="NÃO ATRIBUÍDO NA GERAL";
const EMPRESA_PROPRIA="GET";
const num=v=>{if(typeof v==="number")return v;if(v==null||v==="")return 0;const n=Number(String(v).replace(/\./g,"").replace(",","."));return isFinite(n)?n:0};
const str=v=>v==null?"":String(v).trim();
const empOf=m=>{m=str(m);if(!m)return "SEM MOTORISTA";const i=m.indexOf(" - ");return i>0?m.slice(0,i).trim():m};
const nameOf=m=>{m=str(m);const i=m.indexOf(" - ");return i>0?m.slice(i+3).trim():m};
function toRecords(j){
  if(Array.isArray(j)){if(!j.length)return [];if(Array.isArray(j[0])){const h=j[0].map(str);return j.slice(1).map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]])))}return j}
  if(j&&typeof j==="object"){
    const hk=["colunas","columns","cabecalho","header","headers"].find(k=>Array.isArray(j[k]));
    const rk=["linhas","rows","dados","data","registros","values","valores"].find(k=>Array.isArray(j[k]));
    if(hk&&rk){const h=j[hk].map(str);return j[rk].map(r=>Array.isArray(r)?Object.fromEntries(h.map((k,i)=>[k,r[i]])):r)}
    if(rk)return toRecords(j[rk]);
    const arrs=Object.entries(j).filter(([k,v])=>Array.isArray(v));
    if(arrs.length&&arrs.every(([k,v])=>!v.length||typeof v[0]!=="object")&&arrs.some(([k])=>k.trim().toUpperCase()===COLS.SELLER)){const len=Math.max(...arrs.map(([k,v])=>v.length));const out=[];for(let i=0;i<len;i++){const o={};for(const [k,v] of arrs)o[k]=v[i];out.push(o)}return out}
    const big=arrs.sort((a,b)=>b[1].length-a[1].length)[0];if(big)return toRecords(big[1]);
  }
  return [];
}
function parseDT(v){if(v==null)return null;if(typeof v==="number"){const d=new Date(v>1e12?v:v*1000);return isNaN(d)?null:d}const s=String(v).trim();const m=s.match(/^(\d{2})[\/.](\d{2})[\/.](\d{4})[ T]?(\d{2}):(\d{2})(?::(\d{2}))?/);if(m)return new Date(+m[3],+m[2]-1,+m[1],+m[4],+m[5],+(m[6]||0));const d=new Date(s);return isNaN(d)?null:d}
function metaUpdate(j){if(!j||Array.isArray(j)||typeof j!=="object")return null;for(const k of Object.keys(j)){if(/atualiza|gerad|updated|modified|timestamp/i.test(k)&&typeof j[k]!=="object"){const d=parseDT(j[k]);if(d)return d}}return null}
function normRows(recs,fk){
  const out=[];
  for(const r0 of recs){
    const r={};for(const k in r0)r[k.trim().toUpperCase()]=r0[k];
    const seller=str(r[COLS.SELLER]);if(!seller&&!str(r[COLS.SID]))continue;
    let dk=fk;const m=str(r[COLS.DATA]).match(/^(\d{2})\/(\d{2})\/(\d{4})/);if(m)dk=`${m[3]}-${m[2]}-${m[1]}`;
    const cdp=num(r[COLS.CDP]),nc=num(r[COLS.NC]);const ma=str(r[COLS.MA])||NAO_ATRIB,mo=str(r[COLS.MO]);
    const tot=num(r[COLS.TOT]),pen=num(r[COLS.NJ]),ndes=num(r[COLS.NDES]);
    out.push({dk,aju:str(r["AJUDANTE"]),sid:str(r[COLS.SID]),seller:seller||str(r[COLS.SID]),cli:str(r[COLS.CLI])||"SEM CLIENTE",ma,mo,emp:empOf(mo),wb:str(r[COLS.WB]),end:str(r[COLS.END]),bai:str(r[COLS.BAI]),cid:str(r[COLS.CID]),cep:str(r[COLS.CEP]),reg:str(r[COLS.REG])||"Sem região",pri:str(r[COLS.PRI])||"—",st:str(r[COLS.ST])||"—",sit:pen>0?"Pendente":"Finalizado",des:tot>0?(ndes>0?"Não":"Sim"):"—",outro:tot>0&&mo&&ma!==mo?"Sim":"Não",hora:str(r[COLS.HORA]),prev:cdp+nc,col:cdp,nc,adi:num(r[COLS.ADI]),tot,nor:num(r[COLS.NOR]),ndes,jus:num(r[COLS.JUS]),pen,jtxt:str(r[COLS.JTXT])});
  }
  return out;
}
function parseDT(v){if(v==null)return null;if(typeof v==="number"){const d=new Date(v>1e12?v:v*1000);return isNaN(d)?null:d}const s=String(v).trim();const m=s.match(/^(\d{2})[\/.](\d{2})[\/.](\d{4})[ T]?(\d{2}):(\d{2})(?::(\d{2}))?/);if(m)return new Date(+m[3],+m[2]-1,+m[1],+m[4],+m[5],+(m[6]||0));const d=new Date(s);return isNaN(d)?null:d}
function metaUpdate(j){if(!j||Array.isArray(j)||typeof j!=="object")return null;for(const k of Object.keys(j)){if(/atualiza|gerad|updated|modified|timestamp/i.test(k)&&typeof j[k]!=="object"){const d=parseDT(j[k]);if(d)return d}}return null}
// Pacotes coletados = a mesma linha da Performance, contando só o que a GETLOG coletou (métrica "Coletado GETLOG").
const coletadoGet=r=>r.tot>0&&r.emp===EMPRESA_PROPRIA?r.tot:0;

// ---- Vínculo pessoa ↔ dados (autorização: na dúvida, não libera) ----
const nk=s=>str(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]+/g," ").trim();
const temEmp=s=>str(s).indexOf(" - ")>0;
function lev(a,b){if(a===b)return 0;let p=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const c=[i];for(let j=1;j<=b.length;j++)c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=c}return p[b.length]}
const sim=(a,b)=>{const m=Math.max(a.length,b.length);return m?1-lev(a,b)/m:0};
// Identificador → vínculo cadastrado (ref) → nome normalizado → similaridade ≥ 90% (só se houver um único candidato).
// Devolve o conjunto de valores brutos que representam a pessoa; vazio quando não há vínculo seguro.
function casar(alvos,candidatos){
  alvos=[...new Set(alvos.map(str).filter(Boolean))];const cands=[...new Set(candidatos.map(str).filter(Boolean))];
  if(!alvos.length||!cands.length)return new Set();
  const unico=hit=>new Set(hit.map(nk)).size===1?new Set(hit):new Set();
  const ka=alvos.map(nk);let hit=cands.filter(c=>ka.includes(nk(c)));if(hit.length)return unico(hit);
  const emps=new Set(alvos.filter(temEmp).map(a=>nk(empOf(a))));
  const na=alvos.map(a=>nk(nameOf(a))).filter(x=>x.length>=5);
  const ok=c=>!emps.size||!temEmp(c)||emps.has(nk(empOf(c)));
  hit=cands.filter(c=>ok(c)&&na.includes(nk(nameOf(c))));if(hit.length)return unico(hit);
  hit=cands.filter(c=>ok(c)&&na.some(a=>sim(a,nk(nameOf(c)))>=.9));return unico(hit);
}
// Colunas que identificam a pessoa em cada base, por tipo de usuário.
const CAMPOS={motorista:["MOTORISTA OFICIAL","MOTORISTA ATRIBUÍDO","MOTORISTA"],ajudante:["AJUDANTE","AJUDANTE?"]};
const veTudo=role=>role==="admin"||role==="colaborador";
// Recorta o conteúdo bruto (antes de qualquer cache ou tela) para quem não é ADM nem colaborador.
function escopo(json,sess){
  if(!sess||veTudo(sess.role))return json;
  const campos=(CAMPOS[sess.role]||[]).map(c=>c.toUpperCase());const alvos=[sess.ref,sess.name];
  const corta=(cols,linhas,get)=>{const ix=cols.map((c,i)=>campos.includes(str(c).toUpperCase())?i:-1).filter(i=>i>=0);if(!ix.length)return [];
    const vals=[];for(const r of linhas)for(const i of ix)vals.push(get(r,cols[i],i));const eu=casar(alvos,vals);
    return eu.size?linhas.filter(r=>ix.some(i=>eu.has(str(get(r,cols[i],i))))):[]};
  const rec=j=>{
    if(Array.isArray(j)){if(!j.length)return j;if(Array.isArray(j[0]))return [j[0],...corta(j[0],j.slice(1),(r,c,i)=>r[i])];if(typeof j[0]==="object"){const cols=Object.keys(j[0]);return corta(cols,j,(r,c)=>r[c])}return []}
    if(j&&typeof j==="object"){
      const hk=["colunas","columns","cabecalho","header","headers"].find(k=>Array.isArray(j[k]));const rk=["linhas","rows","dados","data","registros","values","valores"].find(k=>Array.isArray(j[k]));
      if(hk&&rk)return {...j,[rk]:corta(j[hk],j[rk],(r,c,i)=>Array.isArray(r)?r[i]:r[c])};
      const o={};for(const [k,v] of Object.entries(j))o[k]=v&&typeof v==="object"?rec(v):v;return o}
    return j};
  return rec(json);
}

// ---- Agenda de atualizações (horário de Brasília). A próxima só avança quando a atualização é confirmada nos dados. ----
const HORARIOS=["09:30","10:30","11:00","11:30","12:00","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:20","17:40","18:05","18:35","18:40","18:55","19:05","19:40","20:20","21:00","22:00","23:00","23:30"];
const TZ="America/Sao_Paulo";
const spDia=d=>new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
const spHM=d=>new Intl.DateTimeFormat("en-GB",{timeZone:TZ,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(d);
const instante=(dia,hm)=>new Date(dia+"T"+hm+":00-03:00");
const somaDia=(dia,n)=>{const d=new Date(dia+"T12:00:00-03:00");d.setUTCDate(d.getUTCDate()+n);return spDia(d)};
const domingo=dia=>new Date(dia+"T12:00:00-03:00").getUTCDay()===0;
const rotulo=(dia,hm,agora)=>{const h=spDia(agora);if(dia===h)return hm;if(dia===somaDia(h,1))return "amanhã "+hm;if(dia===somaDia(h,-1))return "ontem "+hm;return dia.slice(8)+"/"+dia.slice(5,7)+" "+hm};
// ult = momento em que os dados foram efetivamente gravados (Drive). Devolve a última confirmada e a próxima pendente.
function agenda(ult,agora=new Date()){
  let u=null;
  if(ult&&!isNaN(ult)){let dia=spDia(ult),hm=spHM(ult);for(let n=0;n<8&&!u;n++){if(!domingo(dia)){const c=HORARIOS.filter(h=>h<=hm);if(c.length)u={dia,hm:c.at(-1)}}dia=somaDia(dia,-1);hm="99:99"}}
  let p;if(u){const i=HORARIOS.indexOf(u.hm);p=i<HORARIOS.length-1?{dia:u.dia,hm:HORARIOS[i+1]}:{dia:somaDia(u.dia,1),hm:HORARIOS[0]}}else p={dia:spDia(agora),hm:HORARIOS[0]};
  while(domingo(p.dia))p={dia:somaDia(p.dia,1),hm:HORARIOS[0]};
  const ms=instante(p.dia,p.hm).getTime(),t=agora.getTime();
  const estado=t<ms?"prevista":t<ms+20*60000?"processando":"atrasada";
  return {ultima:u&&{...u,label:rotulo(u.dia,u.hm,agora)},proxima:{...p,ms,label:rotulo(p.dia,p.hm,agora)},estado};
}
const ESTADO_TXT={prevista:"",processando:"processando",atrasada:"aguardando"};

window.GL_CORE={COLS,NAO_ATRIB,EMPRESA_PROPRIA,num,str,empOf,nameOf,toRecords,parseDT,metaUpdate,normRows,coletadoGet,nk,casar,escopo,veTudo,HORARIOS,agenda,ESTADO_TXT,spDia};
})();
