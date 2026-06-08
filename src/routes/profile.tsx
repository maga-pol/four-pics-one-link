import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Coins, Flag, Gauge, Save, Trophy, UserCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile - World Quiz Race" }] }),
  component: ProfilePage,
});

type UpgradeKey = "speed" | "acceleration" | "nitro" | "control";
type GameState = {
  coins?: number;
  wins?: number;
  unlockedTracks?: number;
  upgrades?: Partial<Record<UpgradeKey, number>>;
};

const STORAGE = "wqr-state";
const BEST_KEY = "wqr-best-times";

function readState(): GameState {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE) ?? "{}");
  } catch {
    return {};
  }
}

function readBestCount() {
  if (typeof window === "undefined") return 0;
  try {
    return Object.keys(JSON.parse(localStorage.getItem(BEST_KEY) ?? "{}")).length;
  } catch {
    return 0;
  }
}

function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const game = useMemo(readState, []);
  const bestCount = useMemo(readBestCount, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      setUser(data.user);
      setName(data.user.user_metadata?.full_name ?? data.user.email?.split("@")[0] ?? "Racer");
    });
  }, [navigate]);

  async function saveProfile() {
    setSaving(true);
    setMessage(null);
    const { data, error } = await supabase.auth.updateUser({
      data: { full_name: name.trim() || "Racer" },
    });
    if (!error && data.user) {
      setUser(data.user);
      setMessage("Profile saved");
    } else {
      setMessage(error?.message ?? "Could not save profile");
    }
    setSaving(false);
  }

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-foreground">
        <div className="text-sm font-bold uppercase tracking-[0.12em] text-[#969696]">Loading profile</div>
      </main>
    );
  }

  const upgrades = game.upgrades ?? {};

  return (
    <main className="relative min-h-screen overflow-hidden bg-background p-4 text-foreground">
      <div className="pointer-events-none absolute inset-0 ps-grid-bg opacity-30" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-4xl flex-col gap-4">
        <header className="flex items-center justify-between border-b border-[#303030] pb-4">
          <Link to="/" className="arcade-btn arcade-btn-ghost h-10 px-4">HUB</Link>
          <button
            type="button"
            onClick={() => supabase.auth.signOut().then(() => navigate({ to: "/" }))}
            className="arcade-btn arcade-btn-cyan h-10 px-4"
          >
            Sign out
          </button>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="border border-[#303030] bg-[#181818] p-6">
            <div className="flex items-center gap-4">
              {user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="" className="h-16 w-16 border border-[#303030]" />
              ) : (
                <div className="grid h-16 w-16 place-items-center bg-[#da291c]">
                  <UserCircle className="h-9 w-9 text-white" />
                </div>
              )}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#da291c]">Racer profile</div>
                <h1 className="font-display text-3xl text-white">{name || "Racer"}</h1>
                <p className="text-xs text-[#969696]">{user.email}</p>
              </div>
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
              <button type="button" onClick={saveProfile} disabled={saving} className="arcade-btn h-12 px-4">
                <Save className="h-4 w-4" /> Save
              </button>
            </div>
            {message && <p className="mt-3 text-xs font-bold text-[#f5c518]">{message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <ProfileStat icon={<Coins className="h-5 w-5" />} label="Coins" value={game.coins ?? 250} />
            <ProfileStat icon={<Trophy className="h-5 w-5" />} label="Wins" value={game.wins ?? 0} />
            <ProfileStat icon={<Flag className="h-5 w-5" />} label="Tracks" value={game.unlockedTracks ?? 1} />
            <ProfileStat icon={<Gauge className="h-5 w-5" />} label="Best times" value={bestCount} />
            <UpgradeStat label="Speed" value={upgrades.speed ?? 1} />
            <UpgradeStat label="Acceleration" value={upgrades.acceleration ?? 1} />
            <UpgradeStat label="Nitro" value={upgrades.nitro ?? 0} />
            <UpgradeStat label="Control" value={upgrades.control ?? 0} />
          </div>
        </section>
      </div>
    </main>
  );
}

function ProfileStat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="border border-[#303030] bg-[#1e1e1e] p-4">
      <div className="flex items-center gap-2 text-[#f5c518]">
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-[0.12em]">{label}</span>
      </div>
      <div className="font-display mt-2 text-3xl text-white">{value}</div>
    </div>
  );
}

function UpgradeStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-[#303030] bg-[#111] p-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#969696]">{label}</div>
      <div className="mt-2 h-2 bg-[#303030]">
        <div className="h-full bg-[#da291c]" style={{ width: `${Math.min(100, (value / 5) * 100)}%` }} />
      </div>
      <div className="mt-2 text-xs font-bold text-white">Level {value}</div>
    </div>
  );
}
