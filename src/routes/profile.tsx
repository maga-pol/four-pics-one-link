import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Check, Coins, Flag, Flame, Gauge, Lock, Save, ShoppingCart, Trophy, UserCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  CARS,
  DRIVER_UNLOCK_STEP,
  DRIVERS,
  DriverFigure,
  CarFigure,
  MiniStat,
  STARTER_CAR_ID,
  defaultState,
  getSelectedCar,
  getSelectedDriver,
  normalizeState,
  readGameState,
  writeGameState,
  type GameState,
  type RaceCar,
} from "@/lib/garage";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile - World Quiz Race" }] }),
  component: ProfilePage,
});

const BEST_KEY = "wqr-best-times";

function readBestCount() {
  if (typeof window === "undefined") return 0;
  try {
    return Object.keys(JSON.parse(localStorage.getItem(BEST_KEY) ?? "{}")).length;
  } catch {
    return 0;
  }
}

function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [game, setGame] = useState<GameState>(() => defaultState());
  const bestCount = useMemo(readBestCount, []);

  useEffect(() => {
    setGame(readGameState());
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      setUser(data.user);
      setName(data.user.user_metadata?.full_name ?? data.user.email?.split("@")[0] ?? "Racer");
    });
  }, [navigate]);

  async function saveProfile() {
    setSaving(true);
    setMessage(null);
    const { data, error } = await supabase.auth.updateUser({
      data: { full_name: name.trim() || "Racer" },
    });
    if (!error && data.user) {
      setUser(data.user);
      setMessage("Profile saved");
    } else {
      setMessage(error?.message ?? "Could not save profile");
    }
    setSaving(false);
  }

  function updateGarage(updater: (current: GameState) => GameState, success: string) {
    setGame((current) => {
      const next = normalizeState(updater(current));
      writeGameState(next);
      return next;
    });
    setMessage(success);
  }

  function selectDriver(driverId: string) {
    const unlocked = new Set(game.unlockedDriverIds ?? []);
    if (!unlocked.has(driverId)) {
      setMessage(`Unlock drivers by finishing ${DRIVER_UNLOCK_STEP} different tracks in P3 or better.`);
      return;
    }
    updateGarage((current) => ({ ...current, selectedDriverId: driverId }), "Driver selected");
  }

  function selectCar(carId: string) {
    const owned = new Set(game.ownedCarIds ?? [STARTER_CAR_ID]);
    if (!owned.has(carId)) return;
    updateGarage((current) => ({ ...current, selectedCarId: carId }), "Car equipped");
  }

  function buyCar(car: RaceCar) {
    const owned = new Set(game.ownedCarIds ?? [STARTER_CAR_ID]);
    if (owned.has(car.id)) {
      selectCar(car.id);
      return;
    }

    const coins = game.coins ?? 0;
    if (coins < car.cost) {
      setMessage("Not enough coins");
      return;
    }

    updateGarage((current) => ({
      ...current,
      coins: (current.coins ?? 0) - car.cost,
      ownedCarIds: Array.from(new Set([...(current.ownedCarIds ?? [STARTER_CAR_ID]), car.id])),
      selectedCarId: car.id,
    }), "Car purchased");
  }

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-foreground">
        <div className="text-sm font-bold uppercase tracking-[0.12em] text-[#969696]">Loading profile</div>
      </main>
    );
  }

  const upgrades = game.upgrades ?? {};
  const selectedDriver = getSelectedDriver(game);
  const selectedCar = getSelectedCar(game);
  const ownedCars = new Set(game.ownedCarIds ?? [STARTER_CAR_ID]);
  const unlockedDrivers = new Set(game.unlockedDriverIds ?? []);
  const podiumCount = new Set(game.podiumTrackIds ?? []).size;
  const nextUnlockProgress = podiumCount % DRIVER_UNLOCK_STEP;

  return (
    <main className="relative min-h-screen overflow-hidden bg-background p-4 text-foreground">
      <div className="pointer-events-none absolute inset-0 ps-grid-bg opacity-30" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col gap-4">
        <header className="flex items-center justify-between border-b border-[#303030] pb-4">
          <Link to="/" className="arcade-btn arcade-btn-ghost h-10 px-4">HUB</Link>
          <button
            type="button"
            onClick={() => supabase.auth.signOut().then(() => navigate({ to: "/" }))}
            className="arcade-btn arcade-btn-cyan h-10 px-4"
          >
            Sign out
          </button>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="border border-[#303030] bg-[#181818] p-6">
            <div className="flex items-center gap-4">
              {user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="" className="h-16 w-16 border border-[#303030]" />
              ) : (
                <div className="grid h-16 w-16 place-items-center bg-[#da291c]">
                  <UserCircle className="h-9 w-9 text-white" />
                </div>
              )}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#da291c]">Racer profile</div>
                <h1 className="font-display text-3xl text-white">{name || "Racer"}</h1>
                <p className="text-xs text-[#969696]">{user.email}</p>
              </div>
            </div>

            <label className="mt-6 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#969696]">
              Display name
            </label>
            <div className="mt-2 flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-w-0 flex-1 border border-[#303030] bg-[#111] px-3 py-3 text-sm font-bold text-white outline-none transition focus:border-[#da291c]"
              />
              <button type="button" onClick={saveProfile} disabled={saving} className="arcade-btn h-12 px-4">
                <Save className="h-4 w-4" /> Save
              </button>
            </div>
            {message && <p className="mt-3 text-xs font-bold text-[#f5c518]">{message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <ProfileStat icon={<Coins className="h-5 w-5" />} label="Coins" value={game.coins ?? 250} />
            <ProfileStat icon={<Trophy className="h-5 w-5" />} label="Wins" value={game.wins ?? 0} />
            <ProfileStat icon={<Flame className="h-5 w-5" />} label="Win streak" value={game.winStreak ?? 0} />
            <ProfileStat icon={<Trophy className="h-5 w-5" />} label="Best streak" value={game.bestWinStreak ?? 0} />
            <ProfileStat icon={<Flag className="h-5 w-5" />} label="Tracks" value={game.unlockedTracks ?? 1} />
            <ProfileStat icon={<Gauge className="h-5 w-5" />} label="Best times" value={bestCount} />
            <UpgradeStat label="Speed" value={upgrades.speed ?? 1} />
            <UpgradeStat label="Acceleration" value={upgrades.acceleration ?? 1} />
            <UpgradeStat label="Nitro" value={upgrades.nitro ?? 0} />
            <UpgradeStat label="Control" value={upgrades.control ?? 0} />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.3fr]">
          <div className="border border-[#303030] bg-[#181818] p-6">
            <div className="mb-5 flex items-end justify-between border-b border-[#303030] pb-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#da291c]">Pit lane</div>
                <h2 className="font-display mt-1 text-2xl text-white">Driver and car</h2>
              </div>
              <div className="inline-flex items-center gap-1.5 border border-[#5a4218] bg-[#2a1f08] px-3 py-1.5 text-sm font-bold text-[#c8a050]">
                <Coins className="h-4 w-4" /> <span className="tabular-nums">{game.coins ?? 0}</span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[0.8fr_1.2fr]">
              <div className="border border-[#303030] bg-[#111] p-4">
                <DriverFigure driver={selectedDriver} size="large" />
                <div className="mt-3 text-center">
                  <div className="font-display text-xl uppercase tracking-[0.06em] text-white">{selectedDriver.name}</div>
                  <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#969696]">{selectedDriver.team}</div>
                </div>
              </div>

              <div className="border border-[#303030] bg-[#111] p-4">
                <CarFigure car={selectedCar} />
                <div className="mt-4">
                  <div className="font-display text-xl uppercase tracking-[0.06em] text-white">{selectedCar.name}</div>
                  <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#969696]">{selectedCar.team}</div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <MiniStat label="Speed" value={selectedCar.speed} />
                  <MiniStat label="Grip" value={selectedCar.grip} />
                </div>
              </div>
            </div>
          </div>

          <div className="border border-[#303030] bg-[#181818] p-6">
            <div className="mb-5 flex items-end justify-between gap-3 border-b border-[#303030] pb-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#da291c]">Drivers</div>
                <h2 className="font-display mt-1 text-2xl text-white">Choose your F1 driver</h2>
              </div>
              <div className="text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#969696]">
                Unlock {nextUnlockProgress}/{DRIVER_UNLOCK_STEP}
              </div>
            </div>
            <div className="grid max-h-[520px] grid-cols-2 gap-2 overflow-y-auto pr-1 md:grid-cols-3 xl:grid-cols-4">
              {DRIVERS.map((driver) => {
                const active = driver.id === selectedDriver.id;
                const unlocked = unlockedDrivers.has(driver.id);
                return (
                  <button
                    key={driver.id}
                    type="button"
                    onClick={() => selectDriver(driver.id)}
                    className={`relative border p-3 text-left transition ${
                      active ? "border-[#da291c] bg-[#251514]" : "border-[#303030] bg-[#111] hover:border-[#404040]"
                    } ${unlocked ? "" : "opacity-60"}`}
                  >
                    {!unlocked && (
                      <div className="absolute right-2 top-2 grid h-6 w-6 place-items-center border border-[#303030] bg-[#181818]">
                        <Lock className="h-3.5 w-3.5 text-[#696969]" />
                      </div>
                    )}
                    <DriverFigure driver={driver} size="small" />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-bold uppercase tracking-[0.08em] text-white">{driver.name}</div>
                        <div className="truncate text-[10px] font-bold uppercase tracking-[0.1em] text-[#969696]">{driver.team}</div>
                      </div>
                      {active && <Check className="h-4 w-4 shrink-0 text-[#f5c518]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border border-[#303030] bg-[#181818] p-6">
          <div className="mb-5 flex items-end justify-between border-b border-[#303030] pb-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#da291c]">Garage shop</div>
              <h2 className="font-display mt-1 text-2xl text-white">Buy F1-style cars</h2>
            </div>
            <div className="text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#969696]">
              Starter car: Red Bull Racing
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {CARS.map((car) => {
              const owned = ownedCars.has(car.id);
              const active = car.id === selectedCar.id;
              const canBuy = (game.coins ?? 0) >= car.cost;
              return (
                <div
                  key={car.id}
                  className={`border bg-[#111] p-4 transition ${
                    active ? "border-[#da291c]" : "border-[#303030]"
                  }`}
                >
                  <CarFigure car={car} compact />
                  <div className="mt-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-display truncate text-lg uppercase tracking-[0.06em] text-white">{car.name}</div>
                      <div className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-[#969696]">{car.team}</div>
                    </div>
                    {owned ? <Check className="h-5 w-5 shrink-0 text-[#03904a]" /> : <Lock className="h-5 w-5 shrink-0 text-[#696969]" />}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <MiniStat label="Speed" value={car.speed} />
                    <MiniStat label="Grip" value={car.grip} />
                  </div>
                  <button
                    type="button"
                    onClick={() => owned ? selectCar(car.id) : buyCar(car)}
                    disabled={!owned && !canBuy}
                    className={`mt-4 flex h-11 w-full items-center justify-center gap-2 px-3 text-[12px] font-bold uppercase tracking-[0.1em] transition ${
                      active
                        ? "bg-[#252525] text-[#969696]"
                        : owned
                          ? "bg-[#da291c] text-white hover:bg-[#b01e0a]"
                          : canBuy
                            ? "bg-[#f5c518] text-[#1a1100] hover:bg-[#ffd633]"
                            : "cursor-not-allowed border border-[#303030] bg-[#1e1e1e] text-[#696969]"
                    }`}
                  >
                    {active ? "Equipped" : owned ? "Equip" : <><ShoppingCart className="h-4 w-4" /> {car.cost}</>}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

function ProfileStat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="border border-[#303030] bg-[#1e1e1e] p-4">
      <div className="flex items-center gap-2 text-[#f5c518]">
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-[0.12em]">{label}</span>
      </div>
      <div className="font-display mt-2 text-3xl text-white">{value}</div>
    </div>
  );
}

function UpgradeStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-[#303030] bg-[#111] p-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#969696]">{label}</div>
      <div className="mt-2 h-2 bg-[#303030]">
        <div className="h-full bg-[#da291c]" style={{ width: `${Math.min(100, (value / 5) * 100)}%` }} />
      </div>
      <div className="mt-2 text-xs font-bold text-white">Level {value}</div>
    </div>
  );
}
