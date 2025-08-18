// src/AuthGate.tsx
import { useEffect, useState } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "./lib/supabase";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s));
    return () => sub?.subscription.unsubscribe();
  }, []);

  if (!session) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="w-[min(420px,92vw)]">
          <Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} providers={["google"]} />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
