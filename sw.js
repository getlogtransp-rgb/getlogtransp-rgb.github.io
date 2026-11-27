// GETLOG: guarda o site no aparelho para abrir em milésimos. Arquivos com ?v= (versionados) e /assets/ saem do cache na hora;
// páginas tentam a rede por até 1,5 s e, se demorar, abrem a cópia guardada. Dados (/data/*) e Google Drive nunca passam por aqui.
const V='gl-v1';
self.addEventListener('install',e=>{self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{for(const k of await caches.keys())if(k!==V)await caches.delete(k);await self.clients.claim()})())});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==location.origin||u.pathname.startsWith('/data/')||u.pathname==='/sw.js')return;
const fixo=u.search.includes('v=')||u.pathname.startsWith('/assets/');
e.respondWith((async()=>{const c=await caches.open(V);const h=await c.match(r);
if(fixo&&h)return h;
const rede=fetch(r).then(x=>{if(x.ok&&x.type==='basic')c.put(r,x.clone());return x});
if(!h)return rede;
return Promise.race([rede.catch(()=>h),new Promise(ok=>setTimeout(()=>ok(h),1500))])})())});
