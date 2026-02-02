

# Plano: Sincronização em Tempo Real Completa da Agenda

## O que você quer

Quando uma secretária marcar um exame ou adicionar algo na agenda, **todas as outras secretárias** que estiverem com a plataforma aberta devem ver a atualização automaticamente, sem precisar atualizar a página.

---

## Situação Atual

| Componente | Status |
|------------|--------|
| Tabela `appointments` no realtime | Habilitada |
| Hook `useRealtimeAppointments` | Implementado |
| Tabela `schedule_openings` no realtime | **NÃO habilitada** |

O sistema **já tem** sincronização em tempo real para agendamentos (appointments), mas precisamos verificar se está funcionando corretamente e adicionar também as agendas extras (schedule_openings).

---

## O que vou fazer

### 1. Habilitar realtime para `schedule_openings`

Quando uma secretária adicionar uma data extra de atendimento, as outras secretárias verão automaticamente.

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_openings;
```

### 2. Criar hook para sincronização de agendas extras

Novo hook `useRealtimeScheduleOpenings` para atualizar a lista de agendas extras em tempo real.

### 3. Melhorar o hook existente de appointments

O hook atual só invalida quando muda o médico/data específicos. Vou garantir que ele funcione de forma mais abrangente.

---

## Como vai funcionar

```text
┌─────────────────────────────────────────────────┐
│ Secretária A marca um exame às 14:00            │
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│ Banco de dados recebe INSERT no appointments    │
│ Supabase Realtime envia notificação             │
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│ Secretária B (com a mesma tela aberta)          │
│ Recebe evento realtime → atualiza grade         │
│ Vê o novo agendamento aparecer automaticamente  │
└─────────────────────────────────────────────────┘
```

---

## Mudanças por Arquivo

### 1. Migração SQL

**Adicionar `schedule_openings` ao realtime:**
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_openings;
```

### 2. Novo arquivo: `src/hooks/useRealtimeScheduleOpenings.ts`

Hook para sincronizar agendas extras em tempo real.

### 3. Atualizar: `src/pages/admin/Agendamentos.tsx`

Importar e usar o novo hook para sincronização de schedule_openings.

### 4. Verificar: `src/hooks/useRealtimeAppointments.ts`

Garantir que o canal está funcionando corretamente e adicionar log para debug.

---

## Resultado Final

| Ação | Atualização em tempo real |
|------|---------------------------|
| Nova consulta/exame marcado | Sim |
| Consulta editada | Sim |
| Consulta cancelada | Sim |
| Data extra adicionada | Sim |

Todas as secretárias conectadas verão as mudanças **instantaneamente**, sem precisar atualizar a página.

