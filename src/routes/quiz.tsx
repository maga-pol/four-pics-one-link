import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Check,
  X,
  Lightbulb,
  ChevronRight,
  Coins,
  Trophy,
  Sparkles,
  Zap,
} from "lucide-react";
import { getPhotoUrl, isCorrect, type Level } from "@/lib/levels";
import { getAccountStorageKey, normalizeState, writeGameState } from "@/lib/garage";
import { generateQuizLevel } from "@/lib/api/quiz-ai.functions";

export const Route = createFileRoute("/quiz")({
  head: () => ({
    meta: [{ title: "Quiz · World Quiz Race" }],
  }),
  component: QuizScreen,
});

const STORAGE = "wqr-state";
const QUIZ_LEN = 20;

function readCoins(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(getAccountStorageKey(STORAGE));
    if (!raw) return 0;
    return JSON.parse(raw).coins ?? 0;
  } catch {
    return 0;
  }
}
function addCoins(delta: number) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(getAccountStorageKey(STORAGE));
    const obj = normalizeState(raw ? JSON.parse(raw) : {});
    obj.coins = (obj.coins ?? 0) + delta;
    obj.totalQuizzesCompleted = (obj.totalQuizzesCompleted ?? 0) + 1;
    writeGameState(obj);
  } catch {}
}
function recordQuizAttempt() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(getAccountStorageKey(STORAGE));
    const obj = normalizeState(raw ? JSON.parse(raw) : {});
    obj.totalQuizzesCompleted = (obj.totalQuizzesCompleted ?? 0) + 1;
    writeGameState(obj);
  } catch {}
}

function QuizScreen() {
  const [qNum, setQNum] = useState(1);
  const [streak, setStreak] = useState(0);
  const [level, setLevel] = useState<Level | null>(null);
  const [aiSource, setAiSource] = useState<"loading" | "gemini" | "error">("loading");
  const [aiReason, setAiReason] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<null | "correct" | "wrong">(null);
  const [hint, setHint] = useState(false);
  const [coins, setCoins] = useState(0);
  const [reward, setReward] = useState(0);

  useEffect(() => setCoins(readCoins()), []);

  useEffect(() => {
    let alive = true;
    const difficulty = qNum <= 7 ? "easy" : qNum <= 14 ? "medium" : "hard";

    setAiSource("loading");
    setAiReason(null);
    setLevel(null);
    void generateQuizLevel({ data: { questionNumber: qNum, difficulty } })
      .then((result) => {
        if (!alive) return;
        if (result.source === "gemini" && result.level) {
          setLevel(result.level);
          setAiSource("gemini");
        } else {
          setAiReason(result.reason ?? "server_error");
          setAiSource("error");
        }
      })
      .catch(() => {
        if (!alive) return;
        setAiReason("server_error");
        setAiSource("error");
      });

    return () => {
      alive = false;
    };
  }, [qNum, retryNonce]);

  function submit() {
    if (result || !input.trim() || !level) return;
    if (isCorrect(input, level)) {
      const r = hint ? 80 : 120;
      addCoins(r);
      setCoins((c) => c + r);
      setReward(r);
      setStreak((s) => s + 1);
      setResult("correct");
    } else {
      recordQuizAttempt();
      setStreak(0);
      setResult("wrong");
    }
  }
  function next() {
    setInput("");
    setResult(null);
    setHint(false);
    setQNum((n) => (n >= QUIZ_LEN ? 1 : n + 1));
  }

  const difficulty = qNum <= 7 ? "EASY" : qNum <= 14 ? "MEDIUM" : "HARD";
  const difficultyTone =
    difficulty === "EASY"
      ? "bg-gradient-mint text-emerald-950"
      : difficulty === "MEDIUM"
        ? "bg-gradient-coin text-amber-950"
        : "bg-gradient-primary text-white";
  const baseReward = difficulty === "EASY" ? 100 : difficulty === "MEDIUM" ? 150 : 220;
  const progress = (qNum / QUIZ_LEN) * 100;
  const aiErrorText =
    aiReason === "missing_key"
      ? "GEMINI_API_KEY is missing on the server."
      : aiReason === "gemini_error"
        ? "Gemini rejected the request. Check the API key and model."
        : "The AI response was not usable. Try again.";

  return (
    <main className="relative min-h-screen overflow-hidden text-foreground">
      <div className="pointer-events-none absolute inset-0 ps-grid-bg opacity-60" />
      <div className="pointer-events-none absolute -left-40 top-0 h-[28rem] w-[28rem] rounded-full bg-primary/30 blur-[140px] animate-float-slow" />
      <div
        className="pointer-events-none absolute -right-40 bottom-0 h-[32rem] w-[32rem] rounded-full bg-secondary/30 blur-[160px] animate-float-slow"
        style={{ animationDelay: "-7s" }}
      />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4">
        {/* HEADER */}
        <header className="flex items-center justify-between">
          <Link
            to="/"
            className="arcade-btn arcade-btn-ghost h-11 w-11 !px-0"
            aria-label="Back to HUB"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-coin px-3 py-2 text-sm font-extrabold text-amber-950 shadow-button">
              <Coins className="h-4 w-4" /> <span className="tabular-nums">{coins}</span>
            </div>
            {streak > 1 && (
              <div className="inline-flex items-center gap-1 rounded-full bg-gradient-primary px-3 py-2 text-xs font-extrabold text-white shadow-button animate-pop-in">
                <Zap className="h-3.5 w-3.5" /> {streak}x
              </div>
            )}
          </div>
        </header>

        {/* LEVEL CARD */}
        <div className="arcade-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-secondary">
                {aiSource === "gemini"
                  ? "AI Quiz · Guess the Country"
                  : aiSource === "loading"
                    ? "Generating Quiz · Guess the Country"
                    : "AI Quiz Offline · Retry Needed"}
              </div>
              <div className="mt-0.5 text-2xl font-extrabold leading-none">
                LEVEL <span className="text-gradient-title">{qNum}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span
                className={`rounded-full ${difficultyTone} px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] shadow-button`}
              >
                {difficulty}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-extrabold text-neon">
                <Coins className="h-3 w-3" /> Reward +{baseReward}
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-primary shadow-[0_0_18px_currentColor] transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
              <div className="pointer-events-none absolute inset-0 animate-shimmer rounded-full" />
            </div>
            <span className="min-w-[58px] text-right text-xs font-extrabold tabular-nums text-white/80">
              {qNum} / {QUIZ_LEN}
            </span>
          </div>
        </div>

        {/* PHOTOS */}
        <div className="grid grid-cols-2 gap-2.5">
          {aiSource === "loading" &&
            Array.from({ length: 4 }, (_, i) => (
              <div
                key={`loading-${i}`}
                className="aspect-square animate-pulse rounded-3xl border border-white/15 bg-white/[0.06] shadow-card"
              />
            ))}
          {aiSource === "error" && (
            <div className="col-span-2 rounded-3xl border border-destructive/50 bg-destructive/10 p-6 text-center shadow-card">
              <div className="text-lg font-extrabold text-white">AI quiz was not generated</div>
              <div className="mt-2 text-sm font-bold text-white/60">{aiErrorText}</div>
              <button
                type="button"
                onClick={() => setRetryNonce((n) => n + 1)}
                className="arcade-btn arcade-btn-cyan mt-5 h-12 px-6 text-sm"
              >
                Generate Again
              </button>
            </div>
          )}
          {level &&
            level.photoSeeds.map((seed, i) => (
              <div
                key={`${level.id}-${seed}-${i}`}
                className="group relative aspect-square overflow-hidden rounded-3xl border border-white/15 bg-muted shadow-card animate-pop-in"
                style={{ animationDelay: `${i * 0.07}s` }}
              >
                <img
                  src={getPhotoUrl(level.photoQuery, seed, 600)}
                  alt={`clue ${i + 1}`}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <span className="pointer-events-none absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-gradient-primary text-[11px] font-extrabold text-white shadow-button">
                  {i + 1}
                </span>
              </div>
            ))}
        </div>

        <div className="flex items-center justify-between gap-2 text-[11px]">
          <button
            type="button"
            onClick={() => setHint(true)}
            disabled={hint || !!result}
            className="arcade-btn arcade-btn-ghost h-10 px-4 text-xs"
          >
            <Lightbulb className="h-3.5 w-3.5 text-neon" /> Hint (-40)
          </button>
          {hint && (
            <span className="rounded-full bg-white/10 px-3 py-1.5 font-extrabold text-white">
              🗺 {level?.continent}
            </span>
          )}
        </div>

        {/* ANSWER */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex gap-2"
        >
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!!result || !level}
            placeholder="Type a country…"
            className="flex-1 rounded-full border-2 border-white/15 bg-white/[0.06] px-5 py-3.5 text-base font-bold text-white outline-none placeholder:text-white/40 transition focus:border-primary/70 focus:bg-white/[0.1] focus:shadow-glow disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!!result || !input.trim() || !level}
            className="arcade-btn h-14 px-7 text-sm"
          >
            Submit <ChevronRight className="h-4 w-4" />
          </button>
        </form>

        {/* RESULT OVERLAY */}
        {result && level && (
          <div className="fixed inset-0 z-40 grid place-items-center bg-background/80 p-6 backdrop-blur-md animate-fade-up">
            <div className="relative w-[min(94%,440px)] arcade-card p-7 text-center animate-pop-in">
              {result === "correct" && (
                <>
                  <div className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2">
                    <div className="grid h-20 w-20 place-items-center rounded-full bg-gradient-mint shadow-button animate-pop-in">
                      <Check className="h-10 w-10 text-emerald-950" strokeWidth={4} />
                    </div>
                  </div>
                  <div className="mt-10 text-3xl font-extrabold">
                    <span className="text-gradient-title">Correct!</span>
                  </div>
                  <div className="mt-1 text-sm font-bold text-white/70">
                    {level.answer} · {level.name}
                  </div>
                  <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-coin px-5 py-3 text-2xl font-extrabold text-amber-950 shadow-button animate-pop-in">
                    <Coins className="h-6 w-6" />
                    <span className="tabular-nums">+{reward} Coins</span>
                  </div>
                  {streak >= 3 && (
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gradient-primary px-3 py-1.5 text-xs font-extrabold text-white shadow-button">
                      <Sparkles className="h-3.5 w-3.5" /> Combo x{streak}
                    </div>
                  )}
                </>
              )}
              {result === "wrong" && (
                <>
                  <div className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2">
                    <div className="grid h-20 w-20 place-items-center rounded-full bg-destructive shadow-button animate-pop-in">
                      <X className="h-10 w-10 text-white" strokeWidth={4} />
                    </div>
                  </div>
                  <div className="mt-10 text-3xl font-extrabold text-white">Not quite!</div>
                  <div className="mt-2 text-sm font-bold text-white/70">The answer was</div>
                  <div className="mt-1 text-2xl font-extrabold text-gradient-title">
                    {level.answer}
                  </div>
                </>
              )}
              <button
                type="button"
                onClick={next}
                className="arcade-btn arcade-btn-cyan mt-6 h-14 w-full text-base"
              >
                <Trophy className="h-5 w-5" /> Next Question <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
