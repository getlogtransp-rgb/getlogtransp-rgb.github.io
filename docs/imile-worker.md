# Robô do IMILE (Cloudflare Worker)

Código: `docs/imile-worker.js`. O robô faz TODO o trabalho pesado: monta as listas (sellers com quantidade de pacotes e motoristas = base de Rotas + IMILE), executa as trocas de motorista por seller em etapas (conferindo pacote a pacote, com rodadas e varredura final), guarda o histórico do dia e faz a desatribuição de 21 dias (manual e automática às 23:00). A página (`portal/imile.js`) só pede a lista pronta, manda "trocar" e mostra o histórico.

## Criar / atualizar
Texto pronto para o agente (Claude Desktop / Chrome): `docs/TEXTO-ATUALIZAR-ROBO.txt` (já com o código inteiro). Resumo:
1. Worker `getlog-imile`: colar o código de `imile-worker.js` e publicar.
2. KV `SESSAO` ligado ao Worker (variável SESSAO). Segredos: `TOKEN`, `IMILE_TOKEN`, `IMILE_USERCODE`.
3. **Plano Workers Paid (US$ 5/mês) + variável de texto `PLANO_PAGO=1`.** No plano gratuito o limite de 10 ms de processamento por pedido não aguenta listas grandes do IMILE (a tela mostra "O robô do Cloudflare falhou").
4. Cron `* * * * *` (a cada minuto): continua trocas paradas, mantém a lista pronta e dispara a desatribuição às 23:00 de Brasília (02:00 UTC).
5. Portal > Usuários e acessos > Configurações do sistema > "Conectar a Troca de motorista ao IMILE": endereço do Worker + `TOKEN`.

## Ações (POST JSON com `t` = TOKEN)
`ping`, `lista` (listas prontas; o portal informa URL/token da Rotas uma vez), `trocar` {seller, motorista}, `hist` (histórico do dia), `chamar` (ponte para planilhas), `autoGet`/`autoSet`, `desatribuirAgora`.

## Dados no KV (somem em 2 dias)
`catalogo`, `rotas_cfg`, `rotas_nomes`, `h:AAAA-MM-DD:id` (linha do histórico), `j:id` (andamento da troca), `job`/`ultima`/`auto` (desatribuição).

## Pendências conhecidas
- Login automático do robô no IMILE (`entrar()`): ainda usa o segredo `IMILE_TOKEN`, que vence. Falta confirmar o login da conta do robô (SMS/captcha?).
- A busca de motoristas "GET" no IMILE devolve só uma parte (cerca de 50); por isso a lista junta a base de Rotas. O robô resolve o nome escolhido no IMILE na hora da troca.
