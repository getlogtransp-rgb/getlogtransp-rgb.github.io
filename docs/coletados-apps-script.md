# Ligar a base de coletados ao portal

Faz o portal (Início, Pacotes coletados e Tempo de operação) contar **todos** os pacotes da pasta de coletados
("Coleta - dd.mm.aaaa.xlsx"), com o horário real de cada bip. Leva uns 5 minutos.

1. Abra o script do Drive que o portal usa (script.google.com → o projeto da Performance).
2. **Arquivo novo:** clique em **+** → **Script** → nome `coletados` → apague o que vier e cole todo o conteúdo de
   `docs/coletados-apps-script.gs`.
3. **Ativar o serviço do Drive:** na barra da esquerda, **Serviços (+)** → **Drive API** → **Adicionar**.
4. **Ligar no doGet:** no arquivo principal, logo na primeira linha dentro de `function doGet(e) {`
   (depois da linha do token, se já tiver colocado), cole:

```js
  var rc = rotaColetados_(e); if (rc) return rc;
```

5. **Implantar → Gerenciar implantações → lápis → Nova versão → Implantar.** Na primeira vez o Google pede
   autorização: aceite.
6. (Opcional, deixa mais rápido) **Acionadores (relógio)** → **Adicionar acionador** → função `aquecerColetados`,
   baseado em tempo, a cada 30 minutos.

Pronto. Abra o portal e recarregue: Pacotes coletados passa a mostrar os números da base de coletados.
Enquanto o script não for atualizado, o portal continua usando a Performance como antes (nada quebra).
