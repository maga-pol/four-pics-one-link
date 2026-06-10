import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Coins, Gauge, Lock, Move, Rocket, ShoppingCart, Zap } from "lucide-react";
import {
  CARS,
  CarFigure,
  MiniStat,
  STARTER_CAR_ID,
  defaultState,
  defaultUpgrades,
  getCarUpgrades,
  normalizeState,
  readGameState,
  writeGameState,
  type GameState,
  type RaceCar,
  type UpgradeKey,
} from "@/lib/garage";
import { FeedbackToast, PremiumStat, RacingShell } from "@/lib/racing-ui";

export const Route = createFileRoute("/garage")({
  head: () => ({ meta: [{ title: "Garage - World Quiz Race" }] }),
  component: GaragePage,
});

const MAX_LEVEL = 5;
const COSTS = [1500, 3000, 5500, 8500, 12000];
const UPGRADES: { key: UpgradeKey; label: string; icon: React.ReactNode }[] = [
  { key: "speed", label: "Speed", icon: <Gauge className="h-5 w-5" /> },
  { key: "acceleration", label: "Acceleration", icon: <Rocket className="h-5 w-5" /> },
  { key: "nitro", label: "Nitro", icon: <Zap className="h-5 w-5" /> },
  { key: "control", label: "Control", icon: <Move className="h-5 w-5" /> },
];

function GaragePage() {
  const [game, setGame] = useState<GameState>(() => defaultState());
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => setGame(readGameState()), []);

  function showFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 2200);
  }

  function updateGarage(updater: (current: GameState) => GameState, success: string) {
    setGame((current) => {
      const next = normalizeState(updater(current));
      writeGameState(next);
      return next;
    });
    showFeedback(success);
  }

  function selectCar(carId: string) {
    const owned = new Set(game.ownedCarIds ?? []);
    if (!owned.has(carId)) return;
    updateGarage((current) => ({ ...current, selectedCarId: carId }), "Vehicle equipped");
  }

  function buyCar(car: RaceCar) {
    const owned = new Set(game.ownedCarIds ?? []);
    if (owned.has(car.id)) {
      selectCar(car.id);
      return;
    }
    if ((game.coins ?? 0) < car.cost) {
      showFeedback("Need more coins");
      return;
    }
    updateGarage(
      (current) => ({
        ...current,
        coins: (current.coins ?? 0) - car.cost,
        ownedCarIds: Array.from(new Set([...(current.ownedCarIds ?? []), car.id])),
        carUpgrades: {
          ...(current.carUpgrades ?? {}),
          [car.id]: defaultUpgrades(),
        },
        selectedCarId: car.id,
      }),
      "New vehicle unlocked",
    );
  }

  function buyUpgrade(key: UpgradeKey) {
    const selectedCarId = game.selectedCarId;
    if (!selectedCarId || !(game.ownedCarIds ?? []).includes(selectedCarId)) {
      showFeedback("Select a car first");
      return;
    }
    const upgrades = getCarUpgrades(game, selectedCarId);
    const lvl = upgrades[key] ?? 0;
    if (lvl >= MAX_LEVEL) return;
    const cost = COSTS[lvl];
    if ((game.coins ?? 0) < cost) {
      showFeedback("Need more coins");
      return;
    }
    updateGarage(
      (current) => ({
        ...current,
        coins: (current.coins ?? 0) - cost,
        carUpgrades: {
          ...(current.carUpgrades ?? {}),
          [selectedCarId]: {
            ...defaultUpgrades(),
            ...getCarUpgrades(current, selectedCarId),
            [key]: lvl + 1,
          },
        },
      }),
      "Car upgraded",
    );
  }

  const ownedCars = new Set(game.ownedCarIds ?? []);
  const selectedCar = CARS.find((car) => ownedCars.has(car.id) && car.id === game.selectedCarId);
  const upgrades = getCarUpgrades(game, selectedCar?.id);

  return (
    <RacingShell>
      <FeedbackToast message={feedback} />
      <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="border border-[#303030] bg-[#181818] p-6">
          <div className="mb-5 flex items-end justify-between border-b border-[#303030] pb-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#da291c]">
                Garage
              </div>
              <h1 className="font-display mt-1 text-3xl text-white">
                {selectedCar ? "Current selected car" : "No car owned"}
              </h1>
            </div>
            <PremiumStat
              icon={<Coins className="h-4 w-4" />}
              label="Coins"
              value={game.coins ?? 0}
            />
          </div>
          <div className="relative border border-[#da291c] bg-[#111] p-5 shadow-[0_0_44px_-22px_rgba(218,41,28,0.9)]">
            <div className="pointer-events-none absolute inset-x-12 bottom-16 h-20 bg-[#da291c]/20 blur-[48px]" />
            {selectedCar ? (
              <CarFigure
                car={selectedCar}
                className="relative z-10 mx-auto w-full max-w-[620px] animate-car-hero"
              />
            ) : (
              <div className="relative z-10 grid min-h-[260px] place-items-center border border-dashed border-[#303030] bg-[#181818] text-center">
                <div>
                  <Lock className="mx-auto h-10 w-10 text-[#696969]" />
                  <div className="font-display mt-3 text-3xl uppercase text-white">
                    Empty garage
                  </div>
                  <div className="mt-2 text-xs font-bold uppercase tracking-[0.1em] text-[#969696]">
                    Earn quiz coins and buy your first car below.
                  </div>
                </div>
              </div>
            )}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="font-display text-3xl uppercase text-white">
                  {selectedCar?.name ?? "No vehicle"}
                </div>
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#969696]">
                  {selectedCar?.team ?? "Buy a car to start racing"}
                </div>
              </div>
              <div className="flex gap-2">
                <MiniStat label="Speed" value={selectedCar?.speed ?? 0} />
                <MiniStat label="Grip" value={selectedCar?.grip ?? 0} />
              </div>
            </div>
          </div>
        </div>

        <div className="border border-[#303030] bg-[#181818] p-6">
          <div className="mb-5 border-b border-[#303030] pb-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#da291c]">
              Upgrades
            </div>
            <h2 className="font-display mt-1 text-2xl text-white">
              Tune {selectedCar?.name ?? "selected car"}
            </h2>
          </div>
          <div className="grid gap-3">
            {UPGRADES.map((upgrade) => {
              const lvl = upgrades[upgrade.key] ?? 0;
              const max = lvl >= MAX_LEVEL;
              const cost = max ? 0 : COSTS[lvl];
              return (
                <div key={upgrade.key} className="border border-[#303030] bg-[#111] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-11 w-11 place-items-center border border-[#303030] bg-[#252525] text-[#f5c518]">
                        {upgrade.icon}
                      </span>
                      <div>
                        <div className="text-sm font-bold uppercase tracking-[0.1em] text-white">
                          {upgrade.label}
                        </div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#969696]">
                          Level {lvl}/{MAX_LEVEL}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => buyUpgrade(upgrade.key)}
                      disabled={max || (game.coins ?? 0) < cost}
                      className="arcade-btn h-10 px-4"
                    >
                      {max ? "Maxed" : `Upgrade ${cost}`}
                    </button>
                  </div>
                  <div className="mt-4 h-3 overflow-hidden border border-[#303030] bg-[#181818]">
                    <div
                      className="h-full bg-[#da291c] transition-[width] duration-500"
                      style={{ width: `${(lvl / MAX_LEVEL) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border border-[#303030] bg-[#181818] p-6">
        <div className="mb-5 flex items-end justify-between border-b border-[#303030] pb-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#da291c]">
              Car Collection
            </div>
            <h2 className="font-display mt-1 text-2xl text-white">Vehicles and skins</h2>
          </div>
          <div className="text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#969696]">
            Starter: Red Bull Racing
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {CARS.map((car) => {
            const owned = ownedCars.has(car.id);
            const active = owned && car.id === selectedCar?.id;
            const canBuy = (game.coins ?? 0) >= car.cost;
            return (
              <div
                key={car.id}
                className={`border bg-[#111] p-4 transition hover:border-[#da291c]/70 ${active ? "border-[#da291c] shadow-[0_0_34px_-20px_rgba(218,41,28,0.9)]" : "border-[#303030]"}`}
              >
                <CarFigure car={car} compact />
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display truncate text-lg uppercase tracking-[0.06em] text-white">
                      {car.name}
                    </div>
                    <div className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-[#969696]">
                      {car.team}
                    </div>
                  </div>
                  {owned ? (
                    <Check className="h-5 w-5 shrink-0 text-[#03904a]" />
                  ) : (
                    <Lock className="h-5 w-5 shrink-0 text-[#696969]" />
                  )}
                </div>
                <div className="mt-3 flex gap-1">
                  {car.colors.map((color) => (
                    <span
                      key={color}
                      className="h-5 flex-1 border border-[#303030]"
                      style={{ background: color }}
                    />
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <MiniStat label="Speed" value={car.speed} />
                  <MiniStat label="Grip" value={car.grip} />
                </div>
                <button
                  type="button"
                  onClick={() => (owned ? selectCar(car.id) : buyCar(car))}
                  disabled={!owned && !canBuy}
                  className={`mt-4 flex h-11 w-full items-center justify-center gap-2 px-3 text-[12px] font-bold uppercase tracking-[0.1em] transition ${
                    active
                      ? "bg-[#252525] text-[#969696]"
                      : owned
                        ? "bg-[#da291c] text-white hover:bg-[#b01e0a]"
                        : canBuy
                          ? "bg-[#f5c518] text-[#1a1100] hover:bg-[#ffd633]"
                          : "cursor-not-allowed border border-[#303030] bg-[#1e1e1e] text-[#696969]"
                  }`}
                >
                  {active ? (
                    "Equipped"
                  ) : owned ? (
                    "Equip"
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4" /> {car.cost}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </RacingShell>
  );
}
