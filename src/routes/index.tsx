import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Gauge,
  Zap,
  Rocket,
  Move,
  Lock,
  Check,
  X,
  Flag,
  Coins,
  Trophy,
  Lightbulb,
  ChevronRight,
} from "lucide-react";
import { LEVELS, getPhotoUrl, isCorrect, type Level } from "@/lib/levels";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "World Quiz Race — Drive the world, one answer at a time" },
      { name: "description", content: "Tune your car, answer geo quizzes, unlock global tracks." },
      { property: "og:title", content: "World Quiz Race" },
      { property: "og:description", content: "Tune your car, answer geo quizzes, unlock global tracks." },
    ],
  }),
  component: HomeHUD,
});

type UpgradeKey = "speed" | "acceleration" | "nitro" | "control";
type GameState = {
  coins: number;
  upgrades: Record<UpgradeKey, number>;
  unlockedTracks: number; // index of next unlocked
  quizIdx: number;
};

const STORAGE = "wqr-state";
const MAX_LEVEL = 5;
const COSTS = [100, 200, 350, 550, 800];

const UPGRADES: { key: UpgradeKey; label: string; icon: React.ReactNode; color: string }[] = [
  { key: "speed", label: "Speed", icon: <Gauge className="h-4 w-4" />, color: "from-sky-400 to-blue-600" },
  { key: "acceleration", label: "Acceleration", icon: <Rocket className="h-4 w-4" />, color: "from-fuchsia-400 to-violet-600" },
  { key: "nitro", label: "Nitro", icon: <Zap className="h-4 w-4" />, color: "from-amber-300 to-orange-500" },
  { key: "control", label: "Control", icon: <Move className="h-4 w-4" />, color: "from-emerald-300 to-teal-500" },
];

function loadState(): GameState {
  if (typeof window === "undefined") {
    return { coins: 250, upgrades: { speed: 1, acceleration: 1, nitro: 0, control: 0 }, unlockedTracks: 1, quizIdx: 0 };
  }
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { coins: 250, upgrades: { speed: 1, acceleration: 1, nitro: 0, control: 0 }, unlockedTracks: 1, quizIdx: 0 };
}

function HomeHUD() {
  const [state, setState] = useState<GameState>(() => ({
    coins: 250,
    upgrades: { speed: 1, acceleration: 1, nitro: 0, control: 0 },
    unlockedTracks: 1,
    quizIdx: 0,
  }));

  useEffect(() => {
    setState(loadState());
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(STORAGE, JSON.stringify(state));
  }, [state]);

  const level: Level = LEVELS[state.quizIdx % LEVELS.length];
  const seeds = useMemo(
    () => Array.from({ length: 4 }, () => Math.floor(Math.random() * 1_000_000) + 1),
    [state.quizIdx],
  );

  const [input, setInput] = useState("");
  const [result, setResult] = useState<null | "correct" | "wrong">(null);
  const [hint, setHint] = useState(false);

  function submit() {
    if (result || !input.trim()) return;
    if (isCorrect(input, level)) {
      const reward = 80 + (hint ? 0 : 40);
      setState((s) => ({ ...s, coins: s.coins + reward }));
      setResult("correct");
    } else {
      setResult("wrong");
    }
  }

  function nextQuiz() {
    setInput("");
    setResult(null);
    setHint(false);
    setState((s) => ({ ...s, quizIdx: (s.quizIdx + 1) % LEVELS.length }));
  }

  function buyUpgrade(key: UpgradeKey) {
    setState((s) => {
      const lvl = s.upgrades[key];
      if (lvl >= MAX_LEVEL) return s;
      const cost = COSTS[lvl];
      if (s.coins < cost) return s;
      return { ...s, coins: s.coins - cost, upgrades: { ...s.upgrades, [key]: lvl + 1 } };
    });
  }

  function unlockTrack(i: number) {
    setState((s) => {
      if (i !== s.unlockedTracks) return s;
      const cost = 150 + i * 100;
      if (s.coins < cost) return s;
      return { ...s, coins: s.coins - cost, unlockedTracks: s.unlockedTracks + 1 };
    });
  }

  const tracks = TRACKS;

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -left-40 top-0 h-[28rem] w-[28rem] rounded-full bg-primary/20 blur-[140px] animate-float-slow" />
      <div
        className="pointer-events-none absolute -right-40 bottom-0 h-[32rem] w-[32rem] rounded-full bg-secondary/20 blur-[160px] animate-float-slow"
        style={{ animationDelay: "-7s" }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1400px] flex-col gap-3 p-3 sm:p-4">
        {/* HUD HEADER */}
        <header className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/50 px-4 py-2.5 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌍</span>
            <span className="text-sm font-black tracking-tight sm:text-base">
              <span className="text-gradient-title">World Quiz Race</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge icon={<Coins className="h-3.5 w-3.5 text-amber-300" />} value={state.coins.toString()} />
            <Badge icon={<Trophy className="h-3.5 w-3.5 text-neon" />} value={`${state.unlockedTracks - 1}/${tracks.length}`} />
          </div>
        </header>

        {/* QUIZ AREA (TOP) */}
        <section className="rounded-2xl border border-border bg-card/50 p-3 backdrop-blur-md sm:p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary-glow">
                Quiz
              </span>
              <span className="text-xs text-muted-foreground">Guess the country</span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Continent · <span className={hint ? "text-foreground font-semibold" : "blur-sm select-none"}>{level.continent}</span>
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-3 sm:grid-cols-[1fr_360px]">
            <div className="grid grid-cols-4 gap-2">
              {seeds.map((seed, i) => (
                <div
                  key={`${state.quizIdx}-${seed}-${i}`}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted animate-fade-up"
                  style={{ animationDelay: `${i * 0.06}s` }}
                >
                  <img
                    src={getPhotoUrl(level.photoQuery, seed, 480)}
                    alt={`clue ${i + 1}`}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="pointer-events-none absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-background/70 text-[10px] font-bold backdrop-blur">
                    {i + 1}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex flex-col justify-between gap-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
                className="flex flex-col gap-2"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={!!result}
                  placeholder="Type a country…"
                  className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none transition focus:border-primary/70 focus:shadow-glow disabled:opacity-60"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setHint(true)}
                    disabled={hint || !!result}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background/60 px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-40"
                  >
                    <Lightbulb className="h-3.5 w-3.5 text-neon" /> Hint
                  </button>
                  <button
                    type="submit"
                    disabled={!!result || !input.trim()}
                    className="flex-1 rounded-xl bg-gradient-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-button transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
                  >
                    Submit
                  </button>
                </div>
              </form>
              {result ? (
                <div
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs ${
                    result === "correct"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border-rose-500/40 bg-rose-500/10 text-rose-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {result === "correct" ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    <span className="font-bold">
                      {result === "correct" ? `+${hint ? 80 : 120} coins` : "Wrong"} · {level.answer}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={nextQuiz}
                    className="inline-flex items-center gap-1 rounded-lg bg-background/60 px-2.5 py-1 font-bold text-foreground transition hover:bg-background"
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
                  Earn coins by guessing the country shown in the 4 photos.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* MAIN: tuning | car | tracks */}
        <section className="grid flex-1 grid-cols-1 gap-3 lg:grid-cols-[260px_1fr_280px]">
          {/* LEFT — TUNING */}
          <aside className="flex flex-col gap-3 rounded-2xl border border-border bg-card/50 p-3 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Garage</h2>
              <div className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-300">
                <Coins className="h-3 w-3" /> {state.coins}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {UPGRADES.map((u) => {
                const lvl = state.upgrades[u.key];
                const max = lvl >= MAX_LEVEL;
                const cost = max ? 0 : COSTS[lvl];
                const afford = state.coins >= cost;
                return (
                  <div
                    key={u.key}
                    className="rounded-xl border border-border bg-background/40 p-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <span className={`grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br ${u.color} text-white shadow-md`}>
                          {u.icon}
                        </span>
                        {u.label}
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground">Lv {lvl}/{MAX_LEVEL}</span>
                    </div>
                    <div className="mt-2 flex gap-1">
                      {Array.from({ length: MAX_LEVEL }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full ${i < lvl ? `bg-gradient-to-r ${u.color}` : "bg-border"}`}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => buyUpgrade(u.key)}
                      disabled={max || !afford}
                      className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background/60 px-2 py-1.5 text-[11px] font-bold transition hover:border-primary/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {max ? "MAX" : (
                        <>
                          Upgrade · <Coins className="h-3 w-3 text-amber-300" /> {cost}
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* CENTER — CAR STAGE */}
          <div className="relative flex flex-col overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card/70 to-background/60 p-4 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">My Racer</h2>
              <div className="rounded-full border border-border bg-background/60 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-primary-glow">
                Neon GT · Tier 1
              </div>
            </div>

            <div className="relative flex flex-1 items-center justify-center">
              {/* Glow */}
              <div className="pointer-events-none absolute inset-x-10 top-1/3 h-40 rounded-[50%] bg-primary/30 blur-3xl" />
              <div className="pointer-events-none absolute inset-x-20 top-1/2 h-32 rounded-[50%] bg-secondary/25 blur-3xl" />

              <Car />
            </div>

            {/* Road */}
            <div
              className="relative mt-3 h-3 rounded-full bg-[repeating-linear-gradient(90deg,transparent_0_24px,oklch(0.82_0.22_200/0.6)_24px_40px)] animate-road"
            />
            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
              {UPGRADES.map((u) => (
                <div key={u.key} className="rounded-lg border border-border bg-background/40 p-1.5">
                  <div className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">{u.label}</div>
                  <div className="text-sm font-black text-foreground">{state.upgrades[u.key] * 20}</div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — TRACKS */}
          <aside className="flex flex-col gap-3 rounded-2xl border border-border bg-card/50 p-3 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Tracks</h2>
              <Flag className="h-3.5 w-3.5 text-neon" />
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto pr-1">
              {tracks.map((t, i) => {
                const unlocked = i < state.unlockedTracks;
                const isNext = i === state.unlockedTracks;
                const cost = 150 + i * 100;
                return (
                  <button
                    type="button"
                    key={t.name}
                    onClick={() => isNext && unlockTrack(i)}
                    disabled={!unlocked && !isNext}
                    className={`group relative flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition ${
                      unlocked
                        ? "border-primary/40 bg-primary/10 hover:border-primary/70"
                        : isNext
                        ? "border-border bg-background/40 hover:border-neon/60"
                        : "border-border/50 bg-background/20 opacity-50"
                    }`}
                  >
                    <span className="text-xl">{t.flag}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-bold">{t.name}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {unlocked ? `Stage ${i + 1} · Unlocked` : isNext ? (
                          <span className="inline-flex items-center gap-1 text-amber-300">
                            <Coins className="h-2.5 w-2.5" /> {cost}
                          </span>
                        ) : (
                          "Locked"
                        )}
                      </div>
                    </div>
                    {unlocked ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : isNext ? (
                      <ChevronRight className="h-4 w-4 text-neon" />
                    ) : (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                );
              })}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Badge({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1 text-xs font-bold backdrop-blur">
      {icon}
      <span>{value}</span>
    </div>
  );
}

function Car() {
  return (
    <svg
      viewBox="0 0 320 160"
      className="relative z-10 w-[min(90%,420px)] animate-car-idle drop-shadow-[0_30px_30px_oklch(0.68_0.22_285/0.45)]"
      aria-label="Player car"
    >
      <defs>
        <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.82 0.22 200)" />
          <stop offset="55%" stopColor="oklch(0.68 0.22 285)" />
          <stop offset="100%" stopColor="oklch(0.45 0.18 285)" />
        </linearGradient>
        <linearGradient id="windowGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.95 0.05 200)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="oklch(0.5 0.12 240)" stopOpacity="0.7" />
        </linearGradient>
      </defs>
      {/* Body */}
      <path
        d="M30 110 Q40 60 110 55 L210 55 Q260 55 285 95 L295 105 Q300 115 290 120 L40 120 Q25 120 30 110 Z"
        fill="url(#bodyGrad)"
        stroke="oklch(0.95 0.05 200)"
        strokeWidth="1.5"
      />
      {/* Window */}
      <path
        d="M110 60 Q120 30 165 30 L205 30 Q235 30 250 60 Z"
        fill="url(#windowGrad)"
        stroke="oklch(0.95 0.05 200)"
        strokeWidth="1.2"
      />
      {/* Divider */}
      <line x1="170" y1="32" x2="180" y2="60" stroke="oklch(0.95 0.05 200)" strokeWidth="1" />
      {/* Headlight */}
      <ellipse cx="285" cy="85" rx="8" ry="5" fill="oklch(0.95 0.15 90)" />
      <ellipse cx="290" cy="85" rx="20" ry="3" fill="oklch(0.95 0.15 90)" opacity="0.4" />
      {/* Neon underglow */}
      <ellipse cx="160" cy="130" rx="130" ry="6" fill="oklch(0.82 0.22 200)" opacity="0.6" />
      {/* Wheels */}
      <g>
        <circle cx="85" cy="120" r="22" fill="oklch(0.15 0.02 270)" />
        <circle cx="85" cy="120" r="13" fill="oklch(0.3 0.04 270)" className="animate-wheel-spin" />
        <circle cx="85" cy="120" r="4" fill="oklch(0.82 0.22 200)" />
      </g>
      <g>
        <circle cx="240" cy="120" r="22" fill="oklch(0.15 0.02 270)" />
        <circle cx="240" cy="120" r="13" fill="oklch(0.3 0.04 270)" className="animate-wheel-spin" />
        <circle cx="240" cy="120" r="4" fill="oklch(0.82 0.22 200)" />
      </g>
    </svg>
  );
}

const TRACKS = [
  { name: "Paris Circuit", flag: "🇫🇷" },
  { name: "Roma GP", flag: "🇮🇹" },
  { name: "Tokyo Drift", flag: "🇯🇵" },
  { name: "NYC Streets", flag: "🇺🇸" },
  { name: "Dubai Dunes", flag: "🇦🇪" },
  { name: "Athens Rally", flag: "🇬🇷" },
  { name: "Beijing Loop", flag: "🇨🇳" },
  { name: "Andes Pass", flag: "🇵🇪" },
  { name: "Petra Run", flag: "🇯🇴" },
];