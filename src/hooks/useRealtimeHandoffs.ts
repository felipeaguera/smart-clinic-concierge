import { useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Handoff {
  id: string;
  phone: string;
  patient_name: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export function useRealtimeHandoffs() {
  const queryClient = useQueryClient();

  // Query for open handoffs
  const {
    data: handoffs = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["handoffs", "open"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("human_handoff_queue")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as Handoff[];
    },
    staleTime: 1000 * 30, // 30 seconds
  });

  // Count of open handoffs
  const pendingCount = handoffs.length;

  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase
      .channel("handoffs-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "human_handoff_queue",
        },
        () => {
          // Invalidate and refetch when any change happens
          queryClient.invalidateQueries({ queryKey: ["handoffs", "open"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Resolve a handoff
  const resolveHandoff = useCallback(
    async (handoffId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("human_handoff_queue")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id || null,
        })
        .eq("id", handoffId);

      if (error) throw error;

      // Optimistic update
      queryClient.invalidateQueries({ queryKey: ["handoffs", "open"] });
    },
    [queryClient]
  );

  return {
    handoffs,
    pendingCount,
    isLoading,
    error,
    refetch,
    resolveHandoff,
  };
}
