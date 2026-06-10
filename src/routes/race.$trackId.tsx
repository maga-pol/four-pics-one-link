import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Flag,
  Gauge,
  HeartPulse,
  Lock,
  Trophy,
  Zap,
  Volume2,
  VolumeX,
} from "lucide-react";
import { getTrack } from "@/lib/tracks";
import { getBotRacePlan } from "@/lib/api/bot-ai.functions";
import {
  startEngine,
  stopEngine,
  setEngine,
  playBeep,
  playNitroSwoosh,
  playCrash,
  playFanfare,
  playCountdownBeep,
  playDriftScreech,
  setMuted,
  isMuted,
} from "@/lib/audio";
import {
  CARS,
  DRIVERS,
  getAccountStorageKey,
  getCarUpgrades,
  getSelectedCar,
  getSelectedDriver,
  normalizeState,
  readGameState,
  writeGameState,
  type Driver,
  type RaceCar,
} from "@/lib/garage";

export const Route = createFileRoute("/race/$trackId")({
  head: () => ({ meta: [{ title: "Race · World Quiz Race" }] }),
  component: RaceScreen,
});

const STORAGE = "wqr-state";
const BEST_KEY = "wqr-best-times";
const HINT_KEY = "wqr-controls-hint-seen";

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addCoins(delta: number) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(getAccountStorageKey(STORAGE));
    const obj = raw ? JSON.parse(raw) : {};
    obj.coins = (obj.coins ?? 0) + delta;
    localStorage.setItem(getAccountStorageKey(STORAGE), JSON.stringify(obj));
  } catch {}
}
function recordRaceFinish(rank: number, trackId: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(getAccountStorageKey(STORAGE));
    const obj = normalizeState(raw ? JSON.parse(raw) : {});
    if (rank === 1) {
      const nextStreak = (obj.winStreak ?? 0) + 1;
      obj.wins = (obj.wins ?? 0) + 1;
      obj.winStreak = nextStreak;
      obj.bestWinStreak = Math.max(obj.bestWinStreak ?? 0, nextStreak);
      obj.raceWinDates = Array.from(new Set([...(obj.raceWinDates ?? []), localDateKey()])).slice(
        -28,
      );
    } else {
      obj.winStreak = 0;
      obj.bestWinStreak = Math.max(obj.bestWinStreak ?? 0, 0);
    }
    obj.totalRaces = (obj.totalRaces ?? 0) + 1;
    if (rank <= 3) {
      obj.podiumTrackIds = Array.from(new Set([...(obj.podiumTrackIds ?? []), trackId]));
    }
    writeGameState(obj);
  } catch {}
}
function readUpgrades() {
  if (typeof window === "undefined") return { speed: 0, acceleration: 0, nitro: 0, control: 0 };
  try {
    const state = readGameState();
    return getCarUpgrades(state, state.selectedCarId);
  } catch {
    return { speed: 0, acceleration: 0, nitro: 0, control: 0 };
  }
}
function readBestTime(trackId: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getAccountStorageKey(BEST_KEY));
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return typeof obj?.[trackId] === "number" ? obj[trackId] : null;
  } catch {
    return null;
  }
}
function writeBestTime(trackId: string, t: number) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(getAccountStorageKey(BEST_KEY));
    const obj = raw ? JSON.parse(raw) : {};
    obj[trackId] = t;
    localStorage.setItem(getAccountStorageKey(BEST_KEY), JSON.stringify(obj));
  } catch {}
}

function RaceScreen() {
  const { trackId } = useParams({ from: "/race/$trackId" });
  const track = getTrack(trackId);
  const [raceAccess, setRaceAccess] = useState({
    car: false,
    driver: false,
    track: false,
  });

  useEffect(() => {
    const state = readGameState();
    const selectedCarOwned = Boolean(
      state.selectedCarId && (state.ownedCarIds ?? []).includes(state.selectedCarId),
    );
    const selectedDriverOwned = Boolean(
      state.selectedDriverId && (state.unlockedDriverIds ?? []).includes(state.selectedDriverId),
    );
    setRaceAccess({
      car: selectedCarOwned,
      driver: selectedDriverOwned,
      track: (state.ownedTrackIds ?? []).includes(trackId),
    });
  }, [trackId]);

  if (!track) {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
        <div className="rounded-2xl border border-border bg-card/60 p-6 text-center backdrop-blur-md">
          <p className="font-bold">Track not found</p>
          <Link to="/" className="mt-3 inline-block text-primary underline">
            ← Back to HUB
          </Link>
        </div>
      </main>
    );
  }

  if (!raceAccess.car || !raceAccess.driver || !raceAccess.track) {
    const missing = !raceAccess.car
      ? "selected car"
      : !raceAccess.driver
        ? "selected driver"
        : "this track";
    const target = !raceAccess.car ? "/garage" : !raceAccess.driver ? "/drivers" : "/tracks";
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
        <div className="max-w-md border border-[#303030] bg-[#181818] p-6 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center border border-[#f5c518] bg-[#2a1f08] text-[#f5c518]">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="font-display mt-4 text-3xl uppercase text-white">Race Locked</h1>
          <p className="mt-2 text-sm font-bold uppercase tracking-[0.08em] text-[#969696]">
            Earn coins in quiz mode, then buy your {missing}. Every car, driver, and track must be
            purchased first.
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Link to="/quiz" className="arcade-btn h-12 px-4">
              Play Quiz
            </Link>
            <Link to={target} className="arcade-btn arcade-btn-ghost h-12 px-4">
              Unlock
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute -left-40 top-0 h-[28rem] w-[28rem] rounded-full bg-primary/15 blur-[140px]" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-[32rem] w-[32rem] rounded-full bg-secondary/15 blur-[160px]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1200px] flex-col gap-3 p-3 sm:p-4">
        <header className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/50 px-4 py-2.5 backdrop-blur-md">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-2.5 py-1 text-xs font-bold transition hover:border-primary/60"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> HUB
          </Link>
          <div className="flex items-center gap-2 text-sm font-black">
            <span className="text-xl">{track.flag}</span>
            <span className="text-gradient-title">{track.name}</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <Flag className="h-3.5 w-3.5 text-neon" /> {track.laps} laps
          </div>
        </header>

        <CircuitRace laps={track.laps} trackId={track.id} />
      </div>
    </main>
  );
}

// ============== Top-down circuit racer ==============
type Car = {
  id: string;
  name: string;
  color: string;
  colors: [string, string, string];
  driverName: string;
  driverCode: string;
  carName: string;
  teamName: string;
  isPlayer: boolean;
  t: number;
  lap: number;
  speed: number;
  lane: number;
  x: number;
  y: number;
  angle: number;
  finishedAt?: number;
  // per-car balance
  topT?: number; // max track-progress per second for this car
  boostUntil?: number; // ms timestamp until +20% boost from pad
  baseTopT?: number;
  targetLane?: number;
  laneVel?: number;
  aiAggro?: number;
  aiSkill?: number;
  aiDriftBias?: number;
  aiDecisionAt?: number;
  aiDriftUntil?: number;
  aiNitroUntil?: number;
  lastTrailX?: number;
  lastTrailY?: number;
};

type RaceStanding = {
  rank: number;
  driverName: string;
  driverCode: string;
  carName: string;
  teamName: string;
  isPlayer: boolean;
  colors: [string, string, string];
};

type RaceResult = {
  rank: number;
  reward: number;
  time: number;
  best: number | null;
  isNewBest: boolean;
  standings: RaceStanding[];
  failed?: boolean;
};

const WORLD_W = 8800;
const WORLD_H = 5200;
const TRACK_CX = WORLD_W / 2;
const TRACK_CY = WORLD_H / 2;
const TRACK_RX = 3280;
const TRACK_RY = 1840;
const ROAD_W = 320; // 6 clear lanes with consistent arcade-racer width
const LANE_COUNT = 6;
const LANE_W = ROAD_W / LANE_COUNT;
const SPEED_KMH_FACTOR = 940; // default top speed lands around 310 km/h
const TRACK_BARRIER_LIMIT = ROAD_W / 2 - 18;
const TRACK_POINTS = [
  { x: 1500, y: 4180 },
  { x: 3300, y: 4210 },
  { x: 5200, y: 4050 },
  { x: 6860, y: 3580 },
  { x: 7420, y: 2860 },
  { x: 6940, y: 2220 },
  { x: 5700, y: 2130 },
  { x: 6400, y: 1480 },
  { x: 5160, y: 1030 },
  { x: 3650, y: 1180 },
  { x: 2600, y: 1650 },
  { x: 1980, y: 2380 },
  { x: 1510, y: 3040 },
  { x: 1920, y: 3560 },
  { x: 2960, y: 3650 },
  { x: 4040, y: 3380 },
  { x: 5180, y: 3180 },
  { x: 5740, y: 2790 },
  { x: 5140, y: 2420 },
  { x: 3920, y: 2460 },
  { x: 2860, y: 2750 },
  { x: 2180, y: 3360 },
  { x: 1500, y: 4180 },
];

const TURN_GUIDES = [
  { t: 0.18, dir: 1, sharp: 0.55 },
  { t: 0.3, dir: -1, sharp: 0.82 },
  { t: 0.42, dir: -1, sharp: 0.9 },
  { t: 0.56, dir: 1, sharp: 0.62 },
  { t: 0.68, dir: 1, sharp: 0.78 },
  { t: 0.82, dir: -1, sharp: 0.72 },
  { t: 0.92, dir: 1, sharp: 0.58 },
];

const GRADE_SEPARATIONS = [
  {
    upperRampInStart: 0.941,
    upperStart: 0.953,
    upperEnd: 0.979,
    upperRampOutEnd: 0.991,
    lowerStart: 0.579,
    lowerEnd: 0.607,
    crossingT: 0.966,
  },
];

const DUBAI_TRACK_POINTS = [
  { x: 980, y: 4100 },
  { x: 3100, y: 4100 },
  { x: 5400, y: 4020 },
  { x: 7600, y: 3680 },
  { x: 8180, y: 2980 },
  { x: 7820, y: 2260 },
  { x: 6640, y: 1780 },
  { x: 5020, y: 1640 },
  { x: 3720, y: 1900 },
  { x: 3150, y: 2460 },
  { x: 3620, y: 3000 },
  { x: 4940, y: 2940 },
  { x: 6040, y: 2640 },
  { x: 6500, y: 3100 },
  { x: 6020, y: 3520 },
  { x: 4620, y: 3650 },
  { x: 3000, y: 3500 },
  { x: 1840, y: 3320 },
  { x: 1120, y: 3600 },
  { x: 980, y: 4100 },
];

const DUBAI_TURN_GUIDES = [
  { t: 0.18, dir: -1, sharp: 0.48 },
  { t: 0.31, dir: -1, sharp: 0.84 },
  { t: 0.45, dir: -1, sharp: 0.56 },
  { t: 0.55, dir: 1, sharp: 0.72 },
  { t: 0.66, dir: -1, sharp: 0.78 },
  { t: 0.78, dir: 1, sharp: 0.62 },
  { t: 0.9, dir: 1, sharp: 0.68 },
];

type RaceTheme = "sakura" | "dubai";
let activeTrackPoints = TRACK_POINTS;
let activeTurnGuides = TURN_GUIDES;
let activeGradeSeparations = GRADE_SEPARATIONS;
let activeTheme: RaceTheme = "sakura";

function applyRaceLayout(trackId: string) {
  if (trackId === "dubai-grand-circuit") {
    activeTrackPoints = DUBAI_TRACK_POINTS;
    activeTurnGuides = DUBAI_TURN_GUIDES;
    activeGradeSeparations = [];
    activeTheme = "dubai";
    return;
  }
  activeTrackPoints = TRACK_POINTS;
  activeTurnGuides = TURN_GUIDES;
  activeGradeSeparations = GRADE_SEPARATIONS;
  activeTheme = "sakura";
}

function pickBotLineup(playerDriver: Driver, playerCar: RaceCar) {
  const preferredDriverIds = [
    "leclerc",
    "norris",
    "piastri",
    "hamilton",
    "russell",
    "alonso",
    "sainz",
  ];
  const drivers = preferredDriverIds
    .map((id) => DRIVERS.find((driver) => driver.id === id))
    .filter((driver): driver is Driver => !!driver && driver.id !== playerDriver.id)
    .slice(0, 5);
  const fallbackDrivers = DRIVERS.filter(
    (driver) => driver.id !== playerDriver.id && !drivers.some((bot) => bot.id === driver.id),
  ).slice(0, 5 - drivers.length);
  const botDrivers = [...drivers, ...fallbackDrivers];
  const botCars = CARS.filter((car) => car.id !== playerCar.id);

  return botDrivers.map((driver, index) => {
    const teamCar = CARS.find((car) => car.team === driver.team);
    const fallbackCar = botCars[index % botCars.length] ?? CARS[index % CARS.length];
    const car = teamCar ?? {
      ...fallbackCar,
      id: `${driver.id}-team-car`,
      name: `${driver.team} GP`,
      team: driver.team,
      colors: [
        driver.color,
        driver.accent === "#111111" ? "#f3f4f6" : "#111111",
        driver.accent,
      ] as [string, string, string],
    };

    return { driver, car };
  });
}

function legacyOvalPoint(t: number) {
  // Cleaner oval/circuit with gentle sweeping bends — feels like a real arcade circuit.
  const a = (((t % 1) + 1) % 1) * Math.PI * 2;
  const rx = TRACK_RX + Math.sin(a * 2) * 160 + Math.cos(a * 3) * 60;
  const ry = TRACK_RY + Math.cos(a * 2) * 120 + Math.sin(a * 3) * 50;
  return { x: TRACK_CX + Math.cos(a) * rx, y: TRACK_CY + Math.sin(a) * ry };
}

function catmull(a: number, b: number, c: number, d: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
  );
}

function rawPoint(t: number) {
  const wrapped = ((t % 1) + 1) % 1;
  const points = activeTrackPoints;
  const count = points.length - 1;
  const scaled = wrapped * count;
  const i = Math.floor(scaled);
  const local = scaled - i;
  const p0 = points[(i - 1 + count) % count];
  const p1 = points[i % count];
  const p2 = points[(i + 1) % count];
  const p3 = points[(i + 2) % count];
  return {
    x: catmull(p0.x, p1.x, p2.x, p3.x, local),
    y: catmull(p0.y, p1.y, p2.y, p3.y, local),
  };
}

function pathPoint(t: number) {
  const eps = 0.0015;
  const p = rawPoint(t);
  const p2 = rawPoint(t + eps);
  let dx = p2.x - p.x;
  let dy = p2.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  return { x: p.x, y: p.y, hx: dx, hy: dy };
}

function CircuitRace({ laps, trackId }: { laps: number; trackId: string }) {
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s - m * 60;
    return `${m}:${sec.toFixed(2).padStart(5, "0")}`;
  };
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const forceStartRef = useRef<(() => void) | null>(null);
  const [hud, setHud] = useState({
    speed: 0,
    lap: 1,
    pos: 1,
    total: 6,
    nitro: 1,
    health: 100,
    elapsed: 0,
    lapProgress: 0,
    drifting: false,
  });
  const [count, setCount] = useState<string | null>(null);
  const [raceStarted, setRaceStarted] = useState(true);
  const [result, setResult] = useState<RaceResult | null>(null);
  const [muted, setMutedState] = useState<boolean>(() => isMuted());
  const [showHint, setShowHint] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem(getAccountStorageKey(HINT_KEY));
  });
  const [bestTime] = useState<number | null>(() => readBestTime(trackId));
  const [nextTurn, setNextTurn] = useState<{ dir: number; sharp: number }>({ dir: 0, sharp: 0 });
  const [warning, setWarning] = useState(false);
  const [spinning, setSpinning] = useState(false);

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  }
  function dismissHint() {
    setShowHint(false);
    try {
      localStorage.setItem(getAccountStorageKey(HINT_KEY), "1");
    } catch {}
    forceStartRef.current?.();
  }
  useEffect(() => {
    applyRaceLayout(trackId);
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const wrap = wrapRef.current!;

    function resize() {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const up = readUpgrades();
    const garage = readGameState();
    const playerDriver = getSelectedDriver(garage);
    const playerCar = getSelectedCar(garage);
    const botLineup = pickBotLineup(playerDriver, playerCar);
    const carSpeedBonus = (playerCar.speed - 72) * 0.003;
    const carGripBonus = (playerCar.grip - 68) * 0.01;
    const driverSpeedBonus = playerDriver.bonusKey === "speed" ? playerDriver.bonusValue / 100 : 0;
    const driverAccelBonus =
      playerDriver.bonusKey === "acceleration" ? playerDriver.bonusValue / 100 : 0;
    const driverNitroBonus = playerDriver.bonusKey === "nitro" ? playerDriver.bonusValue / 100 : 0;
    const driverControlBonus =
      playerDriver.bonusKey === "control" ? playerDriver.bonusValue / 100 : 0;
    // Upgrades give a real, noticeable boost on every stat
    const baseSpeed = (0.2 + up.speed * 0.035 + carSpeedBonus) * (1 + driverSpeedBonus);
    const accel = (0.18 + up.acceleration * 0.08) * (1 + driverAccelBonus);
    const grip = 0.55 + up.control * 0.15 + carGripBonus + driverControlBonus;
    const nitroCap = (1 + up.nitro * 0.5) * (1 + driverNitroBonus);
    const nitroBoost = 1.4 + up.nitro * 0.12; // (kept for compat — unused; +15km/h is fixed)

    const startP = pathPoint(0);
    const startAngle = Math.atan2(startP.hy, startP.hx);
    // ===== EQUAL START — all cars line up at the start line, spread across lanes =====
    // Player gets center lane; AI fills the other 5 of 6 grid slots, all at t=0.
    const gridLanes = [-0.75, -0.45, -0.15, 0.15, 0.45, 0.75];
    const playerLane = gridLanes[2]; // -0.15, just left of center
    const aiLanes = gridLanes.filter((_, i) => i !== 2);
    const startLatOff = (lane: number) => lane * (ROAD_W / 2 - 14);
    const playerOff = startLatOff(playerLane);
    // Bots have different pace profiles. Most are slower than a focused player,
    // and nitro/boost pads make clean overtakes possible.
    const AI_PACE = [0.92, 0.99, 1.06, 0.96, 1.1];
    const cars: Car[] = [
      {
        id: "p",
        name: playerDriver.code,
        color: playerCar.colors[0],
        colors: playerCar.colors,
        driverName: playerDriver.name,
        driverCode: playerDriver.code,
        carName: playerCar.name,
        teamName: playerCar.team,
        isPlayer: true,
        t: 0,
        lap: 0,
        speed: 0,
        lane: playerLane,
        x: startP.x + -startP.hy * playerOff,
        y: startP.y + startP.hx * playerOff,
        angle: startAngle,
      },
      ...botLineup.map(({ driver, car }, i) => {
        const lane = aiLanes[i] ?? 0;
        const off = startLatOff(lane);
        return {
          id: "ai" + i,
          name: driver.code,
          color: car.colors[0],
          colors: car.colors,
          driverName: driver.name,
          driverCode: driver.code,
          carName: car.name,
          teamName: car.team,
          isPlayer: false,
          t: 0,
          lap: 0,
          speed: 0,
          lane,
          x: startP.x + -startP.hy * off,
          y: startP.y + startP.hx * off,
          angle: startAngle,
          // Filled below from this bot's pace profile.
          topT: 0, // filled in below once AI_TOP_T is known
        } as Car;
      }),
    ];

    function projectToTrack(px: number, py: number, hintT: number) {
      // local search around hintT for performance
      let bestT = hintT;
      let bestD = Infinity;
      const SAMPLES = 40;
      const RANGE = 0.06;
      for (let i = 0; i <= SAMPLES; i++) {
        const tt = hintT + (i / SAMPLES - 0.5) * 2 * RANGE;
        const p = rawPoint(tt);
        const d = (p.x - px) * (p.x - px) + (p.y - py) * (p.y - py);
        if (d < bestD) {
          bestD = d;
          bestT = ((tt % 1) + 1) % 1;
        }
      }
      // fine refine
      for (let i = -8; i <= 8; i++) {
        const tt = bestT + (i / 8) * 0.005;
        const p = rawPoint(tt);
        const d = (p.x - px) * (p.x - px) + (p.y - py) * (p.y - py);
        if (d < bestD) {
          bestD = d;
          bestT = ((tt % 1) + 1) % 1;
        }
      }
      return { t: bestT, dist: Math.sqrt(bestD) };
    }

    // Approximate track perimeter so AI t-rate matches player's world speed
    let perimeter = 0;
    {
      let prev = rawPoint(0);
      for (let i = 1; i <= 600; i++) {
        const p = rawPoint(i / 600);
        perimeter += Math.hypot(p.x - prev.x, p.y - prev.y);
        prev = p;
      }
    }
    const PLAYER_TOP_WORLD = baseSpeed * 1.4 * 1200; // matches maxSpeed * moveScale
    const AI_TOP_T = PLAYER_TOP_WORLD / perimeter;
    for (let i = 1; i < cars.length; i++) {
      const baseTop = AI_TOP_T * (AI_PACE[i - 1] ?? 0.88);
      cars[i].topT = baseTop;
      cars[i].baseTopT = baseTop;
      cars[i].speed = baseTop * 0.58;
      cars[i].targetLane = cars[i].lane;
      cars[i].laneVel = 0;
      cars[i].aiAggro = 0.72 + ((i * 37) % 19) / 100;
      cars[i].aiSkill = 0.78 + ((i * 23) % 17) / 100;
      cars[i].aiDecisionAt = 0;
      cars[i].lastTrailX = cars[i].x;
      cars[i].lastTrailY = cars[i].y;
    }
    void getBotRacePlan({
      data: {
        trackId,
        trackName: getTrack(trackId)?.name ?? "Arcade Circuit",
        botIds: cars.slice(1).map((car) => car.driverCode),
      },
    })
      .then((plan) => {
        if (!running || plan.bots.length === 0) return;
        for (const botPlan of plan.bots) {
          const car = cars.find(
            (candidate) => !candidate.isPlayer && candidate.driverCode === botPlan.id,
          );
          if (!car || !car.baseTopT) continue;
          car.topT = car.baseTopT * botPlan.pace;
          car.aiAggro = botPlan.aggression;
          car.aiSkill = botPlan.skill;
          car.aiDriftBias = botPlan.driftBias;
          car.speed = Math.max(car.speed, car.topT * 0.46);
        }
      })
      .catch(() => {});

    // Japanese festival scenery placed off-road, deterministic and lightweight.
    type Decor = {
      x: number;
      y: number;
      kind:
        | "tree"
        | "palm"
        | "pole"
        | "sakura"
        | "pine"
        | "rock"
        | "flag"
        | "banner"
        | "billboard"
        | "lantern"
        | "torii"
        | "temple"
        | "house"
        | "hotel"
        | "grandstand"
        | "pit"
        | "spectator"
        | "drone"
        | "balloon"
        | "train"
        | "car";
      size: number;
      angle?: number;
      phase?: number;
    };
    const decor: Decor[] = [];
    {
      let seed = 1337;
      const rnd = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };
      // Sample road points once for distance test
      const roadSamples: { x: number; y: number }[] = [];
      for (let i = 0; i < 400; i++) {
        const p = rawPoint(i / 400);
        roadSamples.push({ x: p.x, y: p.y });
      }
      const minDist = ROAD_W * 0.9 + 30;
      const tryAdd = (x: number, y: number, kind: Decor["kind"], size: number) => {
        for (const r of roadSamples) {
          if ((r.x - x) ** 2 + (r.y - y) ** 2 < minDist * minDist) return;
        }
        decor.push({ x, y, kind, size });
      };
      // Outside the ring
      for (let i = 0; i < 700; i++) {
        const a = rnd() * Math.PI * 2;
        const r = TRACK_RX + ROAD_W + 60 + rnd() * 900;
        const x = TRACK_CX + Math.cos(a) * r;
        const y = TRACK_CY + Math.sin(a) * r * (TRACK_RY / TRACK_RX);
        if (x < 40 || x > WORLD_W - 40 || y < 40 || y > WORLD_H - 40) continue;
        const kind =
          activeTheme === "dubai"
            ? rnd() > 0.35
              ? "palm"
              : "rock"
            : rnd() > 0.25
              ? "tree"
              : "rock";
        tryAdd(x, y, kind, 18 + rnd() * 26);
      }
      // Inside the ring (infield)
      for (let i = 0; i < 300; i++) {
        const a = rnd() * Math.PI * 2;
        const r = rnd() * (TRACK_RX - ROAD_W - 100);
        const x = TRACK_CX + Math.cos(a) * r;
        const y = TRACK_CY + Math.sin(a) * r * (TRACK_RY / TRACK_RX);
        const kind =
          activeTheme === "dubai"
            ? rnd() > 0.45
              ? "palm"
              : "rock"
            : rnd() > 0.4
              ? "tree"
              : "rock";
        tryAdd(x, y, kind, 18 + rnd() * 26);
      }
      // Light poles every ~3% along both edges
      for (let i = 0; i < 64; i++) {
        const t = i / 64;
        const p = pathPoint(t);
        const side = i % 2 === 0 ? 1 : -1;
        const off = (ROAD_W / 2 + 36) * side;
        decor.push({
          x: p.x + -p.hy * off,
          y: p.y + p.hx * off,
          kind: "pole",
          size: 30,
          angle: Math.atan2(p.hy, p.hx),
        });
      }
      // Billboards on straights and corner exits
      for (let i = 0; i < 12; i++) {
        const t = (i + 0.5) / 12;
        const p = pathPoint(t);
        const side = i % 2 === 0 ? 1 : -1;
        const off = (ROAD_W / 2 + 90) * side;
        decor.push({
          x: p.x + -p.hy * off,
          y: p.y + p.hx * off,
          kind: "billboard",
          size: 70,
          angle: Math.atan2(p.hy, p.hx),
        });
      }
      // Festive flags between poles
      for (let i = 0; i < 96; i++) {
        if (i % 2 === 0) continue;
        const t = i / 96;
        const p = pathPoint(t);
        const side = i % 2 === 0 ? 1 : -1;
        const off = (ROAD_W / 2 + 22) * side;
        decor.push({ x: p.x + -p.hy * off, y: p.y + p.hx * off, kind: "flag", size: 18 });
      }
      const placeTrackside = (
        t: number,
        side: number,
        offset: number,
        kind: Decor["kind"],
        size: number,
      ) => {
        const p = pathPoint(t);
        const off = (ROAD_W / 2 + offset) * side;
        decor.push({
          x: p.x + -p.hy * off,
          y: p.y + p.hx * off,
          kind,
          size,
          angle: Math.atan2(p.hy, p.hx),
          phase: rnd() * Math.PI * 2,
        });
      };
      for (let i = 0; i < 150; i++) {
        const t = (i / 150 + rnd() * 0.004) % 1;
        placeTrackside(
          t,
          i % 2 === 0 ? 1 : -1,
          42 + rnd() * 34,
          activeTheme === "dubai" ? "palm" : i % 4 === 0 ? "pine" : "sakura",
          24 + rnd() * 22,
        );
      }
      for (let i = 0; i < 72; i++) {
        placeTrackside(
          (i + 0.35) / 72,
          i % 2 === 0 ? 1 : -1,
          22,
          i % 3 === 0 ? "banner" : "lantern",
          20 + rnd() * 8,
        );
      }
      if (activeTheme === "sakura") {
        for (const t of [0.035, 0.245, 0.515, 0.825]) {
          const p = pathPoint(t);
          decor.push({
            x: p.x,
            y: p.y,
            kind: "torii",
            size: 92,
            angle: Math.atan2(p.hy, p.hx),
            phase: rnd() * Math.PI * 2,
          });
        }
      }
      const landmarkItems =
        activeTheme === "dubai"
          ? [
              { x: 4380, y: 760, kind: "hotel" as const, size: 230 },
              { x: 6120, y: 780, kind: "hotel" as const, size: 190 },
              { x: 2500, y: 4370, kind: "grandstand" as const, size: 170 },
              { x: 4700, y: 4380, kind: "grandstand" as const, size: 190 },
              { x: 3570, y: 3820, kind: "pit" as const, size: 210 },
              { x: 7200, y: 980, kind: "billboard" as const, size: 135 },
              { x: 1120, y: 820, kind: "billboard" as const, size: 120 },
              { x: 1640, y: 4720, kind: "billboard" as const, size: 115 },
              { x: 5700, y: 4660, kind: "balloon" as const, size: 90 },
              { x: 6810, y: 980, kind: "drone" as const, size: 46 },
              { x: 8100, y: 2520, kind: "car" as const, size: 70 },
              { x: 7900, y: 2700, kind: "car" as const, size: 60 },
            ]
          : [
              { x: 1220, y: 1420, kind: "temple" as const, size: 150 },
              { x: 7340, y: 1540, kind: "temple" as const, size: 130 },
              { x: 7700, y: 4300, kind: "house" as const, size: 120 },
              { x: 1140, y: 3450, kind: "house" as const, size: 110 },
              { x: 4550, y: 690, kind: "train" as const, size: 170 },
              { x: 6200, y: 690, kind: "train" as const, size: 170 },
              { x: 7300, y: 760, kind: "billboard" as const, size: 110 },
              { x: 1120, y: 820, kind: "billboard" as const, size: 120 },
              { x: 1640, y: 4720, kind: "billboard" as const, size: 105 },
              { x: 5700, y: 4660, kind: "balloon" as const, size: 90 },
              { x: 6810, y: 980, kind: "drone" as const, size: 46 },
              { x: 2800, y: 860, kind: "drone" as const, size: 42 },
              { x: 8100, y: 2520, kind: "car" as const, size: 70 },
              { x: 7900, y: 2700, kind: "car" as const, size: 60 },
            ];
      for (const item of landmarkItems) {
        decor.push({ ...item, angle: 0, phase: rnd() * Math.PI * 2 });
      }
      for (let i = 0; i < 96; i++) {
        placeTrackside(
          (i / 96 + 0.01) % 1,
          i % 2 === 0 ? 1 : -1,
          76 + rnd() * 44,
          "spectator",
          16 + rnd() * 8,
        );
      }
      for (const cluster of [0.01, 0.18, 0.3, 0.42, 0.68, 0.82]) {
        for (let i = 0; i < 22; i++) {
          placeTrackside(
            (cluster + (i - 11) * 0.0018 + 1) % 1,
            i % 2 === 0 ? 1 : -1,
            88 + rnd() * 34,
            "spectator",
            18 + rnd() * 8,
          );
        }
      }
      for (const cluster of [0.946, 0.958, 0.974, 0.986]) {
        for (let i = 0; i < 18; i++) {
          placeTrackside(
            (cluster + (i - 9) * 0.0015 + 1) % 1,
            i % 2 === 0 ? 1 : -1,
            94 + rnd() * 42,
            "spectator",
            18 + rnd() * 9,
          );
        }
      }
    }

    // ===== Track features: 2 speed boost pads =====
    // One sits on the straight just before the 0.30 hairpin — risk/reward:
    // grab the boost and you must brake hard or spin out at the corner.
    type Feature = { t: number; lane: number; kind: "boost" | "ramp" };
    const features: Feature[] = [
      { t: 0.085, lane: -0.35, kind: "boost" },
      { t: 0.095, lane: 0.35, kind: "boost" },
      { t: 0.375, lane: -0.22, kind: "boost" },
      { t: 0.395, lane: 0.25, kind: "boost" },
      { t: 0.535, lane: 0.72, kind: "ramp" },
      { t: 0.705, lane: -0.62, kind: "boost" },
      { t: 0.885, lane: 0.0, kind: "ramp" },
    ];
    const featurePos = features.map((f) => {
      const p = pathPoint(f.t);
      const off = f.lane * (ROAD_W / 2 - 14);
      return { ...f, x: p.x + -p.hy * off, y: p.y + p.hx * off, angle: Math.atan2(p.hy, p.hx) };
    });
    let boostUntil = 0; // player boost-pad active until (ms)
    let airUntil = 0; // ms timestamp until ramp jump lands

    // ===== DANGER CORNERS — visual markers only; no speed-based spinout =====
    const DANGER_CORNERS: number[] = activeTurnGuides
      .filter((turn) => turn.sharp > 0.75)
      .map((turn) => turn.t);
    const SPIN_THRESHOLD = 999; // effectively disabled
    const CORNER_HIT_RADIUS = 0.012; // t-distance for "in the corner"
    const CORNER_WARN_AHEAD = 0.06; // start warning ~1-2s ahead
    const dangerPos = DANGER_CORNERS.map((t) => {
      const p = pathPoint(t);
      return { t, x: p.x, y: p.y, hx: p.hx, hy: p.hy };
    });
    const cornerHit = new Set<number>(); // indices currently "in" a corner
    let spinUntil = 0;
    let spinAngVel = 0;
    let lastWarnState = false;

    // ===== Particle system (sparks, nitro trail, dust) =====
    type Particle = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      max: number;
      size: number;
      color: string;
    };
    const particles: Particle[] = [];
    function spawnParticle(
      x: number,
      y: number,
      vx: number,
      vy: number,
      color: string,
      life = 0.5,
      size = 3,
    ) {
      if (particles.length > 220) particles.shift();
      particles.push({ x, y, vx, vy, life, max: life, size, color });
    }

    // Start immediately. A previous countdown freeze could leave cars stuck if the overlay failed.
    const COUNTDOWN_MS = 0;
    let countdownDone = true;

    // ===== NITRO — +20% top speed for 3s, 8s cooldown =====
    const NITRO_DURATION = 3000;
    const NITRO_COOLDOWN = 8000;
    let nitroActiveUntil = 0;
    let nitroReadyAt = 0;
    let nitro = 1; // HUD readiness (0..1)
    let last = performance.now();
    const countdownStartedAt = performance.now();
    let raceStartedAt = countdownStartedAt;
    let raf = 0;
    let running = true;
    let finished = false;
    let raceLaunched = true;

    function onKey(e: KeyboardEvent, down: boolean) {
      // Map both e.key (for arrow keys / shift / space) AND e.code (so Russian/other layouts still work for WASD)
      const k = e.key.toLowerCase();
      const codeMap: Record<string, string> = {
        KeyW: "w",
        KeyA: "a",
        KeyS: "s",
        KeyD: "d",
        ArrowUp: "arrowup",
        ArrowDown: "arrowdown",
        ArrowLeft: "arrowleft",
        ArrowRight: "arrowright",
        Space: " ",
        ShiftLeft: "shift",
        ShiftRight: "shift",
        KeyE: "e",
        ControlLeft: "control",
        ControlRight: "control",
      };
      const mapped = codeMap[e.code] ?? k;
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
          " ",
          "shift",
          "e",
          "control",
        ].includes(mapped)
      ) {
        e.preventDefault();
      }
      keysRef.current[mapped] = down;
      if (down) forceStartRef.current?.();
      // first key press also kicks off audio (autoplay policy)
      if (down) startEngine();
    }
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);

    // Auto-focus the canvas wrapper so keys work without click
    wrap.focus();

    // Tire trail buffer (world-space line segments, fade with time)
    type Trail = { x1: number; y1: number; x2: number; y2: number; born: number };
    const trails: Trail[] = [];
    let lastTrailX = cars[0].x;
    let lastTrailY = cars[0].y;
    let drifting = false;
    let lateralVelocity = 0;
    let driftBoostUntil = 0;
    let lastDriftSfx = 0;

    // Camera shake
    let shake = 0;
    let prevBoosting = false;
    let lastCountdownBeep = -1;
    let playerHealth = 100;
    let lastDamageAt = 0;
    const carHitCooldowns: Record<string, number> = {};

    function applyDamage(
      amount: number,
      hitX: number,
      hitY: number,
      color = "rgba(239,68,68,0.72)",
    ) {
      if (amount <= 0 || cars[0].finishedAt) return;
      const nowMs = performance.now();
      if (nowMs - lastDamageAt < 180) return;
      lastDamageAt = nowMs;
      playerHealth = Math.max(0, playerHealth - amount);
      shake = Math.max(shake, 5 + amount * 0.25);
      safeSound(playCrash);
      for (let i = 0; i < 8; i++) {
        spawnParticle(
          hitX,
          hitY,
          (Math.random() - 0.5) * 180,
          (Math.random() - 0.5) * 180,
          i % 2 ? color : "rgba(250,250,250,0.72)",
          0.35 + Math.random() * 0.2,
          2.5 + Math.random() * 2,
        );
      }
    }

    function getStandings(): RaceStanding[] {
      return [...cars]
        .sort((a, b) => {
          const aDone = a.finishedAt ?? Infinity;
          const bDone = b.finishedAt ?? Infinity;
          if (aDone !== bDone) return aDone - bDone;
          return b.lap + b.t - (a.lap + a.t);
        })
        .map((car, index) => ({
          rank: index + 1,
          driverName: car.driverName,
          driverCode: car.driverCode,
          carName: car.carName,
          teamName: car.teamName,
          isPlayer: car.isPlayer,
          colors: car.colors,
        }));
    }

    function forwardDelta(from: number, to: number) {
      return (to - from + 1) % 1;
    }

    function signedTrackDelta(from: number, to: number) {
      let d = to - from;
      while (d > 0.5) d -= 1;
      while (d < -0.5) d += 1;
      return d;
    }

    function laneOccupancyRisk(bot: Car, lane: number) {
      let risk = 0;
      for (const other of cars) {
        if (other === bot || other.finishedAt) continue;
        const sameLapBias = other.lap - bot.lap;
        const d = signedTrackDelta(bot.t, other.t) + sameLapBias;
        const laneGap = Math.abs((other.targetLane ?? other.lane) - lane);
        if (laneGap > 0.25) continue;
        if (d > -0.015 && d < 0.055) risk += 1 - Math.min(1, Math.abs(d) / 0.055);
      }
      return risk;
    }

    function upcomingTurn(t: number, lookAhead = 0.065) {
      let best = { dir: 0, sharp: 0, ahead: 1 };
      for (const turn of activeTurnGuides) {
        const ahead = forwardDelta(t, turn.t);
        if (ahead > lookAhead) continue;
        const weight = 1 - ahead / lookAhead;
        const sharp = turn.sharp * (0.45 + weight * 0.55);
        if (sharp > best.sharp) best = { dir: turn.dir, sharp, ahead };
      }
      return best;
    }

    function safeSound(fn: () => void) {
      try {
        fn();
      } catch {}
    }

    function launchRace(now = performance.now()) {
      if (raceLaunched) return;
      const launchPlayer = cars[0];
      raceLaunched = true;
      countdownDone = true;
      raceStartedAt = now;
      setRaceStarted(true);
      setCount(null);
      launchPlayer.speed = Math.max(launchPlayer.speed, baseSpeed * 0.24);
      for (let i = 1; i < cars.length; i++) {
        const launchTop = cars[i].baseTopT ?? cars[i].topT ?? AI_TOP_T;
        cars[i].speed = Math.max(cars[i].speed, launchTop * 0.42);
      }
    }
    forceStartRef.current = launchRace;

    function tick(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const k = keysRef.current;
      const player = cars[0];

      const sinceCountdownStart = now - countdownStartedAt;
      const racing = raceLaunched || sinceCountdownStart >= COUNTDOWN_MS;
      if (!racing) {
        const remain = COUNTDOWN_MS - sinceCountdownStart;
        let idx = 3;
        if (remain > 2500) {
          setCount("3");
          idx = 3;
        } else if (remain > 1500) {
          setCount("2");
          idx = 2;
        } else if (remain > 500) {
          setCount("1");
          idx = 1;
        } else {
          setCount("GO");
          idx = 0;
        }
        if (idx !== lastCountdownBeep) {
          lastCountdownBeep = idx;
          safeSound(() => playCountdownBeep(idx === 0));
        }
        // freeze cars
        player.speed = 0;
        for (let i = 1; i < cars.length; i++) cars[i].speed = 0;
        draw(now);
        raf = requestAnimationFrame(tick);
        return;
      } else if (!countdownDone) {
        launchRace(now);
      }

      const accelKey = k["w"] || k["arrowup"];
      const brakeKey = k["s"] || k["arrowdown"];
      const left = k["a"] || k["arrowleft"];
      const right = k["d"] || k["arrowright"];
      const driftKey = !!(k["e"] || k["control"] || k["drift"]);
      // Trigger nitro on press if ready (not currently boosting, cooldown elapsed)
      const nitroKeyDown = !!(k[" "] || k["shift"]);
      if (nitroKeyDown && now >= nitroReadyAt && nitroActiveUntil < now) {
        nitroActiveUntil = now + NITRO_DURATION;
        nitroReadyAt = nitroActiveUntil + NITRO_COOLDOWN;
        safeSound(playNitroSwoosh);
        shake = Math.max(shake, 6);
      }
      const boosting = nitroActiveUntil > now;

      // ===== SPINOUT — overrides controls =====
      const isSpinning = spinUntil > now;

      // Free-driving physics — nitro and boost pads each give +20% max
      const baseMax = baseSpeed * 1.4;
      const padActive = boostUntil > now;
      const driftBoosting = driftBoostUntil > now;
      const boostMul = (boosting ? 1.2 : 1) * (padActive ? 1.2 : 1) * (driftBoosting ? 1.08 : 1);
      const healthLimiter = playerHealth <= 0 ? 0.42 : 0.72 + (playerHealth / 100) * 0.28;
      const maxSpeed = baseMax * boostMul * healthLimiter;
      if (!isSpinning) {
        if (accelKey) player.speed += accel * 0.8 * dt;
        if (brakeKey) player.speed -= accel * 1.6 * dt;
        if (!accelKey && !brakeKey) player.speed -= player.speed * 0.5 * dt;
      } else {
        player.speed *= Math.pow(0.25, dt); // hard slow during spin
      }
      if (player.speed > maxSpeed) player.speed = maxSpeed;
      if (player.speed < -baseSpeed * 0.4) player.speed = -baseSpeed * 0.4;

      // HUD readiness: 1 = ready, fills back during cooldown after a burst
      if (boosting) {
        nitro = Math.max(0, (nitroActiveUntil - now) / NITRO_DURATION);
      } else if (now < nitroReadyAt) {
        nitro = 1 - (nitroReadyAt - now) / NITRO_COOLDOWN;
      } else {
        nitro = 1;
      }

      const moveScale = 1200;
      const steeringInput = (right ? 1 : 0) - (left ? 1 : 0);
      if (isSpinning) {
        player.angle += spinAngVel * dt;
        spinAngVel *= Math.pow(0.35, dt);
        lateralVelocity *= Math.pow(0.2, dt);
      } else {
        const speedAbs = Math.abs(player.speed);
        const speedRatio = Math.min(1, speedAbs / Math.max(0.001, baseMax));
        const driftIntent = driftKey && steeringInput !== 0 && speedRatio > 0.32;
        const steerGrip = 1 - Math.min(0.22, speedRatio * 0.16);
        const steerStrength =
          (1.55 + grip * 0.52) * Math.min(1, speedAbs * 8.8) * steerGrip * (driftIntent ? 1.36 : 1);
        player.angle += steeringInput * steerStrength * dt * (player.speed >= 0 ? 1 : -1);
        lateralVelocity +=
          steeringInput * player.speed * moveScale * (driftIntent ? 0.82 : 0.58) * dt;
        lateralVelocity *= Math.pow((driftIntent ? 0.2 : 0.12) + grip * 0.2, dt);
        if (Math.abs(steeringInput) > 0 && speedRatio > 0.5) {
          player.speed *= Math.pow(driftIntent ? 0.9 + grip * 0.03 : 0.8 + grip * 0.05, dt);
          shake = Math.max(shake, driftIntent ? 2.8 + speedRatio * 3.4 : 1.1 + speedRatio * 2.0);
        }
        if (driftIntent && Math.abs(lateralVelocity) > 70) {
          driftBoostUntil = Math.max(driftBoostUntil, now + 520);
          if (now - lastDriftSfx > 360) {
            lastDriftSfx = now;
            safeSound(playDriftScreech);
          }
          for (let s = 0; s < 2; s++) {
            spawnParticle(
              player.x - Math.cos(player.angle) * 18 + (Math.random() - 0.5) * 18,
              player.y - Math.sin(player.angle) * 18 + (Math.random() - 0.5) * 18,
              -Math.cos(player.angle) * 90 + (Math.random() - 0.5) * 120,
              -Math.sin(player.angle) * 90 + (Math.random() - 0.5) * 120,
              s % 2 ? "rgba(244,114,182,0.72)" : "rgba(34,211,238,0.7)",
              0.42,
              3.5,
            );
          }
        }
      }

      const forwardX = Math.cos(player.angle);
      const forwardY = Math.sin(player.angle);
      const sideX = -forwardY;
      const sideY = forwardX;
      player.x += (forwardX * player.speed * moveScale + sideX * lateralVelocity) * dt;
      player.y += (forwardY * player.speed * moveScale + sideY * lateralVelocity) * dt;

      // ===== DANGER CORNER detection + spin trigger =====
      // Compare against the car's own un-boosted max — boosts don't raise the safe ceiling.
      const speedFracNow = Math.abs(player.speed) / Math.max(0.001, baseMax);
      for (let i = 0; i < dangerPos.length; i++) {
        const cT = dangerPos[i].t;
        const dT = Math.abs(((player.t - cT + 0.5 + 1) % 1) - 0.5);
        if (dT < CORNER_HIT_RADIUS) {
          if (!cornerHit.has(i)) {
            cornerHit.add(i);
            if (speedFracNow > SPIN_THRESHOLD && spinUntil < now) {
              spinUntil = now + 1900;
              spinAngVel = (Math.random() < 0.5 ? -1 : 1) * Math.PI * 1.6;
              player.speed *= 0.35;
              shake = Math.max(shake, 18);
              safeSound(playCrash);
              // Skid marks — burst of dark tire smudges
              for (let s = 0; s < 24; s++) {
                spawnParticle(
                  player.x + (Math.random() - 0.5) * 36,
                  player.y + (Math.random() - 0.5) * 36,
                  (Math.random() - 0.5) * 260,
                  (Math.random() - 0.5) * 260,
                  s % 2 ? "rgba(40,40,40,0.9)" : "rgba(120,120,120,0.8)",
                  0.9,
                  5,
                );
              }
              // Long skid trails
              for (let s = 0; s < 6; s++) {
                trails.push({
                  x1: player.x + (Math.random() - 0.5) * 16,
                  y1: player.y + (Math.random() - 0.5) * 16,
                  x2: player.x + Math.cos(player.angle) * (20 + s * 10),
                  y2: player.y + Math.sin(player.angle) * (20 + s * 10),
                  born: now,
                });
              }
            }
          }
        } else if (dT > CORNER_HIT_RADIUS * 3) {
          cornerHit.delete(i);
        }
      }

      // ===== WARNING — flash "SLOW DOWN!" ahead of a danger corner =====
      let warnNow = false;
      for (const dc of dangerPos) {
        const ahead = (dc.t - player.t + 1) % 1;
        if (ahead > 0 && ahead < CORNER_WARN_AHEAD && speedFracNow > SPIN_THRESHOLD - 0.05) {
          warnNow = true;
          break;
        }
      }
      if (warnNow !== lastWarnState) {
        lastWarnState = warnNow;
        setWarning(warnNow);
        if (warnNow) shake = Math.max(shake, 5);
      }
      const spinNow = spinUntil > now;
      if (spinNow !== isSpinning) setSpinning(spinNow);

      // ===== Drift detection + tire trails =====
      const speedFrac = Math.abs(player.speed) / Math.max(0.001, maxSpeed);
      drifting =
        (driftKey && !!steeringInput && speedFrac > 0.34) || Math.abs(lateralVelocity) > 105;
      if (drifting || boosting) {
        // record trail segment
        const dxT = player.x - lastTrailX;
        const dyT = player.y - lastTrailY;
        if (dxT * dxT + dyT * dyT > 30 * 30) {
          trails.push({ x1: lastTrailX, y1: lastTrailY, x2: player.x, y2: player.y, born: now });
          lastTrailX = player.x;
          lastTrailY = player.y;
          if (trails.length > 280) trails.shift();
        }
      } else {
        lastTrailX = player.x;
        lastTrailY = player.y;
      }

      // ===== Soft car-vs-car contact =====
      // Cars stay on their own racing lanes, but close overlap now costs speed and health.
      if (airUntil < now) {
        for (let i = 1; i < cars.length; i++) {
          const rival = cars[i];
          if (rival.finishedAt) continue;
          const sameLapBias = rival.lap - player.lap;
          const trackGap = Math.abs(signedTrackDelta(player.t, rival.t) + sameLapBias);
          if (trackGap > 0.012) continue;
          const dx = player.x - rival.x;
          const dy = player.y - rival.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 46) continue;
          const canHit = (carHitCooldowns[rival.id] ?? 0) < now;
          const relativeSpeed = Math.abs(player.speed - rival.speed);
          const impact = Math.min(16, 5 + relativeSpeed * 18 + speedFrac * 8);
          const nx = dist > 0.001 ? dx / dist : -Math.sin(player.angle);
          const ny = dist > 0.001 ? dy / dist : Math.cos(player.angle);
          player.x += nx * 5;
          player.y += ny * 5;
          lateralVelocity += (nx * -Math.sin(player.angle) + ny * Math.cos(player.angle)) * 42;
          player.speed *= 0.82;
          shake = Math.max(shake, 5);
          if (canHit) {
            carHitCooldowns[rival.id] = now + 900;
            applyDamage(impact, player.x - nx * 15, player.y - ny * 15, "rgba(245,197,24,0.82)");
          }
        }
      }

      // ===== Track feature interactions =====
      for (const f of featurePos) {
        const dx = player.x - f.x,
          dy = player.y - f.y;
        if (dx * dx + dy * dy < 38 * 38) {
          if (f.kind === "boost" && boostUntil < now) {
            boostUntil = now + 2000;
            safeSound(playNitroSwoosh);
            shake = Math.max(shake, 4);
          } else if (f.kind === "ramp" && airUntil < now) {
            airUntil = now + 760;
            boostUntil = Math.max(boostUntil, now + 900);
            player.speed = Math.min(maxSpeed * 1.18, player.speed + accel * 0.8);
            shake = Math.max(shake, 5);
            safeSound(playNitroSwoosh);
          }
        }
      }
      if (boostUntil > now) {
        // ramp speed up toward the +20% ceiling quickly
        player.speed = Math.min(maxSpeed, player.speed + accel * 1.8 * dt);
      }

      // ===== Spawn nitro / speed particles =====
      if ((boosting || boostUntil > now) && Math.abs(player.speed) > 0.05) {
        for (let s = 0; s < 3; s++) {
          const back = -player.angle;
          const bx = player.x - Math.cos(player.angle) * 22 + (Math.random() - 0.5) * 10;
          const by = player.y - Math.sin(player.angle) * 22 + (Math.random() - 0.5) * 10;
          spawnParticle(
            bx,
            by,
            -Math.cos(player.angle) * 180 + (Math.random() - 0.5) * 120,
            -Math.sin(player.angle) * 180 + (Math.random() - 0.5) * 120,
            s % 2 ? "#22d3ee" : "#f472b6",
            0.45,
            5,
          );
          void back;
        }
      } else if (speedFrac > 0.7) {
        // speed dust
        spawnParticle(
          player.x - Math.cos(player.angle) * 18,
          player.y - Math.sin(player.angle) * 18,
          (Math.random() - 0.5) * 60,
          (Math.random() - 0.5) * 60,
          "rgba(255,255,255,0.6)",
          0.35,
          2.5,
        );
      }
      // Step particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.92;
        p.vy *= 0.92;
      }

      // ===== Camera shake triggers =====
      if (boosting && !prevBoosting) {
        shake = Math.max(shake, 5);
        safeSound(playNitroSwoosh);
      }
      prevBoosting = boosting;
      shake *= Math.pow(0.001, dt); // decay fast

      // ===== Engine audio =====
      safeSound(() => setEngine(speedFrac, boosting));

      // ===== Next-turn predictor =====
      {
        const lookAhead = 0.02 + Math.min(0.04, speedFrac * 0.04);
        const p0 = pathPoint(player.t);
        const p1 = pathPoint(player.t + lookAhead);
        const a0 = Math.atan2(p0.hy, p0.hx);
        const a1 = Math.atan2(p1.hy, p1.hx);
        let da = a1 - a0;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        const sharp = Math.min(1, Math.abs(da) * 3);
        const dir = da > 0.02 ? 1 : da < -0.02 ? -1 : 0;
        setNextTurn({ dir, sharp });
      }

      // Project to track for lap detection / off-road
      const proj = projectToTrack(player.x, player.y, player.t);
      const railPoint = pathPoint(proj.t);
      const normalX = -railPoint.hy;
      const normalY = railPoint.hx;
      const signedOffset = (player.x - railPoint.x) * normalX + (player.y - railPoint.y) * normalY;
      const barrierHit = Math.abs(signedOffset) > TRACK_BARRIER_LIMIT;
      if (barrierHit) {
        const side = Math.sign(signedOffset) || 1;
        const hitSpeed = Math.abs(player.speed);
        const impactDamage = Math.min(14, 3 + hitSpeed * 24 + Math.abs(lateralVelocity) * 0.035);
        player.x = railPoint.x + normalX * side * TRACK_BARRIER_LIMIT;
        player.y = railPoint.y + normalY * side * TRACK_BARRIER_LIMIT;
        lateralVelocity *= -0.18;
        player.speed *= Math.pow(0.42, dt);
        shake = Math.max(shake, 3.5);
        if (hitSpeed > 0.07 || Math.abs(lateralVelocity) > 30) {
          applyDamage(impactDamage, player.x, player.y, "rgba(239,68,68,0.82)");
        }
        if (Math.abs(player.speed) > 0.08 && Math.random() < 0.55) {
          spawnParticle(
            player.x - normalX * side * 8,
            player.y - normalY * side * 8,
            -normalX * side * 120 + (Math.random() - 0.5) * 80,
            -normalY * side * 120 + (Math.random() - 0.5) * 80,
            "rgba(250,250,250,0.68)",
            0.35,
            3.2,
          );
        }
      }
      const offRoad = barrierHit;
      if (offRoad) player.speed *= Math.pow(0.55, dt);
      const edgeGrip = Math.abs(signedOffset) > ROAD_W * 0.39 && !barrierHit;
      if (edgeGrip) {
        player.speed *= Math.pow(0.82, dt);
        lateralVelocity *= Math.pow(0.52, dt);
        if (Math.abs(player.speed) > 0.08 && Math.random() < 0.45) {
          spawnParticle(
            player.x - Math.cos(player.angle) * 20,
            player.y - Math.sin(player.angle) * 20,
            (Math.random() - 0.5) * 70,
            (Math.random() - 0.5) * 70,
            "rgba(244,114,182,0.55)",
            0.45,
            3,
          );
        }
      }

      const prevT = player.t;
      player.t = proj.t;
      // detect lap crossing (forward wrap)
      if (prevT > 0.85 && proj.t < 0.15) {
        player.lap += 1;
        if (player.lap >= laps && !player.finishedAt) player.finishedAt = now;
      } else if (prevT < 0.15 && proj.t > 0.85) {
        // crossed backward
        player.lap = Math.max(0, player.lap - 1);
      }

      for (let i = 1; i < cars.length; i++) {
        const c = cars[i];
        if (c.finishedAt) continue;
        // Per-car top speed comes from this bot's pace profile; no rubber-banding.
        const ownTop = c.baseTopT ?? c.topT ?? AI_TOP_T;
        // Bots automatically slow to 84% before sharp corners so they never spin out.
        const turn = upcomingTurn(c.t, 0.078);
        const driftBias = c.aiDriftBias ?? 0.45;
        const inSharpTurn =
          turn.sharp > 0.52 - driftBias * 0.08 && turn.ahead < 0.052 + driftBias * 0.012;
        const driftingBot = inSharpTurn && c.speed > ownTop * 0.58;
        if (driftingBot) c.aiDriftUntil = Math.max(c.aiDriftUntil ?? 0, now + 420);

        if (now >= (c.aiDecisionAt ?? 0)) {
          c.aiDecisionAt = now + 260 + i * 18;
          let bestLane = c.targetLane ?? c.lane;
          let bestScore = -Infinity;
          const laneChoices = [-0.75, -0.45, -0.15, 0.15, 0.45, 0.75];
          const traffic = cars
            .filter((other) => other !== c && !other.finishedAt)
            .map((other) => ({
              other,
              ahead: forwardDelta(c.t, other.t) + Math.max(0, other.lap - c.lap),
            }))
            .filter(({ ahead }) => ahead > 0 && ahead < 0.09)
            .sort((a, b) => a.ahead - b.ahead)[0];

          for (const lane of laneChoices) {
            const laneChangeCost = Math.abs(lane - c.lane) * 0.42;
            const edgeCost = Math.abs(lane) * 0.08;
            const trafficRisk = laneOccupancyRisk(c, lane) * 1.25;
            const racingLine = turn.dir === 0 ? 0 : -turn.dir * 0.28;
            const cornerScore = -Math.abs(lane - racingLine) * turn.sharp * 0.36;
            let passScore = 0;
            if (traffic) {
              const laneGap = Math.abs((traffic.other.targetLane ?? traffic.other.lane) - lane);
              const blocked = laneGap < 0.2;
              passScore = blocked ? -1.2 : (c.aiAggro ?? 0.75) * (1 - traffic.ahead / 0.09);
            }
            const rhythm = Math.sin(now / 850 + i * 1.7 + lane * 3) * 0.05;
            const score =
              passScore + cornerScore + rhythm - laneChangeCost - edgeCost - trafficRisk;
            if (score > bestScore) {
              bestScore = score;
              bestLane = lane;
            }
          }
          c.targetLane = bestLane;
        }

        const targetLane = c.targetLane ?? c.lane;
        const lanePull = Math.max(-1, Math.min(1, targetLane - c.lane));
        c.laneVel = (c.laneVel ?? 0) + lanePull * (driftingBot ? 5.8 : 3.8) * dt;
        c.laneVel *= Math.pow(driftingBot ? 0.08 : 0.16, dt);
        c.lane = Math.max(-0.78, Math.min(0.78, c.lane + (c.laneVel ?? 0) * dt));

        let speedCap = ownTop;
        if (turn.sharp > 0.55) {
          const skill = c.aiSkill ?? 0.82;
          const brakeMul = driftingBot ? 0.9 + skill * 0.08 : 0.78 + skill * 0.12;
          speedCap = Math.min(speedCap, ownTop * brakeMul);
        }
        if (driftingBot && turn.ahead < 0.018) {
          c.aiNitroUntil = Math.max(c.aiNitroUntil ?? 0, now + 520);
        }
        for (const dc of DANGER_CORNERS) {
          const ahead = (dc - c.t + 1) % 1;
          if (ahead < CORNER_WARN_AHEAD || ahead > 1 - CORNER_HIT_RADIUS) {
            speedCap = Math.min(speedCap, ownTop * 0.84);
          }
        }
        // Boost pads — same +20% for 2s as the player.
        for (const f of featurePos) {
          const dx = c.x - f.x,
            dy = c.y - f.y;
          if (dx * dx + dy * dy < 38 * 38) {
            if (f.kind === "boost" && (c.boostUntil ?? 0) < now) {
              c.boostUntil = now + 2000;
            }
          }
        }
        if ((c.boostUntil ?? 0) > now) speedCap = ownTop * 1.2;
        if ((c.aiNitroUntil ?? 0) > now) speedCap = Math.max(speedCap, ownTop * 1.12);
        const desired = speedCap;
        c.speed += Math.max(-accel * 0.9 * dt, Math.min(accel * 1.05 * dt, desired - c.speed));
        // Smooth lane movement keeps overtakes readable without physical car collisions.
        c.t += c.speed * dt;
        if (c.t >= 1) {
          c.t -= 1;
          c.lap += 1;
          if (c.lap >= laps && !c.finishedAt) c.finishedAt = now;
        }
        const pp = pathPoint(c.t);
        const aoff = c.lane * (ROAD_W / 2 - 14);
        c.x = pp.x + -pp.hy * aoff;
        c.y = pp.y + pp.hx * aoff;
        c.angle =
          Math.atan2(pp.hy, pp.hx) + (c.laneVel ?? 0) * 0.055 + (driftingBot ? turn.dir * 0.16 : 0);

        if (
          (driftingBot || (c.aiNitroUntil ?? 0) > now) &&
          c.lastTrailX !== undefined &&
          c.lastTrailY !== undefined
        ) {
          const dxT = c.x - c.lastTrailX;
          const dyT = c.y - c.lastTrailY;
          if (dxT * dxT + dyT * dyT > 26 * 26) {
            trails.push({ x1: c.lastTrailX, y1: c.lastTrailY, x2: c.x, y2: c.y, born: now });
            c.lastTrailX = c.x;
            c.lastTrailY = c.y;
            if (trails.length > 340) trails.shift();
          }
          if (Math.random() < 0.18) {
            spawnParticle(
              c.x - Math.cos(c.angle) * 18,
              c.y - Math.sin(c.angle) * 18,
              -Math.cos(c.angle) * 80 + (Math.random() - 0.5) * 80,
              -Math.sin(c.angle) * 80 + (Math.random() - 0.5) * 80,
              driftingBot ? "rgba(244,114,182,0.5)" : "rgba(34,211,238,0.5)",
              0.32,
              2.5,
            );
          }
        } else {
          c.lastTrailX = c.x;
          c.lastTrailY = c.y;
        }
      }

      draw(now);

      const standings = getStandings();
      const pos = standings.find((standing) => standing.isPlayer)?.rank ?? 1;

      setHud({
        speed: Math.round(player.speed * SPEED_KMH_FACTOR),
        lap: Math.min(laps, player.lap + 1),
        pos,
        total: cars.length,
        nitro: nitro / nitroCap,
        health: Math.round(playerHealth),
        elapsed: Math.max(0, ((player.finishedAt ?? now) - raceStartedAt) / 1000),
        lapProgress: player.lap >= laps ? 1 : player.t,
        drifting,
      });

      if (playerHealth <= 0 && !finished) {
        finished = true;
        player.finishedAt = now;
        player.speed = 0;
        lateralVelocity = 0;
        recordRaceFinish(cars.length, trackId);
        stopEngine();
        setResult({
          rank: cars.length,
          reward: 0,
          time: Math.max(0, (now - raceStartedAt) / 1000),
          best: readBestTime(trackId),
          isNewBest: false,
          standings,
          failed: true,
        });
        running = false;
        return;
      }

      if (player.finishedAt && !finished) {
        finished = true;
        const rewards = [300, 220, 160, 110, 70, 40];
        const reward = rewards[pos - 1] ?? 30;
        addCoins(reward);
        recordRaceFinish(pos, trackId);
        const t = (player.finishedAt - raceStartedAt) / 1000;
        const prevBest = readBestTime(trackId);
        const isNewBest = prevBest === null || t < prevBest;
        if (isNewBest) writeBestTime(trackId, t);
        playFanfare();
        stopEngine();
        setResult({ rank: pos, reward, time: t, best: prevBest, isNewBest, standings });
        running = false;
        return;
      }

      if (running) raf = requestAnimationFrame(tick);
    }

    function draw(now: number) {
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      const scale = Math.min(cssW / WORLD_W, cssH / WORLD_H) * 9;

      ctx.fillStyle = "#0b1a2b";
      ctx.fillRect(0, 0, cssW, cssH);

      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;

      // Third-person camera: center on player, rotate so car faces "up"
      const player = cars[0];
      const pcx = player.x;
      const pcy = player.y;
      const heading = player.angle;

      const shakeX = (Math.random() - 0.5) * shake;
      const shakeY = (Math.random() - 0.5) * shake;

      ctx.save();
      ctx.translate(cssW / 2 + shakeX, cssH * 0.72 + shakeY);
      ctx.scale(scale, scale);
      ctx.rotate(-heading - Math.PI / 2);
      ctx.translate(-pcx, -pcy);

      drawWorldBackdrop(now);

      // Build path once
      const PN = 720;
      ctx.beginPath();
      for (let i = 0; i <= PN; i++) {
        const p = pathPoint(i / PN);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();

      drawTerrainBlend(now);

      // Road shoulder
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#17171d";
      ctx.lineWidth = ROAD_W + 34;
      ctx.stroke();
      // Road
      ctx.strokeStyle = "#2a2a35";
      ctx.lineWidth = ROAD_W;
      ctx.stroke();
      drawRoadTexture(now);
      drawFestivalSections(now);
      drawUnderpasses(now);

      // Bright guardrails (outer glow + inner kerb)
      drawGuardrail(ROAD_W / 2 + 14);
      drawGuardrail(-ROAD_W / 2 - 14);
      drawKerb(ROAD_W / 2);
      drawKerb(-ROAD_W / 2);
      drawCrowdBarriers();

      // Lane dividers for the wider 6-lane circuit.
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([18, 18]);
      for (let l = 1; l < LANE_COUNT; l++) {
        const off = -ROAD_W / 2 + l * LANE_W;
        ctx.beginPath();
        const N = 360;
        for (let i = 0; i <= N; i++) {
          const p = pathPoint(i / N);
          const x = p.x + -p.hy * off;
          const y = p.y + p.hx * off;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Start/finish checkered line
      drawStartLine();

      drawTurnArrows(now);

      // Track features (under cars)
      for (const f of featurePos) drawFeature(f, now);

      // Danger corner warning signs (yellow/red triangles before each hairpin)
      for (const dc of dangerPos) {
        const before = pathPoint((dc.t - 0.022 + 1) % 1);
        const side = (dc.t * 7) % 1 > 0.5 ? 1 : -1;
        const off = (ROAD_W / 2 + 28) * side;
        const sx = before.x + -before.hy * off;
        const sy = before.y + before.hx * off;
        const pulse = 0.85 + Math.sin(now / 220) * 0.15;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(pulse, pulse);
        // post
        ctx.fillStyle = "#3a2a18";
        ctx.fillRect(-2, 6, 4, 22);
        // triangle sign
        ctx.beginPath();
        ctx.moveTo(0, -22);
        ctx.lineTo(22, 14);
        ctx.lineTo(-22, 14);
        ctx.closePath();
        ctx.fillStyle = "#facc15";
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#ef4444";
        ctx.stroke();
        // exclamation
        ctx.fillStyle = "#1a1a1a";
        ctx.font = "bold 22px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("!", 0, 2);
        ctx.restore();
      }

      // Decorations
      for (const d of decor) drawDecor(d);

      // Tire trails (under cars)
      ctx.lineCap = "round";
      for (const tr of trails) {
        const age = (now - tr.born) / 1000;
        const alpha = Math.max(0, 0.55 - age * 0.18);
        if (alpha <= 0) continue;
        ctx.strokeStyle = `rgba(15,15,15,${alpha})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(tr.x1, tr.y1);
        ctx.lineTo(tr.x2, tr.y2);
        ctx.stroke();
      }

      for (const c of sortedLowerTunnelCars()) drawCar(c, now, 0.45);
      drawOverpasses(now);

      // Cars (sorted so leader on top)
      const sorted = [...cars].sort((a, b) => a.lap + a.t - (b.lap + b.t));
      for (const c of sorted) {
        if (isInLowerUnderpass(c.t)) continue;
        drawCar(c, now);
      }

      // Particles on top
      for (const p of particles) {
        const a = Math.max(0, p.life / p.max);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.6 + a * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.restore();

      // ===== Mini-map (screen-space, bottom-left) =====
      drawMiniMap(cssW, cssH);
      void now;
    }

    function drawWorldBackdrop(now: number) {
      if (activeTheme === "dubai") {
        const sky = ctx.createLinearGradient(0, 0, 0, WORLD_H);
        sky.addColorStop(0, "#050816");
        sky.addColorStop(0.45, "#101532");
        sky.addColorStop(0.72, "#1e1735");
        sky.addColorStop(1, "#2a2116");
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, WORLD_W, WORLD_H);

        const glow = ctx.createRadialGradient(WORLD_W * 0.55, 950, 80, WORLD_W * 0.55, 950, 2200);
        glow.addColorStop(0, "rgba(56,189,248,0.22)");
        glow.addColorStop(0.45, "rgba(168,85,247,0.12)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, WORLD_W, WORLD_H);

        for (let i = 0; i < 42; i++) {
          const x = 180 + i * 210;
          const h = 180 + ((i * 71) % 620);
          const w = 82 + ((i * 17) % 52);
          ctx.fillStyle = i % 5 === 0 ? "rgba(12,19,38,0.98)" : "rgba(17,24,45,0.92)";
          ctx.fillRect(x, 1180 - h, w, h);
          ctx.fillStyle = i % 3 === 0 ? "rgba(56,189,248,0.75)" : "rgba(245,197,24,0.68)";
          for (let y = 1180 - h + 24; y < 1160; y += 48) {
            ctx.fillRect(x + 16, y, 12, 16);
            ctx.fillRect(x + w - 28, y + 18, 12, 16);
          }
        }

        ctx.fillStyle = "rgba(15,23,42,0.9)";
        ctx.beginPath();
        ctx.moveTo(3820, 1120);
        ctx.lineTo(4380, 180);
        ctx.lineTo(4920, 1120);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(56,189,248,0.65)";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(4380, 180);
        ctx.lineTo(4380, 1120);
        ctx.stroke();

        ctx.strokeStyle = "rgba(245,197,24,0.35)";
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(500, 1210);
        ctx.lineTo(8400, 990);
        ctx.stroke();
        for (let i = 0; i < 24; i++) {
          const x = 600 + ((now * 0.055 + i * 360) % 7700);
          const y = 1210 - (x - 500) * 0.028;
          ctx.fillStyle = i % 2 ? "#38bdf8" : "#facc15";
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, Math.PI * 2);
          ctx.fill();
        }
        return;
      }

      const sky = ctx.createLinearGradient(0, 0, 0, WORLD_H);
      sky.addColorStop(0, "#2b1b3d");
      sky.addColorStop(0.35, "#5d2747");
      sky.addColorStop(0.62, "#a5443d");
      sky.addColorStop(1, "#18301f");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);

      // Mount Fuji inspired backdrop.
      ctx.fillStyle = "rgba(36, 52, 78, 0.92)";
      ctx.beginPath();
      ctx.moveTo(2850, 1190);
      ctx.lineTo(4380, 250);
      ctx.lineTo(6000, 1190);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(245,245,245,0.92)";
      ctx.beginPath();
      ctx.moveTo(4020, 470);
      ctx.lineTo(4380, 250);
      ctx.lineTo(4790, 500);
      ctx.lineTo(4580, 560);
      ctx.lineTo(4380, 500);
      ctx.lineTo(4210, 575);
      ctx.closePath();
      ctx.fill();

      // Distant city glow and roads.
      ctx.fillStyle = "rgba(20,20,30,0.72)";
      for (let i = 0; i < 34; i++) {
        const x = 240 + i * 250;
        const h = 120 + ((i * 37) % 190);
        ctx.fillRect(x, 890 - h, 110, h);
        ctx.fillStyle = i % 3 === 0 ? "rgba(245,197,24,0.85)" : "rgba(255,120,180,0.7)";
        ctx.fillRect(x + 22, 890 - h + 24, 16, 12);
        ctx.fillRect(x + 64, 890 - h + 62, 16, 12);
        ctx.fillStyle = "rgba(20,20,30,0.72)";
      }
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(560, 1040);
      ctx.lineTo(8300, 920);
      ctx.stroke();

      // Moving distant traffic lights.
      for (let i = 0; i < 18; i++) {
        const x = 650 + ((now * 0.03 + i * 430) % 7600);
        const y = 1040 - (x - 560) * 0.015;
        ctx.fillStyle = i % 2 ? "#f5c518" : "#da291c";
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fill();
      }

      // Birds and petals, screen-space-ish in world coordinates.
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 4;
      for (let i = 0; i < 9; i++) {
        const x = 800 + ((now * 0.018 + i * 880) % 7200);
        const y = 520 + Math.sin(now / 900 + i) * 55 + i * 22;
        ctx.beginPath();
        ctx.moveTo(x - 18, y);
        ctx.quadraticCurveTo(x, y - 16, x + 18, y);
        ctx.stroke();
      }
      for (let i = 0; i < 80; i++) {
        const x = (i * 197 + now * (0.018 + (i % 5) * 0.006)) % WORLD_W;
        const y = (i * 113 + now * (0.012 + (i % 3) * 0.004)) % WORLD_H;
        ctx.fillStyle = i % 2 ? "rgba(255,183,213,0.65)" : "rgba(255,220,232,0.55)";
        ctx.beginPath();
        ctx.ellipse(x, y, 9, 4, Math.sin(now / 500 + i), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawRoadTexture(now: number) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.045)";
      ctx.lineWidth = 1.5;
      for (let lane = -0.42; lane <= 0.42; lane += 0.14) {
        ctx.beginPath();
        for (let i = 0; i <= 360; i++) {
          const p = pathPoint(i / 360);
          const off = lane * ROAD_W;
          const x = p.x + -p.hy * off;
          const y = p.y + p.hx * off;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // Painted racing line.
      ctx.strokeStyle = "rgba(245,197,24,0.55)";
      ctx.lineWidth = 5;
      ctx.setLineDash([44, 32]);
      ctx.beginPath();
      for (let i = 0; i <= 480; i++) {
        const p = pathPoint(i / 480);
        const racingOffset = Math.sin(i / 18) * 22;
        const x = p.x + -p.hy * racingOffset;
        const y = p.y + p.hx * racingOffset;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      // Old tire marks near technical zones.
      ctx.strokeStyle = "rgba(0,0,0,0.22)";
      ctx.lineWidth = 8;
      for (const base of [0.22, 0.47, 0.69, 0.86]) {
        ctx.beginPath();
        for (let i = 0; i < 50; i++) {
          const p = pathPoint(base + i * 0.0008);
          const off = Math.sin(i * 0.5 + now * 0.0001) * 34;
          const x = p.x + -p.hy * off;
          const y = p.y + p.hx * off;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawTerrainBlend(now: number) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const bands = [
        { width: ROAD_W + 260, color: "rgba(48, 30, 19, 0.8)" },
        { width: ROAD_W + 210, color: "rgba(63, 45, 26, 0.72)" },
        { width: ROAD_W + 160, color: "rgba(31, 82, 49, 0.78)" },
        { width: ROAD_W + 96, color: "rgba(45, 62, 48, 0.78)" },
        { width: ROAD_W + 48, color: "rgba(45, 45, 48, 0.92)" },
      ];
      for (const band of bands) {
        ctx.strokeStyle = band.color;
        ctx.lineWidth = band.width;
        ctx.beginPath();
        for (let i = 0; i <= 520; i++) {
          const p = pathPoint(i / 520);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.stroke();
      }

      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 2;
      for (let row = 0; row < 18; row++) {
        ctx.beginPath();
        for (let i = 0; i <= 140; i++) {
          const x = 160 + i * 62;
          const y = 1180 + row * 210 + Math.sin(i * 0.55 + row + now * 0.0004) * 28;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      for (let i = 0; i < 160; i++) {
        const t = i / 160;
        const p = pathPoint(t);
        const side = i % 2 === 0 ? 1 : -1;
        const off = (ROAD_W / 2 + 54 + ((i * 31) % 52)) * side;
        const x = p.x + -p.hy * off;
        const y = p.y + p.hx * off;
        ctx.fillStyle =
          activeTheme === "dubai"
            ? i % 3 === 0
              ? "rgba(190, 150, 82, 0.48)"
              : "rgba(85, 63, 38, 0.5)"
            : i % 3 === 0
              ? "rgba(95, 66, 36, 0.55)"
              : "rgba(22, 101, 52, 0.55)";
        ctx.beginPath();
        ctx.ellipse(x, y, 18 + (i % 7) * 3, 7 + (i % 5), Math.atan2(p.hy, p.hx), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    function drawTurnArrows(now: number) {
      ctx.save();
      for (const turn of activeTurnGuides) {
        for (let i = 0; i < 3; i++) {
          const t = (turn.t - 0.03 + i * 0.01 + 1) % 1;
          const p = pathPoint(t);
          const pulse = 0.72 + Math.sin(now / 180 + i) * 0.16;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.atan2(p.hy, p.hx));
          ctx.fillStyle =
            turn.sharp > 0.75 ? `rgba(250,204,21,${pulse})` : `rgba(34,211,238,${pulse})`;
          ctx.strokeStyle = "rgba(10,10,12,0.55)";
          ctx.lineWidth = 4;
          ctx.beginPath();
          const dir = turn.dir;
          ctx.moveTo(-26, -20 * dir);
          ctx.lineTo(12, 0);
          ctx.lineTo(-26, 20 * dir);
          ctx.lineTo(-16, 0);
          ctx.closePath();
          ctx.stroke();
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.restore();
    }

    function isBetweenT(t: number, start: number, end: number) {
      const value = ((t % 1) + 1) % 1;
      return start <= end ? value >= start && value <= end : value >= start || value <= end;
    }

    function isInLowerUnderpass(t: number) {
      return activeGradeSeparations.some((zone) => isBetweenT(t, zone.lowerStart, zone.lowerEnd));
    }

    function sortedLowerTunnelCars() {
      return [...cars]
        .filter((car) => isInLowerUnderpass(car.t))
        .sort((a, b) => a.lap + a.t - (b.lap + b.t));
    }

    function traceSegment(start: number, end: number, offset = 0, steps = 72) {
      ctx.beginPath();
      const span = end >= start ? end - start : end + 1 - start;
      for (let i = 0; i <= steps; i++) {
        const t = (start + span * (i / steps)) % 1;
        const p = pathPoint(t);
        const x = p.x + -p.hy * offset;
        const y = p.y + p.hx * offset;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }

    function strokeTrackSegment(
      start: number,
      end: number,
      offset: number,
      width: number,
      color: string,
      steps = 72,
    ) {
      traceSegment(start, end, offset, steps);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }

    function drawUnderpasses(now: number) {
      ctx.save();
      for (const zone of activeGradeSeparations) {
        strokeTrackSegment(zone.lowerStart, zone.lowerEnd, 0, ROAD_W + 82, "rgba(4,12,22,0.72)");
        strokeTrackSegment(zone.lowerStart, zone.lowerEnd, 0, ROAD_W + 32, "#111827");
        strokeTrackSegment(zone.lowerStart, zone.lowerEnd, 0, ROAD_W, "#202535");

        ctx.setLineDash([12, 10]);
        strokeTrackSegment(
          zone.lowerStart,
          zone.lowerEnd,
          ROAD_W / 2 + 9,
          5,
          "rgba(56,189,248,0.95)",
        );
        strokeTrackSegment(
          zone.lowerStart,
          zone.lowerEnd,
          -ROAD_W / 2 - 9,
          5,
          "rgba(56,189,248,0.95)",
        );
        ctx.setLineDash([]);

        for (let l = 1; l < LANE_COUNT; l++) {
          const off = -ROAD_W / 2 + l * LANE_W;
          ctx.setLineDash([18, 18]);
          strokeTrackSegment(zone.lowerStart, zone.lowerEnd, off, 2.5, "rgba(190,225,255,0.5)", 48);
          ctx.setLineDash([]);
        }

        for (const t of [zone.lowerStart, zone.lowerEnd]) {
          const p = pathPoint(t);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.atan2(p.hy, p.hx));
          ctx.fillStyle = "rgba(0,0,0,0.48)";
          ctx.fillRect(-16, -ROAD_W / 2 - 42, 32, ROAD_W + 84);
          ctx.strokeStyle = "rgba(56,189,248,0.9)";
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(0, -ROAD_W / 2 - 34);
          ctx.lineTo(0, ROAD_W / 2 + 34);
          ctx.stroke();
          ctx.fillStyle = "rgba(56,189,248,0.18)";
          ctx.fillRect(-28, -ROAD_W / 2 - 34, 56, ROAD_W + 68);
          ctx.restore();
        }

        const p = pathPoint((zone.lowerStart + zone.lowerEnd) / 2);
        ctx.save();
        ctx.translate(p.x + 72, p.y + 66);
        ctx.rotate(Math.sin(now / 500) * 0.02);
        ctx.fillStyle = "rgba(5,12,22,0.82)";
        roundRect(-62, -22, 124, 44, 8);
        ctx.fill();
        ctx.strokeStyle = "rgba(56,189,248,0.85)";
        ctx.lineWidth = 2;
        roundRect(-62, -22, 124, 44, 8);
        ctx.stroke();
        ctx.fillStyle = "#38bdf8";
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("TUNNEL", 0, -4);
        ctx.font = "bold 10px sans-serif";
        ctx.fillText("LOWER ROAD", 0, 12);
        ctx.restore();
      }
      ctx.restore();
    }

    function drawOverpasses(now: number) {
      ctx.save();
      for (const zone of activeGradeSeparations) {
        const crossing = pathPoint(zone.crossingT);
        const bridgeStart = zone.upperStart;
        const bridgeEnd = zone.upperEnd;
        const rampStart = zone.upperRampInStart;
        const rampEnd = zone.upperRampOutEnd;

        ctx.save();
        ctx.translate(crossing.x, crossing.y);
        ctx.rotate(Math.atan2(crossing.hy, crossing.hx));
        ctx.fillStyle = "rgba(0,0,0,0.48)";
        ctx.beginPath();
        ctx.ellipse(0, 0, 240, ROAD_W * 0.78, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        drawBridgeApproach(rampStart, bridgeStart, "in");
        drawBridgeApproach(bridgeEnd, rampEnd, "out");

        drawBridgeSeam(rampStart, "in");
        drawBridgeSeam(rampEnd, "out");

        strokeTrackSegment(rampStart, rampEnd, 0, ROAD_W + 92, "rgba(0,0,0,0.28)");
        strokeTrackSegment(rampStart, rampEnd, 0, ROAD_W + 58, "#4b5563");
        strokeTrackSegment(rampStart, rampEnd, 0, ROAD_W + 28, "#b9c0ca");
        strokeTrackSegment(rampStart, rampEnd, 0, ROAD_W + 8, "#17171d");
        strokeTrackSegment(rampStart, rampEnd, 0, ROAD_W, "#30313b");

        for (let l = 1; l < LANE_COUNT; l++) {
          const off = -ROAD_W / 2 + l * LANE_W;
          ctx.setLineDash([18, 18]);
          strokeTrackSegment(rampStart, rampEnd, off, 2.5, "rgba(255,255,255,0.62)", 64);
          ctx.setLineDash([]);
        }

        for (const off of [ROAD_W / 2 + 4, -ROAD_W / 2 - 4]) {
          strokeTrackSegment(rampStart, rampEnd, off, 7, "#facc15", 90);
          strokeTrackSegment(rampStart, rampEnd, off + (off > 0 ? 13 : -13), 6, "#22d3ee", 90);
        }

        for (const t of [bridgeStart, bridgeEnd]) {
          const p = pathPoint(t);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.atan2(p.hy, p.hx));
          const grad = ctx.createLinearGradient(-24, 0, 24, 0);
          grad.addColorStop(0, "rgba(250,204,21,0.08)");
          grad.addColorStop(0.5, "rgba(250,204,21,0.45)");
          grad.addColorStop(1, "rgba(250,204,21,0.08)");
          ctx.fillStyle = grad;
          ctx.fillRect(-26, -ROAD_W / 2 - 38, 52, ROAD_W + 76);
          ctx.strokeStyle = "rgba(250,204,21,0.78)";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(0, -ROAD_W / 2 - 34);
          ctx.lineTo(0, ROAD_W / 2 + 34);
          ctx.stroke();
          ctx.restore();
        }

        for (const t of [bridgeStart + 0.005, zone.crossingT, bridgeEnd - 0.005]) {
          const p = pathPoint(t);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.atan2(p.hy, p.hx));
          for (const side of [-1, 1]) {
            ctx.fillStyle = "rgba(0,0,0,0.42)";
            ctx.beginPath();
            ctx.ellipse(0, side * (ROAD_W / 2 + 86), 28, 12, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#6b7280";
            const pierY = side > 0 ? ROAD_W / 2 + 42 : -ROAD_W / 2 - 114;
            roundRect(-12, pierY, 24, 72, 5);
            ctx.fill();
          }
          ctx.restore();
        }

        const label = pathPoint(zone.crossingT - 0.006);
        ctx.save();
        ctx.translate(label.x - 118, label.y - 88);
        ctx.rotate(Math.sin(now / 600) * 0.015);
        ctx.fillStyle = "rgba(12,12,8,0.86)";
        roundRect(-60, -22, 120, 44, 8);
        ctx.fill();
        ctx.strokeStyle = "rgba(250,204,21,0.9)";
        ctx.lineWidth = 2;
        roundRect(-60, -22, 120, 44, 8);
        ctx.stroke();
        ctx.fillStyle = "#facc15";
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("BRIDGE", 0, -4);
        ctx.font = "bold 10px sans-serif";
        ctx.fillText("ROAD ABOVE", 0, 12);
        ctx.restore();
      }
      ctx.restore();
    }

    function drawBridgeSeam(t: number, direction: "in" | "out") {
      const p = pathPoint(t);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(p.hy, p.hx));
      const forward = direction === "in" ? 1 : -1;
      const asphalt = ctx.createLinearGradient(-80 * forward, 0, 80 * forward, 0);
      asphalt.addColorStop(0, "rgba(42,42,53,0)");
      asphalt.addColorStop(0.34, "#2a2a35");
      asphalt.addColorStop(0.7, "#4b5563");
      asphalt.addColorStop(1, "rgba(75,85,99,0)");
      ctx.fillStyle = asphalt;
      ctx.beginPath();
      ctx.moveTo(-92 * forward, -ROAD_W / 2 - 26);
      ctx.lineTo(92 * forward, -ROAD_W / 2 - 46);
      ctx.lineTo(92 * forward, ROAD_W / 2 + 46);
      ctx.lineTo(-92 * forward, ROAD_W / 2 + 26);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(250,204,21,0.78)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-78 * forward, -ROAD_W / 2 - 14);
      ctx.lineTo(86 * forward, -ROAD_W / 2 - 32);
      ctx.moveTo(-78 * forward, ROAD_W / 2 + 14);
      ctx.lineTo(86 * forward, ROAD_W / 2 + 32);
      ctx.stroke();
      ctx.restore();
    }

    function drawBridgeApproach(start: number, end: number, direction: "in" | "out") {
      const span = end >= start ? end - start : end + 1 - start;
      ctx.save();
      for (let i = 0; i < 18; i++) {
        const a = i / 18;
        const b = (i + 1) / 18;
        const t0 = (start + span * a) % 1;
        const t1 = (start + span * b) % 1;
        const rise = direction === "in" ? b : 1 - a;
        const deckExtra = 10 + rise * 54;
        strokeTrackSegment(t0, t1, 0, ROAD_W + deckExtra, "rgba(185,192,202,0.92)", 4);
        strokeTrackSegment(t0, t1, 0, ROAD_W + 4, "#2f3039", 4);
      }
      ctx.restore();
    }

    function drawFestivalSections(now: number) {
      drawTrackBand(0.5, 0.57, "#5b3421", "rgba(245,197,24,0.25)");
      drawTrackBand(0.84, 0.91, "rgba(14,14,20,0.72)", "rgba(218,41,28,0.28)");
      for (const t of [0.5, 0.57]) {
        const p = pathPoint(t);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(p.hy, p.hx));
        ctx.fillStyle = "#2f1d14";
        ctx.fillRect(-14, -ROAD_W / 2 - 28, 28, ROAD_W + 56);
        ctx.restore();
      }
      for (let i = 0; i < 9; i++) {
        const p = pathPoint(0.84 + i * 0.008);
        const pulse = 0.5 + Math.sin(now / 220 + i) * 0.18;
        ctx.fillStyle = `rgba(218,41,28,${pulse})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 34, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawTrackBand(t0: number, t1: number, fill: string, glow: string) {
      ctx.save();
      ctx.strokeStyle = glow;
      ctx.lineWidth = ROAD_W + 58;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (let i = 0; i <= 80; i++) {
        const p = pathPoint(t0 + (t1 - t0) * (i / 80));
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.strokeStyle = fill;
      ctx.lineWidth = ROAD_W + 18;
      ctx.stroke();
      ctx.restore();
    }

    function drawMiniMap(cssW: number, cssH: number) {
      const mw = 190,
        mh = 112;
      const pad = 12;
      const x0 = pad,
        y0 = cssH - mh - pad;
      // bg
      ctx.save();
      ctx.fillStyle = "rgba(5,12,22,0.86)";
      roundRectAbs(x0, y0, mw, mh, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(34,211,238,0.62)";
      ctx.lineWidth = 1.4;
      roundRectAbs(x0, y0, mw, mh, 10);
      ctx.stroke();

      // map world bounds to mini-map
      const margin = 10;
      const ww = mw - margin * 2,
        hh = mh - margin * 2;
      const sx = ww / WORLD_W,
        sy = hh / WORLD_H;
      const s = Math.min(sx, sy);
      const ox = x0 + margin + (mw - margin * 2 - WORLD_W * s) / 2;
      const oy = y0 + margin + (mh - margin * 2 - WORLD_H * s) / 2;

      // track outline
      ctx.strokeStyle = "rgba(180,210,255,0.35)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      const NM = 150;
      for (let i = 0; i <= NM; i++) {
        const p = rawPoint(i / NM);
        const X = ox + p.x * s,
          Y = oy + p.y * s;
        if (i === 0) ctx.moveTo(X, Y);
        else ctx.lineTo(X, Y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.strokeStyle = "rgba(245,197,24,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= NM; i++) {
        const p = rawPoint(i / NM);
        const X = ox + p.x * s,
          Y = oy + p.y * s;
        if (i === 0) ctx.moveTo(X, Y);
        else ctx.lineTo(X, Y);
      }
      ctx.closePath();
      ctx.stroke();

      const drawMiniSegment = (
        start: number,
        end: number,
        color: string,
        width: number,
        dash: number[] = [],
      ) => {
        const span = end >= start ? end - start : end + 1 - start;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.setLineDash(dash);
        ctx.beginPath();
        for (let i = 0; i <= 24; i++) {
          const p = rawPoint((start + span * (i / 24)) % 1);
          const X = ox + p.x * s,
            Y = oy + p.y * s;
          if (i === 0) ctx.moveTo(X, Y);
          else ctx.lineTo(X, Y);
        }
        ctx.stroke();
        ctx.restore();
      };
      for (const zone of activeGradeSeparations) {
        drawMiniSegment(zone.lowerStart, zone.lowerEnd, "#38bdf8", 3, [2, 2]);
        drawMiniSegment(zone.upperRampInStart, zone.upperRampOutEnd, "#facc15", 3, [2, 2]);
      }

      // cars
      for (const c of cars) {
        ctx.fillStyle = c.isPlayer ? "#ffffff" : c.color;
        ctx.beginPath();
        ctx.arc(ox + c.x * s, oy + c.y * s, c.isPlayer ? 3 : 2.2, 0, Math.PI * 2);
        ctx.fill();
        if (c.isPlayer) {
          ctx.strokeStyle = "rgba(98,159,248,0.9)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(ox + c.x * s, oy + c.y * s, 5, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      // Danger corner markers on minimap
      for (const turn of activeTurnGuides) {
        const p = rawPoint(turn.t);
        const X = ox + p.x * s,
          Y = oy + p.y * s;
        ctx.fillStyle = turn.sharp > 0.75 ? "#facc15" : "#22d3ee";
        ctx.strokeStyle = "rgba(0,0,0,0.75)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(X + turn.dir * 4, Y);
        ctx.lineTo(X - turn.dir * 2, Y - 4);
        ctx.lineTo(X - turn.dir * 2, Y + 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    function roundRectAbs(x: number, y: number, w: number, h: number, r: number) {
      const rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.lineTo(x + w - rr, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
      ctx.lineTo(x + w, y + h - rr);
      ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
      ctx.lineTo(x + rr, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
      ctx.lineTo(x, y + rr);
      ctx.quadraticCurveTo(x, y, x + rr, y);
      ctx.closePath();
    }

    function drawGuardrail(offset: number) {
      const steps = 600;
      ctx.lineCap = "round";
      // outer glow
      ctx.strokeStyle = "rgba(34, 211, 238, 0.35)";
      ctx.lineWidth = 16;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const p = pathPoint(t);
        const x = p.x + -p.hy * offset;
        const y = p.y + p.hx * offset;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      // bright inner rail
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 5;
      ctx.stroke();
    }

    function drawCrowdBarriers() {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const zones = [
        [0.0, 0.055],
        [0.155, 0.235],
        [0.285, 0.335],
        [0.405, 0.455],
        [0.65, 0.72],
        [0.8, 0.86],
      ];
      for (const [start, end] of zones) {
        for (const side of [-1, 1]) {
          ctx.strokeStyle = "rgba(250,250,250,0.72)";
          ctx.lineWidth = 7;
          ctx.beginPath();
          for (let i = 0; i <= 28; i++) {
            const t = start + (end - start) * (i / 28);
            const p = pathPoint(t);
            const off = (ROAD_W / 2 + 46) * side;
            const x = p.x + -p.hy * off;
            const y = p.y + p.hx * off;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.strokeStyle = "rgba(218,41,28,0.92)";
          ctx.lineWidth = 3;
          ctx.setLineDash([22, 14]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      ctx.restore();
    }

    function drawKerb(offset: number) {
      const steps = 600;
      ctx.save();
      ctx.lineWidth = 16;
      ctx.strokeStyle = "rgba(10,10,12,0.82)";
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const p = pathPoint(t);
        const x = p.x + -p.hy * offset;
        const y = p.y + p.hx * offset;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();

      ctx.lineWidth = 10;
      for (let i = 0; i < steps; i++) {
        const t0 = i / steps;
        const t1 = (i + 1) / steps;
        const p0 = pathPoint(t0);
        const p1 = pathPoint(t1);
        const ax = p0.x + -p0.hy * offset;
        const ay = p0.y + p0.hx * offset;
        const bx = p1.x + -p1.hy * offset;
        const by = p1.y + p1.hx * offset;
        ctx.strokeStyle = i % 2 === 0 ? "#fafafa" : "#dc2626";
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawFeature(
      f: { x: number; y: number; angle: number; kind: "boost" | "ramp" },
      now: number,
    ) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.angle);
      if (f.kind === "boost") {
        const pulse = 0.6 + 0.4 * Math.sin(now / 120);
        // glow
        ctx.fillStyle = `rgba(34,211,238,${0.25 * pulse})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, 44, 22, 0, 0, Math.PI * 2);
        ctx.fill();
        // pad
        const grad = ctx.createLinearGradient(-30, 0, 30, 0);
        grad.addColorStop(0, "#22d3ee");
        grad.addColorStop(0.5, "#ffffff");
        grad.addColorStop(1, "#22d3ee");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect
          ? ctx.roundRect(-30, -16, 60, 32, 6)
          : (() => {
              ctx.rect(-30, -16, 60, 32);
            })();
        ctx.fill();
        // arrows
        ctx.fillStyle = `rgba(255,255,255,${0.7 + 0.3 * pulse})`;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 14 - 6, -8);
          ctx.lineTo(i * 14 + 6, 0);
          ctx.lineTo(i * 14 - 6, 8);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        // ramp — yellow/orange wedge with stripes
        ctx.fillStyle = "#1f1f24";
        ctx.beginPath();
        ctx.ellipse(0, 6, 40, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.moveTo(-32, 14);
        ctx.lineTo(32, 14);
        ctx.lineTo(20, -12);
        ctx.lineTo(-20, -12);
        ctx.closePath();
        ctx.fill();
        // top stripes
        ctx.fillStyle = "#0a0a0f";
        for (let i = -2; i <= 2; i++) {
          ctx.fillRect(i * 8 - 2, -12, 4, 26);
        }
      }
      ctx.restore();
    }

    function drawDecor(d: Decor) {
      ctx.save();
      ctx.translate(d.x, d.y);
      if (d.kind === "tree") {
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.ellipse(2, 4, d.size * 0.9, d.size * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#5b3a1e";
        ctx.fillRect(-d.size * 0.12, -d.size * 0.1, d.size * 0.24, d.size * 0.5);
        ctx.fillStyle = "#166534";
        ctx.beginPath();
        ctx.arc(0, -d.size * 0.2, d.size * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#22c55e";
        ctx.beginPath();
        ctx.arc(-d.size * 0.25, -d.size * 0.35, d.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.kind === "palm") {
        const sway = Math.sin((d.phase ?? 0) + performance.now() / 850) * 0.12;
        ctx.fillStyle = "rgba(0,0,0,0.32)";
        ctx.beginPath();
        ctx.ellipse(4, 6, d.size * 0.7, d.size * 0.24, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.rotate(sway);
        ctx.fillStyle = "#8b5a2b";
        ctx.fillRect(-d.size * 0.08, -d.size * 0.08, d.size * 0.16, d.size * 0.92);
        ctx.translate(0, -d.size * 0.16);
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI * 0.95 + i * ((Math.PI * 1.9) / 6);
          ctx.save();
          ctx.rotate(a);
          ctx.fillStyle = i % 2 ? "#22c55e" : "#16a34a";
          ctx.beginPath();
          ctx.ellipse(d.size * 0.36, 0, d.size * 0.42, d.size * 0.1, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      } else if (d.kind === "sakura" || d.kind === "pine") {
        const sway = Math.sin((d.phase ?? 0) + performance.now() / 900) * 3;
        ctx.rotate(sway * 0.01);
        ctx.fillStyle = "rgba(0,0,0,0.32)";
        ctx.beginPath();
        ctx.ellipse(3, 5, d.size * 0.8, d.size * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#5b3a1e";
        ctx.fillRect(-d.size * 0.08, -d.size * 0.05, d.size * 0.16, d.size * 0.65);
        if (d.kind === "sakura") {
          ctx.fillStyle = "#ffb7d5";
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(
              Math.cos(a) * d.size * 0.24,
              -d.size * 0.25 + Math.sin(a) * d.size * 0.16,
              d.size * 0.35,
              0,
              Math.PI * 2,
            );
            ctx.fill();
          }
          ctx.fillStyle = "#ffe3ee";
          ctx.beginPath();
          ctx.arc(0, -d.size * 0.3, d.size * 0.36, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = "#0f5132";
          ctx.beginPath();
          ctx.moveTo(0, -d.size * 0.85);
          ctx.lineTo(d.size * 0.58, d.size * 0.24);
          ctx.lineTo(-d.size * 0.58, d.size * 0.24);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#1f7a45";
          ctx.beginPath();
          ctx.moveTo(0, -d.size * 0.6);
          ctx.lineTo(d.size * 0.46, d.size * 0.14);
          ctx.lineTo(-d.size * 0.46, d.size * 0.14);
          ctx.closePath();
          ctx.fill();
        }
      } else if (d.kind === "rock") {
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath();
        ctx.ellipse(2, 3, d.size * 0.7, d.size * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#6b7280";
        ctx.beginPath();
        ctx.arc(0, 0, d.size * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#9ca3af";
        ctx.beginPath();
        ctx.arc(-d.size * 0.15, -d.size * 0.15, d.size * 0.25, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.kind === "flag") {
        // flag
        ctx.fillStyle = "#9ca3af";
        ctx.fillRect(-1, -d.size, 2, d.size);
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.moveTo(1, -d.size);
        ctx.lineTo(d.size * 0.9, -d.size * 0.7);
        ctx.lineTo(1, -d.size * 0.5);
        ctx.closePath();
        ctx.fill();
      } else if (d.kind === "banner" || d.kind === "lantern" || d.kind === "spectator") {
        const wave = Math.sin((d.phase ?? 0) + performance.now() / 260) * 3;
        if (d.kind === "spectator") {
          ctx.fillStyle = "rgba(0,0,0,0.28)";
          ctx.beginPath();
          ctx.ellipse(0, 8, d.size * 0.8, d.size * 0.25, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = ["#da291c", "#f5c518", "#ffffff", "#1e41ff"][
            Math.floor((d.phase ?? 0) * 10) % 4
          ];
          ctx.beginPath();
          ctx.arc(0, -d.size * 0.4 + wave * 0.15, d.size * 0.28, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#f1c27d";
          ctx.beginPath();
          ctx.arc(0, -d.size * 0.78 + wave * 0.15, d.size * 0.18, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-d.size * 0.3, -d.size * 0.35);
          ctx.lineTo(-d.size * 0.58, -d.size * 0.75 + wave);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(d.size * 0.3, -d.size * 0.35);
          ctx.lineTo(d.size * 0.58, -d.size * 0.75 - wave);
          ctx.stroke();
        } else {
          ctx.fillStyle = "#2b1b1b";
          ctx.fillRect(-2, -d.size * 1.1, 4, d.size * 1.4);
          if (d.kind === "lantern") {
            ctx.fillStyle = "rgba(245,197,24,0.25)";
            ctx.beginPath();
            ctx.arc(0, -d.size * 0.68, d.size * 0.7, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#da291c";
            ctx.beginPath();
            ctx.ellipse(0, -d.size * 0.65, d.size * 0.34, d.size * 0.48, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#f5c518";
            ctx.fillRect(-d.size * 0.26, -d.size * 0.68, d.size * 0.52, d.size * 0.08);
          } else {
            ctx.fillStyle = "#da291c";
            ctx.beginPath();
            ctx.moveTo(0, -d.size);
            ctx.lineTo(d.size * 0.85, -d.size * 0.86 + wave);
            ctx.lineTo(d.size * 0.85, -d.size * 0.42 + wave);
            ctx.lineTo(0, -d.size * 0.56);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "#ffffff";
            ctx.font = `bold ${Math.max(9, d.size * 0.28)}px sans-serif`;
            ctx.textAlign = "center";
            ctx.fillText("祭", d.size * 0.42, -d.size * 0.62 + wave);
          }
        }
      } else if (d.kind === "pole") {
        // light pole — vertical post + warm bulb
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.ellipse(3, 4, d.size * 0.35, d.size * 0.14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#cbd5e1";
        ctx.fillRect(-1.5, -d.size, 3, d.size);
        ctx.fillStyle = "#fde047";
        ctx.beginPath();
        ctx.arc(0, -d.size, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(253,224,71,0.35)";
        ctx.beginPath();
        ctx.arc(0, -d.size, 10, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.kind === "torii") {
        if (d.angle !== undefined) ctx.rotate(d.angle + Math.PI / 2);
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.ellipse(0, d.size * 0.4, d.size * 0.9, d.size * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#b01e0a";
        ctx.fillRect(-d.size * 0.62, -d.size * 0.75, d.size * 0.14, d.size * 1.4);
        ctx.fillRect(d.size * 0.48, -d.size * 0.75, d.size * 0.14, d.size * 1.4);
        ctx.fillRect(-d.size * 0.9, -d.size * 0.88, d.size * 1.8, d.size * 0.16);
        ctx.fillRect(-d.size * 0.72, -d.size * 0.64, d.size * 1.44, d.size * 0.12);
        ctx.fillStyle = "#111111";
        ctx.fillRect(-d.size, -d.size, d.size * 2, d.size * 0.12);
      } else if (
        d.kind === "temple" ||
        d.kind === "house" ||
        d.kind === "hotel" ||
        d.kind === "grandstand" ||
        d.kind === "pit"
      ) {
        if (d.kind === "grandstand") {
          const w = d.size * 1.8;
          const h = d.size * 0.7;
          ctx.fillStyle = "rgba(0,0,0,0.35)";
          ctx.beginPath();
          ctx.ellipse(0, h * 0.48, w * 0.55, h * 0.16, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#111827";
          ctx.fillRect(-w / 2, -h * 0.36, w, h * 0.72);
          ctx.fillStyle = "#38bdf8";
          ctx.fillRect(-w / 2, -h * 0.46, w, h * 0.09);
          for (let i = 0; i < 9; i++) {
            ctx.fillStyle = ["#facc15", "#ffffff", "#ef4444"][i % 3];
            ctx.fillRect(-w * 0.42 + i * w * 0.1, -h * 0.18, w * 0.045, h * 0.34);
          }
          ctx.restore();
          return;
        }
        if (d.kind === "pit") {
          const w = d.size * 2.0;
          const h = d.size * 0.55;
          ctx.fillStyle = "rgba(0,0,0,0.36)";
          ctx.beginPath();
          ctx.ellipse(0, h * 0.62, w * 0.55, h * 0.18, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#202838";
          ctx.fillRect(-w / 2, -h * 0.45, w, h * 0.9);
          ctx.fillStyle = "#facc15";
          ctx.fillRect(-w / 2, -h * 0.56, w, h * 0.12);
          ctx.fillStyle = "#38bdf8";
          for (let i = 0; i < 8; i++)
            ctx.fillRect(-w * 0.42 + i * w * 0.12, -h * 0.18, w * 0.07, h * 0.26);
          ctx.restore();
          return;
        }
        const w = d.size * (d.kind === "temple" ? 1.4 : 1.15);
        const h = d.size * 0.78;
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.ellipse(0, h * 0.62, w * 0.55, h * 0.16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle =
          d.kind === "hotel" ? "#101827" : d.kind === "temple" ? "#4b2a1d" : "#2b2b34";
        ctx.fillRect(-w * 0.42, -h * 0.15, w * 0.84, h * 0.62);
        ctx.fillStyle =
          d.kind === "hotel" ? "#38bdf8" : d.kind === "temple" ? "#da291c" : "#f5c518";
        ctx.beginPath();
        ctx.moveTo(-w * 0.58, -h * 0.18);
        ctx.lineTo(0, -h * 0.72);
        ctx.lineTo(w * 0.58, -h * 0.18);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#111111";
        ctx.fillRect(-w * 0.62, -h * 0.2, w * 1.24, h * 0.08);
        ctx.fillStyle = "rgba(245,197,24,0.85)";
        ctx.fillRect(-w * 0.12, h * 0.05, w * 0.24, h * 0.42);
      } else if (d.kind === "train" || d.kind === "car") {
        const shift =
          d.kind === "train"
            ? ((performance.now() * 0.045 + (d.phase ?? 0) * 80) % 900) - 450
            : Math.sin(performance.now() / 600 + (d.phase ?? 0)) * 70;
        ctx.translate(shift, 0);
        const w = d.size * (d.kind === "train" ? 1.8 : 1.1);
        const h = d.size * 0.34;
        ctx.fillStyle = d.kind === "train" ? "#e5e7eb" : "#1e41ff";
        roundRect(-w / 2, -h / 2, w, h, 8);
        ctx.fill();
        ctx.fillStyle = d.kind === "train" ? "#da291c" : "#f5c518";
        ctx.fillRect(-w * 0.34, -h * 0.1, w * 0.68, h * 0.18);
        ctx.fillStyle = "#111";
        ctx.beginPath();
        ctx.arc(-w * 0.32, h * 0.5, h * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(w * 0.32, h * 0.5, h * 0.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.kind === "drone" || d.kind === "balloon") {
        const bob = Math.sin(performance.now() / 700 + (d.phase ?? 0)) * 16;
        ctx.translate(0, bob);
        if (d.kind === "balloon") {
          ctx.fillStyle = "rgba(245,197,24,0.8)";
          ctx.beginPath();
          ctx.ellipse(0, -d.size * 0.55, d.size * 0.42, d.size * 0.58, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#da291c";
          ctx.fillRect(-d.size * 0.12, d.size * 0.02, d.size * 0.24, d.size * 0.18);
        } else {
          ctx.strokeStyle = "#e5e7eb";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-d.size * 0.55, 0);
          ctx.lineTo(d.size * 0.55, 0);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, -d.size * 0.35);
          ctx.lineTo(0, d.size * 0.35);
          ctx.stroke();
          ctx.fillStyle = "#111827";
          roundRect(-d.size * 0.22, -d.size * 0.14, d.size * 0.44, d.size * 0.28, 4);
          ctx.fill();
          ctx.fillStyle = "#22d3ee";
          for (const [x, y] of [
            [-0.55, 0],
            [0.55, 0],
            [0, -0.35],
            [0, 0.35],
          ]) {
            ctx.beginPath();
            ctx.arc(d.size * x, d.size * y, d.size * 0.12, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (d.kind === "billboard") {
        ctx.save();
        if (d.angle !== undefined) ctx.rotate(d.angle);
        // shadow
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.ellipse(3, 6, d.size * 0.6, d.size * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
        // legs
        ctx.fillStyle = "#475569";
        ctx.fillRect(-d.size * 0.5, 0, 4, d.size * 0.45);
        ctx.fillRect(d.size * 0.5 - 4, 0, 4, d.size * 0.45);
        // panel
        const w = d.size * 1.1,
          h = d.size * 0.55;
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(-w / 2 - 2, -h - 4, w + 4, h + 6);
        const grad = ctx.createLinearGradient(-w / 2, -h, w / 2, 0);
        grad.addColorStop(0, "#da291c");
        grad.addColorStop(0.5, "#f5c518");
        grad.addColorStop(1, "#ff4fa3");
        ctx.fillStyle = grad;
        ctx.fillRect(-w / 2, -h, w, h);
        ctx.fillStyle =
          performance.now() % 700 < 350 ? "rgba(255,255,255,0.95)" : "rgba(245,197,24,0.95)";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("SAKURA GP", 0, -h / 2);
        ctx.restore();
      }
      ctx.restore();
    }

    function drawStartLine() {
      const p = pathPoint(0);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(p.hy, p.hx));
      const half = ROAD_W / 2;
      const cellW = 8;
      const rows = 2;
      const cols = Math.floor(ROAD_W / 10);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.fillStyle = (r + c) % 2 === 0 ? "#fff" : "#000";
          const y = -half + c * (ROAD_W / cols);
          ctx.fillRect(-cellW + r * cellW, y, cellW, ROAD_W / cols);
        }
      }
      ctx.restore();
    }

    function drawCar(c: Car, now: number, alpha = 1) {
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.translate(c.x, c.y);
      // ramp jump bounce — scale up briefly while airborne
      const jump = c.isPlayer && airUntil > now ? Math.sin(((airUntil - now) / 750) * Math.PI) : 0;
      const s = 1 + jump * 0.35;
      const botDrifting = !c.isPlayer && (c.aiDriftUntil ?? 0) > now;
      const botBoosting = !c.isPlayer && ((c.aiNitroUntil ?? 0) > now || (c.boostUntil ?? 0) > now);
      ctx.rotate(c.angle);
      ctx.scale(s, s);

      // shadow (stays lower while jumping)
      ctx.fillStyle = `rgba(0,0,0,${0.35 - jump * 0.2})`;
      roundRect(-22 + jump * 8, -13 + jump * 6, 46, 28, 6);
      ctx.fill();

      if (botBoosting) {
        const glow = ctx.createLinearGradient(-46, 0, -14, 0);
        glow.addColorStop(0, "rgba(34,211,238,0)");
        glow.addColorStop(1, "rgba(34,211,238,0.72)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.moveTo(-48, -9);
        ctx.lineTo(-16, -5);
        ctx.lineTo(-16, 5);
        ctx.lineTo(-48, 9);
        ctx.closePath();
        ctx.fill();
      }

      if (botDrifting) {
        ctx.strokeStyle = "rgba(244,114,182,0.7)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(-18, 0, 19, -0.65, 0.65);
        ctx.stroke();
      }

      const [body, dark, accent] = c.colors;
      ctx.fillStyle = dark;
      roundRect(-26, -16, 9, 32, 3);
      ctx.fill();
      roundRect(18, -16, 9, 32, 3);
      ctx.fill();

      ctx.fillStyle = body;
      roundRect(-21, -10, 42, 20, 7);
      ctx.fill();

      ctx.fillStyle = accent;
      roundRect(-12, -6, 19, 12, 5);
      ctx.fill();
      ctx.fillRect(12, -11, 11, 22);

      ctx.fillStyle = dark;
      roundRect(-2, -7, 12, 14, 4);
      ctx.fill();

      ctx.fillStyle = "#050505";
      roundRect(-18, -18, 9, 6, 3);
      ctx.fill();
      roundRect(8, -18, 9, 6, 3);
      ctx.fill();
      roundRect(-18, 12, 9, 6, 3);
      ctx.fill();
      roundRect(8, 12, 9, 6, 3);
      ctx.fill();

      ctx.strokeStyle = c.isPlayer ? "#fff" : "rgba(0,0,0,0.5)";
      ctx.lineWidth = c.isPlayer ? 2.5 : 1.5;
      roundRect(-21, -10, 42, 20, 7);
      ctx.stroke();

      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(c.driverCode, 0, -31);

      ctx.restore();
    }

    function roundRect(x: number, y: number, w: number, h: number, r: number) {
      const rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.lineTo(x + w - rr, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
      ctx.lineTo(x + w, y + h - rr);
      ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
      ctx.lineTo(x + rr, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
      ctx.lineTo(x, y + rr);
      ctx.quadraticCurveTo(x, y, x + rr, y);
      ctx.closePath();
    }

    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      forceStartRef.current = null;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      stopEngine();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laps, trackId]);

  return (
    <section className="relative flex flex-1 flex-col gap-3">
      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden rounded-2xl border border-border bg-card/40 backdrop-blur-md outline-none"
        style={{ aspectRatio: "11 / 6.5" }}
        onClick={(e) => (e.currentTarget as HTMLElement).focus()}
        tabIndex={0}
      >
        <canvas ref={canvasRef} className="block h-full w-full" />

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-2">
          <div className="w-44 rounded-xl border border-primary/30 bg-background/70 px-3 py-1.5 text-xs font-bold backdrop-blur shadow-[0_0_24px_-12px_rgba(98,159,248,0.6)]">
            <div className="flex items-center justify-between">
              <span className="ps-chip ps-chip-solid" style={{ padding: "2px 8px", fontSize: 9 }}>
                LAP {hud.lap}/{laps}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {Math.round(hud.lapProgress * 100)}%
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-gradient-to-r from-primary-glow to-primary transition-[width] duration-150"
                style={{ width: `${Math.round(hud.lapProgress * 100)}%` }}
              />
            </div>
          </div>
          <div className="rounded-xl border border-primary/30 bg-background/70 px-3 py-1.5 text-xs font-bold backdrop-blur tabular-nums">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Time
            </span>
            <div className="text-foreground">{formatTime(hud.elapsed)}</div>
            {bestTime !== null && (
              <div className="text-[10px] text-primary-glow">Best {formatTime(bestTime)}</div>
            )}
          </div>
          <div className="rounded-xl border border-primary/30 bg-background/70 px-3 py-1.5 text-xs font-bold backdrop-blur">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Position
            </span>
            <div className="text-foreground">
              P{hud.pos}
              <span className="text-muted-foreground">/{hud.total}</span>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute right-3 top-3 flex flex-col items-end gap-2">
          {(() => {
            const frac = Math.min(1, hud.speed / 90);
            // Green safe / Yellow caution / Red = above 85% (corner-spinout danger)
            const color = frac < 0.7 ? "#22c55e" : frac < 0.85 ? "#facc15" : "#ef4444";
            return (
              <div
                className="rounded-xl border bg-background/70 px-3 py-1.5 text-right font-bold backdrop-blur transition-all"
                style={{ borderColor: color, boxShadow: `0 0 24px -8px ${color}` }}
              >
                <div className="flex items-center justify-end gap-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  <Gauge className="h-3 w-3" style={{ color }} /> Speed
                </div>
                <div className="font-display text-2xl tabular-nums leading-none" style={{ color }}>
                  {hud.speed}
                  <span className="ml-1 text-[10px] text-muted-foreground">km/h</span>
                </div>
                <div className="mt-1 h-1 w-32 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full transition-[width] duration-150"
                    style={{ width: `${frac * 100}%`, background: color }}
                  />
                </div>
              </div>
            );
          })()}
          <div
            className={`w-36 rounded-xl border bg-background/70 px-2 py-1.5 backdrop-blur transition-all ${hud.nitro < 0.99 ? "border-amber-400/60 shadow-[0_0_20px_-6px_rgba(251,191,36,0.7)]" : "border-amber-400/30"}`}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
              <Zap className="h-3 w-3" /> Nitro
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-gradient-to-r from-amber-300 to-orange-500 transition-[width] duration-150"
                style={{ width: `${Math.round(hud.nitro * 100)}%` }}
              />
            </div>
          </div>
          {(() => {
            const healthColor =
              hud.health > 60 ? "#22c55e" : hud.health > 30 ? "#facc15" : "#ef4444";
            return (
              <div
                className="w-36 rounded-xl border bg-background/70 px-2 py-1.5 text-xs font-bold backdrop-blur transition-all"
                style={{ borderColor: healthColor, boxShadow: `0 0 20px -8px ${healthColor}` }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    <HeartPulse className="h-3 w-3" style={{ color: healthColor }} /> Health
                  </span>
                  <span className="tabular-nums" style={{ color: healthColor }}>
                    {hud.health}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full transition-[width] duration-150"
                    style={{ width: `${hud.health}%`, background: healthColor }}
                  />
                </div>
              </div>
            );
          })()}
          <button
            type="button"
            onClick={toggleMute}
            className="pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-primary/30 bg-background/70 text-muted-foreground backdrop-blur transition hover:text-foreground"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>

        {/* Next-turn predictor */}
        {nextTurn.dir !== 0 && nextTurn.sharp > 0.1 && !result && !count && (
          <div className="pointer-events-none absolute bottom-20 right-3 flex items-center gap-2 rounded-xl border border-primary/30 bg-background/70 px-3 py-2 backdrop-blur">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Next
            </span>
            <span
              className="text-2xl leading-none"
              style={{
                color: `hsl(${(1 - nextTurn.sharp) * 120}, 90%, 60%)`,
                transform: `scale(${0.85 + nextTurn.sharp * 0.4})`,
                transition: "all 0.2s",
              }}
            >
              {nextTurn.dir < 0 ? "↰" : "↱"}
            </span>
          </div>
        )}

        {/* DANGER CORNER WARNING */}
        {warning && !result && !count && (
          <div className="pointer-events-none absolute inset-x-0 top-[18%] z-20 grid place-items-center animate-in fade-in zoom-in-95 duration-200">
            <div
              className="font-display select-none text-center"
              style={{
                fontSize: "clamp(3rem, 8vw, 6rem)",
                color: "#ef4444",
                letterSpacing: "0.06em",
                textShadow: "0 0 30px rgba(239,68,68,0.9), 0 4px 0 rgba(0,0,0,0.6)",
                animation: "warn-shake 0.18s ease-in-out infinite",
              }}
            >
              ⚠ SLOW DOWN!
            </div>
          </div>
        )}

        {/* SPINOUT label */}
        {spinning && !result && (
          <div className="pointer-events-none absolute inset-x-0 top-[44%] z-20 grid place-items-center">
            <div
              className="font-display select-none text-center"
              style={{
                fontSize: "clamp(2.4rem, 6vw, 4.5rem)",
                color: "#facc15",
                letterSpacing: "0.08em",
                textShadow: "0 0 30px rgba(250,204,21,0.9)",
              }}
            >
              SPIN OUT!
            </div>
          </div>
        )}

        {count && !result && (
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-background/40 backdrop-blur-[3px]">
            {/* echo rings */}
            <div
              key={count + "-ring"}
              className="absolute h-40 w-40 rounded-full border-2 border-primary/60 animate-ping"
            />
            <div
              key={count}
              className="select-none font-black leading-none animate-in zoom-in-50 duration-300"
              style={{
                fontSize: count === "GO" ? "10rem" : "13rem",
                color:
                  count === "3"
                    ? "#ef4444"
                    : count === "2"
                      ? "#f59e0b"
                      : count === "1"
                        ? "#22c55e"
                        : "#629ff8",
                textShadow: `0 0 80px ${count === "GO" ? "rgba(98,159,248,0.9)" : "rgba(255,255,255,0.5)"}, 0 0 30px currentColor`,
                letterSpacing: "-0.05em",
              }}
            >
              {count}
            </div>
            <div className="absolute bottom-[28%] flex gap-3 text-2xl opacity-70">
              <span className="text-primary-glow">△</span>
              <span className="text-rose-400">○</span>
              <span className="text-sky-400">✕</span>
              <span className="text-fuchsia-400">□</span>
            </div>
          </div>
        )}

        {result &&
          (() => {
            const medal = result.failed
              ? "💥"
              : result.rank === 1
                ? "🥇"
                : result.rank === 2
                  ? "🥈"
                  : result.rank === 3
                    ? "🥉"
                    : "🏁";
            const place = result.failed
              ? "DNF"
              : result.rank === 1
                ? "1ST PLACE"
                : result.rank === 2
                  ? "2ND PLACE"
                  : result.rank === 3
                    ? "3RD PLACE"
                    : `P${result.rank}`;
            const tone = result.failed
              ? "bg-red-500/90 text-white"
              : result.rank === 1
                ? "bg-gradient-coin text-amber-950"
                : result.rank === 2
                  ? "bg-gradient-cyan text-cyan-950"
                  : result.rank === 3
                    ? "bg-gradient-primary text-white"
                    : "bg-white/10 text-white";
            return (
              <div className="absolute inset-0 z-30 overflow-y-auto bg-background/85 px-3 py-10 backdrop-blur-md animate-fade-up overscroll-contain">
                <div className="pointer-events-none absolute inset-0 ps-grid-bg opacity-50" />
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-[80vmin] w-[80vmin] -translate-x-1/2 -translate-y-1/2 arcade-rays opacity-40" />
                <div className="pointer-events-none absolute -left-32 top-1/4 h-80 w-80 rounded-full bg-primary/40 blur-[120px]" />
                <div className="pointer-events-none absolute -right-32 bottom-1/4 h-80 w-80 rounded-full bg-secondary/40 blur-[120px]" />
                <Link
                  to="/"
                  className="sticky left-full top-3 z-40 ml-auto mb-3 flex h-10 w-fit items-center gap-2 rounded-lg border border-white/15 bg-background/90 px-4 text-xs font-black uppercase tracking-[0.14em] text-white shadow-button backdrop-blur transition hover:border-primary/70"
                >
                  Exit
                </Link>
                <div className="relative mx-auto w-[min(94%,520px)] arcade-card p-8 text-center animate-pop-in">
                  {/* Medal */}
                  <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2">
                    <div className="grid h-28 w-28 place-items-center rounded-full bg-gradient-coin text-6xl shadow-button animate-pop-in">
                      <span className="animate-wobble">{medal}</span>
                    </div>
                  </div>
                  <div className="mt-16 text-4xl font-extrabold leading-none sm:text-5xl">
                    <span className="text-gradient-title">{place}</span>
                  </div>
                  <div
                    className={`mt-3 inline-flex items-center gap-1.5 rounded-full ${tone} px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.2em] shadow-button`}
                  >
                    {result.failed ? "Car Destroyed" : "Race Finished"}
                  </div>

                  <div className="mt-6 grid grid-cols-3 items-end gap-2">
                    {[result.standings[1], result.standings[0], result.standings[2]].map(
                      (standing, index) => {
                        if (!standing) return <div key={index} />;
                        const podiumHeight =
                          standing.rank === 1 ? "h-24" : standing.rank === 2 ? "h-20" : "h-16";
                        return (
                          <div
                            key={standing.driverCode}
                            className="flex flex-col items-center gap-2"
                          >
                            <div
                              className={`w-full rounded-xl border ${standing.isPlayer ? "border-primary/80" : "border-white/10"} bg-white/[0.06] p-2`}
                            >
                              <div
                                className="mx-auto flex h-8 w-16 items-center justify-center rounded-full border border-white/20"
                                style={{ background: standing.colors[0] }}
                              >
                                <span className="text-[11px] font-black text-white">
                                  {standing.driverCode}
                                </span>
                              </div>
                              <div className="mt-1 truncate text-[10px] font-black uppercase text-white">
                                {standing.driverName}
                              </div>
                              <div className="truncate text-[9px] font-bold uppercase text-muted-foreground">
                                {standing.carName}
                              </div>
                            </div>
                            <div
                              className={`grid w-full place-items-center rounded-t-xl ${podiumHeight} border border-white/10 bg-gradient-to-t from-white/10 to-white/[0.22]`}
                            >
                              <span className="font-display text-2xl text-white">
                                P{standing.rank}
                              </span>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>

                  <div className="mt-6 grid grid-cols-3 gap-2">
                    <ResultStat
                      label="Time"
                      value={formatTime(result.time)}
                      tone="bg-white/[0.06]"
                      valueClass="text-white"
                    />
                    <ResultStat
                      label="Coins"
                      value={`+${result.reward}`}
                      tone={result.failed ? "bg-red-500/15" : "bg-gradient-coin"}
                      valueClass={result.failed ? "text-red-200" : "text-amber-950"}
                    />
                    <ResultStat
                      label="Best"
                      value={formatTime(
                        result.isNewBest ? result.time : (result.best ?? result.time),
                      )}
                      tone="bg-gradient-cyan"
                      valueClass="text-cyan-950"
                    />
                  </div>

                  <div className="mt-4 grid gap-1.5 text-left">
                    {result.standings.map((standing) => (
                      <div
                        key={`${standing.rank}-${standing.driverCode}`}
                        className={`grid grid-cols-[38px_1fr_auto] items-center gap-2 rounded-xl border px-3 py-2 text-xs ${standing.isPlayer ? "border-primary/70 bg-primary/10" : "border-white/10 bg-white/[0.04]"}`}
                      >
                        <span className="font-black text-white">P{standing.rank}</span>
                        <span className="min-w-0">
                          <span className="block truncate font-black text-white">
                            {standing.driverName}
                          </span>
                          <span className="block truncate text-[10px] font-bold uppercase text-muted-foreground">
                            {standing.teamName}
                          </span>
                        </span>
                        <span
                          className="rounded-full px-2 py-1 text-[10px] font-black text-white"
                          style={{ background: standing.colors[0] }}
                        >
                          {standing.carName}
                        </span>
                      </div>
                    ))}
                  </div>

                  {result.isNewBest && (
                    <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gradient-primary px-4 py-2 text-xs font-extrabold text-white shadow-button animate-pop-in">
                      🏆 NEW BEST TIME!
                    </div>
                  )}

                  <button
                    onClick={() => window.location.reload()}
                    className="arcade-btn mt-6 h-14 w-full text-base"
                  >
                    {result.failed ? "TRY AGAIN" : "CONTINUE"} <Trophy className="h-5 w-5" />
                  </button>
                  <div className="mt-2 flex justify-center gap-2">
                    <Link to="/quiz" className="arcade-btn arcade-btn-cyan h-10 px-5 text-xs">
                      Quiz
                    </Link>
                    <Link to="/" className="arcade-btn arcade-btn-ghost h-10 px-5 text-xs">
                      Exit
                    </Link>
                  </div>
                </div>
              </div>
            );
          })()}

        {!raceStarted && !result && !showHint && !count && (
          <button
            type="button"
            onClick={() => forceStartRef.current?.()}
            className="pointer-events-auto absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-primary/60 bg-background/85 px-6 py-4 font-display text-2xl text-primary-glow shadow-glow backdrop-blur"
          >
            START RACE
          </button>
        )}

        {/* First-run controls overlay */}
        {showHint && !result && (
          <div
            className="absolute inset-0 z-30 grid place-items-center bg-background/70 backdrop-blur-md animate-in fade-in duration-300"
            onClick={dismissHint}
          >
            <div className="w-[min(92%,440px)] rounded-3xl border border-primary/40 bg-card/85 p-6 text-center shadow-glow">
              <div className="ps-chip ps-chip-solid mx-auto">Controls</div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-left text-sm">
                <Kbd label="W / ↑" desc="Accelerate" />
                <Kbd label="S / ↓" desc="Brake / Reverse" />
                <Kbd label="A / ←" desc="Steer left" />
                <Kbd label="D / →" desc="Steer right" />
                <Kbd label="Space / Shift" desc="Nitro boost" />
                <Kbd label="E / Ctrl" desc="Hold to drift through turns" />
                <Kbd label="🎮 △○✕□" desc="Look for next-turn arrow" />
              </div>
              <button onClick={dismissHint} className="ps-pill mt-6">
                Start Racing
              </button>
              <div className="mt-2 text-[10px] text-muted-foreground">
                Click anywhere to dismiss
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card/50 px-4 py-3 text-xs text-muted-foreground backdrop-blur-md">
        <span className="font-bold text-foreground">Controls:</span> W/↑ accelerate · S/↓ brake ·
        A/D ←/→ steer · E/Ctrl drift · Space/Shift nitro
      </div>
    </section>
  );
}

function Kbd({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="flex items-center gap-2">
      <kbd className="inline-flex min-w-[68px] items-center justify-center rounded-md border border-primary/40 bg-background/80 px-2 py-1 text-[11px] font-bold text-primary-glow">
        {label}
      </kbd>
      <span className="text-muted-foreground">{desc}</span>
    </div>
  );
}

function ResultStat({
  label,
  value,
  tone,
  valueClass,
}: {
  label: string;
  value: string;
  tone: string;
  valueClass: string;
}) {
  return (
    <div className={`rounded-2xl ${tone} p-3 shadow-button`}>
      <div
        className={`text-[10px] font-extrabold uppercase tracking-[0.18em] opacity-70 ${valueClass}`}
      >
        {label}
      </div>
      <div className={`mt-0.5 text-lg font-extrabold tabular-nums ${valueClass}`}>{value}</div>
    </div>
  );
}
