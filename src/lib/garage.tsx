import type { ReactNode } from "react";
import { getAccountStorageKey } from "@/lib/account-storage";

export type UpgradeKey = "speed" | "acceleration" | "nitro" | "control";
export type UpgradeMap = Partial<Record<UpgradeKey, number>>;

export type GameState = {
  coins?: number;
  wins?: number;
  totalRaces?: number;
  totalQuizzesCompleted?: number;
  coinQuizPackClaimed?: boolean;
  winStreak?: number;
  bestWinStreak?: number;
  raceWinDates?: string[];
  unlockedTracks?: number;
  ownedTrackIds?: string[];
  podiumTrackIds?: string[];
  upgrades?: UpgradeMap;
  carUpgrades?: Record<string, UpgradeMap>;
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
  bonus: string;
  cost: number;
  bonusKey: "speed" | "acceleration" | "nitro" | "control";
  bonusValue: number;
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
export const STARTER_TRACK_ID = "circuit";

export const DRIVERS: Driver[] = [
  {
    id: STARTER_DRIVER_ID,
    name: "Academy Rookie",
    code: "YOU",
    team: "World Quiz Race",
    color: "#da291c",
    accent: "#f5c518",
    bonus: "+2% Balance",
    cost: 1800,
    bonusKey: "control",
    bonusValue: 2,
  },
  {
    id: "verstappen",
    name: "Max Verstappen",
    code: "VER",
    team: "Red Bull Racing",
    color: "#1e41ff",
    accent: "#fcd116",
    bonus: "+5% Speed",
    cost: 28000,
    bonusKey: "speed",
    bonusValue: 5,
  },
  {
    id: "bottas",
    name: "Valtteri Bottas",
    code: "BOT",
    team: "Cadillac",
    color: "#0b1f3a",
    accent: "#d4af37",
    bonus: "+4% Control",
    cost: 14000,
    bonusKey: "control",
    bonusValue: 4,
  },
  {
    id: "bearman",
    name: "Oliver Bearman",
    code: "BEA",
    team: "Haas",
    color: "#b6babd",
    accent: "#111111",
    bonus: "+3% Acceleration",
    cost: 9000,
    bonusKey: "acceleration",
    bonusValue: 3,
  },
  {
    id: "norris",
    name: "Lando Norris",
    code: "NOR",
    team: "McLaren",
    color: "#ff8700",
    accent: "#47c7fc",
    bonus: "+5% Nitro",
    cost: 26000,
    bonusKey: "nitro",
    bonusValue: 5,
  },
  {
    id: "stroll",
    name: "Lance Stroll",
    code: "STR",
    team: "Aston Martin",
    color: "#006f62",
    accent: "#ffffff",
    bonus: "+3% Control",
    cost: 8500,
    bonusKey: "control",
    bonusValue: 3,
  },
  {
    id: "leclerc",
    name: "Charles Leclerc",
    code: "LEC",
    team: "Ferrari",
    color: "#dc0000",
    accent: "#fff200",
    bonus: "+3% Acceleration",
    cost: 23000,
    bonusKey: "acceleration",
    bonusValue: 3,
  },
  {
    id: "sainz",
    name: "Carlos Sainz",
    code: "SAI",
    team: "Williams",
    color: "#00a3e0",
    accent: "#ffffff",
    bonus: "+4% Control",
    cost: 13000,
    bonusKey: "control",
    bonusValue: 4,
  },
  {
    id: "perez",
    name: "Sergio Perez",
    code: "PER",
    team: "Cadillac",
    color: "#0b1f3a",
    accent: "#d4af37",
    bonus: "+4% Nitro",
    cost: 16000,
    bonusKey: "nitro",
    bonusValue: 4,
  },
  {
    id: "colapinto",
    name: "Franco Colapinto",
    code: "COL",
    team: "Alpine",
    color: "#0090ff",
    accent: "#ffffff",
    bonus: "+3% Speed",
    cost: 9000,
    bonusKey: "speed",
    bonusValue: 3,
  },
  {
    id: "hulkenberg",
    name: "Nico Hulkenberg",
    code: "HUL",
    team: "Audi",
    color: "#111111",
    accent: "#00ff5f",
    bonus: "+4% Control",
    cost: 15000,
    bonusKey: "control",
    bonusValue: 4,
  },
  {
    id: "russell",
    name: "George Russell",
    code: "RUS",
    team: "Mercedes",
    color: "#00a19c",
    accent: "#111111",
    bonus: "+4% Acceleration",
    cost: 24000,
    bonusKey: "acceleration",
    bonusValue: 4,
  },
  {
    id: "bortoleto",
    name: "Gabriel Bortoleto",
    code: "BOR",
    team: "Audi",
    color: "#111111",
    accent: "#00ff5f",
    bonus: "+3% Nitro",
    cost: 9500,
    bonusKey: "nitro",
    bonusValue: 3,
  },
  {
    id: "alonso",
    name: "Fernando Alonso",
    code: "ALO",
    team: "Aston Martin",
    color: "#006f62",
    accent: "#cedc00",
    bonus: "+5% Control",
    cost: 25000,
    bonusKey: "control",
    bonusValue: 5,
  },
  {
    id: "ocon",
    name: "Esteban Ocon",
    code: "OCO",
    team: "Haas",
    color: "#b6babd",
    accent: "#e10600",
    bonus: "+3% Speed",
    cost: 10000,
    bonusKey: "speed",
    bonusValue: 3,
  },
  {
    id: "albon",
    name: "Alex Albon",
    code: "ALB",
    team: "Williams",
    color: "#00a3e0",
    accent: "#0b1f3a",
    bonus: "+4% Speed",
    cost: 15500,
    bonusKey: "speed",
    bonusValue: 4,
  },
  {
    id: "gasly",
    name: "Pierre Gasly",
    code: "GAS",
    team: "Alpine",
    color: "#0090ff",
    accent: "#ff87bc",
    bonus: "+4% Nitro",
    cost: 14500,
    bonusKey: "nitro",
    bonusValue: 4,
  },
  {
    id: "lindblad",
    name: "Arvid Lindblad",
    code: "LIN",
    team: "Racing Bulls",
    color: "#1434cb",
    accent: "#e10600",
    bonus: "+3% Acceleration",
    cost: 8500,
    bonusKey: "acceleration",
    bonusValue: 3,
  },
  {
    id: "lawson",
    name: "Liam Lawson",
    code: "LAW",
    team: "Racing Bulls",
    color: "#1434cb",
    accent: "#ffffff",
    bonus: "+3% Control",
    cost: 9000,
    bonusKey: "control",
    bonusValue: 3,
  },
  {
    id: "piastri",
    name: "Oscar Piastri",
    code: "PIA",
    team: "McLaren",
    color: "#ff8700",
    accent: "#111111",
    bonus: "+4% Nitro",
    cost: 27000,
    bonusKey: "nitro",
    bonusValue: 4,
  },
  {
    id: "hadjar",
    name: "Isack Hadjar",
    code: "HAD",
    team: "Red Bull Racing",
    color: "#1e41ff",
    accent: "#fcd116",
    bonus: "+4% Speed",
    cost: 18000,
    bonusKey: "speed",
    bonusValue: 4,
  },
  {
    id: "hamilton",
    name: "Lewis Hamilton",
    code: "HAM",
    team: "Ferrari",
    color: "#dc0000",
    accent: "#111111",
    bonus: "+5% Control",
    cost: 30000,
    bonusKey: "control",
    bonusValue: 5,
  },
  {
    id: "antonelli",
    name: "Kimi Antonelli",
    code: "ANT",
    team: "Mercedes",
    color: "#00a19c",
    accent: "#111111",
    bonus: "+4% Acceleration",
    cost: 17500,
    bonusKey: "acceleration",
    bonusValue: 4,
  },
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
  {
    id: STARTER_CAR_ID,
    name: "RB Starter",
    team: "Red Bull Racing",
    cost: 2500,
    speed: 72,
    grip: 68,
    colors: ["#1e41ff", "#101820", "#fcd116"],
  },
  {
    id: "ferrari-red",
    name: "Rosso Aero",
    team: "Ferrari",
    cost: 8500,
    speed: 78,
    grip: 70,
    colors: ["#dc0000", "#111111", "#fff200"],
  },
  {
    id: "mclaren-papaya",
    name: "Papaya Sprint",
    team: "McLaren",
    cost: 12000,
    speed: 80,
    grip: 72,
    colors: ["#ff8700", "#111111", "#47c7fc"],
  },
  {
    id: "mercedes-silver",
    name: "Silver Arrow",
    team: "Mercedes",
    cost: 16000,
    speed: 82,
    grip: 76,
    colors: ["#00a19c", "#c0c0c0", "#111111"],
  },
  {
    id: "aston-green",
    name: "Emerald Vantage",
    team: "Aston Martin",
    cost: 19000,
    speed: 79,
    grip: 84,
    colors: ["#006f62", "#0b1f3a", "#cedc00"],
  },
  {
    id: "williams-blue",
    name: "Oxford Flash",
    team: "Williams",
    cost: 23000,
    speed: 86,
    grip: 78,
    colors: ["#00a3e0", "#0b1f3a", "#ffffff"],
  },
  {
    id: "cadillac-gold",
    name: "Goldline GP",
    team: "Cadillac",
    cost: 28000,
    speed: 88,
    grip: 82,
    colors: ["#0b1f3a", "#d4af37", "#ffffff"],
  },
  {
    id: "carbon-pro",
    name: "Carbon Prototype",
    team: "World Quiz Race",
    cost: 36000,
    speed: 92,
    grip: 90,
    colors: ["#111111", "#da291c", "#f5c518"],
  },
];

export function defaultState(): GameState {
  return {
    coins: 0,
    wins: 0,
    totalRaces: 0,
    totalQuizzesCompleted: 0,
    winStreak: 0,
    bestWinStreak: 0,
    raceWinDates: [],
    unlockedTracks: 0,
    ownedTrackIds: [],
    podiumTrackIds: [],
    upgrades: defaultUpgrades(),
    carUpgrades: {},
    selectedDriverId: undefined,
    unlockedDriverIds: [],
    selectedCarId: undefined,
    ownedCarIds: [],
  };
}

export function defaultUpgrades(): Record<UpgradeKey, number> {
  return { speed: 0, acceleration: 0, nitro: 0, control: 0 };
}

export function getRankInfo(state: GameState) {
  const score =
    (state.wins ?? 0) * 80 + (state.totalRaces ?? 0) * 16 + (state.totalQuizzesCompleted ?? 0) * 8;
  const ranks = [
    { name: "Academy Rookie", min: 0 },
    { name: "Amateur", min: 180 },
    { name: "Pro", min: 520 },
    { name: "Champion", min: 1100 },
  ];
  const currentIndex = ranks.reduce((best, rank, index) => (score >= rank.min ? index : best), 0);
  const current = ranks[currentIndex];
  const next = ranks[currentIndex + 1] ?? null;
  const previousMin = current.min;
  const nextMin = next?.min ?? Math.max(previousMin + 1, score);
  const progress = next
    ? Math.min(100, Math.round(((score - previousMin) / (nextMin - previousMin)) * 100))
    : 100;
  return {
    score,
    rank: current.name,
    progress,
    nextRank: next?.name ?? "Champion",
    ranks: ranks.map((rank) => rank.name),
  };
}

export function normalizeState(raw: GameState): GameState {
  const base = defaultState();
  const owned = new Set(raw.ownedCarIds ?? []);
  const unlockedDrivers = new Set(raw.unlockedDriverIds ?? []);
  const selectedCarId = owned.has(raw.selectedCarId ?? "")
    ? raw.selectedCarId
    : Array.from(owned)[0];
  const selectedDriverId = unlockedDrivers.has(raw.selectedDriverId ?? "")
    ? raw.selectedDriverId
    : Array.from(unlockedDrivers)[0];
  const fallbackUpgrades = { ...defaultUpgrades(), ...raw.upgrades };
  const carUpgrades = Array.from(owned).reduce<Record<string, UpgradeMap>>((acc, carId) => {
    acc[carId] = {
      ...defaultUpgrades(),
      ...(raw.carUpgrades?.[carId] ?? fallbackUpgrades),
    };
    return acc;
  }, {});

  return {
    ...base,
    ...raw,
    upgrades: fallbackUpgrades,
    carUpgrades,
    podiumTrackIds: Array.from(new Set(raw.podiumTrackIds ?? [])),
    ownedTrackIds: Array.from(new Set(raw.ownedTrackIds ?? [])),
    raceWinDates: Array.from(new Set(raw.raceWinDates ?? []))
      .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
      .slice(-28),
    selectedDriverId,
    unlockedDriverIds: Array.from(unlockedDrivers),
    selectedCarId,
    ownedCarIds: Array.from(owned),
    bestWinStreak: Math.max(raw.bestWinStreak ?? 0, raw.winStreak ?? 0),
  };
}

export function getCarUpgrades(state: GameState, carId?: string): Record<UpgradeKey, number> {
  if (!carId) return defaultUpgrades();
  return {
    ...defaultUpgrades(),
    ...(state.carUpgrades?.[carId] ?? state.upgrades),
  };
}

export function readGameState(): GameState {
  if (typeof window === "undefined") return defaultState();
  try {
    return normalizeState(JSON.parse(localStorage.getItem(getAccountStorageKey(STORAGE)) ?? "{}"));
  } catch {
    return defaultState();
  }
}

export function writeGameState(next: GameState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(getAccountStorageKey(STORAGE), JSON.stringify(normalizeState(next)));
}

export { getAccountStorageKey } from "@/lib/account-storage";

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
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#696969]">
        {label}
      </div>
      <div className="mt-1 font-display text-lg leading-none text-white">{value}</div>
    </div>
  );
}

export function DriverFigure({
  driver,
  size,
}: {
  driver: Driver;
  size: "tiny" | "small" | "large";
}) {
  const className =
    size === "large"
      ? "mx-auto h-40 w-32"
      : size === "small"
        ? "mx-auto h-20 w-16"
        : "h-24 w-20 shrink-0";

  return (
    <svg viewBox="0 0 120 150" className={className} aria-label={driver.name}>
      <ellipse cx="60" cy="139" rx="34" ry="6" fill="rgba(0,0,0,0.35)" />
      <path d="M43 58 h34 l10 46 h-54 z" fill={driver.color} stroke="#ffffff" strokeWidth="2" />
      <path d="M43 58 h34 l6 18 h-46 z" fill={driver.accent} opacity="0.9" />
      <rect
        x="38"
        y="92"
        width="12"
        height="36"
        fill={driver.color}
        stroke="#ffffff"
        strokeWidth="2"
      />
      <rect
        x="70"
        y="92"
        width="12"
        height="36"
        fill={driver.color}
        stroke="#ffffff"
        strokeWidth="2"
      />
      <path d="M32 63 l-13 31" stroke={driver.color} strokeWidth="12" strokeLinecap="round" />
      <path d="M88 63 l13 31" stroke={driver.color} strokeWidth="12" strokeLinecap="round" />
      <circle cx="60" cy="35" r="27" fill={driver.color} stroke="#ffffff" strokeWidth="3" />
      <path d="M34 35 q26 -20 52 0 v9 q-26 12 -52 0 z" fill={driver.accent} />
      <rect x="43" y="38" width="34" height="12" rx="6" fill="#111111" opacity="0.9" />
      <text
        x="60"
        y="83"
        textAnchor="middle"
        fontSize="19"
        fontWeight="900"
        fill="#ffffff"
        fontFamily="Arial, sans-serif"
      >
        {driver.code}
      </text>
    </svg>
  );
}

export function CarFigure({
  car,
  compact = false,
  className,
}: {
  car: RaceCar;
  compact?: boolean;
  className?: string;
}) {
  const [body, dark, accent] = car.colors;
  return (
    <svg
      viewBox="0 0 260 110"
      className={className ?? (compact ? "h-24 w-full" : "h-32 w-full")}
      aria-label={car.name}
    >
      <ellipse cx="130" cy="94" rx="92" ry="8" fill="rgba(0,0,0,0.35)" />
      <path
        d="M21 61 l33 -17 h73 l32 -24 h42 l24 28 20 6 -9 19 h-40 l-18 -16 h-88 l-20 16 h-45 z"
        fill={body}
        stroke="#ffffff"
        strokeWidth="3"
      />
      <path d="M80 45 h70 l-19 16 h-78 z" fill={accent} />
      <path d="M148 30 h38 l14 17 h-73 z" fill={dark} stroke="#ffffff" strokeWidth="2" />
      <path d="M28 58 h50 l-31 15 h-30 z" fill={dark} />
      <path d="M184 48 h58 l-4 13 h-46 z" fill={accent} />
      <circle cx="72" cy="77" r="17" fill="#080808" stroke="#ffffff" strokeWidth="3" />
      <circle cx="72" cy="77" r="8" fill={accent} />
      <circle cx="190" cy="77" r="17" fill="#080808" stroke="#ffffff" strokeWidth="3" />
      <circle cx="190" cy="77" r="8" fill={accent} />
      <path d="M216 37 l29 -11 3 11 -25 14 z" fill={dark} stroke="#ffffff" strokeWidth="2" />
      <text
        x="130"
        y="76"
        textAnchor="middle"
        fontSize="16"
        fontWeight="900"
        fill="#ffffff"
        fontFamily="Arial, sans-serif"
      >
        {car.speed}
      </text>
    </svg>
  );
}

export function StatFrame({ children }: { children: ReactNode }) {
  return <div className="border border-[#303030] bg-[#181818]">{children}</div>;
}
