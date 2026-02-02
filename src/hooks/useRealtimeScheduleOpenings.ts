import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useRealtimeScheduleOpenings(doctorId: string | null, dateStr: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!doctorId) return;

    const channel = supabase
      .channel(`schedule-openings-${doctorId}-${dateStr}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'schedule_openings',
          filter: `doctor_id=eq.${doctorId}`,
        },
        (payload) => {
          console.log('[Realtime] Schedule opening change detected:', payload);
          // Invalidar cache para forçar refetch das agendas extras
          queryClient.invalidateQueries({
            queryKey: ['schedule_openings', doctorId],
          });
          // Também invalidar a query geral de agendas extras para a data
          queryClient.invalidateQueries({
            queryKey: ['schedule_openings'],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [doctorId, dateStr, queryClient]);
}
