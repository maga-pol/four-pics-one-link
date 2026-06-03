import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Flag, Gauge, Trophy, Zap, Volume2, VolumeX } from "lucide-react";
import { getTrack } from "@/lib/tracks";
import {
  startEngine, stopEngine, setEngine, playBeep, playNitroSwoosh,
  playCrash, playFanfare, playCountdownBeep, setMuted, isMuted,
} from "@/lib/audio";

export const Route = createFileRoute("/race/$trackId")({
  head: () => ({ meta: [{ title: "Race · World Quiz Race" }] }),
  component: RaceScreen,
});

const STORAGE = "wqr-state";
const BEST_KEY = "wqr-best-times";
const HINT_KEY = "wqr-controls-hint-seen";

function addCoins(delta: number) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE);
    const obj = raw ? JSON.parse(raw) : {};
    obj.coins = (obj.coins ?? 0) + delta;
    localStorage.setItem(STORAGE, JSON.stringify(obj));
  } catch {}
}
function readUpgrades() {
  if (typeof window === "undefined") return { speed: 1, acceleration: 1, nitro: 0, control: 0 };
  try {
    const raw = localStorage.getItem(STORAGE);
    const obj = raw ? JSON.parse(raw) : {};
    return obj.upgrades ?? { speed: 1, acceleration: 1, nitro: 0, control: 0 };
  } catch {
    return { speed: 1, acceleration: 1, nitro: 0, control: 0 };
  }
}
function readBestTime(trackId: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(BEST_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return typeof obj?.[trackId] === "number" ? obj[trackId] : null;
  } catch { return null; }
}
function writeBestTime(trackId: string, t: number) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(BEST_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    obj[trackId] = t;
    localStorage.setItem(BEST_KEY, JSON.stringify(obj));
  } catch {}
}

function RaceScreen() {
  const { trackId } = useParams({ from: "/race/$trackId" });
  const track = getTrack(trackId);

  if (!track) {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
        <div className="rounded-2xl border border-border bg-card/60 p-6 text-center backdrop-blur-md">
          <p className="font-bold">Track not found</p>
          <Link to="/" className="mt-3 inline-block text-primary underline">← Back to HUB</Link>
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
          <Link to="/" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-2.5 py-1 text-xs font-bold transition hover:border-primary/60">
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
  topT?: number;     // max track-progress per second for this car
  boostUntil?: number; // ms timestamp until +20% boost from pad
};

const WORLD_W = 8800;
const WORLD_H = 5200;
const TRACK_CX = WORLD_W / 2;
const TRACK_CY = WORLD_H / 2;
const TRACK_RX = 3280;
const TRACK_RY = 1840;
const ROAD_W = 200;     // 4 lanes (50 each)
const LANE_COUNT = 4;
const LANE_W = ROAD_W / LANE_COUNT;

function rawPoint(t: number) {
  // Cleaner oval/circuit with gentle sweeping bends — feels like a real arcade circuit.
  const a = ((t % 1) + 1) % 1 * Math.PI * 2;
  const rx = TRACK_RX + Math.sin(a * 2) * 160 + Math.cos(a * 3) * 60;
  const ry = TRACK_RY + Math.cos(a * 2) * 120 + Math.sin(a * 3) * 50;
  return { x: TRACK_CX + Math.cos(a) * rx, y: TRACK_CY + Math.sin(a) * ry };
}

function pathPoint(t: number) {
  const eps = 0.0015;
  const p = rawPoint(t);
  const p2 = rawPoint(t + eps);
  let dx = p2.x - p.x;
  let dy = p2.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;
  return { x: p.x, y: p.y, hx: dx, hy: dy };
}

function CircuitRace({ laps, trackId }: { laps: number; trackId: string }) {
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = (s - m * 60);
    return `${m}:${sec.toFixed(2).padStart(5, "0")}`;
  };
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const [hud, setHud] = useState({ speed: 0, lap: 1, pos: 1, total: 6, nitro: 1, elapsed: 0, lapProgress: 0 });
  const [count, setCount] = useState<string | null>("3");
  const [result, setResult] = useState<{ rank: number; reward: number; time: number; best: number | null; isNewBest: boolean } | null>(null);
  const [muted, setMutedState] = useState<boolean>(() => isMuted());
  const [showHint, setShowHint] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem(HINT_KEY);
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
    try { localStorage.setItem(HINT_KEY, "1"); } catch {}
  }

  useEffect(() => {
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
    // Upgrades give a real, noticeable boost on every stat
    const baseSpeed = 0.20 + up.speed * 0.035;          // ~+28 km/h per level
    const accel = 0.18 + up.acceleration * 0.08;        // snappier launch
    const grip = 0.55 + up.control * 0.15;              // sharper steering
    const nitroCap = 1 + up.nitro * 0.5;                // longer nitro tank
    const nitroBoost = 1.4 + up.nitro * 0.12;           // (kept for compat — unused; +15km/h is fixed)

    const AI_NAMES = ["Bolt", "Comet", "Hawk", "Viper", "Storm"];
    const AI_COLORS = ["#ef4444", "#f59e0b", "#10b981", "#8b5cf6", "#06b6d4"];

    const startP = pathPoint(0);
    const startAngle = Math.atan2(startP.hy, startP.hx);
    // ===== EQUAL START — all cars line up at the start line, spread across lanes =====
    // Player gets center lane; AI fills the other 5 of 6 grid slots, all at t=0.
    const gridLanes = [-0.75, -0.45, -0.15, 0.15, 0.45, 0.75];
    const playerLane = gridLanes[2]; // -0.15, just left of center
    const aiLanes = gridLanes.filter((_, i) => i !== 2);
    const startLatOff = (lane: number) => lane * (ROAD_W / 2 - 14);
    const playerOff = startLatOff(playerLane);
    const cars: Car[] = [
      {
        id: "p", name: "You", color: "#22d3ee", isPlayer: true,
        t: 0, lap: 0, speed: 0, lane: playerLane,
        x: startP.x + (-startP.hy) * playerOff,
        y: startP.y + (startP.hx) * playerOff,
        angle: startAngle,
      },
      ...AI_NAMES.map((n, i) => {
        const lane = aiLanes[i] ?? 0;
        const off = startLatOff(lane);
        return {
          id: "ai" + i, name: n, color: AI_COLORS[i], isPlayer: false,
          t: 0, lap: 0, speed: 0, lane,
          x: startP.x + (-startP.hy) * off,
          y: startP.y + (startP.hx) * off,
          angle: startAngle,
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
        if (d < bestD) { bestD = d; bestT = ((tt % 1) + 1) % 1; }
      }
      // fine refine
      for (let i = -8; i <= 8; i++) {
        const tt = bestT + (i / 8) * 0.005;
        const p = rawPoint(tt);
        const d = (p.x - px) * (p.x - px) + (p.y - py) * (p.y - py);
        if (d < bestD) { bestD = d; bestT = ((tt % 1) + 1) % 1; }
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

    // Decorations (trees, rocks, billboards, light poles) placed off-road, deterministic
    type Decor = { x: number; y: number; kind: "tree" | "rock" | "flag" | "billboard" | "pole"; size: number; angle?: number };
    const decor: Decor[] = [];
    {
      let seed = 1337;
      const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
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
        const kind = rnd() > 0.25 ? "tree" : "rock";
        tryAdd(x, y, kind, 18 + rnd() * 26);
      }
      // Inside the ring (infield)
      for (let i = 0; i < 300; i++) {
        const a = rnd() * Math.PI * 2;
        const r = rnd() * (TRACK_RX - ROAD_W - 100);
        const x = TRACK_CX + Math.cos(a) * r;
        const y = TRACK_CY + Math.sin(a) * r * (TRACK_RY / TRACK_RX);
        const kind = rnd() > 0.4 ? "tree" : "rock";
        tryAdd(x, y, kind, 18 + rnd() * 26);
      }
      // Light poles every ~5% along both edges
      for (let i = 0; i < 40; i++) {
        const t = i / 40;
        const p = pathPoint(t);
        const side = i % 2 === 0 ? 1 : -1;
        const off = (ROAD_W / 2 + 36) * side;
        decor.push({
          x: p.x + (-p.hy) * off,
          y: p.y + (p.hx) * off,
          kind: "pole", size: 30, angle: Math.atan2(p.hy, p.hx),
        });
      }
      // Billboards on the straights
      for (let i = 0; i < 8; i++) {
        const t = (i + 0.5) / 8;
        const p = pathPoint(t);
        const side = i % 2 === 0 ? 1 : -1;
        const off = (ROAD_W / 2 + 90) * side;
        decor.push({
          x: p.x + (-p.hy) * off,
          y: p.y + (p.hx) * off,
          kind: "billboard", size: 70, angle: Math.atan2(p.hy, p.hx),
        });
      }
      // Festive flags between poles
      for (let i = 0; i < 60; i++) {
        if (i % 2 === 0) continue;
        const t = i / 60;
        const p = pathPoint(t);
        const side = i % 2 === 0 ? 1 : -1;
        const off = (ROAD_W / 2 + 22) * side;
        decor.push({ x: p.x + (-p.hy) * off, y: p.y + (p.hx) * off, kind: "flag", size: 18 });
      }
    }

    // ===== Track features: boost pads + ramps =====
    type Feature = { t: number; lane: number; kind: "boost" | "ramp" };
    const features: Feature[] = [
      { t: 0.08, lane:  0.5, kind: "boost" },
      { t: 0.22, lane: -0.4, kind: "ramp"  },
      { t: 0.38, lane:  0.0, kind: "boost" },
      { t: 0.55, lane:  0.6, kind: "ramp"  },
      { t: 0.68, lane: -0.5, kind: "boost" },
      { t: 0.84, lane:  0.3, kind: "boost" },
    ];
    const featurePos = features.map((f) => {
      const p = pathPoint(f.t);
      const off = f.lane * (ROAD_W / 2 - 14);
      return { ...f, x: p.x + (-p.hy) * off, y: p.y + (p.hx) * off, angle: Math.atan2(p.hy, p.hx) };
    });
    let boostUntil = 0;     // ms timestamp until extra boost from pad
    let airUntil = 0;       // ms timestamp until ramp jump lands

    // ===== DANGER CORNERS — hairpins with tighter radius. Spinout if entered >60% max speed =====
    const DANGER_CORNERS = [0.30, 0.55, 0.80];
    const SPIN_THRESHOLD = 0.60;
    const CORNER_HIT_RADIUS = 0.012;     // t-distance for "in the corner"
    const CORNER_WARN_AHEAD = 0.06;      // start warning ~1-2s ahead
    const dangerPos = DANGER_CORNERS.map((t) => {
      const p = pathPoint(t);
      return { t, x: p.x, y: p.y, hx: p.hx, hy: p.hy };
    });
    const cornerHit = new Set<number>(); // indices currently "in" a corner
    let spinUntil = 0;
    let spinAngVel = 0;
    let lastWarnState = false;

    // ===== Particle system (sparks, nitro trail, dust) =====
    type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string };
    const particles: Particle[] = [];
    function spawnParticle(x: number, y: number, vx: number, vy: number, color: string, life = 0.5, size = 3) {
      if (particles.length > 220) particles.shift();
      particles.push({ x, y, vx, vy, life, max: life, size, color });
    }

    // Countdown
    const COUNTDOWN_MS = 3500; // 3, 2, 1, GO
    let countdownDone = false;

    let nitro = nitroCap;
    let last = performance.now();
    const startedAt = performance.now();
    let raf = 0;
    let running = true;
    let finished = false;

    function onKey(e: KeyboardEvent, down: boolean) {
      // Map both e.key (for arrow keys / shift / space) AND e.code (so Russian/other layouts still work for WASD)
      const k = e.key.toLowerCase();
      const codeMap: Record<string, string> = {
        KeyW: "w", KeyA: "a", KeyS: "s", KeyD: "d",
        ArrowUp: "arrowup", ArrowDown: "arrowdown", ArrowLeft: "arrowleft", ArrowRight: "arrowright",
        Space: " ", ShiftLeft: "shift", ShiftRight: "shift",
      };
      const mapped = codeMap[e.code] ?? k;
      if (["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"," ","shift"].includes(mapped)) {
        e.preventDefault();
      }
      keysRef.current[mapped] = down;
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

    // Camera shake
    let shake = 0;
    let prevBoosting = false;
    let lastCountdownBeep = -1;

    function tick(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const k = keysRef.current;
      const player = cars[0];

      const sinceStart = now - startedAt;
      const racing = sinceStart >= COUNTDOWN_MS;
      if (!racing) {
        const remain = COUNTDOWN_MS - sinceStart;
        let idx = 3;
        if (remain > 2500) { setCount("3"); idx = 3; }
        else if (remain > 1500) { setCount("2"); idx = 2; }
        else if (remain > 500) { setCount("1"); idx = 1; }
        else { setCount("GO"); idx = 0; }
        if (idx !== lastCountdownBeep) {
          lastCountdownBeep = idx;
          playCountdownBeep(idx === 0);
        }
        // freeze cars
        player.speed = 0;
        for (let i = 1; i < cars.length; i++) cars[i].speed = 0;
        draw(now);
        raf = requestAnimationFrame(tick);
        return;
      } else if (!countdownDone) {
        countdownDone = true;
        setCount(null);
      }

      const accelKey = k["w"] || k["arrowup"];
      const brakeKey = k["s"] || k["arrowdown"];
      const left = k["a"] || k["arrowleft"];
      const right = k["d"] || k["arrowright"];
      const boosting = (k[" "] || k["shift"]) && nitro > 0.02;

      // ===== SPINOUT — overrides controls =====
      const isSpinning = spinUntil > now;

      // Free-driving physics — nitro adds exactly +15 km/h on top of max
      const NITRO_KMH = 15 / 800; // HUD km/h = speed * 800
      const maxSpeed = baseSpeed * 1.4 + (boosting ? NITRO_KMH : 0);
      if (!isSpinning) {
        if (accelKey) player.speed += accel * 0.8 * dt;
        if (brakeKey) player.speed -= accel * 1.6 * dt;
        if (!accelKey && !brakeKey) player.speed -= player.speed * 0.5 * dt;
      } else {
        player.speed *= Math.pow(0.25, dt); // hard slow during spin
      }
      if (player.speed > maxSpeed) player.speed = maxSpeed;
      if (player.speed < -baseSpeed * 0.4) player.speed = -baseSpeed * 0.4;

      if (boosting && accelKey) nitro = Math.max(0, nitro - dt * 0.5);
      else nitro = Math.min(nitroCap, nitro + dt * 0.15);

      if (isSpinning) {
        player.angle += spinAngVel * dt;
        spinAngVel *= Math.pow(0.35, dt);
      } else {
        const steer = (right ? 1 : 0) - (left ? 1 : 0);
        const steerStrength = (1.6 + grip * 0.3) * Math.min(1, Math.abs(player.speed) * 6);
        player.angle += steer * steerStrength * dt * (player.speed >= 0 ? 1 : -1);
      }

      const moveScale = 1200;
      player.x += Math.cos(player.angle) * player.speed * moveScale * dt;
      player.y += Math.sin(player.angle) * player.speed * moveScale * dt;

      // ===== DANGER CORNER detection + spin trigger =====
      const speedFracNow = Math.abs(player.speed) / Math.max(0.001, baseSpeed * 1.4);
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
              playCrash();
              // Skid marks — burst of dark tire smudges
              for (let s = 0; s < 24; s++) {
                spawnParticle(
                  player.x + (Math.random() - 0.5) * 36,
                  player.y + (Math.random() - 0.5) * 36,
                  (Math.random() - 0.5) * 260,
                  (Math.random() - 0.5) * 260,
                  s % 2 ? "rgba(40,40,40,0.9)" : "rgba(120,120,120,0.8)",
                  0.9, 5
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
        const ahead = ((dc.t - player.t + 1) % 1);
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
      const steeringInput = (right ? 1 : 0) - (left ? 1 : 0);
      drifting = !!steeringInput && speedFrac > 0.55;
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

      // ===== Car-vs-car collisions disabled =====
      // Each car runs in its own fixed lane; faster cars cleanly pass through
      // slower ones without any rigid-body push.

      // ===== Track feature interactions =====
      for (const f of featurePos) {
        const dx = player.x - f.x, dy = player.y - f.y;
        if (dx * dx + dy * dy < 38 * 38) {
          if (f.kind === "boost" && boostUntil < now) {
            boostUntil = now + 900;
            playNitroSwoosh();
            shake = Math.max(shake, 4);
          } else if (f.kind === "ramp" && airUntil < now) {
            airUntil = now + 750;
            shake = Math.max(shake, 6);
          }
        }
      }
      if (boostUntil > now) {
        player.speed = Math.min(maxSpeed * 1.35, player.speed + accel * 1.6 * dt);
      }

      // ===== Spawn nitro / speed particles =====
      if ((boosting || boostUntil > now) && Math.abs(player.speed) > 0.05) {
        for (let s = 0; s < 3; s++) {
          const back = -player.angle;
          const bx = player.x - Math.cos(player.angle) * 22 + (Math.random() - 0.5) * 10;
          const by = player.y - Math.sin(player.angle) * 22 + (Math.random() - 0.5) * 10;
          spawnParticle(
            bx, by,
            -Math.cos(player.angle) * 180 + (Math.random() - 0.5) * 120,
            -Math.sin(player.angle) * 180 + (Math.random() - 0.5) * 120,
            s % 2 ? "#22d3ee" : "#f472b6",
            0.45, 5
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
          "rgba(255,255,255,0.6)", 0.35, 2.5
        );
      }
      // Step particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= 0.92; p.vy *= 0.92;
      }

      // ===== Camera shake triggers =====
      if (boosting && !prevBoosting) { shake = Math.max(shake, 5); playNitroSwoosh(); }
      prevBoosting = boosting;
      shake *= Math.pow(0.001, dt); // decay fast

      // ===== Engine audio =====
      setEngine(speedFrac, boosting);

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
      const offRoad = proj.dist > ROAD_W / 2;
      if (offRoad) player.speed *= Math.pow(0.15, dt); // grass slows

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
        // Equal AI baseline — no per-index advantage. Player upgrades give the edge.
        const desired = AI_TOP_T * 0.94;
        c.speed += Math.max(-accel * dt, Math.min(accel * dt, desired - c.speed));
        // Lane is fixed at spawn — no wandering, no overlap with other cars.
        c.t += c.speed * dt;
        if (c.t >= 1) {
          c.t -= 1;
          c.lap += 1;
          if (c.lap >= laps && !c.finishedAt) c.finishedAt = now;
        }
        const pp = pathPoint(c.t);
        const aoff = c.lane * (ROAD_W / 2 - 14);
        c.x = pp.x + (-pp.hy) * aoff;
        c.y = pp.y + (pp.hx) * aoff;
        c.angle = Math.atan2(pp.hy, pp.hx);
      }

      draw(now);

      const ranked = [...cars].sort((a, b) => (b.lap + b.t) - (a.lap + a.t));
      const pos = ranked.findIndex((c) => c.isPlayer) + 1;

      setHud({
        speed: Math.round(player.speed * 800),
        lap: Math.min(laps, player.lap + 1),
        pos,
        total: cars.length,
        nitro: nitro / nitroCap,
        elapsed: Math.max(0, ((player.finishedAt ?? now) - startedAt - COUNTDOWN_MS) / 1000),
        lapProgress: player.lap >= laps ? 1 : player.t,
      });

      if (player.finishedAt && !finished) {
        finished = true;
        const rewards = [300, 220, 160, 110, 70, 40];
        const reward = rewards[pos - 1] ?? 30;
        addCoins(reward);
        const t = ((player.finishedAt - startedAt) - COUNTDOWN_MS) / 1000;
        const prevBest = readBestTime(trackId);
        const isNewBest = prevBest === null || t < prevBest;
        if (isNewBest) writeBestTime(trackId, t);
        playFanfare();
        stopEngine();
        setResult({ rank: pos, reward, time: t, best: prevBest, isNewBest });
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

      // Grass background
      ctx.fillStyle = "#14532d";
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);

      // Build path once
      const PN = 720;
      ctx.beginPath();
      for (let i = 0; i <= PN; i++) {
        const p = pathPoint(i / PN);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();

      // Road shoulder
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#1a1a22";
      ctx.lineWidth = ROAD_W + 10;
      ctx.stroke();
      // Road
      ctx.strokeStyle = "#2a2a35";
      ctx.lineWidth = ROAD_W;
      ctx.stroke();

      // Bright guardrails (outer glow + inner kerb)
      drawGuardrail(ROAD_W / 2 + 14);
      drawGuardrail(-ROAD_W / 2 - 14);
      drawKerb(ROAD_W / 2);
      drawKerb(-ROAD_W / 2);

      // Lane dividers (3 dashed lines for 4 lanes)
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([18, 18]);
      for (let l = 1; l < LANE_COUNT; l++) {
        const off = -ROAD_W / 2 + l * LANE_W;
        ctx.beginPath();
        const N = 360;
        for (let i = 0; i <= N; i++) {
          const p = pathPoint(i / N);
          const x = p.x + (-p.hy) * off;
          const y = p.y + (p.hx) * off;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Start/finish checkered line
      drawStartLine();

      // Track features (under cars)
      for (const f of featurePos) drawFeature(f, now);

      // Danger corner warning signs (yellow/red triangles before each hairpin)
      for (const dc of dangerPos) {
        const before = pathPoint((dc.t - 0.022 + 1) % 1);
        const side = ((dc.t * 7) % 1) > 0.5 ? 1 : -1;
        const off = (ROAD_W / 2 + 28) * side;
        const sx = before.x + (-before.hy) * off;
        const sy = before.y + (before.hx) * off;
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

      // Cars (sorted so leader on top)
      const sorted = [...cars].sort((a, b) => (a.lap + a.t) - (b.lap + b.t));
      for (const c of sorted) drawCar(c, now);

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

    function drawMiniMap(cssW: number, cssH: number) {
      const mw = 150, mh = 90;
      const pad = 12;
      const x0 = pad, y0 = cssH - mh - pad;
      // bg
      ctx.save();
      ctx.fillStyle = "rgba(8,18,32,0.78)";
      roundRectAbs(x0, y0, mw, mh, 10); ctx.fill();
      ctx.strokeStyle = "rgba(98,159,248,0.45)";
      ctx.lineWidth = 1;
      roundRectAbs(x0, y0, mw, mh, 10); ctx.stroke();

      // map world bounds to mini-map
      const margin = 10;
      const ww = mw - margin * 2, hh = mh - margin * 2;
      const sx = ww / WORLD_W, sy = hh / WORLD_H;
      const s = Math.min(sx, sy);
      const ox = x0 + margin + (mw - margin * 2 - WORLD_W * s) / 2;
      const oy = y0 + margin + (mh - margin * 2 - WORLD_H * s) / 2;

      // track outline
      ctx.strokeStyle = "rgba(180,210,255,0.55)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const NM = 120;
      for (let i = 0; i <= NM; i++) {
        const p = rawPoint(i / NM);
        const X = ox + p.x * s, Y = oy + p.y * s;
        if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      }
      ctx.closePath();
      ctx.stroke();

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
      for (const dc of dangerPos) {
        const p = rawPoint(dc.t);
        const X = ox + p.x * s, Y = oy + p.y * s;
        ctx.fillStyle = "#facc15";
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(X, Y - 4);
        ctx.lineTo(X + 3.5, Y + 2.5);
        ctx.lineTo(X - 3.5, Y + 2.5);
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
        const x = p.x + (-p.hy) * offset;
        const y = p.y + (p.hx) * offset;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      // bright inner rail
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 5;
      ctx.stroke();
    }

    function drawKerb(offset: number) {
      const steps = 600;
      ctx.lineWidth = 6;
      for (let i = 0; i < steps; i++) {
        const t0 = i / steps;
        const t1 = (i + 1) / steps;
        const p0 = pathPoint(t0);
        const p1 = pathPoint(t1);
        const ax = p0.x + (-p0.hy) * offset;
        const ay = p0.y + (p0.hx) * offset;
        const bx = p1.x + (-p1.hy) * offset;
        const by = p1.y + (p1.hx) * offset;
        ctx.strokeStyle = i % 2 === 0 ? "#fafafa" : "#dc2626";
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }
    }

    function drawFeature(f: { x: number; y: number; angle: number; kind: "boost" | "ramp" }, now: number) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.angle);
      if (f.kind === "boost") {
        const pulse = 0.6 + 0.4 * Math.sin(now / 120);
        // glow
        ctx.fillStyle = `rgba(34,211,238,${0.25 * pulse})`;
        ctx.beginPath(); ctx.ellipse(0, 0, 44, 22, 0, 0, Math.PI * 2); ctx.fill();
        // pad
        const grad = ctx.createLinearGradient(-30, 0, 30, 0);
        grad.addColorStop(0, "#22d3ee");
        grad.addColorStop(0.5, "#ffffff");
        grad.addColorStop(1, "#22d3ee");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-30, -16, 60, 32, 6) : (() => {
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
        ctx.beginPath(); ctx.ellipse(0, 6, 40, 10, 0, 0, Math.PI * 2); ctx.fill();
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
        ctx.beginPath(); ctx.ellipse(2, 4, d.size * 0.9, d.size * 0.45, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#5b3a1e";
        ctx.fillRect(-d.size * 0.12, -d.size * 0.1, d.size * 0.24, d.size * 0.5);
        ctx.fillStyle = "#166534";
        ctx.beginPath(); ctx.arc(0, -d.size * 0.2, d.size * 0.7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#22c55e";
        ctx.beginPath(); ctx.arc(-d.size * 0.25, -d.size * 0.35, d.size * 0.4, 0, Math.PI * 2); ctx.fill();
      } else if (d.kind === "rock") {
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath(); ctx.ellipse(2, 3, d.size * 0.7, d.size * 0.35, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#6b7280";
        ctx.beginPath(); ctx.arc(0, 0, d.size * 0.55, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#9ca3af";
        ctx.beginPath(); ctx.arc(-d.size * 0.15, -d.size * 0.15, d.size * 0.25, 0, Math.PI * 2); ctx.fill();
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
      } else if (d.kind === "pole") {
        // light pole — vertical post + warm bulb
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath(); ctx.ellipse(3, 4, d.size * 0.35, d.size * 0.14, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#cbd5e1";
        ctx.fillRect(-1.5, -d.size, 3, d.size);
        ctx.fillStyle = "#fde047";
        ctx.beginPath(); ctx.arc(0, -d.size, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(253,224,71,0.35)";
        ctx.beginPath(); ctx.arc(0, -d.size, 10, 0, Math.PI * 2); ctx.fill();
      } else if (d.kind === "billboard") {
        ctx.save();
        if (d.angle !== undefined) ctx.rotate(d.angle);
        // shadow
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath(); ctx.ellipse(3, 6, d.size * 0.6, d.size * 0.18, 0, 0, Math.PI * 2); ctx.fill();
        // legs
        ctx.fillStyle = "#475569";
        ctx.fillRect(-d.size * 0.5, 0, 4, d.size * 0.45);
        ctx.fillRect( d.size * 0.5 - 4, 0, 4, d.size * 0.45);
        // panel
        const w = d.size * 1.1, h = d.size * 0.55;
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(-w / 2 - 2, -h - 4, w + 4, h + 6);
        const grad = ctx.createLinearGradient(-w / 2, -h, w / 2, 0);
        grad.addColorStop(0, "#22d3ee");
        grad.addColorStop(0.5, "#a855f7");
        grad.addColorStop(1, "#ec4899");
        ctx.fillStyle = grad;
        ctx.fillRect(-w / 2, -h, w, h);
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("RACE!", 0, -h / 2);
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

    function drawCar(c: Car, now: number) {
      ctx.save();
      ctx.translate(c.x, c.y);
      // ramp jump bounce — scale up briefly while airborne
      const jump = c.isPlayer && airUntil > now ? Math.sin(((airUntil - now) / 750) * Math.PI) : 0;
      const s = 1 + jump * 0.35;
      ctx.rotate(c.angle);
      ctx.scale(s, s);

      // shadow (stays lower while jumping)
      ctx.fillStyle = `rgba(0,0,0,${0.35 - jump * 0.2})`;
      roundRect(-22 + jump * 8, -13 + jump * 6, 46, 28, 6); ctx.fill();

      ctx.fillStyle = c.color;
      roundRect(-20, -12, 42, 24, 5); ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.85)";
      roundRect(-4, -8, 14, 16, 3); ctx.fill();

      ctx.strokeStyle = c.isPlayer ? "#fff" : "rgba(0,0,0,0.5)";
      ctx.lineWidth = c.isPlayer ? 2.5 : 1.5;
      roundRect(-20, -12, 42, 24, 5); ctx.stroke();

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
              <span className="ps-chip ps-chip-solid" style={{ padding: "2px 8px", fontSize: 9 }}>LAP {hud.lap}/{laps}</span>
              <span className="tabular-nums text-muted-foreground">{Math.round(hud.lapProgress * 100)}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-gradient-to-r from-primary-glow to-primary transition-[width] duration-150" style={{ width: `${Math.round(hud.lapProgress * 100)}%` }} />
            </div>
          </div>
          <div className="rounded-xl border border-primary/30 bg-background/70 px-3 py-1.5 text-xs font-bold backdrop-blur tabular-nums">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Time</span>
            <div className="text-foreground">{formatTime(hud.elapsed)}</div>
            {bestTime !== null && (
              <div className="text-[10px] text-primary-glow">Best {formatTime(bestTime)}</div>
            )}
          </div>
          <div className="rounded-xl border border-primary/30 bg-background/70 px-3 py-1.5 text-xs font-bold backdrop-blur">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Position</span>
            <div className="text-foreground">P{hud.pos}<span className="text-muted-foreground">/{hud.total}</span></div>
          </div>
        </div>

        <div className="pointer-events-none absolute right-3 top-3 flex flex-col items-end gap-2">
          {(() => {
            const frac = Math.min(1, hud.speed / 90);
            const color = frac < 0.5 ? "#22c55e" : frac < 0.7 ? "#facc15" : "#ef4444";
            return (
              <div className="rounded-xl border bg-background/70 px-3 py-1.5 text-right font-bold backdrop-blur transition-all"
                   style={{ borderColor: color, boxShadow: `0 0 24px -8px ${color}` }}>
                <div className="flex items-center justify-end gap-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  <Gauge className="h-3 w-3" style={{ color }} /> Speed
                </div>
                <div className="font-display text-2xl tabular-nums leading-none" style={{ color }}>
                  {hud.speed}<span className="ml-1 text-[10px] text-muted-foreground">km/h</span>
                </div>
                <div className="mt-1 h-1 w-32 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full transition-[width] duration-150" style={{ width: `${frac * 100}%`, background: color }} />
                </div>
              </div>
            );
          })()}
          <div className={`w-36 rounded-xl border bg-background/70 px-2 py-1.5 backdrop-blur transition-all ${hud.nitro < 0.99 ? "border-amber-400/60 shadow-[0_0_20px_-6px_rgba(251,191,36,0.7)]" : "border-amber-400/30"}`}>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
              <Zap className="h-3 w-3" /> Nitro
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-gradient-to-r from-amber-300 to-orange-500 transition-[width] duration-150" style={{ width: `${Math.round(hud.nitro * 100)}%` }} />
            </div>
          </div>
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
          <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-2 rounded-xl border border-primary/30 bg-background/70 px-3 py-2 backdrop-blur">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Next</span>
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
            <div className="font-display select-none text-center"
                 style={{
                   fontSize: "clamp(3rem, 8vw, 6rem)",
                   color: "#ef4444",
                   letterSpacing: "0.06em",
                   textShadow: "0 0 30px rgba(239,68,68,0.9), 0 4px 0 rgba(0,0,0,0.6)",
                   animation: "warn-shake 0.18s ease-in-out infinite",
                 }}>
              ⚠ SLOW DOWN!
            </div>
          </div>
        )}

        {/* SPINOUT label */}
        {spinning && !result && (
          <div className="pointer-events-none absolute inset-x-0 top-[44%] z-20 grid place-items-center">
            <div className="font-display select-none text-center"
                 style={{
                   fontSize: "clamp(2.4rem, 6vw, 4.5rem)",
                   color: "#facc15",
                   letterSpacing: "0.08em",
                   textShadow: "0 0 30px rgba(250,204,21,0.9)",
                 }}>
              SPIN OUT!
            </div>
          </div>
        )}

        {count && !result && (
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-background/40 backdrop-blur-[3px]">
            {/* echo rings */}
            <div key={count + "-ring"} className="absolute h-40 w-40 rounded-full border-2 border-primary/60 animate-ping" />
            <div
              key={count}
              className="select-none font-black leading-none animate-in zoom-in-50 duration-300"
              style={{
                fontSize: count === "GO" ? "10rem" : "13rem",
                color: count === "3" ? "#ef4444" : count === "2" ? "#f59e0b" : count === "1" ? "#22c55e" : "#629ff8",
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

        {result && (() => {
          const medal = result.rank === 1 ? "🥇" : result.rank === 2 ? "🥈" : result.rank === 3 ? "🥉" : "🏁";
          const place = result.rank === 1 ? "1ST PLACE" : result.rank === 2 ? "2ND PLACE" : result.rank === 3 ? "3RD PLACE" : `P${result.rank}`;
          const tone = result.rank === 1 ? "bg-gradient-coin text-amber-950" : result.rank === 2 ? "bg-gradient-cyan text-cyan-950" : result.rank === 3 ? "bg-gradient-primary text-white" : "bg-white/10 text-white";
          return (
            <div className="absolute inset-0 z-30 grid place-items-center overflow-hidden bg-background/85 backdrop-blur-md animate-fade-up">
              <div className="pointer-events-none absolute inset-0 ps-grid-bg opacity-50" />
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-[80vmin] w-[80vmin] -translate-x-1/2 -translate-y-1/2 arcade-rays opacity-40" />
              <div className="pointer-events-none absolute -left-32 top-1/4 h-80 w-80 rounded-full bg-primary/40 blur-[120px]" />
              <div className="pointer-events-none absolute -right-32 bottom-1/4 h-80 w-80 rounded-full bg-secondary/40 blur-[120px]" />
              <div className="relative w-[min(94%,520px)] arcade-card p-8 text-center animate-pop-in">
                {/* Medal */}
                <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2">
                  <div className="grid h-28 w-28 place-items-center rounded-full bg-gradient-coin text-6xl shadow-button animate-pop-in">
                    <span className="animate-wobble">{medal}</span>
                  </div>
                </div>
                <div className="mt-16 text-4xl font-extrabold leading-none sm:text-5xl">
                  <span className="text-gradient-title">{place}</span>
                </div>
                <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full ${tone} px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.2em] shadow-button`}>
                  Race Finished
                </div>

                <div className="mt-6 grid grid-cols-3 gap-2">
                  <ResultStat label="Time"   value={formatTime(result.time)} tone="bg-white/[0.06]" valueClass="text-white" />
                  <ResultStat label="Coins"  value={`+${result.reward}`}      tone="bg-gradient-coin" valueClass="text-amber-950" />
                  <ResultStat label="Best"   value={formatTime(result.isNewBest ? result.time : (result.best ?? result.time))} tone="bg-gradient-cyan" valueClass="text-cyan-950" />
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
                  CONTINUE <Trophy className="h-5 w-5" />
                </button>
                <div className="mt-2 flex justify-center gap-2">
                  <Link to="/quiz" className="arcade-btn arcade-btn-cyan h-10 px-5 text-xs">Quiz</Link>
                  <Link to="/" className="arcade-btn arcade-btn-ghost h-10 px-5 text-xs">HUB</Link>
                </div>
              </div>
            </div>
          );
        })()}

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
                <Kbd label="Space / Shift" desc="Nitro boost (+15 km/h)" />
                <Kbd label="🎮 △○✕□" desc="Look for next-turn arrow" />
              </div>
              <button onClick={dismissHint} className="ps-pill mt-6">Start Racing</button>
              <div className="mt-2 text-[10px] text-muted-foreground">Click anywhere to dismiss</div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card/50 px-4 py-3 text-xs text-muted-foreground backdrop-blur-md">
        <span className="font-bold text-foreground">Controls:</span> W/↑ accelerate · S/↓ brake · A/D ←/→ steer · Space/Shift nitro
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

function ResultStat({ label, value, tone, valueClass }: { label: string; value: string; tone: string; valueClass: string }) {
  return (
    <div className={`rounded-2xl ${tone} p-3 shadow-button`}>
      <div className={`text-[10px] font-extrabold uppercase tracking-[0.18em] opacity-70 ${valueClass}`}>{label}</div>
      <div className={`mt-0.5 text-lg font-extrabold tabular-nums ${valueClass}`}>{value}</div>
    </div>
  );
}
