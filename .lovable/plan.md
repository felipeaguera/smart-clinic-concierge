
# Plano: Correção do Mecanismo de Pausa da Clara

## Diagnóstico - Problemas Identificados

### Problema 1: Identificadores `@lid` salvos no banco
No banco de dados encontrei um registro com `phone: 227027693117632@lid` na tabela `human_handoff_queue`. Isso significa que a função `resolveRealPhoneFromReference` está **falhando em alguns casos** e o identificador interno do Z-API está sendo salvo ao invés do telefone real do paciente.

**Consequência**: A pausa é criada para um identificador inválido, não para o telefone real da paciente. Quando ela envia uma nova mensagem, o sistema não encontra a pausa (pois o telefone real é diferente do `@lid`).

### Problema 2: Falha na resolução via `referenceMessageId`
A função `resolveRealPhoneFromReference` só funciona se:
1. A secretária responder **citando** uma mensagem anterior (reply/quote)
2. A mensagem citada existir no banco `whatsapp_messages`

Se a secretária enviar uma mensagem nova (sem citar), E o Z-API usar um identificador `@lid`, o sistema não consegue descobrir o telefone real.

### Problema 3: Mensagens da secretária não salvas no banco
As mensagens enviadas manualmente pela secretária **não estão sendo salvas** na tabela `whatsapp_messages`. O fluxo atual só salva a mensagem se for:
- `inbound` (paciente → clínica)
- `outbound` da Clara (via API)

Quando a secretária envia pelo celular, o webhook recebe o evento `fromMe: true`, mas o código retorna sem salvar a mensagem. Isso impede que futuras mensagens usem o `referenceMessageId` para resolver o telefone.

### Problema 4: Falta de mapeamento Lid → Telefone
O Z-API pode usar internamente identificadores `@lid` para algumas conversas. Não há um mapeamento persistente de `lid_id` → `phone` real no sistema.

---

## Solução Proposta

### Correção 1: Salvar mensagens manuais da secretária no banco
Quando detectar `fromMe: true` (mensagem manual), salvar a mensagem no `whatsapp_messages` com `direction: 'outbound'`. Isso permite:
- Histórico completo da conversa
- Usar `referenceMessageId` de mensagens anteriores

### Correção 2: Criar tabela de mapeamento Lid → Telefone
Criar uma tabela `whatsapp_lid_mappings` que armazena a relação entre identificadores `@lid` e telefones reais. Sempre que uma mensagem chegar (inbound ou outbound) com um `@lid` E o telefone real for conhecido, salvar o mapeamento.

### Correção 3: Melhorar resolução do telefone real
Na função que detecta mensagens manuais da secretária:
1. **Primeiro**: Tentar extrair telefone do payload (campo `phone`, `chatId`, `to`, etc.)
2. **Segundo**: Buscar na tabela de mapeamento lid → phone
3. **Terceiro**: Buscar via `referenceMessageId` nas mensagens existentes
4. **Último recurso**: Buscar última mensagem inbound recente no banco

### Correção 4: Validar antes de criar pausa
A função `createOrUpdateAutoPause` já rejeita telefones com `@` - manter essa validação, mas adicionar logs mais detalhados para debug.

### Correção 5: Ignorar status `resolved` na checagem de pause
**BUG CRÍTICO encontrado**: A função `shouldPauseClara` só verifica pausas com `status = 'resolved'`. Se existir uma pausa com `status = 'open'` e `auto_pause_until` preenchido, ela não é considerada na segunda checagem.

---

## Alterações Técnicas

### Tabela Nova: `whatsapp_lid_mappings`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| lid_id | text (PK) | Identificador @lid do Z-API |
| phone | text | Telefone real do paciente |
| created_at | timestamp | Data de criação |
| updated_at | timestamp | Última atualização |

### Modificações no `zapi-webhook/index.ts`

**1. Nova função para mapear/resolver lid:**
```typescript
async function getOrMapLidToPhone(supabase, lidId: string, knownPhone?: string): Promise<string | null> {
  // Se já é telefone normal, retornar
  if (!lidId.includes("@lid")) return lidId;
  
  // Tentar buscar mapeamento existente
  const { data: mapping } = await supabase
    .from("whatsapp_lid_mappings")
    .select("phone")
    .eq("lid_id", lidId)
    .maybeSingle();
    
  if (mapping?.phone) return mapping.phone;
  
  // Se temos um telefone conhecido, criar mapeamento
  if (knownPhone && !knownPhone.includes("@")) {
    await supabase.from("whatsapp_lid_mappings").upsert({
      lid_id: lidId,
      phone: knownPhone,
      updated_at: new Date().toISOString()
    });
    return knownPhone;
  }
  
  return null;
}
```

**2. Melhorar detecção de telefone em mensagens fromMe:**
```typescript
// Tentar múltiplas fontes para o telefone
const phoneFromPayload = body.phone || body.to || body.chatId?.replace("@c.us", "");
const phoneFromChat = body.chat?.phone;
const phoneFromParticipant = body.participant?.replace("@c.us", "");

let resolvedPhone = phoneFromPayload || phoneFromChat || phoneFromParticipant;

// Se ainda é @lid, tentar resolver via mapeamento
if (resolvedPhone?.includes("@lid")) {
  resolvedPhone = await getOrMapLidToPhone(supabase, resolvedPhone);
}

// Se ainda não resolveu, tentar via referenceMessageId
if (!resolvedPhone || resolvedPhone.includes("@")) {
  resolvedPhone = await resolveRealPhoneFromReference(supabase, body);
}

// Último recurso: buscar última mensagem inbound recente
if (!resolvedPhone || resolvedPhone.includes("@")) {
  const { data: lastInbound } = await supabase
    .from("whatsapp_messages")
    .select("phone")
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  
  // Só usar se for uma mensagem dos últimos 30 min (conversa ativa)
  // ...
}
```

**3. Salvar mensagens manuais da secretária:**
```typescript
if (isFromMe && !isFromClara && resolvedPhone) {
  // Salvar mensagem manual no histórico
  await supabase.from("whatsapp_messages").insert({
    phone: resolvedPhone,
    provider_message_id: messageId,
    direction: "outbound",
    content: text || "(mensagem manual)",
  });
  
  // Criar pausa
  await createOrUpdateAutoPause(supabase, resolvedPhone, null);
}
```

**4. Corrigir shouldPauseClara para checar QUALQUER status:**
```typescript
// Check for active auto-pause (ANY status, not just resolved)
const { data: autoPause } = await supabase
  .from("human_handoff_queue")
  .select("id, auto_pause_until, status")
  .eq("phone", phone)
  .gt("auto_pause_until", now)
  .order("auto_pause_until", { ascending: false })
  .limit(1)
  .maybeSingle();
```

**5. Criar mapeamento lid → phone em mensagens inbound:**
```typescript
// Em mensagens inbound, se temos chatId com @lid E phone real
if (body.chatId?.includes("@lid") && phone && !phone.includes("@")) {
  await getOrMapLidToPhone(supabase, body.chatId, phone);
}
```

---

## Ordem de Implementação

| Passo | Descrição |
|-------|-----------|
| 1 | Criar migration para tabela `whatsapp_lid_mappings` |
| 2 | Adicionar função `getOrMapLidToPhone` no webhook |
| 3 | Melhorar extração de telefone em mensagens `fromMe` |
| 4 | Salvar mensagens manuais da secretária no banco |
| 5 | Corrigir `shouldPauseClara` para ignorar filtro de status |
| 6 | Adicionar mapeamento lid → phone em mensagens inbound |
| 7 | Adicionar logs detalhados para debug |
| 8 | Deploy e teste end-to-end |

---

## Resultado Esperado

Após as correções:
1. Quando a secretária enviar mensagem manual → pausa criada corretamente
2. Quando paciente enviar nova mensagem → sistema encontra a pausa e Clara não responde
3. Identificadores `@lid` são mapeados para telefones reais
4. Mensagens manuais ficam salvas no histórico
5. Logs detalhados para debug caso ainda haja problemas
