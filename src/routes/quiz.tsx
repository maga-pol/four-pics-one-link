import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { ArrowLeft, Check, X, Lightbulb, ChevronRight, Coins } from "lucide-react";
import { LEVELS, getPhotoUrl, isCorrect, type Level } from "@/lib/levels";

export const Route = createFileRoute("/quiz")({
  head: () => ({
    meta: [{ title: "Quiz · World Quiz Race" }],
  }),
  component: QuizScreen,
});

const STORAGE = "wqr-state";

function readCoins(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return 0;
    return JSON.parse(raw).coins ?? 0;
  } catch {
    return 0;
  }
}
function addCoins(delta: number) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE);
    const obj = raw ? JSON.parse(raw) : {};
    obj.coins = (obj.coins ?? 0) + delta;
    localStorage.setItem(STORAGE, JSON.stringify(obj));
  } catch {}
}

function QuizScreen() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * LEVELS.length));
  const level: Level = LEVELS[idx];
  const seeds = useMemo(
    () => Array.from({ length: 4 }, () => Math.floor(Math.random() * 1_000_000) + 1),
    [idx]
  );
  const [input, setInput] = useState("");
  const [result, setResult] = useState<null | "correct" | "wrong">(null);
  const [hint, setHint] = useState(false);
  const [coins, setCoins] = useState(0);

  useEffect(() => setCoins(readCoins()), []);

  function submit() {
    if (result || !input.trim()) return;
    if (isCorrect(input, level)) {
      const reward = hint ? 80 : 120;
      addCoins(reward);
      setCoins((c) => c + reward);
      setResult("correct");
    } else {
      setResult("wrong");
    }
  }
  function next() {
    setInput("");
    setResult(null);
    setHint(false);
    setIdx((i) => (i + 1) % LEVELS.length);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute -left-40 top-0 h-[28rem] w-[28rem] rounded-full bg-primary/20 blur-[140px] animate-float-slow" />
      <div
        className="pointer-events-none absolute -right-40 bottom-0 h-[32rem] w-[32rem] rounded-full bg-secondary/20 blur-[160px] animate-float-slow"
        style={{ animationDelay: "-7s" }}
      />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4">
        <header className="flex items-center justify-between">
          <Link
            to="/"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/60 text-muted-foreground backdrop-blur-sm transition hover:text-foreground"
            aria-label="Back to HUB"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-primary-glow">
              Quiz Mode
            </span>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-2.5 py-1 text-xs font-bold backdrop-blur">
              <Coins className="h-3.5 w-3.5 text-amber-300" />
              <span>{coins}</span>
            </div>
          </div>
        </header>

        <div className="text-center">
          <h1 className="text-xl font-black sm:text-2xl">
            <span className="text-gradient-title">Guess the Country</span>
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Four photos · one country · type the answer
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {seeds.map((seed, i) => (
            <div
              key={`${idx}-${seed}-${i}`}
              className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted animate-fade-up"
              style={{ animationDelay: `${i * 0.07}s` }}
            >
              <img
                src={getPhotoUrl(level.photoQuery, seed, 600)}
                alt={`clue ${i + 1}`}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <span className="pointer-events-none absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-background/70 text-[10px] font-bold backdrop-blur">
                {i + 1}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <button
            type="button"
            onClick={() => setHint(true)}
            disabled={hint || !!result}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/60 px-3 py-2 font-semibold backdrop-blur-sm transition hover:text-foreground disabled:opacity-40"
          >
            <Lightbulb className="h-3.5 w-3.5 text-neon" /> Hint
          </button>
          {hint && (
            <span>
              Continent: <span className="font-bold text-foreground">{level.continent}</span>
            </span>
          )}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex gap-2">
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!!result}
            placeholder="Type a country…"
            className="flex-1 rounded-2xl border border-border bg-card/60 px-4 py-3.5 text-base outline-none backdrop-blur-sm transition focus:border-primary/70 focus:shadow-glow disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!!result || !input.trim()}
            className="rounded-2xl bg-gradient-primary px-5 py-3.5 text-sm font-bold text-primary-foreground shadow-button transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
          >
            Submit
          </button>
        </form>

        {result && (
          <div
            className={`animate-fade-up rounded-2xl border p-4 backdrop-blur-sm ${
              result === "correct"
                ? "border-emerald-500/50 bg-emerald-500/10"
                : "border-rose-500/50 bg-rose-500/10"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                result === "correct" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
              }`}>
                {result === "correct" ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold">
                  {result === "correct" ? `Correct! +${hint ? 80 : 120} coins` : "Not quite."}
                </div>
                <div className="text-xs text-muted-foreground">
                  Answer: <span className="font-semibold text-foreground">{level.answer}</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={next}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-button transition hover:scale-[1.02] active:scale-[0.98]"
            >
              Next Question <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </main>
  );
}