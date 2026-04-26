import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Blob, usePettable } from "../components/Blob";
import { Button } from "../components/ui/Button";
import { Coins, Trophy, Home, RotateCcw } from "lucide-react";

const TIPS: Record<string, string> = {
  microsleep:      "Try intentional blinking every few minutes to reduce eye strain.",
  yawn:            "Stay hydrated and take short breaks to maintain alertness.",
  phone_check:     "Put your phone face-down or in another room during sessions.",
  head_tilt:       "Adjust your monitor height so your eyes look straight ahead.",
  eyes_off_screen: "Use a background timer to anchor your attention to the screen.",
  tab_switch:      "Full-screen mode minimises tab-switching temptations.",
  disallowed_tab:  "Block distracting sites with a browser extension.",
  rewind:          "Take notes while studying to reduce the urge to rewind.",
};

const DISTRACTOR_LABELS: Record<string, string> = {
  microsleep: "Microsleep",
  yawn: "Yawn",
  phone_check: "Phone Check",
  head_tilt: "Head Tilt",
  eyes_off_screen: "Eyes Off Screen",
  tab_switch: "Tab Switch",
  disallowed_tab: "Wrong Tab",
  rewind: "Rewind",
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
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const h = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);

  // Entrance: brief cheer then settle to grade state
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 1200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!summary) return;
    const target = Math.round(summary.focus_score);
    let i = 0;
    const scoreTimer = setInterval(() => {
      i += 2;
      setAnimScore(Math.min(i, target));
      if (i >= target) clearInterval(scoreTimer);
    }, 20);
    let c = 0;
    const coinTimer = setInterval(() => {
      c += 1;
      setAnimCoins(Math.min(c, summary.coins_earned));
      if (c >= summary.coins_earned) clearInterval(coinTimer);
    }, 30);
    return () => {
      clearInterval(scoreTimer);
      clearInterval(coinTimer);
    };
  }, [summary]);

  if (!summary) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">
          No summary data.{" "}
          <button onClick={() => navigate("/")} className="underline">
            Go home
          </button>
        </p>
      </div>
    );
  }

  const grade =
    summary.focus_score >= 90
      ? {
          label: "Excellent!",
          sub: "Pudge is so proud of you.",
          color: "text-emerald-400",
          blob: "cheering" as const,
        }
      : summary.focus_score >= 70
        ? {
            label: "Good Job!",
            sub: "A solid session — keep it up.",
            color: "text-amber-400",
            blob: "encouraging" as const,
          }
        : {
            label: "Keep At It",
            sub: "Every session makes you stronger.",
            color: "text-red-400",
            blob: "sad" as const,
          };

  const blobBase = entered ? grade.blob : "cheering";
  const { blobState, onPet } = usePettable(blobBase);

  const topDistractors =
    summary.top_distractors.length > 0
      ? summary.top_distractors
      : Object.entries(summary.event_counts ?? {})
          .filter(([, v]) => v > 0)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([type, count]) => ({ type, count, impact: 0 }));

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="bg-linear-to-br from-primary/90 via-primary to-primary/80 py-16 px-8 flex flex-col items-center gap-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-size-[20px_20px]" />
        <div className="absolute top-1/4 right-1/4 size-64 bg-primary-foreground/10 rounded-full blur-3xl" />

        <div className="relative z-10 cursor-pointer" title="Pet Pudge!">
          <Blob
            palette="cream"
            shape="wide"
            size={180}
            state={blobState}
            eyeTarget={mousePos}
            showGround
            onClick={onPet}
          />
        </div>

        <div className="relative z-10 text-center">
          <h1 className={`text-4xl font-black ${grade.color}`}>
            {grade.label}
          </h1>
          <p className="text-primary-foreground/70 mt-1">{grade.sub}</p>
          <p className="text-primary-foreground/50 text-sm mt-0.5">
            {summary.duration_mins}min session complete · click Pudge to
            celebrate!
          </p>
        </div>
      </div>

      {/* Stats + details */}
      <div className="max-w-2xl mx-auto px-8 py-10">
        {/* Score + Coins */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="rounded-2xl border border-border/60 bg-card p-6 text-center">
            <Trophy className="size-7 mx-auto mb-2 text-amber-500" />
            <div className="text-5xl font-black tabular-nums">{animScore}</div>
            <div className="text-muted-foreground text-sm mt-1">
              Focus Score
            </div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-6 text-center">
            <Coins className="size-7 mx-auto mb-2 text-amber-500" />
            <div className="text-5xl font-black tabular-nums text-amber-500">
              +{animCoins}
            </div>
            <div className="text-muted-foreground text-sm mt-1">
              Coins Earned
            </div>
          </div>
        </div>

        {/* Top distractors */}
        {topDistractors.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-bold mb-3 text-muted-foreground uppercase tracking-wider">
              What tripped you up
            </h2>
            <div className="space-y-3">
              {topDistractors.map((d) => {
                const tip = summary.improvement_tips?.[d.type] ?? TIPS[d.type];
                return (
                  <div
                    key={d.type}
                    className="rounded-xl border border-border/40 bg-card p-4"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">
                        {DISTRACTOR_LABELS[d.type] ?? d.type}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ×{d.count}
                        {d.impact > 0 ? ` · -${d.impact}pts` : ""}
                      </span>
                    </div>
                    {tip && (
                      <p className="text-xs text-muted-foreground">{tip}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {topDistractors.length === 0 && (
          <div className="mb-8 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-center">
            <p className="text-emerald-400 font-semibold">
              Zero distractions detected!
            </p>
            <p className="text-muted-foreground text-sm mt-1">
              Pudge is very impressed.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={() => navigate("/start")}
            className="flex-1 h-12 font-semibold gap-2"
          >
            <RotateCcw className="size-4" /> New Session
          </Button>
          <Button
            onClick={() => navigate("/")}
            variant="outline"
            className="flex-1 h-12 gap-2"
          >
            <Home className="size-4" /> Main Menu
          </Button>
        </div>
      </div>
    </div>
  );
}
