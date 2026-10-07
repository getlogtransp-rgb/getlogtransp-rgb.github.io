// A Performance só abre com sessão válida do portal (do dia, sem troca de senha pendente) e para quem tem acesso.
// O recorte dos dados por pessoa é feito na camada de dados (drive-api.js), antes de qualquer tela.
(()=>{let s=null;try{s=JSON.parse(localStorage.getItem('getlog_sessao')||sessionStorage.getItem('getlog_sessao'))}catch(e){}
if(!s||!s.k||!(s.exp>Date.now())||s.troca||!['admin','colaborador','motorista'].includes(s.role)){try{(window.top||window).location.replace('/portal/')}catch(e){location.replace('/portal/')}window.GL_BLOQ=true}})();
// Dentro do portal: qualquer clique na Performance recolhe o menu lateral do portal.
addEventListener('pointerdown',()=>{try{parent!==window&&parent.GL_SIDE_HIDE&&parent.GL_SIDE_HIDE()}catch(e){}},true);
