import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [{ title: "Signing in - World Quiz Race" }] }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function finishSignIn() {
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const authError =
        urlParams.get("error_description") ??
        hashParams.get("error_description") ??
        urlParams.get("error") ??
        hashParams.get("error");

      if (authError) {
        setError(authError);
        return;
      }

      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!active) return;

        if (setSessionError) {
          setError(setSessionError.message);
          return;
        }

        window.history.replaceState(null, document.title, "/auth/callback");
        navigate({ to: "/profile", replace: true });
        return;
      }

      const { data, error: sessionError } = await supabase.auth.getSession();

      if (!active) return;

      if (sessionError) {
        setError(sessionError.message);
        return;
      }

      if (data.session) {
        window.history.replaceState(null, document.title, "/auth/callback");
        navigate({ to: "/profile", replace: true });
        return;
      }

      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!active) return;
        if (session) {
          window.history.replaceState(null, document.title, "/auth/callback");
          navigate({ to: "/profile", replace: true });
        }
      });

      window.setTimeout(() => {
        if (active) setError("No login session was returned. Please try again.");
        sub.subscription.unsubscribe();
      }, 2500);
    }

    finishSignIn();

    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
      <div className="border border-[#303030] bg-[#181818] p-6 text-center">
        <h1 className="font-display text-2xl uppercase tracking-[0.08em] text-white">
          {error ? "Login failed" : "Signing in"}
        </h1>
        <p className="mt-2 text-sm text-[#969696]">
          {error ?? "Finishing your Google login..."}
        </p>
      </div>
    </main>
  );
}
