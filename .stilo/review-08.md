# Review 08 — ciclo `2026-11-05-visual-ui`

- Alvo: snapshot da árvore de trabalho sobre `a1cb407`, depois do FIX do review-07
  (`git diff --stat`: 13 arquivos rastreados, 441+, 118−, mais os 7 novos do review-07).
- Cobertura: correções do review-07 (`ui.css:133,147`, `popup.html:56,91,134`,
  `options.html:126`, `test/e2e/run.mjs:146–160`) e releitura de `popup.html`/`popup.ts`
  e `options.html`/`options.ts` pelo piso de `frontend.md` (quatro estados, teclado).
- Exclusões: as mesmas do review-07.
- Documentos: `spec.md`, `plan.md`, `design.md` do ciclo; `frontend.md`.
- Verificação na árvore atual: `npm run build` → 0; `npm test` → `Tests 85 passed (85)`;
  `npm run e2e` → 16 PASS, 0 FAIL; ordem de Tab inalterada; capturas refeitas.

## Resumo

- crítico: 0
- alto: 0
- médio: 0
- baixo: 1

## Achados

### 1. Popup diz "Desligada" enquanto carrega
- **Arquivo:** `src/extension/popup.html:160`
- **Gravidade:** baixo
- **O que quebra:** com a IA ligada e conectada, até `render()` resolver, a pílula mostra
  "Desligada" com ponto cinza: estado de carregamento com texto errado. Mesmo caso do
  achado 5 do review-07, que foi corrigido só nas opções.
- **Como corrigir:** texto inicial "Verificando conexão…".
- **Evidência:** leitura; `render()` só roda após `getSettings()`/`getSession()`.
- **Confiança:** média
- **Contraprova verificada:** o e2e espera `#connection` = "Conectada ao servidor" com
  `waitForFunction`, então o texto inicial não afeta o teste.
- **Classificação:** hipótese
- **Origem:** preexistente (`a1cb407:src/extension/popup.html:53`)
- **Estado:** corrigido: `src/extension/popup.html:160` com "Verificando conexão…"; build 0, 85/85, e2e 16 PASS

## Critérios do spec

| Critério | Estado | Evidência |
|---|---|---|
| A1 | atendido | build 0 |
| A2 | atendido | 85/85 |
| A3 | atendido | 16 PASS; passo do popup prova falha com estouro (review-07, achado 1) |
| A4 | atendido | grep filtrado sem saída |
| L1–L3 | atendido | capturas e ordem de Tab |
| L4 | parcial | falta conferir na barra real do Chrome (usuário) |

Achados do review-07: 5 de 5 `corrigido`.
