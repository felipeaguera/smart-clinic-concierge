
# Plano: Clara pausa automaticamente quando secretária envia mensagem

## Resumo

Quando a secretária (ou qualquer humano) enviar uma mensagem manualmente pelo WhatsApp para um paciente, a Clara pausará automaticamente por **1 hora**. Após esse período, ela volta a responder normalmente sem precisar de ação manual.

## Como funciona hoje

1. Mensagens enviadas pela secretária chegam no webhook com `fromMe: true`
2. O webhook **ignora completamente** essas mensagens
3. A Clara continua respondendo normalmente ao paciente

## Como vai funcionar

1. Mensagens com `fromMe: true` serão processadas para detectar intervenção humana
2. O sistema verificará se a mensagem foi enviada pela API (Clara) ou manualmente (secretária)
3. Se for mensagem manual → cria uma **pausa automática de 1 hora**
4. Durante a pausa, Clara não responde
5. Após 1 hora, Clara volta automaticamente

## Mudanças no Banco de Dados

Adicionar uma nova coluna na tabela `human_handoff_queue`:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `auto_pause_until` | timestamp with time zone | Até quando a Clara deve ficar em silêncio |

Isso permite diferenciar:
- **Handoff manual** (`status = 'open'`): Clara para até ser resolvido manualmente
- **Pausa automática** (`auto_pause_until > now()`): Clara para por 1 hora, depois volta sozinha

## Mudanças na Edge Function (zapi-webhook)

### 1. Processar mensagens `fromMe`

Em vez de ignorar completamente:

```text
SE fromMe = true:
   - Verificar se já é mensagem salva pela Clara (comparar provider_message_id)
   - Se NÃO for da Clara → é mensagem manual da secretária
   - Criar/atualizar pausa automática de 1 hora para esse telefone
```

### 2. Verificar pausa antes de processar

```text
ANTES de chamar a IA:
   - Verificar se existe handoff "open" OU pausa automática ativa
   - Se sim → não processar com IA
```

## Fluxo Visual

```text
┌─────────────────────────────────────────────────────────────────┐
│                    MENSAGEM RECEBIDA                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   fromMe?       │
                    └─────────────────┘
                         │         │
                    SIM  │         │  NÃO
                         ▼         │
              ┌──────────────────┐ │
              │ É mensagem       │ │
              │ da Clara (API)?  │ │
              └──────────────────┘ │
                  │          │     │
             SIM  │          │ NÃO │
                  ▼          ▼     │
            [Ignorar]   [Criar     │
                        pausa de   │
                        1 hora]    │
                              │    │
                              │    ▼
                              │  ┌──────────────────┐
                              │  │ Handoff open OU  │
                              │  │ pausa ativa?     │
                              │  └──────────────────┘
                              │       │         │
                              │  SIM  │         │ NÃO
                              │       ▼         ▼
                              │  [Ignorar]  [Clara responde]
                              │
                              ▼
                         [FIM]
```

## Arquivos a Modificar

1. **Migration SQL** - Adicionar coluna `auto_pause_until`
2. **`supabase/functions/zapi-webhook/index.ts`** - Lógica de detecção e pausa automática

## Detalhes Técnicos

### Detectar se mensagem é da Clara vs Secretária

Quando a Clara envia mensagem via API, ela salva o `provider_message_id` na tabela `whatsapp_messages`. Podemos usar isso para diferenciar:

- Se `fromMe = true` **E** `provider_message_id` já existe no banco → foi a Clara
- Se `fromMe = true` **E** `provider_message_id` NÃO existe → foi a secretária

### Lógica da pausa

```text
Ao detectar mensagem manual:
   1. Verificar se já existe pausa para esse telefone
   2. Se existir → atualizar auto_pause_until = now() + 1 hora
   3. Se não existir → criar entrada com auto_pause_until = now() + 1 hora
```

### Ao verificar se Clara deve responder

```text
Buscar da tabela human_handoff_queue WHERE:
   - phone = telefone E
   - (status = 'open' OU auto_pause_until > now())
```

## Resultado Esperado

1. Paciente conversa com Clara ✅
2. Secretária vê a conversa e decide intervir
3. Secretária envia mensagem manual pelo WhatsApp
4. Sistema detecta automaticamente e **pausa Clara por 1 hora**
5. Secretária conversa com paciente livremente
6. Após 1 hora → Clara volta automaticamente
7. Se secretária enviar outra mensagem antes de 1 hora → reinicia o timer

## Bônus: Badge na interface

O badge vermelho no menu continuará funcionando, mas agora também poderá mostrar pausas automáticas (opcional - podemos fazer depois se quiser).
