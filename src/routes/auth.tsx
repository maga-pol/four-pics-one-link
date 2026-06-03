import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — World Quiz Race" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) navigate({ to: "/", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const signIn = async () => {
    setLoading(true);
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError(result.error.message ?? "Sign-in failed");
      setLoading(false);
    }
  };

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background p-6 text-foreground">
      <div className="pointer-events-none absolute inset-0 ps-grid-bg opacity-60" />
      <div className="pointer-events-none absolute -left-40 top-0 h-[28rem] w-[28rem] rounded-full bg-primary/30 blur-[140px]" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-[32rem] w-[32rem] rounded-full bg-primary-glow/20 blur-[160px]" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card/60 p-6 backdrop-blur-md">
        <div className="mb-5 text-center">
          <div className="text-3xl">🌍</div>
          <h1 className="mt-2 text-xl font-black tracking-tight text-gradient-title">World Quiz Race</h1>
          <p className="mt-1 text-xs text-muted-foreground">Sign in to save your progress across devices</p>
        </div>
        <button
          type="button"
          onClick={signIn}
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-black shadow-button transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
        >
          <GoogleIcon />
          {loading ? "Connecting…" : "Continue with Google"}
        </button>
        {error && <p className="mt-3 text-center text-xs text-red-400">{error}</p>}
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29.1 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29.1 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 43.5c5 0 9.5-1.7 13-4.6l-6-5.1c-2 1.4-4.4 2.2-7 2.2-5.3 0-9.7-3.1-11.3-7.4l-6.5 5C9.6 39 16.2 43.5 24 43.5z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.4l6 5.1c-.4.4 6.7-4.9 6.7-14.5 0-1.2-.1-2.4-.4-3.5z"/>
    </svg>
  );
}