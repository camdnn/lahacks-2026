"use client";

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { ArrowLeft, ChevronDown, Coins } from "lucide-react";

// ── Styles ───────────────────────────────────────────────────────
let injected = false;
function injectStyles() {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const s = document.createElement("style");
  s.id = "my-analytics-styles";
  s.textContent = `
    @keyframes ma-fade { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    .ma-fade { animation: ma-fade 0.35s ease both; }
    .ma-card { background:#FFFAF1; border:1.5px solid #EAD7BE; border-radius:20px; }
    .ma-session { background:#FFFAF1; border:1.5px solid #EAD7BE; border-radius:14px; padding:16px 20px;
      transition:box-shadow 0.15s, transform 0.15s; }
    .ma-session:hover { box-shadow:0 4px 20px rgba(60,42,27,0.08); transform:translateY(-1px); }
    .sessions-body { overflow:hidden; max-height:0; opacity:0; transition:max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease; }
    .sessions-body.open { max-height:5000px; opacity:1; transition:max-height 0.45s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease 0.05s; }
    ::-webkit-scrollbar { width:5px; }
    ::-webkit-scrollbar-track { background:transparent; }
    ::-webkit-scrollbar-thumb { background:#EAD7BE; border-radius:3px; }
  `;
  document.head.appendChild(s);
}

// ── Tokens ───────────────────────────────────────────────────────
const C = {
  bg: "#FBF1E5",
  card: "#FFFAF1",
  border: "#EAD7BE",
  ink: "#3D2A1B",
  soft: "#806550",
  accent: "#F08F60",
  accentSoft: "#FFE8D9",
  green: "#7FB069",
  greenSoft: "#D9F0D3",
  red: "#E26656",
  redSoft: "#FFE0DB",
  yellow: "#F5C24A",
  yellowSoft: "#FFF3D6",
};

// ── Distraction config ───────────────────────────────────────────
const WEIGHTS: Record<string, number> = {
  microsleep: 10,
  phone_check: 5,
  disallowed_tab: 4,
  yawn: 3,
  tab_switch: 2,
  eyes_off_screen: 1,
  rewind: 2,
  head_tilt: 1,
};

interface DistractorMeta { label: string; color: string; soft: string }
const DMETA: Record<string, DistractorMeta> = {
  microsleep:      { label: "Microsleeps",    color: C.red,    soft: C.redSoft    },
  phone_check:     { label: "Phone checks",   color: "#C97A3F", soft: "#F9CC9A"   },
  disallowed_tab:  { label: "Disallowed tabs",color: C.accent,  soft: C.accentSoft},
  yawn:            { label: "Yawning",        color: C.yellow, soft: C.yellowSoft },
  tab_switch:      { label: "Tab switching",  color: "#7BC8F5", soft: "#D6EFFF"   },
  eyes_off_screen: { label: "Eyes off screen",color: C.green,  soft: C.greenSoft  },
  head_tilt:       { label: "Head tilting",   color: "#A78BFA", soft: "#EDE9FE"   },
  rewind:          { label: "Rewind events",  color: "#94A3B8", soft: "#F1F5F9"   },
};
function dmeta(t: string): DistractorMeta {
  return DMETA[t] ?? { label: t, color: C.soft, soft: C.border };
}

// ── Tips ─────────────────────────────────────────────────────────
const TIPS: Record<string, { title: string; body: string }> = {
  microsleep: {
    title: "Address fatigue at the root",
    body: "Microsleeps mean you're starting sessions already tired. Aim for 7–9 hours of sleep and consider a 20-min nap before long focus blocks.",
  },
  phone_check: {
    title: "Eliminate phone proximity",
    body: "Place your phone in another room during sessions. Its presence alone reduces working memory capacity — even when it's silent.",
  },
  disallowed_tab: {
    title: "Block distracting websites",
    body: "Install a site blocker and configure a focus preset. Aim for zero disallowed-tab visits per session by removing the temptation entirely.",
  },
  yawn: {
    title: "Improve sleep hygiene",
    body: "Frequent yawning signals fatigue. Keep a consistent sleep schedule and avoid screens for 1 hour before bed.",
  },
  tab_switch: {
    title: "Reduce context switching",
    body: "Keep only the tabs you need open. Each context switch costs ~23 minutes of deep-focus recovery. Batch research into separate blocks.",
  },
  eyes_off_screen: {
    title: "Minimize visual distractions",
    body: "Face your workspace toward a wall or away from foot traffic. Use the 20-20-20 rule: every 20 min, look 20 ft away for 20 seconds.",
  },
  rewind: {
    title: "Break work into smaller chunks",
    body: "Frequent rewinds suggest difficulty retaining content. Try 25-min Pomodoro intervals and take brief notes during video content.",
  },
  head_tilt: {
    title: "Optimize your ergonomics",
    body: "Adjust your monitor to eye level to reduce neck strain. Take a 2-min stretch break every 30 minutes.",
  },
};
const GENERAL_TIPS = [
  {
    title: "Leverage your peak window",
    body: "Schedule your hardest cognitive tasks during your highest-scoring hour of day. Use warm-up tasks at the very start of each session.",
  },
  {
    title: "Use the Pomodoro technique",
    body: "Work in 25-min focused sprints with 5-min breaks. After 4 rounds, take a 20-min rest. Structured intervals consistently outperform marathon sessions.",
  },
  {
    title: "Stay hydrated",
    body: "Even mild dehydration reduces concentration and reaction time. Keep water at your desk and aim for a glass every 45 minutes during long sessions.",
  },
];

// ── Types ─────────────────────────────────────────────────────────
interface SessionRow {
  session_id: string;
  started_at: string;
  ended_at: string;
  focus_score: number | null;
  coins_earned: number | null;
  focus_duration_mins: number | null;
  session_type: string;
}
interface EventRow { session_id: string; event_type: string }
interface StreakRow { current_streak: number; longest_streak: number; last_session_date: string | null }

const SESSION_TYPE_LABELS: Record<string, string> = {
  studying: "Studying", coding: "Coding", notes: "Taking Notes", meeting: "Meeting", custom: "Custom",
};

// ── Helpers ───────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function hourLabel(h: number) {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}
function scoreColor(s: number) {
  if (s >= 80) return C.green;
  if (s >= 55) return C.yellow;
  return C.red;
}

// ── ScoreRing ─────────────────────────────────────────────────────
function ScoreRing({ score, size = 60 }: { score: number; size?: number }) {
  const [disp, setDisp] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setDisp(score)));
    return () => cancelAnimationFrame(id);
  }, [score]);
  const sw = 6, r = (size - sw) / 2, circ = 2 * Math.PI * r;
  const hue = Math.round((disp / 100) * 120);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={C.accentSoft} strokeWidth={sw} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={`hsl(${hue},70%,52%)`} strokeWidth={sw} fill="none"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - disp / 100)}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(.34,1.2,.64,1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: size * 0.33, fontWeight: 900, letterSpacing: 0, lineHeight: 1 }}>
          {Math.round(disp)}
        </span>
      </div>
    </div>
  );
}

// ── AnimatedBar ───────────────────────────────────────────────────
function AnimatedBar({ pct, color, soft, delay = 0 }: { pct: number; color: string; soft: string; delay?: number }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(pct), 120 + delay);
    return () => clearTimeout(t);
  }, [pct, delay]);
  return (
    <div style={{ height: 7, borderRadius: 999, background: soft, overflow: "hidden" }}>
      <div style={{ height: "100%", borderRadius: 999, background: color, width: `${w}%`, transition: "width 1s cubic-bezier(.34,1.2,.64,1)" }} />
    </div>
  );
}

// ── HourlyChart ───────────────────────────────────────────────────
function HourlyChart({ hourBuckets, peakHour, onDark = false }: {
  hourBuckets: Record<number, { avg: number; count: number }>;
  peakHour: number;
  onDark?: boolean;
}) {
  const W = 480, H = 80;
  const PAD = { top: 4, right: 4, bottom: 18, left: 4 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const barW = cW / 24;
  const labelHours = [0, 6, 12, 18, 23];
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      {Array.from({ length: 24 }, (_, h) => {
        const b = hourBuckets[h];
        const avg = b ? b.avg : 0;
        const barH = b ? Math.max(4, (avg / 100) * cH) : 2;
        const x = PAD.left + h * barW;
        const y = PAD.top + cH - barH;
        const isPeak = h === peakHour;
        const fill = isPeak
          ? (onDark ? "#fff" : C.accent)
          : b
            ? (onDark ? `rgba(255,255,255,${(0.35 + (avg / 100) * 0.5).toFixed(2)})` : scoreColor(avg))
            : (onDark ? "rgba(255,255,255,0.15)" : C.border);
        const opacity = isPeak ? 1 : b ? (onDark ? 1 : 0.75) : (onDark ? 1 : 0.35);
        return <rect key={h} x={x + 1} y={y} width={barW - 2} height={barH} rx={2} fill={fill} opacity={opacity} />;
      })}
      {labelHours.map(h => (
        <text key={h} x={PAD.left + h * barW + barW / 2} y={H - 2}
          textAnchor="middle" fontSize={8} fill={onDark ? "rgba(255,255,255,0.65)" : C.soft}>
          {hourLabel(h)}
        </text>
      ))}
    </svg>
  );
}

// ── Main ──────────────────────────────────────────────────────────
export default function MyAnalytics() {
  injectStyles();
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [streak, setStreak] = useState<StreakRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [expandedTips, setExpandedTips] = useState<Set<string>>(new Set());
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const toggleTip = (title: string) =>
    setExpandedTips(prev => {
      const next = new Set(prev);
      next.has(title) ? next.delete(title) : next.add(title);
      return next;
    });

  useEffect(() => {
    if (authLoading) return;
    const uid = session?.user?.id;
    if (!uid) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      setFetchError(null);
      const { data: sData, error: sErr } = await supabase
        .from("sessions")
        .select("session_id, started_at, ended_at, focus_score, coins_earned, focus_duration_mins, session_type")
        .eq("user_id", uid)
        .not("ended_at", "is", null)
        .order("started_at", { ascending: false });
      if (sErr) { setFetchError(sErr.message); setLoading(false); return; }
      const rows = (sData ?? []) as SessionRow[];
      setSessions(rows);
      if (rows.length > 0) {
        const ids = rows.map(r => r.session_id);
        const { data: eData } = await supabase
          .from("focus_events").select("session_id, event_type").in("session_id", ids);
        setEvents((eData ?? []) as EventRow[]);
      }
      const { data: stData } = await supabase
        .from("streaks").select("current_streak, longest_streak, last_session_date")
        .eq("user_id", uid).single();
      setStreak(stData as StreakRow | null);
      setLoading(false);
    })();
  }, [session, authLoading]);

  // ── Aggregations ──────────────────────────────────────────────
  const totalSessions = sessions.length;

  const avgScore = useMemo(() => {
    const scored = sessions.filter(s => s.focus_score != null);
    if (!scored.length) return 0;
    return Math.round(scored.reduce((acc, s) => acc + s.focus_score!, 0) / scored.length);
  }, [sessions]);

  const totalCoins = useMemo(
    () => sessions.reduce((acc, s) => acc + (s.coins_earned ?? 0), 0),
    [sessions],
  );

  const topDistractions = useMemo(() => {
    const agg: Record<string, { count: number; impact: number }> = {};
    for (const ev of events) {
      if (!agg[ev.event_type]) agg[ev.event_type] = { count: 0, impact: 0 };
      agg[ev.event_type].count += 1;
      agg[ev.event_type].impact += WEIGHTS[ev.event_type] ?? 1;
    }
    return Object.entries(agg)
      .sort((a, b) => b[1].impact - a[1].impact)
      .slice(0, 5)
      .map(([type, vals]) => ({ type, ...vals, meta: dmeta(type) }));
  }, [events]);

  const { peakHours, hourBuckets } = useMemo(() => {
    const raw: Record<number, { total: number; count: number }> = {};
    for (const s of sessions) {
      if (s.focus_score == null) continue;
      const h = new Date(s.started_at).getHours();
      if (!raw[h]) raw[h] = { total: 0, count: 0 };
      raw[h].total += s.focus_score;
      raw[h].count += 1;
    }
    const buckets: Record<number, { avg: number; count: number }> = {};
    for (const [h, v] of Object.entries(raw)) {
      buckets[Number(h)] = { avg: Math.round(v.total / v.count), count: v.count };
    }
    const peaks = Object.entries(buckets)
      .map(([h, v]) => ({ hour: Number(h), avg: v.avg, count: v.count }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 4);
    return { peakHours: peaks, hourBuckets: buckets };
  }, [sessions]);

  // ── Tips ─────────────────────────────────────────────────────
  const personalTips = topDistractions.slice(0, 3)
    .map(d => TIPS[d.type] ? { ...TIPS[d.type], label: d.meta.label, color: d.meta.color, soft: d.meta.soft } : null)
    .filter(Boolean) as { title: string; body: string; label: string; color: string; soft: string }[];
  const needed = Math.max(0, 4 - personalTips.length);
  const allTips = [
    ...personalTips,
    ...GENERAL_TIPS.slice(0, needed).map(t => ({ ...t, label: "General tip", color: C.soft, soft: C.border })),
  ];

  // ── Loading / error / empty ───────────────────────────────────
  if (loading || authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, fontFamily: "Nunito, system-ui, sans-serif" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: `3px solid ${C.accentSoft}`, borderTopColor: C.accent, animation: "spin 0.8s linear infinite" }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: C.soft }}>Loading your sessions…</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Nunito, system-ui, sans-serif" }}>
        <div style={{ background: C.redSoft, border: `1.5px solid ${C.red}`, borderRadius: 16, padding: "24px 28px", color: C.red, fontWeight: 700, maxWidth: 400 }}>
          Couldn't load analytics: {fetchError}
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", fontFamily: "Nunito, system-ui, sans-serif", color: C.ink, position: "relative" }}>
        <button onClick={() => navigate("/home")}
          style={{ position: "absolute", top: 24, left: 24, display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: C.soft, fontSize: 13, fontWeight: 800, fontFamily: "inherit", padding: "8px 10px", borderRadius: 10 }}>
          <ArrowLeft size={15} /> Back to home
        </button>
        <div className="ma-fade" style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.8, marginBottom: 10 }}>No sessions yet</h2>
          <p style={{ color: C.soft, fontWeight: 600, marginBottom: 28, fontSize: 15 }}>
            Complete your first focus session to see your analytics here.
          </p>
          <button onClick={() => navigate("/start")}
            style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 999, padding: "14px 32px", fontSize: 15, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 6px 20px rgba(240,143,96,0.35)" }}>
            Start a session
          </button>
        </div>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "Nunito, system-ui, sans-serif", color: C.ink }}>

      {/* ── Sticky header ── */}
      <header style={{ background: C.card, borderBottom: `1.5px solid ${C.border}`, padding: "13px 40px", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={() => navigate(-1)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: C.soft, fontSize: 13, fontWeight: 800, fontFamily: "inherit", padding: "6px 10px", borderRadius: 10, flexShrink: 0 }}>
          <ArrowLeft size={15} /> Back
        </button>
        <span style={{ width: 1, height: 18, background: C.border, flexShrink: 0 }} />
        <h1 style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.4, margin: 0, flex: 1 }}>Your Analytics</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: C.accent, background: C.accentSoft, borderRadius: 999, padding: "4px 12px", whiteSpace: "nowrap" }}>
            {totalSessions} session{totalSessions !== 1 ? "s" : ""}
          </span>
          <span style={{ fontSize: 12, fontWeight: 800, color: C.green, background: C.greenSoft, borderRadius: 999, padding: "4px 12px", whiteSpace: "nowrap" }}>
            avg {avgScore}
          </span>
          {streak?.current_streak ? (
            <span style={{ fontSize: 12, fontWeight: 800, color: "#C97A3F", background: C.yellowSoft, borderRadius: 999, padding: "4px 12px", whiteSpace: "nowrap" }}>
              {streak.current_streak}d streak
            </span>
          ) : null}
        </div>
      </header>

      {/* ── Two-column dashboard ── */}
      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "32px 40px 80px", display: "grid", gridTemplateColumns: "1fr 420px", gap: 28, alignItems: "stretch" }}>

        {/* ─── LEFT: Stats + Sessions ─── */}
        <div className="ma-fade" style={{ display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Stat strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {[
              { label: "Sessions",     value: String(totalSessions), bg: C.accentSoft,  color: C.accent   },
              { label: "Avg Score",    value: String(avgScore),      bg: C.greenSoft,   color: C.green    },
              { label: "Coins Earned", value: String(totalCoins),    bg: C.yellowSoft,  color: "#C97A3F"  },
            ].map(({ label, value, bg, color }) => (
              <div key={label} className="ma-card" style={{ padding: "20px 22px", background: bg, borderColor: color + "55" }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color, marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: -2, lineHeight: 1, color: C.ink }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Focus tips — accordion */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: C.soft, marginBottom: 10 }}>
              Focus Tips
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {allTips.map(tip => {
                const isOpen = expandedTips.has(tip.title);
                return (
                  <div key={tip.title} style={{ background: C.card, border: `1.5px solid ${C.border}`, borderLeft: `4px solid ${tip.color}`, borderRadius: 14, overflow: "hidden" }}>
                    <button
                      onClick={() => toggleTip(tip.title)}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.1, color: tip.color, marginBottom: 2 }}>
                          {tip.label}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 900, color: C.ink }}>{tip.title}</div>
                      </div>
                      <ChevronDown size={15} style={{ color: C.soft, flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                    </button>
                    {isOpen && (
                      <div style={{ padding: "0 16px 13px 20px", borderTop: `1px solid ${C.border}` }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: C.soft, lineHeight: 1.7, margin: "10px 0 0" }}>{tip.body}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {topDistractions.length === 0 && (
              <p style={{ textAlign: "center", marginTop: 10, fontSize: 12, fontWeight: 700, color: C.soft }}>
                Tips become more personalised after a few sessions.
              </p>
            )}
          </div>

          {/* Sessions list — collapsible */}
          <div className="ma-card" style={{ overflow: "hidden", marginTop: "auto" }}>
            <button
              onClick={() => setSessionsOpen(o => !o)}
              style={{ width: "100%", display: "flex", flexDirection: "column", padding: "16px 24px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
            >
              {/* Label row */}
              <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: C.soft }}>
                    All Sessions
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 800, background: C.accentSoft, color: C.accent, borderRadius: 999, padding: "2px 9px" }}>
                    {sessions.length}
                  </span>
                </div>
                <ChevronDown size={15} style={{ color: C.soft, flexShrink: 0, transform: sessionsOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
              </div>
              {/* Recent session preview — collapsed only */}
              {!sessionsOpen && sessions.length > 0 && (() => {
                const r = sessions[0];
                const score = r.focus_score ?? 0;
                const dur = r.focus_duration_mins
                  ? `${r.focus_duration_mins}m`
                  : r.ended_at
                    ? `${Math.round((new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) / 60000)}m`
                    : "—";
                return (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
                    <ScoreRing score={score} size={44} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: -0.3, color: C.ink }}>{fmtDate(r.started_at)}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.soft, marginTop: 2 }}>{fmtTime(r.started_at)} · {dur}</div>
                    </div>
                    {(r.coins_earned ?? 0) > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 3, padding: "3px 10px", borderRadius: 999, background: C.yellowSoft, fontSize: 12, fontWeight: 900, color: "#C97A3F", flexShrink: 0 }}>
                        <Coins size={11} /> {r.coins_earned}
                      </div>
                    )}
                  </div>
                );
              })()}
            </button>
            <div className={`sessions-body${sessionsOpen ? " open" : ""}`}>
              <div style={{ borderTop: `1.5px solid ${C.border}`, padding: "14px 24px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                {sessions.map(s => {
                  const score = s.focus_score ?? 0;
                  const dur = s.focus_duration_mins
                    ? `${s.focus_duration_mins} min`
                    : s.ended_at
                      ? `${Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000)} min`
                      : "—";
                  return (
                    <div key={s.session_id} className="ma-session">
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <ScoreRing score={score} size={50} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: -0.3 }}>{fmtDate(s.started_at)}</div>
                            {s.session_type && s.session_type !== "general" && (
                              <div style={{ padding: "2px 8px", borderRadius: 999, background: C.accentSoft, fontSize: 11, fontWeight: 800, color: C.accent }}>
                                {SESSION_TYPE_LABELS[s.session_type] ?? s.session_type}
                              </div>
                            )}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.soft, marginTop: 2 }}>
                            {fmtTime(s.started_at)} · {dur}
                          </div>
                        </div>
                        {(s.coins_earned ?? 0) > 0 && (
                          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 999, background: C.yellowSoft, fontSize: 12, fontWeight: 900, color: "#C97A3F", flexShrink: 0 }}>
                            <Coins size={12} /> {s.coins_earned}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ─── RIGHT: Insights ─── */}
        <div className="ma-fade" style={{ display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Peak productivity */}
          {peakHours.length > 0 && (
            <div style={{ borderRadius: 20, padding: "22px 24px", background: "linear-gradient(140deg, #E07040 0%, #F5A470 100%)", color: "#fff", overflow: "hidden", position: "relative" }}>
              <div style={{ position: "absolute", top: -50, right: -50, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
              <div style={{ position: "absolute", bottom: -30, left: 10, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.3, opacity: 0.75, marginBottom: 8 }}>
                  Peak Productivity
                </div>
                <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1.1, marginBottom: 4 }}>
                  {hourLabel(peakHours[0].hour)} – {hourLabel((peakHours[0].hour + 1) % 24)}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.8, marginBottom: 18 }}>
                  avg score {peakHours[0].avg} · {peakHours[0].count} session{peakHours[0].count !== 1 ? "s" : ""}
                </div>
                <HourlyChart hourBuckets={hourBuckets} peakHour={peakHours[0].hour} onDark />
              </div>
            </div>
          )}

          {/* Top distractions */}
          <div className="ma-card" style={{ padding: "22px 24px" }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: C.soft, marginBottom: 16 }}>
              Top Distractions
            </div>
            {topDistractions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0", color: C.soft, fontSize: 13, fontWeight: 700 }}>
                No distraction events recorded yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {topDistractions.slice(0, 3).map((d, i) => (
                  <div key={d.type}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 26, height: 26, borderRadius: 8, background: d.meta.soft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: d.meta.color, flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 900 }}>{d.meta.label}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.soft }}>
                          {d.count} event{d.count !== 1 ? "s" : ""} · weight {WEIGHTS[d.type] ?? 1}×
                        </div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 900, color: d.meta.color, background: d.meta.soft, padding: "3px 10px", borderRadius: 999, flexShrink: 0 }}>
                        -{d.impact} pts
                      </div>
                    </div>
                    <AnimatedBar pct={(d.impact / (topDistractions[0]?.impact ?? 1)) * 100} color={d.meta.color} soft={d.meta.soft} delay={i * 80} />
                  </div>
                ))}
              </div>
            )}
            {topDistractions.length > 0 && (
              <p style={{ margin: "14px 0 0", paddingTop: 12, borderTop: `1.5px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.soft, lineHeight: 1.5 }}>
                Impact = count × weight.
              </p>
            )}
          </div>

          {/* Streak */}
          {streak && (streak.current_streak > 0 || streak.longest_streak > 0) && (
            <div className="ma-card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, background: C.yellowSoft, borderColor: "#F5C24A55" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: "#C97A3F", marginBottom: 2 }}>
                  Current Streak
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: C.ink }}>
                  {streak.current_streak} day{streak.current_streak !== 1 ? "s" : ""}
                </div>
              </div>
              {streak.longest_streak > 0 && (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.1, color: C.soft, marginBottom: 2 }}>Best</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: C.ink }}>{streak.longest_streak}d</div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
