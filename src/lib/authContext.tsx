import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/client/supabase';

const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

type AuthContextType = {
  session: Session | null;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({ session: null, isLoading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const sess = data.session;
      if (sess?.user) {
        // Check if this account has an expired deletion request
        const { data: profile } = await supabase
          .from('profiles')
          .select('deletion_requested_at')
          .eq('id', sess.user.id)
          .maybeSingle();
        if (profile?.deletion_requested_at) {
          const requested = new Date(profile.deletion_requested_at).getTime();
          const now = Date.now();
          if (now - requested >= GRACE_PERIOD_MS) {
            // Grace period expired — force sign out immediately
            await supabase.auth.signOut({ scope: 'global' });
            setSession(null);
            setIsLoading(false);
            return;
          }
        }
      }
      setSession(sess);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
