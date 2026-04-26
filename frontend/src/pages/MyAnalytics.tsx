"use client";

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { ArrowLeft, Coins } from "lucide-react";

// ── Styles ──────────────────────────────────────────────────────
let injected = false;
function injectStyles() {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const s = document.createElement("style");
  s.id = "my-analytics-styles";
  s.textContent = `
    @keyframes ma-fade { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    .ma-fade { animation: ma-fade 0.4s ease both; }
    .ma-card { background:#FFFAF1; border:1.5px solid #EAD7BE; border-radius:22px; }
    .ma-session { background:#FFFAF1; border:1.5px solid #EAD7BE; border-radius:16px; padding:18px 22px;
      transition:box-shadow 0.15s, transform 0.15s; }
    .ma-session:hover { box-shadow:0 6px 24px rgba(60,42,27,0.09); transform:translateY(-1px); }
    .ma-nav-tab {
      padding:8px 14px; border-radius:999px; border:none; cursor:pointer;
      font-family:Nunito,sans-serif; font-size:13px; font-weight:800;
      transition:background 0.15s,color 0.15s; text-align:left; width:100%;
    }
    .ma-tip-card {
      background:#FFFAF1; border:1.5px solid #EAD7BE; border-radius:14px;
      padding:14px 16px; display:flex; align-items:flex-start; gap:12px;
    }
    ::-webkit-scrollbar { width:6px; }
    ::-webkit-scrollbar-track { background:transparent; }
    ::-webkit-scrollbar-thumb { background:#EAD7BE; border-radius:3px; }
  `;
  document.head.appendChild(s);
}

// ── Tokens ──────────────────────────────────────────────────────
const C = {
  bg: "#FBF1E5", card: "#FFFAF1", border: "#EAD7BE",
  ink: "#3D2A1B", soft: "#806550", accent: "#F08F60",
  accentSoft: "#FFE8D9", green: "#7FB069", greenSoft: "#D9F0D3",
  red: "#E26656", redSoft: "#FFE0DB", yellow: "#F5C24A", yellowSoft: "#FFF3D6",
};

// ── Distraction config ──────────────────────────────────────────
const WEIGHTS: Record<string, number> = {
  microsleep: 10, phone_check: 5, disallowed_tab: 4, yawn: 3,
  tab_switch: 2, eyes_off_screen: 2, rewind: 2, head_tilt: 1,
};

interface DistractorMeta { label: string; color: string; soft: string }
const DMETA: Record<string, DistractorMeta> = {
  microsleep:      { label: "Microsleeps",       color: C.red,     soft: C.redSoft },
  phone_check:     { label: "Phone checks",       color: "#C97A3F", soft: "#F9CC9A" },
  disallowed_tab:  { label: "Disallowed tabs",    color: C.accent,  soft: C.accentSoft },
  yawn:            { label: "Yawning",            color: C.yellow,  soft: C.yellowSoft },
  tab_switch:      { label: "Tab switching",      color: "#7BC8F5", soft: "#D6EFFF" },
  eyes_off_screen: { label: "Eyes off screen",    color: C.green,   soft: C.greenSoft },
  head_tilt:       { label: "Head tilting",       color: "#A78BFA", soft: "#EDE9FE" },
  rewind:          { label: "Rewind events",      color: "#94A3B8", soft: "#F1F5F9" },
};
function dmeta(t: string): DistractorMeta {
  return DMETA[t] ?? { label: t, color: C.soft, soft: C.border };
}

// ── Tips ────────────────────────────────────────────────────────
const TIPS: Record<string, { icon: string; title: string; body: string }> = {
  microsleep: {
    icon: "😴",
    title: "Address fatigue at the root",
    body: "Microsleeps mean you're starting sessions already tired. Aim for 7–9 hours of sleep and consider a 20-min nap before long focus blocks.",
  },
  phone_check: {
    icon: "📱",
    title: "Eliminate phone proximity",
    body: "Place your phone in another room during sessions. Its presence alone reduces working memory capacity — even when it's silent.",
  },
  disallowed_tab: {
    icon: "🌐",
    title: "Block distracting websites",
    body: "Install a site blocker and configure a focus preset. Aim for zero disallowed-tab visits per session by removing the temptation entirely.",
  },
  yawn: {
    icon: "🥱",
    title: "Improve sleep hygiene",
    body: "Frequent yawning signals fatigue. Keep a consistent sleep schedule and avoid screens for 1 hour before bed.",
  },
  tab_switch: {
    icon: "🗂️",
    title: "Reduce context switching",
    body: "Keep only the tabs you need open. Each context switch costs ~23 minutes of deep-focus recovery. Batch research into separate blocks.",
  },
  eyes_off_screen: {
    icon: "👀",
    title: "Minimize visual distractions",
    body: "Face your workspace toward a wall or away from foot traffic. Use the 20-20-20 rule: every 20 min, look 20 ft away for 20 seconds.",
  },
  rewind: {
    icon: "⏪",
    title: "Break work into smaller chunks",
    body: "Frequent rewinds suggest difficulty retaining content. Try 25-min Pomodoro intervals and take brief notes during video content.",
  },
  head_tilt: {
    icon: "🪑",
    title: "Optimize your ergonomics",
    body: "Adjust your monitor to eye level to reduce neck strain. Take a 2-min stretch break every 30 minutes.",
  },
};

const GENERAL_TIPS = [
  { icon: "🏆", title: "Leverage your peak window", body: "Schedule your hardest cognitive tasks during your highest-scoring hour of day. Use warm-up tasks at the very start of each session." },
  { icon: "⏱️", title: "Use the Pomodoro technique", body: "Work in 25-min focused sprints with 5-min breaks. After 4 rounds, take a 20-min rest. Structured intervals consistently outperform marathon sessions." },
  { icon: "💧", title: "Stay hydrated", body: "Even mild dehydration reduces concentration and reaction time. Keep water at your desk and aim for a glass every 45 minutes during long sessions." },
];

// ── Types ────────────────────────────────────────────────────────
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
  studying: "Studying", coding: "Coding", notes: "Taking Notes",
  meeting: "Meeting", custom: "Custom",
};

// ── Helpers ──────────────────────────────────────────────────────
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

// ── ScoreRing ───────────────────────────────────────────────────
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
        <span style={{ fontSize: size * 0.27, fontWeight: 900, letterSpacing: -1, lineHeight: 1 }}>
          {Math.round(disp)}
        </span>
      </div>
    </div>
  );
}

// ── AnimatedBar ─────────────────────────────────────────────────
function AnimatedBar({ pct, color, soft, delay = 0 }: { pct: number; color: string; soft: string; delay?: number }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(pct), 120 + delay);
    return () => clearTimeout(t);
  }, [pct, delay]);

  return (
    <div style={{ height: 8, borderRadius: 999, background: soft, overflow: "hidden", flex: 1 }}>
      <div style={{ height: "100%", borderRadius: 999, background: color, width: `${w}%`, transition: "width 1s cubic-bezier(.34,1.2,.64,1)" }} />
    </div>
  );
}

// ── Tab components ───────────────────────────────────────────────
type TabData = {
  sessions: SessionRow[];
  events: EventRow[];
  totalSessions: number;
  avgScore: number;
  totalCoins: number;
  topDistractions: { type: string; count: number; impact: number; meta: DistractorMeta }[];
  peakHours: { hour: number; avg: number; count: number }[];
  streak: StreakRow | null;
};

function OverviewTab({ data, navigate }: { data: TabData; navigate: (path: string) => void }) {
  const { sessions, totalSessions, avgScore, totalCoins, peakHours, streak } = data;
  const maxAvg = peakHours[0]?.avg ?? 1;

  return (
    <div className="ma-fade" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {[
          { label: "Sessions", value: String(totalSessions), bg: C.accentSoft, color: C.accent },
          { label: "Avg Score", value: String(avgScore), bg: C.greenSoft, color: C.green },
          { label: "Coins", value: String(totalCoins), bg: "#FFF3D6", color: "#C97A3F" },
        ].map(({ label, value, bg, color }) => (
          <div key={label} className="ma-card" style={{ padding: "18px 20px", background: bg, borderColor: color + "55" }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: -2, lineHeight: 1, color: C.ink }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Streak card */}
      {streak && (streak.current_streak > 0 || streak.longest_streak > 0) && (
        <div className="ma-card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, background: "#FFF3D6", borderColor: "#F5C24A55" }}>
          <div style={{ fontSize: 28 }}>🔥</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: "#C97A3F", marginBottom: 2 }}>Current streak</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: C.ink }}>{streak.current_streak} day{streak.current_streak !== 1 ? "s" : ""}</div>
          </div>
          {streak.longest_streak > 0 && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.1, color: C.soft, marginBottom: 2 }}>Best</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: C.ink }}>{streak.longest_streak}d</div>
            </div>
          )}
        </div>
      )}

      {/* Peak hour highlight */}
      {peakHours.length > 0 && (
        <div className="ma-card" style={{ padding: "20px 22px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: C.soft, marginBottom: 12 }}>Peak productivity hour</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16, background: C.accentSoft, borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 26 }}>⚡</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: -0.3 }}>
                {hourLabel(peakHours[0].hour)} – {hourLabel(peakHours[0].hour + 1)}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.soft }}>
                avg score {peakHours[0].avg} · {peakHours[0].count} session{peakHours[0].count !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
          {peakHours.slice(1).map((slot) => (
            <div key={slot.hour} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 58, fontSize: 12, fontWeight: 800, color: C.soft, flexShrink: 0 }}>{hourLabel(slot.hour)}</div>
              <AnimatedBar pct={(slot.avg / maxAvg) * 100} color={scoreColor(slot.avg)} soft={C.accentSoft} />
              <div style={{ width: 28, fontSize: 12, fontWeight: 900, color: C.ink, textAlign: "right", flexShrink: 0 }}>{slot.avg}</div>
            </div>
          ))}
        </div>
      )}

      {/* Recent sessions */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: C.soft, marginBottom: 12 }}>Recent sessions</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sessions.slice(0, 6).map((s) => {
            const score = s.focus_score ?? 0;
            const dur = s.focus_duration_mins
              ? `${s.focus_duration_mins} min`
              : s.ended_at
              ? `${Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000)} min`
              : "—";

            return (
              <div key={s.session_id} className="ma-session">
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <ScoreRing score={score} size={52} />
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
                    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 999, background: "#FFF3D6", fontSize: 12, fontWeight: 900, color: "#C97A3F", flexShrink: 0 }}>
                      <Coins size={12} /> {s.coins_earned}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {sessions.length > 6 && (
          <div style={{ textAlign: "center", marginTop: 14, fontSize: 12, fontWeight: 700, color: C.soft }}>
            {sessions.length - 6} more session{sessions.length - 6 !== 1 ? "s" : ""} not shown
          </div>
        )}
        {sessions.length === 0 && (
          <button
            onClick={() => navigate("/start")}
            style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 999, padding: "12px 28px", fontSize: 14, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}
          >
            Start your first session →
          </button>
        )}
      </div>
    </div>
  );
}

function DistractionsTab({ data }: { data: TabData }) {
  const { topDistractions } = data;
  const maxImpact = topDistractions[0]?.impact ?? 1;

  return (
    <div className="ma-fade" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="ma-card" style={{ padding: "20px 22px", background: C.accentSoft, borderColor: C.accent }}>
        <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 6 }}>How impact is calculated</div>
        <p style={{ fontSize: 13, fontWeight: 600, color: C.soft, lineHeight: 1.65, margin: 0 }}>
          Each distraction type has a <strong style={{ color: C.ink }}>weight</strong> based on how much it disrupts deep focus. Impact = count × weight. Microsleeps score highest at 10×, small distractions like head tilts score 1×.
        </p>
      </div>

      {topDistractions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: C.soft, fontSize: 14, fontWeight: 700 }}>
          No distraction events recorded yet. Keep focusing!
        </div>
      ) : (
        <div className="ma-card" style={{ padding: "22px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: C.soft, marginBottom: 18 }}>Top 5 by impact score</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {topDistractions.map((d, i) => (
              <div key={d.type}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 8, background: d.meta.soft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: d.meta.color }}>{i + 1}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 900 }}>{d.meta.label}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.soft }}>
                        {d.count} event{d.count !== 1 ? "s" : ""} · weight {WEIGHTS[d.type] ?? 1}×
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: d.meta.color, background: d.meta.soft, padding: "4px 12px", borderRadius: 999, flexShrink: 0 }}>
                    −{d.impact} pts
                  </div>
                </div>
                <AnimatedBar pct={(d.impact / maxImpact) * 100} color={d.meta.color} soft={d.meta.soft} delay={i * 80} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TipsTab({ data }: { data: TabData }) {
  const { topDistractions } = data;

  // Build tip list: user's actual top distractions first, then fill with general tips
  const personalTips = topDistractions
    .map((d) => TIPS[d.type])
    .filter(Boolean);

  const needed = Math.max(0, 4 - personalTips.length);
  const allTips = [...personalTips, ...GENERAL_TIPS.slice(0, needed)];

  // Build a profile summary sentence based on top 1–2 distractions
  const top1 = topDistractions[0];
  const top2 = topDistractions[1];
  let profileSummary = "You're making good progress. Here's a personalised plan to take your focus further:";
  if (top1) {
    const lab1 = dmeta(top1.type).label.toLowerCase();
    if (top2) {
      const lab2 = dmeta(top2.type).label.toLowerCase();
      profileSummary = `Your biggest focus drags are ${lab1} and ${lab2}. Here's a personalised plan to cut through them:`;
    } else {
      profileSummary = `Your main focus drag is ${lab1}. Here's a personalised plan to address it:`;
    }
  }

  return (
    <div className="ma-fade" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Profile summary */}
      <div className="ma-card" style={{ padding: "22px 24px", background: C.accentSoft, borderColor: C.accent }}>
        <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 8 }}>Your focus profile</div>
        <p style={{ fontSize: 14, fontWeight: 600, color: C.soft, lineHeight: 1.65, margin: 0 }}>
          {profileSummary}
        </p>
      </div>

      {/* Tip cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {allTips.map((tip) => (
          <div key={tip.title} className="ma-tip-card">
            <div style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>{tip.icon}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 5 }}>{tip.title}</div>
              <p style={{ fontSize: 12, fontWeight: 600, color: C.soft, lineHeight: 1.6, margin: 0 }}>{tip.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Reminder if no data yet */}
      {topDistractions.length === 0 && (
        <div style={{ textAlign: "center", padding: "16px 0", color: C.soft, fontSize: 13, fontWeight: 700 }}>
          Tips become more personalised after you complete a few sessions.
        </div>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────
type Tab = "overview" | "distractions" | "tips";

export default function MyAnalytics() {
  injectStyles();
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [streak, setStreak] = useState<StreakRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

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
        const ids = rows.map((r) => r.session_id);
        const { data: eData } = await supabase
          .from("focus_events")
          .select("session_id, event_type")
          .in("session_id", ids);
        setEvents((eData ?? []) as EventRow[]);
      }

      const { data: stData } = await supabase
        .from("streaks")
        .select("current_streak, longest_streak, last_session_date")
        .eq("user_id", uid)
        .single();
      setStreak(stData as StreakRow | null);

      setLoading(false);
    })();
  }, [session, authLoading]);

  // ── Aggregations ────────────────────────────────────────────
  const totalSessions = sessions.length;

  const avgScore = useMemo(() => {
    const scored = sessions.filter((s) => s.focus_score != null);
    if (!scored.length) return 0;
    return Math.round(scored.reduce((acc, s) => acc + s.focus_score!, 0) / scored.length);
  }, [sessions]);

  const totalCoins = useMemo(
    () => sessions.reduce((acc, s) => acc + (s.coins_earned ?? 0), 0),
    [sessions]
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

  const peakHours = useMemo(() => {
    const buckets: Record<number, { total: number; count: number }> = {};
    for (const s of sessions) {
      if (s.focus_score == null) continue;
      const h = new Date(s.started_at).getHours();
      if (!buckets[h]) buckets[h] = { total: 0, count: 0 };
      buckets[h].total += s.focus_score;
      buckets[h].count += 1;
    }
    return Object.entries(buckets)
      .map(([h, v]) => ({ hour: Number(h), avg: Math.round(v.total / v.count), count: v.count }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 4);
  }, [sessions]);

  const tabData: TabData = { sessions, events, totalSessions, avgScore, totalCoins, topDistractions, peakHours, streak };

  const TABS: { id: Tab; label: string; emoji: string }[] = [
    { id: "overview", label: "Overview", emoji: "📊" },
    { id: "distractions", label: "Distractions", emoji: "⚡" },
    { id: "tips", label: "Tips", emoji: "💡" },
  ];

  // ── Loading / error / empty ──────────────────────────────────
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
        <button
          onClick={() => navigate("/home")}
          style={{ position: "absolute", top: 24, left: 24, display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: C.soft, fontSize: 13, fontWeight: 800, fontFamily: "inherit", padding: "8px 10px", borderRadius: 10 }}
        >
          <ArrowLeft size={15} /> Back to home
        </button>
        <div className="ma-fade" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🌱</div>
          <h2 style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.8, marginBottom: 10 }}>No sessions yet</h2>
          <p style={{ color: C.soft, fontWeight: 600, marginBottom: 28, fontSize: 15 }}>
            Complete your first focus session to see your analytics here.
          </p>
          <button
            onClick={() => navigate("/start")}
            style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 999, padding: "14px 32px", fontSize: 15, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 6px 20px rgba(240,143,96,0.35)" }}
          >
            Start a session →
          </button>
        </div>
      </div>
    );
  }

  // ── Main layout ──────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "Nunito, system-ui, sans-serif", color: C.ink, display: "flex" }}>
      {/* Sidebar */}
      <div style={{ width: 230, flexShrink: 0, borderRight: `1.5px solid ${C.border}`, background: C.card, display: "flex", flexDirection: "column", padding: "24px 16px", gap: 4, position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: C.soft, fontSize: 13, fontWeight: 800, fontFamily: "inherit", padding: "8px 10px", borderRadius: 10, marginBottom: 8, textAlign: "left" }}
        >
          <ArrowLeft size={15} /> Back
        </button>

        {/* Title */}
        <div style={{ padding: "0 10px 16px", borderBottom: `1.5px solid ${C.border}`, marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.3, color: C.soft, marginBottom: 2 }}>Bloom</div>
          <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: -0.4 }}>Your Analytics</div>
        </div>

        {/* Nav tabs */}
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className="ma-nav-tab"
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: active ? C.accentSoft : "transparent",
                color: active ? C.accent : C.soft,
              }}
            >
              {tab.emoji} {tab.label}
            </button>
          );
        })}

        {/* Stats summary at bottom */}
        <div style={{ marginTop: "auto", paddingTop: 24, borderTop: `1.5px solid ${C.border}` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.soft }}>
              <span style={{ color: C.ink, fontSize: 20, fontWeight: 900 }}>{totalSessions}</span> session{totalSessions !== 1 ? "s" : ""}
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.soft }}>
              <span style={{ color: C.ink, fontSize: 20, fontWeight: 900 }}>{avgScore}</span> avg score
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 800, color: "#C97A3F" }}>
              <Coins size={14} />
              <span style={{ color: C.ink, fontSize: 18, fontWeight: 900 }}>{totalCoins}</span> coins
            </div>
            {streak && streak.current_streak > 0 && (
              <div style={{ fontSize: 12, fontWeight: 800, color: C.soft }}>
                <span style={{ color: C.ink, fontSize: 18, fontWeight: 900 }}>{streak.current_streak}</span> 🔥 streak
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: "36px 40px 80px", overflowY: "auto", maxWidth: 800 }}>
        {activeTab === "overview" && <OverviewTab data={tabData} navigate={navigate} />}
        {activeTab === "distractions" && <DistractionsTab data={tabData} />}
        {activeTab === "tips" && <TipsTab data={tabData} />}
      </div>
    </div>
  );
}
