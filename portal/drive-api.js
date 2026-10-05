(()=>{
const URL_API='https://script.google.com/macros/s/AKfycbzBrdB2u8IlJJ0o9OclHWPcpA3JUi8n5D_ebIkZ6Kzagwt01zmvsaHU50PrA2C9MzCwdA/exec';
const TZ='America/Sao_Paulo';
const JANELAS={performance:[540,1440],geral:[0,600]};
const agora=()=>{const p=new Intl.DateTimeFormat('en-US',{timeZone:TZ,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());const g=t=>p.find(x=>x.type===t).value;return {dia:g('weekday'),min:+g('hour')*60+ +g('minute')}};
const naJanela=f=>{const a=agora();if(a.dia==='Sun')return false;const j=JANELAS[f];return a.min>=j[0]&&a.min<j[1]};
const get=async(q,force)=>{const r=await fetch(URL_API+'?'+q+(force?'&force=1':'')+'&_='+Date.now(),{credentials:'omit',cache:'no-store'});return r.json()};
let LISTA=null;
const lista=force=>{if(!LISTA||force)LISTA=get('fonte=lista',force).then(j=>{if(!j.ok)throw new Error(j.erro);return j.dados}).catch(e=>{LISTA=null;console.warn('lista',e);return []});return LISTA};
const dia=async(d,force)=>{const L=await lista(force);const it=L.find(x=>x.dia===d);if(!it)return null;const j=await get('fonte=performance&dia='+encodeURIComponent(d),force);if(!j.ok)return null;return {txt:JSON.stringify(j.dados.conteudo),lm:new Date(j.dados.modificadoEm),sig:it.modificadoEm}};
const geral=async force=>{const j=await get('fonte=geral',force);if(!j.ok)throw new Error(j.erro);return j};
window.GL_API={naJanela,lista,dia,geral,PASTA_COLETADOS:'https://drive.google.com/drive/folders/1ZiJ-SJaMvL_qJIiYQdLxZWVhR-2Aan_A',INTERVALO_MS:15*60*1000};
})();
