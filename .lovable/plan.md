

## Plano: Integração WhatsApp via Z-API - MVP Completo

### Visão Geral

Implementar a integração do WhatsApp conectando a IA Clara já existente ao canal WhatsApp. Inclui:
- Novo item "Integração" no menu lateral visível para TODOS os usuários
- Badge vermelho no menu quando há atendimentos pendentes
- Página com duas abas: "WhatsApp" (QR/status) e "Atendimentos Pendentes" (handoffs)
- Edge Functions para webhook e verificação de status

---

### Arquitetura do Fluxo

```text
WhatsApp → Z-API → zapi-webhook (Edge Function)
                         │
                         ├─ 1. Autenticar via ZAPI_CLIENT_TOKEN
                         ├─ 2. Ignorar msg antiga (>2min OU isOld/isFromHistory)
                         ├─ 3. Deduplicar via provider_message_id
                         ├─ 4. Verificar handoff_status = 'open' para o telefone
                         │       └─ Se open → salvar msg mas NÃO processar IA
                         │
                         ├─ 5. Salvar msg em whatsapp_messages (TTL 24h)
                         ├─ 6. Carregar últimas 15 msgs do telefone para contexto
                         ├─ 7. Chamar chat-atendimento (Clara) passando contexto
                         │
                         ├─ 8a. humanHandoff = true?
                         │       └─ Inserir human_handoff_queue (open)
                         │       └─ NÃO enviar resposta via Z-API
                         │
                         └─ 8b. humanHandoff = false
                                 └─ Enviar resposta via Z-API
                                 └─ Salvar outbound em whatsapp_messages
```

---

### 1. Banco de Dados (Migrations)

#### Tabela: `whatsapp_messages`

Armazena mensagens para contexto da IA com TTL de 24 horas.

| Coluna               | Tipo        | Descrição                                |
|----------------------|-------------|------------------------------------------|
| id                   | uuid        | PK, gen_random_uuid()                    |
| phone                | text        | Telefone (+5511999999999)                |
| provider_message_id  | text        | ID único da Z-API (UNIQUE, idempotência) |
| direction            | text        | 'inbound' ou 'outbound'                  |
| content              | text        | Texto da mensagem                        |
| created_at           | timestamptz | now()                                    |
| expires_at           | timestamptz | now() + interval '24 hours'              |

**RLS**: Apenas service_role (webhook). Admins podem SELECT para debug.

#### Tabela: `human_handoff_queue`

Fila de atendimentos aguardando humano.

| Coluna        | Tipo        | Descrição                              |
|---------------|-------------|----------------------------------------|
| id            | uuid        | PK, gen_random_uuid()                  |
| phone         | text        | Telefone do paciente                   |
| patient_name  | text        | Nome do paciente (se disponível)       |
| status        | text        | 'open' ou 'resolved' (default: 'open') |
| created_at    | timestamptz | now()                                  |
| resolved_at   | timestamptz | null                                   |
| resolved_by   | uuid        | FK para auth.users (quem resolveu)     |

**RLS**: Admins podem SELECT e UPDATE (para resolver).

**Realtime**: Habilitar para atualizações instantâneas do badge.

#### Tabela: `whatsapp_config`

Armazena configuração e status da conexão Z-API.

| Coluna          | Tipo        | Descrição                     |
|-----------------|-------------|-------------------------------|
| id              | uuid        | PK, gen_random_uuid()         |
| is_connected    | boolean     | Status atual                  |
| last_check      | timestamptz | Último polling                |
| qr_code_base64  | text        | QR atual (se desconectado)    |
| updated_at      | timestamptz | Última atualização            |

---

### 2. Secrets Necessários

| Secret             | Descrição                         |
|--------------------|-----------------------------------|
| ZAPI_INSTANCE_ID   | ID da instância Z-API             |
| ZAPI_TOKEN         | Token de autenticação da Z-API    |
| ZAPI_CLIENT_TOKEN  | Token para validar webhook        |

---

### 3. Edge Functions

#### 3.1 `zapi-webhook` (Recebe mensagens do WhatsApp)

Responsabilidades:
1. Autenticar header `x-client-token` com secret `ZAPI_CLIENT_TOKEN`
2. Ignorar mensagens com `isOld`, `isFromHistory`, ou timestamp < now()-2min
3. Deduplicar via `provider_message_id` (ON CONFLICT DO NOTHING)
4. Verificar se existe handoff `open` para o telefone:
   - Se sim: salvar mensagem mas retornar 200 sem chamar IA
   - Se não: continuar processamento
5. Salvar mensagem inbound em `whatsapp_messages`
6. Carregar últimas 15 mensagens do telefone para contexto
7. Chamar `chat-atendimento` passando histórico formatado
8. Se `humanHandoff: true`:
   - Inserir em `human_handoff_queue` com status `open` e nome do paciente
   - NÃO enviar resposta via Z-API
9. Se `humanHandoff: false`:
   - Enviar resposta via Z-API (`send-text`)
   - Salvar outbound em `whatsapp_messages`

#### 3.2 `zapi-status` (Verifica conexão e retorna QR)

Responsabilidades:
1. Chamar endpoint Z-API `/status` para verificar conexão
2. Se desconectado, buscar QR Code via `/qr-code/image`
3. Retornar `{ connected: boolean, qrCodeBase64?: string }`

---

### 4. Interface do Usuário

#### 4.1 Novo Item no Menu: "Integração" com Badge

Adicionar no `AdminSidebar.tsx`:
- Ícone: `Plug` do lucide-react
- URL: `/admin/integracao`
- Visível para **TODOS** os usuários
- **Badge vermelho** quando há handoffs com status `open`

```text
┌─────────────────────────┐
│   📋 GESTÃO             │
├─────────────────────────┤
│ 👥 Médicos              │
│ 📄 Serviços             │
│ 📅 Agendamentos         │
│ 🔌 Integração 🔴 ← NOVO │
│ 👤 Usuários (admin)     │
└─────────────────────────┘
```

O badge vermelho:
- Aparece apenas quando `COUNT(*) > 0` em `human_handoff_queue WHERE status = 'open'`
- Atualiza em tempo real via Supabase Realtime
- Mostra o número de pendentes (ex: "3")

#### 4.2 Página `/admin/integracao` com Tabs

Layout com duas abas usando componente Tabs existente:

```text
┌─────────────────────────────────────────────────────────────┐
│  Integração                                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [ WhatsApp ]  [ Atendimentos Pendentes (3) ]              │
│  ─────────────────────────────────────────────              │
│                                                             │
│  (conteúdo da aba selecionada)                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Aba 1: WhatsApp**
- Status da conexão (badge verde/vermelho)
- QR Code se desconectado
- Polling automático a cada 15 segundos

```text
┌─────────────────────────────────────────────┐
│                                             │
│    Status: 🔴 Desconectado                  │
│                                             │
│    ┌─────────────────┐                      │
│    │                 │                      │
│    │    QR CODE      │                      │
│    │                 │                      │
│    └─────────────────┘                      │
│                                             │
│    Escaneie o QR Code com o WhatsApp        │
│    para conectar a clínica.                 │
│                                             │
└─────────────────────────────────────────────┘
```

**Aba 2: Atendimentos Pendentes**
- Lista de handoffs com status `open`
- Cada item mostra: Nome + Telefone + Tempo de espera
- Botão "Marcar como Resolvido" em cada item
- Atualização em tempo real

```text
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Pacientes aguardando atendimento humano                    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Maria Silva                                          │   │
│  │ +55 11 99999-1234 • Aguardando há 12 minutos        │   │
│  │                              [ Marcar como Resolvido]│   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ João Santos                                          │   │
│  │ +55 11 98888-5678 • Aguardando há 5 minutos         │   │
│  │                              [ Marcar como Resolvido]│   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ (Sem nome)                                           │   │
│  │ +55 11 97777-9012 • Aguardando há 2 minutos         │   │
│  │                              [ Marcar como Resolvido]│   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Se não houver pendentes:
```text
┌─────────────────────────────────────────────┐
│                                             │
│    ✅ Nenhum atendimento pendente           │
│                                             │
│    Todos os pacientes estão sendo           │
│    atendidos pela assistente Clara.         │
│                                             │
└─────────────────────────────────────────────┘
```

---

### 5. Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| **Migration SQL** | CRIAR | Tabelas `whatsapp_messages`, `human_handoff_queue`, `whatsapp_config` + RLS + Realtime |
| `supabase/functions/zapi-webhook/index.ts` | CRIAR | Webhook principal |
| `supabase/functions/zapi-status/index.ts` | CRIAR | Verificar status Z-API |
| `supabase/config.toml` | MODIFICAR | Adicionar novas functions |
| `src/pages/admin/Integracao.tsx` | CRIAR | Página com tabs (WhatsApp + Pendentes) |
| `src/components/admin/AdminSidebar.tsx` | MODIFICAR | Adicionar item "Integração" com badge |
| `src/App.tsx` | MODIFICAR | Adicionar rota `/admin/integracao` |
| `src/hooks/useRealtimeHandoffs.ts` | CRIAR | Hook Realtime para contador de pendentes |

---

### 6. Fluxo de Bloqueio (Handoff Ativo)

Quando existe `human_handoff_queue.status = 'open'` para um telefone:

1. Nova mensagem chega no webhook
2. Webhook consulta: `SELECT id FROM human_handoff_queue WHERE phone = $1 AND status = 'open' LIMIT 1`
3. **Se encontrar registro**:
   - Salvar mensagem em `whatsapp_messages` (para manter contexto)
   - Retornar 200 imediatamente
   - IA permanece "silenciosa"
4. **Ao clicar "Marcar como Resolvido"**:
   - Status muda para `resolved`
   - `resolved_at` = now()
   - `resolved_by` = user_id do admin
   - Próxima mensagem do paciente será processada pela Clara

---

### 7. Ordem de Implementação

1. Solicitar secrets Z-API (ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN)
2. Criar migration com as 3 tabelas + RLS + Realtime
3. Criar Edge Function `zapi-status`
4. Criar página `/admin/integracao` com tabs
5. Modificar `AdminSidebar.tsx` com item + badge
6. Modificar `App.tsx` com rota
7. Criar hook `useRealtimeHandoffs`
8. Criar Edge Function `zapi-webhook`
9. Testar fluxo completo

---

### 8. Mudanças vs Plano Anterior

| Antes | Agora |
|-------|-------|
| Widget flutuante em todas as páginas | Aba dentro da página Integração |
| Handoffs sempre visíveis | Badge vermelho no menu indica pendentes |
| Pode distrair em outras telas | Limpo e organizado, só vê quando precisa |

