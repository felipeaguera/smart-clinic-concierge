

# Plano: Corrigir detecção de mensagens manuais da secretária

## Problema Identificado

A Clara não está detectando quando a secretária responde manualmente porque a **Z-API não está configurada para enviar webhooks de mensagens enviadas pelo próprio WhatsApp**.

### Diagnóstico

Analisei os logs do webhook e encontrei:
- ✅ **Todas as mensagens nos logs têm `fromMe: false`** (apenas mensagens de pacientes)
- ❌ **Nenhuma mensagem com `fromMe: true`** sendo recebida
- ❌ **Nenhum log de "auto-pause" ou "Manual message"** sendo criado

A lógica de pausa automática está implementada corretamente no código (`zapi-webhook/index.ts`), mas ela nunca é executada porque a Z-API não está enviando os webhooks necessários.

### Causa Raiz

A Z-API tem uma configuração específica que precisa ser habilitada:
- **Opção**: "Notificar mensagens enviadas por mim" (ou `update-webhook-received-delivery`)
- **Onde**: Painel administrativo da Z-API ou via API
- **Efeito**: Quando habilitada, o webhook recebe também as mensagens enviadas manualmente pelo WhatsApp

---

## Solução

### Opção 1: Habilitar via Painel Z-API (Recomendado)

1. Acessar o painel da Z-API
2. Ir em **Instâncias** → clicar no olho para visualizar
3. Clicar nos 3 pontinhos → **"Editar"**
4. Marcar a opção **"Notificar mensagens enviadas por mim"**
5. Salvar

### Opção 2: Habilitar via API (Automático)

Podemos adicionar uma chamada na função `zapi-status` para configurar automaticamente essa opção quando o WhatsApp estiver conectado.

---

## Mudanças Técnicas

### 1. Atualizar `zapi-status/index.ts`

Quando verificar que está conectado, chamar o endpoint da Z-API para habilitar a opção:

```
PUT https://api.z-api.io/instances/{instanceId}/token/{zapiToken}/update-webhook-received-delivery
Body: { "value": "URL_DO_WEBHOOK" }
```

### 2. Melhorar logs no `zapi-webhook/index.ts`

Adicionar logs mais claros para facilitar depuração:
- Log explícito quando mensagem `fromMe` é recebida
- Log quando pausa automática é criada/atualizada
- Log quando Clara é pausada para um telefone

### 3. Verificar se webhook delivery está configurado

Na função `zapi-status`, verificar se a opção está habilitada e mostrar um aviso na interface se não estiver.

---

## Fluxo Esperado Após Correção

```text
1. Secretária envia mensagem manual pelo WhatsApp
2. Z-API envia webhook com fromMe: true
3. Webhook verifica se é da Clara (não existe no banco)
4. Webhook cria pausa automática de 1 hora
5. Próxima mensagem do paciente: Clara não responde
6. Após 1 hora: Clara volta automaticamente
```

---

## Arquivos a Modificar

1. **`supabase/functions/zapi-status/index.ts`**
   - Adicionar lógica para configurar webhook de mensagens enviadas
   - Verificar se configuração está ativa

2. **`supabase/functions/zapi-webhook/index.ts`**
   - Melhorar logs para depuração
   - Garantir que a lógica de fromMe funcione corretamente

3. **`src/pages/admin/Integracao.tsx`** (opcional)
   - Mostrar status da configuração "Notificar mensagens enviadas"
   - Botão para habilitar automaticamente

---

## Ação Imediata Recomendada

Enquanto eu implemento a solução automática, você pode **resolver o problema imediatamente** acessando o painel da Z-API e habilitando a opção "Notificar mensagens enviadas por mim".

Isso fará com que a lógica já implementada comece a funcionar.

---

## Validação

Após a correção:
1. Secretária envia mensagem manual para um paciente
2. Verificar nos logs: deve aparecer "Manual message from secretary detected"
3. Paciente responde
4. Verificar nos logs: deve aparecer "Clara is paused for this phone"
5. Após 1 hora (ou resolver manualmente): Clara volta a responder

