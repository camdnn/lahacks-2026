import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Blob, usePettable } from "../components/Blob";
import { CartoonCoin } from "../components/CartoonCoin";
import { useAuth } from "../context/AuthContext";
import { getCharacter } from "../data/characters";

const TIPS: Record<string, string> = {
  microsleep:      "Try intentional blinking every few minutes to reduce eye strain and prevent fatigue.",
  yawn:            "Stay hydrated and take short movement breaks to maintain alertness.",
  phone_check:     "Put your phone face-down or in another room during sessions.",
  head_tilt:       "Adjust your monitor height so your eyes look straight ahead at the screen.",
  eyes_off_screen: "Use a background timer to anchor your attention to your screen.",
  tab_switch:      "Full-screen mode and site blockers minimise tab-switching temptations.",
  disallowed_tab:  "Block distracting sites with a browser extension before your next session.",
  rewind:          "Take notes while studying to reduce the urge to rewind media.",
};

const DISTRACTOR_LABELS: Record<string, string> = {
  microsleep:      "Microsleep detected",
  yawn:            "Yawning",
  phone_check:     "Phone check",
  head_tilt:       "Head tilt",
  eyes_off_screen: "Eyes off screen",
  tab_switch:      "Tab switching",
  disallowed_tab:  "Wrong tab opened",
  rewind:          "Media rewind",
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

// ── Focus timeline chart ───────────────────────────────────────
function FocusLineChart({ timeline, events, durationMins }: {
  timeline: { elapsed: number; score: number }[];
  events: { elapsed: number; type: string }[];
  durationMins: number;
}) {
  if (timeline.length < 2) return null;
  const W = 520, H = 140;
  const PAD = { top: 16, right: 16, bottom: 28, left: 36 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const maxX = Math.max(durationMins * 60, timeline[timeline.length - 1].elapsed);
  const xS = (s: number) => PAD.left + (s / maxX) * cW;
  const yS = (v: number) => PAD.top + (1 - v / 100) * cH;
  const pts = timeline.map(p => `${xS(p.elapsed).toFixed(1)},${yS(p.score).toFixed(1)}`).join(" ");
  const fill = `${xS(timeline[0].elapsed)},${yS(0)} ${pts} ${xS(timeline[timeline.length - 1].elapsed)},${yS(0)}`;
  const step = durationMins <= 30 ? 5 : durationMins <= 60 ? 10 : 15;
  const xTicks: { x: number; label: string }[] = [];
  for (let m = 0; m <= durationMins; m += step) xTicks.push({ x: xS(m * 60), label: `${m}m` });
  const yTicks = [25, 50, 75, 100];

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id="tlgrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.accent} stopOpacity="0.3" />
          <stop offset="100%" stopColor={C.accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      {yTicks.map(v => (
        <g key={v}>
          <line x1={PAD.left} y1={yS(v)} x2={W - PAD.right} y2={yS(v)}
            stroke={C.border} strokeWidth={1} strokeDasharray="4 4" />
          <text x={PAD.left - 6} y={yS(v) + 3.5} textAnchor="end" fontSize={9}
            fill={C.soft} fontFamily="Nunito, sans-serif" fontWeight="700">{v}</text>
        </g>
      ))}
      <polygon points={fill} fill="url(#tlgrad)" />
      <polyline points={pts} fill="none" stroke={C.accent} strokeWidth={2.5}
        strokeLinejoin="round" strokeLinecap="round" />
      {events.map((ev, i) => {
        const closest = timeline.reduce((a, b) =>
          Math.abs(b.elapsed - ev.elapsed) < Math.abs(a.elapsed - ev.elapsed) ? b : a);
        return (
          <g key={i}>
            <line x1={xS(ev.elapsed)} y1={PAD.top} x2={xS(ev.elapsed)} y2={H - PAD.bottom}
              stroke={C.red} strokeWidth={1} strokeDasharray="3 2" opacity={0.45} />
            <circle cx={xS(ev.elapsed)} cy={yS(closest.score)} r={4} fill={C.red} stroke={C.card} strokeWidth={1.5} />
          </g>
        );
      })}
      <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom}
        stroke={C.border} strokeWidth={1} />
      {xTicks.map(t => (
        <text key={t.label} x={t.x} y={H - PAD.bottom + 12} textAnchor="middle"
          fontSize={9} fill={C.soft} fontFamily="Nunito, sans-serif" fontWeight="700">
          {t.label}
        </text>
      ))}
    </svg>
  );
}

// ── Score arc ──────────────────────────────────────────────────
function ScoreArc({ score }: { score: number }) {
  const size = 160, stroke = 12, r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const color = score >= 80 ? C.green : score >= 50 ? C.yellow : C.red;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={C.accentSoft} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - score / 100)}
          style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(.34,1.2,.64,1)" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: -2, color, lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: C.soft }}>Focus score</div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────
export default function SessionSummary() {
  const navigate = useNavigate();
  const { state: routeState } = useLocation();
  const summary: SummaryData | null = routeState?.summary ?? null;
  const { profile } = useAuth();
  const activeChar = getCharacter(profile?.active_character ?? "cream_wide");

  const [animScore, setAnimScore] = useState(0);
  const [animCoins, setAnimCoins] = useState(0);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const h = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 1200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!summary) return;
    const target = Math.round(summary.focus_score);
    let i = 0;
    const scoreTimer = setInterval(() => {
      i += 2; setAnimScore(Math.min(i, target));
      if (i >= target) clearInterval(scoreTimer);
    }, 20);
    let c = 0;
    const coinTimer = setInterval(() => {
      c += 1; setAnimCoins(Math.min(c, summary.coins_earned));
      if (c >= summary.coins_earned) clearInterval(coinTimer);
    }, 30);
    return () => { clearInterval(scoreTimer); clearInterval(coinTimer); };
  }, [summary]);

  if (!summary) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, fontFamily: "Nunito, sans-serif" }}>
        <p style={{ color: C.soft, fontWeight: 600 }}>
          No summary data.{" "}
          <button onClick={() => navigate("/home")} style={{ textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, color: C.accent }}>
            Go home
          </button>
        </p>
      </div>
    );
  }

  const score = Math.round(summary.focus_score);
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
  )
    .slice()
    .sort((a, b) => (b.impact * b.count - a.impact * a.count) || (b.count - a.count));

  const totalEvents = topDistractors.reduce((sum, d) => sum + d.count, 0);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "Nunito, system-ui, sans-serif", color: C.ink }}>

      {/* ── Hero banner ── */}
      <div style={{
        background: `linear-gradient(135deg, ${C.accent} 0%, #E07040 100%)`,
        padding: "48px 32px 40px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: "-20%", right: "10%", width: 300, height: 300, borderRadius: "50%", background: "rgba(255,255,255,0.08)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-30%", left: "5%",  width: 240, height: 240, borderRadius: "50%", background: "rgba(0,0,0,0.06)", pointerEvents: "none" }} />

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

        {/* Grade text */}
        <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
          <h1 style={{ fontSize: 40, fontWeight: 900, letterSpacing: -1.5, color: "#fff", marginBottom: 6 }}>
            {grade.label}
          </h1>
          <p className="text-primary-foreground/70 mt-1">{grade.sub}</p>
          <p className="text-primary-foreground/50 text-sm mt-0.5">
            {summary.duration_mins}min session complete · click {activeChar.name} to
            celebrate!
          </p>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "36px 24px 60px" }}>

        {/* ── Score + Coins ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          {/* Score arc card */}
          <div style={{ background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 22, padding: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <ScoreArc score={animScore} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: C.soft }}>
                {score >= 80 ? "Outstanding" : score >= 60 ? "Good effort" : "Room to grow"}
              </div>
            </div>
          </div>

          {/* Coins card */}
          <div style={{ background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 22, padding: 28, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <CartoonCoin size={48} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 48, fontWeight: 900, color: C.yellow, letterSpacing: -2, lineHeight: 1 }}>+{animCoins}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.soft, marginTop: 4 }}>coins earned</div>
            </div>
            <div style={{ background: C.yellowSoft, borderRadius: 10, padding: "8px 14px", textAlign: "center", width: "100%" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.soft }}>Total balance</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: C.yellow }}>{summary.coin_balance} coins</div>
            </div>
          </div>
        </div>

        {/* ── Session meta strip ── */}
        <div style={{ background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 18, padding: "16px 24px", marginBottom: 24, display: "flex", gap: 0 }}>
          {[
            { label: "Duration",     value: `${summary.duration_mins} min` },
            { label: "Score",        value: `${score} / 100` },
            { label: "Distractions", value: totalEvents > 0 ? `${totalEvents} total` : "Zero!" },
          ].map((stat, i, arr) => (
            <div key={stat.label} style={{ flex: 1, textAlign: "center", borderRight: i < arr.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: C.soft, marginBottom: 4 }}>{stat.label}</div>
              <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5 }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* ── Focus timeline ── */}
        {summary.focus_timeline && summary.focus_timeline.length >= 2 && (
          <div style={{ background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 22, padding: "22px 24px", marginBottom: 24 }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: -0.4, marginBottom: 3 }}>Focus timeline</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.soft }}>Your concentration across the session · red dots = distraction events</div>
            </div>
            <FocusLineChart
              timeline={summary.focus_timeline}
              events={summary.event_timeline ?? []}
              durationMins={summary.duration_mins}
            />
            <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: C.soft }}>
                <div style={{ width: 16, height: 3, borderRadius: 2, background: C.accent }} />Focus score
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: C.soft }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.red }} />Distraction
              </div>
            </div>
          </div>
        )}

        {/* ── What tripped you up ── */}
        {topDistractors.length > 0 ? (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: -0.4, marginBottom: 4 }}>What tripped you up</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.soft, marginBottom: 14 }}>Ranked by frequency. Each entry has a tip.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {topDistractors.map((d, i) => {
                const tip = summary.improvement_tips?.[d.type] ?? TIPS[d.type];
                const totalImpact = d.impact > 0 ? d.impact * d.count : null;
                const rankColor = i === 0 ? C.red : i === 1 ? "#C97A3F" : C.soft;
                const rankBg    = i === 0 ? C.redSoft : i === 1 ? "#F9CC9A" : C.border;
                const pct = totalEvents > 0 ? Math.round((d.count / totalEvents) * 100) : 0;
                return (
                  <div key={d.type} style={{ background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 18, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px" }}>
                      {/* Rank badge */}
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: rankBg, color: rankColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      {/* Label + bar */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 5 }}>{DISTRACTOR_LABELS[d.type] ?? d.type}</div>
                        <div style={{ height: 6, background: C.accentSoft, borderRadius: 999, overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 999, background: rankColor, width: `${pct}%`, transition: "width 1s ease" }} />
                        </div>
                      </div>
                      {/* Stats */}
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 900, color: rankColor }}>×{d.count}</div>
                        {totalImpact != null && (
                          <div style={{ fontSize: 11, fontWeight: 800, color: C.soft }}>−{totalImpact} pts</div>
                        )}
                      </div>
                    </div>
                    {/* Tip */}
                    {tip && (
                      <div style={{ borderTop: `1px solid ${C.border}`, padding: "12px 20px", background: C.bg, display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <span style={{ fontSize: 11, fontWeight: 900, color: C.accent, background: C.accentSoft, borderRadius: 6, padding: "2px 7px", flexShrink: 0, marginTop: 1 }}>Tip</span>
                        <p style={{ fontSize: 12, fontWeight: 600, color: C.soft, lineHeight: 1.65, margin: 0 }}>{tip}</p>
                      </div>
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

        {/* ── Actions ── */}
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => navigate("/start")}
            style={{ flex: 1, height: 50, borderRadius: 14, background: C.accent, color: "#fff", border: "none", fontSize: 15, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 16px rgba(240,143,96,0.3)", transition: "transform 0.15s, box-shadow 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(240,143,96,0.38)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(240,143,96,0.3)"; }}
          >
            <RotateCcw style={{ width: 16, height: 16 }} /> New Session
          </button>
          <button
            onClick={() => navigate("/home")}
            style={{ flex: 1, height: 50, borderRadius: 14, background: C.card, color: C.ink, border: `1.5px solid ${C.border}`, fontSize: 15, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "border-color 0.15s, background 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.background = C.accentSoft; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.card; }}
          >
            <Home style={{ width: 16, height: 16 }} /> Main Menu
          </button>
        </div>

      </div>
    </div>
  );
}
