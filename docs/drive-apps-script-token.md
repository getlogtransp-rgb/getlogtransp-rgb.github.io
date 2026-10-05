# Proteger os dados da Performance (script do Drive)

Hoje o script do Google que lê o Drive entrega os dados para qualquer pessoa que tenha o endereço.
Com o token, ele só entrega para quem entrou no portal (o token fica guardado criptografado no site
e só é aberto depois do login).

## Passo a passo (nesta ordem)

1. No portal, entre como admin → **Usuários e acessos** → **Configurações do sistema** →
   **Proteger os dados da Performance** → clique em **Gerar token**, copie o token e clique em **Salvar**.
   (Até o passo 3, o script antigo ignora o token e tudo continua funcionando.)
2. Abra o script do Drive (script.google.com) e cole no **topo** do arquivo:

```js
var TOKEN_PORTAL = 'COLE_O_TOKEN_AQUI';
function negado_() {
  return ContentService.createTextOutput(JSON.stringify({ ok: false, erro: 'acesso negado' }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. Logo na **primeira linha dentro de `function doGet(e) {`**, cole:

```js
  if (!e || !e.parameter || e.parameter.t !== TOKEN_PORTAL) return negado_();
```

4. **Implantar → Gerenciar implantações → editar (lápis) → Nova versão → Implantar.**
   O endereço continua o mesmo.

Pronto: abrir o endereço do script direto no navegador passa a responder "acesso negado".

Para trocar o token (ex.: alguém saiu da empresa): gere outro no portal, salve, troque no script e publique nova versão.
