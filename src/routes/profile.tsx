import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Coins, Flag, Gauge, Save, Trophy, UserCircle, Flame, Check, Lock, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile - World Quiz Race" }] }),
  component: ProfilePage,
});

type UpgradeKey = "speed" | "acceleration" | "nitro" | "control";
type GameState = {
  coins?: number;
  wins?: number;
  winStreak?: number;
  bestWinStreak?: number;
  unlockedTracks?: number;
  upgrades?: Partial<Record<UpgradeKey, number>>;
  selectedDriverId?: string;
  selectedCarId?: string;
  ownedCarIds?: string[];
};

const STORAGE = "wqr-state";
const BEST_KEY = "wqr-best-times";
const STARTER_CAR_ID = "red-bull-racing";
const STARTER_DRIVER_ID = "verstappen";

type Driver = {
  id: string;
  name: string;
  code: string;
  team: string;
  color: string;
  accent: string;
};

type RaceCar = {
  id: string;
  name: string;
  team: string;
  cost: number;
  speed: number;
  grip: number;
  colors: [string, string, string];
};

const DRIVERS: Driver[] = [
  { id: "verstappen", name: "Max Verstappen", code: "VER", team: "Red Bull Racing", color: "#1e41ff", accent: "#fcd116" },
  { id: "hadjar", name: "Isack Hadjar", code: "HAD", team: "Red Bull Racing", color: "#1e41ff", accent: "#fcd116" },
  { id: "leclerc", name: "Charles Leclerc", code: "LEC", team: "Ferrari", color: "#dc0000", accent: "#fff200" },
  { id: "hamilton", name: "Lewis Hamilton", code: "HAM", team: "Ferrari", color: "#dc0000", accent: "#111111" },
  { id: "norris", name: "Lando Norris", code: "NOR", team: "McLaren", color: "#ff8700", accent: "#47c7fc" },
  { id: "piastri", name: "Oscar Piastri", code: "PIA", team: "McLaren", color: "#ff8700", accent: "#111111" },
  { id: "russell", name: "George Russell", code: "RUS", team: "Mercedes", color: "#00a19c", accent: "#c0c0c0" },
  { id: "antonelli", name: "Kimi Antonelli", code: "ANT", team: "Mercedes", color: "#00a19c", accent: "#111111" },
  { id: "sainz", name: "Carlos Sainz", code: "SAI", team: "Williams", color: "#00a3e0", accent: "#ffffff" },
  { id: "albon", name: "Alex Albon", code: "ALB", team: "Williams", color: "#00a3e0", accent: "#0b1f3a" },
  { id: "alonso", name: "Fernando Alonso", code: "ALO", team: "Aston Martin", color: "#006f62", accent: "#cedc00" },
  { id: "stroll", name: "Lance Stroll", code: "STR", team: "Aston Martin", color: "#006f62", accent: "#ffffff" },
  { id: "ocon", name: "Esteban Ocon", code: "OCO", team: "Haas", color: "#b6babd", accent: "#e10600" },
  { id: "bearman", name: "Oliver Bearman", code: "BEA", team: "Haas", color: "#b6babd", accent: "#111111" },
  { id: "hulkenberg", name: "Nico Hulkenberg", code: "HUL", team: "Audi", color: "#111111", accent: "#00ff5f" },
  { id: "bortoleto", name: "Gabriel Bortoleto", code: "BOR", team: "Audi", color: "#111111", accent: "#00ff5f" },
  { id: "gasly", name: "Pierre Gasly", code: "GAS", team: "Alpine", color: "#0090ff", accent: "#ff87bc" },
  { id: "colapinto", name: "Franco Colapinto", code: "COL", team: "Alpine", color: "#0090ff", accent: "#ffffff" },
  { id: "lawson", name: "Liam Lawson", code: "LAW", team: "Racing Bulls", color: "#1434cb", accent: "#ffffff" },
  { id: "lindblad", name: "Arvid Lindblad", code: "LIN", team: "Racing Bulls", color: "#1434cb", accent: "#e10600" },
  { id: "perez", name: "Sergio Perez", code: "PER", team: "Cadillac", color: "#0b1f3a", accent: "#d4af37" },
  { id: "bottas", name: "Valtteri Bottas", code: "BOT", team: "Cadillac", color: "#0b1f3a", accent: "#d4af37" },
];

const CARS: RaceCar[] = [
  { id: STARTER_CAR_ID, name: "RB Starter", team: "Red Bull Racing", cost: 0, speed: 72, grip: 68, colors: ["#1e41ff", "#101820", "#fcd116"] },
  { id: "ferrari-red", name: "Rosso Aero", team: "Ferrari", cost: 450, speed: 78, grip: 70, colors: ["#dc0000", "#111111", "#fff200"] },
  { id: "mclaren-papaya", name: "Papaya Sprint", team: "McLaren", cost: 650, speed: 80, grip: 72, colors: ["#ff8700", "#111111", "#47c7fc"] },
  { id: "mercedes-silver", name: "Silver Arrow", team: "Mercedes", cost: 850, speed: 82, grip: 76, colors: ["#00a19c", "#c0c0c0", "#111111"] },
  { id: "aston-green", name: "Emerald Vantage", team: "Aston Martin", cost: 1050, speed: 79, grip: 84, colors: ["#006f62", "#0b1f3a", "#cedc00"] },
  { id: "williams-blue", name: "Oxford Flash", team: "Williams", cost: 1250, speed: 86, grip: 78, colors: ["#00a3e0", "#0b1f3a", "#ffffff"] },
  { id: "cadillac-gold", name: "Goldline GP", team: "Cadillac", cost: 1500, speed: 88, grip: 82, colors: ["#0b1f3a", "#d4af37", "#ffffff"] },
  { id: "carbon-pro", name: "Carbon Prototype", team: "World Quiz Race", cost: 1900, speed: 92, grip: 90, colors: ["#111111", "#da291c", "#f5c518"] },
];

function defaultState(): GameState {
  return {
    coins: 250,
    wins: 0,
    winStreak: 0,
    bestWinStreak: 0,
    unlockedTracks: 1,
    upgrades: { speed: 1, acceleration: 1, nitro: 0, control: 0 },
    selectedDriverId: STARTER_DRIVER_ID,
    selectedCarId: STARTER_CAR_ID,
    ownedCarIds: [STARTER_CAR_ID],
  };
}

function normalizeState(raw: GameState): GameState {
  const base = defaultState();
  const owned = new Set([STARTER_CAR_ID, ...(raw.ownedCarIds ?? [])]);
  const selectedCarId = owned.has(raw.selectedCarId ?? "") ? raw.selectedCarId : STARTER_CAR_ID;
  const selectedDriverId = DRIVERS.some((d) => d.id === raw.selectedDriverId)
    ? raw.selectedDriverId
    : STARTER_DRIVER_ID;
  return {
    ...base,
    ...raw,
    upgrades: { ...base.upgrades, ...raw.upgrades },
    selectedDriverId,
    selectedCarId,
    ownedCarIds: Array.from(owned),
    bestWinStreak: Math.max(raw.bestWinStreak ?? 0, raw.winStreak ?? 0),
  };
}

function readState(): GameState {
  if (typeof window === "undefined") return defaultState();
  try {
    return normalizeState(JSON.parse(localStorage.getItem(STORAGE) ?? "{}"));
  } catch {
    return defaultState();
  }
}

function writeState(next: GameState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE, JSON.stringify(normalizeState(next)));
}

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
    setGame(readState());
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
      writeState(next);
      return next;
    });
    setMessage(success);
  }

  function selectDriver(driverId: string) {
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
  const selectedDriver = DRIVERS.find((d) => d.id === game.selectedDriverId) ?? DRIVERS[0];
  const selectedCar = CARS.find((c) => c.id === game.selectedCarId) ?? CARS[0];
  const ownedCars = new Set(game.ownedCarIds ?? [STARTER_CAR_ID]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-background p-4 text-foreground">
      <div className="pointer-events-none absolute inset-0 ps-grid-bg opacity-30" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-4xl flex-col gap-4">
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

          <div className="grid grid-cols-2 gap-3">
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
            <div className="mb-5 border-b border-[#303030] pb-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#da291c]">Drivers</div>
              <h2 className="font-display mt-1 text-2xl text-white">Choose your F1 driver</h2>
            </div>
            <div className="grid max-h-[520px] grid-cols-2 gap-2 overflow-y-auto pr-1 md:grid-cols-3 xl:grid-cols-4">
              {DRIVERS.map((driver) => {
                const active = driver.id === selectedDriver.id;
                return (
                  <button
                    key={driver.id}
                    type="button"
                    onClick={() => selectDriver(driver.id)}
                    className={`border p-3 text-left transition ${
                      active ? "border-[#da291c] bg-[#251514]" : "border-[#303030] bg-[#111] hover:border-[#404040]"
                    }`}
                  >
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

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-[#303030] bg-[#181818] px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#696969]">{label}</div>
      <div className="mt-1 font-display text-lg leading-none text-white">{value}</div>
    </div>
  );
}

function DriverFigure({ driver, size }: { driver: Driver; size: "small" | "large" }) {
  const large = size === "large";
  return (
    <svg viewBox="0 0 120 150" className={large ? "mx-auto h-40 w-32" : "mx-auto h-20 w-16"} aria-label={driver.name}>
      <ellipse cx="60" cy="139" rx="34" ry="6" fill="rgba(0,0,0,0.35)" />
      <path d="M43 58 h34 l10 46 h-54 z" fill={driver.color} stroke="#ffffff" strokeWidth="2" />
      <path d="M43 58 h34 l6 18 h-46 z" fill={driver.accent} opacity="0.9" />
      <rect x="38" y="92" width="12" height="36" fill={driver.color} stroke="#ffffff" strokeWidth="2" />
      <rect x="70" y="92" width="12" height="36" fill={driver.color} stroke="#ffffff" strokeWidth="2" />
      <path d="M32 63 l-13 31" stroke={driver.color} strokeWidth="12" strokeLinecap="round" />
      <path d="M88 63 l13 31" stroke={driver.color} strokeWidth="12" strokeLinecap="round" />
      <circle cx="60" cy="35" r="27" fill={driver.color} stroke="#ffffff" strokeWidth="3" />
      <path d="M34 35 q26 -20 52 0 v9 q-26 12 -52 0 z" fill={driver.accent} />
      <rect x="43" y="38" width="34" height="12" rx="6" fill="#111111" opacity="0.9" />
      <text x="60" y="83" textAnchor="middle" fontSize="19" fontWeight="900" fill="#ffffff" fontFamily="Arial, sans-serif">{driver.code}</text>
    </svg>
  );
}

function CarFigure({ car, compact = false }: { car: RaceCar; compact?: boolean }) {
  const [body, dark, accent] = car.colors;
  return (
    <svg viewBox="0 0 260 110" className={compact ? "h-24 w-full" : "h-32 w-full"} aria-label={car.name}>
      <ellipse cx="130" cy="94" rx="92" ry="8" fill="rgba(0,0,0,0.35)" />
      <path d="M21 61 l33 -17 h73 l32 -24 h42 l24 28 20 6 -9 19 h-40 l-18 -16 h-88 l-20 16 h-45 z" fill={body} stroke="#ffffff" strokeWidth="3" />
      <path d="M80 45 h70 l-19 16 h-78 z" fill={accent} />
      <path d="M148 30 h38 l14 17 h-73 z" fill={dark} stroke="#ffffff" strokeWidth="2" />
      <path d="M28 58 h50 l-31 15 h-30 z" fill={dark} />
      <path d="M184 48 h58 l-4 13 h-46 z" fill={accent} />
      <circle cx="72" cy="77" r="17" fill="#080808" stroke="#ffffff" strokeWidth="3" />
      <circle cx="72" cy="77" r="8" fill={accent} />
      <circle cx="190" cy="77" r="17" fill="#080808" stroke="#ffffff" strokeWidth="3" />
      <circle cx="190" cy="77" r="8" fill={accent} />
      <path d="M216 37 l29 -11 3 11 -25 14 z" fill={dark} stroke="#ffffff" strokeWidth="2" />
      <text x="130" y="76" textAnchor="middle" fontSize="16" fontWeight="900" fill="#ffffff" fontFamily="Arial, sans-serif">{car.speed}</text>
    </svg>
  );
}
