# Spec — visual da interface

- Ciclo: `2026-11-05-visual-ui`
- Trilha: completa
- Commit-base: `a1cb407`
- `reviewRound` de início: 6
- Direção visual: `design.md` deste ciclo, aprovado junto com este spec.

## Problema

O popup, a página de opções, o badge e o ícone da extensão funcionam, mas parecem
inacabados: texto solto sem agrupamento, botões e campos sem hierarquia, o estado
"ligado" é um bloco âmbar chapado, o badge escreve `ON` em cima do ícone e o ícone não
comunica o que a extensão faz.

## Objetivo

Redesenhar as quatro superfícies visíveis (popup, opções, badge, ícone) seguindo o
`design.md`, sem mudar o que a extensão faz.

## Não-objetivos

- Mudar ferramentas MCP, protocolo, servidor, regras de bloqueio ou armazenamento.
- Mudar o texto das mensagens de status que o e2e confere (`Conectada ao servidor`).
- Internacionalizar a interface.

## Requisitos

### Popup

- R1. Cabeçalho com o ícone da extensão, o nome "AI Browser Agent" e a versão lida do
  manifesto.
- R2. O controle de ligar e desligar é um cartão com título, descrição curta do efeito e um
  interruptor visual. Continua sendo um único `<button id="toggle">` com `aria-pressed`,
  acionável por clique, `Enter` e `Espaço`.
- R3. O status da conexão aparece numa pílula com ponto colorido e texto. Cor nunca é o
  único canal: o texto diz o estado e, em erro, como resolver.
- R4. A última ação aparece num cartão próprio com ferramenta, alvo e há quanto tempo
  (mesmo formato e atualização a cada 5 s de hoje, via `timeAgo`); sem ação, diz "Nenhuma
  ação ainda." e o que a fará aparecer.
- R5. O link para opções fica no rodapé, com ícone, e abre a página de opções.

### Opções

- R6. Cabeçalho com ícone, nome e versão, igual ao do popup.
- R7. "Pareamento" e "Domínios bloqueados" são seções visualmente separadas, cada uma com
  título e descrição.
- R8. O campo de token fica oculto por padrão (`type="password"`), com um botão
  "Mostrar"/"Ocultar" acessível pelo teclado e com `aria-pressed`.
- R9. "Salvar token" é a ação primária da seção de pareamento; "Adicionar" é a da seção de
  domínios. Um único estilo de botão primário em toda a página.
- R10. Cada domínio bloqueado aparece como uma linha com o domínio em fonte de dados e um
  botão "Remover"; a lista vazia mostra o convite atual.
- R11. A página funciona a partir de 320 px de largura, sem rolagem horizontal.

### Badge e ícone

- R12. Novo ícone 16, 48 e 128 px que mostra uma janela de navegador com um cursor,
  legível a 16 px, nos temas claro e escuro da barra do Chrome.
- R13. Estado no ícone da barra, substituindo o R19 do ciclo `2026-11-05-extensao-base`.
  Três estados, para as quatro combinações de ligada × conectada:

  | Ligada | Conectada | Ícone | Badge | Tooltip (R14) |
  |---|---|---|---|---|
  | não | qualquer | padrão | limpo (texto vazio) | "AI Browser Agent — desligada" |
  | sim | sim | ativo (indicador âmbar no desenho) | limpo (texto vazio) | "AI Browser Agent — IA com controle" |
  | sim | não | padrão | `!`, fundo `#C0392B`, texto `#FFFFFF` | "AI Browser Agent — sem conexão com o servidor" |

  Com badge limpo, a cor de fundo do badge não importa e o teste não a confere.
- R14. O título do botão da extensão (tooltip) diz o estado em texto, conforme a tabela do
  R13.

### Compatibilidade

- R15. Os seletores que o e2e usa continuam existindo com o mesmo papel: `#toggle`
  (`aria-pressed`), `#connection`, `#token`, `#port`, `#save-token`, `#new-domain`,
  `#add-domain`, `#blocklist`.
- R16. Temas claro e escuro seguem `prefers-color-scheme`; movimento respeita
  `prefers-reduced-motion: reduce`.
- R17. Nenhuma fonte, imagem ou script carregado da rede.

## Critérios de aceite

Executáveis:

- A1. `npm run build` termina com código 0.
- A2. `npm test` passa, incluindo um teste unitário novo de uma função pura que mapeia
  (ligada, conectada) para o estado do ícone: para as quatro combinações, confere a
  variante (`"padrao"` ou `"ativo"`), o texto do badge, a cor quando há texto e o tooltip
  da tabela do R13.
- A3. `npm run e2e` passa, incluindo três passos novos: na página de opções com a janela a
  320 px, `document.documentElement.scrollWidth <= 320`; no popup,
  `scrollWidth <= clientWidth` do documento; e o botão "Mostrar" muda o `type` do
  `#token` para `text` e de volta para `password`.
- A4. `grep -rE "https?://" dist/extension/*.html dist/extension/*.css | grep -v "www.w3.org/2000/svg"`
  não imprime nada (R17; o namespace de SVG inline não é carregado da rede).

Conferidos lendo ou olhando (não executáveis):

- L1. Capturas do popup (ligado/conectado, ligado/sem conexão, desligado) e das opções
  (claro e escuro) batem com os wireframes do `design.md`.
- L2. Contraste do menor texto mais claro ≥ 4.5:1 nos dois temas; borda de campo e foco
  ≥ 3:1.
- L3. Percorrer popup e opções só com teclado alcança todos os controles, na ordem visual,
  com foco visível.
- L4. O ícone a 16 px na barra do Chrome é reconhecível nos temas claro e escuro.

## Fora de escopo

- Página de boas-vindas ou onboarding.
- Animações além do momento descrito no `design.md` § 6.
- Publicar nova Release; isso é decisão do encerramento.

## Riscos

- Ícone feito à mão a 16 px pode ficar ilegível: o design define uma versão simplificada
  para 16 px.
- Trocar o ícone em tempo de execução (R13) exige variantes do PNG ou desenho por canvas no
  service worker; escolha no plano.
- Mudar `#token` para `password` pode afetar o e2e que digita nele: A3 cobre.

## Teste com leitor

Executado por subagente sem contexto. Ele entendeu o que será construído, a verificação de
cada critério e o fora de escopo. Lacunas corrigidas:

- Combinação "desligada e conectada" e badge limpo indefinidos: tabela no R13.
- "Variante do ícone" sem forma testável: A2 fixa `"padrao"`/`"ativo"` numa função pura.
- Versão fixa no wireframe: o `design.md` diz que é exemplo.
- "Toque para desligar" é linguagem de celular: trocado por "Clique".
- Formato de "há quanto tempo": R4 mantém o `timeAgo` atual.
- Contrastes não comprovados: calculados no `design.md` § 2.
- Popup sem critério de largura: passo novo na A3.
- Falso positivo do grep com SVG inline: A4 filtra o namespace.
