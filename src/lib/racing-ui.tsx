import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Car, Flag, Flame, Home, Map, Trophy, UserCircle } from "lucide-react";
import { getRankInfo, type GameState } from "@/lib/garage";

const navItems = [
  { to: "/", label: "Home", icon: Home },
  { to: "/tracks", label: "Tracks", icon: Map },
  { to: "/garage", label: "Garage", icon: Car },
  { to: "/drivers", label: "Drivers", icon: Flag },
  { to: "/profile", label: "Profile", icon: Trophy },
] as const;

export function RacingShell({ children, topSlot }: { children: ReactNode; topSlot?: ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[#181818]" />
      <div className="pointer-events-none absolute inset-0 ps-grid-bg opacity-20" />
      <div className="pointer-events-none absolute left-0 top-0 h-72 w-72 bg-[#da291c]/10 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 bg-[#f5c518]/10 blur-[130px]" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1280px] flex-col gap-4 p-3 pb-24 sm:p-5 sm:pb-5">
        <RacingTopNav topSlot={topSlot} />
        {children}
      </div>
    </main>
  );
}

export function RacingTopNav({ topSlot }: { topSlot?: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <header className="flex flex-col gap-3 border-b border-[#303030] pb-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center bg-[#da291c] text-lg">🏁</span>
          <span className="leading-tight">
            <span className="block text-[11px] font-bold uppercase tracking-[0.11em] text-[#da291c]">
              World Quiz Race
            </span>
            <span className="block text-sm font-semibold uppercase tracking-[0.05em] text-white sm:text-base">
              Race Hub
            </span>
          </span>
        </Link>

        {topSlot}
      </div>

      <nav className="grid grid-cols-5 gap-1 border border-[#303030] bg-[#111] p-1">
        {navItems.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={`flex h-11 items-center justify-center gap-2 px-3 text-[11px] font-bold uppercase tracking-[0.1em] transition ${
                active
                  ? "bg-[#da291c] text-white shadow-[0_0_28px_-12px_rgba(218,41,28,0.9)]"
                  : "text-[#969696] hover:bg-[#1e1e1e] hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

export function ProgressionPanel({
  state,
  compact = false,
}: {
  state: GameState;
  compact?: boolean;
}) {
  const rank = getRankInfo(state);
  const week = getCurrentWeek();
  const winDates = new Set(state.raceWinDates ?? []);
  const weekWins = week.filter((day) => winDates.has(day.key)).length;

  return (
    <div className={`border border-[#303030] bg-[#111] ${compact ? "p-4" : "p-5"}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#da291c]">
            Road To Champion
          </div>
          <div className="font-display mt-1 text-2xl uppercase text-white">{rank.rank}</div>
        </div>
        <div className="text-right text-xs font-bold uppercase tracking-[0.12em] text-[#f5c518]">
          {rank.progress}%
        </div>
      </div>
      <div className="mt-4 h-3 overflow-hidden border border-[#303030] bg-[#181818]">
        <div
          className="h-full bg-[#da291c] shadow-[0_0_18px_rgba(218,41,28,0.7)] transition-[width] duration-500"
          style={{ width: `${rank.progress}%` }}
        />
      </div>
      <div className="mt-4 grid grid-cols-4 gap-1 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-[#696969]">
        {rank.ranks.map((item) => (
          <div key={item} className={item === rank.rank ? "text-[#f5c518]" : ""}>
            {item}
          </div>
        ))}
      </div>
      {!compact && (
        <div className="mt-5 border-t border-[#303030] pt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#f5c518]">
              <Flame className="h-4 w-4 text-[#da291c]" />
              Win Streak
            </div>
            <div className="text-[11px] font-black uppercase tracking-[0.1em] text-white">
              {weekWins}/7 this week
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {week.map((day) => {
              const active = winDates.has(day.key);
              return (
                <div
                  key={day.key}
                  className={`relative flex h-14 flex-col items-center justify-center border text-[10px] font-black uppercase tracking-[0.06em] transition ${
                    active
                      ? "border-[#f5c518] bg-[#3a2505] text-[#f5c518] shadow-[0_0_24px_-12px_rgba(245,197,24,0.95)]"
                      : day.today
                        ? "border-[#da291c] bg-[#1e1e1e] text-white"
                        : "border-[#303030] bg-[#181818] text-[#696969]"
                  }`}
                  title={active ? `Race won on ${day.key}` : `No race win on ${day.key}`}
                >
                  <span>{day.label}</span>
                  <span className="mt-1 text-[9px]">
                    {active ? "WIN" : day.today ? "NOW" : "--"}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.1em] text-[#696969]">
            <span>Win one race each day</span>
            <span className="text-[#da291c]">Best {state.bestWinStreak ?? 0}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentWeek() {
  const labels = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const today = new Date();
  const mondayOffset = (today.getDay() + 6) % 7;
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  start.setDate(today.getDate() - mondayOffset);
  const todayKey = dateKey(today);

  return labels.map((label, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = dateKey(date);
    return { label, key, today: key === todayKey };
  });
}

export function PremiumStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="group border border-[#303030] bg-[#1e1e1e] p-4 transition hover:border-[#da291c]/70 hover:shadow-[0_0_34px_-20px_rgba(218,41,28,0.9)]">
      <div className="flex items-center gap-2 text-[#f5c518]">
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-[0.12em]">{label}</span>
      </div>
      <div className="font-display mt-2 text-3xl text-white">{value}</div>
    </div>
  );
}

export function FeedbackToast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 border border-[#5a4218] bg-[#2a1f08] px-5 py-3 text-sm font-bold uppercase tracking-[0.1em] text-[#f5c518] shadow-[0_0_36px_-14px_rgba(245,197,24,0.9)] animate-feedback-pop">
      {message}
    </div>
  );
}

export function UserBadge() {
  return (
    <Link
      to="/profile"
      className="grid h-10 w-10 place-items-center border border-[#303030] bg-[#1e1e1e] text-white transition hover:border-[#da291c]"
    >
      <UserCircle className="h-5 w-5" />
    </Link>
  );
}
