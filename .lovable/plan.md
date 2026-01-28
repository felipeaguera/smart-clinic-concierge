
# Corrigir Envio de Mensagens Z-API

## Problema Identificado
A configuração do webhook está **correta** ("Ao receber" é o campo certo). O problema é que quando o sistema tenta **enviar** a resposta da Clara de volta, a Z-API exige o header `Client-Token` - que não está sendo enviado.

Erro nos logs:
```
Failed to send Z-API message: {"error":"your client-token is not configured"}
```

## Solução
Adicionar o header `Client-Token` na requisição de envio de mensagens via Z-API.

## Alterações Técnicas

### Arquivo: `supabase/functions/zapi-webhook/index.ts`

**Antes:**
```typescript
const sendResponse = await fetch(sendUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ phone, message: aiResponse }),
});
```

**Depois:**
```typescript
const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");

const sendResponse = await fetch(sendUrl, {
  method: "POST",
  headers: { 
    "Content-Type": "application/json",
    "Client-Token": clientToken || "",
  },
  body: JSON.stringify({ phone, message: aiResponse }),
});
```

## Resultado Esperado
1. Webhook recebe a mensagem (já funcionando)
2. Clara processa e gera resposta (já funcionando)
3. Sistema envia resposta com autenticação correta (será corrigido)
4. Paciente recebe a resposta da Clara no WhatsApp

## Passo Seguinte
Após aprovar, farei o deploy e você pode testar enviando uma nova mensagem no WhatsApp.
