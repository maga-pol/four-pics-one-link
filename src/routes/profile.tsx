import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CarFront,
  Coins,
  Flag,
  Flame,
  Gauge,
  LogOut,
  Save,
  Trophy,
  UserCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  CarFigure,
  CARS,
  DRIVERS,
  DriverFigure,
  defaultState,
  getAccountStorageKey,
  getRankInfo,
  readGameState,
  type GameState,
} from "@/lib/garage";
import { FeedbackToast, PremiumStat, ProgressionPanel, RacingShell } from "@/lib/racing-ui";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile - World Quiz Race" }] }),
  component: ProfilePage,
});

const BEST_KEY = "wqr-best-times";

function readBestCount() {
  if (typeof window === "undefined") return 0;
  try {
    return Object.keys(JSON.parse(localStorage.getItem(getAccountStorageKey(BEST_KEY)) ?? "{}"))
      .length;
  } catch {
    return 0;
  }
}

function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [game, setGame] = useState<GameState>(() => defaultState());
  const bestCount = useMemo(readBestCount, []);

  useEffect(() => {
    setGame(readGameState());
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      setUser(data.user);
      setName(data.user.user_metadata?.full_name ?? data.user.email?.split("@")[0] ?? "Racer");
    });
  }, [navigate]);

  function showFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 2200);
  }

  async function saveProfile() {
    setSaving(true);
    const { data, error } = await supabase.auth.updateUser({
      data: { full_name: name.trim() || "Racer" },
    });
    if (!error && data.user) {
      setUser(data.user);
      showFeedback("Profile saved");
    } else {
      showFeedback(error?.message ?? "Could not save profile");
    }
    setSaving(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (!user) {
    return (
      <RacingShell>
        <div className="grid min-h-[50vh] place-items-center text-sm font-bold uppercase tracking-[0.12em] text-[#969696]">
          Loading profile
        </div>
      </RacingShell>
    );
  }

  const ownedCars = new Set(game.ownedCarIds ?? []);
  const ownedDrivers = new Set(game.unlockedDriverIds ?? []);
  const selectedCar = CARS.find((car) => ownedCars.has(car.id) && car.id === game.selectedCarId);
  const selectedDriver = DRIVERS.find(
    (driver) => ownedDrivers.has(driver.id) && driver.id === game.selectedDriverId,
  );
  const rank = getRankInfo(game);

  return (
    <RacingShell>
      <FeedbackToast message={feedback} />
      <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="border border-[#303030] bg-[#181818] p-6">
          <div className="flex items-center gap-4">
            {user.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt=""
                className="h-20 w-20 border border-[#303030]"
              />
            ) : (
              <div className="grid h-20 w-20 place-items-center bg-[#da291c]">
                <UserCircle className="h-11 w-11 text-white" />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#da291c]">
                Racer profile
              </div>
              <h1 className="font-display truncate text-4xl text-white">{name || "Racer"}</h1>
              <p className="truncate text-xs text-[#969696]">{user.email}</p>
            </div>
          </div>

          <div className="mt-6 border border-[#5a4218] bg-[#2a1f08] p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#f5c518]">
              Rank
            </div>
            <div className="font-display mt-1 text-3xl uppercase text-white">{rank.rank}</div>
          </div>

          <label className="mt-6 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#969696]">
            Display name
          </label>
          <div className="mt-2 flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-w-0 flex-1 border border-[#303030] bg-[#111] px-3 py-3 text-sm font-bold text-white outline-none transition focus:border-[#da291c]"
            />
            <button
              type="button"
              onClick={saveProfile}
              disabled={saving}
              className="arcade-btn h-12 px-4"
            >
              <Save className="h-4 w-4" /> Save
            </button>
          </div>

          <div className="mt-4 flex gap-2">
            <Link to="/garage" className="arcade-btn arcade-btn-ghost h-10 flex-1 px-4">
              Garage
            </Link>
            <Link to="/drivers" className="arcade-btn arcade-btn-ghost h-10 flex-1 px-4">
              Drivers
            </Link>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="arcade-btn arcade-btn-ghost mt-3 h-10 w-full"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <PremiumStat icon={<Coins className="h-5 w-5" />} label="Coins" value={game.coins ?? 0} />
          <PremiumStat icon={<Trophy className="h-5 w-5" />} label="Wins" value={game.wins ?? 0} />
          <PremiumStat
            icon={<Flag className="h-5 w-5" />}
            label="Total races"
            value={game.totalRaces ?? 0}
          />
          <PremiumStat
            icon={<Gauge className="h-5 w-5" />}
            label="Quizzes"
            value={game.totalQuizzesCompleted ?? 0}
          />
          <PremiumStat
            icon={<Flame className="h-5 w-5" />}
            label="Win streak"
            value={game.winStreak ?? 0}
          />
          <PremiumStat icon={<Trophy className="h-5 w-5" />} label="Best times" value={bestCount} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <ProgressionPanel state={game} />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="border border-[#303030] bg-[#181818] p-5">
            <div className="mb-3 flex items-center gap-2 text-[#f5c518]">
              <CarFront className="h-5 w-5" />
              <span className="text-[11px] font-bold uppercase tracking-[0.12em]">
                Favorite car
              </span>
            </div>
            {selectedCar ? (
              <CarFigure car={selectedCar} compact />
            ) : (
              <div className="grid min-h-[130px] place-items-center border border-dashed border-[#303030] bg-[#111]">
                <CarFront className="h-9 w-9 text-[#696969]" />
              </div>
            )}
            <div className="mt-3 font-display text-xl uppercase text-white">
              {selectedCar?.name ?? "No car owned"}
            </div>
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#969696]">
              {selectedCar?.team ?? "Buy one in garage"}
            </div>
          </div>
          <div className="border border-[#303030] bg-[#181818] p-5">
            <div className="mb-3 flex items-center gap-2 text-[#f5c518]">
              <UserCircle className="h-5 w-5" />
              <span className="text-[11px] font-bold uppercase tracking-[0.12em]">
                Favorite driver
              </span>
            </div>
            {selectedDriver ? (
              <DriverFigure driver={selectedDriver} size="small" />
            ) : (
              <div className="grid min-h-[130px] place-items-center border border-dashed border-[#303030] bg-[#111]">
                <UserCircle className="h-9 w-9 text-[#696969]" />
              </div>
            )}
            <div className="mt-3 font-display text-xl uppercase text-white">
              {selectedDriver?.name ?? "No driver owned"}
            </div>
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#969696]">
              {selectedDriver?.team ?? "Buy one in drivers"}
            </div>
            <div className="mt-2 inline-flex border border-[#5a4218] bg-[#2a1f08] px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#f5c518]">
              {selectedDriver?.bonus ?? "No bonus"}
            </div>
          </div>
        </div>
      </section>
    </RacingShell>
  );
}
