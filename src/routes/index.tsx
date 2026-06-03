import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Gauge, Zap, Rocket, Move, Coins, Trophy, Flag, ChevronRight,
  Brain, Wrench, Sparkles, Play, LogOut, Star, Lock, ArrowUp, Crown,
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

type Rarity = "common" | "rare" | "epic" | "legendary";
const RARITY: Record<Rarity, { label: string; color: string; glow: string; border: string; bg: string }> = {
  common:    { label: "Common",    color: "#9aa3b8", glow: "rgba(154,163,184,0.4)",  border: "rgba(154,163,184,0.5)",  bg: "rgba(154,163,184,0.08)" },
  rare:      { label: "Rare",      color: "#22e6ff", glow: "rgba(34,230,255,0.55)",  border: "rgba(34,230,255,0.6)",   bg: "rgba(34,230,255,0.08)" },
  epic:      { label: "Epic",      color: "#9b5cff", glow: "rgba(155,92,255,0.55)",  border: "rgba(155,92,255,0.6)",   bg: "rgba(155,92,255,0.10)" },
  legendary: { label: "Legendary", color: "#ffd042", glow: "rgba(255,208,66,0.55)",  border: "rgba(255,208,66,0.6)",   bg: "rgba(255,208,66,0.10)" },
};
function rarityForLevel(lvl: number): Rarity {
  if (lvl >= 4) return "legendary";
  if (lvl >= 3) return "epic";
  if (lvl >= 2) return "rare";
  return "common";
}

const UPGRADES: {
  key: UpgradeKey; label: string; icon: React.ReactNode;
  accent: string; bonus: string;
}[] = [
  { key: "speed",        label: "Top Speed",    icon: <Gauge className="h-5 w-5" />,  accent: "#22e6ff", bonus: "+8 km/h" },
  { key: "acceleration", label: "Acceleration", icon: <Rocket className="h-5 w-5" />, accent: "#ff2bd6", bonus: "+0.3s 0-60" },
  { key: "nitro",        label: "Nitro Boost",  icon: <Zap className="h-5 w-5" />,    accent: "#ffd042", bonus: "+1 charge" },
  { key: "control",      label: "Handling",     icon: <Move className="h-5 w-5" />,   accent: "#00ffa3", bonus: "+5% grip" },
];

const TRACK_META: Record<string, { difficulty: number; reward: number; thumbAccent: string; thumbAccent2: string }> = {
  circuit:    { difficulty: 2, reward: 150, thumbAccent: "#22e6ff", thumbAccent2: "#9b5cff" },
};
const DEFAULT_TRACK_META = { difficulty: 3, reward: 250, thumbAccent: "#ff2bd6", thumbAccent2: "#ffd042" };

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

  // Season progress derived from wins (purely visual)
  const seasonLevel = Math.min(50, 1 + Math.floor(state.wins / 2));
  const xpInLevel = (state.wins % 2) * 50 + Math.min(50, state.coins % 50);
  const xpPct = Math.min(100, (xpInLevel / 100) * 100);

  return (
    <main className="relative min-h-screen overflow-hidden text-foreground">
      {/* Atmospheric backdrop */}
      <div className="pointer-events-none absolute inset-0 neon-grid-bg opacity-50" />
      <div className="pointer-events-none absolute -left-32 top-1/4 h-[28rem] w-[28rem] rounded-full bg-[#ff2bd6]/20 blur-[140px] animate-float-slow" />
      <div className="pointer-events-none absolute -right-32 bottom-1/4 h-[32rem] w-[32rem] rounded-full bg-[#22e6ff]/15 blur-[160px] animate-float-slow" style={{ animationDelay: "-6s" }} />
      {/* Particles */}
      <Particles />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1320px] flex-col gap-5 p-3 sm:p-6">

        {/* HEADER */}
        <header className="flex items-center justify-between gap-3 rounded-2xl border border-[rgba(155,92,255,0.25)] bg-[rgba(18,10,40,0.6)] px-4 py-3 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-lg text-xl"
                  style={{ background: "var(--gradient-primary)", boxShadow: "0 0 24px rgba(255,43,214,0.6)" }}>🏁</span>
            <div className="leading-tight">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] neon-text-cyan">Scuderia Neon</div>
              <div className="font-display text-base text-white sm:text-lg">World Quiz Race</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatPill icon={<Coins className="h-4 w-4" />} value={state.coins} tone="gold" />
            <StatPill icon={<Trophy className="h-4 w-4" />} value={state.wins} tone="red" />
            {user ? (
              <button
                type="button"
                onClick={() => supabase.auth.signOut()}
                className="arcade-btn arcade-btn-ghost h-10 px-3"
                title={user.user_metadata?.full_name ?? user.email ?? "Account"}
              >
                {user.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="" className="h-6 w-6 rounded-full" />
                ) : (
                  <span className="grid h-6 w-6 place-items-center rounded-full text-[11px]"
                        style={{ background: "var(--gradient-primary)" }}>
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

        {/* SEASON PROGRESS */}
        <section className="arcade-card flex items-center gap-4 px-5 py-4">
          <div className="grid h-14 w-14 place-items-center rounded-xl border"
               style={{ background: "var(--gradient-primary)", borderColor: "rgba(255,43,214,0.6)", boxShadow: "0 0 24px rgba(255,43,214,0.5)" }}>
            <Crown className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] neon-text-magenta">Season 1 · Neon Drift</div>
                <div className="font-display text-lg text-white">Driver Level <span className="neon-text-cyan">{seasonLevel}</span></div>
              </div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#cfd4ff]/70">
                Next reward · <span className="neon-text-gold">Aurora Skin</span>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgba(155,92,255,0.18)]">
              <div className="h-full rounded-full transition-all"
                   style={{ width: `${xpPct}%`, background: "linear-gradient(90deg,#ff2bd6,#9b5cff,#22e6ff)", boxShadow: "0 0 12px rgba(255,43,214,0.6)" }} />
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-[#cfd4ff]/60">
              <span>{xpInLevel} / 100 XP</span>
              <span>Lvl {seasonLevel + 1} · Phantom GT unlock</span>
            </div>
          </div>
        </section>

        {/* HERO */}
        <section className="relative overflow-hidden rounded-3xl border border-[rgba(155,92,255,0.35)]"
                 style={{
                   background:
                     "radial-gradient(120% 80% at 50% 100%, rgba(255,43,214,0.25), transparent 60%)," +
                     "radial-gradient(80% 60% at 20% 0%, rgba(34,230,255,0.15), transparent 60%)," +
                     "linear-gradient(180deg, #15082e 0%, #0b0420 100%)",
                   boxShadow: "0 30px 80px -30px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.06)",
                 }}>
          {/* Skyline silhouette */}
          <CitySkyline />
          {/* Perspective neon floor */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%]">
            <div className="absolute inset-0 neon-floor opacity-70" />
          </div>
          {/* Speed streaks */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {[12, 30, 48, 62, 78].map((top, i) => (
              <div key={i}
                   className="absolute h-px animate-streak"
                   style={{
                     top: `${top}%`,
                     left: 0, right: 0,
                     background: i % 2 ? "linear-gradient(90deg, transparent, #22e6ff, transparent)" : "linear-gradient(90deg, transparent, #ff2bd6, transparent)",
                     animationDelay: `${i * 0.25}s`,
                     opacity: 0.65,
                   }} />
            ))}
          </div>

          <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.1fr_1.2fr] lg:items-center">
            {/* LEFT */}
            <div className="relative z-10 flex flex-col items-center gap-6 text-center lg:items-start lg:text-left">
              <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(34,230,255,0.5)] bg-[rgba(34,230,255,0.08)] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.28em] neon-text-cyan">
                <Sparkles className="h-3 w-3" /> Season 1 · Live
              </span>
              <h1 className="text-gradient-title font-display" style={{ fontSize: "clamp(2.6rem, 7vw, 88px)", lineHeight: 0.95 }}>
                World<br/>Quiz Race
              </h1>
              <p className="max-w-md text-[14px] uppercase tracking-[0.18em] text-[#cfd4ff]/70">
                Answer · Earn · Upgrade · <span className="neon-text-magenta">Dominate the grid</span>
              </p>
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center lg:items-start">
                <Link to={`/race/${firstTrack.id}`} className="play-btn">
                  <Play className="h-5 w-5 fill-current" /> Play Now
                </Link>
                <Link to="/quiz" className="arcade-btn arcade-btn-ghost h-14 px-6 text-base">
                  <Brain className="h-4 w-4" /> Quiz · earn coins
                </Link>
              </div>
              <FlowChain />
            </div>

            {/* RIGHT — car stage */}
            <div className="relative mx-auto flex w-full max-w-[560px] items-end justify-center">
              {/* Glow disc under car */}
              <div className="pointer-events-none absolute bottom-6 left-1/2 h-12 w-[80%] -translate-x-1/2 rounded-[50%]"
                   style={{ background: "radial-gradient(ellipse, rgba(255,43,214,0.6), transparent 70%)", filter: "blur(20px)" }} />
              <div className="pointer-events-none absolute -inset-4 rounded-full"
                   style={{ background: "radial-gradient(circle, rgba(155,92,255,0.25), transparent 60%)" }} />
              <Car />
            </div>
          </div>
        </section>

        {/* PLAYER STATS DASHBOARD */}
        <section className="grid gap-4 sm:grid-cols-3">
          <DashStat
            icon={<Coins className="h-6 w-6" />}
            label="Coins" value={state.coins}
            accent="#ffd042" gradient="linear-gradient(135deg, rgba(255,208,66,0.18), rgba(255,138,0,0.08))"
            sub="Spend in garage"
          />
          <DashStat
            icon={<Trophy className="h-6 w-6" />}
            label="Wins" value={state.wins}
            accent="#ff3a55" gradient="linear-gradient(135deg, rgba(255,58,85,0.18), rgba(255,43,214,0.08))"
            sub="Podium finishes"
          />
          <DashStat
            icon={<Flag className="h-6 w-6" />}
            label="Tracks" value={`${state.unlockedTracks}/${tracks.length}`}
            accent="#3a7dff" gradient="linear-gradient(135deg, rgba(58,125,255,0.18), rgba(34,230,255,0.08))"
            sub="Unlocked circuits"
          />
        </section>

        {/* BIG QUIZ CTA */}
        <section className="relative overflow-hidden rounded-2xl border border-[rgba(34,230,255,0.4)] p-6 text-center"
                 style={{ background: "linear-gradient(135deg, rgba(34,230,255,0.12), rgba(155,92,255,0.18))", boxShadow: "0 0 40px rgba(34,230,255,0.2)" }}>
          <div className="pointer-events-none absolute -inset-px opacity-50 neon-grid-bg" />
          <div className="relative flex flex-col items-center justify-between gap-4 sm:flex-row sm:text-left">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.28em] neon-text-cyan">Quick coins</div>
              <div className="font-display mt-1 text-2xl text-white">Answer geography · win bounty</div>
            </div>
            <Link
              to="/quiz"
              className="arcade-btn arcade-btn-coin h-14 px-8 text-base"
              style={{ boxShadow: "0 0 30px rgba(255,208,66,0.5), inset 0 1px 0 rgba(255,255,255,0.3)" }}
            >
              <Coins className="h-5 w-5" />
              Play Quiz · Earn Coins
            </Link>
          </div>
        </section>

        {/* GARAGE */}
        <section className="arcade-card p-6">
          <div className="mb-5 flex items-end justify-between border-b border-[rgba(155,92,255,0.25)] pb-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.28em] neon-text-magenta">Garage</div>
              <h2 className="font-display mt-1 text-2xl text-white">Upgrade your racer</h2>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,208,66,0.5)] bg-[rgba(255,208,66,0.1)] px-3 py-1.5 text-sm font-bold neon-text-gold">
              <Coins className="h-4 w-4" /> <span className="tabular-nums">{state.coins}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {UPGRADES.map((u) => {
              const lvl = state.upgrades[u.key];
              const max = lvl >= MAX_LEVEL;
              const cost = max ? 0 : COSTS[lvl];
              const afford = state.coins >= cost;
              const rar = RARITY[rarityForLevel(lvl)];
              return (
                <div key={u.key}
                     className="group relative overflow-hidden rounded-xl border p-5 transition hover:-translate-y-0.5"
                     style={{
                       borderColor: rar.border,
                       background: `linear-gradient(180deg, ${rar.bg}, rgba(15,8,32,0.85))`,
                       boxShadow: `0 0 0 1px ${rar.border} inset, 0 0 24px -8px ${rar.glow}`,
                     }}>
                  {/* Rarity ribbon */}
                  <span className="absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.22em]"
                        style={{ color: rar.color, border: `1px solid ${rar.border}`, background: "rgba(0,0,0,0.3)" }}>
                    {rar.label}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-lg"
                          style={{ background: `linear-gradient(135deg, ${u.accent}, transparent)`, color: "#fff", boxShadow: `0 0 18px ${u.accent}55` }}>
                      {u.icon}
                    </span>
                    <div>
                      <div className="font-display text-lg text-white">{u.label}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#cfd4ff]/70">
                        Lv <span className="text-white">{lvl}</span>
                        {!max && <><ArrowUp className="h-3 w-3" style={{ color: u.accent }} /><span style={{ color: u.accent }}>Lv {lvl + 1}</span></>}
                      </div>
                    </div>
                  </div>

                  {/* Pip levels */}
                  <div className="mt-4 flex items-center gap-1.5">
                    {Array.from({ length: MAX_LEVEL }).map((_, i) => (
                      <div key={i} className="h-1.5 flex-1 rounded-full"
                           style={{
                             background: i < lvl ? u.accent : "rgba(255,255,255,0.08)",
                             boxShadow: i < lvl ? `0 0 8px ${u.accent}` : "none",
                           }} />
                    ))}
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.18em]">
                    <span className="text-[#cfd4ff]/60">Next bonus</span>
                    <span style={{ color: u.accent }}>{u.bonus}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => buyUpgrade(u.key)}
                    disabled={max || !afford}
                    className="arcade-btn mt-4 w-full"
                    style={ max ? { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", boxShadow: "none" }
                           : afford ? { background: `linear-gradient(135deg, ${u.accent}, ${rar.color})`, color: "#0a0420", boxShadow: `0 0 24px ${u.accent}55, inset 0 1px 0 rgba(255,255,255,0.3)` }
                           : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", boxShadow: "none" }}
                  >
                    {max ? <><Star className="h-4 w-4" /> Maxed Out</>
                         : <><Wrench className="h-4 w-4" /> Upgrade · {cost}</>}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* TRACKS */}
        <section className="arcade-card p-6">
          <div className="mb-5 flex items-end justify-between border-b border-[rgba(34,230,255,0.25)] pb-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.28em] neon-text-cyan">Race</div>
              <h2 className="font-display mt-1 text-2xl text-white">Select your mission</h2>
            </div>
            <Flag className="h-5 w-5 text-[#cfd4ff]/60" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tracks.map((t, i) => {
              const unlocked = i < state.unlockedTracks;
              const meta = TRACK_META[t.id] ?? DEFAULT_TRACK_META;
              return (
                <TrackCard key={t.id} track={t} unlocked={unlocked} meta={meta} />
              );
            })}
            <div className="flex items-center justify-center rounded-xl border border-dashed border-[rgba(155,92,255,0.3)] p-6 text-center text-[11px] font-bold uppercase tracking-[0.22em] text-[#cfd4ff]/50">
              <div>
                <Sparkles className="mx-auto mb-2 h-5 w-5 animate-neon-pulse text-[#9b5cff]" />
                More tracks dropping soon
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

/* ============== components ============== */

function StatPill({ icon, value, tone }: { icon: React.ReactNode; value: number | string; tone: "gold" | "red" | "cyan" }) {
  const colorMap = {
    gold: { border: "rgba(255,208,66,0.5)", bg: "rgba(255,208,66,0.08)", color: "#ffd97a", glow: "rgba(255,208,66,0.4)" },
    red:  { border: "rgba(255,58,85,0.5)",  bg: "rgba(255,58,85,0.08)",  color: "#ff8a98", glow: "rgba(255,58,85,0.4)" },
    cyan: { border: "rgba(34,230,255,0.5)", bg: "rgba(34,230,255,0.08)", color: "#9beaff", glow: "rgba(34,230,255,0.4)" },
  } as const;
  const c = colorMap[tone];
  return (
    <div className="flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-bold tabular-nums"
         style={{ borderColor: c.border, background: c.bg, color: c.color, boxShadow: `0 0 14px -4px ${c.glow}` }}>
      {icon}
      <span>{value}</span>
    </div>
  );
}

function DashStat({ icon, label, value, accent, gradient, sub }: {
  icon: React.ReactNode; label: string; value: number | string; accent: string; gradient: string; sub: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border p-5 transition hover:-translate-y-1"
         style={{
           borderColor: `${accent}66`,
           background: gradient + ", rgba(15,8,32,0.85)",
           boxShadow: `0 0 24px -8px ${accent}80, inset 0 1px 0 rgba(255,255,255,0.06)`,
         }}>
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full"
           style={{ background: `radial-gradient(circle, ${accent}40, transparent 70%)` }} />
      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl"
                style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}55`, boxShadow: `0 0 16px ${accent}55` }}>
            {icon}
          </span>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: `${accent}` }}>{label}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-[#cfd4ff]/50">{sub}</div>
          </div>
        </div>
      </div>
      <div className="relative mt-4 font-display text-[44px] leading-none tabular-nums text-white"
           style={{ textShadow: `0 0 18px ${accent}80` }}>
        {value}
      </div>
    </div>
  );
}

function TrackCard({ track, unlocked, meta }: {
  track: { id: string; name: string; flag: string; description: string; laps: number };
  unlocked: boolean;
  meta: { difficulty: number; reward: number; thumbAccent: string; thumbAccent2: string };
}) {
  const card = (
    <div className={`group relative overflow-hidden rounded-xl border transition ${
      unlocked ? "hover:-translate-y-1" : "opacity-60"
    }`}
         style={{
           borderColor: unlocked ? "rgba(34,230,255,0.35)" : "rgba(155,92,255,0.15)",
           background: "linear-gradient(180deg, rgba(20,10,45,0.9), rgba(10,4,28,0.95))",
           boxShadow: unlocked ? "0 0 20px -8px rgba(34,230,255,0.5)" : "none",
         }}>
      {/* Thumbnail */}
      <div className="relative h-32 overflow-hidden"
           style={{
             background:
               `linear-gradient(135deg, ${meta.thumbAccent}33, ${meta.thumbAccent2}33), ` +
               `radial-gradient(circle at 30% 70%, ${meta.thumbAccent}55, transparent 60%), ` +
               `radial-gradient(circle at 70% 30%, ${meta.thumbAccent2}55, transparent 60%), #0a0420`,
           }}>
        <div className="absolute inset-0 neon-grid-bg opacity-40" />
        {/* Stylized track loop */}
        <svg viewBox="0 0 200 80" className="absolute inset-0 h-full w-full">
          <path d="M30 60 Q30 20 70 20 L130 20 Q170 20 170 60 Q170 70 130 70 L70 70 Q30 70 30 60 Z"
                fill="none" stroke={meta.thumbAccent} strokeWidth="2"
                style={{ filter: `drop-shadow(0 0 6px ${meta.thumbAccent})` }} />
          <path d="M30 60 Q30 20 70 20 L130 20 Q170 20 170 60"
                fill="none" stroke={meta.thumbAccent2} strokeWidth="1" strokeDasharray="4 4" opacity="0.7" />
        </svg>
        <span className="absolute left-3 top-3 grid h-10 w-10 place-items-center rounded-lg border text-xl backdrop-blur-md"
              style={{ borderColor: `${meta.thumbAccent}66`, background: "rgba(0,0,0,0.4)" }}>{track.flag}</span>
        {!unlocked && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <Lock className="h-7 w-7 text-[#cfd4ff]/70" />
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-display text-lg text-white">{track.name}</div>
            <div className="mt-1 flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-3 w-3"
                      style={{
                        color: i < meta.difficulty ? "#ffd042" : "rgba(255,255,255,0.15)",
                        fill: i < meta.difficulty ? "#ffd042" : "transparent",
                        filter: i < meta.difficulty ? "drop-shadow(0 0 4px #ffd042)" : "none",
                      }} />
              ))}
            </div>
          </div>
          {unlocked && (
            <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em]"
                  style={{ color: "#00ffa3", border: "1px solid rgba(0,255,163,0.4)", background: "rgba(0,255,163,0.08)" }}>
              ● Ready
            </span>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-[rgba(255,208,66,0.3)] bg-[rgba(255,208,66,0.06)] px-2.5 py-2">
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#cfd4ff]/50">Reward</div>
            <div className="mt-0.5 flex items-center gap-1 text-sm font-bold neon-text-gold">
              <Coins className="h-3.5 w-3.5" /> {meta.reward}
            </div>
          </div>
          <div className="rounded-lg border border-[rgba(34,230,255,0.3)] bg-[rgba(34,230,255,0.06)] px-2.5 py-2">
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#cfd4ff]/50">Laps</div>
            <div className="mt-0.5 flex items-center gap-1 text-sm font-bold neon-text-cyan">
              <Flag className="h-3.5 w-3.5" /> {track.laps}
            </div>
          </div>
        </div>

        {unlocked ? (
          <div className="arcade-btn mt-4 w-full group-hover:brightness-110">
            Drive <ChevronRight className="h-4 w-4" />
          </div>
        ) : (
          <div className="mt-4 w-full rounded-lg border border-[rgba(155,92,255,0.2)] bg-white/[0.02] py-3 text-center text-[11px] font-bold uppercase tracking-[0.22em] text-[#cfd4ff]/40">
            Locked · win to unlock
          </div>
        )}
      </div>
    </div>
  );

  if (!unlocked) return card;
  return (
    <Link to="/race/$trackId" params={{ trackId: track.id }} className="block">
      {card}
    </Link>
  );
}

function CitySkyline() {
  return (
    <svg viewBox="0 0 1200 220" className="pointer-events-none absolute inset-x-0 bottom-[35%] h-[40%] w-full opacity-60" preserveAspectRatio="none">
      <defs>
        <linearGradient id="cityGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9b5cff" stopOpacity="0.0" />
          <stop offset="60%" stopColor="#9b5cff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ff2bd6" stopOpacity="0.8" />
        </linearGradient>
      </defs>
      <path d="M0 220 L0 140 L40 140 L40 100 L80 100 L80 130 L120 130 L120 80 L160 80 L160 60 L200 60 L200 120 L240 120 L240 90 L290 90 L290 50 L330 50 L330 110 L380 110 L380 70 L420 70 L420 100 L470 100 L470 40 L510 40 L510 90 L560 90 L560 120 L610 120 L610 60 L660 60 L660 100 L710 100 L710 80 L760 80 L760 130 L810 130 L810 70 L860 70 L860 110 L910 110 L910 50 L950 50 L950 90 L1000 90 L1000 130 L1050 130 L1050 100 L1100 100 L1100 140 L1200 140 L1200 220 Z"
            fill="url(#cityGrad)" />
      {/* Window lights */}
      {[120, 200, 290, 380, 470, 560, 660, 760, 860, 950, 1050].map((x, i) => (
        <rect key={i} x={x + 8} y={90 + (i % 3) * 8} width="3" height="3" fill="#22e6ff" opacity="0.9" />
      ))}
    </svg>
  );
}

function Particles() {
  const dots = Array.from({ length: 18 });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {dots.map((_, i) => {
        const left = (i * 53) % 100;
        const delay = (i * 0.37) % 5;
        const size = 2 + (i % 3);
        const color = i % 3 === 0 ? "#ff2bd6" : i % 3 === 1 ? "#22e6ff" : "#9b5cff";
        return (
          <span key={i}
                className="absolute bottom-0 animate-particle rounded-full"
                style={{
                  left: `${left}%`,
                  width: size, height: size,
                  background: color,
                  boxShadow: `0 0 ${size * 3}px ${color}`,
                  animationDelay: `${delay}s`,
                }} />
        );
      })}
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
    <div className="flex flex-wrap items-center gap-2 rounded-full border border-[rgba(155,92,255,0.3)] bg-[rgba(20,10,45,0.6)] px-4 py-2 backdrop-blur-md">
      {steps.map((s, i) => {
        const colors = ["#22e6ff", "#ffd042", "#9b5cff", "#ff2bd6"];
        return (
          <div key={s.label} className="flex items-center gap-2">
            <span className="font-display text-[12px] uppercase tracking-[0.22em]"
                  style={{ color: colors[i], textShadow: `0 0 8px ${colors[i]}80` }}>
              {s.label}
            </span>
            {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-[#cfd4ff]/40" />}
          </div>
        );
      })}
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
