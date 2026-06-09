// Lightweight WebAudio engine for the racer. No assets; fully synthesized.
// All functions are no-ops on the server or when audio is muted.

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let engineOsc: OscillatorNode | null = null;
let engineSubOsc: OscillatorNode | null = null;
let engineGain: GainNode | null = null;
let engineFilter: BiquadFilterNode | null = null;
let ambienceGain: GainNode | null = null;
let muted = false;

const ambientNodes: AudioNode[] = [];

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext) as typeof AudioContext;
      ctx = new Ctor();
      masterGain = ctx.createGain();
      masterGain.gain.value = muted ? 0 : 0.42;
      masterGain.connect(ctx.destination);
    } catch {
      ctx = null;
    }
  }
  if (ctx && ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function connectTone(freq: number, type: OscillatorType, gainValue: number, destination: AudioNode) {
  const c = ctx!;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = gainValue;
  osc.connect(gain).connect(destination);
  osc.start();
  ambientNodes.push(osc, gain);
  return { osc, gain };
}

function startAmbience() {
  const c = ensure();
  if (!c || !masterGain || ambienceGain) return;
  ambienceGain = c.createGain();
  ambienceGain.gain.value = 0.055;

  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 980;
  filter.Q.value = 0.8;
  ambienceGain.connect(filter).connect(masterGain);
  ambientNodes.push(ambienceGain, filter);

  connectTone(110, "sine", 0.34, ambienceGain);
  connectTone(220, "triangle", 0.12, ambienceGain);
  connectTone(329.63, "sine", 0.06, ambienceGain);
  connectTone(440, "triangle", 0.045, ambienceGain);

  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 0.07;
  lfoGain.gain.value = 0.018;
  lfo.connect(lfoGain).connect(ambienceGain.gain);
  lfo.start();
  ambientNodes.push(lfo, lfoGain);
}

export function setMuted(m: boolean) {
  muted = m;
  if (masterGain) masterGain.gain.value = m ? 0 : 0.42;
}
export function isMuted() { return muted; }

export function startEngine() {
  const c = ensure();
  if (!c || !masterGain || engineOsc) return;
  startAmbience();

  engineOsc = c.createOscillator();
  engineSubOsc = c.createOscillator();
  engineOsc.type = "triangle";
  engineSubOsc.type = "sine";
  engineGain = c.createGain();
  engineFilter = c.createBiquadFilter();

  engineOsc.frequency.value = 72;
  engineSubOsc.frequency.value = 36;
  engineGain.gain.value = 0;
  engineFilter.type = "lowpass";
  engineFilter.frequency.value = 620;
  engineFilter.Q.value = 0.7;

  engineOsc.connect(engineFilter);
  engineSubOsc.connect(engineFilter);
  engineFilter.connect(engineGain).connect(masterGain);
  engineOsc.start();
  engineSubOsc.start();
}
export function stopEngine() {
  try { engineOsc?.stop(); } catch {}
  try { engineSubOsc?.stop(); } catch {}
  for (const node of ambientNodes) {
    try {
      if ("stop" in node && typeof node.stop === "function") node.stop();
      node.disconnect();
    } catch {}
  }
  ambientNodes.length = 0;
  engineOsc?.disconnect();
  engineSubOsc?.disconnect();
  engineGain?.disconnect();
  engineFilter?.disconnect();
  ambienceGain?.disconnect();
  engineOsc = null;
  engineSubOsc = null;
  engineGain = null;
  engineFilter = null;
  ambienceGain = null;
}
export function setEngine(speed01: number, boosting: boolean) {
  if (!engineOsc || !engineSubOsc || !engineGain || !engineFilter || !ctx) return;
  const speed = Math.max(0, Math.min(1, speed01));
  const target = 72 + speed * (boosting ? 230 : 165);
  const now = ctx.currentTime;
  engineOsc.frequency.linearRampToValueAtTime(target, now + 0.1);
  engineSubOsc.frequency.linearRampToValueAtTime(target * 0.5, now + 0.1);
  engineFilter.frequency.linearRampToValueAtTime(520 + speed * (boosting ? 900 : 520), now + 0.12);
  engineGain.gain.linearRampToValueAtTime(0.035 + speed * 0.075 + (boosting ? 0.025 : 0), now + 0.1);
}

export function playBeep(freq = 600, duration = 0.18, type: OscillatorType = "triangle") {
  const c = ensure(); if (!c || !masterGain) return;
  const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
  const filter = c.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 1600;
  const g = c.createGain(); g.gain.value = 0;
  o.connect(filter).connect(g).connect(masterGain);
  const now = c.currentTime;
  g.gain.linearRampToValueAtTime(0.18, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, now + duration);
  o.start(now); o.stop(now + duration + 0.02);
}

function playNoiseBurst(duration: number, gainValue: number, filterType: BiquadFilterType, startFreq: number, endFreq: number) {
  const c = ensure(); if (!c || !masterGain) return;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * duration), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const fade = 1 - i / d.length;
    d[i] = (Math.random() * 2 - 1) * fade * fade;
  }
  const src = c.createBufferSource(); src.buffer = buf;
  const filter = c.createBiquadFilter(); filter.type = filterType; filter.frequency.value = startFreq; filter.Q.value = 0.65;
  const g = c.createGain(); g.gain.value = gainValue;
  src.connect(filter).connect(g).connect(masterGain);
  filter.frequency.linearRampToValueAtTime(endFreq, c.currentTime + duration);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  src.start();
}

export function playNitroSwoosh() {
  playNoiseBurst(0.55, 0.22, "bandpass", 260, 1500);
  playBeep(164, 0.22, "sine");
}

export function playDriftScreech() {
  playNoiseBurst(0.22, 0.13, "highpass", 520, 860);
}

export function playCrash() {
  playNoiseBurst(0.25, 0.2, "lowpass", 180, 90);
}

export function playFanfare() {
  const notes = [523, 659, 784, 1046];
  notes.forEach((f, i) => setTimeout(() => playBeep(f, 0.32, "triangle"), i * 120));
}

export function playCountdownBeep(go = false) {
  playBeep(go ? 880 : 440, go ? 0.4 : 0.18, "triangle");
}
