# Spec — extensão base

- Ciclo: `2026-11-05-extensao-base`
- Trilha: completa
- Commit-base: nenhum (pasta ainda sem repositório git)
- `reviewRound` de início: 0

## Problema

O usuário trabalha com Claude Code e Codex pela linha de comando e quer que esses agentes
controlem o Chrome que ele já usa no dia a dia, com as contas logadas, sem Playwright e sem
abrir um navegador separado.

## Objetivo

Uma extensão de Chrome e um servidor MCP local que, juntos, deixam qualquer cliente MCP por
stdio (no mínimo Claude Code e Codex) ler páginas, clicar, preencher formulários, controlar
abas e tirar print no Chrome real do usuário.

## Não-objetivos

- A extensão não chama nenhum modelo de IA. Quem decide o que fazer é o agente externo.
- Não substitui o Playwright em testes automatizados de CI.

## Requisitos

### Componentes

- R1. Existe um servidor MCP em Node.js que o cliente inicia como processo e com o qual fala
  por stdio.
- R2. Existe uma extensão Manifest V3 para Chrome, carregável como "extensão sem pacote"
  (pasta local), sem passar pela Chrome Web Store.
- R3. Servidor e extensão conversam por WebSocket em `127.0.0.1`, porta padrão `8765`. No
  servidor, a porta muda pela variável de ambiente `AI_BROWSER_PORT`; na extensão, pela
  página de opções.
- R2a. O ID da extensão é fixo (não depende da pasta onde ela foi carregada), para que a
  checagem de origem de R4 funcione em qualquer máquina.

### Ponte e concorrência

- R4. O servidor dono da porta aceita dois tipos de conexão e recusa todas as outras:
  - extensão: origem do handshake igual a `chrome-extension://<id fixo>` e token correto;
  - servidor secundário (R6): handshake sem cabeçalho `Origin` (navegadores sempre enviam
    um, então páginas web ficam de fora) e token correto.
- R5. O token de pareamento é gerado pelo servidor na primeira execução e salvo em
  `~/.ai-browser-agent/token`. O usuário cola esse token uma única vez na extensão.
  Servidores secundários leem o mesmo arquivo.
- R6. Quando dois clientes MCP rodam ao mesmo tempo (Claude Code e Codex, por exemplo), o
  primeiro servidor a subir fica com a porta. O segundo se conecta ao primeiro como
  servidor secundário e repassa os comandos para ele. Os dois funcionam sem erro.
- R7. Se o servidor dono da porta encerrar, o próximo servidor que receber um comando assume
  a porta, e a extensão reconecta sozinha em até 10 s.

### Ferramentas MCP

- R8. `read_page`: devolve URL, título, o texto visível e uma lista numerada dos elementos
  interativos visíveis (links, botões, campos, selects), cada um com tipo, rótulo legível e
  valor atual. A numeração vale até a próxima leitura ou navegação daquela aba.
- R9. `click`: clica no elemento pelo número. O clique e a digitação de R10 e R11 chegam à
  página como entrada real do navegador (`event.isTrusted === true`), não como eventos
  sintéticos disparados por JavaScript.
- R10. `type`: digita um texto num campo pelo número, com a opção de limpar o campo antes e
  de pressionar Enter depois.
- R11. `fill_form`: preenche vários campos numa chamada só (texto, select, checkbox, radio).
- R12. `navigate`: abre uma URL na aba atual ou volta e avança no histórico, e só retorna
  quando a página termina de carregar ou depois de 30 s.
- R13. `list_tabs`, `switch_tab`, `new_tab`, `close_tab`: listam as abas (id, título e URL)
  e permitem ativar, abrir e fechar abas.
- R14. `screenshot`: devolve um PNG da área visível da aba como conteúdo de imagem MCP.
- R15. Toda ferramenta que age numa página aceita um `tabId` opcional. Sem ele, usa a aba
  ativa da janela focada.
- R16. Toda falha volta como erro MCP cuja mensagem começa com um código fixo entre
  colchetes, seguido do que houve e do que fazer. Códigos:
  - `[NOT_CONNECTED]`: extensão não conectada ao servidor;
  - `[EXTENSION_OFF]`: extensão desligada;
  - `[DOMAIN_BLOCKED]`: domínio na lista de bloqueio;
  - `[ELEMENT_NOT_FOUND]`: o número não existe mais (ler a página de novo);
  - `[TAB_NOT_FOUND]`: aba inexistente;
  - `[TIMEOUT]`: a ação passou do tempo limite;
  - `[UNSUPPORTED_PAGE]`: página em que o Chrome não deixa extensões agirem.

### Segurança

- R17. A extensão tem um interruptor liga/desliga e começa desligada. Desligada, ela recusa
  todos os comandos.
- R18. A extensão tem uma lista de domínios bloqueados, editável nas opções. Nenhum comando
  lê, age, navega ou tira print em aba cujo host seja um item da lista ou subdomínio dele.
  A comparação usa só o host: IPs como `127.0.0.1` contam, a porta é ignorada.
- R19. O ícone da extensão mostra o estado num badge: vazio quando desligada, `ON` em âmbar
  quando ligada e conectada, `!` em vermelho quando ligada e sem conexão com o servidor.
- R21. O popup mostra a última ação executada (ferramenta, alvo e há quanto tempo).

### Instalação

- R20. Um README em português explica como instalar e configurar o servidor no Claude Code e
  no Codex, carregar a extensão e parear as duas partes.

## Critérios de aceite (executáveis)

- C1. `npm test` na raiz passa. Inclui testes unitários da ponte: origem errada é recusada,
  token errado é recusado, o segundo servidor repassa os comandos ao primeiro e o
  substituto assume quando o dono cai.
- C2. `npm run build` gera a extensão e o servidor sem erro de TypeScript.
- C3. `npm run e2e` abre um Chrome de teste com a extensão carregada, sobe uma página local
  com formulário e, por um cliente MCP real via stdio, executa: `read_page`, `fill_form`,
  `click` no envio, confere com `read_page` o resultado do envio e que a página registrou
  os eventos com `isTrusted === true`, e depois `new_tab`, `switch_tab`, `screenshot` (PNG
  válido, maior que 0 bytes) e `close_tab`. Todos os passos passam.
- C4. No mesmo e2e: com a extensão desligada, qualquer ferramenta devolve um erro que
  começa com `[EXTENSION_OFF]`. Com `127.0.0.1` na lista de bloqueio, `read_page` na página
  de teste devolve um erro que começa com `[DOMAIN_BLOCKED]`.
- C5. No mesmo e2e: dois servidores sobem em paralelo e os dois executam `list_tabs` com
  sucesso.
- C6. No mesmo e2e: depois de forçar a parada do service worker da extensão, e
  separadamente depois de encerrar o servidor dono da porta, um `list_tabs` feito pelo
  servidor restante tem sucesso em até 10 s.

O e2e pode usar uma ferramenta de teste para abrir o Chrome. A extensão e o servidor
entregues não dependem dela. O e2e liga a extensão, cola o token e edita a lista de bloqueio
pela própria interface (popup e opções), como o usuário faria. A extensão não ganha nenhuma
porta dos fundos para testes.

## Critérios só por leitura

- L1. Com o servidor configurado no Claude Code e no Codex reais, um pedido em linguagem
  natural ("abra a página X, preencha o formulário e tire um print") é concluído.
  Verificação manual, feita pelo usuário.
- L2. O README cobre a instalação do zero no Windows.

## Fora de escopo

Firefox e Edge, publicação na Chrome Web Store, aprovação por site, upload de arquivo,
gravação de GIF, leitura do console e da rede, IA dentro da extensão, páginas `chrome://` e
a Chrome Web Store (o Chrome bloqueia extensões nelas).

## Riscos

- O service worker do MV3 pode ser suspenso pelo Chrome e derrubar o WebSocket. É mitigado
  pela reconexão de R7 e verificado em C6.
- A faixa "está depurando este navegador" aparece enquanto o `chrome.debugger` estiver
  conectado. É esperada, não é bug.
- Páginas com iframes de outra origem e shadow DOM fechado podem ficar parcialmente
  ilegíveis no `read_page`. A primeira versão cobre o documento principal e os iframes da
  mesma origem.
- O agente controla uma sessão logada real. A proteção depende do interruptor e da lista de
  bloqueio, e o usuário precisa saber disso pelo README.
- O Codex pode tratar retorno de imagem MCP de um jeito diferente do Claude Code. É
  verificado em L1.

## Teste com leitor

Executado em 2026-11-05 por um subagente sem o contexto da conversa. Ele entendeu o
produto, os critérios C1 a C5 e o fora de escopo. Lacunas apontadas e como foram resolvidas:

- Canal e autenticação do servidor secundário contradiziam R4: R4 agora tem os dois tipos
  de conexão.
- ID da extensão sem pacote varia com a pasta: R2a fixa o ID.
- Porta padrão, caminho do token e configuração da porta não estavam definidos: R3 e R5.
- Não se sabia como o e2e liga a extensão: nota abaixo de C6 (pela interface, sem porta dos
  fundos).
- Pausa do service worker e limite de 10 s sem critério: C6.
- Erros sem texto comparável: R16 tem códigos fixos, e C4 os usa.
- Não se sabia se o bloqueio por domínio vale para IP e porta: R18.
- "Clique real" estava implícito: R9 exige `isTrusted`, e C3 verifica.
- "Última ação" do design sem requisito, e forma do indicador no ícone indefinida: R21 e R19.
