import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trophy, RotateCcw, Home } from "lucide-react";
import { resetAndShuffleLevels } from "@/lib/levels";

const STORAGE_KEY = "gtc-progress";

export const Route = createFileRoute("/game/complete")({
  head: () => ({
    meta: [{ title: "Guess The Connection — Complete" }],
  }),
  component: CompletePage,
});

function CompletePage() {
  const navigate = useNavigate();
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        setScore(p.score ?? 0);
        setStreak(p.streak ?? 0);
      }
    } catch {}
  }, []);

  function restart() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ score: 0, streak: 0 }));
    navigate({ to: "/game/$level", params: { level: "1" } });
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 text-center text-foreground">
      <div className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-primary/30 blur-[120px] animate-float-slow" />
      <div
        className="pointer-events-none absolute -right-32 bottom-1/4 h-[28rem] w-[28rem] rounded-full bg-secondary/25 blur-[140px] animate-float-slow"
        style={{ animationDelay: "-6s" }}
      />
      <div className="relative z-10 max-w-md animate-fade-up">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-primary shadow-button animate-pulse-glow">
          <Trophy className="h-10 w-10 text-primary-foreground" />
        </div>
        <h1 className="mt-6 text-4xl font-black sm:text-5xl">
          <span className="text-gradient-title">You did it!</span>
        </h1>
        <p className="mt-3 text-muted-foreground">
          All 10 places guessed. Mind = connected.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3">
          <Stat label="Score" value={score} />
          <Stat label="Best Streak" value={streak} />
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <button
            onClick={restart}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary px-6 py-4 text-base font-bold text-primary-foreground shadow-button transition hover:scale-[1.02] active:scale-[0.98]"
          >
            <RotateCcw className="h-4 w-4" />
            Play Again
          </button>
          <Link
            to="/"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card/60 px-6 py-4 text-base font-semibold text-muted-foreground backdrop-blur-sm transition hover:text-foreground"
          >
            <Home className="h-4 w-4" />
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4 backdrop-blur-sm">
      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-3xl font-black text-gradient-title">{value}</div>
    </div>
  );
}