import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Check,
  Coins,
  Flag,
  Gauge,
  Lock,
  Map,
  Play,
  Route as RouteIcon,
  ShoppingCart,
} from "lucide-react";
import { TRACKS } from "@/lib/tracks";
import { normalizeState, readGameState, writeGameState, type GameState } from "@/lib/garage";
import { FeedbackToast, RacingShell } from "@/lib/racing-ui";

export const Route = createFileRoute("/tracks")({
  head: () => ({
    meta: [
      { title: "Choose Track - World Quiz Race" },
      { name: "description", content: "Choose a racing circuit and start a Grand Prix." },
    ],
  }),
  component: TrackSelect,
});

const trackTone: Record<string, { accent: string; glow: string; bg: string; tag: string }> = {
  circuit: {
    accent: "#ffb7d5",
    glow: "rgba(255,183,213,0.34)",
    bg: "linear-gradient(135deg, rgba(218,41,28,0.24), rgba(34,211,238,0.18))",
    tag: "Japan Neon",
  },
  "dubai-grand-circuit": {
    accent: "#f5c518",
    glow: "rgba(245,197,24,0.34)",
    bg: "linear-gradient(135deg, rgba(245,197,24,0.22), rgba(56,189,248,0.2))",
    tag: "Dubai Night",
  },
};

function TrackSelect() {
  const [game, setGame] = useState<GameState>(() => normalizeState({}));
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => setGame(readGameState()), []);

  function showFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 1800);
  }

  function buyTrack(trackId: string) {
    const track = TRACKS.find((item) => item.id === trackId);
    if (!track) return;
    const owned = new Set(game.ownedTrackIds ?? []);
    if (owned.has(trackId)) return;
    if ((game.coins ?? 0) < track.cost) {
      showFeedback("Need more quiz coins");
      return;
    }
    const current = readGameState();
    const next = normalizeState({
      ...current,
      coins: (current.coins ?? 0) - track.cost,
      ownedTrackIds: Array.from(new Set([...(current.ownedTrackIds ?? []), trackId])),
    });
    writeGameState(next);
    setGame(next);
    showFeedback("Track purchased");
  }

  const ownedTracks = new Set(game.ownedTrackIds ?? []);

  return (
    <RacingShell>
      <FeedbackToast message={feedback} />
      <section className="border border-[#303030] bg-[#111] p-5 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#da291c]">
              <Map className="h-4 w-4" />
              Track Select
            </div>
            <h1 className="font-display mt-2 text-4xl uppercase text-white">Choose Circuit</h1>
          </div>
          <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#969696]">
            <Coins className="mr-1 inline h-3.5 w-3.5 text-[#f5c518]" />
            {game.coins ?? 0} coins
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {TRACKS.map((track, index) => {
            const tone = trackTone[track.id] ?? trackTone.circuit;
            const owned = ownedTracks.has(track.id);
            return (
              <article
                key={track.id}
                className="relative overflow-hidden border border-[#303030] bg-[#181818] p-5"
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-80"
                  style={{ background: tone.bg }}
                />
                <div
                  className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full blur-[70px]"
                  style={{ background: tone.glow }}
                />
                <div className="relative">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div
                        className="text-[11px] font-bold uppercase tracking-[0.12em]"
                        style={{ color: tone.accent }}
                      >
                        Track {index + 1} / {tone.tag}
                      </div>
                      <h2 className="font-display mt-1 text-3xl uppercase text-white">
                        {track.name}
                      </h2>
                      <p className="mt-2 max-w-[560px] text-sm font-semibold leading-6 text-[#c7c7c7]">
                        {track.description}
                      </p>
                    </div>
                    <div className="border border-[#303030] bg-[#111]/80 px-3 py-2 text-right">
                      <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#969696]">
                        Region
                      </div>
                      <div className="text-sm font-black uppercase text-white">{track.region}</div>
                      <div className="mt-1 flex items-center justify-end gap-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#f5c518]">
                        {owned ? <Check className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                        {owned ? "Owned" : `${track.cost} coins`}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <TrackStat
                      icon={<Flag className="h-4 w-4" />}
                      label="Laps"
                      value={track.laps}
                    />
                    <TrackStat
                      icon={<Gauge className="h-4 w-4" />}
                      label="Difficulty"
                      value={track.id === "circuit" ? "Medium" : "Medium"}
                    />
                    <TrackStat
                      icon={<RouteIcon className="h-4 w-4" />}
                      label="Flow"
                      value={track.id === "circuit" ? "Technical" : "Fast"}
                    />
                  </div>

                  <div className="mt-5 grid gap-2 border-y border-[#303030] py-4 sm:grid-cols-2">
                    {track.stages.map((stage) => (
                      <div
                        key={stage.id}
                        className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#d7d7d7]"
                      >
                        <span
                          className="h-2 w-2 shrink-0"
                          style={{ background: stage.active ? "#da291c" : tone.accent }}
                        />
                        {stage.name}
                      </div>
                    ))}
                  </div>

                  {owned ? (
                    <Link
                      to={`/race/${track.id}`}
                      className="play-btn font-display mt-5 h-14 w-full"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      Start Race
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => buyTrack(track.id)}
                      disabled={(game.coins ?? 0) < track.cost}
                      className={`font-display mt-5 flex h-14 w-full items-center justify-center gap-2 px-4 text-sm font-black uppercase tracking-[0.12em] transition ${
                        (game.coins ?? 0) >= track.cost
                          ? "bg-[#f5c518] text-[#1a1100] hover:bg-[#ffd633]"
                          : "cursor-not-allowed border border-[#303030] bg-[#1e1e1e] text-[#696969]"
                      }`}
                    >
                      <ShoppingCart className="h-4 w-4" />
                      Buy Track {track.cost}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </RacingShell>
  );
}

function TrackStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="border border-[#303030] bg-[#111]/80 p-3">
      <div className="flex items-center gap-2 text-[#f5c518]">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-[0.11em]">{label}</span>
      </div>
      <div className="mt-1 text-sm font-black uppercase text-white">{value}</div>
    </div>
  );
}
