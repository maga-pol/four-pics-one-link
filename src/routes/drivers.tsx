import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Flag, Lock, Trophy } from "lucide-react";
import {
  DRIVER_UNLOCK_STEP,
  DRIVERS,
  DriverFigure,
  defaultState,
  getSelectedDriver,
  normalizeState,
  readGameState,
  writeGameState,
  type GameState,
} from "@/lib/garage";
import { FeedbackToast, ProgressionPanel, RacingShell } from "@/lib/racing-ui";

export const Route = createFileRoute("/drivers")({
  head: () => ({ meta: [{ title: "Drivers - World Quiz Race" }] }),
  component: DriversPage,
});

function DriversPage() {
  const [game, setGame] = useState<GameState>(() => defaultState());
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => setGame(readGameState()), []);

  function showFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 2200);
  }

  function selectDriver(driverId: string) {
    const unlocked = new Set(game.unlockedDriverIds ?? []);
    if (!unlocked.has(driverId)) {
      showFeedback(`Finish ${DRIVER_UNLOCK_STEP} tracks P3+ to unlock drivers`);
      return;
    }
    setGame((current) => {
      const next = normalizeState({ ...current, selectedDriverId: driverId });
      writeGameState(next);
      return next;
    });
    showFeedback("Driver selected");
  }

  const selectedDriver = getSelectedDriver(game);
  const unlockedDrivers = new Set(game.unlockedDriverIds ?? []);
  const podiumCount = new Set(game.podiumTrackIds ?? []).size;
  const nextUnlockProgress = podiumCount % DRIVER_UNLOCK_STEP;

  return (
    <RacingShell>
      <FeedbackToast message={feedback} />
      <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="border border-[#303030] bg-[#181818] p-6">
          <div className="mb-5 border-b border-[#303030] pb-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#da291c]">Active Driver</div>
            <h1 className="font-display mt-1 text-3xl text-white">{selectedDriver.name}</h1>
          </div>
          <div className="border border-[#da291c] bg-[#111] p-5 text-center shadow-[0_0_44px_-22px_rgba(218,41,28,0.9)]">
            <DriverFigure driver={selectedDriver} size="large" />
            <div className="mt-4 font-display text-2xl uppercase text-white">{selectedDriver.code}</div>
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#969696]">{selectedDriver.team}</div>
            <div className="mt-4 inline-flex border border-[#5a4218] bg-[#2a1f08] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#f5c518]">
              {selectedDriver.bonus}
            </div>
          </div>
          <div className="mt-4">
            <ProgressionPanel state={game} compact />
          </div>
        </div>

        <div className="border border-[#303030] bg-[#181818] p-6">
          <div className="mb-5 flex items-end justify-between gap-3 border-b border-[#303030] pb-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#da291c]">Drivers</div>
              <h2 className="font-display mt-1 text-2xl text-white">F1 driver collection</h2>
            </div>
            <div className="text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#969696]">
              Unlock {nextUnlockProgress}/{DRIVER_UNLOCK_STEP}
            </div>
          </div>
          <div className="grid max-h-[690px] grid-cols-2 gap-3 overflow-y-auto pr-1 md:grid-cols-3 xl:grid-cols-4">
            {DRIVERS.map((driver) => {
              const active = driver.id === selectedDriver.id;
              const unlocked = unlockedDrivers.has(driver.id);
              return (
                <button
                  key={driver.id}
                  type="button"
                  onClick={() => selectDriver(driver.id)}
                  className={`relative border p-3 text-left transition hover:border-[#da291c]/70 ${
                    active ? "border-[#da291c] bg-[#251514] shadow-[0_0_34px_-22px_rgba(218,41,28,0.9)]" : "border-[#303030] bg-[#111]"
                  } ${unlocked ? "" : "opacity-60"}`}
                >
                  {!unlocked && (
                    <div className="absolute right-2 top-2 grid h-6 w-6 place-items-center border border-[#303030] bg-[#181818]">
                      <Lock className="h-3.5 w-3.5 text-[#696969]" />
                    </div>
                  )}
                  {active && (
                    <div className="absolute left-2 top-2 grid h-6 w-6 place-items-center bg-[#f5c518] text-[#1a1100]">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                  )}
                  <DriverFigure driver={driver} size="small" />
                  <div className="mt-2">
                    <div className="truncate text-[12px] font-bold uppercase tracking-[0.08em] text-white">{driver.name}</div>
                    <div className="truncate text-[10px] font-bold uppercase tracking-[0.1em] text-[#969696]">{driver.team}</div>
                    <div className="mt-2 inline-flex items-center gap-1 border border-[#5a4218] bg-[#2a1f08] px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#f5c518]">
                      <Flag className="h-3 w-3" /> {driver.bonus}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <DriverRule icon={<Trophy className="h-5 w-5" />} label="Unlock path" value={`Every ${DRIVER_UNLOCK_STEP} P3+ track finishes`} />
        <DriverRule icon={<Flag className="h-5 w-5" />} label="Active bonus" value={selectedDriver.bonus} />
        <DriverRule icon={<Check className="h-5 w-5" />} label="Unlocked" value={`${unlockedDrivers.size}/${DRIVERS.length}`} />
      </section>
    </RacingShell>
  );
}

function DriverRule({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="border border-[#303030] bg-[#111] p-4">
      <div className="flex items-center gap-2 text-[#f5c518]">
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-[0.12em]">{label}</span>
      </div>
      <div className="mt-2 text-sm font-bold uppercase tracking-[0.08em] text-white">{value}</div>
    </div>
  );
}
