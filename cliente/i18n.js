// Idioma do portal do cliente: português (padrão) ou mandarim simplificado (termos de logística).
// Traduz o texto da tela depois de desenhado (inclusive o que muda ao filtrar). Escolha guardada no aparelho.
(()=>{
const K='getlog_lang';let L='pt';try{L=localStorage.getItem(K)==='zh'?'zh':'pt'}catch(e){}
const FL={pt:'<svg viewBox="0 0 28 20" width="22" height="16" aria-hidden="true"><rect width="28" height="20" rx="3" fill="#009c3b"/><path d="M14 3 25 10 14 17 3 10z" fill="#ffdf00"/><circle cx="14" cy="10" r="4.2" fill="#002776"/></svg>',
zh:'<svg viewBox="0 0 28 20" width="22" height="16" aria-hidden="true"><rect width="28" height="20" rx="3" fill="#de2910"/><path d="m6 3.2.9 2.6h2.7l-2.2 1.6.8 2.6L6 8.4 3.8 10l.8-2.6-2.2-1.6h2.7z" fill="#ffde00"/><circle cx="11" cy="3.5" r=".8" fill="#ffde00"/><circle cx="12.6" cy="5.6" r=".8" fill="#ffde00"/><circle cx="12.6" cy="8.2" r=".8" fill="#ffde00"/><circle cx="11" cy="10.2" r=".8" fill="#ffde00"/></svg>'};
window.GL_LANG={lang:L,btn:cls=>`<div class="lang ${cls||''}" role="group" aria-label="Idioma / 语言"><button type="button" data-lang="pt"${L==='pt'?' class="on"':''} title="Português">${FL.pt}<span>PT</span></button><button type="button" data-lang="zh"${L==='zh'?' class="on"':''} title="简体中文">${FL.zh}<span>中文</span></button></div>`};
document.addEventListener('click',e=>{const b=e.target.closest('[data-lang]');if(!b)return;const v=b.dataset.lang;if(v===L)return;try{localStorage.setItem(K,v)}catch(x){}location.reload()});
document.documentElement.lang=L==='zh'?'zh-CN':'pt-BR';
if(L!=='zh')return;
const D={
'Acompanhamento de coletas':'揽收跟踪','Área exclusiva para clientes GETLOG.':'GETLOG 客户专属区域','Usuário':'用户名','Senha':'密码','Entrar':'登录','Verificando...':'验证中…',
'Usuário ou senha incorretos.':'用户名或密码错误。','Mostrar senha':'显示密码','Ocultar senha':'隐藏密码','Crie sua senha':'设置新密码','Nova senha':'新密码','Repita a nova senha':'再次输入新密码','Salvar senha':'保存密码','Salvando...':'保存中…',
'Primeiro acesso (ou senha redefinida). Crie uma senha pessoal para continuar.':'首次登录（或密码已重置），请设置个人密码后继续。','As duas senhas não são iguais.':'两次输入的密码不一致。',
'Fale conosco':'联系我们','Sair':'退出','Atualizar':'刷新','Como usar':'使用说明','Conectando ao Drive...':'正在连接数据…',
'Período':'时间范围','Hoje':'今天','Hoje e ontem':'今天和昨天','Esta semana':'本周','Semana passada':'上周','Últimos 7 dias':'近 7 天','Últimos 15 dias':'近 15 天','Últimos 30 dias':'近 30 天','Este mês':'本月','Mês passado':'上月','Últimas 8 semanas':'近 8 周','Personalizado':'自定义',
'Cancelar':'取消','Aplicar':'确定','Escolha o início':'请选择开始日期','Sem dias com dados':'无数据日期',
'Só T4 e T5':'仅看 T4 和 T5','Buscar seller, motorista, bairro…':'搜索商家、司机、街区…',
'Cliente':'客户','Região':'区域','Motorista':'司机','Prioridade':'优先级','Status do seller':'商家状态','Visita':'拜访','Todos':'全部','Carregando…':'加载中…',
'Marcar visíveis':'全选','Limpar':'清除','Nada encontrado.':'未找到。','Visitado':'已拜访','Não visitado':'未拜访','Limpar tudo':'全部清除',
'Sem região':'无区域','Sem motorista':'无司机','Sem prioridade':'无优先级','Sem status':'无状态','Sem cliente':'无客户',
'Previsto':'预计','pacotes':'件','Coletado do previsto':'预计已揽收','Sellers visitados':'已拜访商家','Sellers não visitados':'未拜访商家','clique para ver a lista':'点击查看明细','Coleta':'揽收','Clique para filtrar':'点击筛选',
'Foco: sellers T4 e T5':'重点：T4 和 T5 商家','Acompanhamento em destaque dos sellers de maior prioridade':'高优先级商家重点跟踪','Ver só T4 e T5':'仅看 T4 和 T5','Ver todos':'查看全部',
'Pacotes coletados':'已揽收件数','Conexão segura':'安全连接','HTTPS · TLS':'HTTPS · TLS 加密','Dados criptografados':'数据加密','AES-256 no aparelho':'设备端 AES-256 加密','Acesso restrito':'访问受限','Login individual e sessão com tempo':'独立账号，会话自动超时','LGPD':'LGPD 数据保护','Só os dados da sua operação':'仅显示您的业务数据','Transporte e logística de primeira milha. Acompanhamento de coletas em tempo real para nossos clientes.':'头程运输与物流服务。为客户提供实时揽收跟踪。','Suporte ao cliente':'客户支持','Limpar filtros':'清除筛选','% coleta (referência)':'揽收率（参考）','% de visita por semana (últimas 8, segunda a domingo) · coleta em cinza como referência':'每周拜访率（近 8 周，周一至周日）· 灰色为揽收率参考','% de visita por dia da operação inteira (não segue os filtros) · coleta em cinza como referência':'全部作业每日拜访率（不受筛选影响）· 灰色为揽收率参考','visita':'拜访率','Coleta (pacotes)':'揽收率（件）','Muitas tentativas. Login bloqueado por alguns minutos.':'尝试次数过多，登录已暂时锁定。','Não visitados':'未拜访','Justificados':'已登记原因','visitados sem coleta':'已拜访未揽收','Sem coleta':'未揽收','coleta':'揽收率','sellers':'商家','Todos os sellers T4 e T5 foram visitados. ✔':'所有 T4 和 T5 商家均已拜访 ✔',
'Performance por semana':'每周绩效','Últimas 8 semanas (segunda a domingo) · respeita os filtros, não o período':'近 8 周（周一至周日）· 受筛选条件影响，不受时间范围影响',
'Performance por dia':'每日绩效','% coletado e % de visita da operação inteira (não segue os filtros) · passe o mouse para ver os números':'全部作业的揽收率和拜访率（不受筛选影响）· 鼠标悬停查看数据',
'Coletas por hora':'每小时揽收','Barras: pacotes coletados na hora (número embaixo) · linha: % acumulado do previsto':'柱形：每小时揽收件数（数字在下方）· 折线：累计完成率',
'Performance por região':'区域绩效','% de visita (sellers) · coleta em segundo plano · clique para filtrar':'拜访率（按商家）· 揽收率为辅 · 点击可筛选',
'Mapa da operação':'作业地图','Sem endereço nos dados do período.':'该时段数据中无地址。','Sellers':'商家明细','Baixar Excel (.xlsx)':'下载 Excel (.xlsx)','Gerando…':'生成中…',
'Data':'日期','Seller':'商家','Bairro':'街区','Prior.':'优先级','Coletado':'已揽收','Hora':'时间','Status':'状态',
'Parcial':'部分揽收','Justificado':'已登记原因','Em rota':'揽收中','Coleta extra':'额外揽收','Nenhuma coleta encontrada.':'未找到揽收记录。',
'% coleta':'揽收率','% visita':'拜访率','% coletado':'揽收率','Pacotes coletados na hora':'每小时揽收件数','% acumulado do previsto':'累计完成率',
'Sem dados no período.':'该时段无数据。','Sem dados.':'无数据。','Sem horários de coleta no período.':'该时段无揽收时间记录。','Carregando dados…':'数据加载中…',
'Sua internet parece lenta. Ainda carregando os dados…':'网络较慢，数据仍在加载…','Tentar de novo':'重试','tente de novo':'重试','Sem conexão com o Drive':'无法连接数据源','Nenhum dia publicado':'暂无已发布数据',
'Próximo':'下一步','Pular':'跳过','Começar':'开始','Filtros':'筛选','Indicadores':'指标','Foco T4 e T5':'T4 和 T5 重点','Gráficos':'图表','Excel':'Excel',
'Escolha o dia ou o intervalo: hoje, semana, mês ou datas no calendário.':'选择日期或时间段：今天、本周、本月，或在日历中选择。',
'Um clique mostra só os sellers T4 e T5 em toda a tela.':'一键只显示 T4 和 T5 商家。','Região, motorista, status, visita… Cada menu tem pesquisa e aceita vários itens.':'区域、司机、状态、拜访…每个菜单都可搜索并多选。',
'% de coleta e de visita. Clique nos cartões para filtrar a lista.':'揽收率和拜访率。点击卡片可筛选明细。','Resultado de cada grupo. Clique no cartão para ver só ele.':'T4/T5 商家汇总结果，点击卡片只看该组。',
'Passe o mouse (ou toque) nas colunas para ver todos os números.':'鼠标悬停（或点击）柱形查看全部数据。','Baixa a lista filtrada em planilha.':'将筛选后的明细下载为表格。','Fala direto com a GETLOG no WhatsApp.':'通过 WhatsApp 直接联系 GETLOG。',
'Buscar os dados mais recentes do Drive':'获取最新数据','Clique para ver só T4 e T5':'点击只看 T4 和 T5','Alternar tema claro ou escuro':'切换浅色/深色模式','Tema claro / escuro':'浅色/深色模式'};
const MES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const R=[
[/^Última atualização: (.+) às (.+)$/,'最后更新：$1 $2'],[/^(.+) · (\d+) dias$/,'$1 · $2 天'],[/^(.+) · 1 dia$/,'$1 · 1 天'],
[/^(.+) de (.+) pac\.$/,'$1 / $2 件'],[/^(.+) de (.+) pacotes$/,'$1 / $2 件'],[/^(.+) de (.+) sellers$/,'$1 / $2 商家'],[/^de (.+)$/,'共 $1'],
[/^([\d.]+) registros$/,'共 $1 条记录'],[/^(\d+) selecionados$/,'已选 $1 项'],[/^Mostrar mais \((.+) restantes\)$/,'显示更多（剩余 $1）'],
[/^Pico (\d+)h · (.+) pac\.$/,'峰值 $1 时 · $2 件'],[/^(\d{1,2})h$/,'$1时'],[/^sellers coletados · total (.+) pac\.$/,'个商家已揽收 · 共揽收 $1 件'],[/^ sellers$/,' 商家'],
[/^visita · (.+) de (.+) sellers · coleta $/,'拜访 · $1 / $2 商家 · 揽收 '],[/^ \((.+) de (.+) pac\.\)$/,'（$1 / $2 件）'],
[/^Bairros atendidos \((\d+)\); tamanho = volume, cor = performance de coleta$/,'服务街区（$1 个）；大小 = 件量，颜色 = 揽收绩效'],
[/^(\d+) de (\d+)$/,'$1 / $2'],[/^Pesquisar (.+)…$/,'搜索…'],
[/^(Cliente|Região|Motorista|Prioridade|Status do seller|Visita|Situação da coleta|Busca): (.+) ✕$/,(m,a,b)=>({'Cliente':'客户','Região':'区域','Motorista':'司机','Prioridade':'优先级','Status do seller':'商家状态','Visita':'拜访','Situação da coleta':'揽收情况','Busca':'搜索'}[a])+'：'+(D[b]||b)+' ✕'],
[/^(\S+) sellers T4\/T5 ainda não visitados \(sem coleta e sem justificativa\):$/,'$1 个 T4/T5 商家尚未拜访（无揽收且无原因登记）：'],[/^sellers T4\/T5 ainda não visitados \(sem coleta e sem justificativa\):$/,'个 T4/T5 商家尚未拜访（无揽收且无原因登记）：'],
[/^Nenhum seller T4 ou T5 encontrado no período e filtros escolhidos\.$/,'当前时段和筛选条件下没有 T4 或 T5 商家。'],
[/^(\d+) de (\d+)$/,'$1 / $2'],[/^([a-zç]+) de (\d{4})$/i,(m,a,b)=>{const i=MES.indexOf(a.toLowerCase());return i<0?m:b+'年'+(i+1)+'月'}],
[/^(.+) – (.+)$/,'$1 – $2'],[/^ · escolha o fim$/,' · 请选择结束日期'],
[/^(.+) pac\.$/,'$1 件'],[/^(.+) pacotes$/,'$1 件'],[/^(.+) sellers$/,'$1 商家'],
[/^Alguns dias não carregaram \((\d+)\)\. Tente atualizar\.$/,'有 $1 天数据未加载，请刷新。'],
[/^A conexão está muito lenta\. Aguarde ou $/,'网络非常慢，请稍候或'],[/^Não foi possível carregar: internet lenta ou instável\. $/,'无法加载：网络较慢或不稳定。'],[/^Você está sem internet\. $/,'当前无网络。'],
[/^Coletas (.+)$/,'$1 揽收看板'],[/^Próxima: (.+?)( · processando| · aguardando)?$/,(m,a,b)=>'下次更新：'+a.replace('amanhã','明天').replace('ontem','昨天')+(b?(b.includes('processando')?' · 处理中':' · 等待中'):'')],[/^© (\d{4}) GETLOG Transportes · Todos os direitos reservados$/,'© $1 GETLOG Transportes · 版权所有'],[/^Muitas tentativas\. Tente de novo em (\d+) min\.$/,'尝试次数过多，请 $1 分钟后再试。'],[/^Semana$/,'周']];
// Dica dos gráficos (várias linhas).
const RT=[[/^Previsto: (.+) pacotes$/,'预计：$1 件'],[/^Coletado: (.+) pacotes$/,'已揽收：$1 件'],[/^Coleta: (.+)$/,'揽收率：$1'],[/^Visita: (.+)$/,'拜访率：$1'],
[/^Sellers: (.+) · visitados (.+) \((.+)\)$/,'商家：$1 · 已拜访 $2（$3）'],[/^Semana (.+) a (.+)$/,'周 $1 至 $2'],[/^vs\. semana anterior: (.) (.+) p\.p\.$/,'较上周：$1 $2 个百分点'],
[/^(\d+)h às (\d+)h59$/,'$1:00–$2:59'],[/^Coletados na hora: (.+) pacotes$/,'本小时揽收：$1 件'],[/^Sellers com coleta: (.+)$/,'有揽收的商家：$1'],[/^Acumulado: (.+) do previsto$/,'累计：完成预计的 $1'],
[/^(.+) de (.+) pacotes$/,'$1 / $2 件'],[/^(.+) de (.+) sellers$/,'$1 / $2 商家']];
const tr=t=>{const a=t.match(/^(\s*)([\s\S]*?)(\s*)$/),x=a[2];if(!x)return t;if(D[x])return a[1]+D[x]+a[3];for(const [re,to] of R)if(re.test(x))return a[1]+x.replace(re,to)+a[3];return t};
const trT=t=>t.split('\n').map(l=>{for(const [re,to] of RT)if(re.test(l))return l.replace(re,to);return D[l]||tr(l)}).join('\n');
const ATT=['placeholder','title','aria-label'];
const no=n=>{if(n.nodeType===3){const p=n.parentNode;if(!p||/^(SCRIPT|STYLE)$/.test(p.nodeName))return;const v=tr(n.nodeValue);if(v!==n.nodeValue)n.nodeValue=v;return}
if(n.nodeType!==1)return;for(const a of ATT)if(n.hasAttribute(a)){const v=n.getAttribute(a),w=tr(v);if(w!==v)n.setAttribute(a,w)}
if(n.hasAttribute('data-t')){const v=n.getAttribute('data-t'),w=trT(v);if(w!==v)n.setAttribute('data-t',w)}
for(const c of n.childNodes)no(c)};
let ocup=false;const mo=new MutationObserver(ms=>{if(ocup)return;ocup=true;try{for(const m of ms){if(m.type==='characterData')no(m.target);else if(m.type==='attributes')no(m.target);else m.addedNodes.forEach(no)}}finally{ocup=false;mo.takeRecords()}});
const ini=()=>{no(document.body);mo.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label','data-t']});document.title='GETLOG · 揽收跟踪'};
// Tooltip interna (mostrada com textContent) também passa pela tradução.
window.GL_TR=trT;
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',ini):ini();
})();
