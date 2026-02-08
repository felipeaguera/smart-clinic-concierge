

# Corrigir Pausa da Clara: Bug do chatLid + Seguranca via Prompt

## Causa Raiz Identificada

O Z-API envia o campo `chatLid` para identificar o chat, mas o codigo usa `body.chatId` (que e `undefined`). Isso causa:

- Mapeamento @lid nunca e atualizado com mensagens inbound
- Mensagens manuais da secretaria criam pausa para o telefone ERRADO
- Clara continua respondendo ao paciente real

Evidencia dos logs:

```text
Inbound (paciente):     chatLid = "242094522282192@lid", phone = "5516981275767"
FromMe  (secretaria):   rawPhone = "242094522282192@lid" -> resolve para 5515991008960 (ERRADO!)
Auto-pause criado para: 5515991008960 (deveria ser 5516981275767)
```

## Solucao em Duas Camadas

### Camada 1: Corrigir bug do chatLid (causa raiz)

No `zapi-webhook/index.ts`, substituir `body.chatId` por `body.chatLid || body.chatId` em todos os lugares:

**Local 1 - Mapeamento em mensagens inbound (linha ~522):**
```
body.chatLid?.includes("@lid") || body.chatId?.includes("@lid")
```

**Local 2 - Resolucao de phone em fromMe (linha ~394):**
```
const lidId = body.chatLid || body.chatId || rawPhone;
```

**Local 3 - Segundo uso no fromMe (linha ~412):**
```
const lidId = body.chatLid || body.chatId || rawPhone;
```

Isso faz o mapeamento ser criado/atualizado corretamente a cada mensagem inbound, e consultado com o lid correto em mensagens fromMe.

### Camada 2: Seguranca via Prompt (defesa em profundidade)

Mesmo corrigindo o bug, adicionar uma camada extra no prompt para que Clara SAIBA quando a secretaria esta respondendo.

**2A. Adicionar coluna `source` na tabela `whatsapp_messages`:**
```sql
ALTER TABLE whatsapp_messages
ADD COLUMN source text NOT NULL DEFAULT 'patient';
```

Valores possiveis: `patient`, `clara`, `secretary`

**2B. Atualizar os saves no webhook:**

| Situacao | source |
|----------|--------|
| Mensagem do paciente (inbound) | `patient` |
| Resposta da Clara (outbound via API) | `clara` |
| Mensagem manual da secretaria (fromMe, nao API) | `secretary` |

**2C. Ao montar contexto, incluir tag nas mensagens da secretaria:**

Quando buscar mensagens para enviar ao chat-atendimento, se `source = 'secretary'`, prefixar o conteudo com `[SECRETARIA]`:

```typescript
const formattedHistory = sessionMessages.map(msg => ({
  role: msg.direction === "inbound" ? "user" : "assistant",
  content: msg.source === "secretary"
    ? `[SECRETÁRIA] ${msg.content}`
    : msg.content,
}));
```

**2D. Adicionar regra no SYSTEM_PROMPT (chat-atendimento):**

Nova regra na secao 1 (Regras Inviolaveis):

```
REGRA DE PAUSA - ATENDIMENTO HUMANO:
- Se no historico recente houver mensagens marcadas com [SECRETARIA],
  significa que um atendente humano esta respondendo ao paciente.
- Nesse caso, Clara deve responder APENAS: "[PAUSA]"
- NAO cumprimentar, NAO tentar ajudar, NAO continuar o atendimento.
- A secretaria tem prioridade absoluta.
```

**2E. No webhook, detectar resposta "[PAUSA]" e nao enviar:**

Antes de enviar via Z-API:

```typescript
if (aiResponse.trim() === "[PAUSA]" || aiResponse.includes("[PAUSA]")) {
  console.log("Clara reconheceu pausa via prompt, nao enviando");
  return new Response(JSON.stringify({ success: true, claraPaused: true }), ...);
}
```

## Resumo das Alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/zapi-webhook/index.ts` | Corrigir chatLid vs chatId (3 locais), adicionar source nos saves, detectar [PAUSA] na resposta, incluir source no contexto |
| `supabase/functions/chat-atendimento/index.ts` | Adicionar regra de pausa via [SECRETARIA] no prompt |
| Migration SQL | Adicionar coluna `source` em `whatsapp_messages` |

## Por que duas camadas?

- **Camada 1 (chatLid)**: Corrige o problema principal. A pausa sera criada para o telefone CORRETO.
- **Camada 2 (prompt)**: Mesmo que alguma falha tecnica permita a Clara processar, ela VERA no contexto que a secretaria esta atuando e se recusara a responder.

## Resultado Esperado

1. Secretaria responde manualmente ao paciente
2. Webhook detecta fromMe, resolve o telefone CORRETO via chatLid
3. Pausa de 1h criada para o telefone correto
4. Proxima mensagem do paciente: shouldPauseClara retorna true, Clara nao e chamada
5. Se por qualquer motivo Clara FOR chamada, ela ve [SECRETARIA] no contexto e responde "[PAUSA]", que o webhook NAO envia

