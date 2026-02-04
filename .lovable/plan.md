
# Plano: Correção do Mecanismo de Pausa da Clara

## ✅ Status: IMPLEMENTADO

---

## Correções Implementadas

### 1. ✅ Nova tabela `whatsapp_lid_mappings`
Tabela criada para mapear identificadores `@lid` do Z-API para telefones reais.

### 2. ✅ Função `getOrMapLidToPhone`
Função que busca/cria mapeamentos entre `@lid` e telefones reais.

### 3. ✅ Função `extractPhoneFromPayload`
Extrai telefone de múltiplas fontes do payload Z-API (phone, from, to, chatId, chat.phone, participant).

### 4. ✅ Resolução multi-estratégia para mensagens `fromMe`
Ordem de tentativa:
1. Extrair diretamente do payload (campo sem `@`)
2. Buscar na tabela de mapeamento `whatsapp_lid_mappings`
3. Buscar via `referenceMessageId` nas mensagens existentes
4. Fallback: última mensagem inbound dos últimos 30 minutos

### 5. ✅ Salvar mensagens manuais da secretária
Quando detecta mensagem manual, salva no `whatsapp_messages` com `direction: 'outbound'` para manter histórico completo.

### 6. ✅ Correção em `shouldPauseClara`
Removido o filtro `.eq("status", "resolved")` - agora verifica QUALQUER registro com `auto_pause_until` no futuro.

### 7. ✅ Mapeamento automático em mensagens inbound
Quando mensagem inbound chega com `chatId` contendo `@lid` e telefone real conhecido, cria o mapeamento automaticamente.

---

## Resultado Esperado

| Cenário | Comportamento |
|---------|---------------|
| Secretária responde manualmente | Pausa criada corretamente, mensagem salva |
| Paciente envia nova mensagem | Sistema encontra pausa e Clara não responde |
| Z-API usa `@lid` | Mapeado para telefone real automaticamente |
| Mensagem com `referenceMessageId` | Telefone resolvido via mensagem citada |
| Nenhum mapeamento encontrado | Fallback para última mensagem inbound recente |

---

## Próximo Passo

Testar o fluxo end-to-end:
1. Enviar mensagem do paciente via WhatsApp
2. Verificar se Clara responde
3. Enviar mensagem manual (secretária)
4. Verificar nos logs se pausa foi criada corretamente
5. Enviar nova mensagem do paciente
6. Verificar se Clara NÃO responde (pausa ativa)
