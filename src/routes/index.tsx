import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Play, HelpCircle, Layers, Settings as SettingsIcon } from "lucide-react";
import { resetAndShuffleLevels } from "@/lib/levels";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Guess The Connection — 4 images, 1 connection" },
      { name: "description", content: "A minimalist puzzle game. 4 images. 1 connection. Can you find it?" },
      { property: "og:title", content: "Guess The Connection" },
      { property: "og:description", content: "4 images. 1 connection. Can you find it?" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();

  function startGame() {
    resetAndShuffleLevels();
    navigate({ to: "/game/$level", params: { level: "1" } });
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <NeuralBackground />

      {/* Ambient gradient orbs */}
      <div className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-primary/30 blur-[120px] animate-float-slow" />
      <div
        className="pointer-events-none absolute -right-32 bottom-1/4 h-[28rem] w-[28rem] rounded-full bg-secondary/25 blur-[140px] animate-float-slow"
        style={{ animationDelay: "-6s" }}
      />

      <section className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
        <div
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground backdrop-blur-sm animate-fade-up"
          style={{ animationDelay: "0s" }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-neon animate-node-pulse" />
          Puzzle · Daily
        </div>

        <h1
          className="animate-fade-up text-balance text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl md:text-7xl"
          style={{ animationDelay: "0.1s" }}
        >
          <span className="mr-3 inline-block">🌎</span>
          <span className="text-gradient-title">Guess The Connection</span>
        </h1>

        <p
          className="mt-6 max-w-md animate-fade-up text-lg text-muted-foreground sm:text-xl"
          style={{ animationDelay: "0.2s" }}
        >
          4 images. 1 connection. <span className="text-foreground">Can you find it?</span>
        </p>

        <div
          className="mt-12 w-full max-w-sm animate-fade-up"
          style={{ animationDelay: "0.3s" }}
        >
          <Link
            to="/game/$level"
            params={{ level: "1" }}
            className="group relative inline-flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-primary px-8 py-5 text-lg font-bold text-primary-foreground shadow-button animate-pulse-glow transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98]"
          >
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            <Play className="h-5 w-5 fill-current" />
            Start Game
          </Link>
        </div>

        <div
          className="mt-6 grid w-full max-w-sm animate-fade-up grid-cols-3 gap-3"
          style={{ animationDelay: "0.4s" }}
        >
          <SecondaryButton icon={<HelpCircle className="h-4 w-4" />} label="How to Play" />
          <SecondaryButton icon={<Layers className="h-4 w-4" />} label="Levels" />
          <SecondaryButton icon={<SettingsIcon className="h-4 w-4" />} label="Settings" />
        </div>

        <p
          className="mt-12 animate-fade-up text-xs uppercase tracking-[0.3em] text-muted-foreground/70"
          style={{ animationDelay: "0.5s" }}
        >
          Think · Connect · Solve
        </p>
      </section>
    </main>
  );
}

function SecondaryButton({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      className="group flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-card/60 px-2 py-3 text-xs font-medium text-muted-foreground backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:bg-card hover:text-foreground hover:shadow-glow"
    >
      <span className="text-primary transition-colors group-hover:text-primary-glow">{icon}</span>
      {label}
    </button>
  );
}

function NeuralBackground() {
  // Static-ish neural network of nodes + connecting lines, animated with CSS.
  const nodes = [
    { cx: 10, cy: 20 }, { cx: 25, cy: 12 }, { cx: 42, cy: 28 },
    { cx: 60, cy: 15 }, { cx: 78, cy: 25 }, { cx: 90, cy: 12 },
    { cx: 15, cy: 55 }, { cx: 35, cy: 62 }, { cx: 55, cy: 50 },
    { cx: 72, cy: 60 }, { cx: 88, cy: 52 }, { cx: 8, cy: 82 },
    { cx: 30, cy: 88 }, { cx: 50, cy: 80 }, { cx: 68, cy: 92 },
    { cx: 85, cy: 80 },
  ];
  const edges: Array<[number, number]> = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5],
    [0, 6], [1, 7], [2, 8], [3, 8], [4, 9], [5, 10],
    [6, 7], [7, 8], [8, 9], [9, 10],
    [6, 11], [7, 12], [8, 13], [9, 14], [10, 15],
    [11, 12], [12, 13], [13, 14], [14, 15],
  ];

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.35]"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.75 0.25 295)" />
          <stop offset="100%" stopColor="oklch(0.82 0.22 200)" />
        </linearGradient>
      </defs>
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a].cx}
          y1={nodes[a].cy}
          x2={nodes[b].cx}
          y2={nodes[b].cy}
          stroke="url(#lineGrad)"
          strokeWidth="0.15"
          className="animate-dash"
          style={{ animationDelay: `${(i % 5) * 0.4}s` }}
        />
      ))}
      {nodes.map((n, i) => (
        <circle
          key={i}
          cx={n.cx}
          cy={n.cy}
          r="0.6"
          fill="oklch(0.82 0.22 200)"
          className="animate-node-pulse"
          style={{ animationDelay: `${(i % 6) * 0.5}s`, transformOrigin: `${n.cx}px ${n.cy}px` }}
        />
      ))}
    </svg>
  );
}
