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
- Enquanto a IA clica ou digita, o Chrome mostra a faixa "AI Browser Agent começou a depurar
  este navegador". É esperado: as ações usam `chrome.debugger` para virar entrada real de
  mouse e teclado.
- Só a extensão com o ID fixo deste projeto e com o token de pareamento consegue se conectar
  ao servidor. Páginas web não conseguem.
- Exceção: a escolha de opção em `<select>` é feita por script (o evento `change` não tem
  `isTrusted`). Cliques, digitação, checkbox e radio são entrada real.
- O `read_page` nunca devolve o conteúdo de campos de senha: um campo preenchido aparece
  como `••••`.
- Diálogos JavaScript abertos por uma ação são fechados na hora: `alert` com OK, e
  `confirm`, `prompt` e "sair da página" com Cancelar. A IA nunca concorda com nada em seu
  nome, e o resultado da ação informa quais diálogos apareceram.

## Requisitos

- Node.js 24 ou mais novo
- Google Chrome 116 ou mais novo

## Instalação

```sh
npm install
npm run build
```

No Chrome, abra `chrome://extensions`, ligue o **Modo do desenvolvedor**, clique em
**Carregar sem compactação** e escolha a pasta `dist/extension`.

O ID da extensão é sempre `cjnpnhbdjkkhlkncmmknhdgcgkocdfea`, em qualquer máquina.

## Configurar no Claude Code

```sh
claude mcp add ai-browser -- node "C:/caminho/absoluto/ai-browser-agent/dist/server/index.js"
```

Use `--scope user` para valer em todos os projetos.

## Configurar no Codex

Em `~/.codex/config.toml` (no Windows, `%USERPROFILE%\.codex\config.toml`):

```toml
[mcp_servers.ai-browser]
command = "node"
args = ["C:/caminho/absoluto/ai-browser-agent/dist/server/index.js"]
```

Os dois podem rodar ao mesmo tempo: o primeiro servidor fica com a porta e o segundo
repassa os comandos para ele. Se o primeiro fechar, o segundo assume.

## Parear

1. Abra o Claude Code ou o Codex uma vez com o MCP configurado. O servidor cria o token em
   `~/.ai-browser-agent/token` (no Windows, `%USERPROFILE%\.ai-browser-agent\token`).
2. Clique com o botão direito no ícone da extensão → **Opções**. Cole o token e clique em
   **Salvar token**.
3. Abra o popup e clique na chave para **ligar**. O ícone mostra:
   - nada: desligada;
   - `ON` em âmbar: ligada e conectada;
   - `!` em vermelho: ligada, mas sem servidor (abra o Claude Code ou o Codex).

## Porta

A porta padrão é `8765`. Para mudar, defina `AI_BROWSER_PORT` no ambiente do servidor e
coloque o mesmo número em Opções → Porta. Exemplo no Codex:

```toml
[mcp_servers.ai-browser]
command = "node"
args = ["C:/caminho/absoluto/ai-browser-agent/dist/server/index.js"]
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
| `navigate` | abre URL ou `back` / `forward` / `reload`, espera carregar (até 30 s) |
| `list_tabs` | lista as abas (id, título, URL, ativa, janela) |
| `switch_tab` | ativa uma aba |
| `new_tab` | abre aba nova, opcionalmente numa URL |
| `close_tab` | fecha uma aba |
| `screenshot` | PNG da área visível da aba |

Sem `tabId`, as ferramentas usam a aba ativa da janela em foco. Os números de `read_page`
valem até a próxima leitura ou navegação daquela aba. URLs sem esquema (`google.com`) ganham
`https://`. O `screenshot` de uma aba em segundo plano ativa essa aba antes de capturar,
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
- **Não lê páginas `chrome://` nem a Chrome Web Store**: o Chrome bloqueia extensões nelas.
- **Iframes de outro site e shadow DOM fechado** não aparecem no `read_page` nesta versão.

## Desenvolvimento

```sh
npm test       # testes de unidade
npm run build  # gera dist/ e checa tipos
npm run e2e    # teste ponta a ponta com Chrome for Testing
```

O e2e precisa do Chrome for Testing: `npx puppeteer browsers install chrome`. Ele usa a
porta `18765` e uma pasta temporária, sem tocar no seu token nem na porta `8765`.

## Licença

[MIT](LICENSE)
