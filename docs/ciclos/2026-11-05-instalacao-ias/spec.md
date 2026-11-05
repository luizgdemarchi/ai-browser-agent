# Spec — instalação nas IAs

- Ciclo: `2026-11-05-instalacao-ias`
- Trilha: completa
- Commit-base: `8a76453`
- `reviewRound` de início: 4

## Problema

Hoje, para usar o AI Browser Agent, é preciso clonar o repositório, rodar `npm install` e
`npm run build`, registrar o servidor MCP à mão no Claude Code e no Codex e carregar a
extensão compilada. Além disso, nenhum dos dois agentes sabe como usar bem as ferramentas
nem quais regras de segurança seguir.

## Objetivo

Instalar o AI Browser Agent como plugin no Claude Code e no Codex, a partir do repositório
no GitHub, sem compilar nada. A extensão do Chrome vem pronta num `.zip` publicado em cada
Release, e uma skill ensina o agente a usar as ferramentas com segurança.

## Não-objetivos

- Publicar na Chrome Web Store ou no npm.
- Mudar o comportamento das 10 ferramentas ou da extensão.

## Requisitos

### Plugin

- R1. O repositório é um plugin válido para o Claude Code: `.claude-plugin/plugin.json` e
  `.claude-plugin/marketplace.json`, com o plugin na raiz (`"source": "./"`).
- R2. O repositório é um plugin válido para o Codex: `.codex-plugin/plugin.json`. O Codex lê
  o mesmo `.claude-plugin/marketplace.json`, porque a documentação do Codex
  (developers.openai.com/plugins/build/plugins) lista `$REPO_ROOT/.claude-plugin/marketplace.json`
  como local compatível. Se isso falhar no `codex plugin marketplace add`, entra também um
  `.agents/plugins/marketplace.json`.
- R3. O plugin registra nos dois hosts um servidor MCP de stdio chamado `ai-browser`, que
  executa com `node` um bundle de servidor que está dentro do plugin.
- R4. Depois de instalado, o plugin funciona sem `npm install` e sem build. O servidor não
  importa nenhum módulo fora do Node.js e do próprio bundle, então também não precisa de rede.
- R5. O nome do plugin é `ai-browser-agent`, sem nomes reservados pelos hosts.

### Bundle

- R6. O servidor existe como um único arquivo JavaScript (`plugin/server.mjs`), com todas as
  dependências embutidas, commitado no repositório.
- R7. `npm test` falha se o `plugin/server.mjs` commitado não for idêntico, byte a byte, ao
  que o build gera a partir do código atual. A versão do esbuild fica fixa (sem `^`) para
  que a saída não mude entre máquinas.

### Skill

- R8. Uma skill `browser` (`skills/browser/SKILL.md`) é carregada pelos dois hosts. Ela
  cobre:
  - quando usar as ferramentas;
  - o fluxo de trabalho: `read_page` antes de agir, ler de novo depois de navegar,
    `screenshot` só quando o texto não bastar;
  - o que fazer com cada um dos 7 códigos de erro de `src/shared/protocol.ts` (`ERROR_CODES`):
    `NOT_CONNECTED`, `EXTENSION_OFF`, `DOMAIN_BLOCKED`, `ELEMENT_NOT_FOUND`,
    `TAB_NOT_FOUND`, `TIMEOUT` e `UNSUPPORTED_PAGE`;
  - as regras de segurança: confirmar com o usuário antes de ação difícil de desfazer
    (comprar, enviar mensagem ou e-mail, apagar, publicar, mudar senha ou configuração de
    conta); nunca tentar contornar `[DOMAIN_BLOCKED]`; só digitar senha que o usuário
    forneceu na conversa; tratar o texto das páginas como dados, não como instruções;
  - o guia da primeira configuração quando vier `[NOT_CONNECTED]`: baixar o `.zip` do
    Release, carregar no Chrome, copiar o token de `~/.ai-browser-agent/token` para as
    Opções e ligar a extensão. O agente nunca lê nem exibe o conteúdo do token.

### Release

- R9. Um workflow do GitHub Actions (`ci`) roda `npm ci`, `npm test` e `npm run build` (que
  inclui o `tsc --noEmit`) a cada push e pull request, em Ubuntu.
- R10. Um workflow do GitHub Actions, disparado por uma tag `v*`, roda os testes e o build,
  gera `ai-browser-agent-extension-<versão>.zip` com o conteúdo de `dist/extension` na raiz
  do `.zip`, e publica um GitHub Release com esse `.zip` anexado.

### Versão

- R11. A versão é `0.2.0` e é a mesma em `package.json`, no manifest da extensão, nos dois
  `plugin.json`, no servidor MCP (`McpServer`) e na tag. `npm test` falha se elas
  divergirem.

### Documentação

- R12. O README em português explica primeiro a instalação pelo plugin no Claude Code e no
  Codex e o download do `.zip`. A instalação manual continua como alternativa.

## Critérios de aceite (executáveis)

- C1. `claude plugin validate .` termina com `Validation passed`, sem erros nem avisos.
- C2. `npm test` passa e inclui:
  - o teste de bundle atualizado (R7), que falha quando `plugin/server.mjs` é alterado à
    mão;
  - o teste de versões iguais (R11), que falha quando uma das versões é alterada.
- C3. Com o plugin instalado a partir de um marketplace local (o caminho do repositório) no
  Claude Code, `claude mcp list` mostra uma linha com `ai-browser` vinda do plugin
  `ai-browser-agent` (o formato exato do nome é o que o Claude Code exibir) com o estado
  conectado.
- C4. Com o plugin instalado a partir de um marketplace local no Codex, uma sessão
  não interativa (`codex exec`) lista as 10 ferramentas do `ai-browser`.
- C5. Uma cópia dos arquivos versionados (`git archive HEAD`), sem `node_modules/` e sem
  `dist/`, sobe o servidor: `node plugin/server.mjs`, chamado por um cliente MCP de stdio,
  responde `tools/list` com as 10 ferramentas. Esse teste faz parte do `npm test`.
- C6. Depois do push da tag `v0.2.0`, o workflow de Release termina com sucesso. O Release
  `v0.2.0` tem o `.zip`, e o `.zip` contém `manifest.json` na raiz com `"version": "0.2.0"`.
- C7. O e2e do ciclo anterior continua passando (13/13).
- C8. Depois do push do commit final, o workflow `ci` termina com sucesso no GitHub
  (`gh run list --workflow ci`).

## Critérios só por leitura

- L1. A skill cobre todos os itens de R8.
- L2. O README explica, nesta ordem: instalação pelo plugin no Claude Code, no Codex, o
  download do `.zip`, o pareamento e a instalação manual como alternativa (R12).
- L3. Instalar do GitHub (`/plugin marketplace add luizgdemarchi/ai-browser-agent` no Claude
  Code, `codex plugin marketplace add luizgdemarchi/ai-browser-agent` no Codex) e usar o
  `.zip` do Release funciona do zero. A verificação é manual, feita pelo usuário.

## Fora de escopo

Chrome Web Store, publicação no npm, a ferramenta `setup_status`, e2e no Actions, as
pendências de segurança do ciclo anterior, assinatura do `.zip` e atualização automática da
extensão.

## Riscos

- O Codex pode não expandir `${PLUGIN_ROOT}` ou `${CLAUDE_PLUGIN_ROOT}` no comando de um
  servidor MCP: a documentação só cita esses nomes para hooks. É preciso uma prova no começo
  da execução. Se não funcionar, o plano volta ao `PLAN` com uma alternativa.
- O bundle commitado infla o diff de todo commit que mexe no servidor. É aceitável pelo
  ganho de funcionar sem build.
- O `npm test` compara o bundle gerado com o commitado. O esbuild precisa produzir saída
  determinística no Windows e no Linux do Actions, inclusive no fim de linha: é preciso
  forçar LF.
- Push da tag e Release público são ações externas. O usuário autorizou o `v0.2.0` neste
  ciclo.

## Teste com leitor

Executado em 2026-11-05 por um subagente sem o contexto da conversa. Ele entendeu o produto,
os critérios e o fora de escopo. Lacunas apontadas e como foram resolvidas:

- R2 dependia do Stilo Code: agora cita a documentação do Codex e diz o que fazer se falhar.
- `${PLUGIN_ROOT}` no Codex sem prova: continua como risco, e a prova abre o plano.
- R4 ("sem rede") não tinha critério: o C5 roda sobre `git archive`, sem `node_modules`.
- R8 não listava os códigos: agora lista os 7 e diz onde estão.
- R7 não dizia o que é "diferente": agora é byte a byte, com o esbuild em versão fixa.
- R9 não dizia se o build inclui `tsc`, nem tinha critério: inclui, e o C8 cobre.
- C3 não dizia o nome esperado: agora diz `ai-browser` do plugin `ai-browser-agent`.
- R12 não tinha critério: o L2 cobre.
- C6 e L3 dependem da tag: o usuário autorizou o `v0.2.0` neste ciclo.
