import { ReactNode, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isAdmin, isLoading } = useAuth();
  
  // Track if we've ever successfully rendered children
  // This prevents unmounting during background token refreshes
  const hasRenderedRef = useRef(false);

  // If we're loading but have already rendered, keep showing children
  // This prevents modal closures and state loss on window focus
  if (isLoading) {
    if (hasRenderedRef.current) {
      // Already rendered once - keep children mounted, no visual change
      return <>{children}</>;
    }
    
    // First load - show spinner
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    hasRenderedRef.current = false;
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    hasRenderedRef.current = false;
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Acesso Negado</h1>
          <p className="text-muted-foreground">
            Você não tem permissão de administrador.
          </p>
        </div>
      </div>
    );
  }

  // Successfully authenticated and authorized
  hasRenderedRef.current = true;
  return <>{children}</>;
}
