# Design — popup e opções

## 1. Brief

- Assunto: um interruptor que dá a um agente externo o controle do navegador real.
- Público: o próprio usuário, desenvolvedor, que usa Claude Code e Codex no terminal.
- Função principal: saber de relance se a IA pode mexer no navegador agora, e cortar isso
  com um clique.

O mundo do assunto é o de um painel de controle de máquina: chave geral, luz de estado,
etiqueta de aviso. A interface empresta isso, sem imitar textura de metal.

## 2. Tokens

| Nome | Hex | Papel |
|---|---|---|
| `papel` | `#F4F5F2` | fundo |
| `grafite` | `#1E2225` | texto |
| `cinza` | `#6B7378` | texto secundário, estado desligado |
| `ativo` | `#E8A317` | ligado: a IA tem controle (âmbar de máquina em operação) |
| `ok` | `#2E8B57` | conectado ao servidor |
| `erro` | `#C0392B` | desconectado, erro de pareamento |

Modo escuro: `papel` `#16191B`, `grafite` `#E6E8E3`, `cinza` `#8E979C`. Os acentos são os
mesmos.

Tipografia: a fonte do sistema (`system-ui`) para tudo, porque é a mais rápida de carregar
num popup e combina com o Chrome. Os dados (token, porta, domínios) usam `ui-monospace`,
porque são copiados e colados.

- Título do estado: 18 px, peso 600
- Corpo: 13 px, peso 400
- Dado: 12 px mono

## 3. Layout

**Popup (280 px de largura).** Lê-se primeiro a chave geral, que ocupa a largura toda.
Alinhamento à esquerda.

```
┌──────────────────────────────┐
│ ███████████████████████████  │  ← chave geral (botão grande)
│  IA com controle    [ligada] │     âmbar quando ligada, cinza quando desligada
│ ███████████████████████████  │
│ ● Conectada ao servidor      │  ← luz de estado: verde, vermelha ou cinza
│ Última ação: click #12 · 4 s │
│                              │
│ Opções e pareamento          │  ← link
└──────────────────────────────┘
```

**Opções (página inteira, coluna de 560 px).** Lê-se primeiro o pareamento, porque sem ele
nada funciona.

```
Pareamento
  Token  [______________________] [Salvar token]
  Porta  [8765]
  ● Pareada / ● Token recusado pelo servidor

Domínios bloqueados
  A IA nunca lê, clica nem tira print nestes domínios e nos subdomínios deles.
  [bb.com.br                 ] [Remover]
  [gov.br                    ] [Remover]
  [novo domínio...           ] [Adicionar]
```

## 4. Princípios

1. Quando ligada, a chave geral fica sempre âmbar. Âmbar significa uma coisa só: a IA pode
   agir agora.
2. Cor de estado sempre vem acompanhada de texto, nunca sozinha.
3. A última ação aparece no popup, para o usuário ver o que a IA acabou de fazer.
4. Nada de enfeite: sem cartões, sem ícones decorativos, sem sombra.

## 5. Revisão contra o brief

O meu padrão seria um popup com cartões arredondados, um toggle pequeno estilo iOS e um
acento azul. Troquei por:

- uma chave geral grande que ocupa a largura toda: a ação principal é ligar e desligar, e
  um toggle pequeno esconde isso;
- âmbar, em vez de azul, para "ligado": azul não carrega aviso, e âmbar é a luz de máquina
  em operação.

Padrões considerados e evitados: kit de cartões, fundo quase preto com acento neon e rótulo
em caixa alta sobre cada título.

## 6. Ousadia em um ponto

A chave geral. Ao ligar, o fundo dela passa de cinza para âmbar em 150 ms. O resto da
interface é estático.

## 7. Microcopy

- Chave: "IA com controle" / "IA sem controle". Botão: "Ligar" / "Desligar".
- Estado: "Conectada ao servidor" / "Servidor não encontrado: rode o Claude Code ou o Codex
  com o MCP configurado" / "Token recusado: copie o token de novo do arquivo indicado no
  README".
- Tela vazia da lista de bloqueio: "Nenhum domínio bloqueado. Adicione o do seu banco, por
  exemplo."
