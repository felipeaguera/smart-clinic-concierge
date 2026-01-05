import { useState, useEffect, createContext, useContext, ReactNode, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function timeout(ms: number) {
  return new Promise<never>((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error('Timeout ao verificar permissões'));
    }, ms);
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const roleCheckIdRef = useRef(0);

  const checkAdminRole = useCallback(async (userId: string) => {
    const checkId = ++roleCheckIdRef.current;
    setIsLoading(true);

    try {
      const roleQuery = supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();

      const { data, error } = await Promise.race([roleQuery, timeout(7000)]);

      // Se houver uma verificação mais recente em andamento, ignora este resultado
      if (checkId !== roleCheckIdRef.current) return;

      if (error) {
        setIsAdmin(false);
        return;
      }

      setIsAdmin(!!data);
    } catch (err) {
      if (checkId !== roleCheckIdRef.current) return;
      console.warn('[auth] Falha ao verificar role admin:', err);
      setIsAdmin(false);
    } finally {
      if (checkId !== roleCheckIdRef.current) return;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Listener primeiro (evita perder eventos)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        setIsLoading(true);
        // Use setTimeout para evitar deadlock (não chamar supabase direto no callback)
        setTimeout(() => {
          checkAdminRole(session.user.id);
        }, 0);
      } else {
        // Invalida verificações pendentes
        roleCheckIdRef.current++;
        setIsAdmin(false);
        setIsLoading(false);
      }
    });

    // Sessão inicial
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setIsLoading(true);
          await checkAdminRole(session.user.id);
        } else {
          setIsLoading(false);
        }
      } catch (err) {
        console.warn('[auth] Falha ao obter sessão inicial:', err);
        setIsAdmin(false);
        setIsLoading(false);
      }
    })();

    return () => subscription.unsubscribe();
  }, [checkAdminRole]);

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setIsLoading(false);
    }
    // Se não houver erro, o onAuthStateChange + checkAdminRole cuidam do restante
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`
      }
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
    } finally {
      // onAuthStateChange deve executar, mas garantimos que não fica preso
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
