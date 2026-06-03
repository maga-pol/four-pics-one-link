// Lightweight WebAudio engine for the racer. No assets — fully synthesized.
// All functions are no-ops on the server / when audio is muted.

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let engineOsc: OscillatorNode | null = null;
let engineGain: GainNode | null = null;
let muted = false;

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext) as typeof AudioContext;
      ctx = new Ctor();
      masterGain = ctx.createGain();
      masterGain.gain.value = muted ? 0 : 0.5;
      masterGain.connect(ctx.destination);
    } catch {
      ctx = null;
    }
  }
  if (ctx && ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setMuted(m: boolean) {
  muted = m;
  if (masterGain) masterGain.gain.value = m ? 0 : 0.5;
}
export function isMuted() { return muted; }

export function startEngine() {
  const c = ensure();
  if (!c || !masterGain || engineOsc) return;
  engineOsc = c.createOscillator();
  engineOsc.type = "sawtooth";
  engineGain = c.createGain();
  engineGain.gain.value = 0;
  engineOsc.frequency.value = 60;
  engineOsc.connect(engineGain).connect(masterGain);
  engineOsc.start();
}
export function stopEngine() {
  try { engineOsc?.stop(); } catch {}
  engineOsc?.disconnect();
  engineGain?.disconnect();
  engineOsc = null;
  engineGain = null;
}
export function setEngine(speed01: number, boosting: boolean) {
  if (!engineOsc || !engineGain || !ctx) return;
  const target = 60 + speed01 * (boosting ? 360 : 240);
  engineOsc.frequency.linearRampToValueAtTime(target, ctx.currentTime + 0.08);
  engineGain.gain.linearRampToValueAtTime(0.04 + speed01 * 0.08, ctx.currentTime + 0.08);
}

export function playBeep(freq = 600, duration = 0.18, type: OscillatorType = "square") {
  const c = ensure(); if (!c || !masterGain) return;
  const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
  const g = c.createGain(); g.gain.value = 0;
  o.connect(g).connect(masterGain);
  const now = c.currentTime;
  g.gain.linearRampToValueAtTime(0.25, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, now + duration);
  o.start(now); o.stop(now + duration + 0.02);
}

export function playNitroSwoosh() {
  const c = ensure(); if (!c || !masterGain) return;
  // white-noise burst with band-pass sweep
  const len = 0.4;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource(); src.buffer = buf;
  const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 400; bp.Q.value = 0.8;
  const g = c.createGain(); g.gain.value = 0.35;
  src.connect(bp).connect(g).connect(masterGain);
  bp.frequency.linearRampToValueAtTime(2200, c.currentTime + len);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + len);
  src.start();
}

export function playCrash() {
  playBeep(120, 0.22, "sawtooth");
}

export function playFanfare() {
  const notes = [523, 659, 784, 1046];
  notes.forEach((f, i) => setTimeout(() => playBeep(f, 0.32, "triangle"), i * 120));
}

export function playCountdownBeep(go = false) {
  playBeep(go ? 880 : 440, go ? 0.4 : 0.18, go ? "triangle" : "square");
}