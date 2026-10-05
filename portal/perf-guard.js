(()=>{
let s=null;try{s=JSON.parse(sessionStorage.getItem('getlog_sessao'))}catch(e){}
if(!s||!s.k||!['admin','colaborador','motorista'].includes(s.role)){location.replace('/portal/');return}
const b2u=b=>{const t=atob(b);const u=new Uint8Array(t.length);for(let i=0;i<t.length;i++)u[i]=t.charCodeAt(i);return u};
const key=crypto.subtle.importKey('raw',b2u(s.k),{name:'AES-GCM'},false,['decrypt']);
const ref=(s.ref||'').toUpperCase();
// Destranca um arquivo {v,z,iv,ct} gerado pela automação e devolve o JSON do dia em texto.
// Motorista só recebe as linhas em que ele é o oficial ou o atribuído.
window.GL_OPEN=async txt=>{const o=JSON.parse(txt);
let raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:b2u(o.iv)},await key,b2u(o.ct));
if(o.z==='gzip')raw=await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
const out=new TextDecoder().decode(raw);if(s.role!=='motorista')return out;
const d=JSON.parse(out);const f=v=>{const iM=v.colunas.indexOf('MOTORISTA OFICIAL'),iA=v.colunas.indexOf('MOTORISTA ATRIBUÍDO');return {...v,linhas:v.linhas.filter(r=>r[iM]===ref||r[iA]===ref)}};
if(Array.isArray(d.colunas))return JSON.stringify(f(d));
const o2={};for(const [k,v] of Object.entries(d))o2[k]=v&&Array.isArray(v.colunas)?f(v):v;return JSON.stringify(o2)};
})();
