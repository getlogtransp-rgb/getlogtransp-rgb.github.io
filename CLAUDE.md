# GETLOG – site e portal (GitHub Pages)

Site estático publicado em https://getlogbr.com.br (GitHub Pages, branch `main`, arquivo `CNAME`).
Publicar = commit e push direto no `main` (o dono pediu). Responder em português, curto e direto: o dono não é técnico e quer economizar tokens.

## Estrutura
- Site institucional: `index.html`, `sobre/`, `servicos/`, `tecnologia/`, `contato/`, `trabalhe-conosco/`, `fornecedor/`, `cliente/`; estilos em `assets/site.css`.
- Portal: `portal/index.html` + `portal/portal.js` (tudo numa página, cada tela é `#hash`: dash, coletados, perf, forecast, ponto, pontoadm, avisos, usuarios, escalas). Estilo em `assets/portal.css`.
- Performance: `portal/performance.html` (aberto num iframe) + `portal/perf-guard.js`.
- Dados ao vivo: `portal/drive-api.js` chama um Apps Script (feito pelo dono) que lê o Google Drive.
- Ponto: grava numa planilha Google via Apps Script (`docs/ponto-apps-script.gs`); endereço + token ficam em `data/config.json` (criptografado).
- Ao mudar JS/CSS, aumentar o `?v=` nas tags `<script>`/`<link>` (e o `performance.html?v=` dentro de portal.js) para o navegador não usar cópia antiga.

## Login e dados
- `data/users.json`: usuários; cada um destranca uma chave mestra (AES-GCM, PBKDF2). Perfis, avisos, escalas e config são criptografados com essa chave — nunca editar à mão; o admin altera pelo portal (salva no GitHub com token próprio).
- Senha padrão `123456`; só o admin reseta (botão "Resetar senha"). Não há troca obrigatória. CPF foi removido de propósito.
- Tipos: admin, colaborador, ajudante, motorista, fornecedor (permissões em `ACC` no portal.js).

## Testar antes de publicar
`python3 -m http.server` na pasta + Playwright (Chromium já instalado). Validar sintaxe: `node -e "new Function(require('fs').readFileSync('portal/portal.js','utf8'))"`.

## Pendências conhecidas
- Formulário "Cadastrar acesso" (Usuários) com campos desalinhados (`.uform` em assets/portal.css).
- HTTPS do domínio: conferir "Enforce HTTPS" em Settings → Pages (sem cadeado o celular não libera a localização do ponto).
- Os dados de performance via Apps Script estão abertos para quem tiver o endereço (sem criptografia).
