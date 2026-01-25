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
          // Invalidar cache para forçar refetch
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
