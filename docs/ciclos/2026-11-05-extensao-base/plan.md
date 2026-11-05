# Plano — extensão base

- Ciclo: `2026-11-05-extensao-base`
- Spec: `docs/ciclos/2026-11-05-extensao-base/spec.md` e `design.md`
- Commit-base: nenhum (o repositório é criado na T01)
- Tecnologia: Node 24, TypeScript 5, npm. Servidor: `@modelcontextprotocol/sdk` 1.32,
  `ws` 8, `zod` 4. Extensão: Manifest V3, empacotada com `esbuild` 0.28. Testes: `vitest` 5
  (unidade) e `puppeteer` 25 (e2e, que baixa o Chrome for Testing).

Todos os caminhos são relativos a `ai-browser-agent/`.

## Decisões fechadas

- D1. **Pacote único**, sem workspaces. `build.mjs` usa esbuild para gerar `dist/server/`
  (um bundle ESM para Node) e `dist/extension/` (um bundle por entrada, mais os arquivos
  estáticos copiados). `tsc --noEmit` faz só a checagem de tipos.
- D2. **O WebSocket fica num offscreen document**, não no service worker. O Chrome suspende
  o service worker, mas não o offscreen. O offscreen repassa cada comando ao service worker
  por `chrome.runtime.sendMessage`, o que também o acorda. Esse é o caminho que cumpre C6.
  Motivo declarado no manifest: `reasons: ["WORKERS"]`, com justificativa "manter a
  conexão com o servidor MCP local".
- D3. **Reconexão:** o offscreen tenta reconectar 1 s depois de cair e repete a cada 2 s,
  sem limite. O service worker cria o offscreen em `runtime.onStartup`,
  `runtime.onInstalled` e sempre que recebe uma mensagem e o offscreen não existe.
- D4. **Protocolo** (`src/shared/protocol.ts`), em JSON por WebSocket:
  - o primeiro frame do cliente é `{ "type": "hello", "role": "extension" | "relay", "token": string }`;
  - o servidor responde `{ "type": "welcome" }` ou fecha com código 4401;
  - comando: `{ "type": "command", "id": string, "tool": ToolName, "args": object }`;
  - resposta: `{ "type": "result", "id": string, "ok": true, "data": unknown }` ou
    `{ "type": "result", "id": string, "ok": false, "error": { "code": ErrorCode, "message": string } }`.
- D5. **Autenticação** no `verifyClient` do `ws`: um `Origin` igual a
  `chrome-extension://<EXTENSION_ID>` só pode ter `role: "extension"`; sem `Origin`, só
  `role: "relay"`; qualquer outro `Origin` é recusado com 403 antes do upgrade. O token vai
  no `hello`, nunca na URL, e é comparado com `crypto.timingSafeEqual`. Sem `hello` válido
  em 3 s, a conexão é fechada com 4401.
- D6. **Dono e secundário** (`src/server/bridge.ts`): o servidor tenta `listen` em
  `127.0.0.1:<porta>`. Se conseguir, vira dono. Se der `EADDRINUSE`, conecta como relay.
  Quando a conexão de relay cai, ele tenta virar dono na hora. Se perder a corrida, volta a
  ser relay. O dono troca os ids dos comandos dos relays por ids próprios e devolve cada
  resposta ao relay de origem. Um comando sem extensão conectada falha com
  `[NOT_CONNECTED]` em vez de ficar esperando.
- D7. **Tempo limite:** cada comando tem 35 s no servidor. Ao estourar, a resposta é
  `[TIMEOUT]`.
- D8. **Configuração do servidor:** porta em `AI_BROWSER_PORT` (padrão `8765`). Pasta de
  dados em `AI_BROWSER_HOME` (padrão `~/.ai-browser-agent`). O token tem 32 bytes
  aleatórios em hex e fica em `<home>/token`. O servidor nunca escreve em stdout, só o MCP
  usa stdout; log vai para stderr.
- D9. **ID fixo:** `scripts/gen-key.mjs` gera um par RSA 2048 uma única vez. Ele grava a
  chave pública em base64 (DER SPKI) no campo `key` de `src/extension/manifest.json` e o ID
  derivado em `src/shared/extension-id.ts`. O ID são os primeiros 32 dígitos hex do SHA-256
  da DER, com 0-f mapeados para a-p. A chave privada é descartada, porque extensão sem
  pacote não precisa dela.
- D10. **Leitura da página:** `src/extension/reader.ts` vira o bundle
  `dist/extension/reader.js` e é injetado com `chrome.scripting.executeScript({ files })` no
  mundo isolado, em todos os frames da mesma origem. Ele guarda um array
  `globalThis.__aiba.elements` (índice → elemento) que dura até a próxima leitura ou
  navegação. Elemento interativo: `a[href]`, `button`, `input` (exceto `hidden`),
  `select`, `textarea`, `[role=button|link|checkbox|radio|tab|menuitem]`,
  `[contenteditable=true]` e `[onclick]`, desde que visível (tamanho maior que 0, sem
  `visibility:hidden`, sem `display:none` em nenhum ancestral). Rótulo, nesta ordem:
  `aria-label`, `<label>` associado, `placeholder`, texto interno com até 80 caracteres,
  `title`, `name`. O texto visível vem de `document.body.innerText`, cortado em 20 000
  caracteres com o aviso `[texto cortado]`.
- D11. **Ações por CDP** (`src/extension/cdp.ts`): `chrome.debugger.attach({ tabId }, "1.3")`
  na primeira ação na aba. Antes de cada ação, `chrome.debugger.getTargets()` diz se a aba
  ainda está anexada, e a extensão reanexa se preciso. Desanexa ao desligar a extensão.
  - Clique: o reader faz `scrollIntoView({ block: "center" })` e devolve o centro do
    retângulo em pixels CSS do viewport, somando o deslocamento do iframe quando houver.
    Depois, `Input.dispatchMouseEvent` com `mouseMoved`, `mousePressed` e `mouseReleased`,
    botão `left` e `clickCount: 1`.
  - Digitação: o reader faz `focus()`. Com `clear`, o reader seleciona todo o conteúdo e o
    CDP manda a tecla `Backspace`. Depois, `Input.insertText`. Com `submit`, o CDP manda
    `keyDown`/`keyUp` de `Enter` com `text: "\r"`.
  - Em `fill_form`, checkbox e radio são marcados com o clique acima, só quando o estado
    atual difere do pedido. `select` é a exceção declarada: o reader escolhe a opção pelo
    valor ou pelo texto e dispara `input` e `change`, que não são `isTrusted`. O README
    registra isso.
  - Print: `Page.captureScreenshot` com `format: "png"`.
- D12. **Bloqueio:** `isBlocked(url, list)` em `src/shared/blocklist.ts` compara o
  `hostname` em minúsculas com cada item. Bloqueia quando é igual ou termina em
  `"." + item`. Ignora porta e esquema. URL sem host (`about:blank`, `data:`) nunca é
  bloqueada. O service worker checa a URL da aba antes de qualquer ferramenta de página e,
  em `navigate`, checa também a URL de destino. Páginas `chrome://`,
  `chrome-extension://` de outras extensões, `https://chrome.google.com/webstore` e
  `https://chromewebstore.google.com` respondem `[UNSUPPORTED_PAGE]`.
- D13. **Estado da extensão:** `chrome.storage.local` guarda `{ enabled: false, token: "",
  port: 8765, blocklist: string[] }`. `chrome.storage.session` guarda
  `{ connected: boolean, lastAction: { tool, target, at } | null }`. O badge segue R19: vazio
  quando desligada, `ON` com fundo `#E8A317` quando ligada e conectada, `!` com fundo
  `#C0392B` quando ligada e desconectada. O offscreen informa a conexão ao service worker
  pela mensagem `{ type: "connection", connected }`.
- D14. **Nomes das ferramentas MCP:** `read_page`, `click`, `type`, `fill_form`,
  `navigate`, `list_tabs`, `switch_tab`, `new_tab`, `close_tab`, `screenshot`. Argumentos:
  - `read_page { tabId? }`
  - `click { index, tabId? }`
  - `type { index, text, clear? = true, submit? = false, tabId? }`
  - `fill_form { fields: [{ index, value: string | boolean }], tabId? }`
  - `navigate { url? , action?: "back" | "forward" | "reload", tabId? }` (exatamente um entre
    `url` e `action`)
  - `list_tabs {}`
  - `switch_tab { tabId }`
  - `new_tab { url? }`
  - `close_tab { tabId }`
  - `screenshot { tabId? }`
- D15. **E2E** (`test/e2e/run.mjs`): `puppeteer.launch({ headless: true, pipe: true,
  enableExtensions: [<dist/extension absoluto>] })`. Usa `AI_BROWSER_PORT=18765` e um
  `AI_BROWSER_HOME` temporário, para nunca tocar no token real do usuário. Liga a extensão,
  cola o token e configura a porta abrindo `chrome-extension://<id>/options.html` e
  `popup.html` como abas e clicando na interface. Para parar o service worker, abre uma
  sessão CDP numa página e chama `ServiceWorker.enable` seguido de
  `ServiceWorker.stopAllWorkers`. Se `enableExtensions` ou essa parada não funcionarem no
  Chrome for Testing baixado, a execução para e volta ao `PLAN`.
- D16. **Repositório:** `git init` na T01, com `.gitignore` para `node_modules/`, `dist/`,
  `.stilo/logs/` e `.e2e-tmp/`. Nenhum commit é feito sem o usuário pedir.

## Tarefas

### Tarefa T01 — esqueleto do projeto
ID: T01
Especialista: build
Files:
- Create: package.json
- Create: tsconfig.json
- Create: vitest.config.ts
- Create: build.mjs
- Create: .gitignore
Depends-on: nenhum
Resources: nenhum

1. `git init`. Criar `.gitignore` como em D16.
2. `package.json` com `"type": "module"`, `"private": true` e os scripts
   `build: node build.mjs && tsc --noEmit`, `test: vitest run`,
   `e2e: npm run build && node test/e2e/run.mjs` e `gen-key: node scripts/gen-key.mjs`.
   Dependências: `@modelcontextprotocol/sdk@^1.32.2`, `ws@^8.22.1`, `zod@^4.6.7`.
   Dependências de desenvolvimento: `typescript@^5`, `esbuild@^0.28.2`, `vitest@^5.1.0`,
   `puppeteer@^25.16.0`, `happy-dom`, `@types/ws`, `@types/chrome`, `@types/node`.
3. `tsconfig.json`: `strict`, `target ES2022`, `module NodeNext`, `moduleResolution
   NodeNext`, `noEmit`, `include: ["src", "test", "scripts"]`, `types: ["node", "chrome"]`.
4. `build.mjs`: limpa `dist/`. Gera `dist/server/index.js` a partir de
   `src/server/index.ts` (platform `node`, format `esm`, bundle, com o banner
   `#!/usr/bin/env node`). Gera em `dist/extension/` os bundles `background.js`,
   `offscreen.js`, `popup.js`, `options.js` e `reader.js` (platform `browser`, format
   `iife`, exceto `background.js`, que é `esm`). Copia `manifest.json`, `*.html`, `*.css` e
   `icons/` de `src/extension/`. Antes do esbuild existirem entradas, o build falha, o que é
   esperado.
5. `npm install > .stilo/logs/install.log 2>&1; echo $?`. Saída esperada: `0`.

### Tarefa T02 — protocolo e lista de bloqueio (TDD)
ID: T02
Especialista: lógica
Files:
- Create: src/shared/protocol.ts
- Create: src/shared/blocklist.ts
- Create: test/unit/blocklist.test.ts
- Create: test/unit/protocol.test.ts
Depends-on: T01
Resources: nenhum

1. Escrever `test/unit/blocklist.test.ts` com estes casos:
   - `isBlocked("https://bb.com.br/x", ["bb.com.br"])` → `true`
   - `("https://www.bb.com.br", ["bb.com.br"])` → `true`
   - `("https://notbb.com.br", ["bb.com.br"])` → `false`
   - `("http://127.0.0.1:5173/", ["127.0.0.1"])` → `true`
   - `("https://BB.COM.BR", ["bb.com.br"])` → `true`
   - `("about:blank", ["bb.com.br"])` → `false`
   - `("https://x.com", [])` → `false`
   - item com espaço ou ponto inicial (`" .bb.com.br "`) é normalizado para `bb.com.br`.
2. Escrever `test/unit/protocol.test.ts`: `formatError("EXTENSION_OFF", "msg")` devolve uma
   string que começa com `[EXTENSION_OFF] `, e `ERROR_CODES` contém exatamente os 7 códigos
   de R16.
3. `npx vitest run test/unit > .stilo/logs/t02-red.log 2>&1; tail -5 .stilo/logs/t02-red.log`.
   Esperado: falha por módulo inexistente.
4. Implementar `blocklist.ts` (`normalizeDomain`, `isBlocked`) e `protocol.ts` (tipos de
   D4, `ERROR_CODES`, `ErrorCode`, `TOOL_NAMES` de D14, `formatError`, `ToolError` com
   `code`).
5. Repetir o comando do passo 3. Esperado: todos os testes passam.

### Tarefa T03 — ID fixo da extensão
ID: T03
Especialista: build
Files:
- Create: scripts/gen-key.mjs
- Create: src/extension/manifest.json
- Create: src/shared/extension-id.ts
Depends-on: T01
Resources: nenhum

1. `src/extension/manifest.json`: `manifest_version: 3`, `name: "AI Browser Agent"`,
   `version: "0.1.0"`, `minimum_chrome_version: "116"`,
   `permissions: ["debugger", "tabs", "scripting", "storage", "offscreen"]`,
   `host_permissions: ["<all_urls>"]`,
   `background: { service_worker: "background.js", type: "module" }`,
   `action: { default_popup: "popup.html" }`, `options_page: "options.html"`.
2. `scripts/gen-key.mjs` como em D9. Se `manifest.json` já tiver `key`, só recalcula o ID e
   não gera chave nova. Exporta a função `idFromPublicKeyDer(buf)` para teste.
3. `npm run gen-key`. Esperado: `manifest.json` ganha `key`, e `extension-id.ts` contém
   `export const EXTENSION_ID = "<32 letras a-p>"`.
4. Conferir: `node -e "..."` lendo `extension-id.ts` e checando a regex `^[a-p]{32}$`.
   Esperado: `ok`.

### Tarefa T04 — configuração do servidor
ID: T04
Especialista: lógica
Files:
- Create: src/server/config.ts
- Create: test/unit/config.test.ts
Depends-on: T02
Resources: nenhum

1. Teste: com `AI_BROWSER_HOME` numa pasta temporária vazia, `loadConfig()` cria
   `<home>/token` com 64 caracteres hex. Uma segunda chamada devolve o mesmo token. Sem
   `AI_BROWSER_PORT`, a porta é `8765`; com `AI_BROWSER_PORT=18765`, é `18765`; com um valor
   inválido (`abc`), lança um erro que cita `AI_BROWSER_PORT`.
2. Rodar `npx vitest run test/unit/config.test.ts` e ver falhar.
3. Implementar `loadConfig(): { port, home, token }` como em D8. Arquivo do token com modo
   `0o600`.
4. Rodar de novo. Esperado: passa.

### Tarefa T05 — ponte WebSocket: dono e relay (TDD)
ID: T05
Especialista: segurança/rede
Files:
- Create: src/server/bridge.ts
- Create: test/unit/bridge.test.ts
Depends-on: T02, T03, T04
Resources: nenhum

Cada teste usa uma porta livre obtida com `listen(0)` e liberada antes.

1. Escrever `test/unit/bridge.test.ts`. Uma "extensão falsa" é um cliente `ws` com
   `headers: { Origin: "chrome-extension://" + EXTENSION_ID }`, que responde a cada comando
   com `{ ok: true, data: { echo: tool } }`. Casos:
   - a. `Origin: https://evil.com` recebe 403, e a conexão não abre;
   - b. Origin da extensão com token errado é fechada com 4401;
   - c. Origin da extensão com `role: "relay"` é fechada com 4401;
   - d. sem Origin e com `role: "extension"` é fechada com 4401;
   - e. sem `hello` em 3 s, a conexão é fechada com 4401 (o teste usa timers falsos ou o
     tempo limite injetável `helloTimeoutMs`);
   - f. dono com extensão: `bridge.send("list_tabs", {})` devolve `{ echo: "list_tabs" }`;
   - g. dono sem extensão: `send` rejeita com `ToolError` de código `NOT_CONNECTED`;
   - h. segundo bridge na mesma porta vira relay (`bridge.role === "relay"`), e o `send`
     dele devolve `{ echo: ... }` passando pelo dono;
   - i. ao fechar o dono, o relay vira dono em até 3 s, a extensão falsa (que reconecta a
     cada 500 ms no teste) volta, e `send` funciona de novo;
   - j. uma extensão que nunca responde faz o `send` rejeitar com `TIMEOUT` (tempo limite
     injetável `commandTimeoutMs`).
2. `npx vitest run test/unit/bridge.test.ts > .stilo/logs/t05-red.log 2>&1; tail -5 .stilo/logs/t05-red.log`.
   Esperado: falha.
3. Implementar `createBridge({ port, token, extensionId, helloTimeoutMs = 3000,
   commandTimeoutMs = 35000 })`, que devolve `{ start(), send(tool, args), close(), role }`,
   como em D4 a D7. `verifyClient` aplica as regras de Origin de D5. Uma segunda conexão de
   extensão substitui a anterior.
4. Repetir o comando do passo 2. Esperado: os 10 casos passam.

### Tarefa T06 — servidor MCP
ID: T06
Especialista: lógica
Files:
- Create: src/server/tools.ts
- Create: src/server/index.ts
- Create: test/unit/tools.test.ts
Depends-on: T05
Resources: nenhum

1. Teste: com um `send` falso, `callTool("screenshot")` que recebe `{ data: "<base64>" }`
   devolve `content: [{ type: "image", data, mimeType: "image/png" }]`. Um `send` que
   rejeita com `ToolError("DOMAIN_BLOCKED", "...")` vira `{ isError: true, content: [{ type:
   "text", text: "[DOMAIN_BLOCKED] ..." }] }`. `navigate` com `url` e `action` ao mesmo tempo
   é recusado pela validação.
2. Rodar e ver falhar.
3. `tools.ts`: `registerTools(server, send)` registra as 10 ferramentas de D14 com schemas
   `zod`. Cada uma tem uma descrição em inglês de uma ou duas frases para o agente. A de
   `read_page` diz que os índices valem até a próxima leitura ou navegação. As de
   `click`, `type` e `fill_form` dizem para chamar `read_page` antes. A de `screenshot`
   devolve imagem; as demais devolvem texto JSON.
4. `index.ts`: `loadConfig()`, `createBridge(...)`, `start()`, `McpServer` com
   `name: "ai-browser-agent"`, `registerTools`, `StdioServerTransport`. Encerra o bridge no
   `SIGINT`, no `SIGTERM` e no fechamento do stdin.
5. Rodar o teste de novo. Esperado: passa.

### Tarefa T07 — extensão: offscreen, service worker e roteamento
ID: T07
Especialista: extensão
Files:
- Create: src/extension/offscreen.html
- Create: src/extension/offscreen.ts
- Create: src/extension/background.ts
- Create: src/extension/state.ts
- Create: src/extension/icons/icon-16.png
- Create: src/extension/icons/icon-48.png
- Create: src/extension/icons/icon-128.png
- Modify: src/extension/manifest.json
Depends-on: T02, T03, T09, T10
Resources: nenhum

1. `state.ts`: `getSettings()` e `setSettings()` sobre `chrome.storage.local` com os padrões
   de D13; `setConnected()`, `setLastAction()` e `updateBadge()` como em D13.
2. `offscreen.ts`: lê `token` e `port` de `chrome.storage.local` (o offscreen pede ao
   service worker por mensagem, porque só tem `chrome.runtime`). Conecta em
   `ws://127.0.0.1:<port>`, manda o `hello` com `role: "extension"` e reconecta como em D3.
   Repassa cada `command` ao service worker com `chrome.runtime.sendMessage({ type:
   "command", ... })` e devolve a resposta pelo WebSocket. Informa a conexão com
   `{ type: "connection" }`. Reconecta na hora quando recebe `{ type: "settings-changed" }`.
3. `background.ts`: `ensureOffscreen()` (D2/D3). Um listener de mensagens trata
   `connection`, `get-settings`, `settings-changed` e `command`. Para `command`: se
   desligada, `[EXTENSION_OFF]`; senão, chama `runTool(tool, args)` de `actions.ts` e grava
   `lastAction`. Um erro sem código vira `[TIMEOUT]` se for de tempo e, nos demais casos,
   mensagem crua com o código `ELEMENT_NOT_FOUND` só quando o reader disser isso. Ao
   desligar, chama `detachAll()`. O manifest ganha `icons` e `action.default_icon`.
4. Os ícones são PNGs simples (um quadrado `#1E2225` com um ponto `#E8A317`), gerados por um
   script Node inline com `zlib`, sem dependência nova.
5. Verificação (C2): `npm run build > .stilo/logs/t07-build.log 2>&1; echo $?`. Esperado:
   `0`, e `dist/extension/` contém `manifest.json`, `background.js`, `offscreen.js`,
   `reader.js`, `popup.js` e `options.js`.

### Tarefa T08 — reader (leitura e localização de elementos)
ID: T08
Especialista: extensão/DOM
Files:
- Create: src/extension/reader.ts
- Create: test/unit/reader.test.ts
Depends-on: T02
Resources: nenhum

1. Teste com `vitest` e ambiente `happy-dom` (comentário `// @vitest-environment happy-dom`
   no topo do arquivo; a dependência vem da T01):
   - uma página com `<button>Entrar</button>`, `<input placeholder="Email">`,
     `<input type="hidden">` e `<a href="#">Oculto</a>` dentro de `display:none` gera
     exatamente 2 elementos: `[1] button "Entrar"` e `[2] input "Email"`;
   - `locate(2)` devolve o centro do retângulo;
   - `locate(99)` lança um erro com o código `ELEMENT_NOT_FOUND`;
   - `selectOption(n, "Opção B")` muda o valor e dispara `change`.
   Como o happy-dom não calcula layout, o teste injeta `getBoundingClientRect` falso; a regra
   de visibilidade usa `getComputedStyle` e o tamanho do retângulo.
2. Rodar e ver falhar.
3. `reader.ts`: exporta as funções puras (`collect`, `locate`, `focusAndSelect`,
   `selectOption`, `getCheckState`) e, quando roda como script injetado, instala
   `globalThis.__aiba = { collect, locate, ... }`. As ações chamam essas funções com
   `chrome.scripting.executeScript({ func: (n) => globalThis.__aiba.locate(n), args })`.
   Regras de D10.
4. Rodar de novo. Esperado: passa.

### Tarefa T09 — ações: CDP e ferramentas
ID: T09
Especialista: extensão/CDP
Files:
- Create: src/extension/cdp.ts
- Create: src/extension/actions.ts
Depends-on: T02, T08
Resources: nenhum

1. `cdp.ts`: `ensureAttached(tabId)`, `detachAll()`, `click(tabId, x, y)`,
   `insertText(tabId, text)`, `pressKey(tabId, "Enter" | "Backspace")`,
   `screenshot(tabId)`, como em D11. Erros do `chrome.debugger` sobre aba inexistente viram
   `TAB_NOT_FOUND`.
2. `actions.ts`: `runTool(tool, args)` para as 10 ferramentas. `resolveTab(tabId?)` usa a
   aba ativa da última janela focada, checa D12 (`UNSUPPORTED_PAGE`, `DOMAIN_BLOCKED`) e
   injeta `reader.js` em `allFrames` quando `__aiba` não existe. `navigate` espera
   `tabs.onUpdated` com `status: "complete"` por até 30 s e, ao estourar, devolve
   `TIMEOUT`. `new_tab` também espera o carregamento quando recebe `url`. `list_tabs`
   devolve `{ id, title, url, active, windowId }` de todas as abas. O `read_page` devolve
   `{ url, title, text, elements: [{ index, tag, role, label, value }] }`.
3. Verificação: `npx tsc --noEmit -p . 2>&1 | grep -E "src/extension/(cdp|actions)\.ts"`.
   Esperado: nenhuma linha (sem erro de tipo nestes arquivos).

### Tarefa T10 — popup e opções
ID: T10
Especialista: interface
Files:
- Create: src/extension/ui.css
- Create: src/extension/popup.html
- Create: src/extension/popup.ts
- Create: src/extension/options.html
- Create: src/extension/options.ts
Depends-on: T03
Resources: nenhum

1. `ui.css`: os tokens do `design.md` como variáveis CSS, com o modo escuro em
   `prefers-color-scheme: dark`.
2. `popup.html` e `popup.ts`: a chave geral é um `<button id="toggle"
   aria-pressed="true|false">` que ocupa a largura toda, com o texto "IA com controle"
   ou "IA sem controle" e a ação "Ligar" ou "Desligar". Depois vêm o estado da conexão, com
   o texto do `design.md`, e a "Última ação: <tool> <alvo> · <tempo>". Por fim, o link
   "Opções e pareamento". O popup atualiza ao vivo com `chrome.storage.onChanged`.
3. `options.html` e `options.ts`: campos `#token` e `#port`, botão `#save-token` ("Salvar
   token"), estado do pareamento, lista `#blocklist` com botões "Remover", campo
   `#new-domain` e botão `#add-domain` ("Adicionar"). Tela vazia com o texto do
   `design.md`. Salvar envia `{ type: "settings-changed" }`.
4. Verificação: abrir os dois arquivos no e2e da T11. Aqui, só `npx tsc --noEmit` sem erro
   nestes arquivos.

### Tarefa T11 — e2e
ID: T11
Especialista: testes
Files:
- Create: test/e2e/run.mjs
- Create: test/e2e/fixtures/form.html
- Create: test/e2e/fixtures/other.html
Depends-on: T06, T07, T09, T10
Resources: port:127.0.0.1:18765, port:127.0.0.1:18080, profile:navegador-e2e, dir:.e2e-tmp

1. `form.html`: os campos nome (texto), email (texto), plano (`select` com "Básico" e
   "Pro"), aceito (checkbox) e o botão "Enviar". Cada `input`, `click` e `keydown` grava
   `event.isTrusted` em `window.__trust`. No envio, sem recarregar, mostra
   `Enviado: <nome> / <email> / <plano> / <aceito> / trusted=<todos true>`. `other.html`
   tem só o título "Outra aba".
2. `run.mjs`, nesta ordem:
   1. sobe um servidor HTTP estático em `127.0.0.1:18080` servindo `fixtures/`;
   2. cria `.e2e-tmp/home` e lança o Chrome como em D15;
   3. inicia o cliente MCP A (`Client` + `StdioClientTransport` com `node
      dist/server/index.js` e as variáveis de D15) e lê o token do `AI_BROWSER_HOME`;
   4. abre `options.html`, preenche `#port` com `18765` e `#token`, e clica em
      `#save-token`; abre `popup.html` e clica em `#toggle` até `aria-pressed="true"`;
   5. abre `http://127.0.0.1:18080/form.html` numa aba e a ativa;
   6. C3: `read_page` → acha os índices pelos rótulos; `fill_form` (nome, email, plano
      "Pro", aceito `true`); `click` em "Enviar"; `read_page` → o texto contém
      `Enviado: Ana / ana@x.com / pro / true / trusted=true`; `new_tab
      { url: ".../other.html" }`; `list_tabs` → as duas abas aparecem; `switch_tab` para o
      formulário; `screenshot` → base64 que decodifica para um buffer com mais de 0 bytes e
      começa com `89 50 4E 47`; `close_tab` na outra aba; `list_tabs` → ela sumiu;
   7. C5: inicia o cliente MCP B com as mesmas variáveis; `list_tabs` em A e em B têm
      sucesso;
   8. C6a: sessão CDP numa página, `ServiceWorker.stopAllWorkers`; em seguida, `list_tabs`
      em A, repetindo a cada 500 ms, tem sucesso em até 10 s;
   9. C6b: fecha o cliente A (o servidor dono cai); `list_tabs` em B, repetindo a cada
      500 ms, tem sucesso em até 10 s;
   10. C4: adiciona `127.0.0.1` em `options.html` (`#new-domain` + `#add-domain`);
       `read_page` em B → o texto do erro começa com `[DOMAIN_BLOCKED]`; desliga em
       `popup.html`; `list_tabs` em B → começa com `[EXTENSION_OFF]`;
   11. imprime `PASS <passo>` ou `FAIL <passo>: <erro>` por passo, fecha tudo, apaga
       `.e2e-tmp/` e sai com código 0 só se tudo passou.
3. `npm run e2e > .stilo/logs/e2e.log 2>&1; echo $?; grep -E "PASS|FAIL" .stilo/logs/e2e.log`.
   Esperado: `0` e só linhas `PASS`.

### Tarefa T12 — README
ID: T12
Especialista: documentação
Files:
- Create: README.md
Depends-on: T11
Resources: nenhum

Em português, com estas seções:
1. o que é;
2. aviso de segurança (sessão logada real, interruptor, lista de bloqueio, a faixa "está
   depurando", a exceção do `select` em D11);
3. requisitos (Node 24 e Chrome 116 ou mais novo);
4. instalação: `npm install`, `npm run build` e "Carregar sem compactação" apontando para
   `dist/extension`;
5. configurar o Claude Code: `claude mcp add ai-browser -- node <caminho
   absoluto>/dist/server/index.js`;
6. configurar o Codex: o bloco `[mcp_servers.ai-browser]` em `~/.codex/config.toml`, com
   `command = "node"` e `args = ["<caminho absoluto>/dist/server/index.js"]`;
7. parear: rodar o agente uma vez, copiar `~/.ai-browser-agent/token` (no Windows,
   `%USERPROFILE%\.ai-browser-agent\token`) para as opções e ligar;
8. porta (`AI_BROWSER_PORT`);
9. as ferramentas;
10. os códigos de erro;
11. solução de problemas.

Verificação: `grep -c "^## " README.md`. Esperado: pelo menos 9.

## Ondas

- Onda 1: T01
- Onda 2: T02, T03 (arquivos disjuntos)
- Onda 3: T04, T08, T10 (T04 depende de T02; T08 depende de T02; T10 depende de T03;
  arquivos disjuntos)
- Onda 4: T05, T09 (T05 depende de T02/T03/T04; T09 depende de T02/T08; disjuntos)
- Onda 5: T06, T07 (T06 depende de T05; T07 depende de T09/T10; disjuntos. A T07 roda o
  build completo, C2)
- Onda 6: T11
- Onda 7: T12

Execução sugerida: em série, na ordem das ondas, pelo coordenador. As tarefas são pequenas e
os imports entre elas são muitos. A paralelização economiza pouco e arrisca contratos
desencontrados.

## Modelo e esforço

| Tarefa | Classificação | Esforço |
|---|---|---|
| T01, T03, T12 | mecânica verificável | baixo |
| T02, T04, T06, T08, T10 | lógica comum com teste | médio |
| T05, T07, T09, T11 | segurança, rede, CDP, concorrência | alto |

## Foco da revisão

- T05: a regra de Origin e role (D5), a comparação do token em tempo constante, o
  `hello` com tempo limite, e o repasse de ids no relay. Uma resposta pode ir para o relay
  errado ou ser perdida quando o dono cai.
- T07 e T09: a checagem de bloqueio acontece antes de toda ação, inclusive `navigate` para o
  destino, `screenshot` e `switch_tab`? Comando executado com a extensão desligada?
- T09: coordenadas em iframe e com zoom da página diferente de 100%. A verificação de que a
  aba ainda está anexada ao debugger.
- T11: o e2e não pode tocar no `~/.ai-browser-agent` real nem na porta 8765.
- T06: nada escrito em stdout fora do MCP.

## Cobertura do spec

| Requisito | Tarefa |
|---|---|
| R1 | T06 |
| R2, R2a | T03, T07 |
| R3 | T04, T07, T10 |
| R4, R5 | T04, T05, T10 |
| R6, R7 | T05, T07 (D3) |
| R8 | T08, T09 |
| R9, R10, R11 | T08, T09 |
| R12, R13, R14, R15 | T09 |
| R16 | T02, T06, T09 |
| R17, R18 | T02, T07, T09, T10 |
| R19, R21 | T07, T10 |
| R20 | T12 |
| C1 | T02, T04, T05, T06, T08 |
| C2 | T07 (build) |
| C3 a C6 | T11 |
