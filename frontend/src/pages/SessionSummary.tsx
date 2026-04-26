import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Blob, usePettable } from "../components/Blob";
import { Button } from "../components/ui/Button";
import { Trophy, Home, RotateCcw } from "lucide-react";
import { CartoonCoin } from "../components/CartoonCoin";
import { useAuth } from "../context/AuthContext";
import { getCharacter } from "../data/characters";

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
  focus_timeline?: { elapsed: number; score: number }[];
  event_timeline?: { elapsed: number; type: string }[];
}

function FocusLineChart({ timeline, events, durationMins }: {
  timeline: { elapsed: number; score: number }[];
  events: { elapsed: number; type: string }[];
  durationMins: number;
}) {
  if (timeline.length < 2) return null;
  const W = 500, H = 130;
  const PAD = { top: 10, right: 12, bottom: 24, left: 30 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const maxX = Math.max(durationMins * 60, timeline[timeline.length - 1].elapsed);
  const xS = (s: number) => PAD.left + (s / maxX) * cW;
  const yS = (v: number) => PAD.top + (1 - v / 100) * cH;
  const pts = timeline.map(p => `${xS(p.elapsed)},${yS(p.score)}`).join(" ");
  const fill = `${xS(timeline[0].elapsed)},${yS(0)} ${pts} ${xS(timeline[timeline.length - 1].elapsed)},${yS(0)}`;
  const xTicks: { x: number; label: string }[] = [];
  const step = durationMins <= 30 ? 5 : durationMins <= 60 ? 10 : 15;
  for (let m = 0; m <= durationMins; m += step) {
    if (m === durationMins) break; // will add end label separately
    xTicks.push({ x: xS(m * 60), label: `${m}m` });
  }
  xTicks.push({ x: xS(durationMins * 60), label: `${durationMins}m` });
  const yTicks = [25, 50, 75, 100];

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F08F60" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#F08F60" stopOpacity="0" />
        </linearGradient>
      </defs>
      {yTicks.map(v => (
        <line key={v} x1={PAD.left} y1={yS(v)} x2={W - PAD.right} y2={yS(v)}
          stroke="#e5d8c8" strokeWidth={1} strokeDasharray="4 3" />
      ))}
      {yTicks.filter(v => v % 50 === 0).map(v => (
        <text key={v} x={PAD.left - 4} y={yS(v) + 3.5} textAnchor="end" fontSize={9} fill="#9a7c65">{v}</text>
      ))}
      <polygon points={fill} fill="url(#sg)" />
      <polyline points={pts} fill="none" stroke="#F08F60" strokeWidth={2}
        strokeLinejoin="round" strokeLinecap="round" />
      {events.map((ev, i) => {
        const closest = timeline.reduce((a, b) =>
          Math.abs(b.elapsed - ev.elapsed) < Math.abs(a.elapsed - ev.elapsed) ? b : a);
        return (
          <g key={i}>
            <line x1={xS(ev.elapsed)} y1={PAD.top} x2={xS(ev.elapsed)} y2={H - PAD.bottom}
              stroke="#E26656" strokeWidth={1} strokeDasharray="3 2" opacity={0.5} />
            <circle cx={xS(ev.elapsed)} cy={yS(closest.score)} r={3.5} fill="#E26656" />
          </g>
        );
      })}
      <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom}
        stroke="#e5d8c8" strokeWidth={1} />
      {xTicks.map(t => (
        <text key={t.label} x={t.x} y={H - PAD.bottom + 10} textAnchor="middle" fontSize={9} fill="#9a7c65">
          {t.label}
        </text>
      ))}
    </svg>
  );
}

export default function SessionSummary() {
  const navigate = useNavigate();
  const { state: routeState } = useLocation();
  const summary: SummaryData | null = routeState?.summary ?? null;
  const { profile } = useAuth();
  const activeChar = getCharacter(profile?.active_character ?? "cream_wide");

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
          <button onClick={() => navigate("/home")} className="underline">
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
          sub: `${activeChar.name} is so proud of you.`,
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

  const topDistractors = (
    summary.top_distractors.length > 0
      ? summary.top_distractors
      : Object.entries(summary.event_counts ?? {})
          .filter(([, v]) => v > 0)
          .slice(0, 5)
          .map(([type, count]) => ({ type, count, impact: 0 }))
  ).slice().sort((a, b) => (b.impact * b.count - a.impact * a.count) || (b.count - a.count));

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="bg-linear-to-br from-primary/90 via-primary to-primary/80 py-16 px-8 flex flex-col items-center gap-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-size-[20px_20px]" />
        <div className="absolute top-1/4 right-1/4 size-64 bg-primary-foreground/10 rounded-full blur-3xl" />

        <div className="relative z-10 cursor-pointer" title={`Pet ${activeChar.name}!`}>
          <Blob
            palette={activeChar.palette}
            shape={activeChar.shape}
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
            {summary.duration_mins}min session complete · click {activeChar.name} to
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
            <div className="flex justify-center mb-2"><CartoonCoin size={40} /></div>
            <div className="text-5xl font-black tabular-nums text-amber-500">
              +{animCoins}
            </div>
            <div className="text-muted-foreground text-sm mt-1">
              Coins Earned
            </div>
          </div>
        </div>

        {/* Focus timeline chart */}
        {summary.focus_timeline && summary.focus_timeline.length >= 2 && (
          <div className="mb-8 rounded-2xl border border-border/60 bg-card p-5">
            <h2 className="text-sm font-bold mb-1 text-muted-foreground uppercase tracking-wider">
              Focus timeline
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Red markers show when a distraction was detected.
            </p>
            <FocusLineChart
              timeline={summary.focus_timeline}
              events={summary.event_timeline ?? []}
              durationMins={summary.duration_mins}
            />
          </div>
        )}

        {/* Top distractors */}
        {topDistractors.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-bold mb-3 text-muted-foreground uppercase tracking-wider">
              What tripped you up
            </h2>
            <div className="space-y-3">
              {topDistractors.map((d, i) => {
                const tip = summary.improvement_tips?.[d.type] ?? TIPS[d.type];
                const totalLoss = d.impact > 0 ? d.impact * d.count : null;
                return (
                  <div
                    key={d.type}
                    className="rounded-xl border border-border/40 bg-card p-4"
                  >
                    <div className="flex items-center gap-3 mb-1">
                      <span className="size-6 shrink-0 rounded-full bg-border/50 flex items-center justify-center text-[11px] font-black text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="font-semibold text-sm flex-1">
                        {DISTRACTOR_LABELS[d.type] ?? d.type}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        ×{d.count}
                      </span>
                      {totalLoss != null && (
                        <span className="text-xs font-black text-red-500 bg-red-500/10 rounded-full px-2 py-0.5 shrink-0">
                          -{totalLoss} pts
                        </span>
                      )}
                    </div>
                    {tip && (
                      <p className="text-xs text-muted-foreground pl-9">{tip}</p>
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
              {activeChar.name} is very impressed.
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
            onClick={() => navigate("/home")}
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
