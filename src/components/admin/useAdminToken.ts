import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type AdminTokenState = {
  token: string | null;
  email: string | null;
  loading: boolean;
  logout: () => Promise<void>;
};

export default function useAdminToken(): AdminTokenState {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;

        if (!mounted) return;
        setToken(session?.access_token ?? null);
        setEmail(session?.user?.email ?? null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setToken(session?.access_token ?? null);
      setEmail(session?.user?.email ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setToken(null);
    setEmail(null);
  };

  return { token, email, loading, logout };
}