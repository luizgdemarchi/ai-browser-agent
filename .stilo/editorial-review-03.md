# Revisão editorial 03

- Modo: incremental, os textos alterados no ciclo `2026-11-05-instalacao-ias`
- Commit-base: `8a76453`. Revisado: `5a12b47`
- Público: no README, quem instala o plugin; na `SKILL.md`, o agente.
- Cobertura: `README.md` (as seções novas e as alteradas) e `skills/browser/SKILL.md`
- Exclusões: código, mensagens de erro, `.stilo/` e documentos do ciclo

## Resumo

| Gravidade | Achados |
|---|---|
| crítico | 0 |
| alto | 0 |
| médio | 1 |
| baixo | 0 |

## Achados

### 1. Versões mínimas afirmadas sem teste
- **Arquivo:** `README.md` (Requisitos)
- **Trecho:** "Node.js 20 ou mais novo" / "Claude Code 2.1.275 ou mais novo, ou Codex CLI 0.166
  ou mais novo"
- **Contexto e efeito:** a verificação só usou Node 24, Claude Code 2.1.318 e Codex 0.166.0.
  Um piso que ninguém testou passa uma garantia falsa a quem tem uma versão no meio. O
  revisor técnico do review-05 também registrou isso como não verificado.
- **Gravidade:** médio
- **Confiança:** alta
- **Correção mínima:** dizer com que versões foi testado, em vez de afirmar um piso.
- **Estado:** corrigido: `README.md`, em Requisitos ("testado com Node 24", "testado com
  Claude Code 2.1.318 e Codex CLI 0.166.0")

A `SKILL.md` foi lida inteira: sem achados. As instruções são diretas, cada regra tem a
ação esperada e não há afirmação que o código desminta.
