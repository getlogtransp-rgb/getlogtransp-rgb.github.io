(()=>{
const h=document.querySelector('.site-header');
const onScroll=()=>h&&h.classList.toggle('scrolled',scrollY>8);
addEventListener('scroll',onScroll,{passive:true});onScroll();
const t=document.querySelector('.menu-toggle'),m=document.getElementById('menu');
if(t&&m)t.addEventListener('click',()=>{const o=m.classList.toggle('open');t.setAttribute('aria-expanded',o)});
const WA='5511989141009';
document.querySelectorAll('form[data-wa]').forEach(f=>{
f.addEventListener('submit',e=>{
e.preventDefault();
if(!f.reportValidity())return;
const d=new FormData(f);const lines=[f.dataset.wa,''];
f.querySelectorAll('[name]').forEach(el=>{if(el.type==='checkbox'||el.closest('[hidden]'))return;const v=(d.get(el.name)||'').toString().trim();if(v){const lb=f.querySelector('label[for="'+el.id+'"]');lines.push((lb?lb.textContent:el.name)+': '+v)}});
open('https://wa.me/'+WA+'?text='+encodeURIComponent(lines.join('\n')),'_blank','noopener');
});
});
const tabs=document.querySelectorAll('[role=tab]');
tabs.forEach(b=>b.addEventListener('click',()=>{
tabs.forEach(x=>{const on=x===b;x.setAttribute('aria-selected',on);const p=document.getElementById(x.getAttribute('aria-controls'));if(p){p.hidden=!on;p.querySelectorAll('input,select,textarea').forEach(i=>i.disabled=!on)}});
}));
const fv=document.getElementById('funcao'),veh=document.getElementById('veiculo-wrap');
if(fv&&veh){const u=()=>{const on=fv.value==='Motorista';veh.hidden=!on;veh.querySelector('select').required=on};fv.addEventListener('change',u);u()}
const y=document.getElementById('ano');if(y)y.textContent=new Date().getFullYear();
})();
