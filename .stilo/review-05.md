# Review 05

- Ciclo: `2026-11-05-instalacao-ias`
- Alvo: `git diff 8a76453..6e6cd3f -- . ':!plugin/server.mjs' ':!package-lock.json'`. O
  bundle foi conferido só por grep: nenhum caminho local, e nenhum `require` fora dos
  builtins, exceto strings de codegen do ajv e os opcionais do `ws`, que ficam em `try`.
- Lente: um revisor em subagente, cobrindo spec, manifests, skill, workflows, testes e
  README
- Documentos: `spec.md`, `plan.md` e `verificacao.md` do ciclo
- Verificação do revisor: `npx vitest run` deu 79/79; `claude plugin validate .` deu
  `Validation passed`

O revisor conferiu sem gerar achado:

- R1 a R12 atendidos.
- `${CLAUDE_PLUGIN_ROOT}` e `cwd: "."` continuam válidos no cache versionado.
- Não existe `.mcp.json` na raiz.
- `GITHUB_REF_NAME` só entra no shell por variável de ambiente, entre aspas.
- O release confere a tag antes de publicar.
- O teste de bundle (b) não acha `node_modules` subindo pelos diretórios.

## Resumo

| Gravidade | Achados |
|---|---|
| crítico | 0 |
| alto | 0 |
| médio | 2 |
| baixo | 6 |

## Achados

### 1. A skill manda refazer a primeira configuração em qualquer `NOT_CONNECTED`
- **Arquivo:** `skills/browser/SKILL.md:63` e `:90`
- **Gravidade:** médio
- **O que quebra:** `NOT_CONNECTED` também sai quando a conexão foi trocada ou caiu
  (`bridge.ts:225`, `:241` e `:333`, "Try again"), com token recusado entre dois servidores
  (`:375`), com a porta ocupada (`:386`) e com o Chrome fechado. Um usuário já pareado é
  levado a reinstalar a extensão, e a causa, que está na mensagem, fica escondida.
- **Como corrigir:** o agente lê a mensagem. Se for "Try again", tenta uma vez. Se citar
  token, `AI_BROWSER_HOME` ou porta, repassa ao usuário. Antes do guia de instalação,
  pergunta se o Chrome está aberto e se a extensão já está instalada e ligada.
- **Evidência:** leitura de `src/server/bridge.ts` e `src/extension/offscreen.ts:65`.
- **Confiança:** alta
- **Contraprova verificada:** a skill não distingue pela mensagem.
- **Classificação:** confirmado
- **Origem:** introduzido
- **Estado:** corrigido: `skills/browser/SKILL.md` (linha de `NOT_CONNECTED`: ler a mensagem, "Try again" uma vez, token, home e porta repassados, e o guia só se a extensão não estiver instalada). Teste novo falhou antes e passa depois.

### 2. `ELEMENT_NOT_FOUND` aparece só como "número velho"
- **Arquivo:** `skills/browser/SKILL.md:66`
- **Gravidade:** médio
- **O que quebra:** o mesmo código sai para "is not a select" e "has no option X. Options:
  …" (`reader.ts:214` e `:223`). O agente relê a página e repete o mesmo valor errado.
- **Como corrigir:** mandar ler a mensagem e usar uma das opções listadas.
- **Evidência:** leitura de `src/extension/reader.ts:150-223`.
- **Confiança:** alta
- **Contraprova verificada:** só a mensagem de número velho confere com a skill.
- **Classificação:** confirmado
- **Origem:** introduzido
- **Estado:** corrigido: `skills/browser/SKILL.md` (linha de `ELEMENT_NOT_FOUND`: usar as opções listadas). Teste novo falhou antes e passa depois.

### 3. O teste de versão ainda pula os manifests do plugin quando eles faltam
- **Arquivo:** `test/unit/version.test.ts:19`
- **Gravidade:** baixo
- **O que quebra:** se `.claude-plugin/plugin.json` ou `.codex-plugin/plugin.json` sumir, o
  `npm test` passa calado.
- **Como corrigir:** remover a exceção provisória.
- **Evidência:** leitura; o passo 1 da T01 previa isso.
- **Confiança:** alta
- **Contraprova verificada:** nenhum outro teste exige esses arquivos.
- **Classificação:** confirmado
- **Origem:** introduzido
- **Estado:** corrigido: `test/unit/version.test.ts` (exceção removida). Com `.codex-plugin/plugin.json` renomeado, o teste falhou (`×`).

### 4. "Publicar uma versão" quebra por causa do `"0.2.0"` fixo no teste
- **Arquivo:** `test/unit/version.test.ts:13-15`, `README.md:206`
- **Gravidade:** baixo
- **O que quebra:** quem segue o README e sobe para `0.3.0` vê o teste `is 0.2.0` falhar.
- **Como corrigir:** apagar esse caso; a igualdade entre os arquivos basta.
- **Evidência:** leitura.
- **Confiança:** alta
- **Contraprova verificada:** nada atualiza esse literal.
- **Classificação:** confirmado
- **Origem:** introduzido
- **Estado:** corrigido: `test/unit/version.test.ts` (caso `is 0.2.0` removido) e `README.md` ("diferentes de `src/shared/version.ts`"). A subida para 0.2.1 só exigiu os 5 arquivos, e o `npm test` passou.

### 5. Instalação em uma linha pelo `/plugin` não foi verificada
- **Arquivo:** `README.md:45`
- **Gravidade:** baixo
- **O que quebra:** a flag `--marketplace` foi confirmada no CLI
  (`claude plugin install --help`), mas não no comando `/plugin`. Se ele não aceitar, o
  primeiro comando do README falha.
- **Como corrigir:** dar os dois passos do `/plugin` como forma principal e a linha única só
  na forma de terminal (`claude plugin install … --marketplace …`).
- **Evidência:** `claude plugin install --help`.
- **Confiança:** baixa
- **Contraprova verificada:** o C3 testou os dois passos.
- **Classificação:** hipótese
- **Origem:** introduzido
- **Estado:** corrigido: `README.md` (os dois passos do `/plugin` como forma principal; linha única só pelo terminal `claude plugin install … --marketplace …`, confirmada no `--help`).

### 6. Caminho local do autor num documento commitado
- **Arquivo:** `docs/ciclos/2026-11-05-instalacao-ias/verificacao.md:30`
- **Gravidade:** baixo
- **O que quebra:** expõe o nome de usuário local num repositório público.
- **Como corrigir:** trocar por `<repo>`.
- **Evidência:** grep nos arquivos versionados: só este arquivo.
- **Confiança:** alta
- **Contraprova verificada:** o bundle e os manifests estão limpos.
- **Classificação:** confirmado
- **Origem:** introduzido
- **Estado:** corrigido: `docs/ciclos/2026-11-05-instalacao-ias/verificacao.md` (`<repo>/plugin/server.mjs`). `grep -c luizg` dá 0.

### 7. No release, os scripts de instalação rodam com um token de escrita disponível
- **Arquivo:** `.github/workflows/release.yml:8,16`
- **Gravidade:** baixo
- **O que quebra:** o `checkout` grava o token em `.git/config`, e o `npm ci` roda os
  postinstall das dependências com ele ao alcance.
- **Como corrigir:** `persist-credentials: false` e `npm ci --ignore-scripts`.
- **Evidência:** leitura.
- **Confiança:** média
- **Contraprova verificada:** o `gh release create` usa `GH_TOKEN` pelo ambiente.
- **Classificação:** sugestão
- **Origem:** introduzido
- **Estado:** corrigido: `.github/workflows/release.yml` e `ci.yml` (`persist-credentials: false` e `npm ci --ignore-scripts`). Verificado no `ci` do commit desta correção.

### 8. "Retry once" depois de `TIMEOUT` pode repetir uma ação irreversível
- **Arquivo:** `skills/browser/SKILL.md:68`
- **Gravidade:** baixo
- **O que quebra:** o clique pode já ter sido entregue quando o tempo estoura
  (`cdp.ts:88`, `bridge.ts:368`). Repetir um "Enviar" ou "Pagar" faz a ação duas vezes.
- **Como corrigir:** nunca repetir um envio, compra ou exclusão depois de `TIMEOUT`;
  conferir a página e perguntar ao usuário.
- **Evidência:** leitura.
- **Confiança:** média
- **Contraprova verificada:** as regras pedem confirmação antes da ação, mas não falam de
  repetir.
- **Classificação:** sugestão
- **Origem:** introduzido
- **Estado:** corrigido: `skills/browser/SKILL.md` (linha de `TIMEOUT`: nunca repetir envio, compra ou exclusão). Teste novo falhou antes e passa depois.

## Critérios do spec

| Critério | Estado | Evidência (`verificacao.md`) |
|---|---|---|
| C1 | atendido | `Validation passed`, sem avisos |
| C2 | atendido | 79/79; os testes falham quando deveriam |
| C3 | atendido | `plugin:ai-browser-agent:ai-browser … ✔ Connected` |
| C4 | atendido | 10 ferramentas `mcp__ai_browser__*` |
| C5 | atendido | `git archive` sem `node_modules`: 10 ferramentas, servidor 0.2.0 |
| C6 | atendido | Release `v0.2.0` com o `.zip` e manifest 0.2.0; carrega com o ID fixo |
| C7 | atendido | e2e 13/13 |
| C8 | atendido | `560aeb5 completed success` |
| L1 | atendido por leitura | a skill cobre o R8 (melhorada pelos achados 1, 2 e 8) |
| L2 | atendido por leitura | ordem do README |
| L3 | pendente | instalação do zero pelo GitHub, feita pelo usuário |

Sem achado crítico ou alto. Os 8 achados são baratos e são corrigidos numa rodada de FIX.

## Depois do FIX

A versão subiu para **0.2.1** nos 5 arquivos. A mudança não veio de um achado: os hosts
guardam o plugin em cache pela versão, e sem a subida a skill corrigida não chegaria a quem
já instalou a 0.2.0. O bundle foi regenerado e o `npm test` deu 81/81.
