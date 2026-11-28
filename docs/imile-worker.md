# Robô do IMILE (Cloudflare Worker)

Código: `docs/imile-worker.js`. Ponte entre o portal e o IMILE; o portal guarda a regra de cada tela (`portal/imile.js`).

## Criar (uma vez)
1. Cloudflare › Workers & Pages › Create › Worker, nome `getlog-imile`; colar o código de `imile-worker.js` e publicar.
2. Workers › KV › criar namespace `SESSAO`; no Worker › Settings › Bindings › KV namespace, variável **SESSAO**.
3. Worker › Settings › Variables and Secrets (tipo Secret): `TOKEN` (texto longo qualquer, o mesmo vai no portal), `IMILE_TOKEN` (sessão do IMILE) e `IMILE_USERCODE` (código do usuário no IMILE).
4. Worker › Settings › Triggers › Cron: `0 2 * * *` (= 23:00 de Brasília) para a desatribuição automática.
5. Portal › Usuários e acessos › Configurações do sistema › "Conectar a Troca de motorista ao IMILE": colar o endereço `https://....workers.dev` e o `TOKEN`.

## Pendências conhecidas
- Login automático do robô no IMILE (`entrar()` em imile-worker.js): ainda usa o segredo `IMILE_TOKEN`, que vence. Falta confirmar o login com a conta do robô (SMS/captcha?).
- Plano gratuito do Cloudflare: 50 chamadas externas por requisição; a troca por seller e a desatribuição de milhares de pacotes cabem, mas lotes muito grandes podem precisar do plano pago.
- Nome do seller: o robô procura o campo sozinho (consignor/seller/shipper/...). Se errar, a tela mostra os sellers e campos encontrados.
