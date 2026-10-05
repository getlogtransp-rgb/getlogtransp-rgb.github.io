// Tema claro/escuro do portal: uma escolha só para todas as telas (inclusive a Performance, no quadro), guardada no aparelho.
(()=>{const K='getlog_tema';let t='light';try{t=localStorage.getItem(K)==='dark'?'dark':'light'}catch(e){}
const H=document.documentElement;const ap=v=>{t=v==='dark'?'dark':'light';H.dataset.theme=t;H.style.colorScheme=t};ap(t);
const st=document.createElement('style');st.textContent='[data-tema] .t-sol,[data-theme=dark] [data-tema] .t-lua{display:none}[data-theme=dark] [data-tema] .t-sol{display:inline}[data-tema] svg{width:18px;height:18px}';document.head.appendChild(st);
window.GL_TEMA={btn:(cls)=>`<button type="button" class="${cls}" data-tema aria-label="Alternar tema claro ou escuro" title="Tema claro / escuro"><svg class="t-lua" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg><svg class="t-sol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></button>`};
document.addEventListener('click',e=>{if(!e.target.closest('[data-tema]'))return;ap(t==='dark'?'light':'dark');try{localStorage.setItem(K,t)}catch(e){}
try{for(const f of document.querySelectorAll('iframe'))f.contentWindow.document.documentElement.dataset.theme=t}catch(e){}});
addEventListener('storage',e=>{if(e.key===K)ap(e.newValue)});
})();
