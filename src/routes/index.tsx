import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Brain,
  CarFront,
  Coins,
  Gauge,
  LogOut,
  Move,
  Play,
  Rocket,
  Trophy,
  UserCircle,
  Wrench,
  Zap,
} from "lucide-react";
import { TRACKS } from "@/lib/tracks";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  CarFigure,
  DriverFigure,
  defaultState as defaultGarageState,
  getSelectedCar,
  getSelectedDriver,
  normalizeState,
  readGameState,
  writeGameState,
  type GameState,
  type UpgradeKey,
} from "@/lib/garage";
import { FeedbackToast, PremiumStat, ProgressionPanel, RacingShell } from "@/lib/racing-ui";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "World Quiz Race - Arcade racing & geo quiz" },
      { name: "description", content: "Answer quizzes, earn coins, upgrade your car and race." },
    ],
  }),
  component: HomeHUD,
});

const MAX_LEVEL = 5;
const COSTS = [100, 200, 350, 550, 800];

const UPGRADES: {
  key: UpgradeKey;
  label: string;
  icon: React.ReactNode;
}[] = [
  { key: "speed", label: "Speed", icon: <Gauge className="h-5 w-5" /> },
  { key: "acceleration", label: "Acceleration", icon: <Rocket className="h-5 w-5" /> },
  { key: "nitro", label: "Nitro", icon: <Zap className="h-5 w-5" /> },
  { key: "control", label: "Control", icon: <Move className="h-5 w-5" /> },
];

function defaultState(): GameState {
  return defaultGarageState();
}

function HomeHUD() {
  const [state, setState] = useState<GameState>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setState(readGameState());
    setHydrated(true);
  }, []);
  useEffect(() => {
    function onFocus() { setState(readGameState()); }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    writeGameState(state);
  }, [state, hydrated]);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  function showFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 2200);
  }

  function buyUpgrade(key: UpgradeKey) {
    setState((s) => {
      const current = normalizeState(s);
      const upgrades = current.upgrades ?? defaultState().upgrades!;
      const lvl = upgrades[key] ?? 0;
      if (lvl >= MAX_LEVEL) return s;
      const cost = COSTS[lvl];
      if ((current.coins ?? 0) < cost) {
        showFeedback("Need more coins");
        return s;
      }
      showFeedback("Upgrade successful");
      return { ...current, coins: (current.coins ?? 0) - cost, upgrades: { ...upgrades, [key]: lvl + 1 } };
    });
  }

  const tracks = TRACKS;
  const firstTrack = tracks[0];
  const selectedDriver = getSelectedDriver(state);
  const selectedCar = getSelectedCar(state);
  const upgrades = state.upgrades ?? defaultState().upgrades!;

  return (
    <RacingShell>
      <FeedbackToast message={feedback} />

      <div className="flex justify-end gap-2">
        {user ? (
          <>
            <Link
              to="/profile"
              className="flex items-center gap-2 border border-[#303030] bg-[#1e1e1e] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.11em] text-white transition hover:border-[#da291c]"
              title={user.user_metadata?.full_name ?? user.email ?? "Profile"}
            >
              {user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="" className="h-6 w-6" />
              ) : (
                <UserCircle className="h-4 w-4" />
              )}
              <span className="max-w-[180px] truncate normal-case tracking-normal">{user.email}</span>
            </Link>
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              className="grid h-10 w-10 place-items-center border border-[#303030] bg-[#1e1e1e] text-white transition hover:border-[#da291c]"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4 opacity-80" />
            </button>
          </>
        ) : (
          <Link to="/auth" className="arcade-btn arcade-btn-cyan h-10 px-4">Register / Log in</Link>
        )}
      </div>

      <section className="relative overflow-hidden border border-[#303030] bg-[#181818]">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 bg-[#da291c]/10 blur-[120px]" />
        <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[0.95fr_1.25fr_0.55fr] lg:items-center">
          <div className="flex flex-col items-center gap-5 text-center lg:items-start lg:text-left">
            <span className="font-display inline-flex items-center bg-[#da291c] px-3 py-1 text-[13px] uppercase tracking-[0.14em] text-white">
              Quiz - Coins - Upgrade - Race
            </span>
            <h1 className="font-display text-white" style={{ fontSize: "clamp(2.4rem, 6vw, 64px)", lineHeight: 1 }}>
              WORLD QUIZ RACE
            </h1>
            <p className="max-w-[520px] text-sm font-bold uppercase tracking-[0.1em] text-[#969696]">
              Answer quizzes, earn coins, tune your car, then win races.
            </p>
            <div className="grid w-full max-w-[520px] grid-cols-1 gap-3 sm:grid-cols-2">
              <Link
                to={`/race/${firstTrack.id}`}
                className={`play-btn font-display z-20 h-[68px] w-full ${hydrated && state.wins === 0 ? "animate-hint-pulse" : ""}`}
                style={{ fontSize: 18, letterSpacing: "0.12em" }}
              >
                <Play className="h-3.5 w-3.5 fill-current" /> Race Now
              </Link>
              <Link
                to="/quiz"
                className="font-display inline-flex h-[68px] w-full items-center justify-center gap-3 border-2 border-[#ffd633] bg-[#f5c518] px-5 text-center text-[18px] font-black uppercase tracking-[0.12em] text-[#1a1100] shadow-[0_0_34px_-8px_rgba(245,197,24,0.9)] transition hover:bg-[#ffd633]"
              >
                <Coins className="h-6 w-6" /> Play Quiz
              </Link>
            </div>
            <div className="grid w-full max-w-[520px] grid-cols-4 border border-[#303030] bg-[#111] text-center text-[10px] font-bold uppercase tracking-[0.08em] text-[#969696]">
              <LoopStep icon={<Brain className="h-3.5 w-3.5" />} label="Quiz" />
              <LoopStep icon={<Coins className="h-3.5 w-3.5" />} label="Coins" />
              <LoopStep icon={<Wrench className="h-3.5 w-3.5" />} label="Tune" />
              <LoopStep icon={<Trophy className="h-3.5 w-3.5" />} label="Win" />
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[620px]">
            <div className="animate-premium-glow relative border border-[#303030] bg-[#111] p-4 shadow-[0_0_44px_-24px_rgba(218,41,28,0.9)]">
              <div className="pointer-events-none absolute inset-x-8 bottom-12 h-16 bg-[#da291c]/20 blur-[42px]" />
              <div className="grid items-end gap-3 sm:grid-cols-[0.28fr_1fr]">
                <div className="relative z-10 border border-[#303030] bg-[#181818] p-2">
                  <DriverFigure driver={selectedDriver} size="tiny" />
                  <div className="mt-1 truncate text-center text-[10px] font-bold uppercase tracking-[0.1em] text-[#f5c518]">{selectedDriver.code}</div>
                  <div className="mt-0.5 truncate text-center text-[9px] font-bold uppercase tracking-[0.08em] text-white">{selectedDriver.name}</div>
                </div>
                <div className="relative z-10">
                  <CarFigure car={selectedCar} className="relative z-10 w-full animate-car-hero drop-shadow-[0_28px_42px_rgba(218,41,28,0.42)]" />
                  <div className="mt-1 grid gap-1 border border-[#303030] bg-[#111] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.1em]">
                    <div className="flex items-center justify-between gap-2 text-[#969696]">
                      <span className="truncate text-white">{selectedCar.name}</span>
                      <span className="shrink-0 text-[#f5c518]">{selectedCar.team}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[#969696]">
                      <span className="truncate">{selectedDriver.name}</span>
                      <span className="shrink-0 text-[#f5c518]">{selectedDriver.bonus}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-2 h-px bg-[repeating-linear-gradient(90deg,#303030_0_24px,transparent_24px_42px)] animate-road" />
          </div>

          <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
            <PremiumStat icon={<Coins className="h-4 w-4" />} label="Coins" value={<span className="animate-counter-bump tabular-nums">{state.coins ?? 0}</span>} />
            <PremiumStat icon={<Trophy className="h-4 w-4" />} label="Wins" value={state.wins ?? 0} />
            <PremiumStat icon={<CarFront className="h-4 w-4" />} label="Cars" value={(state.ownedCarIds ?? []).length} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
        <ProgressionPanel state={state} />
        <div className="border border-[#303030] bg-[#111] p-5">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#da291c]">Current Loadout</div>
          <div className="mt-3 flex items-center justify-between gap-4">
            <div>
              <div className="font-display text-2xl uppercase text-white">{selectedCar.name}</div>
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#969696]">{selectedDriver.name}</div>
            </div>
            <Link to="/garage" className="arcade-btn arcade-btn-ghost h-10 px-4">Tune</Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="arcade-card p-6">
          <div className="mb-5 flex items-end justify-between border-b border-[#303030] pb-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.11em] text-[#da291c]">Quick Upgrades</div>
              <h2 className="font-display mt-1 text-2xl text-white">Upgrade your racer</h2>
            </div>
            <Link to="/garage" className="arcade-btn arcade-btn-cyan h-10 px-4">Garage</Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {UPGRADES.map((u) => {
              const lvl = upgrades[u.key] ?? 0;
              const max = lvl >= MAX_LEVEL;
              const cost = max ? 0 : COSTS[lvl];
              const afford = (state.coins ?? 0) >= cost;
              return (
                <div key={u.key} className="relative overflow-hidden border border-[#303030] bg-[#1e1e1e] p-4 transition hover:border-[#da291c]/70">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="grid h-11 w-11 place-items-center border border-[#303030] bg-[#252525] text-[#f5c518]">{u.icon}</span>
                      <div>
                        <div className="text-sm font-bold uppercase tracking-[0.1em] text-white">{u.label}</div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#969696]">Level {lvl}/{MAX_LEVEL}</div>
                      </div>
                    </div>
                    {!max && <div className="text-xs font-bold text-[#f5c518]">{cost}</div>}
                  </div>
                  <div className="mt-4 h-3 overflow-hidden border border-[#303030] bg-[#111]">
                    <div className="h-full bg-[#da291c] shadow-[0_0_18px_rgba(218,41,28,0.8)] transition-[width] duration-300" style={{ width: `${(lvl / MAX_LEVEL) * 100}%` }} />
                  </div>
                  <button
                    type="button"
                    onClick={() => buyUpgrade(u.key)}
                    disabled={max || !afford}
                    className={`mt-4 flex h-11 w-full items-center justify-center gap-2 px-3 text-[12px] font-bold uppercase tracking-[0.1em] transition hover:shadow-[0_0_28px_-14px_rgba(245,197,24,0.9)] ${
                      max
                        ? "bg-[#252525] text-[#696969]"
                        : afford
                          ? "bg-[#da291c] text-white hover:bg-[#b01e0a]"
                          : "cursor-not-allowed border border-[#303030] bg-[#111] text-[#696969]"
                    }`}
                  >
                    {max ? "Maxed" : "Upgrade"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="arcade-card p-6">
          <div className="text-[11px] font-bold uppercase tracking-[0.11em] text-[#da291c]">Next Actions</div>
          <div className="mt-4 grid gap-3">
            <Link to="/quiz" className="arcade-btn arcade-btn-coin h-14 w-full">Earn Coins</Link>
            <Link to="/drivers" className="arcade-btn arcade-btn-ghost h-14 w-full">Choose Driver</Link>
            <Link to={`/race/${firstTrack.id}`} className="arcade-btn h-14 w-full">Start Race</Link>
          </div>
        </div>
      </section>
    </RacingShell>
  );
}

function LoopStep({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 border-r border-[#303030] px-2 py-3 last:border-r-0">
      <span className="text-[#f5c518]">{icon}</span>
      {label}
    </div>
  );
}
