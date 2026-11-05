# Review 04

- Ciclo: `2026-11-05-extensao-base`
- Alvo: `git diff 80ad92a..b87537b -- src test` (as correções do review-03)
- Lente: revisão única feita pelo coordenador, sem subagente, porque o diff é pequeno (140
  linhas)
- Cobertura: `src/extension/actions.ts` e `cdp.ts`, `src/server/bridge.ts`,
  `src/shared/blocklist.ts` e `url.ts`, os testes e as fixtures
- Documentos: `spec.md` e `review-03.md`
- Verificação na árvore `b87537b`: `npx vitest run`: 53/53; `npm run e2e`: 13/13 PASS; build
  com exit 0

## Resumo

| Gravidade | Achados |
|---|---|
| crítico | 0 |
| alto | 0 |
| médio | 0 |
| baixo | 1 |

O que foi conferido sem gerar achado:

- `asAgent` decrementa o contador em `finally`, inclusive em erro, e a janela de 1 s depois
  da ação é intencional, para diálogos abertos logo depois do evento.
- `normalizeDomain` com `new URL`: uma entrada com espaço lança exceção e vira `""`; `*` vira
  `""`. Os testes de porta, curinga, IDN e IP passam.
- `normalizeUrl`: `about:blank` é a única exceção fora de `http(s)`, e `new_tab` sem URL não
  passa por ele.
- `connectedWithin`: o `setInterval` é limpo no `finally`.

## Achados

### 1. `beforeunload` em aba onde o debugger nunca foi anexado ainda trava o `navigate`
- **Arquivo:** `src/extension/actions.ts` (`navigate`), `src/extension/cdp.ts`
  (`Page.enable` só no `ensureAttached`)
- **Gravidade:** baixo
- **O que quebra:** num `navigate` saindo de uma página com aviso de "alterações não
  salvas", numa aba em que a IA nunca clicou nem digitou, o diálogo aparece para o usuário.
  Se ninguém responder, o `navigate` devolve `[TIMEOUT]` depois de 30 s.
- **Como corrigir:** chamar `ensureAttached` antes de navegar numa aba que já está carregada,
  ou documentar o comportamento.
- **Evidência:** por leitura. O `Page.enable` só roda em `ensureAttached`, que o `navigate`
  não chama.
- **Confiança:** média
- **Contraprova verificada:** se o diálogo aparece, o usuário decide; nada é aceito em nome
  dele.
- **Classificação:** hipótese
- **Origem:** preexistente
- **Estado:** aberto: fica para o próximo ciclo; o comportamento é seguro, porque o usuário
  decide.

## Achados abertos de rodadas anteriores

- review-01 #5 (médio): autenticação mútua entre a extensão e o servidor
- review-03 #1 (baixo): limite de bytes antes da autenticação
- review-03 #7 (baixo): redirect por JS depois do carregamento

## Critérios do spec

| Critério | Estado | Evidência |
|---|---|---|
| C1 | atendido | 53/53 |
| C2 | atendido | build com exit 0 |
| C3 a C6 | atendidos | e2e 13/13 PASS |
| L1 | pendente | verificação manual do usuário |
| L2 | atendido por leitura | |

Sem achado crítico nem alto, o loop técnico termina. Próxima fase: `EDITORIAL_REVIEW`.
