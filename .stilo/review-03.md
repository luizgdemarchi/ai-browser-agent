# Review 03

- Ciclo: `2026-11-05-extensao-base`
- Alvo: `git diff d6345ca..80ad92a -- src test` (as correções do review-01 e do review-02)
- Lente: as correções e as regressões que elas podem ter trazido, com um revisor em subagente
- Cobertura: `src/server/bridge.ts`, `src/shared/blocklist.ts` e `url.ts`,
  `src/extension/actions.ts`, `cdp.ts`, `offscreen.ts` e `options.ts`
- Exclusões: código que essas correções não mexeram
- Documentos: `spec.md`, `review-01.md` e `review-02.md`

O revisor confirmou que as correções 1, 3 e 4 do review-01 e as de porta e curinga, do
offscreen, das opções e do código de erro do review-02 funcionam. As sondas dele cobriram
`bank.com.`, `[::ffff:127.0.0.1]`, `0x7f000001` e `127.1`.

## Resumo

| Gravidade | Achados |
|---|---|
| crítico | 0 |
| alto | 0 |
| médio | 3 |
| baixo | 4 |

## Achados

### 1. `MAX_HELLO_BYTES` não evita a memória de 64 MB por conexão
- **Arquivo:** `src/server/bridge.ts:204` e `:277`
- **Gravidade:** baixo
- **O que quebra:** o `ws` monta o frame inteiro (até `maxPayload`) antes de emitir
  `message`, então a checagem de 4 KB chega tarde.
- **Como corrigir:** limitar os bytes brutos do socket antes da autenticação.
- **Evidência:** o revisor mandou 40 MB por um script `ws`, e a memória do processo foi de
  50 MB para 181 MB.
- **Confiança:** alta
- **Contraprova verificada:** o `verifyClient` só filtra a origem.
- **Classificação:** confirmado
- **Origem:** introduzido (correção incompleta do achado 7 do review-01)
- **Estado:** aberto: gravidade baixa, para o próximo ciclo, junto com a autenticação mútua (achado 5 do review-01).

### 2. `checkLanded` manda para `about:blank` também quando o destino é só "página não suportada"
- **Arquivo:** `src/extension/actions.ts:48-55`
- **Gravidade:** médio
- **O que quebra:** um `navigate {action: "back"}` que volta para `chrome://newtab/` leva a
  aba para `about:blank` e devolve erro.
- **Como corrigir:** só redirecionar quando o erro for `DOMAIN_BLOCKED`.
- **Evidência:** por leitura. O `catch` não filtra pelo código do erro.
- **Confiança:** alta
- **Contraprova verificada:** a lista `UNSUPPORTED` inclui `^chrome:`.
- **Classificação:** confirmado (por leitura)
- **Origem:** introduzido
- **Estado:** corrigido: `src/extension/actions.ts` (`checkLanded` só leva para `about:blank` com `DOMAIN_BLOCKED`; página não suportada no destino não é erro). Verificado por leitura e pelo e2e `C4 redirect into a blocked domain`.

### 3. Os diálogos do próprio usuário também são fechados sozinhos, e `beforeunload` cancela a navegação
- **Arquivo:** `src/extension/cdp.ts:24-32`
- **Gravidade:** médio
- **O que quebra:** enquanto o debugger está anexado, um `confirm` disparado pelo usuário
  numa aba que a IA já usou é cancelado sem ele ver. Um `navigate` saindo de um formulário
  com o aviso "alterações não salvas" é cancelado e volta `[TIMEOUT]`, sem pista do motivo.
- **Como corrigir:** só tratar diálogos durante uma ação do agente naquela aba. Durante um
  `navigate` ou um `close_tab` pedidos, aceitar o `beforeunload` e informar.
- **Evidência:** por leitura. Não executado no Chrome.
- **Confiança:** média
- **Contraprova verificada:** o debugger só é desanexado no `detachAll`, ao desligar.
- **Classificação:** hipótese
- **Origem:** introduzido
- **Estado:** corrigido: `src/extension/cdp.ts` (`asAgent`: só trata diálogos durante uma ação do agente e por até 1 s depois; aceita `beforeunload`) e `src/extension/actions.ts` (`click`, `type`, `fill_form` e `navigate` rodam em `asAgent`; `navigate` informa os diálogos). Novo passo e2e `dialog opened by a click is dismissed and reported` passa. O caso do diálogo aberto pelo próprio usuário não tem teste automático.

### 4. `normalizeDomain` aceita itens que nunca batem com nada e recusa domínios com acento (IDN)
- **Arquivo:** `src/shared/blocklist.ts:2-8`
- **Gravidade:** médio
- **O que quebra:** `0x7f.1`, `[0::1]` e `[::ffff:127.0.0.1]` ficam salvos mas não bloqueiam
  nada. `açaí.com.br` é recusado.
- **Como corrigir:** canonizar o item com o parser de URL (punycode, IPv4 normal, IPv6
  comprimido) e com o `canonicalHost`.
- **Evidência:** sonda do revisor: `0x7f.1 ... http://127.0.0.1/ false`; `açaí.com.br ""`.
- **Confiança:** alta
- **Contraprova verificada:** os casos comuns funcionam.
- **Classificação:** confirmado
- **Origem:** introduzido
- **Estado:** corrigido: `src/shared/blocklist.ts` (`normalizeDomain` canoniza com `new URL` e `canonicalHost`). 2 testes novos falharam antes e passam depois.

### 5. `targetUrl` deixa passar qualquer esquema, e `host:porta?query` é lido como esquema
- **Arquivo:** `src/shared/url.ts:5`, `src/extension/actions.ts`
- **Gravidade:** baixo
- **O que quebra:** `javascript:`, `data:`, `file:` e `search-ms:` passam e dependem só do
  Chrome para serem barrados. `localhost:3000?x=1` não ganha `https://`.
- **Como corrigir:** aceitar só `http:`, `https:` e `about:blank`, e aceitar `?` e `#` depois
  da porta.
- **Evidência:** sonda do revisor: `"javascript:alert(1)" -> javascript:alert(1)`,
  `"localhost:3000?x=1" -> localhost:3000?x=1`.
- **Confiança:** média
- **Contraprova verificada:** o `checkUrl` não tem lista de esquemas permitidos.
- **Classificação:** sugestão
- **Origem:** preexistente (os esquemas); introduzido (`?` e `#` depois da porta)
- **Estado:** corrigido: `src/shared/url.ts` (só `http:`, `https:` e `about:blank`; `?` e `#` depois da porta). 2 testes novos falharam antes e passam depois.

### 6. Com o token já recusado, cada comando espera os 35 s inteiros
- **Arquivo:** `src/server/bridge.ts:372-390`
- **Gravidade:** baixo
- **O que quebra:** o erro já é conhecido, mas só sai no fim do prazo.
- **Como corrigir:** com `tokenRefused`, usar um prazo curto.
- **Evidência:** por leitura.
- **Confiança:** alta
- **Contraprova verificada:** `tokenRefused` só volta a falso no `welcome`.
- **Classificação:** sugestão
- **Origem:** introduzido
- **Estado:** corrigido: `src/server/bridge.ts` (`connectedWithin` falha na hora quando `tokenRefused`). O teste `o` falhou antes (15 s) e passa depois.

### 7. `checkLanded` não cobre redirect por JS nem por meta refresh
- **Arquivo:** `src/extension/actions.ts:247-253`
- **Gravidade:** baixo
- **O que quebra:** um encurtador que redireciona depois do `load` deixa a aba no domínio
  bloqueado. Os dados da página não voltam para a IA, e as ações seguintes são barradas pelo
  `resolveTab`.
- **Como corrigir:** um listener global que leve para `about:blank` qualquer aba que o
  agente usou e que entre em domínio bloqueado.
- **Evidência:** por leitura.
- **Confiança:** média
- **Contraprova verificada:** o `resolveTab` e o `list_tabs` continuam protegendo.
- **Classificação:** hipótese
- **Origem:** introduzido (cobertura parcial)
- **Estado:** aberto: gravidade baixa, para o próximo ciclo. O `resolveTab` e o `list_tabs` continuam protegendo.

## Critérios do spec

| Critério | Estado | Evidência |
|---|---|---|
| C1 | atendido | `npx vitest run`: 48/48 em `80ad92a` |
| C2 | atendido | `npm run build`: exit 0 |
| C3 a C6 | atendidos | e2e: 13/13 PASS em `80ad92a` |
| L1 | pendente | verificação manual do usuário |
| L2 | atendido por leitura | |

Nenhum achado crítico ou alto, então o critério de saída do loop técnico está cumprido. Os
achados 2 a 6 são corrigidos numa rodada de FIX opcional, porque são baratos e dois deles
são regressões. O 1 e o 7 ficam abertos para o próximo ciclo.
