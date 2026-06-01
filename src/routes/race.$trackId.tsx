import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Flag, Gauge, Trophy, Zap } from "lucide-react";
import { getTrack } from "@/lib/tracks";

export const Route = createFileRoute("/race/$trackId")({
  head: () => ({ meta: [{ title: "Race · World Quiz Race" }] }),
  component: RaceScreen,
});

const STORAGE = "wqr-state";
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

// ---- Pseudo-3D arcade racer ----
type Racer = {
  id: string;
  name: string;
  color: string;
  z: number; // distance along track
  x: number; // lateral, -1..1
  speed: number;
  isPlayer: boolean;
  finishedAt?: number;
};

const SEG_LEN = 200;
const ROAD_W = 1600;
const DRAW_DIST = 120;
const CAM_HEIGHT = 1000;
const CAM_DEPTH = 0.84;

type Seg = { index: number; curve: number; y: number; worldZ: number; sector: number; label?: string };

// Monaco-inspired F1 layout: scripted sequence of corners.
// Each entry: [length-in-segments, curve-magnitude, hill-delta, label?]
// Positive curve = right turn, negative = left.
const MONACO_SCRIPT: Array<[number, number, number, string?]> = [
  [50, 0, 0, "Start / Finish"],
  [22, 2.4, 60, "T1 Sainte Devote"],
  [45, -0.4, 320, "Beau Rivage"],
  [16, -2.0, 80, "T3 Massenet"],
  [10, 0, 0, "Casino Sq"],
  [16, 2.2, -40, "T5 Casino"],
  [25, 0.2, -180, "Mirabeau App"],
  [14, 2.6, -120, "T6 Mirabeau Haute"],
  [10, 0, -80, ""],
  [20, 4.5, -160, "T8 Loews Hairpin"],
  [10, 0, -80, ""],
  [14, 2.4, -120, "T10 Mirabeau Bas"],
  [12, 2.2, -60, "T11 Portier"],
  [50, -0.6, 0, "Tunnel"],
  [30, 0.8, 80, "Tunnel Exit"],
  [10, -2.4, 0, "T12 Nouvelle L"],
  [10, 2.4, 0, "T13 Nouvelle R"],
  [25, 0, 0, ""],
  [12, -2.0, 0, "T14 Tabac"],
  [10, 1.6, 0, "Pool L"],
  [10, -1.6, 0, "Pool R"],
  [10, 1.6, 0, "Pool L"],
  [10, -1.6, 0, "T17 Pool Exit"],
  [12, 2.0, 0, "T18 Rascasse"],
  [12, 2.4, 0, "T19 A. Noghes"],
  [60, 0, 0, "Pit Straight"],
];

function buildSegments(): { segments: Seg[]; total: number } {
  const segs: Seg[] = [];
  let y = 0;
  let idx = 0;
  let sector = 1;
  let totalSegs = 0;
  MONACO_SCRIPT.forEach((t) => (totalSegs += t[0]));
  const sector2 = Math.floor(totalSegs / 3);
  const sector3 = Math.floor((totalSegs * 2) / 3);

  for (const [len, curveMag, hill, label] of MONACO_SCRIPT) {
    const yDelta = hill / Math.max(1, len);
    for (let i = 0; i < len; i++) {
      // ease-in/out curve through corner
      const t = i / Math.max(1, len - 1);
      const ease = Math.sin(t * Math.PI);
      const curve = curveMag * ease;
      y += yDelta;
      if (idx === sector2) sector = 2;
      if (idx === sector3) sector = 3;
      segs.push({
        index: idx,
        curve,
        y,
        worldZ: idx * SEG_LEN,
        sector,
        label: i === 0 && label ? label : undefined,
      });
      idx++;
    }
  }
  // Tail buffer so projection doesn't crash near end
  for (let i = 0; i < 200; i++) {
    segs.push({ index: idx, curve: 0, y, worldZ: idx * SEG_LEN, sector: 3 });
    idx++;
  }
  return { segments: segs, total: totalSegs };
}

const AI_COLORS = ["#f43f5e", "#f59e0b", "#10b981", "#a855f7", "#3b82f6"];
const AI_NAMES = ["Vega", "Kobra", "Riko", "Stryx", "Mako"];

function ArcadeRacer({
  trackName,
  onFinish,
}: {
  trackName: string;
  onFinish: (place: number, reward: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<{
    segments: Seg[];
    racers: Racer[];
    keys: Record<string, boolean>;
    nitro: number; // 0..1
    finished: boolean;
    startedAt: number;
    upgrades: { speed: number; acceleration: number; nitro: number; control: number };
  } | null>(null);
  const [hud, setHud] = useState({ speed: 0, place: 1, nitro: 1, progress: 0, corner: "Start / Finish", sector: 1 });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const upgrades = readUpgrades();
    const built = buildSegments();
    const segments = built.segments;
    const TRACK_LENGTH = built.total * SEG_LEN;
    const player: Racer = {
      id: "player",
      name: "You",
      color: "#22d3ee",
      z: 0,
      x: 0,
      speed: 0,
      isPlayer: true,
    };
    const ais: Racer[] = AI_COLORS.map((c, i) => ({
      id: `ai-${i}`,
      name: AI_NAMES[i],
      color: c,
      z: 200 + i * 90,
      x: (i - 2) * 0.35,
      speed: 1400 + i * 60,
      isPlayer: false,
    }));
    stateRef.current = {
      segments,
      racers: [player, ...ais],
      keys: {},
      nitro: 1,
      finished: false,
      startedAt: performance.now(),
      upgrades,
    };

    const onKey = (e: KeyboardEvent, down: boolean) => {
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "shift", " "].includes(k)) e.preventDefault();
      stateRef.current!.keys[k] = down;
    };
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.floor(r.width * devicePixelRatio);
      canvas.height = Math.floor(r.height * devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let last = performance.now();

    function project(camX: number, camY: number, camZ: number, worldX: number, worldY: number, worldZ: number, width: number, height: number) {
      const dz = worldZ - camZ;
      const scale = CAM_DEPTH / Math.max(dz, 1);
      const sx = (1 + scale * (worldX - camX)) * width / 2;
      const sy = (1 - scale * (worldY - camY)) * height / 2;
      const sw = scale * ROAD_W * width / 2;
      return { sx, sy, sw, scale };
    }

    function step(dtMs: number) {
      const s = stateRef.current!;
      if (s.finished) return;
      const dt = Math.min(dtMs / 1000, 0.05);
      const player = s.racers[0];
      const keys = s.keys;

      const maxSpeed = 2200 + s.upgrades.speed * 250;
      const accel = 600 + s.upgrades.acceleration * 180;
      const brake = 2200;
      const turn = (1.4 + s.upgrades.control * 0.25);
      const nitroPower = 1.5 + s.upgrades.nitro * 0.18;

      // Controls
      if (keys["w"] || keys["arrowup"]) player.speed += accel * dt;
      else player.speed -= 300 * dt;
      if (keys["s"] || keys["arrowdown"]) player.speed -= brake * dt;

      let boosting = false;
      if ((keys["shift"] || keys[" "]) && s.nitro > 0) {
        player.speed += accel * 1.2 * dt;
        s.nitro = Math.max(0, s.nitro - dt * 0.35);
        boosting = true;
      } else {
        s.nitro = Math.min(1, s.nitro + dt * 0.08);
      }
      const cap = maxSpeed * (boosting ? nitroPower : 1);
      player.speed = Math.max(0, Math.min(cap, player.speed));

      const steerAmt = turn * dt * (0.4 + player.speed / maxSpeed);
      if (keys["a"] || keys["arrowleft"]) player.x -= steerAmt;
      if (keys["d"] || keys["arrowright"]) player.x += steerAmt;
      player.x = Math.max(-1.1, Math.min(1.1, player.x));

      // Curve push
      const segIdx = Math.floor(player.z / SEG_LEN) % s.segments.length;
      const curve = s.segments[segIdx]?.curve ?? 0;
      player.x -= curve * 0.0025 * (player.speed / 1000) * dt * 60;

      // Hard barriers (Monaco walls). Bounce + slow.
      const WALL = 1.0;
      if (player.x > WALL) {
        player.x = WALL;
        player.speed *= 1 - 1.8 * dt;
      } else if (player.x < -WALL) {
        player.x = -WALL;
        player.speed *= 1 - 1.8 * dt;
      }
      // Kerb scrub when very close to edge
      if (Math.abs(player.x) > 0.9) player.speed *= 1 - 0.25 * dt;

      player.z += player.speed * dt;

      // AI
      for (let i = 1; i < s.racers.length; i++) {
        const a = s.racers[i];
        if (a.finishedAt) continue;
        // AI brakes for sharp corners
        const aSegIdx = Math.floor(a.z / SEG_LEN) % s.segments.length;
        const aCurve = Math.abs(s.segments[aSegIdx]?.curve ?? 0);
        const aTargetSpeed = Math.max(900, 1800 - aCurve * 180) + i * 40;
        a.speed += (aTargetSpeed - a.speed) * dt * 1.2;
        a.z += a.speed * dt;
        // gentle lane wander + avoid player
        const targetX = Math.sin(a.z * 0.0008 + i) * 0.55;
        a.x += (targetX - a.x) * dt * 0.8;
        a.x = Math.max(-0.95, Math.min(0.95, a.x));
        const dz = a.z - player.z;
        if (Math.abs(dz) < 250 && Math.abs(a.x - player.x) < 0.3) {
          a.x += (a.x - player.x > 0 ? 1 : -1) * dt * 1.2;
        }
        if (a.z >= TRACK_LENGTH) a.finishedAt = performance.now();
      }

      // Collisions player vs AI
      for (let i = 1; i < s.racers.length; i++) {
        const a = s.racers[i];
        const dz = a.z - player.z;
        if (Math.abs(dz) < 180 && Math.abs(a.x - player.x) < 0.25) {
          player.speed *= 0.92;
          player.x += (player.x - a.x) * 0.05;
        }
      }

      // Finish
      if (player.z >= TRACK_LENGTH) {
        player.finishedAt = performance.now();
        s.finished = true;
        const finishers = s.racers
          .filter((r) => r.finishedAt)
          .sort((x, y) => (x.finishedAt! - y.finishedAt!));
        const place = finishers.findIndex((r) => r.id === "player") + 1;
        // Players who haven't finished count behind
        const allOrder = [...finishers, ...s.racers.filter((r) => !r.finishedAt)];
        const playerPlace = allOrder.findIndex((r) => r.id === "player") + 1;
        const rewardMap = [0, 300, 220, 160, 120, 90, 60];
        const reward = rewardMap[playerPlace] ?? 60;
        addCoins(reward);
        onFinish(playerPlace, reward);
      }
    }

    function render() {
      const s = stateRef.current!;
      const w = canvas.width;
      const h = canvas.height;
      const player = s.racers[0];

      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6);
      sky.addColorStop(0, "#0b0f2a");
      sky.addColorStop(1, "#3a1d6e");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      // Sun
      ctx.fillStyle = "rgba(255,120,200,0.5)";
      ctx.beginPath();
      ctx.arc(w * 0.7, h * 0.35, h * 0.12, 0, Math.PI * 2);
      ctx.fill();
      // Ground
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, h * 0.5, w, h * 0.5);

      const baseSeg = Math.floor(player.z / SEG_LEN);
      const camX = player.x * ROAD_W * 0.5;
      const camZ = player.z;
      let maxY = h;
      let x = 0;
      let dx = 0;

      for (let n = 0; n < DRAW_DIST; n++) {
        const idx = (baseSeg + n) % s.segments.length;
        const seg = s.segments[idx];
        const segWorldZ = (baseSeg + n) * SEG_LEN;

        const p1 = project(camX, CAM_HEIGHT, camZ, x, seg.y, segWorldZ, w, h);
        const p2 = project(camX, CAM_HEIGHT, camZ, x + dx, s.segments[(idx + 1) % s.segments.length].y, segWorldZ + SEG_LEN, w, h);

        x += dx;
        dx += seg.curve;

        if (p1.sy < maxY || p2.sy >= h) {
          const grassColor = n % 2 === 0 ? "#0f3a1f" : "#0d2f19";
          const rumbleColor = n % 2 === 0 ? "#ef4444" : "#fafafa";
          const roadColor = n % 2 === 0 ? "#1a1a22" : "#1e1e28";
          const laneColor = "#facc15";

          // Grass
          ctx.fillStyle = grassColor;
          ctx.fillRect(0, p2.sy, w, p1.sy - p2.sy);
          // Road
          ctx.fillStyle = roadColor;
          ctx.beginPath();
          ctx.moveTo(p1.sx - p1.sw, p1.sy);
          ctx.lineTo(p2.sx - p2.sw, p2.sy);
          ctx.lineTo(p2.sx + p2.sw, p2.sy);
          ctx.lineTo(p1.sx + p1.sw, p1.sy);
          ctx.closePath();
          ctx.fill();
          // Concrete barriers (Monaco walls) — drawn as a vertical band hugging the road edge
          const wallH1 = p1.sw * 0.18;
          const wallH2 = p2.sw * 0.18;
          ctx.fillStyle = n % 8 < 4 ? "#d4d4d8" : "#b91c1c";
          // Left wall
          ctx.beginPath();
          ctx.moveTo(p1.sx - p1.sw, p1.sy);
          ctx.lineTo(p2.sx - p2.sw, p2.sy);
          ctx.lineTo(p2.sx - p2.sw, p2.sy - wallH2);
          ctx.lineTo(p1.sx - p1.sw, p1.sy - wallH1);
          ctx.closePath();
          ctx.fill();
          // Right wall
          ctx.beginPath();
          ctx.moveTo(p1.sx + p1.sw, p1.sy);
          ctx.lineTo(p2.sx + p2.sw, p2.sy);
          ctx.lineTo(p2.sx + p2.sw, p2.sy - wallH2);
          ctx.lineTo(p1.sx + p1.sw, p1.sy - wallH1);
          ctx.closePath();
          ctx.fill();
          // Rumble strips
          const rumW1 = p1.sw * 0.12;
          const rumW2 = p2.sw * 0.12;
          ctx.fillStyle = rumbleColor;
          ctx.beginPath();
          ctx.moveTo(p1.sx - p1.sw - rumW1, p1.sy);
          ctx.lineTo(p2.sx - p2.sw - rumW2, p2.sy);
          ctx.lineTo(p2.sx - p2.sw, p2.sy);
          ctx.lineTo(p1.sx - p1.sw, p1.sy);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(p1.sx + p1.sw, p1.sy);
          ctx.lineTo(p2.sx + p2.sw, p2.sy);
          ctx.lineTo(p2.sx + p2.sw + rumW2, p2.sy);
          ctx.lineTo(p1.sx + p1.sw + rumW1, p1.sy);
          ctx.closePath();
          ctx.fill();
          // Lane line
          if (n % 3 === 0) {
            const lw1 = p1.sw * 0.02;
            const lw2 = p2.sw * 0.02;
            ctx.fillStyle = laneColor;
            ctx.beginPath();
            ctx.moveTo(p1.sx - lw1, p1.sy);
            ctx.lineTo(p2.sx - lw2, p2.sy);
            ctx.lineTo(p2.sx + lw2, p2.sy);
            ctx.lineTo(p1.sx + lw1, p1.sy);
            ctx.closePath();
            ctx.fill();
          }
          maxY = p2.sy;
        }
      }

      // Draw racers (back to front)
      const sorted = [...s.racers].slice(1).sort((a, b) => b.z - a.z);
      for (const r of sorted) {
        if (r.z < player.z - 200 || r.z > player.z + DRAW_DIST * SEG_LEN) continue;
        const p = project(camX, CAM_HEIGHT, camZ, r.x * ROAD_W * 0.5, 0, r.z, w, h);
        if (p.scale <= 0) continue;
        drawCar(ctx, p.sx, p.sy, Math.max(20, p.sw * 0.18), r.color);
      }
      // Player car (always front, screen-fixed-ish bottom)
      const pcW = Math.min(w * 0.28, 280 * devicePixelRatio);
      drawCar(ctx, w / 2, h - pcW * 0.55, pcW, "#22d3ee", true);

      // Speed lines on nitro
      if ((s.keys["shift"] || s.keys[" "]) && s.nitro > 0) {
        ctx.strokeStyle = "rgba(125,211,252,0.5)";
        ctx.lineWidth = 2 * devicePixelRatio;
        for (let i = 0; i < 12; i++) {
          ctx.beginPath();
          const y = (Math.random() * h);
          ctx.moveTo(0, y);
          ctx.lineTo(80 * devicePixelRatio, y);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(w, y);
          ctx.lineTo(w - 80 * devicePixelRatio, y);
          ctx.stroke();
        }
      }
    }

    function drawCar(c: CanvasRenderingContext2D, x: number, y: number, w: number, color: string, isPlayer = false) {
      const h = w * 0.55;
      c.save();
      c.translate(x, y);
      // Shadow
      c.fillStyle = "rgba(0,0,0,0.5)";
      c.beginPath();
      c.ellipse(0, h * 0.45, w * 0.5, h * 0.12, 0, 0, Math.PI * 2);
      c.fill();
      // Body
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(-w * 0.45, h * 0.2);
      c.lineTo(-w * 0.35, -h * 0.15);
      c.lineTo(w * 0.35, -h * 0.15);
      c.lineTo(w * 0.45, h * 0.2);
      c.lineTo(w * 0.4, h * 0.4);
      c.lineTo(-w * 0.4, h * 0.4);
      c.closePath();
      c.fill();
      // Cockpit
      c.fillStyle = "rgba(10,10,20,0.85)";
      c.beginPath();
      c.moveTo(-w * 0.22, h * 0.05);
      c.lineTo(-w * 0.16, -h * 0.1);
      c.lineTo(w * 0.16, -h * 0.1);
      c.lineTo(w * 0.22, h * 0.05);
      c.closePath();
      c.fill();
      // Wheels
      c.fillStyle = "#0a0a0a";
      c.fillRect(-w * 0.5, h * 0.25, w * 0.18, h * 0.22);
      c.fillRect(w * 0.32, h * 0.25, w * 0.18, h * 0.22);
      // Neon underglow
      const grad = c.createRadialGradient(0, h * 0.45, 0, 0, h * 0.45, w * 0.5);
      grad.addColorStop(0, isPlayer ? "rgba(34,211,238,0.7)" : color + "aa");
      grad.addColorStop(1, "transparent");
      c.fillStyle = grad;
      c.fillRect(-w * 0.6, h * 0.3, w * 1.2, h * 0.3);
      c.restore();
    }

    function loop(t: number) {
      const dt = t - last;
      last = t;
      step(dt);
      render();
      // HUD
      const s = stateRef.current!;
      const player = s.racers[0];
      const order = [...s.racers].sort((a, b) => b.z - a.z);
      const place = order.findIndex((r) => r.id === "player") + 1;
      // Find latest corner label at/behind player
      const segIdxNow = Math.floor(player.z / SEG_LEN);
      let corner = hud.corner;
      let sector = 1;
      for (let k = segIdxNow; k >= Math.max(0, segIdxNow - 60); k--) {
        const sg = s.segments[k];
        if (sg?.label) { corner = sg.label; sector = sg.sector; break; }
        if (sg) sector = sg.sector;
      }
      setHud({
        speed: Math.round(player.speed * 0.12),
        place,
        nitro: s.nitro,
        progress: Math.min(100, (player.z / TRACK_LENGTH) * 100),
        corner,
        sector,
      });
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("resize", resize);
    };
  }, [onFinish]);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-primary/40 bg-black shadow-glow">
      <canvas ref={canvasRef} className="block h-[60vh] w-full" tabIndex={0} />
      {/* HUD overlay */}
      <div className="pointer-events-none absolute inset-0 p-3">
        <div className="flex items-start justify-between">
          <div className="rounded-xl border border-border bg-background/60 px-3 py-2 backdrop-blur">
            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Track</div>
            <div className="text-sm font-black">{trackName}</div>
          </div>
          <div className="rounded-xl border border-border bg-background/60 px-3 py-2 text-right backdrop-blur">
            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Position</div>
            <div className="text-lg font-black text-neon">P{hud.place}/6</div>
          </div>
        </div>
        <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-3">
          <div className="rounded-xl border border-border bg-background/60 px-3 py-2 backdrop-blur">
            <div className="flex items-center gap-1 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
              <Gauge className="h-3 w-3" /> Speed
            </div>
            <div className="text-2xl font-black">{hud.speed} <span className="text-xs text-muted-foreground">km/h</span></div>
          </div>
          <div className="flex-1 rounded-xl border border-border bg-background/60 px-3 py-2 backdrop-blur">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Progress</span><span>{Math.round(hud.progress)}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-card/60">
              <div className="h-full bg-gradient-primary" style={{ width: `${hud.progress}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-amber-300" /> Nitro</span>
              <span>{Math.round(hud.nitro * 100)}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-card/60">
              <div className="h-full bg-gradient-to-r from-amber-300 to-orange-500" style={{ width: `${hud.nitro * 100}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RaceScreen() {
  const { trackId } = useParams({ from: "/race/$trackId" });
  const track = getTrack(trackId);
  const [result, setResult] = useState<{ place: number; reward: number } | null>(null);
  const [runKey, setRunKey] = useState(0);

  if (!track) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-foreground p-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Track not found.</p>
          <Link to="/" className="mt-4 inline-block rounded-xl bg-gradient-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-button">
            Back to HUB
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/20 blur-[120px] animate-float-slow" />
      <div
        className="pointer-events-none absolute -right-32 bottom-0 h-[28rem] w-[28rem] rounded-full bg-secondary/20 blur-[140px] animate-float-slow"
        style={{ animationDelay: "-6s" }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col gap-4 p-4">
        {/* Header */}
        <header className="flex items-center justify-between">
          <Link
            to="/"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/60 text-muted-foreground backdrop-blur-sm transition hover:text-foreground"
            aria-label="Back to HUB"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="text-center">
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-primary-glow">{track.region} · F1</div>
            <div className="text-base font-black sm:text-lg">{track.name}</div>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-2.5 py-1 text-xs font-bold backdrop-blur">
            <Trophy className="h-3.5 w-3.5 text-neon" />
            <span>{track.stages.length} stages</span>
          </div>
        </header>

        {/* Current stage card */}
        <ArcadeRacer
          key={runKey}
          trackName={track.name}
          onFinish={(place, reward) => setResult({ place, reward })}
        />

        {/* Controls hint */}
        <section className="rounded-2xl border border-border bg-card/50 p-3 backdrop-blur-md">
          <h2 className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Controls</h2>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <KeyHint k="W" desc="Accelerate" />
            <KeyHint k="A / D" desc="Steer" />
            <KeyHint k="S" desc="Brake" />
            <KeyHint k="⇧ Shift" desc="Nitro" />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Beat 5 AI rivals across <span className="font-bold text-foreground">{track.stages.map((s) => s.name).join(" · ")}</span>. Coins reward your finish position and feed the Garage upgrades.
          </p>
        </section>

        {result && (
          <div className="animate-fade-up rounded-2xl border border-primary/50 bg-gradient-to-br from-primary/15 via-secondary/10 to-transparent p-5 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-amber-400/20 text-amber-300">
                <Trophy className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-neon">Race Complete</div>
                <div className="text-xl font-black">Finished P{result.place} · +{result.reward} coins</div>
                <div className="text-[11px] text-muted-foreground">Coins added to your Garage wallet.</div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => { setResult(null); setRunKey((k) => k + 1); }}
                className="flex-1 rounded-xl bg-gradient-primary px-4 py-3 text-sm font-black uppercase tracking-wider text-primary-foreground shadow-button"
              >
                <Flag className="mr-1 inline h-4 w-4" /> Race Again
              </button>
              <Link to="/quiz" className="rounded-xl border border-border bg-card/60 px-4 py-3 text-xs font-bold uppercase tracking-wider backdrop-blur">
                Quiz
              </Link>
              <Link to="/" className="rounded-xl border border-border bg-card/60 px-4 py-3 text-xs font-bold uppercase tracking-wider backdrop-blur">
                HUB
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function KeyHint({ k, desc }: { k: string; desc: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-background/40 px-2 py-1.5">
      <kbd className="rounded-md border border-border bg-card/80 px-2 py-0.5 text-[10px] font-black">{k}</kbd>
      <span className="text-[11px] text-muted-foreground">{desc}</span>
    </div>
  );
}