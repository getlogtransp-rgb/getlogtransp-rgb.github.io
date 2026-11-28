# Robô do IMILE (Cloudflare Worker)

Código: `docs/imile-worker.js`. Ponte entre o portal e o IMILE; o portal guarda a regra de cada tela (`portal/imile.js`).

## Criar (uma vez)
1. Cloudflare › Workers & Pages › Create › Worker, nome `getlog-imile`; colar o código de `imile-worker.js` e publicar.
2. Workers › KV › criar namespace `SESSAO`; no Worker › Settings › Bindings › KV namespace, variável **SESSAO**.
3. Worker › Settings › Variables and Secrets (tipo Secret): `TOKEN` (texto longo qualquer, o mesmo vai no portal), `IMILE_TOKEN` (sessão do IMILE) e `IMILE_USERCODE` (código do usuário no IMILE).
4. Worker › Settings › Triggers › Cron: `* * * * *` (a cada minuto). O robô só trabalha quando há tarefa: às 02:00 UTC (= 23:00 de Brasília), se o automático estiver ligado no portal, ele desatribui em etapas de até 40 chamadas por minuto (2.500 pacotes levam cerca de 6 minutos).
5. Portal › Usuários e acessos › Configurações do sistema › "Conectar a Troca de motorista ao IMILE": colar o endereço `https://....workers.dev` e o `TOKEN`.

## Limites do plano gratuito (não são por dia)
- 100.000 pedidos por dia ao robô e 1.000 gravações por dia no KV: bem acima do uso real.
- O limite de 50 chamadas externas vale **por pedido**: o portal manda 1 chamada por pedido, então não atrapalha. Só a desatribuição automática roda dentro do robô, e ela já é dividida em etapas de até 40 chamadas.

## Pendências conhecidas
- Login automático do robô no IMILE (`entrar()` em imile-worker.js): ainda usa o segredo `IMILE_TOKEN`, que vence. Falta confirmar o login com a conta do robô (SMS/captcha?).
- Nome do seller: o portal procura o campo sozinho (consignor/seller/shipper/...). Se errar, a tela mostra os sellers e campos encontrados.
