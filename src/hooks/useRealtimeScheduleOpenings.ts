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
          
          // Invalidar todas as queries relacionadas a schedule_openings
          // Query específica para o grid: ['schedule_openings', doctorId, dateStr]
          queryClient.invalidateQueries({
            queryKey: ['schedule_openings', doctorId, dateStr],
          });
          
          // Query para ProximosHorariosLivres: ['doctor_future_openings', doctorId]
          queryClient.invalidateQueries({
            queryKey: ['doctor_future_openings', doctorId],
          });
          
          // Query geral para filtro de médicos: ['all_schedule_openings']
          queryClient.invalidateQueries({
            queryKey: ['all_schedule_openings'],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [doctorId, dateStr, queryClient]);
}
