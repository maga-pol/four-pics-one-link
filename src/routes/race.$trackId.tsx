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
};

const WORLD_W = 8800;
const WORLD_H = 5200;
const TRACK_CX = WORLD_W / 2;
const TRACK_CY = WORLD_H / 2;
const TRACK_RX = 3280;
const TRACK_RY = 1840;
const ROAD_W = 120;

function rawPoint(t: number) {
  const a = ((t % 1) + 1) % 1 * Math.PI * 2;
  const rx = TRACK_RX + Math.sin(a * 3) * 140 + Math.cos(a * 2) * 70 + Math.sin(a * 5) * 40;
  const ry = TRACK_RY + Math.cos(a * 3) * 120 + Math.sin(a * 5) * 50 + Math.cos(a * 7) * 30;
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

function CircuitRace({ laps }: { laps: number }) {
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
  const [result, setResult] = useState<{ rank: number; reward: number } | null>(null);

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
    const cars: Car[] = [
      {
        id: "p", name: "You", color: "#22d3ee", isPlayer: true,
        t: 0, lap: 0, speed: 0, lane: 0,
        x: startP.x, y: startP.y, angle: startAngle,
      },
      ...AI_NAMES.map((n, i) => {
        const sp = pathPoint(-0.004 * (i + 1));
        return {
          id: "ai" + i, name: n, color: AI_COLORS[i], isPlayer: false,
          t: -0.004 * (i + 1), lap: 0, speed: 0, lane: -0.6 + i * 0.3,
          x: sp.x, y: sp.y, angle: Math.atan2(sp.hy, sp.hx),
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

    // Decorations (trees, rocks) placed off-road, deterministic
    type Decor = { x: number; y: number; kind: "tree" | "rock" | "flag"; size: number };
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
      // Flags along edges of the road for festive feel
      for (let i = 0; i < 60; i++) {
        const t = i / 60;
        const p = pathPoint(t);
        const side = i % 2 === 0 ? 1 : -1;
        const off = (ROAD_W / 2 + 28) * side;
        const x = p.x + (-p.hy) * off;
        const y = p.y + (p.hx) * off;
        decor.push({ x, y, kind: "flag", size: 22 });
      }
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
      const k = e.key.toLowerCase();
      if (["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"," ","shift"].includes(k)) {
        e.preventDefault();
      }
      keysRef.current[k] = down;
    }
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);

    function tick(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const k = keysRef.current;
      const player = cars[0];

      const sinceStart = now - startedAt;
      const racing = sinceStart >= COUNTDOWN_MS;
      if (!racing) {
        const remain = COUNTDOWN_MS - sinceStart;
        if (remain > 2500) setCount("3");
        else if (remain > 1500) setCount("2");
        else if (remain > 500) setCount("1");
        else setCount("GO");
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

      // Free-driving physics — nitro adds exactly +15 km/h on top of max
      const NITRO_KMH = 15 / 800; // HUD km/h = speed * 800
      const maxSpeed = baseSpeed * 1.4 + (boosting ? NITRO_KMH : 0);
      if (accelKey) player.speed += accel * 0.8 * dt;
      if (brakeKey) player.speed -= accel * 1.6 * dt;
      if (!accelKey && !brakeKey) player.speed -= player.speed * 0.5 * dt;
      if (player.speed > maxSpeed) player.speed = maxSpeed;
      if (player.speed < -baseSpeed * 0.4) player.speed = -baseSpeed * 0.4;

      if (boosting && accelKey) nitro = Math.max(0, nitro - dt * 0.5);
      else nitro = Math.min(nitroCap, nitro + dt * 0.15);

      const steer = (right ? 1 : 0) - (left ? 1 : 0);
      const steerStrength = (1.6 + grip * 0.3) * Math.min(1, Math.abs(player.speed) * 6);
      player.angle += steer * steerStrength * dt * (player.speed >= 0 ? 1 : -1);

      const moveScale = 1200;
      player.x += Math.cos(player.angle) * player.speed * moveScale * dt;
      player.y += Math.sin(player.angle) * player.speed * moveScale * dt;

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
        const desired = AI_TOP_T * (0.92 + i * 0.025);
        c.speed += Math.max(-accel * dt, Math.min(accel * dt, desired - c.speed));
        c.lane += Math.sin(now / 600 + i) * dt * 0.2;
        c.lane = Math.max(-0.8, Math.min(0.8, c.lane));
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
        setResult({ rank: pos, reward });
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

      ctx.save();
      ctx.translate(cssW / 2, cssH * 0.72);
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

      // Kerbs (outer + inner)
      drawKerb(ROAD_W / 2);
      drawKerb(-ROAD_W / 2);

      // Centerline
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 3;
      ctx.setLineDash([18, 18]);
      ctx.beginPath();
      const N = 480;
      for (let i = 0; i <= N; i++) {
        const p = pathPoint(i / N);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);

      // Start/finish checkered line
      drawStartLine();

      // Decorations
      for (const d of decor) drawDecor(d);

      // Cars (sorted so leader on top)
      const sorted = [...cars].sort((a, b) => (a.lap + a.t) - (b.lap + b.t));
      for (const c of sorted) drawCar(c);

      ctx.restore();
      void now;
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

    function drawDecor(d: { x: number; y: number; kind: "tree" | "rock" | "flag"; size: number }) {
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
      } else {
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

    function drawCar(c: Car) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angle);

      ctx.fillStyle = "rgba(0,0,0,0.35)";
      roundRect(-22, -13, 46, 28, 6); ctx.fill();

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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laps]);

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
          <div className="w-40 rounded-xl border border-border bg-background/60 px-3 py-1.5 text-xs font-bold backdrop-blur">
            <div className="flex items-center justify-between">
              <span><span className="text-muted-foreground">LAP </span><span className="text-foreground">{hud.lap}/{laps}</span></span>
              <span className="text-muted-foreground">{Math.round(hud.lapProgress * 100)}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
              <div className="h-full bg-gradient-to-r from-neon to-cyan-400" style={{ width: `${Math.round(hud.lapProgress * 100)}%` }} />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-background/60 px-3 py-1.5 text-xs font-bold backdrop-blur tabular-nums">
            <span className="text-muted-foreground">TIME </span>
            <span className="text-foreground">{formatTime(hud.elapsed)}</span>
          </div>
          <div className="rounded-xl border border-border bg-background/60 px-3 py-1.5 text-xs font-bold backdrop-blur">
            <span className="text-muted-foreground">POS </span>
            <span className="text-foreground">P{hud.pos}/{hud.total}</span>
          </div>
        </div>

        <div className="pointer-events-none absolute right-3 top-3 flex flex-col items-end gap-2">
          <div className="rounded-xl border border-border bg-background/60 px-3 py-1.5 text-xs font-bold backdrop-blur">
            <Gauge className="mr-1 inline h-3.5 w-3.5 text-neon" />
            {hud.speed} <span className="text-muted-foreground">km/h</span>
          </div>
          <div className="w-32 rounded-xl border border-border bg-background/60 px-2 py-1 backdrop-blur">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
              <Zap className="h-3 w-3" /> Nitro
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
              <div className="h-full bg-gradient-to-r from-amber-300 to-orange-500" style={{ width: `${Math.round(hud.nitro * 100)}%` }} />
            </div>
          </div>
        </div>

        {count && !result && (
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-background/30 backdrop-blur-[2px]">
            <div
              key={count}
              className="select-none text-[12rem] font-black leading-none text-gradient-title drop-shadow-[0_0_40px_rgba(34,211,238,0.5)] animate-in zoom-in-50 duration-300"
              style={{ textShadow: "0 0 60px rgba(34,211,238,0.6)" }}
            >
              {count}
            </div>
          </div>
        )}

        {result && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-background/70 backdrop-blur-md">
            <div className="w-[min(92%,420px)] rounded-2xl border border-primary/50 bg-card/80 p-5 text-center shadow-glow">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-gradient-primary text-primary-foreground">
                <Trophy className="h-6 w-6" />
              </div>
              <div className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">Race finished</div>
              <div className="mt-1 text-2xl font-black">
                <span className="text-gradient-title">P{result.rank}</span>
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                Reward: <span className="font-black text-amber-300">+{result.reward} coins</span>
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button onClick={() => window.location.reload()} className="rounded-xl bg-gradient-primary px-4 py-2 text-xs font-black uppercase tracking-wider text-primary-foreground shadow-button">
                  Race again
                </button>
                <Link to="/quiz" className="rounded-xl border border-border bg-background/60 px-4 py-2 text-xs font-black uppercase tracking-wider">
                  Quiz
                </Link>
                <Link to="/" className="rounded-xl border border-border bg-background/60 px-4 py-2 text-xs font-black uppercase tracking-wider">
                  HUB
                </Link>
              </div>
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
