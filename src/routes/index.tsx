import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Brain, CarFront, Coins, LogOut, Play, Trophy, UserCircle, Wrench } from "lucide-react";
import { TRACKS } from "@/lib/tracks";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  CARS,
  DRIVERS,
  CarFigure,
  DriverFigure,
  STARTER_CAR_ID,
  STARTER_DRIVER_ID,
  defaultState as defaultGarageState,
  readGameState,
  writeGameState,
  type GameState,
  type UpgradeKey,
} from "@/lib/garage";
import { PremiumStat, ProgressionPanel, RacingShell } from "@/lib/racing-ui";

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

const UPGRADES: {
  key: UpgradeKey;
  label: string;
}[] = [
  { key: "speed", label: "Speed" },
  { key: "acceleration", label: "Acceleration" },
  { key: "nitro", label: "Nitro" },
  { key: "control", label: "Control" },
];

function defaultState(): GameState {
  return defaultGarageState();
}

function HomeHUD() {
  const [state, setState] = useState<GameState>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setState(readGameState());
    setHydrated(true);
  }, []);
  useEffect(() => {
    function onFocus() {
      setState(readGameState());
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    writeGameState(state);
  }, [state, hydrated]);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      window.setTimeout(() => setState(readGameState()), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const tracks = TRACKS;
  const firstTrack = tracks[0];
  const upgrades = state.upgrades ?? defaultState().upgrades!;
  const hasOwnedCar = (state.ownedCarIds ?? []).length > 0;
  const hasOwnedDriver = (state.unlockedDriverIds ?? []).length > 0;
  const hasOwnedTrack = (state.ownedTrackIds ?? []).includes(firstTrack.id);
  const ownedCars = new Set(state.ownedCarIds ?? []);
  const ownedDrivers = new Set(state.unlockedDriverIds ?? []);
  const selectedCar = CARS.find((car) => ownedCars.has(car.id) && car.id === state.selectedCarId);
  const selectedDriver = DRIVERS.find(
    (driver) => ownedDrivers.has(driver.id) && driver.id === state.selectedDriverId,
  );
  const starterCar = CARS.find((car) => car.id === STARTER_CAR_ID) ?? CARS[0];
  const starterDriver = state.unlockedDriverIds?.includes(STARTER_DRIVER_ID);
  const starterDriverPrice =
    DRIVERS.find((driver) => driver.id === STARTER_DRIVER_ID)?.cost ?? 1800;
  const missingStarterDriver = !hasOwnedDriver || !starterDriver;
  const nextUnlock = !hasOwnedCar
    ? { to: "/garage" as const, label: "Unlock Car", cost: starterCar.cost }
    : missingStarterDriver
      ? { to: "/drivers" as const, label: "Unlock Driver", cost: starterDriverPrice }
      : !hasOwnedTrack
        ? { to: "/tracks" as const, label: "Unlock Track", cost: firstTrack.cost }
        : null;
  const canUnlockNext = nextUnlock ? (state.coins ?? 0) >= nextUnlock.cost : true;

  return (
    <RacingShell>
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
              <span className="max-w-[180px] truncate normal-case tracking-normal">
                {user.email}
              </span>
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
          <Link to="/auth" className="arcade-btn arcade-btn-cyan h-10 px-4">
            Register / Log in
          </Link>
        )}
      </div>

      <section className="relative overflow-hidden border border-[#303030] bg-[#181818]">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 bg-[#da291c]/10 blur-[120px]" />
        <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[0.95fr_1.25fr_0.55fr] lg:items-center">
          <div className="flex flex-col items-center gap-5 text-center lg:items-start lg:text-left">
            <span className="font-display inline-flex items-center bg-[#da291c] px-3 py-1 text-[13px] uppercase tracking-[0.14em] text-white">
              Quiz - Coins - Upgrade - Race
            </span>
            <h1
              className="font-display text-white"
              style={{ fontSize: "clamp(2.4rem, 6vw, 64px)", lineHeight: 1 }}
            >
              WORLD QUIZ RACE
            </h1>
            <p className="max-w-[520px] text-sm font-bold uppercase tracking-[0.1em] text-[#969696]">
              Answer quizzes, earn coins, tune your car, then win races.
            </p>
            <div className="grid w-full max-w-[520px] grid-cols-1 gap-3 sm:grid-cols-2">
              {!nextUnlock ? (
                <Link
                  to={`/race/${firstTrack.id}`}
                  className={`play-btn font-display z-20 h-[68px] w-full ${hydrated && state.wins === 0 ? "animate-hint-pulse" : ""}`}
                  style={{ fontSize: 18, letterSpacing: "0.12em" }}
                >
                  <Play className="h-3.5 w-3.5 fill-current" /> Race Now
                </Link>
              ) : (
                <Link
                  to={canUnlockNext ? nextUnlock.to : "/quiz"}
                  className={`play-btn font-display z-20 h-[68px] w-full ${hydrated ? "animate-hint-pulse" : ""}`}
                  style={{ fontSize: 18, letterSpacing: "0.12em" }}
                >
                  <Play className="h-3.5 w-3.5 fill-current" />{" "}
                  {canUnlockNext ? nextUnlock.label : "Earn Coins"}
                </Link>
              )}
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
                  {selectedDriver ? (
                    <>
                      <DriverFigure driver={selectedDriver} size="tiny" />
                      <div className="mt-1 truncate text-center text-[10px] font-bold uppercase tracking-[0.1em] text-[#f5c518]">
                        {selectedDriver.code}
                      </div>
                      <div className="mt-0.5 truncate text-center text-[9px] font-bold uppercase tracking-[0.08em] text-white">
                        {selectedDriver.name}
                      </div>
                    </>
                  ) : (
                    <div className="grid min-h-[150px] place-items-center text-center">
                      <div>
                        <UserCircle className="mx-auto h-8 w-8 text-[#696969]" />
                        <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#969696]">
                          No driver
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="relative z-10">
                  {selectedCar ? (
                    <CarFigure
                      car={selectedCar}
                      className="relative z-10 w-full animate-car-hero drop-shadow-[0_28px_42px_rgba(218,41,28,0.42)]"
                    />
                  ) : (
                    <div className="grid min-h-[210px] place-items-center border border-dashed border-[#303030] bg-[#181818] text-center">
                      <div>
                        <CarFront className="mx-auto h-12 w-12 text-[#696969]" />
                        <div className="font-display mt-3 text-2xl uppercase text-white">
                          No car owned
                        </div>
                        <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#969696]">
                          Play quiz to buy one
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="mt-1 grid gap-1 border border-[#303030] bg-[#111] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.1em]">
                    <div className="flex items-center justify-between gap-2 text-[#969696]">
                      <span className="truncate text-white">{selectedCar?.name ?? "No car"}</span>
                      <span className="shrink-0 text-[#f5c518]">
                        {selectedCar?.team ?? "Locked"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[#969696]">
                      <span className="truncate">{selectedDriver?.name ?? "No driver"}</span>
                      <span className="shrink-0 text-[#f5c518]">
                        {selectedDriver?.bonus ?? "Locked"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-2 h-px bg-[repeating-linear-gradient(90deg,#303030_0_24px,transparent_24px_42px)] animate-road" />
          </div>

          <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
            <PremiumStat
              icon={<Coins className="h-4 w-4" />}
              label="Coins"
              value={<span className="animate-counter-bump tabular-nums">{state.coins ?? 0}</span>}
            />
            <PremiumStat
              icon={<Trophy className="h-4 w-4" />}
              label="Wins"
              value={state.wins ?? 0}
            />
            <PremiumStat
              icon={<CarFront className="h-4 w-4" />}
              label="Cars"
              value={(state.ownedCarIds ?? []).length}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <ProgressionPanel state={state} />
        <div className="border border-[#303030] bg-[#111] p-5">
          <div className="flex items-start justify-between gap-4 border-b border-[#303030] pb-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#da291c]">
                Current Loadout
              </div>
              <div className="font-display text-2xl uppercase text-white">
                {selectedCar?.name ?? "No car owned"}
              </div>
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#969696]">
                {selectedDriver?.name ?? "No driver owned"}
              </div>
            </div>
            <div className="border border-[#303030] bg-[#181818] px-3 py-2 text-right">
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#969696]">
                Team
              </div>
              <div className="text-sm font-black uppercase text-[#f5c518]">
                {selectedCar?.team ?? "Locked"}
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            {UPGRADES.map((u) => {
              const lvl = upgrades[u.key] ?? 0;
              return (
                <div key={u.key}>
                  <div className="mb-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.1em]">
                    <span className="text-[#969696]">{u.label}</span>
                    <span className="text-white">
                      {lvl}/{MAX_LEVEL}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden border border-[#303030] bg-[#181818]">
                    <div
                      className="h-full bg-[#da291c] shadow-[0_0_18px_rgba(218,41,28,0.8)] transition-[width] duration-300"
                      style={{ width: `${(lvl / MAX_LEVEL) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
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
