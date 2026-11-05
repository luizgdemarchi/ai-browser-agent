# Review 01

- Ciclo: `2026-11-05-extensao-base`
- Alvo: commits `a3a66cf..d6345ca` (a árvore inteira, porque o ciclo não tem commit-base)
- Lente: segurança e rede, com um revisor em subagente
- Cobertura: `src/server/*`, `src/shared/*`, e `src/extension/actions.ts`, `background.ts` e
  `offscreen.ts` vistos pela segurança
- Exclusões: a corretude da extensão e a interface ficam com o segundo revisor, ainda em
  andamento. Os achados dele entram no review-02.
- Documentos: `spec.md`, `plan.md` e `design.md` do ciclo

## Resumo

| Gravidade | Achados |
|---|---|
| crítico | 0 |
| alto | 3 (corrigidos) |
| médio | 2 (1 corrigido, 1 aberto) |
| baixo | 2 (corrigidos) |

## Achados

### 1. A lista de bloqueio é contornada com ponto final no host e com IPv6 mapeado
- **Arquivo:** `src/shared/blocklist.ts:9`
- **Gravidade:** alto
- **O que quebra:** com a lista `["bank.com"]`, `navigate {url: "https://bank.com./"}` passa,
  e as ações seguintes também passam, porque o host continua `bank.com.`. Com `127.0.0.1`
  bloqueado, `http://[::ffff:127.0.0.1]/` passa.
- **Como corrigir:** tirar os pontos finais do host e converter IPv6 mapeado para IPv4 antes
  de comparar.
- **Evidência:** `node -e "new URL('https://bank.com./x').hostname"` → `bank.com.`;
  `http://[::ffff:127.0.0.1]/` → `[::ffff:7f00:1]`. O coordenador conferiu os dois.
- **Confiança:** alta
- **Contraprova verificada:** `normalizeDomain` normaliza só o item da lista, e nenhum
  chamador normaliza o host.
- **Classificação:** confirmado
- **Origem:** introduzido
- **Estado:** corrigido: `src/shared/blocklist.ts` (`canonicalHost`). Testes novos em `test/unit/blocklist.test.ts` falharam antes (2 ×) e passam depois.

### 2. `navigate` e `new_tab` não checam o destino final (redirect, back e forward)
- **Arquivo:** `src/extension/actions.ts` (`navigate`, `new_tab`)
- **Gravidade:** alto
- **O que quebra:** um redirect ou encurtador que leva a um domínio bloqueado, ou um
  `back` com o banco no histórico, termina com a aba no domínio bloqueado. Isso viola o
  R18, e a resposta ainda devolve a URL completa e o título dessa página.
- **Como corrigir:** depois do `waitForLoad`, checar `loaded.url`. Se estiver bloqueado,
  mandar a aba para `about:blank` e devolver `[DOMAIN_BLOCKED]` sem os dados da aba.
- **Evidência:** por leitura. O `checkUrl` só roda antes do `chrome.tabs.update`. Não foi
  executado no Chrome.
- **Confiança:** alta
- **Contraprova verificada:** `resolveTab` checa só antes da ação.
- **Classificação:** confirmado
- **Origem:** introduzido
- **Estado:** corrigido: `src/extension/actions.ts` (`checkLanded` depois de `navigate` e de `new_tab`; a aba vai para `about:blank`). O passo e2e `C4 redirect into a blocked domain` falhou com o código antigo e passa com o novo.

### 3. `send()` trava para sempre quando o token é recusado ou a porta está presa
- **Arquivo:** `src/server/bridge.ts` (`ensureConnected`, `connectRelay`, `send`)
- **Gravidade:** alto
- **O que quebra:** um relay com token diferente (outro `AI_BROWSER_HOME`, ou token
  regenerado) entra num laço de 300 ms, e a chamada MCP nunca volta. Uma porta presa por um
  processo que não responde deixa o `connectRelay` pendurado.
- **Como corrigir:** pôr o tempo limite em volta de `ensureConnected` dentro do `send`, dar
  ao relay um tempo limite para o handshake e para o `welcome`, e devolver um erro claro
  sobre o token.
- **Evidência:** o revisor rodou um script contra o bundle com `commandTimeoutMs: 1000`, e
  a chamada continuou pendente depois de 6 s e de 8 s.
- **Confiança:** alta
- **Contraprova verificada:** os testes da ponte só cobrem a recusa do lado do dono.
- **Classificação:** confirmado
- **Origem:** introduzido
- **Estado:** corrigido: `src/server/bridge.ts` (`connectedWithin` com tempo limite em `send`, `handshakeTimeout` e timer de `welcome` no relay, espera de 2 s depois de token recusado, log único). Os testes `k` e `l` falharam antes e passam depois.

### 4. Quando a conexão da extensão é trocada, o comando em andamento se perde
- **Arquivo:** `src/server/bridge.ts` (`dropExtensionSilently`)
- **Gravidade:** médio
- **O que quebra:** uma segunda conexão de extensão fecha a primeira. O resultado do comando
  que estava na primeira se perde, e o comando volta como `[TIMEOUT]` depois de 35 s, em vez
  de `[NOT_CONNECTED]` na hora. Com dois perfis pareados, um derruba o outro em laço.
- **Como corrigir:** registrar em `Pending` e em `Forwarded` o socket que recebeu cada
  comando, e fazer falhar na hora os comandos da conexão substituída.
- **Evidência:** script do revisor: `rejected [TIMEOUT] The browser did not answer list_tabs in 2 s.`
- **Confiança:** alta para a perda do comando, média para o laço
- **Contraprova verificada:** a conexão antiga já está CLOSED quando a resposta sai.
- **Classificação:** confirmado (perda); hipótese (laço)
- **Origem:** introduzido
- **Estado:** corrigido: `src/server/bridge.ts` (`Pending.socket`, `Forwarded.extension` e `failCommandsOn`). O teste `m` falhou antes e passa depois. O laço entre dois perfis continua possível, mas cada comando agora falha na hora com `[NOT_CONNECTED]`.

### 5. A extensão manda o token para quem estiver na porta, sem autenticar o servidor
- **Arquivo:** `src/extension/offscreen.ts` (hello), `src/server/bridge.ts`
- **Gravidade:** médio
- **O que quebra:** um processo de outro usuário do Windows que tome a porta 8765 recebe o
  token e manda comandos.
- **Como corrigir:** desafio e resposta com HMAC nos dois sentidos, sem o token trafegar.
- **Evidência:** por leitura. Não foi executado.
- **Confiança:** média
- **Contraprova verificada:** um processo do mesmo usuário já consegue ler o arquivo do
  token, então o risco vale só para outros usuários e processos isolados.
- **Classificação:** hipótese
- **Origem:** introduzido
- **Estado:** aberto: gravidade média, adiado para o próximo ciclo, porque muda o protocolo (desafio e resposta com HMAC nos dois sentidos). O risco fica limitado a outro usuário do Windows ou a um processo isolado na mesma máquina.

### 6. A checagem de domínio só acontece no início do comando
- **Arquivo:** `src/extension/actions.ts` (`screenshot`, `fill_form`)
- **Gravidade:** baixo
- **O que quebra:** uma página liberada que navega para o banco entre o `resolveTab` e a
  captura faz o print sair do banco.
- **Como corrigir:** checar a URL de novo logo depois da captura e descartar a imagem se o
  domínio estiver bloqueado.
- **Evidência:** por leitura. Depende de tempo; não foi executado.
- **Confiança:** baixa
- **Contraprova verificada:** `cdp.send` não checa a URL.
- **Classificação:** hipótese
- **Origem:** introduzido
- **Estado:** corrigido: `src/extension/actions.ts` (`screenshot` confere a URL de novo depois da captura e descarta a imagem). Sem teste determinístico, porque depende de tempo; verificado por leitura, e o e2e passa.

### 7. Conexão ainda sem autenticação aceita mensagens de até 64 MB
- **Arquivo:** `src/server/bridge.ts` (`maxPayload`)
- **Gravidade:** baixo
- **O que quebra:** um processo local sem token abre várias conexões e manda 64 MB em cada
  uma, e o servidor fica sem memória.
- **Como corrigir:** fechar a conexão quando o primeiro frame passar de 4 KB.
- **Evidência:** por leitura.
- **Confiança:** média
- **Contraprova verificada:** o `verifyClient` só filtra a origem.
- **Classificação:** sugestão
- **Origem:** introduzido
- **Estado:** corrigido: `src/server/bridge.ts` (`MAX_HELLO_BYTES` = 4096 antes da autenticação). O teste `n` falhou antes e passa depois.

## Critérios do spec

| Critério | Estado | Evidência |
|---|---|---|
| C1 | atendido | `npx vitest run`: 33/33 |
| C2 | atendido | `npm run build`: exit 0 |
| C3 | atendido | e2e: PASS em 6 passos de C3 |
| C4 | atendido | e2e: PASS em `C4 blocked domain` e `C4 extension off` |
| C5 | atendido | e2e: PASS em `C5 two servers at once` |
| C6 | atendido | e2e: 363 ms (service worker parado) e 1080 ms (dono fechado) |
| L1 | pendente | verificação manual do usuário |
| L2 | atendido por leitura | o README cobre a instalação no Windows |

O R18 está parcialmente descumprido, pelos achados 1 e 2, embora C4 passe.
