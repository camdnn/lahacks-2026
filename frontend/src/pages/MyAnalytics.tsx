"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { CartoonCoin } from "../components/CartoonCoin";

// ── Bloom tokens ──────────────────────────────────────────────
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

// ── Styles (injected once) ─────────────────────────────────────
let _stylesInjected = false;
function injectStyles() {
  if (_stylesInjected || typeof document === "undefined") return;
  _stylesInjected = true;
  const s = document.createElement("style");
  s.id = "ma-v2-styles";
  s.textContent = `
    @keyframes ma-fade-up  { from{opacity:0;transform:translateY(22px);}                  to{opacity:1;transform:translateY(0);}     }
    @keyframes ma-scale-in { from{opacity:0;transform:scale(0.93);}                        to{opacity:1;transform:scale(1);}          }
    @keyframes ma-stat-in  { from{opacity:0;transform:translateY(16px) scale(.96);}        to{opacity:1;transform:translateY(0) scale(1);} }
    @keyframes ma-bar-grow { from{width:0;} to{} }
    @keyframes ma-spin     { to{transform:rotate(360deg);} }

    .ma-fade-up  { animation: ma-fade-up  0.6s  cubic-bezier(.22,1,.36,1) both; }
    .ma-scale-in { animation: ma-scale-in 0.5s  cubic-bezier(.22,1,.36,1) both; }
    .ma-stat-in  { animation: ma-stat-in  0.65s cubic-bezier(.22,1,.36,1) both; }

    .ma-d1{animation-delay:.05s!important;}  .ma-d2{animation-delay:.13s!important;}
    .ma-d3{animation-delay:.21s!important;}  .ma-d4{animation-delay:.29s!important;}
    .ma-d5{animation-delay:.38s!important;}  .ma-d6{animation-delay:.48s!important;}
    .ma-d7{animation-delay:.58s!important;}  .ma-d8{animation-delay:.70s!important;}

    .ma-card { background:#FFFAF1; border:1.5px solid #EAD7BE; border-radius:22px;
               transition:box-shadow .25s, transform .25s; }
    .ma-tip  { background:#FFFAF1; border:1.5px solid #EAD7BE; border-left-width:4px;
               border-radius:14px; overflow:hidden; cursor:pointer; transition:box-shadow .22s; }
    .ma-tip:hover { box-shadow:0 4px 18px rgba(60,42,27,.09); }
    .ma-session { background:#FFFAF1; border:1.5px solid #EAD7BE; border-radius:16px;
                  padding:16px 20px; display:flex; align-items:center; gap:16px;
                  transition:transform .2s cubic-bezier(.22,1,.36,1), box-shadow .2s; }
    .ma-session:hover { transform:translateY(-2px); box-shadow:0 6px 18px rgba(60,42,27,.08); }
    .ma-bar-fill { height:100%; border-radius:999px; animation:ma-bar-grow 1.2s cubic-bezier(.34,1.2,.64,1) both; }
    .ma-collapsible { max-height:0; overflow:hidden; transition:max-height .4s cubic-bezier(.4,0,.2,1); }
    .ma-collapsible.open { max-height:4000px; }
    ::-webkit-scrollbar{width:5px;}
    ::-webkit-scrollbar-track{background:transparent;}
    ::-webkit-scrollbar-thumb{background:#EAD7BE;border-radius:3px;}
  `;
  document.head.appendChild(s);
}

// ── Distraction config — warm tonal palette ───────────────────
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
const TONAL = ["#3D2A1B", "#6B3F22", "#C97A3F", "#F08F60", "#C4A882"];
const TONAL_SOFT = ["#EAD7BE", "#F0DDD0", "#F9E4CE", "#FFE8D9", "#F5EDE1"];

interface DMeta {
  label: string;
  color: string;
  soft: string;
  iconEl: React.ReactNode;
}

const IconPhone = () => (
  <svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect width="14" height="20" x="5" y="2" rx="2" />
    <path d="M12 18h.01" />
  </svg>
);
const IconMoon = () => (
  <svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);
const IconShuffle = () => (
  <svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M16 3h5v5" />
    <path d="m21 3-7 7" />
    <path d="M16 21h5v-5" />
    <path d="m21 21-7-7" />
    <path d="M4 4c0 0 3 0 5 3s2 6 5 7" />
    <path d="M4 20c0 0 3 0 5-3 0 0 .5-1.5 2-3" />
  </svg>
);
const IconWind = () => (
  <svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
    <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
    <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
  </svg>
);
const IconEyeOff = () => (
  <svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </svg>
);
const IconLayers = () => (
  <svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
    <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
    <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
  </svg>
);
const IconRewind = () => (
  <svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="11 19 2 12 11 5 11 19" />
    <polygon points="22 19 13 12 22 5 22 19" />
  </svg>
);

const ICON_MAP: Record<string, React.ReactNode> = {
  phone_check: <IconPhone />,
  microsleep: <IconMoon />,
  tab_switch: <IconShuffle />,
  yawn: <IconWind />,
  eyes_off_screen: <IconEyeOff />,
  disallowed_tab: <IconLayers />,
  rewind: <IconRewind />,
  head_tilt: <IconEyeOff />,
};

const dm = (t: string, rank = 0): DMeta => {
  const labels: Record<string, string> = {
    microsleep: "Microsleeps",
    phone_check: "Phone checks",
    disallowed_tab: "Disallowed tabs",
    yawn: "Yawning",
    tab_switch: "Tab switching",
    eyes_off_screen: "Eyes off screen",
    head_tilt: "Head tilting",
    rewind: "Rewind events",
  };
  return {
    label: labels[t] ?? t,
    color: TONAL[Math.min(rank, TONAL.length - 1)],
    soft: TONAL_SOFT[Math.min(rank, TONAL_SOFT.length - 1)],
    iconEl: ICON_MAP[t] ?? <IconEyeOff />,
  };
};

// ── Tips ──────────────────────────────────────────────────────
const TIPS_DATA: Record<
  string,
  { title: string; body: string; priority: "high" | "med" | "low" }
> = {
  microsleep: {
    title: "Address fatigue at the root",
    priority: "high",
    body: "Microsleeps mean you're starting sessions already tired. Aim for 7–9 hours of sleep; try a 20-min nap before long blocks.",
  },
  phone_check: {
    title: "Eliminate phone proximity",
    priority: "high",
    body: "Place your phone in another room. Its presence alone reduces working memory capacity — even when it's silent.",
  },
  disallowed_tab: {
    title: "Block distracting websites",
    priority: "high",
    body: "Install a site blocker and configure a focus preset. Aim for zero disallowed-tab visits by removing the temptation entirely.",
  },
  yawn: {
    title: "Improve sleep hygiene",
    priority: "med",
    body: "Frequent yawning signals fatigue. Keep a consistent sleep schedule and avoid screens for 1 hour before bed.",
  },
  tab_switch: {
    title: "Reduce context switching",
    priority: "med",
    body: "Each switch costs ~23 min of deep-focus recovery. Keep only essential tabs open and batch research separately.",
  },
  eyes_off_screen: {
    title: "Minimize visual distractions",
    priority: "med",
    body: "Face your workspace away from foot traffic. Use 20-20-20: every 20 min, look 20 ft away for 20 seconds.",
  },
  rewind: {
    title: "Break work into smaller chunks",
    priority: "low",
    body: "Frequent rewinds suggest difficulty retaining content. Try Pomodoro intervals and take brief notes during video content.",
  },
  head_tilt: {
    title: "Optimise your ergonomics",
    priority: "low",
    body: "Adjust your monitor to eye level to reduce neck strain. Take a 2-min stretch break every 30 minutes.",
  },
};
const GENERAL_TIPS = [
  {
    title: "Leverage your peak window",
    priority: "low" as const,
    body: "Schedule your hardest cognitive tasks during your highest-scoring hour. Use warm-up tasks at the very start of each session.",
  },
  {
    title: "Use the Pomodoro technique",
    priority: "low" as const,
    body: "Work in 25-min sprints with 5-min breaks. Structured intervals consistently outperform marathon sessions.",
  },
  {
    title: "Stay hydrated",
    priority: "low" as const,
    body: "Even mild dehydration reduces concentration. Keep water at your desk and aim for a glass every 45 minutes.",
  },
];

const PRIORITY_META = {
  high: {
    label: "High impact",
    bg: "#FFE0DB",
    color: "#E26656",
    dot: "#E26656",
    effortLabel: "Low effort to fix",
    bars: 1,
  },
  med: {
    label: "Med impact",
    bg: "#FFF3D6",
    color: "#C97A3F",
    dot: "#F5C24A",
    effortLabel: "Some effort required",
    bars: 2,
  },
  low: {
    label: "Low impact",
    bg: "#D9F0D3",
    color: "#7FB069",
    dot: "#7FB069",
    effortLabel: "Requires habit change",
    bars: 3,
  },
};

// ── Types ─────────────────────────────────────────────────────
interface SessionRow {
  session_id: string;
  started_at: string;
  ended_at: string;
  focus_score: number | null;
  coins_earned: number | null;
  focus_duration_mins: number | null;
  session_type: string;
}
interface EventRow {
  session_id: string;
  event_type: string;
}

// ── Helpers ───────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
function hourLabel(h: number) {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}
function scoreColor(s: number) {
  return s >= 80 ? C.green : s >= 55 ? C.yellow : C.red;
}
function sessDur(s: SessionRow) {
  if (s.focus_duration_mins) return `${s.focus_duration_mins} min`;
  if (s.ended_at)
    return `${Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000)} min`;
  return "—";
}

// ── Animated counter hook ─────────────────────────────────────
function useCounter(target: number, delay = 0) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const tid = setTimeout(() => {
      const dur = 900,
        start = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - start) / dur, 1);
        const e = 1 - Math.pow(1 - p, 3);
        setVal(Math.round(target * e));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(tid);
  }, [target, delay]);
  return val;
}

// ── ScoreRing ──────────────────────────────────────────────────
function ScoreRing({ score, size = 50 }: { score: number; size?: number }) {
  const [disp, setDisp] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setDisp(score)),
    );
    return () => cancelAnimationFrame(id);
  }, [score]);
  const sw = 5,
    r = (size - sw) / 2,
    circ = 2 * Math.PI * r;
  const color = scoreColor(disp);
  return (
    <div
      style={{ position: "relative", width: size, height: size, flexShrink: 0 }}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={C.accentSoft}
          strokeWidth={sw}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={sw}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - disp / 100)}
          style={{
            transition: "stroke-dashoffset 1s cubic-bezier(.34,1.2,.64,1)",
          }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontSize: size * 0.32,
            fontWeight: 900,
            color,
            lineHeight: 1,
          }}
        >
          {Math.round(disp)}
        </span>
      </div>
    </div>
  );
}

// ── TrendChart ─────────────────────────────────────────────────
function TrendChart({
  scores,
  spikes,
}: {
  scores: number[];
  spikes?: boolean[];
}) {
  const lineRef = useRef<SVGPathElement>(null);
  const W = 600,
    H = 150;
  const PAD = { t: 18, r: 16, b: 28, l: 36 };
  const cW = W - PAD.l - PAD.r,
    cH = H - PAD.t - PAD.b;
  const n = scores.length;
  if (n < 2) return null;
  const xS = (i: number) => PAD.l + (i / (n - 1)) * cW;
  const yS = (v: number) => PAD.t + (1 - (Math.max(50, v) - 50) / 50) * cH;
  const avg = scores.map((_, i) => {
    const sl = scores.slice(Math.max(0, i - 3), i + 4);
    return sl.reduce((a, b) => a + b, 0) / sl.length;
  });
  const linePts = scores
    .map(
      (v, i) => `${i === 0 ? "M" : "L"}${xS(i).toFixed(1)},${yS(v).toFixed(1)}`,
    )
    .join(" ");
  const area = `${linePts} L${xS(n - 1).toFixed(1)},${yS(50).toFixed(1)} L${xS(0).toFixed(1)},${yS(50).toFixed(1)} Z`;
  const avgPts = avg
    .map(
      (v, i) => `${i === 0 ? "M" : "L"}${xS(i).toFixed(1)},${yS(v).toFixed(1)}`,
    )
    .join(" ");

  useEffect(() => {
    if (lineRef.current) {
      setTimeout(() => {
        if (lineRef.current) lineRef.current.style.strokeDashoffset = "0";
      }, 600);
    }
  }, []);

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <linearGradient id="ma-tgrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.accent} stopOpacity=".22" />
          <stop offset="100%" stopColor={C.accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[60, 70, 80, 90, 100].map((v) => (
        <g key={v}>
          <line
            x1={PAD.l}
            y1={yS(v)}
            x2={W - PAD.r}
            y2={yS(v)}
            stroke={C.border}
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <text
            x={PAD.l - 5}
            y={yS(v) + 4}
            textAnchor="end"
            fontSize={9}
            fill={C.soft}
            fontFamily="Nunito,sans-serif"
            fontWeight="700"
          >
            {v}
          </text>
        </g>
      ))}
      <path d={area} fill="url(#ma-tgrad)" />
      <path
        d={avgPts}
        fill="none"
        stroke={C.green}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeDasharray="5 3"
      />
      <path
        ref={lineRef}
        d={linePts}
        fill="none"
        stroke={C.accent}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={1000}
        strokeDashoffset={1000}
        style={{
          transition: "stroke-dashoffset 1.6s cubic-bezier(.22,1,.36,1) .5s",
        }}
      />
      {scores.map((v, i) =>
        spikes?.[i] ? (
          <circle
            key={i}
            cx={xS(i)}
            cy={yS(v)}
            r={5.5}
            fill={C.red}
            stroke="white"
            strokeWidth={2}
          />
        ) : (
          <circle
            key={i}
            cx={xS(i)}
            cy={yS(v)}
            r={3.5}
            fill={C.accent}
            stroke="white"
            strokeWidth={1.5}
          />
        ),
      )}
      {[
        0,
        Math.floor(n / 4),
        Math.floor(n / 2),
        Math.floor((3 * n) / 4),
        n - 1,
      ].map((i) => (
        <text
          key={i}
          x={xS(i)}
          y={H - 5}
          textAnchor="middle"
          fontSize={9}
          fill={C.soft}
          fontFamily="Nunito,sans-serif"
          fontWeight="700"
        >
          S{i + 1}
        </text>
      ))}
    </svg>
  );
}

// ── HourlyChart ────────────────────────────────────────────────
function HourlyChart({
  hourBuckets,
  peakHour,
}: {
  hourBuckets: Record<number, { avg: number; count: number }>;
  peakHour: number;
}) {
  const W = 320,
    H = 68,
    PAD = { t: 4, r: 4, b: 18, l: 4 };
  const cW = W - PAD.l - PAD.r,
    cH = H - PAD.t - PAD.b;
  const bW = cW / 24;
  const labels: Record<number, string> = {
    0: "12A",
    6: "6A",
    12: "12P",
    18: "6P",
    23: "11P",
  };
  if (peakHour !== undefined)
    labels[peakHour] = hourLabel(peakHour).replace(" ", "");
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      {Array.from({ length: 24 }, (_, h) => {
        const b = hourBuckets[h];
        const avg = b ? b.avg : 0;
        const bH = b ? Math.max(4, ((Math.max(50, avg) - 50) / 50) * cH) : 2;
        const x = PAD.l + h * bW;
        const y = PAD.t + cH - bH;
        const isPeak = h === peakHour;
        const fill = isPeak
          ? "#fff"
          : b
            ? `rgba(255,255,255,${(0.28 + ((avg - 50) / 50) * 0.5).toFixed(2)})`
            : "rgba(255,255,255,.14)";
        return (
          <rect
            key={h}
            x={x + 1.2}
            y={y}
            width={bW - 2.4}
            height={bH}
            rx={2}
            fill={fill}
          />
        );
      })}
      {Object.entries(labels).map(([h, lbl]) => (
        <text
          key={h}
          x={PAD.l + Number(h) * bW + bW / 2}
          y={H - 2}
          textAnchor="middle"
          fontSize={8}
          fill="rgba(255,255,255,.62)"
          fontFamily="Nunito,sans-serif"
          fontWeight="700"
        >
          {lbl}
        </text>
      ))}
    </svg>
  );
}

// ── TipAccordion ───────────────────────────────────────────────
function TipAccordion({
  tips,
}: {
  tips: {
    title: string;
    body: string;
    priority: "high" | "med" | "low";
    label: string;
    color: string;
    soft: string;
  }[];
}) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {tips.map((t, i) => {
        const isOpen = open.has(i);
        const pm = PRIORITY_META[t.priority];
        return (
          <div key={i} className="ma-tip" style={{ borderLeftColor: t.color }}>
            <button
              onClick={() => toggle(i)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "14px 16px",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "left",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    marginBottom: 5,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "2px 9px",
                      borderRadius: 999,
                      background: pm.bg,
                      fontSize: 10,
                      fontWeight: 800,
                      color: pm.color,
                    }}
                  >
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: pm.dot,
                        display: "inline-block",
                      }}
                    />
                    {pm.label}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      textTransform: "uppercase" as const,
                      letterSpacing: 1.1,
                      color: t.color,
                    }}
                  >
                    {t.label}
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 900, color: C.ink }}>
                  {t.title}
                </div>
              </div>
              <ChevronDown
                size={15}
                style={{
                  color: C.soft,
                  flexShrink: 0,
                  marginTop: 3,
                  transform: isOpen ? "rotate(180deg)" : "none",
                  transition: "transform .22s cubic-bezier(.22,1,.36,1)",
                }}
              />
            </button>
            <div className={`ma-collapsible${isOpen ? " open" : ""}`}>
              <div
                style={{
                  padding: "0 16px 14px",
                  borderTop: `1px solid ${C.border}`,
                }}
              >
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: C.soft,
                    lineHeight: 1.7,
                    margin: "10px 0 12px",
                  }}
                >
                  {t.body}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      textTransform: "uppercase" as const,
                      letterSpacing: 1,
                      color: C.soft,
                    }}
                  >
                    Effort to fix
                  </span>
                  <div style={{ display: "flex", gap: 3 }}>
                    {[1, 2, 3].map((n) => (
                      <div
                        key={n}
                        style={{
                          width: 18,
                          height: 5,
                          borderRadius: 999,
                          background: n <= pm.bars ? t.color : C.border,
                        }}
                      />
                    ))}
                  </div>
                  <span
                    style={{ fontSize: 10, fontWeight: 700, color: C.soft }}
                  >
                    {pm.effortLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function MyAnalytics() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [fetchKey, setFetchKey] = useState(0);

  // Tracks the latest uid on every render without making it a dep that suppresses
  // the effect. This means the fetch always runs on mount — not only when the uid
  // value changes — which is exactly what we need for React Router navigation.
  const uidRef = useRef<string | null>(null);
  uidRef.current = session?.user?.id ?? null;

  useEffect(() => { injectStyles(); }, []);

  // Bump fetchKey when the browser restores this page from bfcache so the fetch
  // effect re-runs even though React skipped remounting the component.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setFetchKey((k) => k + 1);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  // Deps: authLoading (wait for auth bootstrap) + fetchKey (bfcache / manual retrigger).
  // session?.user?.id is intentionally omitted — reading it via uidRef means the fetch
  // runs whenever the component mounts, not only when the ID value changes.
  useEffect(() => {
    if (authLoading) return;

    const uid = uidRef.current;
    if (!uid) {
      setLoading(false);
      return;
    }

    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setFetchError(null);

        const { data: sData, error: sErr } = await supabase
          .from("sessions")
          .select(
            "session_id,started_at,ended_at,focus_score,coins_earned,focus_duration_mins,session_type",
          )
          .eq("user_id", uid)
          .not("ended_at", "is", null)
          .order("started_at", { ascending: false });

        if (!mounted) return;

        if (sErr) {
          setFetchError(sErr.message);
          return;
        }

        const rows = (sData ?? []) as SessionRow[];
        setSessions(rows);

        if (rows.length > 0) {
          const ids = rows.map((r) => r.session_id);
          const { data: eData } = await supabase
            .from("focus_events")
            .select("session_id,event_type")
            .in("session_id", ids);
          if (!mounted) return;
          setEvents((eData ?? []) as EventRow[]);
        }
      } catch {
        if (mounted) setFetchError("Failed to load analytics. Please try again.");
      } finally {
        // Runs regardless of success, error, or early return — loading never gets stuck.
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [authLoading, fetchKey]);

  // ── Aggregations ──────────────────────────────────────────
  const avgScore = useMemo(() => {
    const scored = sessions.filter((s) => s.focus_score != null);
    if (!scored.length) return 0;
    return Math.round(
      scored.reduce((a, s) => a + s.focus_score!, 0) / scored.length,
    );
  }, [sessions]);

  const totalCoins = useMemo(
    () => sessions.reduce((a, s) => a + (s.coins_earned ?? 0), 0),
    [sessions],
  );
  const totalMins = useMemo(
    () => sessions.reduce((a, s) => a + (s.focus_duration_mins ?? 0), 0),
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
      .map(([type, vals], rank) => ({ type, ...vals, meta: dm(type, rank) }));
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
    for (const [h, v] of Object.entries(raw))
      buckets[Number(h)] = {
        avg: Math.round(v.total / v.count),
        count: v.count,
      };
    const peaks = Object.entries(buckets)
      .map(([h, v]) => ({ hour: Number(h), avg: v.avg, count: v.count }))
      .sort((a, b) => b.avg - a.avg);
    return { peakHours: peaks, hourBuckets: buckets };
  }, [sessions]);

  const scoreSeries = useMemo(
    () =>
      sessions
        .filter((s) => s.focus_score != null)
        .map((s) => s.focus_score!)
        .reverse(),
    [sessions],
  );

  const { thisWeek, lastWeek } = useMemo(() => {
    const now = Date.now();
    const weekMs = 7 * 86400000;
    const tw = sessions.filter(
      (s) =>
        now - new Date(s.started_at).getTime() < weekMs &&
        s.focus_score != null,
    );
    const lw = sessions.filter((s) => {
      const age = now - new Date(s.started_at).getTime();
      return age >= weekMs && age < 2 * weekMs && s.focus_score != null;
    });
    const avg = (arr: SessionRow[]) =>
      arr.length
        ? Math.round(arr.reduce((a, s) => a + s.focus_score!, 0) / arr.length)
        : null;
    return { thisWeek: avg(tw), lastWeek: avg(lw) };
  }, [sessions]);

  const tips = useMemo(() => {
    const personal = topDistractions
      .slice(0, 3)
      .map((d) => {
        const t = TIPS_DATA[d.type];
        if (!t) return null;
        return {
          ...t,
          label: d.meta.label,
          color: d.meta.color,
          soft: d.meta.soft,
        };
      })
      .filter(Boolean) as {
      title: string;
      body: string;
      priority: "high" | "med" | "low";
      label: string;
      color: string;
      soft: string;
    }[];
    const needed = Math.max(0, 4 - personal.length);
    return [
      ...personal,
      ...GENERAL_TIPS.slice(0, needed).map((t) => ({
        ...t,
        label: "General tip",
        color: C.soft,
        soft: C.border,
      })),
    ];
  }, [topDistractions]);

  const coinVal = useCounter(totalCoins, 600);
  const minsVal = useCounter(totalMins, 700);

  // ── Loading ────────────────────────────────────────────────
  if (loading || authLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: C.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 14,
          fontFamily: "Nunito,system-ui,sans-serif",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: `3px solid ${C.accentSoft}`,
            borderTopColor: C.accent,
            animation: "ma-spin .8s linear infinite",
          }}
        />
        <span style={{ fontSize: 14, fontWeight: 700, color: C.soft }}>
          Loading your sessions…
        </span>
      </div>
    );
  }

  if (fetchError)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: C.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Nunito,system-ui,sans-serif",
        }}
      >
        <div
          style={{
            background: C.redSoft,
            border: `1.5px solid ${C.red}`,
            borderRadius: 16,
            padding: "24px 28px",
            color: C.red,
            fontWeight: 700,
            maxWidth: 400,
          }}
        >
          Couldn't load analytics: {fetchError}
        </div>
      </div>
    );

  if (sessions.length === 0)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: C.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          fontFamily: "Nunito,system-ui,sans-serif",
          color: C.ink,
        }}
      >
        <button
          onClick={() => navigate("/home")}
          style={{
            position: "absolute",
            top: 24,
            left: 24,
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: C.soft,
            fontSize: 13,
            fontWeight: 800,
            fontFamily: "inherit",
          }}
        >
          <ArrowLeft size={15} /> Back
        </button>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: 26, fontWeight: 900, marginBottom: 10 }}>
            No sessions yet
          </h2>
          <p style={{ color: C.soft, fontWeight: 600, marginBottom: 28 }}>
            Complete your first focus session to see your analytics.
          </p>
          <button
            onClick={() => navigate("/start")}
            style={{
              background: C.accent,
              color: "#fff",
              border: "none",
              borderRadius: 999,
              padding: "14px 32px",
              fontSize: 15,
              fontWeight: 900,
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: "0 6px 20px rgba(240,143,96,.35)",
            }}
          >
            Start a session
          </button>
        </div>
      </div>
    );

  const maxImpact = topDistractions[0]?.impact ?? 1;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        fontFamily: "Nunito,system-ui,sans-serif",
        color: C.ink,
      }}
    >
      {/* ── Header ── */}
      <header
        style={{
          background: "rgba(255,250,241,0.92)",
          borderBottom: `1.5px solid ${C.border}`,
          padding: "13px 40px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          position: "sticky",
          top: 0,
          zIndex: 20,
          backdropFilter: "blur(14px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              background: C.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 6px rgba(240,143,96,.35)",
            }}
          >
            <div
              style={{
                width: 13,
                height: 13,
                borderRadius: "50%",
                background: C.accentSoft,
              }}
            />
          </div>
          <span
            style={{ fontSize: 17, fontWeight: 900, letterSpacing: "-.3px" }}
          >
            Bloom
          </span>
        </div>
        <span style={{ width: 1, height: 18, background: C.border }} />
        <button
          onClick={() => navigate("/home")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: C.soft,
            fontSize: 13,
            fontWeight: 800,
            fontFamily: "inherit",
            padding: "6px 10px",
            borderRadius: 10,
          }}
        >
          <ArrowLeft size={15} /> Back
        </button>
        <span style={{ width: 1, height: 18, background: C.border }} />
        <h1
          style={{
            fontSize: 18,
            fontWeight: 900,
            letterSpacing: "-.4px",
            flex: 1,
          }}
        >
          My Analytics
        </h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span
            style={{
              background: C.accentSoft,
              color: C.accent,
              padding: "4px 12px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            {sessions.length} session{sessions.length !== 1 ? "s" : ""}
          </span>
          <span
            style={{
              background: C.greenSoft,
              color: C.green,
              padding: "4px 12px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            avg {avgScore}
          </span>
        </div>
      </header>

      {/* ── Hero — flat stat strip ── */}
      <section
        style={{
          background:
            "linear-gradient(130deg,#D96A30 0%,#F08F60 60%,#F5A870 100%)",
          padding: "32px 40px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -80,
            right: -80,
            width: 280,
            height: 280,
            borderRadius: "50%",
            background: "rgba(255,255,255,.07)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div className="ma-fade-up ma-d1" style={{ marginBottom: 18 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 1.6,
                color: "rgba(255,255,255,.65)",
                marginBottom: 4,
              }}
            >
              Overall performance
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 900,
                color: "#fff",
                letterSpacing: "-.5px",
              }}
            >
              Your focus journey
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4,1fr)",
              gap: 12,
            }}
          >
            {[
              {
                label: "Avg Score",
                value: String(avgScore),
                sub: "out of 100",
                bar: avgScore,
              },
              {
                label: "Sessions",
                value: String(sessions.length),
                sub: "completed",
                bar: null,
              },
              {
                label: "Coins",
                value: String(coinVal),
                sub: "earned",
                bar: null,
              },
              {
                label: "Focus Time",
                value: `${minsVal}`,
                sub: "minutes",
                bar: null,
              },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className={`ma-stat-in ma-d${i + 2}`}
                style={{
                  background: "rgba(255,255,255,.14)",
                  border: "1px solid rgba(255,255,255,.22)",
                  borderRadius: 16,
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: 1.2,
                    color: "rgba(255,255,255,.65)",
                    marginBottom: 8,
                  }}
                >
                  {stat.label}
                </div>
                <div
                  style={{
                    fontSize: 36,
                    fontWeight: 900,
                    color: "#fff",
                    letterSpacing: -2,
                    lineHeight: 1,
                  }}
                >
                  {stat.value}
                </div>
                {stat.bar !== null ? (
                  <div
                    style={{
                      marginTop: 8,
                      height: 4,
                      borderRadius: 999,
                      background: "rgba(255,255,255,.2)",
                      width: "100%",
                    }}
                  >
                    <div
                      className="ma-bar-fill"
                      style={{
                        background: "#fff",
                        width: `${stat.bar}%`,
                        animationDelay: ".7s",
                      }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "rgba(255,255,255,.55)",
                      marginTop: 8,
                    }}
                  >
                    {stat.sub}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Main grid ── */}
      <div
        style={{
          maxWidth: 1360,
          margin: "0 auto",
          padding: "32px 40px 100px",
          display: "grid",
          gridTemplateColumns: "1fr 370px",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* ═ LEFT ═ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {/* Score trend */}
          {scoreSeries.length >= 2 && (
            <div
              className="ma-card ma-fade-up ma-d1"
              style={{ padding: "24px 28px" }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: 1.8,
                  color: C.soft,
                  marginBottom: 12,
                }}
              >
                Score over time
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  letterSpacing: "-.4px",
                  marginBottom: 3,
                }}
              >
                {scoreSeries[scoreSeries.length - 1] > scoreSeries[0]
                  ? "You're improving 📈"
                  : "Keep pushing 💪"}
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.soft,
                  marginBottom: 20,
                }}
              >
                Last {scoreSeries.length} sessions · orange line = your score ·
                green dashes = rolling avg
              </div>
              <TrendChart scores={scoreSeries} />
              <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
                {[
                  { color: C.accent, dash: false, dot: false, label: "Score" },
                  {
                    color: C.green,
                    dash: true,
                    dot: false,
                    label: "Rolling avg",
                  },
                  {
                    color: C.red,
                    dash: false,
                    dot: true,
                    label: "Distraction spike",
                  },
                ].map((l) => (
                  <div
                    key={l.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      fontSize: 11,
                      fontWeight: 700,
                      color: C.soft,
                    }}
                  >
                    {l.dot ? (
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: l.color,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 16,
                          height: l.dash ? 0 : 2.5,
                          borderRadius: 2,
                          background: l.dash ? "transparent" : l.color,
                          borderTop: l.dash
                            ? `2px dashed ${l.color}`
                            : undefined,
                        }}
                      />
                    )}
                    {l.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top distractions */}
          <div
            className="ma-card ma-fade-up ma-d2"
            style={{ padding: "24px 28px" }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 1.8,
                color: C.soft,
                marginBottom: 12,
              }}
            >
              Top distractions
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 900,
                letterSpacing: "-.4px",
                marginBottom: 3,
              }}
            >
              What's costing you focus
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: C.soft,
                marginBottom: 20,
              }}
            >
              Ranked by weighted impact · count × severity
            </div>

            {topDistractions.length === 0 ? (
              <div
                style={{
                  padding: "20px 0",
                  textAlign: "center",
                  color: C.soft,
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                No distraction events recorded yet.
              </div>
            ) : (
              <div
                style={{ borderTop: `1.5px solid ${C.border}`, paddingTop: 4 }}
              >
                {topDistractions.map((d, i) => (
                  <div
                    key={d.type}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "14px 0",
                      borderBottom:
                        i < topDistractions.length - 1
                          ? `1px solid ${C.border}`
                          : "none",
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: C.bg,
                        border: `1.5px solid ${C.border}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 900,
                        color: C.soft,
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </div>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: d.meta.soft,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        color: d.meta.color,
                      }}
                    >
                      {d.meta.iconEl}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: 8,
                          marginBottom: 5,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 900,
                            color: C.ink,
                          }}
                        >
                          {d.meta.label}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: C.soft,
                          }}
                        >
                          {d.count}×
                        </div>
                      </div>
                      <div
                        style={{
                          height: 6,
                          borderRadius: 999,
                          background: C.bg,
                          border: `1px solid ${C.border}`,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          className="ma-bar-fill"
                          style={{
                            background: d.meta.color,
                            width: `${Math.round((d.impact / maxImpact) * 100)}%`,
                            animationDelay: `${0.25 + i * 0.1}s`,
                          }}
                        />
                      </div>
                    </div>
                    <div
                      style={{
                        textAlign: "right",
                        flexShrink: 0,
                        minWidth: 40,
                      }}
                    >
                      <div
                        style={{ fontSize: 15, fontWeight: 900, color: C.ink }}
                      >
                        {d.impact}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: C.soft,
                          textTransform: "uppercase",
                          letterSpacing: ".8px",
                        }}
                      >
                        pts
                      </div>
                    </div>
                  </div>
                ))}
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: `1.5px solid ${C.border}`,
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.soft,
                    lineHeight: 1.6,
                  }}
                >
                  Impact = count × severity weight. Microsleeps (10×) cost most;
                  eye drift (1×) least.
                </div>
              </div>
            )}
          </div>

          {/* Session history */}
          <div
            className="ma-card ma-fade-up ma-d3"
            style={{ overflow: "hidden" }}
          >
            <button
              onClick={() => setSessionsOpen((o) => !o)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                padding: "20px 28px",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                gap: 14,
                textAlign: "left",
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: 1.3,
                      color: C.soft,
                    }}
                  >
                    All Sessions
                  </span>
                  <span
                    style={{
                      background: C.accentSoft,
                      color: C.accent,
                      padding: "2px 9px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    {sessions.length}
                  </span>
                </div>
                {!sessionsOpen &&
                  sessions.length > 0 &&
                  (() => {
                    const s = sessions[0];
                    return (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          borderTop: `1px solid ${C.border}`,
                          paddingTop: 12,
                        }}
                      >
                        <ScoreRing score={s.focus_score ?? 0} size={44} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 900 }}>
                            {fmtDate(s.started_at)}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: C.soft,
                              marginTop: 2,
                            }}
                          >
                            {fmtTime(s.started_at)} · {sessDur(s)}
                          </div>
                        </div>
                        {(s.coins_earned ?? 0) > 0 && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "3px 10px",
                              borderRadius: 999,
                              background: C.yellowSoft,
                              fontSize: 12,
                              fontWeight: 900,
                              color: "#C97A3F",
                            }}
                          >
                            <CartoonCoin />
                            {s.coins_earned}
                          </div>
                        )}
                      </div>
                    );
                  })()}
              </div>
              <ChevronDown
                size={16}
                style={{
                  color: C.soft,
                  flexShrink: 0,
                  transform: sessionsOpen ? "rotate(180deg)" : "none",
                  transition: "transform .22s cubic-bezier(.22,1,.36,1)",
                }}
              />
            </button>
            <div className={`ma-collapsible${sessionsOpen ? " open" : ""}`}>
              <div
                style={{
                  borderTop: `1.5px solid ${C.border}`,
                  padding: "14px 28px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {sessions.map((s) => (
                  <div key={s.session_id} className="ma-session">
                    <ScoreRing score={s.focus_score ?? 0} size={50} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 900 }}>
                        {fmtDate(s.started_at)}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: C.soft,
                          marginTop: 2,
                        }}
                      >
                        {fmtTime(s.started_at)} · {sessDur(s)}
                      </div>
                    </div>
                    {(s.coins_earned ?? 0) > 0 && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "3px 10px",
                          borderRadius: 999,
                          background: C.yellowSoft,
                          fontSize: 12,
                          fontWeight: 900,
                          color: "#C97A3F",
                        }}
                      >
                        <CartoonCoin/>{s.coins_earned}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ═ RIGHT ═ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Peak hours — week delta embedded */}
          {peakHours.length > 0 && (
            <div
              style={{
                background: "linear-gradient(140deg,#D96A30 0%,#F5A870 100%)",
                borderRadius: 20,
                padding: "22px 22px",
                position: "relative",
                overflow: "hidden",
                color: "#fff",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -50,
                  right: -50,
                  width: 160,
                  height: 160,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,.07)",
                  pointerEvents: "none",
                }}
              />
              <div style={{ position: "relative", zIndex: 1 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: 1.4,
                    color: "rgba(255,255,255,.65)",
                    marginBottom: 10,
                  }}
                >
                  Peak focus window
                </div>
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 900,
                    color: "#fff",
                    marginBottom: 2,
                  }}
                >
                  {hourLabel(peakHours[0].hour)} –{" "}
                  {hourLabel((peakHours[0].hour + 1) % 24)}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "rgba(255,255,255,.7)",
                    marginBottom: 18,
                  }}
                >
                  avg score {peakHours[0].avg} · {peakHours[0].count} session
                  {peakHours[0].count !== 1 ? "s" : ""}
                </div>
                <HourlyChart
                  hourBuckets={hourBuckets}
                  peakHour={peakHours[0].hour}
                />
                {thisWeek !== null && lastWeek !== null && (
                  <div
                    style={{
                      marginTop: 14,
                      background: "rgba(255,255,255,.12)",
                      borderRadius: 12,
                      padding: "12px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: "rgba(255,255,255,.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 18,
                        fontWeight: 900,
                        color: "#fff",
                        flexShrink: 0,
                      }}
                    >
                      {thisWeek >= lastWeek ? "↑" : "↓"}
                    </div>
                    <div>
                      <div
                        style={{ fontSize: 14, fontWeight: 900, color: "#fff" }}
                      >
                        {thisWeek >= lastWeek
                          ? `+${thisWeek - lastWeek}`
                          : thisWeek - lastWeek}{" "}
                        pts this week
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "rgba(255,255,255,.65)",
                        }}
                      >
                        {thisWeek} avg vs {lastWeek} last week
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tips */}
          <div className="ma-fade-up ma-d4">
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 1.8,
                color: C.soft,
                marginBottom: 8,
              }}
            >
              Personalised tips
            </div>
            <TipAccordion tips={tips} />
          </div>
        </div>
      </div>
    </div>
  );
}
