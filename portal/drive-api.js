// Camada de dados ao vivo (Apps Script que lê o Google Drive). Uma instância por aba: a Performance (iframe)
// reaproveita a do portal, então cada arquivo é baixado uma única vez e só de novo quando muda no Drive.
(()=>{
try{if(window.parent!==window&&window.parent.GL_API){window.GL_API=window.parent.GL_API;return}}catch(e){}
const URL_API='https://script.google.com/macros/s/AKfycbzBrdB2u8IlJJ0o9OclHWPcpA3JUi8n5D_ebIkZ6Kzagwt01zmvsaHU50PrA2C9MzCwdA/exec';
const C=()=>window.GL_CORE;
const sess=()=>{try{return JSON.parse(localStorage.getItem('getlog_sessao')||sessionStorage.getItem('getlog_sessao'))}catch(e){return null}};
const get=async(q,force)=>{const r=await fetch(URL_API+'?'+q+(force?'&force=1':''),{credentials:'omit',cache:'no-store'});if(!r.ok)throw new Error('http '+r.status);return r.json()};
let LISTA=null,LISTA_EM=0;
// Lista de dias publicados ({dia:'dd.mm.aaaa',modificadoEm}). Só é consultada de novo quando pedido (verificação/atualizar).
const lista=force=>{if(!LISTA||force){const p=get('fonte=lista',force).then(j=>{if(!j.ok)throw new Error(j.erro);LISTA_EM=Date.now();return j.dados});p.catch(()=>{if(LISTA===p)LISTA=null});LISTA=p}return LISTA.catch(e=>{console.warn('lista',e);return []})};
const CACHE=new Map();
// Conteúdo de um dia já recortado para o usuário (escopo aplicado antes de guardar em cache).
const dia=async d=>{const L=await lista();const it=L.find(x=>x.dia===d);if(!it)return null;const c=CACHE.get(d);if(c&&c.sig===it.modificadoEm)return c.p;
const p=get('fonte=performance&dia='+encodeURIComponent(d),!!c).then(j=>{if(!j.ok)return null;return {json:C().escopo(j.dados.conteudo,sess()),lm:new Date(j.dados.modificadoEm||it.modificadoEm),sig:it.modificadoEm}});
p.catch(()=>{if(CACHE.get(d)?.p===p)CACHE.delete(d)});CACHE.set(d,{sig:it.modificadoEm,p});return p};
// Executa tarefas com no máximo n requisições simultâneas.
const pool=async(items,n,fn)=>{const out=new Array(items.length);let i=0;await Promise.all(Array.from({length:Math.min(n,items.length)},async()=>{while(i<items.length){const k=i++;try{out[k]=await fn(items[k])}catch(e){out[k]=null}}}));return out};
const ordem=L=>[...L].filter(x=>/^\d{2}\.\d{2}\.\d{4}$/.test(x.dia)).sort((a,b)=>a.dia.split('.').reverse().join('')<b.dia.split('.').reverse().join('')?1:-1);
let GERAL=null;
const geral=async(force,novo)=>{if(!GERAL||force||novo){const p=get('fonte=geral',force).then(j=>{if(!j.ok)throw new Error(j.erro);return {...j,dados:C().escopo(j.dados,sess())}});p.catch(()=>{if(GERAL===p)GERAL=null});GERAL=p}return GERAL};
// ---- Verificação de novas atualizações guiada pela agenda (sem F5) ----
const SUBS=new Set();let ULT=null,TMR=0,ERRO=false,VERIF=null;
const ultimaMod=L=>{let m=0;for(const x of L){const t=new Date(x.modificadoEm).getTime();if(t>m)m=t}return m?new Date(m):null};
const estado=()=>({...C().agenda(ULT),erro:ERRO});
const avisar=mud=>{const e=estado();for(const f of [...SUBS])try{f(e,mud)}catch(x){SUBS.delete(f)}};
// Consulta só a lista (leve). Se algum arquivo mudou, avisa quem estiver na tela com os dias alterados.
const verificar=()=>VERIF||(VERIF=(async()=>{const antes=new Map(((await LISTA?.catch(()=>[]))||[]).map(x=>[x.dia,x.modificadoEm]));let L;
try{const p=get('fonte=lista',true).then(j=>{if(!j.ok)throw new Error(j.erro);return j.dados});L=await p;LISTA=p;LISTA_EM=Date.now();ERRO=false}catch(e){ERRO=true;console.warn('verificação',e);avisar([]);return []}
const mud=L.filter(x=>antes.get(x.dia)!==x.modificadoEm).map(x=>x.dia);ULT=ultimaMod(L);avisar(antes.size?mud:L.map(x=>x.dia));return mud})().finally(()=>{VERIF=null;programar()}));
// Dorme até o próximo horário previsto; a partir dele confere a cada 2 min até a atualização entrar.
function programar(){clearTimeout(TMR);if(!SUBS.size||document.hidden)return;const a=C().agenda(ULT);const falta=a.proxima.ms-Date.now();
TMR=setTimeout(verificar,falta>0?Math.min(falta+60000,6*3600000):(a.estado==='atrasada'?5:2)*60000)}
const assinar=f=>{SUBS.add(f);if(LISTA)LISTA.then(L=>{if(!ULT){ULT=ultimaMod(L)}try{f(estado(),[])}catch(e){}});else lista().then(L=>{ULT=ultimaMod(L);avisar([])});programar();return ()=>{SUBS.delete(f);if(!SUBS.size)clearTimeout(TMR)}};
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(TMR);return}if(!SUBS.size)return;const a=C().agenda(ULT);if(a.estado!=='prevista'||Date.now()-LISTA_EM>15*60000)verificar();else programar()});
window.GL_API={lista,dia,geral,pool,ordem,verificar,assinar,estado,PASTA_COLETADOS:'https://drive.google.com/drive/folders/1ZiJ-SJaMvL_qJIiYQdLxZWVhR-2Aan_A'};
})();
