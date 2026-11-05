# AI Browser Agent

Extensão de Chrome + servidor MCP local que deixam o **Claude Code** e o **Codex** (ou
qualquer cliente MCP por stdio) controlarem o seu Chrome de verdade, com as suas contas
logadas, sem Playwright.

```
Claude Code / Codex ──MCP (stdio)──► servidor local (Node) ──WebSocket 127.0.0.1──► extensão ──► páginas
```

## Aviso de segurança

- A IA age na sua sessão real: e-mail, banco, redes sociais, tudo em que você está logado.
- A extensão começa **desligada**. Ligue pelo popup só quando for usar, e desligue depois.
  Desligada, ela recusa todos os comandos.
- Coloque na **lista de domínios bloqueados** (Opções) os sites em que a IA nunca deve
  mexer, como o do seu banco. Vale para o domínio e todos os subdomínios.
- Enquanto a IA clica ou digita, o Chrome mostra uma faixa avisando que a extensão está
  depurando o navegador. É esperado: as ações usam `chrome.debugger` para virar entrada real
  de mouse e teclado. A exceção é a escolha de opção em `<select>`, feita por script (o
  evento `change` não tem `isTrusted`).
- Só a extensão com o ID fixo deste projeto e com o token de pareamento consegue se conectar
  ao servidor. Páginas web não conseguem.
- O `read_page` nunca devolve o conteúdo de campos de senha: um campo preenchido aparece
  como `••••`.
- Só os diálogos JavaScript abertos por uma ação da IA são tratados: `alert` recebe OK,
  "sair da página" é aceito quando a IA pediu para navegar, e `confirm` e `prompt` recebem
  Cancelar, para a IA nunca concordar com nada em seu nome. O resultado da ação informa
  quais diálogos apareceram. Os diálogos que você mesmo abrir não são tocados.
- O plugin traz a skill `browser`, que manda a IA pedir sua confirmação antes de comprar,
  enviar, publicar, apagar ou mudar configurações de conta, e tratar o texto das páginas
  como dados, não como instruções.

## Requisitos

- Node.js no `PATH`, porque o plugin roda o servidor com `node` (testado com Node 24)
- Google Chrome 116 ou mais novo
- Claude Code ou Codex CLI com suporte a plugins (testado com Claude Code 2.1.318 e Codex
  CLI 0.166.0)

## Instalar no Claude Code

No Claude Code:

```
/plugin marketplace add luizgdemarchi/ai-browser-agent
/plugin install ai-browser-agent@ai-browser-agent
```

Ou, num passo só, pelo terminal:

```sh
claude plugin install ai-browser-agent --marketplace luizgdemarchi/ai-browser-agent
```

O plugin registra o servidor MCP `ai-browser` e a skill `browser`. Não precisa de
`npm install`.

## Instalar no Codex

No terminal:

```sh
codex plugin marketplace add luizgdemarchi/ai-browser-agent
codex plugin add ai-browser-agent@ai-browser-agent
```

Abra uma sessão nova do Codex depois de instalar.

Os dois podem rodar ao mesmo tempo: o primeiro servidor fica com a porta e o segundo
repassa os comandos para ele. Se o primeiro fechar, o segundo assume.

## Instalar a extensão do Chrome

1. Baixe `ai-browser-agent-extension-vX.Y.Z.zip` do
   [Release mais recente](https://github.com/luizgdemarchi/ai-browser-agent/releases/latest)
   e descompacte numa pasta que você não vai apagar.
2. Abra `chrome://extensions`, ligue o **Modo do desenvolvedor**, clique em **Carregar sem
   compactação** e escolha essa pasta.

O ID da extensão é sempre `cjnpnhbdjkkhlkncmmknhdgcgkocdfea`, em qualquer máquina.

## Parear

1. Abra o Claude Code ou o Codex uma vez com o plugin instalado. O servidor cria o token em
   `~/.ai-browser-agent/token` (no Windows, `%USERPROFILE%\.ai-browser-agent\token`).
2. Clique com o botão direito no ícone da extensão → **Opções**. Cole o token e clique em
   **Salvar token**.
3. Abra o popup e clique na chave para **ligar**. O ícone mostra:
   - nada: desligada;
   - `ON` em âmbar: ligada e conectada;
   - `!` em vermelho: ligada, mas sem servidor (abra o Claude Code ou o Codex).

Se você pedir algo no navegador antes de parear, a skill `browser` conduz esses passos.

## Outros agentes

Agentes compatíveis com o formato [Agent Skills](https://agentskills.io) podem instalar só a
skill com `npx skills add luizgdemarchi/ai-browser-agent`. As ferramentas precisam do
servidor MCP, registrado à mão como em [Instalação manual](#instalação-manual-sem-plugin).

## Porta

A porta padrão é `8765`. Para mudar, defina `AI_BROWSER_PORT` no ambiente do servidor e
coloque o mesmo número em Opções → Porta. Exemplo na instalação manual do Codex:

```toml
[mcp_servers.ai-browser]
command = "node"
args = ["C:/caminho/absoluto/ai-browser-agent/plugin/server.mjs"]
env = { AI_BROWSER_PORT = "9876" }
```

`AI_BROWSER_HOME` muda a pasta do token (padrão `~/.ai-browser-agent`).

## Ferramentas

| Ferramenta | O que faz |
|---|---|
| `read_page` | URL, título, texto visível e lista numerada dos elementos interativos |
| `click` | clica no elemento pelo número |
| `type` | digita num campo (`clear` padrão `true`, `submit` aperta Enter) |
| `fill_form` | preenche vários campos de uma vez (texto, select, checkbox, radio) |
| `navigate` | abre URL http(s) ou `back` / `forward` / `reload`, espera carregar (até 30 s) |
| `list_tabs` | lista as abas (id, título, URL, ativa, janela) |
| `switch_tab` | ativa uma aba |
| `new_tab` | abre aba nova, opcionalmente numa URL |
| `close_tab` | fecha uma aba |
| `screenshot` | PNG da área visível da aba |

Sem `tabId`, as ferramentas usam a aba ativa da janela em foco. Os números de `read_page`
valem até a próxima leitura ou navegação daquela aba. `navigate` e `new_tab` aceitam só
`http`, `https` e `about:blank`; URLs sem esquema (`google.com`) ganham `https://`. O
`screenshot` de uma aba em segundo plano ativa essa aba antes de capturar,
porque aba oculta não é desenhada.

## Códigos de erro

| Código | Significado | O que fazer |
|---|---|---|
| `[NOT_CONNECTED]` | extensão não conectada | abra o Chrome, confira o pareamento |
| `[EXTENSION_OFF]` | extensão desligada | ligue no popup |
| `[DOMAIN_BLOCKED]` | site na lista de bloqueio | a IA não deve usar esse site |
| `[ELEMENT_NOT_FOUND]` | número de elemento velho | chame `read_page` de novo |
| `[TAB_NOT_FOUND]` | aba não existe | chame `list_tabs` |
| `[TIMEOUT]` | passou do tempo limite | tente de novo |
| `[UNSUPPORTED_PAGE]` | página onde o Chrome não deixa extensões agirem | use outra página |

## Solução de problemas

- **Popup diz "Servidor não encontrado"**: o servidor só roda enquanto o Claude Code ou o
  Codex estiver aberto. Confira também se a porta em Opções é a mesma do servidor.
- **"Token recusado"**: o token mudou (por exemplo, você apagou `~/.ai-browser-agent`).
  Copie o novo de lá e salve em Opções.
- **Erro "refused this server's token. Make both use the same AI_BROWSER_HOME"**: o Claude
  Code e o Codex estão usando pastas de token diferentes. Deixe `AI_BROWSER_HOME` igual nos
  dois, ou sem definir em nenhum.
- **As ferramentas não aparecem depois de instalar o plugin**: confira se `node --version`
  funciona no terminal e abra uma sessão nova do agente.
- **Não lê páginas `chrome://` nem a Chrome Web Store**: o Chrome bloqueia extensões nelas.
- **Iframes de outro site e shadow DOM fechado** não aparecem no `read_page` nesta versão.

## Instalação manual (sem plugin)

Clone o repositório e compile:

```sh
npm install
npm run build
```

A extensão compilada fica em `dist/extension`; carregue essa pasta no Chrome como na seção
da extensão. Registre o servidor (`plugin/server.mjs` já vem pronto no repositório):

- Claude Code:

  ```sh
  claude mcp add ai-browser -- node "C:/caminho/absoluto/ai-browser-agent/plugin/server.mjs"
  ```

  Use `--scope user` para valer em todos os projetos.

- Codex, em `~/.codex/config.toml` (no Windows, `%USERPROFILE%\.codex\config.toml`):

  ```toml
  [mcp_servers.ai-browser]
  command = "node"
  args = ["C:/caminho/absoluto/ai-browser-agent/plugin/server.mjs"]
  ```

## Desenvolvimento

```sh
npm test       # testes de unidade
npm run build  # gera dist/ e plugin/server.mjs, e checa tipos
npm run e2e    # teste ponta a ponta com Chrome for Testing
```

O e2e precisa do Chrome for Testing: `npx puppeteer browsers install chrome`. Ele usa a
porta `18765` e uma pasta temporária, sem tocar no seu token nem na porta `8765`.

Depois de mexer em `src/server` ou `src/shared`, rode `npm run build` e commite o
`plugin/server.mjs` gerado: o `npm test` falha se ele estiver desatualizado.

## Publicar uma versão

1. Troque a versão em `src/shared/version.ts`, `package.json`,
   `src/extension/manifest.json`, `.claude-plugin/plugin.json` e `.codex-plugin/plugin.json`.
   O `npm test` aponta os que ficarem diferentes de `src/shared/version.ts`.
2. `npm run build`, `npm test` e commit.
3. `git tag vX.Y.Z` e `git push origin vX.Y.Z`. O workflow `release` roda os testes,
   empacota a extensão e publica o Release com o `.zip`.

Os hosts guardam o plugin em cache pela versão: conteúdo novo com a mesma versão não chega
a quem já instalou.

## Licença

[MIT](LICENSE)
