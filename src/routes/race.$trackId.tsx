import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Flag, Gauge, Trophy, Zap, ChevronRight } from "lucide-react";
import { getTrack } from "@/lib/tracks";

export const Route = createFileRoute("/race/$trackId")({
  head: () => ({ meta: [{ title: "Race · World Quiz Race" }] }),
  component: RaceScreen,
});

function RaceScreen() {
  const { trackId } = useParams({ from: "/race/$trackId" });
  const track = getTrack(trackId);

  const [stage, setStage] = useState(0);
  const [progress, setProgress] = useState(0); // 0..100 within current stage
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!running || !track) return;
    const id = setInterval(() => {
      setProgress((p) => {
        if (p < 100) return Math.min(100, p + 1.4);
        // stage done
        if (stage < track.stages.length - 1) {
          setStage((s) => s + 1);
          return 0;
        }
        setRunning(false);
        setFinished(true);
        return 100;
      });
    }, 60);
    return () => clearInterval(id);
  }, [running, stage, track]);

  const stages = track?.stages ?? [];
  const totalProgress = useMemo(() => {
    if (!stages.length) return 0;
    return ((stage + progress / 100) / stages.length) * 100;
  }, [stage, progress, stages.length]);

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

  const current = stages[stage];
  const speed = Math.round(220 + Math.sin(progress / 8) * 40);

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
            <span>{stage}/{stages.length}</span>
          </div>
        </header>

        {/* Current stage card */}
        <section className="overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 via-secondary/10 to-transparent p-5 shadow-glow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{current.flag}</span>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-neon">Stage {stage + 1}</div>
                <div className="text-lg font-black">{current.name}</div>
                <div className="text-[11px] text-muted-foreground">{current.country} · {current.length} · {current.corners} corners</div>
              </div>
            </div>
            <div className="rounded-full bg-background/60 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-foreground">
              {finished ? "Finished" : running ? "Racing" : "Ready"}
            </div>
          </div>

          {/* Racing strip */}
          <div className="relative mt-5 h-28 overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-background/40 to-background/80">
            {/* Road */}
            <div
              className={`absolute inset-x-0 bottom-5 h-3 bg-[repeating-linear-gradient(90deg,transparent_0_24px,oklch(0.82_0.22_200/0.7)_24px_44px)] ${running ? "animate-road" : ""}`}
            />
            {/* Distant glow lines */}
            <div className="absolute inset-x-0 top-6 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <div className="absolute inset-x-0 top-12 h-px bg-gradient-to-r from-transparent via-neon/40 to-transparent" />
            {/* Car */}
            <div
              className="absolute bottom-2 transition-[left] duration-100 ease-linear"
              style={{ left: `calc(${progress}% - 36px)` }}
            >
              <MiniCar />
            </div>
            {/* Flag at end */}
            <div className="absolute bottom-3 right-2 text-lg">🏁</div>
          </div>

          {/* Stage progress */}
          <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Lap progress</span>
            <span className="font-bold text-foreground">{Math.round(progress)}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-card/60">
            <div
              className="h-full bg-gradient-primary transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Telemetry */}
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Telemetry icon={<Gauge className="h-3.5 w-3.5" />} label="Speed" value={`${speed} km/h`} />
            <Telemetry icon={<Zap className="h-3.5 w-3.5" />} label="Boost" value={running ? "Active" : "Idle"} />
            <Telemetry icon={<Flag className="h-3.5 w-3.5" />} label="Stage" value={`${stage + 1}/${stages.length}`} />
          </div>

          {/* Controls */}
          <div className="mt-4 flex gap-2">
            {!finished ? (
              <button
                type="button"
                onClick={() => setRunning((r) => !r)}
                className="flex-1 rounded-xl bg-gradient-primary px-4 py-3 text-sm font-black uppercase tracking-wider text-primary-foreground shadow-button transition hover:scale-[1.02] active:scale-[0.98]"
              >
                {running ? "Pause" : progress > 0 || stage > 0 ? "Resume" : "Start Race"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setStage(0); setProgress(0); setFinished(false); setRunning(false); }}
                className="flex-1 rounded-xl bg-gradient-primary px-4 py-3 text-sm font-black uppercase tracking-wider text-primary-foreground shadow-button transition hover:scale-[1.02] active:scale-[0.98]"
              >
                Race Again
              </button>
            )}
            <Link
              to="/quiz"
              className="rounded-xl border border-border bg-card/60 px-4 py-3 text-xs font-bold uppercase tracking-wider backdrop-blur transition hover:border-primary/60"
            >
              Earn Coins
            </Link>
          </div>
        </section>

        {/* Stages list */}
        <section className="rounded-2xl border border-border bg-card/50 p-3 backdrop-blur-md">
          <h2 className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Circuit Stages</h2>
          <div className="relative">
            <div className="absolute left-2 right-2 top-4 h-0.5 rounded-full bg-border" />
            <div
              className="absolute left-2 top-4 h-0.5 rounded-full bg-gradient-to-r from-neon via-primary to-secondary transition-all duration-200"
              style={{ width: `calc(${totalProgress}% - 4px)` }}
            />
            <div className="relative flex items-start justify-between">
              {stages.map((s, i) => {
                const active = i === stage;
                const done = i < stage || (finished && i === stage);
                return (
                  <div key={s.name} className="flex w-1/4 flex-col items-center gap-1.5 px-1">
                    <div
                      className={`grid h-7 w-7 place-items-center rounded-full border-2 text-[10px] font-black ${
                        done
                          ? "border-emerald-400 bg-emerald-400/30 text-emerald-200"
                          : active
                          ? "border-neon bg-neon text-background animate-pulse-glow"
                          : "border-border bg-background text-muted-foreground"
                      }`}
                    >
                      {i + 1}
                    </div>
                    <div className="text-center">
                      <div className={`text-[10px] font-bold leading-tight ${active ? "text-foreground" : "text-muted-foreground"}`}>
                        {s.name}
                      </div>
                      <div className="text-[9px] text-muted-foreground">{s.flag}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {finished && (
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-3 text-xs font-bold uppercase tracking-wider backdrop-blur"
          >
            Back to HUB <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </main>
  );
}

function Telemetry({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-2">
      <div className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-0.5 text-sm font-black text-foreground">{value}</div>
    </div>
  );
}

function MiniCar() {
  return (
    <svg viewBox="0 0 80 32" className="h-10 w-20 drop-shadow-[0_6px_10px_oklch(0.68_0.22_285/0.7)]">
      <defs>
        <linearGradient id="mc-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.85 0.18 200)" />
          <stop offset="100%" stopColor="oklch(0.55 0.22 285)" />
        </linearGradient>
      </defs>
      <path d="M4 22 L14 14 Q26 8 50 8 L66 12 Q74 16 76 22 L76 24 L4 24 Z" fill="url(#mc-body)" stroke="oklch(0.95 0.05 200)" strokeWidth="0.6" />
      <path d="M22 14 Q32 10 50 10 L62 12 L60 18 L24 18 Z" fill="oklch(0.2 0.04 270)" opacity="0.8" />
      <ellipse cx="40" cy="28" rx="34" ry="2" fill="oklch(0.82 0.22 200)" opacity="0.5" />
      <circle cx="18" cy="24" r="5" fill="oklch(0.1 0.02 270)" />
      <circle cx="18" cy="24" r="2" fill="oklch(0.82 0.22 200)" />
      <circle cx="62" cy="24" r="5" fill="oklch(0.1 0.02 270)" />
      <circle cx="62" cy="24" r="2" fill="oklch(0.82 0.22 200)" />
    </svg>
  );
}