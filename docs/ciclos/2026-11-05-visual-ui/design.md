# Design — visual da interface

Ciclo `2026-11-05-visual-ui`. Aprovado junto com `spec.md`.

## 1. Brief

- Assunto: entregar o volante do seu Chrome, logado e real, a uma IA, e poder tomá-lo de
  volta a qualquer momento.
- Público: quem usa Claude Code ou Codex no dia a dia; técnico, mas abre o popup só para
  conferir "ela está no controle?" e desligar.
- Função principal: dizer num relance se a IA tem controle e se está conectada, e
  ligar/desligar com um clique.

O mundo do assunto é o da luz "no ar" de estúdio: um indicador inequívoco de quem está
com o controle. Daí o âmbar como cor de "IA com controle",
que já é a cor atual do projeto.

## 2. Tokens

Cores (claro / escuro):

| Nome | Claro | Escuro | Papel |
|---|---|---|---|
| `--fundo` | `#f4f5f2` | `#16191b` | fundo da página |
| `--superficie` | `#ffffff` | `#1f2326` | cartões e campos |
| `--texto` | `#1e2225` | `#e6e8e3` | texto principal |
| `--texto-2` | `#5b6368` | `#9aa2a7` | descrições, rótulos secundários |
| `--borda` | `#c9cdc8` | `#3a4045` | contorno de cartão; campo usa `--texto-2` (≥ 3:1) |
| `--ambar` | `#e8a317` | `#e8a317` | IA com controle, ação primária (texto `#1e2225` sobre ele) |
| `--ok` | `#2e8b57` | `#3fb27a` | conectada |
| `--erro` | `#c0392b` | `#f07a6e` | sem conexão, token recusado, erro de campo |

Contrastes calculados (WCAG): `--texto-2` sobre `--superficie` 6.1:1 (claro) e 6.1:1
(escuro), sobre `--fundo` 5.6:1 e 6.8:1; `#1e2225` sobre `--ambar` 7.4:1; `--erro` sobre `--fundo` 5.0:1 (claro) e
6.5:1 (escuro); `--texto-2` como borda de campo ≥ 3:1 nos dois temas. `--borda` fica
abaixo de 3:1 de propósito: só contorna cartão, sem significado.

A versão `v0.2.1` nos wireframes é exemplo; a interface lê a do manifesto.

Tipografia:

- Interface: `system-ui` (Segoe UI Variable no Windows). Título do cabeçalho 15 px/600;
  título de cartão ou seção 15 px/600; corpo 13 px/400; descrição 12 px/400 em `--texto-2`.
- Dados: `ui-monospace, "Cascadia Mono", Consolas` 12 px, só para token, porta, domínio e
  alvo da última ação. Nunca em rótulos.
- Linhas de descrição limitadas a ~70 caracteres (`max-width: 60ch`).

Espaçamento: escala 4, 8, 12, 16, 24, 32. Raio: 10 px nos cartões, 8 px em campos e
botões, pílula 999 px.

## 3. Layout

### Popup (300 px, alinhado à esquerda; vê-se primeiro o cartão de controle)

```
┌──────────────────────────────────┐
│ [ícone] AI Browser Agent   v0.2.1│  cabeçalho
├──────────────────────────────────┤
│ ┌──────────────────────────────┐ │
│ │ IA com controle      [══●]   │ │  cartão-interruptor (âmbar quando ligado)
│ │ A IA pode usar este Chrome.  │ │
│ └──────────────────────────────┘ │
│ (● Conectada ao servidor)        │  pílula de status
│ ┌──────────────────────────────┐ │
│ │ Última ação                  │ │  cartão neutro
│ │ click  #login                │ │
│ │ há 2 min                     │ │
│ └──────────────────────────────┘ │
│ ⚙ Opções e pareamento            │  rodapé
└──────────────────────────────────┘
```

Desligado: cartão neutro, título "IA sem controle", descrição "Clique para a IA poder usar este
Chrome.", interruptor à esquerda.

### Opções (coluna de até 600 px, centrada na página, conteúdo alinhado à esquerda)

```
[ícone] AI Browser Agent                         v0.2.1

┌─ Pareamento ─────────────────────────────────────────┐
│ Rode o Claude Code ou o Codex com o MCP... cole aqui. │
│ Token                                                 │
│ [•••••••••••••••••••••••••••••••••] [Mostrar]         │
│ Porta                                                 │
│ [8765  ]                                              │
│ [Salvar token]   (● Pareada e conectada.)             │
└───────────────────────────────────────────────────────┘

┌─ Domínios bloqueados ────────────────────────────────┐
│ A IA nunca lê, clica nem tira print nestes domínios.  │
│ bb.com.br                                  [Remover]  │
│ itau.com.br                                [Remover]  │
│ [novo domínio, ex.: bb.com.br        ] [Adicionar]    │
└───────────────────────────────────────────────────────┘
```

Rótulos ficam acima dos campos (não ao lado), o que resolve 320 px sem reorganizar.
Abaixo de 400 px, a linha "campo + botão" quebra e o botão ocupa a largura toda.

### Ícone

Quadrado de cantos arredondados em grafite `#1e2225`; dentro, a moldura de uma janela de
navegador (barra superior com três pontos) em `#e6e8e3`, e um cursor de seta âmbar
cruzando a borda inferior direita. A 16 px: sem os três pontos, moldura de 1 px e cursor
maior, proporcionalmente.

Variante "IA com controle": o mesmo ícone com um círculo âmbar cheio no canto superior
direito, com contorno de 1 px na cor do fundo para separar do desenho.

## 4. Princípios

1. Âmbar significa uma coisa só: a IA tem o controle (ou a ação primária que leva a isso).
   Nada decorativo usa âmbar.
2. Estado sempre em palavras, além da cor: pílula, título do cartão, tooltip do ícone.
3. Dado é monoespaçado; interface não.
4. Só dois tipos de cartão: o interruptor (que muda de cor) e o neutro (borda `--borda`,
   sem sombra).
5. Um botão primário por seção.

## 5. Revisão contra o brief

Padrões considerados:

- Kit de cartões: o usuário escolheu cartões. Mitigado: só dois tipos, sem sombra, sem
  gradiente; a página de opções usa seções com borda, não cartões dentro de cartões.
- Rótulo em caixa alta sobre título: o rascunho tinha "ÚLTIMA AÇÃO"; trocado por caixa
  normal em `--texto-2`.
- Seta no fim do link: o rascunho tinha "→" em "Opções e pareamento"; trocado por ícone de
  engrenagem antes do texto, que diz para onde leva.
- Monoespaçada em rótulos pequenos: evitada; mono só em dados (princípio 3).
- Metadados com ponto médio: "click #login · há 2 min" vira duas linhas.
- Fundo quase preto com acento neon único: o tema escuro existe por `prefers-color-scheme`,
  mas o âmbar já era a cor do projeto e tem papel semântico, não de enfeite.

## 6. Ousadia em um ponto

O cartão-interruptor. Ligado, ele fica âmbar e o botão do interruptor desliza para a
direita (200 ms); ao ligar, um anel âmbar pulsa uma vez em volta do cartão, como a luz "no
ar" acendendo. Esse é o único momento animado, disparado pelo clique e desligado com
`prefers-reduced-motion: reduce`. O resto da interface é quieta.

## 7. Microcopy

- Ligado: título "IA com controle", descrição "A IA pode usar este Chrome. Clique para
  desligar."
- Desligado: título "IA sem controle", descrição "Clique para a IA poder usar este
  Chrome."
- Última ação vazia: "Nenhuma ação ainda. Peça algo à IA no Claude Code ou no Codex."
- Botão de visibilidade do token: "Mostrar" / "Ocultar".
- Mensagens de status atuais do popup e das opções ficam como estão (o e2e confere uma
  delas, e já dizem o que houve e como resolver).
