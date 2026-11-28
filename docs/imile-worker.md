# Robô do IMILE (Cloudflare Worker)

Código: `docs/imile-worker.js`. O robô faz TODO o trabalho pesado: monta as listas (sellers com quantidade de pacotes e motoristas = base de Rotas + IMILE), executa as trocas de motorista por seller em etapas (conferindo pacote a pacote, com rodadas e varredura final), guarda o histórico do dia e faz a desatribuição de 21 dias (manual e automática às 23:00). A página (`portal/imile.js`) só pede a lista pronta, manda "trocar" e mostra o histórico.

## Criar / atualizar
Texto pronto para o agente (Claude Desktop / Chrome): `docs/TEXTO-ATUALIZAR-ROBO.txt` (já com o código inteiro). Resumo:
1. Worker `getlog-imile`: colar o código de `imile-worker.js` e publicar.
2. KV `SESSAO` ligado ao Worker (variável SESSAO). Segredos: `TOKEN`, `IMILE_TOKEN`, `IMILE_USERCODE`.
3. **Plano Workers Paid (US$ 5/mês) + variável de texto `PLANO_PAGO=1`.** No plano gratuito o limite de 10 ms de processamento por pedido não aguenta listas grandes do IMILE (a tela mostra "O robô do Cloudflare falhou").
4. Cron `* * * * *` (a cada minuto): continua trocas paradas, mantém a lista pronta e dispara a desatribuição às 23:00 de Brasília (02:00 UTC).
5. Portal > Usuários e acessos > Configurações do sistema > "Conectar a Troca de motorista ao IMILE": endereço do Worker + `TOKEN`.

## Velocidade
A lista de sellers/motoristas é montada em segundo plano (cron de 1 min + sob demanda): as páginas de pacotes são lidas 6 ao mesmo tempo (`ESCANEAR_PARALELO`, padrão 6) junto com a base de Rotas e a busca de motoristas. Com 30.700 pacotes (31 páginas) e 250 ms por chamada: 8,2 s → 1,6 s. Na 1ª montagem o robô grava o progresso real (`cat_prog`), que a tela mostra em barra com porcentagem e "faltam ~N s". O portal guarda a última lista (sessionStorage), abre na hora e atualiza em segundo plano; também a pré-carrega ao entrar no portal.

## Login automático do IMILE (variáveis do Worker)
Secrets `IMILE_USER` e `IMILE_PASS`; texto `IMILE_LOGIN_URL`, `IMILE_LOGIN_BODY` (modelo JSON com `{{USER}}`, `{{PASS}}`, `{{PASS_MD5}}`, `{{PASS_SHA256}}`, `{{PASS_B64}}`), `IMILE_TOKEN_PATH` (ex.: `resultObject.accessToken` ou `cookie:NOME`), opcionais `IMILE_LOGIN_HEADERS` e `IMILE_TOKEN_TTL_MIN` (padrão 360). O robô guarda o token no KV e entra de novo sozinho quando o IMILE devolve 401/403. Teste: ação `loginTeste` (nunca devolve o token). A senha nunca aparece em respostas nem no KV.

## Ações (POST JSON com `t` = TOKEN)
`ping`, `lista` (listas prontas; o portal informa URL/token da Rotas uma vez), `trocar` {seller, motorista}, `hist` (histórico do dia), `chamar` (ponte para planilhas), `autoGet`/`autoSet`, `desatribuirAgora`, `loginTeste`.

## Dados no KV (somem em 2 dias)
`catalogo`, `rotas_cfg`, `rotas_nomes`, `h:AAAA-MM-DD:id` (linha do histórico), `j:id` (andamento da troca), `job`/`ultima`/`auto` (desatribuição).

## Pendências conhecidas
- Login automático: falta descobrir o formato do login do IMILE (o agente do Chrome faz isso no texto `TEXTO-ATUALIZAR-ROBO`) e conferir se não há SMS/captcha.
- A busca de motoristas "GET" no IMILE devolve só uma parte (cerca de 50); por isso a lista junta a base de Rotas. O robô resolve o nome escolhido no IMILE na hora da troca.
