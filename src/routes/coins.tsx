import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Coins,
  CreditCard,
  HelpCircle,
  Lock,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react";
import { normalizeState, readGameState, writeGameState, type GameState } from "@/lib/garage";
import { FeedbackToast, RacingShell } from "@/lib/racing-ui";

export const Route = createFileRoute("/coins")({
  head: () => ({ meta: [{ title: "Coins - World Quiz Race" }] }),
  component: CoinsPage,
});

const PACKS = [
  {
    id: "quiz-50",
    name: "Quiz Starter Pack",
    coins: 500,
    price: "50 quiz questions",
    icon: HelpCircle,
    tone: "border-[#f5c518] bg-[#2a1f08]",
    quiz: true,
  },
  {
    id: "street",
    name: "Street Pack",
    coins: 750,
    price: "$1.99",
    icon: Coins,
    tone: "border-[#303030] bg-[#111]",
  },
  {
    id: "pro",
    name: "Pro Pack",
    coins: 1800,
    price: "$3.99",
    icon: Zap,
    tone: "border-[#da291c]/70 bg-[#220f0d]",
  },
  {
    id: "champion",
    name: "Champion Vault",
    coins: 4200,
    price: "$7.99",
    icon: Trophy,
    tone: "border-[#f5c518]/70 bg-[#241705]",
  },
] as const;

function CoinsPage() {
  const [game, setGame] = useState<GameState>(() => normalizeState({}));
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => setGame(readGameState()), []);

  function showFeedback(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 1500);
  }

  function save(updater: (state: GameState) => GameState, feedback: string) {
    const next = updater(readGameState());
    writeGameState(next);
    setGame(next);
    showFeedback(feedback);
  }

  function claimQuizPack() {
    const current = readGameState();
    const answered = current.totalQuizzesCompleted ?? 0;
    if (current.coinQuizPackClaimed) {
      showFeedback("Already claimed");
      return;
    }
    if (answered < 50) {
      showFeedback(`${50 - answered} questions left`);
      return;
    }
    save(
      (state) => ({
        ...state,
        coins: (state.coins ?? 0) + 500,
        coinQuizPackClaimed: true,
      }),
      "+500 coins claimed",
    );
  }

  function buyPack(coins: number, name: string) {
    save(
      (state) => ({
        ...state,
        coins: (state.coins ?? 0) + coins,
      }),
      `${name} added`,
    );
  }

  const answered = game.totalQuizzesCompleted ?? 0;
  const quizProgress = Math.min(100, Math.round((answered / 50) * 100));

  return (
    <RacingShell>
      <section className="grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border border-[#303030] bg-[#111] p-4">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="grid h-10 w-10 place-items-center border border-[#303030] bg-[#1e1e1e] text-white transition hover:border-[#da291c]"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#da291c]">
                Coin Shop
              </div>
              <h1 className="font-display text-3xl uppercase text-white">Choose Coins</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 border border-[#f5c518]/50 bg-[#2a1f08] px-4 py-3 font-display text-2xl text-[#f5c518]">
            <Coins className="h-5 w-5" />
            <span className="tabular-nums">{game.coins ?? 0}</span>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-4">
          {PACKS.map((pack) => {
            const Icon = pack.icon;
            const claimed = pack.quiz && game.coinQuizPackClaimed;
            const locked = pack.quiz && !claimed && answered < 50;
            return (
              <article key={pack.id} className={`border p-5 ${pack.tone}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-12 w-12 place-items-center bg-[#f5c518] text-[#181818]">
                    <Icon className="h-6 w-6" />
                  </div>
                  {claimed && <Check className="h-5 w-5 text-emerald-300" />}
                  {locked && <Lock className="h-5 w-5 text-[#696969]" />}
                </div>
                <h2 className="mt-5 font-display text-2xl uppercase text-white">{pack.name}</h2>
                <div className="mt-2 flex items-end gap-2">
                  <span className="font-display text-4xl text-[#f5c518]">{pack.coins}</span>
                  <span className="pb-1 text-xs font-black uppercase tracking-[0.12em] text-[#969696]">
                    Coins
                  </span>
                </div>
                <div className="mt-4 border-t border-white/10 pt-4 text-xs font-black uppercase tracking-[0.12em] text-[#969696]">
                  {pack.price}
                </div>
                {pack.quiz && (
                  <>
                    <div className="mt-4 h-2 bg-[#181818]">
                      <div className="h-full bg-[#f5c518]" style={{ width: `${quizProgress}%` }} />
                    </div>
                    <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#969696]">
                      {Math.min(answered, 50)}/50 questions answered
                    </div>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => (pack.quiz ? claimQuizPack() : buyPack(pack.coins, pack.name))}
                  disabled={claimed}
                  className={`mt-5 flex h-12 w-full items-center justify-center gap-2 border px-4 text-xs font-black uppercase tracking-[0.12em] transition ${
                    claimed
                      ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-200"
                      : "border-[#da291c] bg-[#da291c] text-white hover:bg-[#b91c1c]"
                  }`}
                >
                  {pack.quiz ? (
                    claimed ? (
                      "Claimed"
                    ) : locked ? (
                      "Keep Quizzing"
                    ) : (
                      "Claim Reward"
                    )
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4" /> Buy
                    </>
                  )}
                </button>
              </article>
            );
          })}
        </div>

        <div className="border border-[#303030] bg-[#111] p-4 text-xs font-bold uppercase tracking-[0.1em] text-[#696969]">
          <Sparkles className="mr-2 inline h-4 w-4 text-[#f5c518]" />
          Paid packs are ready for a payment provider. The quiz pack is earned in-game.
        </div>
      </section>
      <FeedbackToast message={message} />
    </RacingShell>
  );
}
