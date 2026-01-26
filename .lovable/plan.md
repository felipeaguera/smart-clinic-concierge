

## Plano: Desabilitar refetchOnWindowFocus no React Query

### Objetivo

Corrigir o comportamento indesejado onde modais fecham e formulários perdem dados ao trocar de janela, sem afetar a sincronização em tempo real entre múltiplos usuários.

### Alteração

**Arquivo: `src/App.tsx`**

Atualizar a configuração do QueryClient:

```tsx
// ANTES
const queryClient = new QueryClient();

// DEPOIS
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutos
    },
  },
});
```

### O que muda

| Comportamento | Antes | Depois |
|---------------|-------|--------|
| Trocar de janela e voltar | Refetch automático, modais fecham | Nada acontece, modais permanecem |
| Novo agendamento por outro usuário | Atualiza via Realtime | Continua atualizando via Realtime |
| Dados em cache | Sempre "stale" | Frescos por 5 minutos |

### Sincronização Realtime (não afetada)

O hook `useRealtimeAppointments` já implementado continuará funcionando normalmente via WebSocket, garantindo que múltiplos usuários vejam atualizações em tempo real.

