# Verificação — instalação nas IAs

Árvore: `3535cd2`, a mesma que está no GitHub.

## C1 — `claude plugin validate .`

```
✔ These checks found nothing to report
✔ Validation passed
```

Na primeira validação veio o aviso `ICON_MISSING`; ele foi resolvido com
`.claude-plugin/icon.png` (512 px). Esse arquivo não estava listado na T03.

## C2 — `npm test`

`Tests  79 passed (79)`. Os testes de bundle e de versão já mostraram que falham quando a
lógica quebra:

- `echo "// editado à mão" >> plugin/server.mjs` →
  `AssertionError: plugin/server.mjs is out of date: run "npm run build" and commit it`;
- com o `package.json` e o manifest ainda em `0.1.0`, falharam 2 testes de versão.

## C3 — Claude Code 2.1.318, marketplace local

```
claude plugin marketplace add <repo>      ✔ Successfully added marketplace: ai-browser-agent
claude plugin install ai-browser-agent@ai-browser-agent   ✔ Successfully installed plugin
claude mcp list
plugin:ai-browser-agent:ai-browser: node C:/Users/luizg/.../ai-browser-agent/plugin/server.mjs - ✔ Connected
claude plugin details ai-browser-agent@ai-browser-agent
  Skills (1)  browser
  MCP servers (1)  ai-browser
  Always-on:   ~103 tok
```

Depois da verificação: `claude plugin uninstall` e `claude plugin marketplace remove`. O
`claude mcp list` voltou a não ter nenhum `ai-browser`.

## C4 — Codex CLI 0.166.0, marketplace local, `CODEX_HOME` temporário

```
codex plugin marketplace add <repo>       Added marketplace `ai-browser-agent`
codex plugin add ai-browser-agent@ai-browser-agent   Added plugin `ai-browser-agent`
codex mcp list
ai-browser  node  plugin/server.mjs  -  <CODEX_HOME>\plugins\cache\ai-browser-agent\ai-browser-agent\0.2.0\.  enabled
codex exec ... < /dev/null
mcp__ai_browser__click, close_tab, fill_form, list_tabs, navigate, new_tab,
read_page, screenshot, switch_tab, type   (10)
```

A skill foi instalada no cache (`skills/browser/SKILL.md`). A cópia do `auth.json` e o
`CODEX_HOME` temporário foram apagados, e a configuração real do Codex não tem o
marketplace.

## C5 — `git archive HEAD`, sem `node_modules`

```
no node_modules
10 read_page,click,type,fill_form,navigate,list_tabs,switch_tab,new_tab,close_tab,screenshot
server ai-browser-agent 0.2.0
```

## C7 — e2e: pendente por falta de memória na máquina

Quatro rodadas seguidas falharam, e cada uma num ponto diferente:

| Rodada | Resultado |
|---|---|
| 1 | `FAIL setup: ProtocolError: Network.enable timed out` |
| 2 | 11 PASS; `new_tab` → `[TIMEOUT] The page did not finish loading in 30 s.`, e `close_tab` em cascata |
| 3 | `FAIL setup: ProtocolError: Network.enable timed out` |
| 4 | 11 PASS; `C4 redirect` → `[TIMEOUT]`, `C4 extension off` → `[NOT_CONNECTED]` |

Diagnóstico:

- RAM livre de 486 a 487 MB de 3767 MB. `Memory Compression` era o processo com mais CPU, e
  o Chrome do usuário tinha 20 processos e 845 MB.
- Provas isoladas na mesma árvore passaram: Chrome for Testing com e sem a extensão, com o
  perfil dentro do projeto, e esperando o service worker antes de abrir 3 abas. Mas a
  abertura do Chrome passou de 2,8 s para 12 a 15 s em poucos minutos.
- Desde a última rodada verde (`8a76453`, 13/13), o código da extensão e o do e2e não
  mudaram: só `version` no manifest e fim de linha. O puppeteer continua 25.16.0 e o Chrome
  for Testing continua 156.0.8078.47.

Falta rodar o e2e de novo com memória livre.
