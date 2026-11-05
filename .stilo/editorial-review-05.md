# Revisão editorial 05 — ciclo `2026-11-05-visual-ui`

- Modo: incremental.
- Commit-base: `a1cb407`; snapshot da árvore de trabalho após o review-09.
- Objetivo e público: textos da interface (usuário de Claude Code/Codex) e documentos do
  ciclo (quem mantém o projeto).
- Cobertura: strings visíveis de `popup.html`, `popup.ts`, `options.html`, `options.ts`,
  `icon-state.ts`; comentários novos em `state.ts`, `icon-state.ts`, `gen-icons.mjs`,
  `test/e2e/run.mjs`; `spec.md`, `design.md`, `plan.md` do ciclo.
- Exclusões: reviews (histórico), PNGs, `package.json`, `manifest.json`, código.
- Limitações: nenhuma.

## Resumo

- crítico: 0
- alto: 0
- médio: 0
- baixo: 2

## Achados

### 1. Documento inconsistente com a correção aplicada
- **Arquivo:** `docs/ciclos/2026-11-05-visual-ui/plan.md:119`
- **Trecho:** "Alvos de clique com altura mínima de 36 px nos botões das opções e 44 px no cartão."
- **Contexto e efeito:** o review-07 (achado 2) subiu botões e campos para 44 px; quem ler
  o plano depois acha que 36 px é a decisão vigente.
- **Gravidade:** baixo
- **Confiança:** alta
- **Correção mínima:** "Alvos de clique com altura mínima de 44 px (corrigido no review-07; o plano dizia 36 px)."
- **Estado:** corrigido: `docs/ciclos/2026-11-05-visual-ui/plan.md:119`

### 2. Metáfora que não sustenta a conclusão
- **Arquivo:** `docs/ciclos/2026-11-05-visual-ui/design.md:14`
- **Trecho:** "da luz \"no ar\" de estúdio e do volante de autoescola com pedal duplo: um indicador inequívoco de quem está dirigindo."
- **Contexto e efeito:** o pedal duplo não é indicador; a frase junta duas imagens e a
  conclusão só vale para a primeira.
- **Gravidade:** baixo
- **Confiança:** média
- **Correção mínima:** "O mundo do assunto é o da luz \"no ar\" de estúdio: um indicador inequívoco de quem está com o controle."
- **Estado:** corrigido: `docs/ciclos/2026-11-05-visual-ui/design.md:14`
