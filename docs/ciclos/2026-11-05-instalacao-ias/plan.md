# Plano — instalação nas IAs

- Ciclo: `2026-11-05-instalacao-ias`
- Spec: `docs/ciclos/2026-11-05-instalacao-ias/spec.md`
- Commit-base: `8a76453`
- Tecnologia: a mesma do ciclo anterior (Node 24, TypeScript 5, esbuild, vitest), mais os
  plugins do Claude Code 2.1.318 e do Codex CLI 0.166.0, e o GitHub Actions.

Todos os caminhos são relativos a `ai-browser-agent/`.

## Prova feita antes do plano (Codex 0.166.0, `CODEX_HOME` temporário)

Um plugin mínimo com quatro servidores de teste. Cada um expunha uma ferramenta cuja
descrição mostrava o caminho do script, o `cwd` e as variáveis de ambiente.

| Forma em `.mcp.json` | Subiu? | Observado |
|---|---|---|
| `"args": ["${PLUGIN_ROOT}/probe.mjs"]` | não | variável não expandida |
| `"args": ["${CLAUDE_PLUGIN_ROOT}/probe.mjs"]` | não | variável não expandida |
| `"args": ["./probe.mjs"]`, sem `cwd` | não | `cwd` = diretório da sessão |
| caminho absoluto | sim | `PLUGIN_ROOT` e `CLAUDE_PLUGIN_ROOT` ausentes do ambiente |
| `"args": ["probe.mjs"], "cwd": "."` | **sim** | `cwd` = raiz do plugin instalado |
| `"args": ["./probe.mjs"], "cwd": "./"` | **sim** | idem |

O Codex também leu o `.claude-plugin/marketplace.json` (`codex plugin marketplace add
<pasta>` e `codex plugin add <plugin>@<marketplace>`). O `codex exec` precisa de stdin
fechado (`< /dev/null`); sem isso, fica esperando entrada.

## Decisões fechadas

- D1. **Servidor no Claude Code:** declarado inline em `.claude-plugin/plugin.json`:
  `"mcpServers": { "ai-browser": { "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/plugin/server.mjs"] } }`.
  Não existe `.mcp.json` na raiz, para o Claude Code não ler a configuração do Codex.
- D2. **Servidor no Codex:** `.codex-plugin/plugin.json` aponta `"mcpServers": "./.codex-mcp.json"`
  e `"skills": "./skills/"`. O `.codex-mcp.json` contém
  `{ "mcpServers": { "ai-browser": { "command": "node", "args": ["plugin/server.mjs"], "cwd": "." } } }`.
- D3. **Marketplace único** em `.claude-plugin/marketplace.json`, com `name:
  "ai-browser-agent"`, owner `luizgdemarchi` e o plugin com `"source": "./"` e
  `"category": "productivity"`, no mesmo formato do Stilo Code.
- D4. **Versão:** `src/shared/version.ts` exporta `VERSION = "0.2.0"`, que o servidor usa no
  `McpServer`. `test/unit/version.test.ts` compara `VERSION` com `package.json`,
  `src/extension/manifest.json`, `.claude-plugin/plugin.json` e `.codex-plugin/plugin.json`.
- D5. **Bundle:** a configuração do esbuild do servidor sai de `build.mjs` para
  `scripts/server-bundle.mjs`, que exporta `serverBundleOptions(outfile)`. Opções:
  - `entryPoints: ["src/server/index.ts"]`, `bundle: true`, `platform: "node"`,
    `format: "esm"`, `target: "node20"`, sem `packages: "external"`, `legalComments: "none"`,
    `charset: "utf8"`;
  - o banner `#!/usr/bin/env node` e o shim
    `import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);`,
    porque dependências CommonJS (`ws`) chamam `require`.

  O `build.mjs` gera `plugin/server.mjs` com essa configuração e continua gerando
  `dist/server/index.js`, sem mudança. O esbuild fica fixo em `"0.28.2"`.
- D6. **Fim de linha:** `.gitattributes` com `* text=auto eol=lf`, e `plugin/server.mjs` como
  `-diff linguist-generated`. A árvore é renormalizada uma vez
  (`git add --renormalize .`), o que também acaba com os avisos de CRLF.
- D7. **Teste do bundle** (`test/unit/bundle.test.ts`):
  - (a) gera o bundle num arquivo temporário com `serverBundleOptions` e compara byte a byte
    com `plugin/server.mjs`. A mensagem de falha manda rodar `npm run build`;
  - (b) copia só o `plugin/server.mjs` para uma pasta temporária vazia, sem
    `node_modules`, sobe com `StdioClientTransport` e confere que `tools/list` devolve as 10
    ferramentas de `TOOL_NAMES`. Usa `AI_BROWSER_HOME` temporário e `AI_BROWSER_PORT` livre.
- D8. **Skill:** `skills/browser/SKILL.md`, no formato aberto Agent Skills (agentskills.io, o mesmo
  de vercel-labs/agent-skills), com o frontmatter `name: browser` e uma
  `description` que diga quando usar ("controlar o Chrome do usuário: abrir páginas, ler,
  clicar, preencher formulários, abas, prints"). O corpo é em inglês, porque é instrução para
  o agente, e cobre exatamente o R8. Os códigos de erro são copiados de `ERROR_CODES`, e
  `test/unit/skill.test.ts` falha se algum código ou alguma das 10 ferramentas não aparecer
  no `SKILL.md`.
- D9. **Workflows:**
  - `.github/workflows/ci.yml`: `on: [push, pull_request]`, `ubuntu-latest`,
    `actions/setup-node@v4` com `node-version: 24` e `cache: npm`, depois `npm ci`,
    `npm test` e `npm run build`. Exporta `PUPPETEER_SKIP_DOWNLOAD=true`, porque o e2e não
    roda no Actions.
  - `.github/workflows/release.yml`: `on: push: tags: ["v*"]`, `permissions: contents:
    write`. Roda os mesmos passos, confere que `${GITHUB_REF_NAME#v}` é igual à `version` do
    `package.json` (falha se não for), empacota com
    `cd dist/extension && zip -r "../../ai-browser-agent-extension-${GITHUB_REF_NAME}.zip" .`
    e publica com `gh release create "$GITHUB_REF_NAME" <zip> --title "$GITHUB_REF_NAME" --generate-notes`,
    usando `GH_TOKEN: ${{ github.token }}`.
- D10. **Instalação local para verificação (C3 e C4):**
  - Claude Code: `claude plugin marketplace add <repo>`,
    `claude plugin install ai-browser-agent@ai-browser-agent` e `claude mcp list`. Depois da
    verificação, `claude plugin uninstall` e `claude plugin marketplace remove`, para o
    usuário instalar depois a partir do GitHub.
  - Codex: `CODEX_HOME` temporário com uma cópia do `auth.json`, que é apagada logo depois,
    como na prova. A configuração real do usuário não é tocada.
- D11. **Commits:** um commit por tarefa verificada, com push, como na memória do projeto. A
  tag `v0.2.0` só na T08, depois do `ci` verde.

## Tarefas

### Tarefa T01 — versão única 0.2.0 (TDD)
ID: T01
Especialista: build
Files:
- Create: src/shared/version.ts
- Create: test/unit/version.test.ts
- Modify: package.json
- Modify: package-lock.json
- Modify: src/extension/manifest.json
- Modify: src/server/index.ts
Depends-on: nenhum
Resources: nenhum

1. Escrever `test/unit/version.test.ts`. Ele lê `package.json` e
   `src/extension/manifest.json` e, quando existirem, `.claude-plugin/plugin.json` e
   `.codex-plugin/plugin.json` (a T03 cria os dois; o teste exige os quatro depois da T03).
   Cada `version` precisa ser igual a `VERSION`, e `VERSION` igual a `"0.2.0"`.
2. Rodar `npx vitest run test/unit/version.test.ts`. Esperado: falha (módulo inexistente,
   depois `0.1.0` ≠ `0.2.0`).
3. Criar `version.ts`. Trocar para `0.2.0` em `package.json` e no manifest. O `index.ts`
   passa a usar `VERSION` no `McpServer`. Fixar `"esbuild": "0.28.2"` e rodar `npm install`.
4. Rodar de novo. Esperado: passa. Commit e push.

### Tarefa T02 — bundle do servidor commitado (TDD)
ID: T02
Especialista: build
Files:
- Create: scripts/server-bundle.mjs
- Create: plugin/server.mjs
- Create: test/unit/bundle.test.ts
- Create: .gitattributes
- Modify: build.mjs
Depends-on: T01
Resources: nenhum

1. `.gitattributes` como em D6, e `git add --renormalize .`.
2. Escrever `test/unit/bundle.test.ts` como em D7.
3. Rodar e ver falhar (`plugin/server.mjs` inexistente).
4. Criar `scripts/server-bundle.mjs` e ligar ao `build.mjs`. Rodar `npm run build`.
5. Rodar `npx vitest run`. Esperado: tudo passa.
6. Prova de que o teste (a) testa algo: acrescentar um comentário à mão no
   `plugin/server.mjs`, rodar e ver falhar, e reverter com `git checkout plugin/server.mjs`.
7. Commit e push.

### Tarefa T03 — manifests do plugin
ID: T03
Especialista: plugin
Files:
- Create: .claude-plugin/plugin.json
- Create: .claude-plugin/marketplace.json
- Create: .codex-plugin/plugin.json
- Create: .codex-mcp.json
Depends-on: T02
Resources: nenhum

1. Criar os quatro arquivos como em D1, D2 e D3.
   - `plugin.json` do Claude: `name`, `displayName: "AI Browser Agent"`, `version`,
     `description`, `author` (nome e url do GitHub), `homepage`, `repository`,
     `license: "MIT"`, `keywords`, `mcpServers`.
   - `.codex-plugin/plugin.json`: os mesmos metadados, mais `skills`, `mcpServers` e
     `interface`: `displayName`, `shortDescription`, `longDescription`, `developerName`,
     `category: "Productivity"`, `capabilities: ["Instructions", "MCP"]`, `websiteURL`,
     `defaultPrompt` com 3 exemplos e `brandColor: "#1E2225"`.
2. `claude plugin validate .`. Esperado: `Validation passed`, sem avisos (C1).
3. `npx vitest run test/unit/version.test.ts`. Esperado: passa com os quatro manifests.
4. Commit e push.

### Tarefa T04 — skill `browser`
ID: T04
Especialista: documentação para agente
Files:
- Create: skills/browser/SKILL.md
- Create: test/unit/skill.test.ts
Depends-on: T03
Resources: nenhum

1. Escrever `test/unit/skill.test.ts` como em D8, além de checar o frontmatter `name:
   browser`. Rodar e ver falhar.
2. Escrever o `SKILL.md`. Seções:
   1. When to use
   2. Workflow
   3. Tools
   4. Error codes, com uma linha por código e a ação esperada
   5. Safety rules, cobrindo o R8 item por item
   6. First-time setup, para quando vier `NOT_CONNECTED`: os passos do usuário, o link
      `https://github.com/luizgdemarchi/ai-browser-agent/releases/latest`, o caminho do token
      e a regra "nunca leia nem mostre o conteúdo do arquivo de token"
3. Rodar o teste. Esperado: passa. `claude plugin validate .` continua passando.
4. Commit e push.

### Tarefa T05 — workflows
ID: T05
Especialista: CI
Files:
- Create: .github/workflows/ci.yml
- Create: .github/workflows/release.yml
Depends-on: T02
Resources: nenhum

1. Criar os dois workflows como em D9.
2. Validar a sintaxe: `node -e` com um parse de YAML não está disponível sem dependência,
   então a verificação é o próprio push. Depois do commit e do push, `gh run watch` no `ci`.
   Esperado: `completed success` (C8 parcial; o teste de bundle no Linux prova o
   determinismo do D5).
3. Se o `ci` falhar por o bundle diferir entre Windows e Linux, a execução para e volta ao
   `PLAN` (D5 errado).

### Tarefa T06 — README
ID: T06
Especialista: documentação
Files:
- Modify: README.md
Depends-on: T04
Resources: nenhum

1. Novas seções no topo, nesta ordem:
   1. Instalar no Claude Code: `/plugin marketplace add luizgdemarchi/ai-browser-agent` e
      `/plugin install ai-browser-agent@ai-browser-agent`
   2. Instalar no Codex: `codex plugin marketplace add luizgdemarchi/ai-browser-agent` e
      `codex plugin add ai-browser-agent@ai-browser-agent`
   3. Extensão do Chrome: baixar o `.zip` do Release mais recente, descompactar e
      "Carregar sem compactação"
   4. Parear
2. As seções "Instalação", "Configurar no Claude Code" e "Configurar no Codex" atuais viram
   "Instalação manual (sem plugin)".
3. Uma nota curta: outros agentes compatíveis com Agent Skills podem instalar só a skill com
   `npx skills add luizgdemarchi/ai-browser-agent`. As ferramentas exigem o servidor MCP,
   registrado à mão como na instalação manual.
4. Uma seção "Publicar uma versão": subir a versão nos 5 lugares (o teste aponta os que
   faltarem), `npm run build`, commit, `git tag vX.Y.Z` e push da tag.
5. Verificação: leitura contra o L2. Commit e push.

### Tarefa T07 — instalação local nos dois hosts (C3, C4, C5, C7)
ID: T07
Especialista: verificação
Files:
- Create: docs/ciclos/2026-11-05-instalacao-ias/verificacao.md
Depends-on: T03, T04, T06
Resources: port:127.0.0.1:18765, profile:navegador-e2e, dir:.e2e-tmp

1. C5: `git archive HEAD` numa pasta temporária,
   `node <pasta>/plugin/server.mjs` com um cliente MCP de teste (script inline no
   scratchpad) e `tools/list`. Esperado: 10 ferramentas.
2. C3: os comandos do Claude Code de D10. Esperado: `claude mcp list` com `ai-browser` do
   plugin conectado. Depois, desinstalar.
3. C4: o Codex com `CODEX_HOME` temporário, `codex plugin marketplace add <repo>`,
   `codex plugin add ai-browser-agent@ai-browser-agent` e
   `codex exec --skip-git-repo-check -s read-only "<listar ferramentas mcp__ai_browser>" < /dev/null`.
   Esperado: as 10 ferramentas. Apagar a cópia do `auth.json` e o `CODEX_HOME`.
4. C7: `npm run e2e`. Esperado: 13/13 PASS.
5. Registrar em `verificacao.md` o comando e as linhas decisivas da saída de cada critério. Commit e push.

### Tarefa T08 — Release v0.2.0 (C6, C8)
ID: T08
Especialista: release
Files:
- Modify: docs/ciclos/2026-11-05-instalacao-ias/verificacao.md
Depends-on: T05, T07
Resources: nenhum

1. Conferir o `ci` verde no último commit: `gh run list --workflow ci --limit 1`.
2. `git tag v0.2.0` e `git push origin v0.2.0`. O usuário autorizou isso no `BRAINSTORM`.
3. `gh run watch` no `release`. Esperado: sucesso.
4. `gh release view v0.2.0 --json assets`. Esperado: `ai-browser-agent-extension-v0.2.0.zip`.
   Baixar, `unzip -p <zip> manifest.json` e conferir `"version": "0.2.0"`.
5. Acrescentar C6 e C8 em `verificacao.md`. Commit e push.

## Ondas

- Onda 1: T01
- Onda 2: T02
- Onda 3: T03, T05 (arquivos disjuntos)
- Onda 4: T04
- Onda 5: T06
- Onda 6: T07
- Onda 7: T08

Execução em série, pelo coordenador.

## Modelo e esforço

| Tarefa | Classificação | Esforço |
|---|---|---|
| T01, T03, T06 | mecânica verificável | baixo |
| T02, T04, T05 | lógica comum com teste | médio |
| T07, T08 | verificação com ações externas | médio |

## Foco da revisão

- T02: o bundle depende de algo fora dele (`require` dinâmico, arquivo `.node`)? O teste (b)
  pega isso.
- T03: o `.codex-mcp.json` com `cwd: "."` e o `${CLAUDE_PLUGIN_ROOT}` do Claude. Não pode
  haver `.mcp.json` na raiz.
- T04: a skill não manda o agente ler o token, e as regras de segurança estão completas.
- T05: `permissions` mínimas no release e a tag conferida contra o `package.json`.

## Cobertura do spec

| Requisito | Tarefa |
|---|---|
| R1, R2, R3, R5 | T03 |
| R4, R6, R7 | T02 |
| R8 | T04 |
| R9, R10 | T05, T08 |
| R11 | T01, T03 |
| R12 | T06 |
| C1 | T03, T04 |
| C2 | T01, T02 |
| C3, C4, C5, C7 | T07 |
| C6, C8 | T05, T08 |
