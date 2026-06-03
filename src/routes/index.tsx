import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Gauge, Zap, Rocket, Move, Coins, Trophy, Flag, ChevronRight,
  Brain, Wrench, Sparkles, Play, LogOut,
} from "lucide-react";
import { TRACKS } from "@/lib/tracks";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "World Quiz Race — Arcade racing & geo quiz" },
      { name: "description", content: "Play quizzes, earn coins, upgrade your car and race the world." },
      { property: "og:title", content: "World Quiz Race" },
      { property: "og:description", content: "Play quizzes, earn coins, upgrade your car and race the world." },
    ],
  }),
  component: HomeHUD,
});

type UpgradeKey = "speed" | "acceleration" | "nitro" | "control";
type GameState = {
  coins: number;
  upgrades: Record<UpgradeKey, number>;
  unlockedTracks: number;
  wins: number;
};

const STORAGE = "wqr-state";
const MAX_LEVEL = 5;
const COSTS = [100, 200, 350, 550, 800];

const UPGRADES: {
  key: UpgradeKey; label: string; emoji: string; icon: React.ReactNode;
  gradient: string; tint: string;
}[] = [
  { key: "speed",        label: "Speed",        emoji: "⚡", icon: <Gauge className="h-5 w-5" />,  gradient: "bg-gradient-cyan",  tint: "from-cyan-300 to-sky-500" },
  { key: "acceleration", label: "Acceleration", emoji: "🚀", icon: <Rocket className="h-5 w-5" />, gradient: "bg-gradient-primary", tint: "from-fuchsia-400 to-pink-600" },
  { key: "nitro",        label: "Nitro",        emoji: "🔥", icon: <Zap className="h-5 w-5" />,    gradient: "bg-gradient-coin",  tint: "from-amber-300 to-orange-500" },
  { key: "control",      label: "Control",      emoji: "🎯", icon: <Move className="h-5 w-5" />,   gradient: "bg-gradient-mint",  tint: "from-emerald-300 to-teal-500" },
];

function defaultState(): GameState {
  return { coins: 250, upgrades: { speed: 1, acceleration: 1, nitro: 0, control: 0 }, unlockedTracks: 1, wins: 0 };
}
function loadState(): GameState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        coins: p.coins ?? 250,
        upgrades: p.upgrades ?? defaultState().upgrades,
        unlockedTracks: p.unlockedTracks ?? 1,
        wins: p.wins ?? 0,
      };
    }
  } catch {}
  return defaultState();
}

function HomeHUD() {
  const [state, setState] = useState<GameState>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => { setState(loadState()); setHydrated(true); }, []);
  useEffect(() => {
    function onFocus() { setState(loadState()); }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    localStorage.setItem(STORAGE, JSON.stringify(state));
  }, [state, hydrated]);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  function buyUpgrade(key: UpgradeKey) {
    setState((s) => {
      const lvl = s.upgrades[key];
      if (lvl >= MAX_LEVEL) return s;
      const cost = COSTS[lvl];
      if (s.coins < cost) return s;
      return { ...s, coins: s.coins - cost, upgrades: { ...s.upgrades, [key]: lvl + 1 } };
    });
  }

  const tracks = TRACKS;
  const firstTrack = tracks[0];

  return (
    <main className="relative min-h-screen overflow-hidden text-foreground">
      {/* Backdrop */}
      <div className="pointer-events-none absolute inset-0" style={{ background: "#181818" }} />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1280px] flex-col gap-4 p-3 sm:p-5">

        {/* HEADER */}
        <header className="flex items-center justify-between gap-3 border-b border-[#303030] pb-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center bg-[#da291c] text-lg">🏁</span>
            <div className="leading-tight">
              <div className="text-[11px] font-bold uppercase tracking-[0.11em] text-[#da291c]">Scuderia</div>
              <div className="text-sm font-semibold uppercase tracking-[0.05em] text-white sm:text-base">World Quiz Race</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatPill icon={<Coins className="h-4 w-4" />} value={state.coins} tone="gold" />
            <StatPill icon={<Trophy className="h-4 w-4" />} value={state.wins} tone="primary" />
            {user ? (
              <button
                type="button"
                onClick={() => supabase.auth.signOut()}
                className="flex items-center gap-2 border border-[#303030] bg-[#1e1e1e] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.11em] text-white transition hover:bg-[#252525]"
                title={user.user_metadata?.full_name ?? user.email ?? "Account"}
              >
                {user.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="" className="h-6 w-6" />
                ) : (
                  <span className="grid h-6 w-6 place-items-center bg-[#da291c] text-[11px]">
                    {(user.email?.[0] ?? "U").toUpperCase()}
                  </span>
                )}
                <LogOut className="h-3.5 w-3.5 opacity-80" />
              </button>
            ) : (
              <Link to="/auth" className="arcade-btn arcade-btn-cyan h-10 px-4">Sign in</Link>
            )}
          </div>
        </header>

        {/* HERO */}
        <section className="relative overflow-hidden border border-[#303030]"
                 style={{ background: "#181818" }}>
          {/* subtle red radial glow behind car */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[80%] w-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]"
               style={{ background: "rgba(218,41,28,0.06)" }} />

          <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.1fr_1fr_0.55fr] lg:items-center">
            {/* LEFT — title + CTA + flow */}
            <div className="flex flex-col items-center gap-5 text-center lg:items-start lg:text-left">
              <span className="font-display inline-flex items-center bg-[#da291c] px-3 py-1 text-[14px] uppercase tracking-[0.14em] text-white">
                Season 1
              </span>
              <h1 className="font-display text-white" style={{ fontSize: "clamp(2.4rem, 6vw, 64px)", letterSpacing: "0.01em", lineHeight: 1 }}>
                WORLD QUIZ RACE
              </h1>
              <Link to={`/race/${firstTrack.id}`} className="play-btn font-display z-20" style={{ fontSize: 18, letterSpacing: "0.12em" }}>
                <Play className="h-3.5 w-3.5 fill-current" /> Play Now
              </Link>
              <Link to="/quiz" className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.11em] text-[#969696] transition hover:text-white">
                <Brain className="h-3.5 w-3.5" /> Play Quiz · earn coins
              </Link>
              <div className="mt-1">
                <FlowChain />
              </div>
            </div>

            {/* CENTER — car */}
            <div className="relative mx-auto w-full max-w-[420px]">
              {/* speed lines */}
              <div className="pointer-events-none absolute inset-y-0 left-0 w-24 opacity-30">
                <div className="absolute top-[20%] h-px w-16 -rotate-[8deg] bg-white" />
                <div className="absolute top-[35%] h-px w-20 -rotate-[6deg] bg-white" />
                <div className="absolute top-[50%] h-px w-14 -rotate-[10deg] bg-[#da291c]" />
                <div className="absolute top-[65%] h-px w-20 -rotate-[6deg] bg-white" />
                <div className="absolute top-[80%] h-px w-16 -rotate-[8deg] bg-white" />
              </div>
              <Car />
              <div className="mt-2 h-px bg-[repeating-linear-gradient(90deg,#303030_0_24px,transparent_24px_42px)] animate-road" />
            </div>

            {/* RIGHT — stat boxes stacked vertically */}
            <div className="grid grid-cols-3 gap-2 lg:grid-cols-1 lg:gap-2">
              <HeroStat icon={<Coins  className="h-4 w-4" />} label="Coins"  value={state.coins} bg="#2a1f08" border="#5a4218" accent="#c8a050" />
              <HeroStat icon={<Trophy className="h-4 w-4" />} label="Wins"   value={state.wins}  bg="#1f0a0a" border="#5a1a1a" accent="#da291c" />
              <HeroStat icon={<Flag   className="h-4 w-4" />} label="Tracks" value={`${state.unlockedTracks}/${tracks.length}`} bg="#080f1f" border="#18305a" accent="#4a7ac8" />
            </div>
          </div>
        </section>

        {/* BIG QUIZ CTA */}
        <section className="-mx-3 sm:-mx-5" style={{ background: "#111", padding: "20px 0" }}>
          <div className="mx-auto flex max-w-[1280px] justify-center px-3 sm:px-5">
            <Link
              to="/quiz"
              className="inline-flex items-center justify-center gap-3 bg-[#da291c] text-white transition hover:bg-[#b01e0a]"
              style={{
                fontFamily: "'Anton', sans-serif",
                fontSize: 22,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                padding: "18px 64px",
                borderRadius: 0,
              }}
            >
              <Coins className="h-6 w-6" />
              Play Quiz · Earn Coins
            </Link>
          </div>
        </section>

        {/* GARAGE */}
        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="arcade-card p-6">
            <div className="mb-5 flex items-end justify-between border-b border-[#303030] pb-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.11em] text-[#da291c]">Garage</div>
                <h2 className="font-display mt-1 text-2xl text-white" style={{ letterSpacing: "0.02em" }}>Upgrade your racer</h2>
              </div>
              <div className="inline-flex items-center gap-1.5 border border-[#5a4218] bg-[#2a1f08] px-3 py-1.5 text-sm font-bold text-[#c8a050]">
                <Coins className="h-4 w-4" /> <span className="tabular-nums">{state.coins}</span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {UPGRADES.map((u) => {
                const lvl = state.upgrades[u.key];
                const max = lvl >= MAX_LEVEL;
                const cost = max ? 0 : COSTS[lvl];
                const afford = state.coins >= cost;
                return (
                  <div key={u.key} className="relative overflow-hidden border border-[#303030] bg-[#1e1e1e] p-4 transition hover:border-[#404040]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="grid h-11 w-11 place-items-center bg-[#252525] border border-[#303030] text-xl">
                          {u.emoji}
                        </span>
                        <div>
                          <div className="font-display text-lg uppercase tracking-[0.06em] text-white leading-tight">{u.label}</div>
                          <div className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.11em] text-[#969696]">
                            Lv {lvl} {!max && <span className="text-[#da291c]">→ Lv {lvl + 1}</span>}
                          </div>
                        </div>
                      </div>
                      {max && <span className="bg-[#da291c] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.11em] text-white">Max</span>}
                    </div>
                    <div className="mt-4 h-[3px] bg-[#2a2a2a]">
                      <div className="h-full bg-[#da291c] transition-all" style={{ width: `${(lvl / MAX_LEVEL) * 100}%` }} />
                    </div>
                    <button
                      type="button"
                      onClick={() => buyUpgrade(u.key)}
                      disabled={max || !afford}
                      className={`mt-4 flex w-full items-center justify-center gap-1.5 px-3 py-2.5 text-[12px] font-bold uppercase tracking-[0.11em] transition ${
                        max ? "bg-[#252525] text-[#696969] cursor-not-allowed" :
                        afford ? "bg-[#f5c518] text-[#1a1100] hover:bg-[#ffd633]" :
                        "bg-[#1e1e1e] text-[#696969] border border-[#303030] cursor-not-allowed"
                      } font-display`}
                      style={{ fontSize: 14, letterSpacing: "0.12em" }}
                    >
                      {max ? "Maxed out" : (
                        <>
                          <Wrench className="h-3.5 w-3.5" /> Upgrade · {cost}
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* TRACKS */}
          <div className="arcade-card p-6">
            <div className="mb-5 flex items-end justify-between border-b border-[#303030] pb-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.11em] text-[#da291c]">Race</div>
                <h2 className="font-display mt-1 text-2xl text-white" style={{ letterSpacing: "0.02em" }}>Tracks</h2>
              </div>
              <Flag className="h-5 w-5 text-[#969696]" />
            </div>
            <div className="flex max-h-[520px] flex-col gap-3 overflow-y-auto pr-1">
              {tracks.map((t, i) => {
                const unlocked = i < state.unlockedTracks;
                return (
                  <Link
                    key={t.id}
                    to="/race/$trackId"
                    params={{ trackId: t.id }}
                    className={`group relative overflow-hidden border p-4 transition ${
                      unlocked
                        ? "border-[#303030] bg-[#1e1e1e] hover:border-[#da291c]"
                        : "border-[#252525] bg-[#181818] opacity-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid h-12 w-12 place-items-center border border-[#303030] bg-[#252525] text-2xl">{t.flag}</span>
                      <div className="flex-1">
                        <div className="font-display text-lg uppercase tracking-[0.04em] text-white">{t.name}</div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.11em]">
                          <span className={unlocked ? "text-[#03904a]" : "text-[#696969]"}>
                            {unlocked ? "● Ready" : "🔒 Locked"}
                          </span>
                          <span className="text-[#303030]">·</span>
                          <span className="text-[#969696]">Laps {t.laps}</span>
                        </div>
                      </div>
                      {unlocked && (
                        <span className="font-display inline-flex items-center gap-1 bg-[#da291c] px-4 py-2.5 text-[14px] uppercase tracking-[0.12em] text-white transition group-hover:bg-[#b01e0a]">
                          Drive <ChevronRight className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                    {unlocked && (
                      <p className="mt-3 text-[12px] leading-relaxed text-[#969696]">
                        {t.description}
                      </p>
                    )}
                  </Link>
                );
              })}
              <div className="border border-dashed border-[#303030] p-4 text-center text-[11px] font-bold uppercase tracking-[0.11em] text-[#696969]">
                <Sparkles className="mx-auto mb-1 h-4 w-4" /> More tracks coming soon
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

/* ============== components ============== */

function StatPill({ icon, value, tone }: { icon: React.ReactNode; value: number | string; tone: "gold" | "primary" }) {
  const cls = tone === "gold"
    ? "border-[#5a4218] bg-[#2a1f08] text-[#c8a050]"
    : "border-[#5a1a1a] bg-[#1f0a0a] text-[#da291c]";
  return (
    <div className={`flex items-center gap-1.5 border ${cls} px-3 py-2 text-[13px] font-bold tabular-nums`}>
      {icon}
      <span>{value}</span>
    </div>
  );
}

function HeroStat({ icon, label, value, bg, border, accent }: {
  icon: React.ReactNode; label: string; value: number | string; bg: string; border: string; accent: string;
}) {
  return (
    <div className="relative overflow-hidden border p-3.5"
         style={{ background: bg, borderColor: border }}>
      {/* thin red left border accent */}
      <div className="absolute inset-y-0 left-0 w-px" style={{ background: "#da291c" }} />
      <div className="flex items-center gap-2" style={{ color: accent }}>
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-[0.11em]">{label}</span>
      </div>
      <div className="font-display mt-1.5 text-[32px] tabular-nums leading-none text-white" style={{ letterSpacing: "0.02em" }}>{value}</div>
    </div>
  );
}

function FlowChain() {
  const steps = [
    { label: "Quiz" },
    { label: "Coins" },
    { label: "Upgrade" },
    { label: "Race" },
  ];
  return (
    <div className="flex items-center gap-2 border border-[#303030] bg-[#1e1e1e] px-3 py-2">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-2">
          <span className="font-display text-[14px] uppercase tracking-[0.12em] text-[#969696]">{s.label}</span>
          {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-[#404040]" />}
        </div>
      ))}
    </div>
  );
}

function Car() {
  return (
    <svg
      viewBox="0 0 360 170"
      className="relative z-10 w-full animate-car-idle drop-shadow-[0_30px_40px_oklch(0.72_0.28_350/0.55)]"
      aria-label="Player racing car"
    >
      <defs>
        <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="oklch(0.92 0.18 340)" />
          <stop offset="45%" stopColor="oklch(0.72 0.28 350)" />
          <stop offset="100%" stopColor="oklch(0.42 0.22 350)" />
        </linearGradient>
        <linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"  stopColor="oklch(0.92 0.20 95)" />
          <stop offset="100%" stopColor="oklch(0.80 0.18 200)" />
        </linearGradient>
        <linearGradient id="windowGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="oklch(0.95 0.05 200)" stopOpacity="0.95" />
          <stop offset="100%" stopColor="oklch(0.35 0.12 260)" stopOpacity="0.85" />
        </linearGradient>
        <radialGradient id="headlight" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%"   stopColor="oklch(1 0.05 90)" />
          <stop offset="100%" stopColor="oklch(0.95 0.15 90)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g opacity="0.55" stroke="oklch(0.92 0.20 95)" strokeLinecap="round">
        <line x1="2"  y1="60"  x2="40" y2="60"  strokeWidth="2.5" />
        <line x1="6"  y1="78"  x2="34" y2="78"  strokeWidth="2" opacity="0.7" />
        <line x1="0"  y1="98"  x2="48" y2="98"  strokeWidth="3" />
        <line x1="10" y1="118" x2="32" y2="118" strokeWidth="2" opacity="0.6" />
      </g>

      <path d="M20 70 L70 60 L78 66 L24 80 Z" fill="oklch(0.22 0.10 282)" stroke="url(#accentGrad)" strokeWidth="1.4" />
      <rect x="18" y="65" width="6" height="14" rx="2" fill="oklch(0.22 0.10 282)" />

      <path d="M30 118 L55 95 Q90 70 150 62 L235 58 Q295 58 330 92 L348 108 Q352 118 342 122 L36 122 Q22 122 30 118 Z"
            fill="url(#bodyGrad)" stroke="oklch(1 0 0)" strokeWidth="1.8" />

      <path d="M120 102 L180 102 L172 116 L128 116 Z" fill="oklch(0.18 0.10 280)" />
      <path d="M130 105 L168 105 L164 113 L134 113 Z" fill="url(#accentGrad)" opacity="0.95" />

      <path d="M115 64 Q140 30 195 28 L240 30 Q280 36 300 66 L295 70 L120 70 Z"
            fill="url(#windowGrad)" stroke="oklch(1 0 0)" strokeWidth="1.4" />
      <path d="M205 30 L210 68" stroke="oklch(1 0 0)" strokeWidth="0.8" opacity="0.7" />
      <path d="M132 56 Q170 42 230 40" stroke="oklch(1 0.05 200)" strokeWidth="2" opacity="0.45" fill="none" />

      <path d="M58 92 Q120 80 200 80 L300 86" stroke="url(#accentGrad)" strokeWidth="3" fill="none" strokeLinecap="round" />

      <path d="M308 116 L348 110 L350 120 L308 122 Z" fill="oklch(0.18 0.10 280)" />

      <ellipse cx="325" cy="90" rx="9" ry="4" fill="oklch(0.95 0.15 90)" />
      <ellipse cx="338" cy="92" rx="28" ry="3" fill="url(#headlight)" />

      <circle cx="170" cy="96" r="11" fill="oklch(0.12 0.06 282)" stroke="url(#accentGrad)" strokeWidth="2" />
      <text x="170" y="101" textAnchor="middle" fontSize="13" fontWeight="900" fill="oklch(0.95 0.05 200)" fontFamily="Baloo 2, sans-serif">7</text>

      <ellipse cx="185" cy="138" rx="155" ry="7" fill="oklch(0.92 0.20 95)" opacity="0.55" />
      <ellipse cx="185" cy="142" rx="120" ry="4" fill="oklch(0.72 0.28 350)" opacity="0.55" />

      <g>
        <ellipse cx="95" cy="124" rx="28" ry="26" fill="oklch(0.1 0.06 280)" />
        <circle cx="95" cy="124" r="16" fill="oklch(0.25 0.10 282)" />
        <g className="animate-wheel-spin" style={{ transformOrigin: "95px 124px" }}>
          <circle cx="95" cy="124" r="13" fill="none" stroke="oklch(0.92 0.20 95)" strokeWidth="1.8" />
          <line x1="82" y1="124" x2="108" y2="124" stroke="oklch(0.92 0.20 95)" strokeWidth="2" />
          <line x1="95" y1="111" x2="95" y2="137" stroke="oklch(0.92 0.20 95)" strokeWidth="2" />
          <line x1="86" y1="115" x2="104" y2="133" stroke="oklch(0.72 0.28 350)" strokeWidth="1.5" />
          <line x1="104" y1="115" x2="86" y2="133" stroke="oklch(0.72 0.28 350)" strokeWidth="1.5" />
        </g>
        <circle cx="95" cy="124" r="3" fill="oklch(1 0 0)" />
      </g>
      <g>
        <ellipse cx="278" cy="124" rx="28" ry="26" fill="oklch(0.1 0.06 280)" />
        <circle cx="278" cy="124" r="16" fill="oklch(0.25 0.10 282)" />
        <g className="animate-wheel-spin" style={{ transformOrigin: "278px 124px" }}>
          <circle cx="278" cy="124" r="13" fill="none" stroke="oklch(0.92 0.20 95)" strokeWidth="1.8" />
          <line x1="265" y1="124" x2="291" y2="124" stroke="oklch(0.92 0.20 95)" strokeWidth="2" />
          <line x1="278" y1="111" x2="278" y2="137" stroke="oklch(0.92 0.20 95)" strokeWidth="2" />
          <line x1="269" y1="115" x2="287" y2="133" stroke="oklch(0.72 0.28 350)" strokeWidth="1.5" />
          <line x1="287" y1="115" x2="269" y2="133" stroke="oklch(0.72 0.28 350)" strokeWidth="1.5" />
        </g>
        <circle cx="278" cy="124" r="3" fill="oklch(1 0 0)" />
      </g>
    </svg>
  );
}
