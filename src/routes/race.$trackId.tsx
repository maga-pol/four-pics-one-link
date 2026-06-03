import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Gauge, Trophy, Zap, Volume2, VolumeX } from "lucide-react";
import * as THREE from "three";
import { getTrack } from "@/lib/tracks";
import {
  startEngine, stopEngine, setEngine, playNitroSwoosh,
  playCrash, playFanfare, playCountdownBeep, setMuted, isMuted,
} from "@/lib/audio";

export const Route = createFileRoute("/race/$trackId")({
  head: () => ({ meta: [{ title: "Race · World Quiz Race" }] }),
  component: RaceScreen,
});

const STORAGE = "wqr-state";
const BEST_KEY = "wqr-best-times";

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
  } catch { return { speed: 1, acceleration: 1, nitro: 0, control: 0 }; }
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

// ---------------- Track geometry ----------------
// Centerline as parametric curve t in [0,1]. Oval with 2 hairpins (at t=0.30 and t=0.75).
const TRACK_SCALE = 60;
const TRACK_WIDTH = 12;

function trackPoint(t: number): THREE.Vector3 {
  // Base oval
  const a = t * Math.PI * 2;
  let x = Math.cos(a) * TRACK_SCALE * 1.6;
  let z = Math.sin(a) * TRACK_SCALE;
  // Pinch into hairpins at t=0.30 and t=0.75
  const hairpin = (center: number, depth: number) => {
    const d = Math.abs(((t - center + 0.5) % 1) - 0.5);
    const k = Math.max(0, 1 - d / 0.06);
    return k * depth;
  };
  const h1 = hairpin(0.30, 1);
  const h2 = hairpin(0.75, 1);
  // Push toward center (sharp bend)
  x -= Math.cos(a) * h1 * 40;
  z -= Math.sin(a) * h1 * 25;
  x -= Math.cos(a) * h2 * 40;
  z -= Math.sin(a) * h2 * 25;
  // Slight elevation hills on straights
  const y = Math.sin(a * 2) * 1.5;
  return new THREE.Vector3(x, y, z);
}

function trackTangent(t: number): THREE.Vector3 {
  const dt = 0.001;
  const a = trackPoint((t - dt + 1) % 1);
  const b = trackPoint((t + dt) % 1);
  return b.sub(a).normalize();
}

function buildTrackCurve() {
  const pts: THREE.Vector3[] = [];
  const N = 400;
  for (let i = 0; i < N; i++) pts.push(trackPoint(i / N));
  return new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.5);
}

// Approximate the closest track t for a world position (XZ plane)
function closestT(curve: THREE.CatmullRomCurve3, pos: THREE.Vector3, hintT: number, samples = 24, range = 0.08) {
  let bestT = hintT;
  let bestD = Infinity;
  for (let i = -samples; i <= samples; i++) {
    const t = ((hintT + (i / samples) * range) + 1) % 1;
    const p = curve.getPointAt(t);
    const dx = p.x - pos.x;
    const dz = p.z - pos.z;
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; bestT = t; }
  }
  return { t: bestT, dist: Math.sqrt(bestD) };
}

const DANGER_TS = [0.30, 0.75];
function nearDanger(t: number, window = 0.04): number {
  let best = 0;
  for (const d of DANGER_TS) {
    const diff = Math.abs(((t - d + 0.5) % 1) - 0.5);
    if (diff < window) best = Math.max(best, 1 - diff / window);
  }
  return best;
}

const BOOST_TS = [0.20, 0.55];

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = (s - m * 60).toFixed(1);
  return `${m}:${sec.padStart(4, "0")}`;
}

type CarState = {
  t: number;          // progress around lap
  lapDist: number;    // continuous distance accumulator
  laps: number;
  speed: number;      // 0..1 normalized
  side: number;       // lateral offset from centerline
  heading: number;    // yaw (radians)
  pos: THREE.Vector3;
  mesh: THREE.Group;
  color: number;
  isPlayer: boolean;
  spinTimer: number;
  boostTimer: number;
  nitroActiveUntil: number;
  nitroReadyAt: number;
  finishedAt?: number;
  topT: number;       // top speed factor
  accel: number;
};

function makeCar(color: number): THREE.Group {
  const g = new THREE.Group();
  // Body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.5, 3.2),
    new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.35 })
  );
  body.position.y = 0.6;
  body.castShadow = true;
  g.add(body);
  // Cabin
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.4, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.3, roughness: 0.2 })
  );
  cabin.position.set(0, 1.0, -0.1);
  g.add(cabin);
  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
  const wpos = [
    [-0.85, 0.35, 1.05],
    [0.85, 0.35, 1.05],
    [-0.85, 0.35, -1.05],
    [0.85, 0.35, -1.05],
  ];
  const wheels: THREE.Mesh[] = [];
  for (const [x, y, z] of wpos) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, y, z);
    g.add(w);
    wheels.push(w);
  }
  (g as any).wheels = wheels;
  // Brake lights
  const brake = new THREE.PointLight(0xff0000, 0, 4);
  brake.position.set(0, 0.6, -1.6);
  g.add(brake);
  (g as any).brake = brake;
  // Headlights
  const hlMat = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffffcc, emissiveIntensity: 0.8 });
  const hlGeo = new THREE.BoxGeometry(0.3, 0.2, 0.1);
  const hl1 = new THREE.Mesh(hlGeo, hlMat); hl1.position.set(-0.55, 0.65, 1.6); g.add(hl1);
  const hl2 = new THREE.Mesh(hlGeo, hlMat); hl2.position.set(0.55, 0.65, 1.6); g.add(hl2);
  return g;
}

function RaceScreen() {
  const { trackId } = useParams({ from: "/race/$trackId" });
  const track = getTrack(trackId);

  const mountRef = useRef<HTMLDivElement | null>(null);
  const miniRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<"countdown" | "racing" | "finished">("countdown");
  const [countdown, setCountdown] = useState(3);
  const [hud, setHud] = useState({
    speed: 0, lap: 1, pos: 1, total: 4,
    nitroPct: 1, nitroActive: false, warning: false,
    elapsed: 0,
  });
  const [muted, setMutedState] = useState(typeof window !== "undefined" ? isMuted() : false);
  const [result, setResult] = useState<null | { rank: number; coins: number; time: number; best: boolean }>(null);

  useEffect(() => {
    if (!track || !mountRef.current) return;
    const mount = mountRef.current;
    const upg = readUpgrades();
    const best = readBestTime(track.id);

    // ---------------- Scene ----------------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a0f1a);
    scene.fog = new THREE.Fog(0x2a1a25, 80, 320);

    const camera = new THREE.PerspectiveCamera(70, mount.clientWidth / mount.clientHeight, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0x404050, 1.0));
    const sun = new THREE.DirectionalLight(0xffb070, 1.4);
    sun.position.set(60, 80, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -150;
    sun.shadow.camera.right = 150;
    sun.shadow.camera.top = 150;
    sun.shadow.camera.bottom = -150;
    scene.add(sun);

    // Skybox — gradient sunset (sphere)
    {
      const geo = new THREE.SphereGeometry(500, 32, 16);
      const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
          top: { value: new THREE.Color(0x2a0f3a) },
          mid: { value: new THREE.Color(0xc04a30) },
          bot: { value: new THREE.Color(0x401020) },
        },
        vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot;
          void main(){ float h = normalize(vP).y;
            vec3 c = mix(bot, mid, smoothstep(-0.2, 0.2, h));
            c = mix(c, top, smoothstep(0.2, 0.8, h));
            gl_FragColor = vec4(c, 1.0);
          }`,
      });
      scene.add(new THREE.Mesh(geo, mat));
    }

    // Ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(800, 800, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x1a3320, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Track
    const curve = buildTrackCurve();
    const N = 400;
    // Build road as a flat ribbon
    const roadGeo = new THREE.BufferGeometry();
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= N; i++) {
      const t = (i % N) / N;
      const p = curve.getPointAt(t);
      const tg = curve.getTangentAt(t).normalize();
      const normal = new THREE.Vector3(-tg.z, 0, tg.x).normalize();
      const left = p.clone().add(normal.clone().multiplyScalar(TRACK_WIDTH / 2));
      const right = p.clone().add(normal.clone().multiplyScalar(-TRACK_WIDTH / 2));
      positions.push(left.x, left.y + 0.05, left.z, right.x, right.y + 0.05, right.z);
      uvs.push(0, i / 4, 1, i / 4);
    }
    for (let i = 0; i < N; i++) {
      const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
      indices.push(a, b, c, b, d, c);
    }
    roadGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    roadGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    roadGeo.setIndex(indices);
    roadGeo.computeVertexNormals();

    // Asphalt texture procedural
    const asphaltCanvas = document.createElement("canvas");
    asphaltCanvas.width = 64; asphaltCanvas.height = 256;
    const actx = asphaltCanvas.getContext("2d")!;
    actx.fillStyle = "#222"; actx.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 800; i++) {
      actx.fillStyle = `rgba(${50+Math.random()*40},${50+Math.random()*40},${50+Math.random()*40},0.5)`;
      actx.fillRect(Math.random()*64, Math.random()*256, 1.5, 1.5);
    }
    // Center dashed line
    for (let y = 0; y < 256; y += 24) {
      actx.fillStyle = "#fff";
      actx.fillRect(31, y, 2, 12);
    }
    // Side lines
    actx.fillStyle = "#fff";
    actx.fillRect(2, 0, 1.5, 256);
    actx.fillRect(60.5, 0, 1.5, 256);
    const asphaltTex = new THREE.CanvasTexture(asphaltCanvas);
    asphaltTex.wrapS = asphaltTex.wrapT = THREE.RepeatWrapping;
    const road = new THREE.Mesh(roadGeo, new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.9 }));
    road.receiveShadow = true;
    scene.add(road);

    // Curbs (red/white)
    const curbCanvas = document.createElement("canvas");
    curbCanvas.width = 32; curbCanvas.height = 32;
    const cctx = curbCanvas.getContext("2d")!;
    cctx.fillStyle = "#fff"; cctx.fillRect(0,0,32,32);
    cctx.fillStyle = "#d22"; cctx.fillRect(0,0,16,32);
    const curbTex = new THREE.CanvasTexture(curbCanvas);
    curbTex.wrapS = curbTex.wrapT = THREE.RepeatWrapping;
    curbTex.repeat.set(80, 1);

    for (const side of [1, -1]) {
      const cg = new THREE.BufferGeometry();
      const cp: number[] = []; const ci: number[] = []; const cu: number[] = [];
      for (let i = 0; i <= N; i++) {
        const t = (i % N) / N;
        const p = curve.getPointAt(t);
        const tg = curve.getTangentAt(t).normalize();
        const normal = new THREE.Vector3(-tg.z, 0, tg.x).normalize();
        const inner = p.clone().add(normal.clone().multiplyScalar(side * (TRACK_WIDTH / 2)));
        const outer = p.clone().add(normal.clone().multiplyScalar(side * (TRACK_WIDTH / 2 + 0.8)));
        cp.push(inner.x, inner.y + 0.1, inner.z, outer.x, outer.y + 0.15, outer.z);
        cu.push(0, i, 1, i);
      }
      for (let i = 0; i < N; i++) {
        const a = i*2, b = i*2+1, c = i*2+2, d = i*2+3;
        ci.push(a,b,c,b,d,c);
      }
      cg.setAttribute("position", new THREE.Float32BufferAttribute(cp, 3));
      cg.setAttribute("uv", new THREE.Float32BufferAttribute(cu, 2));
      cg.setIndex(ci); cg.computeVertexNormals();
      const curb = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ map: curbTex, roughness: 0.7 }));
      scene.add(curb);
    }

    // Concrete barriers near danger corners
    for (const dt of DANGER_TS) {
      for (let k = -8; k <= 8; k++) {
        const t = (dt + k * 0.003 + 1) % 1;
        const p = curve.getPointAt(t);
        const tg = curve.getTangentAt(t).normalize();
        const normal = new THREE.Vector3(-tg.z, 0, tg.x).normalize();
        for (const s of [1, -1]) {
          const bp = p.clone().add(normal.clone().multiplyScalar(s * (TRACK_WIDTH / 2 + 1.5)));
          const bar = new THREE.Mesh(
            new THREE.BoxGeometry(0.6, 1.2, 1.2),
            new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 1 })
          );
          bar.position.copy(bp); bar.position.y = bp.y + 0.6;
          bar.lookAt(p.x, bp.y + 0.6, p.z);
          bar.castShadow = true;
          scene.add(bar);
        }
      }
    }

    // Boost pads (yellow arrows)
    const boostPads: THREE.Mesh[] = [];
    for (const bt of BOOST_TS) {
      const p = curve.getPointAt(bt);
      const tg = curve.getTangentAt(bt).normalize();
      const pad = new THREE.Mesh(
        new THREE.PlaneGeometry(4, 6),
        new THREE.MeshStandardMaterial({ color: 0xffd010, emissive: 0xffaa00, emissiveIntensity: 1.2 })
      );
      pad.rotation.x = -Math.PI / 2;
      pad.rotation.z = Math.atan2(tg.x, tg.z);
      pad.position.set(p.x, p.y + 0.06, p.z);
      (pad as any).boostT = bt;
      scene.add(pad);
      boostPads.push(pad);
    }

    // Start/finish banner
    {
      const p = curve.getPointAt(0);
      const tg = curve.getTangentAt(0).normalize();
      const normal = new THREE.Vector3(-tg.z, 0, tg.x).normalize();
      const checker = document.createElement("canvas");
      checker.width = 128; checker.height = 16;
      const ctx2 = checker.getContext("2d")!;
      for (let i = 0; i < 16; i++) {
        ctx2.fillStyle = i % 2 ? "#fff" : "#000";
        ctx2.fillRect(i * 8, 0, 8, 8);
        ctx2.fillStyle = i % 2 ? "#000" : "#fff";
        ctx2.fillRect(i * 8, 8, 8, 8);
      }
      const ctex = new THREE.CanvasTexture(checker);
      const banner = new THREE.Mesh(
        new THREE.BoxGeometry(TRACK_WIDTH + 2, 1, 0.3),
        new THREE.MeshStandardMaterial({ map: ctex })
      );
      banner.position.set(p.x, p.y + 5, p.z);
      banner.lookAt(p.x + tg.x, p.y + 5, p.z + tg.z);
      scene.add(banner);
      // Posts
      for (const s of [1, -1]) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.2, 5.2, 8),
          new THREE.MeshStandardMaterial({ color: 0xcccccc })
        );
        const pp = p.clone().add(normal.clone().multiplyScalar(s * (TRACK_WIDTH / 2 + 1)));
        post.position.set(pp.x, pp.y + 2.6, pp.z);
        scene.add(post);
      }
    }

    // ---------------- Cars ----------------
    const playerTopT = 0.20 + upg.speed * 0.035;
    const playerAccel = 0.18 + upg.acceleration * 0.04;

    const carColors = [0xff3a4a, 0x3a8aff, 0xffd040, 0xf0f0f0];
    const cars: CarState[] = [];
    for (let i = 0; i < 4; i++) {
      const color = carColors[i];
      const mesh = makeCar(color);
      scene.add(mesh);
      const isPlayer = i === 0;
      const lvl = isPlayer ? upg.speed : (1 + Math.floor(Math.random() * 4));
      const accLvl = isPlayer ? upg.acceleration : (1 + Math.floor(Math.random() * 4));
      const startT = ((-0.005 * i) + 1) % 1;
      const sideOffset = (i % 2 === 0 ? -1 : 1) * 2 - (i > 1 ? 0 : 0);
      const p0 = curve.getPointAt(startT);
      const tg0 = curve.getTangentAt(startT).normalize();
      const normal0 = new THREE.Vector3(-tg0.z, 0, tg0.x);
      const pos = p0.clone().add(normal0.multiplyScalar(sideOffset));
      mesh.position.copy(pos);
      mesh.rotation.y = Math.atan2(tg0.x, tg0.z);
      cars.push({
        t: startT,
        lapDist: 0,
        laps: 0,
        speed: 0,
        side: sideOffset,
        heading: Math.atan2(tg0.x, tg0.z),
        pos,
        mesh,
        color,
        isPlayer,
        spinTimer: 0,
        boostTimer: 0,
        nitroActiveUntil: 0,
        nitroReadyAt: 0,
        topT: 0.20 + lvl * 0.035,
        accel: 0.18 + accLvl * 0.04,
      });
    }
    const player = cars[0];
    void playerTopT; void playerAccel;

    // ---------------- Input ----------------
    const keys: Record<string, boolean> = {};
    const onKey = (e: KeyboardEvent, down: boolean) => {
      const k = e.code;
      keys[k] = down;
      if (down && (k === "Space" || k === "ShiftLeft" || k === "ShiftRight")) {
        // nitro trigger
        const now = performance.now();
        if (now >= player.nitroReadyAt && status !== "finished") {
          player.nitroActiveUntil = now + 3000;
          player.nitroReadyAt = now + 8000 + 3000;
          playNitroSwoosh();
        }
      }
    };
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);

    // ---------------- Countdown ----------------
    let countdownN = 3;
    setCountdown(3);
    let countdownTimer: number | undefined;
    let raceStartMs = 0;
    let raceState: "countdown" | "racing" | "finished" = "countdown";
    const tick = () => {
      playCountdownBeep(countdownN === 0 ? 880 : 440);
      if (countdownN > 0) {
        countdownN -= 1;
        setCountdown(countdownN);
        countdownTimer = window.setTimeout(tick, 1000);
      } else {
        raceState = "racing";
        setStatus("racing");
        raceStartMs = performance.now();
        startEngine();
      }
    };
    countdownTimer = window.setTimeout(tick, 800);

    // ---------------- Resize ----------------
    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    // ---------------- Animation loop ----------------
    let raf = 0;
    let last = performance.now();
    const tmp = new THREE.Vector3();
    const camPos = new THREE.Vector3();
    const camTarget = new THREE.Vector3();

    const miniCtx = miniRef.current?.getContext("2d") ?? null;

    function step() {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (raceState === "racing") {
        for (const car of cars) {
          if (car.finishedAt) continue;
          // Inputs
          let throttle = 0, brake = 0, steer = 0;
          if (car.isPlayer) {
            if (keys["KeyW"] || keys["ArrowUp"]) throttle = 1;
            if (keys["KeyS"] || keys["ArrowDown"]) brake = 1;
            if (keys["KeyA"] || keys["ArrowLeft"]) steer = -1;
            if (keys["KeyD"] || keys["ArrowRight"]) steer = 1;
          } else {
            // AI: full throttle, slow down before danger corners
            const danger = nearDanger(car.t, 0.05);
            throttle = danger > 0.4 ? 0.3 : 1;
            // Steering toward centerline
            steer = -Math.sign(car.side) * Math.min(1, Math.abs(car.side) / 2);
          }

          if (car.spinTimer > 0) {
            car.spinTimer -= dt;
            car.speed *= 0.95;
            car.heading += dt * 6;
          } else {
            // Accel/brake
            if (throttle > 0) car.speed += car.accel * throttle * dt * 0.5;
            if (brake > 0) car.speed -= 0.6 * dt;
            car.speed -= 0.05 * dt; // drag
            // Nitro/boost multipliers
            let topMul = 1;
            if (now < car.nitroActiveUntil) topMul *= 1.2;
            if (car.boostTimer > 0) { topMul *= 1.2; car.boostTimer -= dt; }
            const top = car.topT * topMul;
            car.speed = Math.max(0, Math.min(top, car.speed));
            // Steer
            const steerStrength = 1.6 * (0.5 + car.speed / car.topT * 0.5);
            car.heading += steer * steerStrength * dt;

            // Corner spinout if too fast through danger
            const danger = nearDanger(car.t, 0.05);
            if (danger > 0.6 && car.speed > car.topT * 0.85) {
              car.spinTimer = 2.5;
              playCrash();
            }
          }

          // Advance position in world space
          const dir = new THREE.Vector3(Math.sin(car.heading), 0, Math.cos(car.heading));
          const moveDist = car.speed * 120 * dt; // world units
          car.pos.add(dir.multiplyScalar(moveDist));

          // Snap roughly to track using curve
          const { t: newT } = closestT(curve, car.pos, car.t, 18, 0.05);
          const onTrackPos = curve.getPointAt(newT);
          const tg = curve.getTangentAt(newT).normalize();
          const normal = new THREE.Vector3(-tg.z, 0, tg.x).normalize();
          // Lateral offset
          const off = new THREE.Vector3(car.pos.x - onTrackPos.x, 0, car.pos.z - onTrackPos.z);
          const side = off.dot(normal);
          car.side = THREE.MathUtils.clamp(side, -TRACK_WIDTH / 2 + 0.5, TRACK_WIDTH / 2 - 0.5);
          // Re-position
          car.pos.set(
            onTrackPos.x + normal.x * car.side,
            onTrackPos.y + 0.0,
            onTrackPos.z + normal.z * car.side
          );

          // Lap counting
          const prevT = car.t;
          if (prevT > 0.85 && newT < 0.15) car.laps += 1;
          car.t = newT;
          car.lapDist += moveDist;

          // Boost pads
          for (const pad of boostPads) {
            const bt = (pad as any).boostT as number;
            const diff = Math.abs(((car.t - bt + 0.5) % 1) - 0.5);
            if (diff < 0.005 && Math.abs(car.side) < 2.5) {
              car.boostTimer = Math.max(car.boostTimer, 2);
            }
          }

          // Apply to mesh
          car.mesh.position.copy(car.pos);
          car.mesh.rotation.y = car.heading;
          // Wheel spin
          const wheels = (car.mesh as any).wheels as THREE.Mesh[];
          for (const w of wheels) w.rotation.x += car.speed * 8 * dt * 20;
          // Brake light
          const brakeLight = (car.mesh as any).brake as THREE.PointLight;
          brakeLight.intensity = brake > 0 ? 3 : 0;

          // Finish?
          if (car.laps >= track!.laps) {
            car.finishedAt = (now - raceStartMs) / 1000;
          }
        }

        // Camera follow player
        const playerDir = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
        const back = playerDir.clone().multiplyScalar(-6);
        const up = new THREE.Vector3(0, 3, 0);
        const target = player.pos.clone().add(back).add(up);
        camPos.lerp(target, 0.12);
        camera.position.copy(camPos);
        camTarget.lerp(player.pos, 0.2);
        camera.lookAt(camTarget.x, camTarget.y + 1, camTarget.z);

        // Audio engine
        setEngine(player.speed / player.topT);

        // HUD updates
        const ranks = [...cars].sort((a, b) => {
          const A = a.laps + a.t, B = b.laps + b.t;
          return B - A;
        });
        const playerRank = ranks.indexOf(player) + 1;
        const elapsed = (now - raceStartMs) / 1000;
        const dangerHere = nearDanger(player.t, 0.06) > 0.5 && player.speed > player.topT * 0.7;
        const nitroPct = now >= player.nitroReadyAt ? 1 :
          (now < player.nitroActiveUntil ? Math.max(0, (player.nitroActiveUntil - now) / 3000) :
           1 - (player.nitroReadyAt - now) / 8000);

        setHud({
          speed: player.speed / player.topT,
          lap: Math.min(track!.laps, player.laps + 1),
          pos: playerRank,
          total: cars.length,
          nitroPct: Math.max(0, Math.min(1, nitroPct)),
          nitroActive: now < player.nitroActiveUntil,
          warning: dangerHere,
          elapsed,
        });

        // Minimap
        if (miniCtx) {
          const W = miniCtx.canvas.width, H = miniCtx.canvas.height;
          miniCtx.clearRect(0, 0, W, H);
          miniCtx.fillStyle = "rgba(0,0,0,0.5)";
          miniCtx.fillRect(0, 0, W, H);
          // Track outline
          miniCtx.strokeStyle = "#666"; miniCtx.lineWidth = 6;
          miniCtx.beginPath();
          for (let i = 0; i <= 80; i++) {
            const p = curve.getPointAt(i / 80);
            const x = (p.x / (TRACK_SCALE * 2)) * (W * 0.4) + W / 2;
            const y = (p.z / (TRACK_SCALE * 2)) * (H * 0.4) + H / 2;
            if (i === 0) miniCtx.moveTo(x, y); else miniCtx.lineTo(x, y);
          }
          miniCtx.closePath(); miniCtx.stroke();
          // Boost pads
          miniCtx.fillStyle = "#ffd010";
          for (const bt of BOOST_TS) {
            const p = curve.getPointAt(bt);
            const x = (p.x / (TRACK_SCALE * 2)) * (W * 0.4) + W / 2;
            const y = (p.z / (TRACK_SCALE * 2)) * (H * 0.4) + H / 2;
            miniCtx.beginPath(); miniCtx.arc(x, y, 3, 0, Math.PI * 2); miniCtx.fill();
          }
          // Danger corners
          miniCtx.fillStyle = "#ff3030";
          for (const dt of DANGER_TS) {
            const p = curve.getPointAt(dt);
            const x = (p.x / (TRACK_SCALE * 2)) * (W * 0.4) + W / 2;
            const y = (p.z / (TRACK_SCALE * 2)) * (H * 0.4) + H / 2;
            miniCtx.beginPath(); miniCtx.arc(x, y, 4, 0, Math.PI * 2); miniCtx.fill();
          }
          // Cars
          for (const c of cars) {
            const x = (c.pos.x / (TRACK_SCALE * 2)) * (W * 0.4) + W / 2;
            const y = (c.pos.z / (TRACK_SCALE * 2)) * (H * 0.4) + H / 2;
            miniCtx.fillStyle = c.isPlayer ? "#fff" : `#${c.color.toString(16).padStart(6, "0")}`;
            miniCtx.beginPath(); miniCtx.arc(x, y, c.isPlayer ? 5 : 4, 0, Math.PI * 2); miniCtx.fill();
            if (c.isPlayer) { miniCtx.strokeStyle = "#000"; miniCtx.lineWidth = 1; miniCtx.stroke(); }
          }
        }

        // Finish detection
        if (player.finishedAt && raceState === "racing") {
          raceState = "finished";
          setStatus("finished");
          stopEngine();
          const ranks2 = [...cars].sort((a, b) => (b.laps + b.t) - (a.laps + a.t));
          const rank = ranks2.indexOf(player) + 1;
          const coins = [200, 120, 80, 40][rank - 1] ?? 20;
          addCoins(coins);
          const time = player.finishedAt;
          const wasBest = best == null || time < best;
          if (wasBest) writeBestTime(track!.id, time);
          setResult({ rank, coins, time, best: wasBest });
          playFanfare();
        }
      }
      tmp.set(0, 0, 0);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      if (countdownTimer) clearTimeout(countdownTimer);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("resize", onResize);
      stopEngine();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [track]);

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

  const speedColor = hud.speed < 0.7 ? "#3fdc6c" : hud.speed < 0.85 ? "#ffd040" : "#ff3030";
  const positionLabel = ["1ST", "2ND", "3RD", "4TH"][hud.pos - 1] ?? `${hud.pos}TH`;

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black text-white">
      <div ref={mountRef} className="absolute inset-0" />

      {/* Top-left HUB */}
      <Link to="/" className="absolute left-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/50 px-3 py-1.5 text-xs font-bold backdrop-blur-md hover:border-white/60">
        <ArrowLeft className="h-3.5 w-3.5" /> HUB
      </Link>

      {/* Mute */}
      <button
        onClick={() => { const nm = !muted; setMuted(nm); setMutedState(nm); }}
        className="absolute right-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/50 px-3 py-1.5 text-xs font-bold backdrop-blur-md hover:border-white/60"
      >
        {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
      </button>

      {/* Top-center: Lap */}
      <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-lg border border-white/20 bg-black/60 px-5 py-2 backdrop-blur-md">
        <div className="text-[10px] tracking-[0.3em] text-white/60" style={{ fontFamily: "Anton, sans-serif" }}>LAP</div>
        <div className="text-3xl leading-none" style={{ fontFamily: "Anton, sans-serif", letterSpacing: "0.05em" }}>
          {hud.lap}/{track.laps}
        </div>
      </div>

      {/* Top-right: Position */}
      <div className="absolute right-16 top-3 z-20 rounded-lg border border-white/20 bg-black/60 px-4 py-2 backdrop-blur-md text-center">
        <div className="text-[10px] tracking-[0.3em] text-white/60" style={{ fontFamily: "Anton, sans-serif" }}>POS</div>
        <div className="text-2xl leading-none text-[#ffd040]" style={{ fontFamily: "Anton, sans-serif", letterSpacing: "0.05em" }}>
          {positionLabel}
        </div>
      </div>

      {/* Speedometer bottom-left */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-3 rounded-2xl border border-white/20 bg-black/60 px-4 py-3 backdrop-blur-md">
        <Gauge className="h-6 w-6" style={{ color: speedColor }} />
        <div>
          <div className="text-[10px] tracking-[0.3em] text-white/60" style={{ fontFamily: "Anton, sans-serif" }}>SPEED</div>
          <div className="text-4xl leading-none" style={{ fontFamily: "Anton, sans-serif", color: speedColor, letterSpacing: "0.05em" }}>
            {Math.round(hud.speed * 280)}
          </div>
          <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-white/10">
            <div className="h-full transition-all" style={{ width: `${hud.speed * 100}%`, background: speedColor }} />
          </div>
        </div>
      </div>

      {/* Nitro bottom-center */}
      <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-2xl border border-white/20 bg-black/60 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2 text-[11px]" style={{ fontFamily: "Anton, sans-serif", letterSpacing: "0.2em" }}>
          <Zap className="h-4 w-4 text-[#da291c]" /> NITRO {hud.nitroActive ? <span className="text-[#ffd040]">• ACTIVE</span> : hud.nitroPct >= 1 ? <span className="text-[#3fdc6c]">• READY</span> : null}
        </div>
        <div className="mt-1 h-2 w-48 overflow-hidden rounded-full bg-white/10">
          <div className="h-full transition-all" style={{ width: `${hud.nitroPct * 100}%`, background: hud.nitroActive ? "#ffd040" : hud.nitroPct >= 1 ? "#3fdc6c" : "#da291c" }} />
        </div>
        <div className="mt-1 text-[9px] uppercase tracking-widest text-white/40">SPACE</div>
      </div>

      {/* Time */}
      <div className="absolute bottom-4 right-4 z-20 rounded-2xl border border-white/20 bg-black/60 px-4 py-3 backdrop-blur-md text-right">
        <div className="text-[10px] tracking-[0.3em] text-white/60" style={{ fontFamily: "Anton, sans-serif" }}>TIME</div>
        <div className="text-2xl leading-none" style={{ fontFamily: "Anton, sans-serif", letterSpacing: "0.05em" }}>
          {fmtTime(hud.elapsed)}
        </div>
      </div>

      {/* Minimap */}
      <canvas ref={miniRef} width={160} height={120} className="absolute bottom-24 right-4 z-20 rounded-lg border border-white/20 bg-black/60 backdrop-blur-md" />

      {/* Corner warning */}
      {hud.warning && status === "racing" && (
        <div
          className="pointer-events-none absolute left-1/2 top-1/3 z-30 -translate-x-1/2 text-6xl text-[#ff3030]"
          style={{
            fontFamily: "Anton, sans-serif",
            letterSpacing: "0.1em",
            textShadow: "0 0 20px rgba(255,48,48,0.8)",
            animation: "warn-shake 0.3s ease-in-out infinite",
          }}
        >
          SLOW DOWN!
        </div>
      )}

      {/* Countdown */}
      {status === "countdown" && (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-black/30">
          <div className="text-[180px] leading-none text-white" style={{ fontFamily: "Anton, sans-serif", textShadow: "0 0 60px rgba(218,41,28,0.8)" }}>
            {countdown === 0 ? "GO!" : countdown}
          </div>
        </div>
      )}

      {/* Finish overlay */}
      {status === "finished" && result && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-gradient-to-b from-black/80 to-[#da291c]/40 backdrop-blur-sm">
          <div className="rounded-2xl border border-white/20 bg-black/80 p-8 text-center">
            <div className="text-sm tracking-[0.4em] text-white/60" style={{ fontFamily: "Anton, sans-serif" }}>FINISHED</div>
            <div className="my-3 flex items-center justify-center gap-3">
              <Trophy className="h-10 w-10 text-[#ffd040]" />
              <div className="text-7xl text-white" style={{ fontFamily: "Anton, sans-serif", letterSpacing: "0.05em" }}>
                P{result.rank}
              </div>
            </div>
            <div className="text-xl text-white" style={{ fontFamily: "Anton, sans-serif", letterSpacing: "0.1em" }}>
              TIME {fmtTime(result.time)} {result.best && <span className="ml-2 text-[#ffd040]">NEW BEST!</span>}
            </div>
            <div className="mt-2 text-lg text-[#ffd040]" style={{ fontFamily: "Anton, sans-serif", letterSpacing: "0.1em" }}>
              +{result.coins} COINS
            </div>
            <div className="mt-6 flex gap-3 justify-center">
              <button onClick={() => window.location.reload()} className="rounded-lg bg-[#da291c] px-6 py-2 text-sm font-bold uppercase tracking-widest text-white hover:bg-[#b01e0a]" style={{ fontFamily: "Anton, sans-serif" }}>
                Race Again
              </button>
              <Link to="/" className="rounded-lg border border-white/30 px-6 py-2 text-sm font-bold uppercase tracking-widest text-white hover:bg-white/10" style={{ fontFamily: "Anton, sans-serif" }}>
                HUB
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
