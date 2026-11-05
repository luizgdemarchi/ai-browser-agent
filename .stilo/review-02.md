# Review 02

- Ciclo: `2026-11-05-extensao-base`
- Alvo: `2e9aa94` (a árvore inteira)
- Lente: corretude da extensão e interface, com um revisor em subagente. Ele leu o estado de
  `d6345ca`, e o coordenador conferiu os achados contra `2e9aa94`.
- Cobertura: `src/extension/*`, `test/unit/reader.test.ts`, `test/e2e/run.mjs` e
  `src/server/tools.ts`
- Exclusões: a ponte e a segurança do servidor, que já passaram no review-01
- Documentos: `spec.md`, `plan.md` e `design.md` do ciclo; o piso de qualidade de
  `frontend.md`

## Resumo

| Gravidade | Achados |
|---|---|
| crítico | 0 |
| alto | 3 |
| médio | 9 |
| baixo | 1 |

## Achados

### 1. Domínio com porta ou curinga fica salvo na lista, mas não bloqueia nada
- **Arquivo:** `src/extension/options.ts:74`, `src/shared/blocklist.ts:1`
- **Gravidade:** alto
- **O que quebra:** o usuário digita `127.0.0.1:8765` ou `*.bb.com.br`, o item aparece na
  lista, mas `isBlocked` nunca bate com ele. O usuário acha que está protegido e não está.
- **Como corrigir:** `normalizeDomain` tira `*.`, a porta e o caminho. As opções recusam o
  que não for host válido.
- **Evidência:** prova do revisor com node: `stored: 127.0.0.1:8765 blocked: false`.
- **Confiança:** alta
- **Contraprova verificada:** o e2e cadastra o host sem porta.
- **Classificação:** confirmado
- **Origem:** introduzido
- **Estado:** aberto

### 2. `<input type=submit|button|reset|image>` sai sem rótulo no `read_page`
- **Arquivo:** `src/extension/reader.ts` (`labelOf`)
- **Gravidade:** alto
- **O que quebra:** `<input type="submit" value="Entrar">` sai com `label: ""`, e o agente
  não sabe qual é o botão de envio. Isso descumpre o R8 ("rótulo legível").
- **Como corrigir:** usar `value` para submit, button e reset, e `alt` para image.
- **Evidência:** prova do revisor no happy-dom: `"role":"submit","label":""`.
- **Confiança:** alta
- **Contraprova verificada:** `labels` e `innerText` de input vêm vazios.
- **Classificação:** confirmado
- **Origem:** introduzido
- **Estado:** aberto

### 3. Texto secundário abaixo de 4.5:1 no modo claro, e erro sem a cor de erro
- **Arquivo:** `src/extension/ui.css:4`, `src/extension/options.html` (`#add-error`)
- **Gravidade:** médio
- **O que quebra:** `.muted` (#6B7378 sobre #F4F5F2) dá 4.41:1, e `#add-error` usa `.muted`.
- **Como corrigir:** cinza claro `#646C71` e `#add-error` na cor `--erro`.
- **Evidência:** cálculo WCAG do revisor: 4.41.
- **Confiança:** alta
- **Contraprova verificada:** no modo escuro dá 5.94 e passa.
- **Classificação:** confirmado
- **Origem:** introduzido
- **Estado:** aberto

### 4. Foco e borda de campo abaixo de 3:1 no modo claro
- **Arquivo:** `src/extension/ui.css` (`:focus-visible`, `--linha`)
- **Gravidade:** médio
- **O que quebra:** o contorno âmbar sobre o papel claro dá 1.98:1, some sobre a chave
  ligada, e a borda dos campos dá 1.54:1.
- **Como corrigir:** contorno de foco em `--grafite` e borda de campo em `--cinza`.
- **Evidência:** cálculo WCAG do revisor.
- **Confiança:** alta
- **Contraprova verificada:** o popup não sobrescreve o foco.
- **Classificação:** confirmado
- **Origem:** introduzido
- **Estado:** aberto

### 5. As opções ficam presas em "Salvo. Conectando…"
- **Arquivo:** `src/extension/options.ts`
- **Gravidade:** médio
- **O que quebra:** quando o novo estado de conexão é igual ao anterior, o
  `storage.onChanged` não dispara, e o estado "carregando" nunca chega a sucesso nem a
  erro.
- **Como corrigir:** depois de salvar, redesenhar o estado a cada 1 s por até 10 s.
- **Evidência:** por leitura.
- **Confiança:** média
- **Contraprova verificada:** o popup já tem um `setInterval`; as opções não.
- **Classificação:** confirmado (por leitura)
- **Origem:** introduzido
- **Estado:** aberto

### 6. `navigate` e `new_tab` devolvem dados de domínio bloqueado depois de redirect
- **Arquivo:** `src/extension/actions.ts`
- **Gravidade:** médio
- **O que quebra:** é o mesmo problema do achado 2 do review-01.
- **Como corrigir:** o mesmo do review-01.
- **Evidência:** e2e `C4 redirect into a blocked domain` PASS em `2e9aa94`.
- **Confiança:** alta
- **Contraprova verificada:** `checkLanded` existe em `2e9aa94`.
- **Classificação:** confirmado
- **Origem:** introduzido
- **Estado:** corrigido no review-01 (`2e9aa94`)

### 7. URL sem esquema (`google.com`) quebra `navigate` e `new_tab`
- **Arquivo:** `src/extension/actions.ts` (`navigate`, `new_tab`, `checkUrl`)
- **Gravidade:** médio
- **O que quebra:** o Chrome resolve a URL como relativa à extensão
  (`chrome-extension://<id>/google.com`). O `new_tab` ainda lança `Invalid URL`.
- **Como corrigir:** acrescentar `https://` quando não houver esquema, e recusar URL que não
  passa no parse.
- **Evidência:** por leitura, mais a documentação de `chrome.tabs.update`.
- **Confiança:** média
- **Contraprova verificada:** o schema zod é só `z.string()`.
- **Classificação:** confirmado (por leitura)
- **Origem:** introduzido
- **Estado:** aberto

### 8. Print de aba em segundo plano pode esperar até o `[TIMEOUT]`
- **Arquivo:** `src/extension/cdp.ts` (`screenshot`)
- **Gravidade:** alto
- **O que quebra:** `screenshot {tabId}` de uma aba que não está ativa, no Chrome com
  interface: a aba oculta não produz quadro novo, e o servidor devolve `[TIMEOUT]` depois de
  35 s.
- **Como corrigir:** ativar a aba antes da captura e avisar no retorno. Pôr também um tempo
  limite próprio na chamada CDP.
- **Evidência:** não executado. O e2e só tira print da aba ativa e roda sem interface.
- **Confiança:** média
- **Contraprova verificada:** nenhum código ativa a aba.
- **Classificação:** hipótese
- **Origem:** introduzido
- **Estado:** aberto

### 9. Uma falha no `get-settings` mata o laço de reconexão do offscreen
- **Arquivo:** `src/extension/offscreen.ts` (`connect`)
- **Gravidade:** médio
- **O que quebra:** quando o `sendMessage` rejeita, com o service worker no meio de uma
  parada, nenhuma nova tentativa é agendada e a extensão fica desconectada.
- **Como corrigir:** try/catch com `scheduleRetry`.
- **Evidência:** por leitura.
- **Confiança:** média
- **Contraprova verificada:** as chamadas `void connect()` não têm `.catch`.
- **Classificação:** hipótese
- **Origem:** introduzido
- **Estado:** aberto

### 10. Diálogo JS (`alert`/`confirm`) trava os comandos CDP seguintes
- **Arquivo:** `src/extension/cdp.ts`
- **Gravidade:** médio
- **O que quebra:** um clique que abre `confirm()` faz esse comando e os seguintes
  devolverem `[TIMEOUT]`, sem dica do motivo.
- **Como corrigir:** `Page.enable` e ouvir `Page.javascriptDialogOpening`. Devolver um erro
  claro e fechar o diálogo, ou tratá-lo.
- **Evidência:** comportamento conhecido do CDP; não executado.
- **Confiança:** média
- **Contraprova verificada:** não há `chrome.debugger.onEvent` em lugar nenhum.
- **Classificação:** hipótese
- **Origem:** introduzido
- **Estado:** aberto

### 11. Erro de argumentos do `navigate` sai sem código, contra o R16
- **Arquivo:** `src/server/tools.ts` (`navigate needs exactly one of url or action.`)
- **Gravidade:** médio
- **O que quebra:** a mensagem não começa com `[CÓDIGO]`.
- **Como corrigir:** usar `formatError` com um dos códigos de R16.
- **Evidência:** por leitura.
- **Confiança:** alta
- **Contraprova verificada:** `errorResult` não acrescenta prefixo.
- **Classificação:** confirmado
- **Origem:** introduzido
- **Estado:** aberto

### 12. Os testes não exercitam a lógica não trivial do leitor
- **Arquivo:** `test/unit/reader.test.ts`
- **Gravidade:** médio
- **O que quebra:** faltam casos de rótulo de input submit, `kindOf` e iframe. Por isso os
  achados 1 e 2 passavam em todos os testes.
- **Como corrigir:** acrescentar esses casos.
- **Evidência:** por leitura.
- **Confiança:** alta
- **Contraprova verificada:** não existem testes de `actions` nem de `cdp`.
- **Classificação:** confirmado
- **Origem:** introduzido
- **Estado:** aberto

### 13. `read_page` devolve o valor de campos de senha em texto puro
- **Arquivo:** `src/extension/reader.ts` (`valueOf`)
- **Gravidade:** médio
- **O que quebra:** uma senha já preenchida pelo gerenciador de senhas vai inteira para o
  contexto da IA, e de lá para logs e transcrições.
- **Como corrigir:** para `type=password`, devolver `"••••"` quando houver valor e `""`
  quando estiver vazio.
- **Evidência:** por leitura. `valueOf` devolve `input.value` para qualquer tipo de texto.
- **Confiança:** alta
- **Contraprova verificada:** não há filtro por tipo.
- **Classificação:** sugestão do revisor, adotada como achado
- **Origem:** introduzido
- **Estado:** aberto

## Critérios do spec

| Critério | Estado | Evidência |
|---|---|---|
| C1 | atendido | `npx vitest run`: 39/39 em `2e9aa94` |
| C2 | atendido | `npm run build`: exit 0 |
| C3 a C6 | atendidos | e2e: 13/13 PASS em `2e9aa94` |
| L1 | pendente | verificação manual do usuário |
| L2 | atendido por leitura | |

O R8 está parcialmente descumprido (achado 2), e o R18 também, no caso de porta e curinga
(achado 1).
