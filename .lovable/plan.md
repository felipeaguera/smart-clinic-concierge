

## Plano: Sincronização em Tempo Real para Múltiplas Secretárias

### Problema
Atualmente, quando a Secretária A marca um exame, a Secretária B não vê a alteração automaticamente. Isso pode causar conflitos de agendamento.

### Solução: Supabase Realtime + Auto-invalidação

#### 1. Habilitar Realtime na tabela `appointments`

Criar migration para ativar publicação realtime:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
```

#### 2. Criar hook personalizado `useRealtimeAppointments`

Novo arquivo `src/hooks/useRealtimeAppointments.ts`:

```typescript
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useRealtimeAppointments(doctorId: string, dateStr: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!doctorId) return;

    const channel = supabase
      .channel(`appointments-${doctorId}-${dateStr}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'appointments',
          filter: `doctor_id=eq.${doctorId}`,
        },
        (payload) => {
          console.log('[Realtime] Appointment change detected:', payload);
          // Invalidar cache para forcar refetch
          queryClient.invalidateQueries({
            queryKey: ['appointments', doctorId, dateStr],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [doctorId, dateStr, queryClient]);
}
```

#### 3. Integrar no `Agendamentos.tsx`

Adicionar o hook na página principal:

```typescript
import { useRealtimeAppointments } from '@/hooks/useRealtimeAppointments';

// Dentro do componente, após as queries:
useRealtimeAppointments(selectedDoctorId, format(selectedDate, 'yyyy-MM-dd'));
```

#### 4. Feedback visual de sincronização (opcional)

Adicionar indicador de "última atualização" no header da agenda para dar confiança às secretárias de que os dados estão sincronizados.

### Resultado Esperado

| Ação | Comportamento |
|------|---------------|
| Secretária A marca um exame | Dados salvos no banco |
| Secretária B vê a alteração? | **SIM** - atualiza automaticamente em 1-2 segundos |

### Arquivos a Modificar

1. **Nova migration SQL** - Habilitar realtime
2. **`src/hooks/useRealtimeAppointments.ts`** - Novo hook (criar)
3. **`src/pages/admin/Agendamentos.tsx`** - Importar e usar o hook

### Considerações de Performance

- O canal realtime é filtrado por `doctor_id`, evitando tráfego desnecessário
- Quando a secretária muda de médico/data, o canal antigo é desconectado e um novo é criado
- O React Query só refaz a query quando recebe notificação, não fica fazendo polling

