# Revisão editorial 01

- Modo: integral, porque é o primeiro ciclo do projeto
- Commit-base: nenhum. Revisado: `2cfc326`
- Objetivo e público:
  - README: o desenvolvedor que instala e usa a extensão com o Claude Code ou o Codex.
  - Textos da interface: o mesmo usuário, no popup e nas opções.
  - Descrições das ferramentas MCP: o agente de IA que escolhe e chama as ferramentas.
- Cobertura:
  - `README.md`
  - os textos de `src/extension/popup.html`, `popup.ts`, `options.html` e `options.ts`
  - as descrições em `src/server/tools.ts`
- Exclusões:
  - código e mensagens de erro (`ToolError`), que são contrato do R16
  - `.stilo/review-*` (histórico)
  - os documentos do ciclo (`spec.md`, `design.md`, `plan.md`), que são registro aprovado
  - `LICENSE` (texto padrão)
- Limitações: o texto da faixa de depuração do Chrome não foi conferido num Chrome em
  português.

## Resumo

| Gravidade | Achados |
|---|---|
| crítico | 0 |
| alto | 1 |
| médio | 2 |
| baixo | 5 |

## Achados

### 1. Afirmação de segurança desatualizada
- **Arquivo:** `README.md:27-29`
- **Trecho:** "`confirm`, `prompt` e "sair da página" com Cancelar. A IA nunca concorda com nada
  em seu nome"
- **Contexto e efeito:** desde `b87537b`, o "sair da página" é aceito quando foi a IA que
  pediu para navegar, e só os diálogos de ações da IA são tratados. Quem lê a seção de
  segurança fica com uma ideia errada do que a extensão faz.
- **Gravidade:** alto
- **Confiança:** alta
- **Correção mínima:** dizer que só os diálogos abertos por ações da IA são tratados. `alert`
  recebe OK; "sair da página" é aceito quando a IA pediu para navegar; `confirm` e `prompt`
  recebem Cancelar. Os diálogos do usuário não são tocados.
- **Estado:** corrigido: `README.md`, item de diálogos da seção de segurança

### 2. As descrições das ferramentas omitem efeitos colaterais que o agente precisa conhecer
- **Arquivo:** `src/server/tools.ts` (`screenshot`, `navigate`, `new_tab`, `click`)
- **Trecho:** "Take a PNG screenshot of the visible area of the tab."
- **Contexto e efeito:** o agente não sabe que:
  - o `screenshot` de uma aba em segundo plano a ativa;
  - `navigate` e `new_tab` só aceitam http(s) e completam o esquema;
  - `click`, `type`, `fill_form` e `navigate` informam e fecham diálogos.

  Sem isso, ele estranha o resultado e repete as chamadas.
- **Gravidade:** médio
- **Confiança:** alta
- **Correção mínima:** uma frase em cada descrição afetada.
- **Estado:** corrigido: `src/server/tools.ts` (`click`, `navigate`, `new_tab` e `screenshot`)

### 3. Solução de problemas sem o caso novo de token recusado entre dois servidores
- **Arquivo:** `README.md:126-133`
- **Trecho:** "**"Token recusado"**: o token mudou (por exemplo, você apagou
  `~/.ai-browser-agent`)."
- **Contexto e efeito:** o erro "refused this server's token. Make both use the same
  AI_BROWSER_HOME" (Claude Code e Codex com pastas diferentes) não tem entrada. O usuário
  recebe o erro e não acha a explicação.
- **Gravidade:** médio
- **Confiança:** alta
- **Correção mínima:** uma entrada nova citando a mensagem e a solução (o mesmo
  `AI_BROWSER_HOME` nos dois).
- **Estado:** corrigido: `README.md`, nova entrada em Solução de problemas

### 4. A "Exceção" fica longe da regra que ela excepciona
- **Arquivo:** `README.md:23`
- **Trecho:** "Exceção: a escolha de opção em `<select>` é feita por script"
- **Contexto e efeito:** a regra ("entrada real de mouse e teclado") está duas linhas acima,
  e no meio há um item sobre o ID da extensão. "Exceção" fica sem referente.
- **Gravidade:** baixo
- **Confiança:** alta
- **Correção mínima:** juntar ao item da faixa de depuração.
- **Estado:** corrigido: `README.md` (a exceção do `<select>` foi para o item da faixa de depuração)

### 5. Citação literal de um texto do Chrome que não foi conferido
- **Arquivo:** `README.md:18-19`
- **Trecho:** "a faixa "AI Browser Agent começou a depurar este navegador""
- **Contexto e efeito:** se o texto real for outro, o usuário procura uma frase que não
  aparece.
- **Gravidade:** baixo
- **Confiança:** média
- **Correção mínima:** descrever em vez de citar ("uma faixa avisando que a extensão está
  depurando o navegador").
- **Estado:** corrigido: `README.md` (a faixa é descrita, não citada)

### 6. Mensagem de token recusado manda o usuário para outro documento
- **Arquivo:** `src/extension/popup.ts:22`, `src/extension/options.ts:26`
- **Trecho:** "copie o token de novo do arquivo indicado no README." / "Copie o token de novo
  do arquivo."
- **Contexto e efeito:** o usuário sai da extensão para descobrir o caminho, ou nem sabe qual
  é o arquivo.
- **Gravidade:** baixo
- **Confiança:** alta
- **Correção mínima:** citar o caminho `~/.ai-browser-agent/token`.
- **Estado:** corrigido: `src/extension/popup.ts:22` e `src/extension/options.ts:26` (citam `~/.ai-browser-agent/token`)

### 7. Estado vazio do pareamento sem próximo passo
- **Arquivo:** `src/extension/options.ts:23`
- **Trecho:** "Sem token."
- **Contexto e efeito:** o piso de qualidade pede que a tela vazia convide à próxima ação.
- **Gravidade:** baixo
- **Confiança:** alta
- **Correção mínima:** "Sem token: cole o token acima e clique em Salvar token."
- **Estado:** corrigido: `src/extension/options.ts:23`

### 8. A tabela de ferramentas não diz quais URLs o `navigate` aceita
- **Arquivo:** `README.md:102` e `:110`
- **Trecho:** "| `navigate` | abre URL ou `back` / `forward` / `reload`"
- **Contexto e efeito:** desde `b87537b`, só http(s) e `about:blank` são aceitos. Quem tenta
  `file:` recebe erro sem aviso prévio na documentação.
- **Gravidade:** baixo
- **Confiança:** alta
- **Correção mínima:** "abre URL http(s)" na tabela, e a frase sobre o esquema completada.
- **Estado:** corrigido: `README.md` (tabela e parágrafo sobre `navigate` e `new_tab`)
