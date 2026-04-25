import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Blob } from "../components/Blob";
import { Button } from "../components/ui/Button";
import { Coins, Trophy } from "lucide-react";

const DISTRACTOR_LABELS: Record<string, string> = {
  microsleep: "😴 Microsleep",
  yawn: "🥱 Yawn",
  phone_check: "📱 Phone Check",
  head_tilt: "↩ Head Tilt",
  eyes_off_screen: "👀 Eyes Off Screen",
  tab_switch: "⇄ Tab Switch",
  disallowed_tab: "🚫 Wrong Tab",
  rewind: "⏪ Rewind",
};

interface SummaryData {
  duration_mins: number;
  focus_score: number;
  coins_earned: number;
  coin_balance: number;
  top_distractors: { type: string; count: number; impact: number }[];
  improvement_tips: Record<string, string>;
  event_counts: Record<string, number>;
}

export default function SessionSummary() {
  const navigate = useNavigate();
  const { state: routeState } = useLocation();
  const summary: SummaryData | null = routeState?.summary ?? null;

  const [animScore, setAnimScore] = useState(0);
  const [animCoins, setAnimCoins] = useState(0);

  useEffect(() => {
    if (!summary) return;
    // Animate score counter
    const target = Math.round(summary.focus_score);
    let i = 0;
    const scoreTimer = setInterval(() => {
      i += 2;
      setAnimScore(Math.min(i, target));
      if (i >= target) clearInterval(scoreTimer);
    }, 20);

    // Animate coins
    let c = 0;
    const coinTimer = setInterval(() => {
      c += 1;
      setAnimCoins(Math.min(c, summary.coins_earned));
      if (c >= summary.coins_earned) clearInterval(coinTimer);
    }, 30);

    return () => { clearInterval(scoreTimer); clearInterval(coinTimer); };
  }, [summary]);

  if (!summary) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">No summary data. <button onClick={() => navigate("/")} className="underline">Go home</button></p>
      </div>
    );
  }

  const scoreGrade =
    summary.focus_score >= 90 ? { label: "Excellent!", color: "text-emerald-500", blob: "cheering" as const } :
    summary.focus_score >= 70 ? { label: "Good Job!",  color: "text-amber-500",   blob: "encouraging" as const } :
                                 { label: "Keep At It", color: "text-red-500",     blob: "sad" as const };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-12 px-8">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <Blob palette="cream" shape="wide" size={150} state={scoreGrade.blob} showGround
            style={{ margin: "0 auto" }} />
          <h1 className={`text-4xl font-black mt-4 ${scoreGrade.color}`}>{scoreGrade.label}</h1>
          <p className="text-muted-foreground mt-1">{summary.duration_mins}min session complete</p>
        </div>

        {/* Score + Coins */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="rounded-2xl border border-border/60 bg-card p-6 text-center">
            <Trophy className="size-8 mx-auto mb-2 text-amber-500" />
            <div className="text-5xl font-black tabular-nums">{animScore}</div>
            <div className="text-muted-foreground text-sm mt-1">Focus Score</div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-6 text-center">
            <Coins className="size-8 mx-auto mb-2 text-amber-500" />
            <div className="text-5xl font-black tabular-nums text-amber-500">+{animCoins}</div>
            <div className="text-muted-foreground text-sm mt-1">Coins Earned</div>
          </div>
        </div>

        {/* Top distractors */}
        {summary.top_distractors.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold mb-4">Top Distractors</h2>
            <div className="space-y-3">
              {summary.top_distractors.map((d) => (
                <div key={d.type} className="rounded-xl border border-border/40 bg-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">{DISTRACTOR_LABELS[d.type] ?? d.type}</span>
                    <span className="text-sm text-muted-foreground">×{d.count} · -{d.impact}pts</span>
                  </div>
                  {summary.improvement_tips[d.type] && (
                    <p className="text-sm text-muted-foreground">{summary.improvement_tips[d.type]}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <Button onClick={() => navigate("/start")} className="flex-1 h-12 font-semibold">
            New Session
          </Button>
          <Button onClick={() => navigate("/")} variant="outline" className="flex-1 h-12">
            Home
          </Button>
        </div>
      </div>
    </div>
  );
}
