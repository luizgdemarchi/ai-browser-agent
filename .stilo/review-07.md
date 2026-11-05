# Review 07 — ciclo `2026-11-05-visual-ui`

- Alvo: snapshot da árvore de trabalho sobre o commit-base `a1cb407` (nada commitado no
  ciclo). 15 arquivos modificados (`git diff --stat a1cb407`: 719+, 117−) e 7 novos:
  `plan.md` 45152ea25316, `scripts/gen-icons.mjs` 71c3f190ba62,
  `src/extension/icon-state.ts` 3ab00e9fc65a, `icons/icon-32.png` 0c028014c988,
  `icons/icon-active-16.png` a268f4f09a54, `icons/icon-active-32.png` 22198fe79c72,
  `test/unit/icon-state.test.ts` 73eda5130479 (sha1, 12 primeiros dígitos).
- Cobertura: `src/extension/{icon-state.ts,state.ts,popup.html,popup.ts,options.html,options.ts,ui.css,manifest.json}`,
  `scripts/gen-icons.mjs`, `package.json`, `test/unit/icon-state.test.ts`, `test/e2e/run.mjs`,
  PNGs (prévia ampliada e capturas em `.stilo/logs/capturas/`).
- Exclusões: `plugin/server.mjs` (o build regera, `bundle.test.ts` passa e não aparece no
  `git status`); `dist/` (não versionado).
- Documentos: `spec.md`, `plan.md` e `design.md` do ciclo; módulo `frontend.md`.
- Revisão única, sem subagentes.

## Resumo

- crítico: 0
- alto: 0
- médio: 2
- baixo: 3

## Achados

### 1. Passo e2e do popup passa por vacuidade
- **Arquivo:** `test/e2e/run.mjs:146`
- **Gravidade:** médio
- **O que quebra:** o popup é aberto como aba com viewport de 800 px do puppeteer; o
  `body` tem 300 px. Um elemento de 400 px dentro do popup estoura o popup real, mas
  `documentElement.scrollWidth` (800) continua ≤ `clientWidth` (800) → passo `PASS`.
  O critério A3 (popup sem rolagem horizontal) fica sem prova real.
- **Como corrigir:** no passo, `ui.setViewport({ width: 300, height: 600 })` antes de
  medir (como no passo das opções), restaurando depois; ou comparar
  `document.body.scrollWidth <= 300`.
- **Evidência:** leitura: `run.mjs:146–152` não ajusta viewport; `popup.html` fixa
  `body { width: 300px }`. Prova com elemento largo injetado não executada.
- **Confiança:** alta
- **Contraprova verificada:** nenhum `setViewport` antes do passo (o único está no passo
  "options fit 320 px", depois dele).
- **Classificação:** confirmado
- **Origem:** introduzido
- **Estado:** corrigido: `test/e2e/run.mjs:146` mede com viewport 300 px; quebra proposital (div de 400 px) deu `FAIL popup has no horizontal scroll: Error: popup scrollWidth 400 > clientWidth 300`; revertido, e2e 16 PASS

### 2. Alvos de clique abaixo de 44 px
- **Arquivo:** `src/extension/ui.css:133`, `src/extension/ui.css:147`
- **Gravidade:** médio
- **O que quebra:** botões ("Mostrar", "Salvar token", "Remover", "Adicionar") e campos
  têm `min-height: 36px`; o link de opções do popup, 32 px. O piso de `frontend.md` pede
  44 × 44 px. O plano (T04) fixou 36 px, em desacordo com o piso.
- **Como corrigir:** `min-height: 44px` em `button` e `input`; `#options-link`
  `min-height: 44px`.
- **Evidência:** leitura das regras; capturas `options-760-*.png` mostram botões de ~36 px.
- **Confiança:** alta
- **Contraprova verificada:** nenhuma regra de página sobrescreve para mais.
- **Classificação:** confirmado
- **Origem:** introduzido
- **Estado:** corrigido: `src/extension/ui.css:133`, `:147` e `src/extension/popup.html:134` em 44 px

### 3. Pulso de 600 ms fora da faixa de animação
- **Arquivo:** `src/extension/popup.html:91`
- **Gravidade:** baixo
- **O que quebra:** `animation: no-ar 600ms`; `frontend.md` pede 150–300 ms. Respeita
  `prefers-reduced-motion`.
- **Como corrigir:** 300 ms.
- **Evidência:** leitura.
- **Confiança:** alta
- **Contraprova verificada:** `design.md` § 6 não fixa duração do pulso.
- **Classificação:** confirmado
- **Origem:** introduzido
- **Estado:** corrigido: `src/extension/popup.html:91` em 300 ms

### 4. Espaçamento fora da escala
- **Arquivo:** `src/extension/popup.html:56`
- **Gravidade:** baixo
- **O que quebra:** `#toggle-desc { margin-top: 2px }`; escala é 4, 8, 12…
- **Como corrigir:** `4px`.
- **Evidência:** leitura.
- **Confiança:** alta
- **Contraprova verificada:** nenhuma.
- **Classificação:** confirmado
- **Origem:** introduzido
- **Estado:** corrigido: `src/extension/popup.html:56` em 4 px

### 5. Pílula de status vazia antes do primeiro render nas opções
- **Arquivo:** `src/extension/options.html` (`#pair-status` vazio)
- **Gravidade:** baixo
- **O que quebra:** até `renderStatus()` resolver, a pílula aparece só com o ponto cinza,
  sem texto (estado "carregando" sem palavra). Dura milissegundos.
- **Como corrigir:** texto inicial "Verificando conexão…" em `#pair-status`.
- **Evidência:** leitura; não observado nas capturas (tiradas após 400 ms).
- **Confiança:** média
- **Contraprova verificada:** `init()` chama `renderStatus()` só após `getSettings()`.
- **Classificação:** hipótese
- **Origem:** introduzido
- **Estado:** corrigido: `src/extension/options.html:126` com "Verificando conexão…"

## Critérios do spec

| Critério | Estado | Evidência |
|---|---|---|
| A1 build | atendido | `npm run build` → código 0 |
| A2 unit | atendido | `npm test` → `Tests 85 passed (85)`, inclui `icon-state.test.ts` (4) |
| A3 e2e | atendido após FIX | 16 PASS, 0 FAIL; passo do popup agora mede a 300 px (achado 1) |
| A4 sem URL externa | atendido | grep filtrado sem saída |
| L1 wireframes | atendido | capturas em `.stilo/logs/capturas/` |
| L2 contraste | atendido | pares calculados no `design.md` § 2 |
| L3 teclado | atendido | Tab nas opções: token > toggle-token > port > save-token > Remover ×2 > new-domain > add-domain; popup: toggle > options-link |
| L4 ícone 16 px | parcial | prévia ampliada ok; não conferido na barra real do Chrome (usuário) |

Plano: T01–T07 feitos; nada fora do plano além de `list.hidden` em `options.ts` (evita a
borda da lista vazia, cobre R10).
