
# Solucao Definitiva: Pausa da Clara via chatLid

## Problema Raiz (com evidencia do banco)

A funcao `getOrMapLidToPhone` tem um bug critico: ela NUNCA atualiza mapeamentos existentes.

Evidencia do banco de dados:
```text
whatsapp_lid_mappings:
  lid_id:     242094522282192@lid
  phone:      5515991008960     (ERRADO - mapeamento de 5 dias atras)
  updated_at: 2026-02-05        (NUNCA foi atualizado!)

Paciente REAL usando esse lid: 5516981275767 (Felipe Aguera)
```

Fluxo do bug:
1. Secretaria envia mensagem manual ao paciente 5516981275767
2. Z-API envia webhook com `chatLid: 242094522282192@lid`
3. Codigo chama `getOrMapLidToPhone("242094522282192@lid", "5516981275767")`
4. Funcao encontra mapeamento existente -> retorna `5515991008960` (ERRADO)
5. Pausa criada para `5515991008960` em vez de `5516981275767`
6. Paciente `5516981275767` continua recebendo respostas da Clara

## Solucao: Usar chatLid como chave de pausa (bypass total da resolucao de telefone)

A insight chave: o campo `chatLid` e o MESMO identificador tanto na mensagem do paciente (inbound) quanto na mensagem da secretaria (fromMe). Ele identifica a CONVERSA, nao o telefone. Entao podemos usalo diretamente para a pausa, sem precisar resolver telefone nenhum.

### Alteracao 1: Adicionar coluna `chat_lid` na tabela human_handoff_queue

```sql
ALTER TABLE public.human_handoff_queue
ADD COLUMN chat_lid text;
```

### Alteracao 2: Corrigir `getOrMapLidToPhone` para SEMPRE atualizar mapeamentos

Quando a funcao recebe um `knownPhone` diferente do mapeamento existente, ela deve ATUALIZAR:

```text
ANTES (bugado):
  1. Encontra mapeamento existente
  2. Retorna telefone antigo (NUNCA atualiza)
  3. Ignora o knownPhone novo

DEPOIS (corrigido):
  1. Se knownPhone fornecido -> SEMPRE upsert e retornar knownPhone
  2. Se nao tem knownPhone -> buscar mapeamento existente
  3. Prioridade: knownPhone > mapeamento existente
```

### Alteracao 3: Salvar chatLid ao criar auto-pause (fromMe handler)

Quando a secretaria envia mensagem manual:
```text
1. Extrair chatLid = body.chatLid || body.chatId
2. Salvar auto-pause com AMBOS: phone (resolvedPhone) E chat_lid (chatLid)
3. Isso garante que a pausa funcione por qualquer um dos dois caminhos
```

### Alteracao 4: Verificar pausa por chatLid TAMBEM (shouldPauseClara)

Na funcao `shouldPauseClara`, adicionar verificacao dupla:
```text
ANTES: verifica apenas por phone
DEPOIS: verifica por phone OU por chat_lid

Se qualquer um dos dois tiver pausa ativa -> Clara NAO responde
```

O inbound do paciente traz AMBOS: `body.phone` E `body.chatLid`. Passamos os dois para a funcao.

### Alteracao 5: Simplificar fromMe handler

No handler de mensagens fromMe (secretaria), simplificar a logica:
```text
1. PRIMARY: usar body.phone diretamente (Z-API SEMPRE inclui o telefone do destinatario)
2. SECONDARY: usar chatLid para criar pausa redundante
3. INSURANCE: resolver via lid mapping como fallback
```

## Resumo das alteracoes

| Arquivo | O que muda |
|---------|-----------|
| Migration SQL | Adicionar coluna `chat_lid` em `human_handoff_queue` |
| `supabase/functions/zapi-webhook/index.ts` | Corrigir `getOrMapLidToPhone` (sempre atualizar), passar chatLid para createOrUpdateAutoPause, passar chatLid para shouldPauseClara |

## Por que esta solucao e definitiva?

O problema fundamental de TODAS as tentativas anteriores era depender de resolucao de telefone (phone resolution), que falha quando:
- Mapeamento lid stale (como agora)
- body.phone ausente ou incorreto
- Race conditions no DB

Ao usar `chatLid` como chave ADICIONAL de pausa, eliminamos essa dependencia:
- chatLid e o MESMO valor na mensagem da secretaria E do paciente
- Nao precisa resolver telefone para funcionar
- E imutavel dentro da mesma conversa

Fluxo com a correcao:
```text
1. Secretaria responde manualmente
2. Webhook detecta fromMe=true, fromApi=false
3. Salva auto-pause com chat_lid="242094522282192@lid" E phone="5516981275767"
4. Paciente envia mensagem
5. shouldPauseClara verifica por phone="5516981275767" OU chat_lid="242094522282192@lid"
6. Encontra pausa ativa -> Clara NAO responde
7. Mesmo se phone resolver errado, chatLid SEMPRE bate
```
