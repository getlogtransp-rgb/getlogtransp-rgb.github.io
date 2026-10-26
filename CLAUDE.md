# GETLOG – site e portal (GitHub Pages)

Site estático publicado em https://getlogbr.com.br (GitHub Pages, branch `main`, arquivo `CNAME`).
Publicar = commit e push direto no `main` (o dono pediu). Responder em português, curto e direto: o dono não é técnico e quer economizar tokens.

## Estrutura
- Site institucional: `index.html`, `sobre/`, `servicos/`, `tecnologia/`, `contato/`, `trabalhe-conosco/`, `fornecedor/`, `cliente/`; estilos em `assets/site.css`.
- Portal: `portal/index.html` + `portal/portal.js` (tudo numa página, cada tela é `#hash`: dash, coletados, perf, forecast, ponto, pontoadm, avisos, usuarios, escalas). Estilo em `assets/portal.css`.
- Performance: `portal/performance.html` (aberto num iframe que rola por dentro) + `portal/perf-guard.js`.
- Regra única dos dados: `portal/core.js` (GL_CORE) — leitura/normalização das linhas (a mesma para Performance, Dashboard e Pacotes coletados), vínculo pessoa↔dados (`casar`: nome normalizado + 90% só sem ambiguidade), recorte por usuário (`escopo`) e agenda de atualizações (`agenda`: a próxima só avança quando o Drive confirma).
- Dados ao vivo: `portal/drive-api.js` chama um Apps Script (feito pelo dono, código fora do repo) que lê o Google Drive. Cache por dia + `modificadoEm`; o iframe reaproveita a instância do portal; checa a lista só nos horários da agenda.
- **Coletado GETLOG vem SEMPRE da base de coletados** (pasta do Drive "Coleta - dd.mm.aaaa.xlsx", 1 linha por pacote; regra do dono). O script do Drive resume (docs/coletados-apps-script.gs: fonte=lista_coletados / fonte=coletados) e o portal usa em Início, Pacotes coletados e Tempo de operação (`COLD`/`ingestCol` em portal.js). Nunca descartar pacote: a soma dos grupos tem de bater com o nº de linhas. HUB Nuvem Envio conta como GETLOG (não terceiro): `HUB_GET` em core.js. Sem a base para o dia, Coletado GETLOG = soma da coluna "COLETADO DS FM NOR" da Performance (`coletadoGet` em core.js; já inclui HUB).
- Ponto: planilha Google via Apps Script (`docs/ponto-apps-script.gs`, versão 2: credencial por usuário, bloqueio imediato, antiduplicidade, ajustes, correções do admin com auditoria). Endereço + token em `data/config.json` (criptografado). O portal funciona com o script antigo, mas ajustes/auditoria/bloqueio só com a versão 2 publicada.
- Ao mudar JS/CSS, aumentar o `?v=` nas tags `<script>`/`<link>` (e o `performance.html?v=` dentro de portal.js) para o navegador não usar cópia antiga.

## Login e dados
- `data/users.json`: usuários; cada um destranca uma chave mestra (AES-GCM, PBKDF2). Perfis, avisos, escalas e config são criptografados com essa chave — nunca editar à mão; o admin altera pelo portal (salva no GitHub com token próprio).
- Senha padrão `123456`; só o admin reseta (botão "Resetar senha"). Quem entra com `123456` é obrigado a trocar antes de abrir o portal. CPF foi removido de propósito.
- Sessão vale até 23:59 no aparelho (localStorage), mas cai na hora se o usuário for desativado/excluído, mudar de tipo ou tiver a senha resetada (confere users.json e o servidor do ponto a cada navegação/ação).
- `ah` em users.json = hash da credencial do servidor do ponto para a senha definida pelo admin (nunca a senha).
- Tipos: admin, colaborador, ajudante, motorista, fornecedor (permissões em `ACC` no portal.js).

## Segurança (não desfazer)
- Sessão: a chave mestra fica no localStorage CIFRADA com uma chave do aparelho não exportável (IndexedDB `getlog`). Sair apaga o IndexedDB.
- Cache dos dias da Performance: IndexedDB, comprimido e cifrado com a chave mestra, separado por login (`GL_IDB` em core.js).
- CSP + referrer + noindex em portal/index.html, performance.html e cliente; anti-clickjacking em assets/tema.js. Ao usar um domínio novo (fetch/img), incluir na CSP.
- Bibliotecas de terceiros hospedadas no próprio site (`assets/vendor/`: Leaflet, SheetJS). Não voltar a carregar de CDN.
- Script do Drive: o portal envia `&t=<token>` (CFG.driveToken, salvo criptografado). Passo a passo para o dono em `docs/drive-apps-script-token.md`.
- Copiar a chave mestra / salvar token pede a senha de novo (`confirmaSenha`).
- Clientes (tipo fornecedor) NÃO usam a chave mestra: `ck:1` em users.json = a senha destranca a CHAVE DOS CLIENTES (`CFG.clientKey`, guardada no config.json), que abre só o perfil do cliente e `data/config-cliente.json` (token do Drive). Senha de cliente é definida pelo admin (mín. 8, letras+números); cliente não troca sozinho. Fornecedor sem `ck` é bloqueado no /cliente até o admin redefinir a senha.

## Testar antes de publicar
`python3 -m http.server` na pasta + Playwright (Chromium já instalado). Validar sintaxe: `node -e "new Function(require('fs').readFileSync('portal/portal.js','utf8'))"`.

## Pendências conhecidas
- HTTPS do domínio: conferir "Enforce HTTPS" em Settings → Pages (sem cadeado o celular não libera a localização do ponto).
- Dados da Performance via Apps Script do Drive: abertos até o dono colar o token no script (docs/drive-apps-script-token.md). O recorte por motorista continua no navegador.
- Todos os usuários destrancam a mesma chave mestra: quem já teve acesso pode ter guardado a chave. Revogação real dos arquivos criptografados exigiria trocar a chave e recadastrar senhas.
- Depois de publicar o portal, colar a versão 2 de `docs/ponto-apps-script.gs` no Apps Script do ponto (mesmo TOKEN) e publicar nova versão.
- Portal do cliente: `cliente/` (cliente.js, cliente.css, i18n.js PT/中文). `cliente/imiledelivery/index.html` é CÓPIA de `cliente/index.html` (endereço da iMile): ao mudar o HTML ou o `?v=`, copiar de novo (`cp cliente/index.html cliente/imiledelivery/index.html`).
- Rotas: `portal/rotas.html` (iframe no portal) lê/grava via Apps Script do dono (Code.gs fora do repo). `docs/rotas-sincronizar.gs` é o complemento diário (acrescenta seller+cliente que faltam na aba GERAL, motorista só se começar com "GET"); o dono cola no projeto do Code.gs.
