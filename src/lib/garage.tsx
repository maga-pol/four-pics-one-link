import type { ReactNode } from "react";

export type UpgradeKey = "speed" | "acceleration" | "nitro" | "control";

export type GameState = {
  coins?: number;
  wins?: number;
  winStreak?: number;
  bestWinStreak?: number;
  unlockedTracks?: number;
  podiumTrackIds?: string[];
  upgrades?: Partial<Record<UpgradeKey, number>>;
  selectedDriverId?: string;
  unlockedDriverIds?: string[];
  selectedCarId?: string;
  ownedCarIds?: string[];
};

export type Driver = {
  id: string;
  name: string;
  code: string;
  team: string;
  color: string;
  accent: string;
};

export type RaceCar = {
  id: string;
  name: string;
  team: string;
  cost: number;
  speed: number;
  grip: number;
  colors: [string, string, string];
};

export const STORAGE = "wqr-state";
export const STARTER_CAR_ID = "red-bull-racing";
export const STARTER_DRIVER_ID = "academy-rookie";
export const DRIVER_UNLOCK_STEP = 3;

export const DRIVERS: Driver[] = [
  { id: STARTER_DRIVER_ID, name: "Academy Rookie", code: "YOU", team: "World Quiz Race", color: "#da291c", accent: "#f5c518" },
  { id: "verstappen", name: "Max Verstappen", code: "VER", team: "Red Bull Racing", color: "#1e41ff", accent: "#fcd116" },
  { id: "bottas", name: "Valtteri Bottas", code: "BOT", team: "Cadillac", color: "#0b1f3a", accent: "#d4af37" },
  { id: "bearman", name: "Oliver Bearman", code: "BEA", team: "Haas", color: "#b6babd", accent: "#111111" },
  { id: "norris", name: "Lando Norris", code: "NOR", team: "McLaren", color: "#ff8700", accent: "#47c7fc" },
  { id: "stroll", name: "Lance Stroll", code: "STR", team: "Aston Martin", color: "#006f62", accent: "#ffffff" },
  { id: "leclerc", name: "Charles Leclerc", code: "LEC", team: "Ferrari", color: "#dc0000", accent: "#fff200" },
  { id: "sainz", name: "Carlos Sainz", code: "SAI", team: "Williams", color: "#00a3e0", accent: "#ffffff" },
  { id: "perez", name: "Sergio Perez", code: "PER", team: "Cadillac", color: "#0b1f3a", accent: "#d4af37" },
  { id: "colapinto", name: "Franco Colapinto", code: "COL", team: "Alpine", color: "#0090ff", accent: "#ffffff" },
  { id: "hulkenberg", name: "Nico Hulkenberg", code: "HUL", team: "Audi", color: "#111111", accent: "#00ff5f" },
  { id: "russell", name: "George Russell", code: "RUS", team: "Mercedes", color: "#00a19c", accent: "#111111" },
  { id: "bortoleto", name: "Gabriel Bortoleto", code: "BOR", team: "Audi", color: "#111111", accent: "#00ff5f" },
  { id: "alonso", name: "Fernando Alonso", code: "ALO", team: "Aston Martin", color: "#006f62", accent: "#cedc00" },
  { id: "ocon", name: "Esteban Ocon", code: "OCO", team: "Haas", color: "#b6babd", accent: "#e10600" },
  { id: "albon", name: "Alex Albon", code: "ALB", team: "Williams", color: "#00a3e0", accent: "#0b1f3a" },
  { id: "gasly", name: "Pierre Gasly", code: "GAS", team: "Alpine", color: "#0090ff", accent: "#ff87bc" },
  { id: "lindblad", name: "Arvid Lindblad", code: "LIN", team: "Racing Bulls", color: "#1434cb", accent: "#e10600" },
  { id: "lawson", name: "Liam Lawson", code: "LAW", team: "Racing Bulls", color: "#1434cb", accent: "#ffffff" },
  { id: "piastri", name: "Oscar Piastri", code: "PIA", team: "McLaren", color: "#ff8700", accent: "#111111" },
  { id: "hadjar", name: "Isack Hadjar", code: "HAD", team: "Red Bull Racing", color: "#1e41ff", accent: "#fcd116" },
  { id: "hamilton", name: "Lewis Hamilton", code: "HAM", team: "Ferrari", color: "#dc0000", accent: "#111111" },
  { id: "antonelli", name: "Kimi Antonelli", code: "ANT", team: "Mercedes", color: "#00a19c", accent: "#111111" },
];

// Fixed reverse order from the 2026 Monaco GP result, so new real-world races do not reshuffle unlocks.
export const DRIVER_UNLOCK_ORDER = [
  "verstappen",
  "bottas",
  "bearman",
  "norris",
  "stroll",
  "leclerc",
  "sainz",
  "perez",
  "colapinto",
  "hulkenberg",
  "russell",
  "bortoleto",
  "alonso",
  "ocon",
  "albon",
  "gasly",
  "lindblad",
  "lawson",
  "piastri",
  "hadjar",
  "hamilton",
  "antonelli",
];

export const CARS: RaceCar[] = [
  { id: STARTER_CAR_ID, name: "RB Starter", team: "Red Bull Racing", cost: 0, speed: 72, grip: 68, colors: ["#1e41ff", "#101820", "#fcd116"] },
  { id: "ferrari-red", name: "Rosso Aero", team: "Ferrari", cost: 450, speed: 78, grip: 70, colors: ["#dc0000", "#111111", "#fff200"] },
  { id: "mclaren-papaya", name: "Papaya Sprint", team: "McLaren", cost: 650, speed: 80, grip: 72, colors: ["#ff8700", "#111111", "#47c7fc"] },
  { id: "mercedes-silver", name: "Silver Arrow", team: "Mercedes", cost: 850, speed: 82, grip: 76, colors: ["#00a19c", "#c0c0c0", "#111111"] },
  { id: "aston-green", name: "Emerald Vantage", team: "Aston Martin", cost: 1050, speed: 79, grip: 84, colors: ["#006f62", "#0b1f3a", "#cedc00"] },
  { id: "williams-blue", name: "Oxford Flash", team: "Williams", cost: 1250, speed: 86, grip: 78, colors: ["#00a3e0", "#0b1f3a", "#ffffff"] },
  { id: "cadillac-gold", name: "Goldline GP", team: "Cadillac", cost: 1500, speed: 88, grip: 82, colors: ["#0b1f3a", "#d4af37", "#ffffff"] },
  { id: "carbon-pro", name: "Carbon Prototype", team: "World Quiz Race", cost: 1900, speed: 92, grip: 90, colors: ["#111111", "#da291c", "#f5c518"] },
];

export function defaultState(): GameState {
  return {
    coins: 250,
    wins: 0,
    winStreak: 0,
    bestWinStreak: 0,
    unlockedTracks: 1,
    podiumTrackIds: [],
    upgrades: { speed: 1, acceleration: 1, nitro: 0, control: 0 },
    selectedDriverId: STARTER_DRIVER_ID,
    unlockedDriverIds: [STARTER_DRIVER_ID],
    selectedCarId: STARTER_CAR_ID,
    ownedCarIds: [STARTER_CAR_ID],
  };
}

export function normalizeState(raw: GameState): GameState {
  const base = defaultState();
  const owned = new Set([STARTER_CAR_ID, ...(raw.ownedCarIds ?? [])]);
  const unlockedDrivers = new Set([STARTER_DRIVER_ID, ...(raw.unlockedDriverIds ?? [])]);
  const selectedCarId = owned.has(raw.selectedCarId ?? "") ? raw.selectedCarId : STARTER_CAR_ID;
  const selectedDriverId = unlockedDrivers.has(raw.selectedDriverId ?? "") ? raw.selectedDriverId : STARTER_DRIVER_ID;

  return {
    ...base,
    ...raw,
    upgrades: { ...base.upgrades, ...raw.upgrades },
    podiumTrackIds: Array.from(new Set(raw.podiumTrackIds ?? [])),
    selectedDriverId,
    unlockedDriverIds: Array.from(unlockedDrivers),
    selectedCarId,
    ownedCarIds: Array.from(owned),
    bestWinStreak: Math.max(raw.bestWinStreak ?? 0, raw.winStreak ?? 0),
  };
}

export function readGameState(): GameState {
  if (typeof window === "undefined") return defaultState();
  try {
    return normalizeState(JSON.parse(localStorage.getItem(STORAGE) ?? "{}"));
  } catch {
    return defaultState();
  }
}

export function writeGameState(next: GameState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE, JSON.stringify(normalizeState(next)));
}

export function getUnlockedDriverIds(podiumTrackIds: string[] = []) {
  const unlockCount = Math.floor(new Set(podiumTrackIds).size / DRIVER_UNLOCK_STEP);
  return [STARTER_DRIVER_ID, ...DRIVER_UNLOCK_ORDER.slice(0, unlockCount)];
}

export function getSelectedDriver(state: GameState) {
  return DRIVERS.find((driver) => driver.id === state.selectedDriverId) ?? DRIVERS[0];
}

export function getSelectedCar(state: GameState) {
  return CARS.find((car) => car.id === state.selectedCarId) ?? CARS[0];
}

export function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-[#303030] bg-[#181818] px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#696969]">{label}</div>
      <div className="mt-1 font-display text-lg leading-none text-white">{value}</div>
    </div>
  );
}

export function DriverFigure({ driver, size }: { driver: Driver; size: "tiny" | "small" | "large" }) {
  const className =
    size === "large" ? "mx-auto h-40 w-32" :
    size === "small" ? "mx-auto h-20 w-16" :
    "h-24 w-20 shrink-0";

  return (
    <svg viewBox="0 0 120 150" className={className} aria-label={driver.name}>
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

export function CarFigure({ car, compact = false, className }: { car: RaceCar; compact?: boolean; className?: string }) {
  const [body, dark, accent] = car.colors;
  return (
    <svg viewBox="0 0 260 110" className={className ?? (compact ? "h-24 w-full" : "h-32 w-full")} aria-label={car.name}>
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

export function StatFrame({ children }: { children: ReactNode }) {
  return <div className="border border-[#303030] bg-[#181818]">{children}</div>;
}
