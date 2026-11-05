# Plano — visual da interface

- Ciclo: `2026-11-05-visual-ui`
- Spec: `docs/ciclos/2026-11-05-visual-ui/spec.md` (com `design.md` do mesmo ciclo)
- Commit-base: `a1cb407`
- Tecnologia: Node 24, TypeScript 5, esbuild 0.28.2, vitest 5, puppeteer 25 (Chrome for
  Testing). Extensão MV3.

Todos os caminhos são relativos a `ai-browser-agent/`. Tokens, textos e wireframes vêm do
`design.md`; este plano não os repete.

## Decisões fechadas

- D1. **Estado do ícone numa função pura:** `src/extension/icon-state.ts` exporta
  `iconState(enabled: boolean, connected: boolean): IconState`, com
  `IconState = { variant: "padrao" | "ativo"; badgeText: string; badgeColor: string | null; badgeTextColor: string | null; title: string }`.
  Valores exatamente os da tabela do R13 (cores `"#C0392B"` e `"#FFFFFF"` só no caso `!`;
  `null` com badge limpo). O arquivo não usa `chrome`, para rodar no vitest.
- D2. **`updateBadge()` em `state.ts`** passa a chamar `iconState` e aplica:
  `chrome.action.setIcon({ path: ICON_PATHS[variant] })`, `setBadgeText`,
  `setBadgeBackgroundColor`/`setBadgeTextColor` só quando a cor não é `null`, e
  `chrome.action.setTitle({ title })`. `ICON_PATHS` fica em `state.ts`:
  `padrao: { 16: "icons/icon-16.png", 32: "icons/icon-32.png" }`,
  `ativo: { 16: "icons/icon-active-16.png", 32: "icons/icon-active-32.png" }`.
- D3. **Ícones pré-renderizados**, não canvas em tempo de execução. Fonte em
  `scripts/gen-icons.mjs`: desenha os SVGs do `design.md` § 3 (versão simplificada para
  16 px; demais tamanhos com os três pontos), renderiza com puppeteer
  (`page.screenshot({ omitBackground: true })`) e grava em `src/extension/icons/`:
  `icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png`, `icon-active-16.png`,
  `icon-active-32.png`. Os PNGs são commitados; o script só roda à mão
  (`npm run gen-icons`). O `build.mjs` já copia a pasta `icons/`.
- D4. **Manifesto:** `icons` e `action.default_icon` passam a listar 16, 32, 48 e 128.
- D5. **CSS:** tokens e componentes comuns (`.header`, `.card`, `.pill`, `.btn-primary`,
  campos, foco) em `src/extension/ui.css`; o que é só do popup ou só das opções fica no
  `<style>` de cada HTML, como hoje. Nenhum `@import` nem `url()` externo.
- D6. **Interruptor:** continua um único `<button id="toggle" aria-pressed>`. Dentro dele:
  `#toggle-title`, `#toggle-desc` e `<span class="switch" aria-hidden="true">`. O
  `#toggle-action` sai. A animação de pulso é a classe `.pulse`, adicionada em `popup.ts`
  só quando o clique liga, removida no `animationend`; `@media (prefers-reduced-motion:
  reduce)` zera transição e animação.
- D7. **Versão no cabeçalho:** `<span id="version">` preenchido em `popup.ts` e
  `options.ts` com `"v" + chrome.runtime.getManifest().version`.
- D8. **Ícones de interface** (engrenagem do rodapé, nada mais) em SVG inline com
  `aria-hidden="true"`. Logo do cabeçalho: `<img src="icons/icon-48.png" alt="" width="24" height="24">`.
- D9. **Token:** `#token` vira `type="password"`; botão `<button type="button" id="toggle-token" aria-pressed="false" aria-controls="token">Mostrar</button>`
  alterna `type` e o texto Mostrar/Ocultar.
- D10. **Seletores do e2e** (R15) ficam com os mesmos ids e papéis. Os textos de status
  em `popup.ts` e `options.ts` não mudam.

## Tarefas

Lógica nova (T01) segue TDD. As tarefas de interface são verificadas por build, e2e e
capturas.

### Tarefa T01 — estado do ícone, teste primeiro
ID: T01
Especialista: lógica de extensão
Files:
- Create: test/unit/icon-state.test.ts
- Create: src/extension/icon-state.ts
Depends-on: nenhum
Resources: nenhum

1. Criar `test/unit/icon-state.test.ts` com `it.each` sobre as quatro combinações
   (`false,false`, `false,true`, `true,true`, `true,false`), esperando o objeto completo
   da D1 com os textos da tabela do R13.
2. `npx vitest run test/unit/icon-state.test.ts` → falha por módulo inexistente.
3. Criar `src/extension/icon-state.ts` (D1).
4. `npx vitest run test/unit/icon-state.test.ts` → 4 testes passam.

Classificação: lógica comum. Modelo: o da sessão; esforço médio.

### Tarefa T02 — ícones
ID: T02
Especialista: interface
Files:
- Create: scripts/gen-icons.mjs
- Modify: package.json (script `"gen-icons": "node scripts/gen-icons.mjs"`)
- Modify: src/extension/icons/icon-16.png, icon-48.png, icon-128.png
- Create: src/extension/icons/icon-32.png, icon-active-16.png, icon-active-32.png
- Modify: src/extension/manifest.json (D4)
Depends-on: nenhum
Resources: profile:navegador

1. Escrever `scripts/gen-icons.mjs` (D3).
2. `npm run gen-icons` → 6 PNGs gravados; conferir as dimensões com
   `node -e` lendo largura/altura do cabeçalho PNG (bytes 16–23): 16, 32, 48, 128, 16, 32.
3. Abrir os PNGs com a ferramenta de leitura de imagem e conferir legibilidade (L4,
   preliminar).
4. Atualizar o manifesto (D4).

Classificação: edição verificável com julgamento visual. Esforço médio.

### Tarefa T03 — aplicar o estado na barra
ID: T03
Especialista: lógica de extensão
Files:
- Modify: src/extension/state.ts
Depends-on: T01, T02
Resources: nenhum

1. Reescrever `updateBadge()` (D2) e atualizar o comentário que cita o R19 para citar o
   R13 deste ciclo.
2. `npm run build` → código 0, sem erro de `tsc`.

### Tarefa T04 — CSS comum
ID: T04
Especialista: interface
Files:
- Modify: src/extension/ui.css
Depends-on: nenhum
Resources: nenhum

1. Reescrever com os tokens do `design.md` § 2 (claro em `:root`, escuro em
   `@media (prefers-color-scheme: dark)`), tipografia, escala de espaçamento, foco visível
   (`outline: 2px solid var(--texto)`, offset 2 px), campos com borda `--texto-2`,
   `.btn-primary` (fundo `--ambar`, texto `#1e2225`), botão secundário, `.card`, `.pill`
   com `.dot`/`.dot.ok`/`.dot.erro`, `.header`, `.mono`, `.muted`, `.erro-texto`.
   Alvos de clique com altura mínima de 44 px (corrigido no review-07; o plano dizia 36 px).
2. Verificação na T07.

### Tarefa T05 — popup
ID: T05
Especialista: interface
Files:
- Modify: src/extension/popup.html
- Modify: src/extension/popup.ts
Depends-on: T04
Resources: nenhum

1. HTML no wireframe do `design.md` § 3: cabeçalho (D7, D8), cartão-interruptor (D6),
   pílula com `#dot` e `#connection`, cartão "Última ação" com `#last-action-tool`,
   `#last-action-target` (mono) e `#last-action-time`, ou o texto vazio do § 7; rodapé com
   `#options-link` e a engrenagem. Largura 300 px.
2. `popup.ts`: preencher `#version`; trocar título e descrição pelo § 7; montar a última
   ação em duas linhas sem ponto médio; pulso (D6). Textos de `#connection` inalterados.
3. `npm run build` → código 0.

### Tarefa T06 — opções
ID: T06
Especialista: interface
Files:
- Modify: src/extension/options.html
- Modify: src/extension/options.ts
Depends-on: T04
Resources: nenhum

1. HTML no wireframe do `design.md` § 3: cabeçalho, duas `<section class="card">`,
   rótulos acima dos campos, `#token` + `#toggle-token` (D9) na mesma linha, `#port`,
   `#save-token` como `.btn-primary`, status ao lado; lista e formulário de domínios com
   `#add-domain` como `.btn-primary` e "Remover" secundário. Abaixo de 400 px, linha
   campo + botão em coluna, botão em largura total.
2. `options.ts`: `#version` (D7) e o alternador do token (D9).
3. `npm run build` → código 0.

### Tarefa T07 — e2e e verificação final
ID: T07
Especialista: testes
Files:
- Modify: test/e2e/run.mjs
Depends-on: T03, T05, T06
Resources: port:127.0.0.1:18765, port:127.0.0.1:18080, profile:navegador, dir:.e2e-tmp

1. Adicionar ao e2e, depois do passo "pair and turn on through the UI":
   - "options fit 320 px": `ui.setViewport({ width: 320, height: 800 })`, abrir
     `options.html`, conferir `document.documentElement.scrollWidth <= 320`, restaurar o
     viewport anterior;
   - "popup has no horizontal scroll": abrir `popup.html`, conferir
     `document.documentElement.scrollWidth <= document.documentElement.clientWidth`;
   - "token show/hide": em `options.html`, `#token` tem `type` `password`; clicar
     `#toggle-token` → `text`; clicar de novo → `password`.
2. `npm run build` → código 0 (A1).
3. `npm test` → todos passam, inclusive `icon-state.test.ts` (A2).
4. `npm run e2e` → todas as linhas `PASS`, nenhuma `FAIL` (A3). Log completo em
   `.stilo/logs/e2e.log`.
5. `grep -rE "https?://" dist/extension/*.html dist/extension/*.css | grep -v "www.w3.org/2000/svg"`
   → sem saída (A4).
6. Capturas para L1–L4 com puppeteer (popup nos três estados, opções claro e escuro via
   `page.emulateMediaFeatures`), gravadas em `.stilo/logs/capturas/`, e conferência de
   teclado (L3) percorrendo com `Tab`.

## Ondas

- Onda 1: T01, T02, T04 (arquivos disjuntos; T02 é a única com navegador).
- Onda 2: T03, T05, T06 (T03 depende de T01 e T02; T05 e T06 só de T04; arquivos
  disjuntos).
- Onda 3: T07.

Sem subagentes, rodam em série nesta ordem.

## Cobertura do spec

| Requisito | Tarefa |
|---|---|
| R1–R5 | T05 |
| R6–R11 | T06 (R11 verificado na T07) |
| R12 | T02 |
| R13, R14 | T01, T03 |
| R15 | T05, T06, T07 |
| R16 | T04, T05 |
| R17 | T04, T05, T06, verificado na T07 |

## Foco da revisão

- T03: `setIcon` com caminho errado falha em silêncio no service worker; conferir que os
  6 PNGs existem em `dist/extension/icons/` e que as chaves de `ICON_PATHS` batem com eles.
- T05: `#toggle` precisa continuar sendo o botão inteiro, com `aria-pressed`, e o
  interruptor visual não pode ser outro controle focável.
- T06: `type="password"` no `#token` não pode quebrar o `ui.type("#token", …)` do e2e;
  o alternador não pode enviar o formulário (`type="button"`).
- T04: contraste do foco e das bordas de campo nos dois temas.
