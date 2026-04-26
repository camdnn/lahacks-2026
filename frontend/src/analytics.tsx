import { useState, useEffect, useRef } from "react";
import { DesktopPet } from "./components/DesktopPet";

// ── Inject page-level styles once ───────────────────────────
let analyticsStylesInjected = false;
function injectAnalyticsStyles() {
  if (analyticsStylesInjected || typeof document === "undefined") return;
  analyticsStylesInjected = true;
  const s = document.createElement("style");
  s.id = "analytics-styles";
  s.textContent = `
    @keyframes analytics-fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes analytics-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
    @keyframes analytics-pulse-ring {
      0%   { box-shadow: 0 0 0 0 rgba(240,143,96,0.3); }
      70%  { box-shadow: 0 0 0 14px rgba(240,143,96,0); }
      100% { box-shadow: 0 0 0 0 rgba(240,143,96,0); }
    }
    .analytics-fade-in { animation: analytics-fade-in 0.45s ease both; }
    .analytics-card { background: #FFFAF1; border: 1.5px solid #EAD7BE; border-radius: 22px; }
    .analytics-nav-tab {
      padding: 8px 18px; border-radius: 999px; border: none; cursor: pointer;
      font-family: Nunito, sans-serif; font-size: 13px; font-weight: 800;
      transition: background 0.15s, color 0.15s; text-align: left; width: 100%;
    }
    .analytics-tip-card {
      background: #FFFAF1; border: 1.5px solid #EAD7BE; border-radius: 14px;
      padding: 14px 16px; display: flex; align-items: flex-start; gap: 12px;
    }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #EAD7BE; border-radius: 3px; }
  `;
  document.head.appendChild(s);
}

// ── Color tokens ─────────────────────────────────────────────
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

// ── Mock session data ─────────────────────────────────────────
const SESSION = {
  date: "Thursday, April 24 · 9:45 AM",
  duration: "52 min",
  focusScore: 84,
  scoreDelta: +12,
  coins: 168,
  coinsMax: 200,
  peakWindow: { start: "10:14 AM", end: "10:47 AM", duration: "33 min" },
  lowWindow: { start: "9:52 AM", end: "10:03 AM", duration: "11 min" },
};

const BREAKS = [
  {
    rank: 1,
    type: "eye",
    label: "Phone checks",
    icon: "phone",
    count: 9,
    impact: 34,
    color: C.red,
    colorSoft: C.redSoft,
    tip: "Keep your phone face-down or in a drawer during sessions. Even its presence reduces focus by 20%.",
  },
  {
    rank: 2,
    type: "eye",
    label: "Microsleeps detected",
    icon: "zzz",
    count: 4,
    impact: 22,
    color: "#C97A3F",
    colorSoft: "#F9CC9A",
    tip: "Microsleeps signal fatigue. Try a 20-min power nap before long sessions, or schedule focus for your peak alertness window.",
  },
  {
    rank: 3,
    type: "computer",
    label: "Tab switching spikes",
    icon: "tabs",
    count: 17,
    impact: 18,
    color: C.yellow,
    colorSoft: C.yellowSoft,
    tip: "Use your app preset to lock allowed tabs during sessions. Blocking news and social removes the biggest switching triggers.",
  },
  {
    rank: 4,
    type: "eye",
    label: "Yawning frequency",
    icon: "yawn",
    count: 6,
    impact: 14,
    color: "#7FB069",
    colorSoft: C.greenSoft,
    tip: "Yawning 3+ times in 10 min is an early fatigue signal. A 2-min stretch walk can reset your alertness without breaking flow.",
  },
  {
    rank: 5,
    type: "computer",
    label: "Typing slowdowns",
    icon: "kb",
    count: 3,
    impact: 12,
    color: "#7BC8F5",
    colorSoft: "#D6EFFF",
    tip: "Typing speed drops 20%+ signal mental fatigue or distraction. Try the 5-min re-focus ritual: close eyes, breathe, re-read your goal.",
  },
];

type SignalStatus = "ok" | "warn" | "low" | "bad";
interface Signal {
  label: string;
  value: string;
  baseline: string;
  status: SignalStatus;
  note: string;
}

const EYE_SIGNALS: Signal[] = [
  {
    label: "Blink rate",
    value: "14/min",
    baseline: "16/min",
    status: "low",
    note: "Slightly low — screen dry-eye risk",
  },
  {
    label: "Yawn events",
    value: "6",
    baseline: "<3 ideal",
    status: "warn",
    note: "Fatigue signal in mid-session",
  },
  {
    label: "Head tilts",
    value: "3",
    baseline: "<5",
    status: "ok",
    note: "Within normal range",
  },
  {
    label: "Phone checks",
    value: "9",
    baseline: "0 ideal",
    status: "bad",
    note: "Most harmful break type",
  },
  {
    label: "Microsleeps",
    value: "4",
    baseline: "0 ideal",
    status: "bad",
    note: "Detected 9:52–10:03 AM",
  },
  {
    label: "Gaze off-screen",
    value: "12%",
    baseline: "<8%",
    status: "warn",
    note: "Above threshold — some distraction",
  },
];

const COMPUTER_SIGNALS: Signal[] = [
  {
    label: "Avg typing speed",
    value: "68 WPM",
    baseline: "82 WPM",
    status: "warn",
    note: "14% below your baseline",
  },
  {
    label: "Tab switches",
    value: "17 total",
    baseline: "<8 ideal",
    status: "bad",
    note: "High — mostly to social sites",
  },
  {
    label: "Focused apps",
    value: "3 apps",
    baseline: "—",
    status: "ok",
    note: "Figma, Notion, Terminal",
  },
  {
    label: "Idle periods",
    value: "3×",
    baseline: "<2 ideal",
    status: "warn",
    note: "Avg 1.8 min each",
  },
];

const TIMELINE = [
  72, 68, 64, 60, 58, 54, 52, 56, 60, 64, 68, 70, 74, 78, 82, 86, 88, 90, 92,
  93, 94, 93, 92, 94, 96, 95, 94, 92, 90, 88, 86, 82, 78, 74, 70, 66, 62, 60,
  58, 56, 58, 60, 62, 64, 68, 72, 74, 76, 78, 80, 82, 84,
];

const TABS = ["Overview", "Eye Signal", "Computer", "Breaks", "Tips"] as const;
type Tab = (typeof TABS)[number];

// ── Shared sub-components ─────────────────────────────────────

function StatusDot({ status }: { status: SignalStatus }) {
  const colors: Record<SignalStatus, string> = {
    ok: C.green,
    warn: C.yellow,
    low: "#7BC8F5",
    bad: C.red,
  };
  return (
    <div
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: colors[status],
        flexShrink: 0,
      }}
    />
  );
}

function ScoreArc({ score }: { score: number }) {
  const [displayScore, setDisplayScore] = useState(0);
  useEffect(() => {
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => setDisplayScore(score)),
    );
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const size = 200,
    stroke = 14,
    r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = displayScore / 100;
  const hue = Math.round(pct * 120);
  const color = `hsl(${hue}, 70%, 52%)`;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={C.accentSoft}
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          style={{
            transition: "stroke-dashoffset 1.2s cubic-bezier(.34,1.2,.64,1)",
          }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 52,
            fontWeight: 900,
            letterSpacing: -2,
            lineHeight: 1,
          }}
        >
          {displayScore}
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: C.soft,
            textTransform: "uppercase",
            letterSpacing: 1.2,
          }}
        >
          Focus score
        </div>
      </div>
    </div>
  );
}

function BreakBar({
  pct,
  color,
  colorSoft,
}: {
  pct: number;
  color: string;
  colorSoft: string;
}) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 200);
    return () => clearTimeout(t);
  }, [pct]);
  return (
    <div
      style={{
        height: 8,
        borderRadius: 999,
        background: colorSoft,
        overflow: "hidden",
        flex: 1,
      }}
    >
      <div
        style={{
          height: "100%",
          borderRadius: 999,
          background: color,
          width: `${width}%`,
          transition: "width 1s cubic-bezier(.34,1.2,.64,1)",
        }}
      />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 15, fontWeight: 900 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.soft }}>
        {label}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        fontWeight: 700,
        color: C.soft,
      }}
    >
      <div
        style={{ width: 16, height: 3, borderRadius: 2, background: color }}
      />
      {label}
    </div>
  );
}

function SignalRow({ signal }: { signal: Signal }) {
  const statusColors: Record<SignalStatus, string> = {
    ok: C.green,
    warn: C.yellow,
    low: "#7BC8F5",
    bad: C.red,
  };
  return (
    <div
      style={{
        background: C.bg,
        borderRadius: 14,
        padding: "14px 16px",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <StatusDot status={signal.status} />
      <div style={{ flex: 1 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 3,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800 }}>{signal.label}</div>
          <div
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 13,
              fontWeight: 600,
              color: statusColors[signal.status],
            }}
          >
            {signal.value}
          </div>
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.soft,
            marginBottom: 3,
          }}
        >
          {signal.note}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#C4A882" }}>
          Baseline: {signal.baseline}
        </div>
      </div>
    </div>
  );
}

// ── Charts ────────────────────────────────────────────────────

function TimelineChart({ data }: { data: number[] }) {
  const W = 600,
    H = 160,
    pad = { t: 32, b: 28, l: 36, r: 16 };
  const iW = W - pad.l - pad.r,
    iH = H - pad.t - pad.b;
  const n = data.length;
  const PEAK_START = 28,
    PEAK_END = 46;
  const peakX1 = pad.l + (PEAK_START / (n - 1)) * iW;
  const peakX2 = pad.l + (PEAK_END / (n - 1)) * iW;
  const baseY = pad.t + iH;
  const pts = data.map(
    (v, i) =>
      [pad.l + (i / (n - 1)) * iW, pad.t + iH - (v / 100) * iH] as [
        number,
        number,
      ],
  );
  const linePath = pts
    .map(
      (p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`,
    )
    .join(" ");
  const areaPath = `${linePath} L${pts[n - 1][0]},${baseY} L${pts[0][0]},${baseY} Z`;
  const yTicks = [0, 25, 50, 75, 100];
  const timeLabels = [
    { label: "9:45", x: pad.l },
    { label: "10:00", x: pad.l + (15 / (n - 1)) * iW },
    { label: "10:15", x: pad.l + (30 / (n - 1)) * iW },
    { label: "10:30", x: pad.l + (45 / (n - 1)) * iW },
    { label: "10:47", x: pad.l + iW },
  ];
  const midX = (peakX1 + peakX2) / 2;
  const peakPts = pts.slice(PEAK_START, PEAK_END + 1);
  const minY = Math.min(...peakPts.map((p) => p[1]));

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: "block", minWidth: 340 }}
      >
        <defs>
          <clipPath id="clip-nonpeak">
            <rect x={pad.l} y={0} width={peakX1 - pad.l} height={H} />
            <rect x={peakX2} y={0} width={pad.l + iW - peakX2 + 2} height={H} />
          </clipPath>
          <clipPath id="clip-peak">
            <rect x={peakX1} y={0} width={peakX2 - peakX1} height={H} />
          </clipPath>
          <linearGradient id="grad-nonpeak" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.accent} stopOpacity="0.18" />
            <stop offset="100%" stopColor={C.accent} stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="grad-peak" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.green} stopOpacity="0.55" />
            <stop offset="100%" stopColor={C.green} stopOpacity="0.04" />
          </linearGradient>
        </defs>
        {yTicks.map((v) => {
          const y = pad.t + iH - (v / 100) * iH;
          return (
            <g key={v}>
              <line
                x1={pad.l}
                y1={y}
                x2={pad.l + iW}
                y2={y}
                stroke={C.border}
                strokeWidth="1"
                strokeDasharray={v === 0 ? undefined : "3 4"}
                opacity={v === 0 ? 1 : 0.5}
              />
              <text
                x={pad.l - 6}
                y={y + 4}
                fontFamily="JetBrains Mono,monospace"
                fontSize="9"
                fill={C.soft}
                textAnchor="end"
                opacity="0.8"
              >
                {v}
              </text>
            </g>
          );
        })}
        <rect
          x={peakX1}
          y={pad.t}
          width={peakX2 - peakX1}
          height={iH}
          fill={C.green}
          opacity="0.07"
          rx="4"
        />
        <path
          d={areaPath}
          fill="url(#grad-nonpeak)"
          clipPath="url(#clip-nonpeak)"
        />
        <path d={areaPath} fill="url(#grad-peak)" clipPath="url(#clip-peak)" />
        <path
          d={linePath}
          fill="none"
          stroke={C.accent}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          clipPath="url(#clip-nonpeak)"
          opacity="0.5"
        />
        <path
          d={linePath}
          fill="none"
          stroke={C.green}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          clipPath="url(#clip-peak)"
        />
        <line
          x1={peakX1}
          y1={pad.t}
          x2={peakX1}
          y2={baseY}
          stroke={C.green}
          strokeWidth="1.5"
          strokeDasharray="4 3"
          opacity="0.6"
        />
        <line
          x1={peakX2}
          y1={pad.t}
          x2={peakX2}
          y2={baseY}
          stroke={C.green}
          strokeWidth="1.5"
          strokeDasharray="4 3"
          opacity="0.6"
        />
        <rect
          x={midX - 38}
          y={pad.t - 28}
          width={76}
          height={20}
          rx={6}
          fill={C.green}
          opacity="0.9"
        />
        <text
          x={midX}
          y={pad.t - 14}
          fontFamily="Nunito,sans-serif"
          fontSize="10"
          fontWeight="800"
          fill="#fff"
          textAnchor="middle"
        >
          ▲ peak · 33 min
        </text>
        <line
          x1={midX}
          y1={pad.t - 8}
          x2={midX}
          y2={minY}
          stroke={C.green}
          strokeWidth="1.5"
          strokeDasharray="3 3"
          opacity="0.7"
        />
        {pts.map((p, i) =>
          data[i] < 60 ? (
            <circle
              key={i}
              cx={p[0]}
              cy={p[1]}
              r="3.5"
              fill={C.red}
              opacity="0.75"
            />
          ) : null,
        )}
        {timeLabels.map(({ label, x }) => (
          <text
            key={label}
            x={x}
            y={H - 6}
            fontFamily="JetBrains Mono,monospace"
            fontSize="9"
            fill={C.soft}
            textAnchor="middle"
          >
            {label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function BlinkChart() {
  const data = [
    16, 15, 14, 13, 12, 11, 12, 13, 14, 15, 16, 17, 16, 15, 14, 14, 15, 16, 17,
    16, 15, 14, 13, 13, 14, 15, 16, 17, 16, 15, 14, 13, 12, 13, 14, 15, 16, 17,
    16, 15, 14, 13, 14, 15, 16, 17, 16, 15, 14, 14, 15, 16,
  ];
  const W = 340,
    H = 90,
    pad = { t: 8, b: 20, l: 8, r: 8 };
  const iW = W - pad.l - pad.r,
    iH = H - pad.t - pad.b;
  const n = data.length;
  const pts = data.map(
    (v, i) =>
      [pad.l + (i / (n - 1)) * iW, pad.t + iH - ((v - 8) / 14) * iH] as [
        number,
        number,
      ],
  );
  const d = pts
    .map(
      (p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`,
    )
    .join(" ");
  const safe_y = pad.t + iH - ((12 - 8) / 14) * iH;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      <rect
        x={pad.l}
        y={safe_y}
        width={iW}
        height={pad.t + iH - safe_y}
        fill="rgba(127,176,105,0.08)"
      />
      <line
        x1={pad.l}
        y1={safe_y}
        x2={pad.l + iW}
        y2={safe_y}
        stroke={C.green}
        strokeWidth="1"
        strokeDasharray="4 3"
        opacity="0.6"
      />
      <text
        x={pad.l + 4}
        y={safe_y - 3}
        fontFamily="Nunito,sans-serif"
        fontSize="8"
        fill={C.green}
        fontWeight="700"
      >
        min safe
      </text>
      <path
        d={d}
        fill="none"
        stroke={C.accent}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {["9:45", "10:00", "10:15", "10:30", "10:47"].map((l, i) => (
        <text
          key={l}
          x={pad.l + (i / 4) * iW}
          y={H - 3}
          fontFamily="JetBrains Mono,monospace"
          fontSize="8"
          fill={C.soft}
          textAnchor="middle"
        >
          {l}
        </text>
      ))}
    </svg>
  );
}

function TypingChart() {
  const data = [
    82, 80, 78, 76, 72, 66, 62, 58, 60, 64, 68, 72, 76, 80, 84, 86, 84, 82, 80,
    78, 76, 74, 72, 68, 64, 62, 60, 64, 68, 72, 76, 80, 82, 84, 86, 84, 82, 80,
    78, 76, 74, 72, 70, 72, 74, 76, 78, 80, 82, 80, 78, 76,
  ];
  const W = 340,
    H = 90,
    pad = { t: 8, b: 20, l: 8, r: 8 };
  const iW = W - pad.l - pad.r,
    iH = H - pad.t - pad.b;
  const n = data.length,
    minV = 50,
    maxV = 95;
  const pts = data.map(
    (v, i) =>
      [
        pad.l + (i / (n - 1)) * iW,
        pad.t + iH - ((v - minV) / (maxV - minV)) * iH,
      ] as [number, number],
  );
  const d = pts
    .map(
      (p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`,
    )
    .join(" ");
  const fill = `${d} L${pts[n - 1][0]},${pad.t + iH} L${pts[0][0]},${pad.t + iH} Z`;
  const base_y = pad.t + iH - ((82 - minV) / (maxV - minV)) * iH;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      <defs>
        <linearGradient id="typ-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.green} stopOpacity="0.2" />
          <stop offset="100%" stopColor={C.green} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#typ-grad)" />
      <line
        x1={pad.l}
        y1={base_y}
        x2={pad.l + iW}
        y2={base_y}
        stroke={C.soft}
        strokeWidth="1"
        strokeDasharray="4 3"
        opacity="0.4"
      />
      <text
        x={pad.l + 4}
        y={base_y - 3}
        fontFamily="Nunito,sans-serif"
        fontSize="8"
        fill={C.soft}
        fontWeight="700"
      >
        baseline 82
      </text>
      <path
        d={d}
        fill="none"
        stroke={C.green}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {["9:45", "10:00", "10:15", "10:30", "10:47"].map((l, i) => (
        <text
          key={l}
          x={pad.l + (i / 4) * iW}
          y={H - 3}
          fontFamily="JetBrains Mono,monospace"
          fontSize="8"
          fill={C.soft}
          textAnchor="middle"
        >
          {l}
        </text>
      ))}
    </svg>
  );
}

// ── Tab content ───────────────────────────────────────────────

function OverviewTab() {
  const { coins, coinsMax, focusScore } = SESSION;
  const pct = (coins / coinsMax) * 100;
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 20 }}
      className="analytics-fade-in"
    >
      {/* Row 1: Score arc + windows */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: 16,
          alignItems: "stretch",
        }}
      >
        <div
          className="analytics-card"
          style={{
            padding: 24,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <ScoreArc score={focusScore} />
          <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
            <MiniStat label="vs last" value={`+${SESSION.scoreDelta} pts`} />
            <MiniStat label="streak" value="4 days" />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            className="analytics-card"
            style={{
              padding: 20,
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: C.accentSoft,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                flexShrink: 0,
              }}
            >
              ⏳
            </div>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: 1.2,
                  color: C.soft,
                  marginBottom: 2,
                }}
              >
                Session duration
              </div>
              <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: -1 }}>
                {SESSION.duration}
              </div>
            </div>
          </div>
          <div
            className="analytics-card"
            style={{
              padding: 18,
              display: "flex",
              alignItems: "center",
              gap: 14,
              background: C.greenSoft,
              borderColor: C.green,
              flex: 1,
            }}
          >
            <div style={{ fontSize: 22, flexShrink: 0 }}>⏱</div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: 1.2,
                  color: C.green,
                  marginBottom: 2,
                }}
              >
                Peak focus window
              </div>
              <div style={{ fontSize: 16, fontWeight: 900 }}>
                {SESSION.peakWindow.start} – {SESSION.peakWindow.end}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.soft }}>
                {SESSION.peakWindow.duration} uninterrupted
              </div>
            </div>
            <div
              style={{
                background: C.green,
                color: "#fff",
                borderRadius: 999,
                padding: "6px 14px",
                fontSize: 13,
                fontWeight: 900,
                flexShrink: 0,
              }}
            >
              {SESSION.peakWindow.duration}
            </div>
          </div>
          <div
            className="analytics-card"
            style={{
              padding: 18,
              display: "flex",
              alignItems: "center",
              gap: 14,
              background: C.redSoft,
              borderColor: C.red,
              flex: 1,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, flexShrink: 0 }}>zzz</div>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: 1.2,
                  color: C.red,
                  marginBottom: 2,
                }}
              >
                Lowest focus period
              </div>
              <div style={{ fontSize: 15, fontWeight: 900 }}>
                {SESSION.lowWindow.start} – {SESSION.lowWindow.end}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.soft }}>
                {SESSION.lowWindow.duration} of drift
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Coins */}
      <div
        className="analytics-card"
        style={{ padding: 22, display: "flex", alignItems: "center", gap: 24 }}
      >
        <div
          style={{
            fontSize: 42,
            fontWeight: 900,
            letterSpacing: -1,
            color: C.accent,
            flexShrink: 0,
          }}
        >
          {coins}
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: 1.2,
              color: C.soft,
              marginBottom: 6,
            }}
          >
            Coins earned · score {focusScore}/100 × {coinsMax} max
          </div>
          <div
            style={{ height: 10, borderRadius: 999, background: C.accentSoft }}
          >
            <div
              style={{
                height: "100%",
                borderRadius: 999,
                background: C.accent,
                width: `${pct}%`,
                transition: "width 1.2s cubic-bezier(.34,1.2,.64,1)",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 5,
              fontSize: 11,
              fontWeight: 700,
              color: C.soft,
            }}
          >
            <span>{coins} earned</span>
            <span>{coinsMax - coins} left on the table</span>
            <span>{coinsMax} max</span>
          </div>
        </div>
      </div>

      {/* Row 3: Top 5 breaks */}
      <div className="analytics-card" style={{ padding: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 10,
            marginBottom: 4,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: -0.4 }}>
            Top 5 break patterns
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.soft }}>
            ranked by impact
          </div>
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: C.soft,
            marginBottom: 16,
          }}
        >
          Each pattern costs you focus score — and coins.
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {BREAKS.map((b, i) => (
            <div
              key={b.rank}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "13px 0",
                borderBottom:
                  i < BREAKS.length - 1 ? `1px solid ${C.border}` : "none",
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  flexShrink: 0,
                  background:
                    b.rank === 1
                      ? C.accent
                      : b.rank === 2
                        ? "#C97A3F"
                        : b.rank === 3
                          ? C.yellow
                          : C.soft,
                  color: b.rank <= 3 ? "#fff" : C.soft,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 15,
                  fontWeight: 900,
                }}
              >
                {b.rank}
              </div>
              <div
                style={{
                  fontSize: 20,
                  width: 26,
                  textAlign: "center",
                  flexShrink: 0,
                }}
              >
                {b.icon}
              </div>
              <div style={{ flex: "0 0 170px" }}>
                <div style={{ fontSize: 14, fontWeight: 900 }}>{b.label}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.soft }}>
                  {b.count}× · {b.type === "eye" ? "Eye signal" : "Computer"}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <BreakBar
                  pct={b.impact}
                  color={b.color}
                  colorSoft={b.colorSoft}
                />
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 900,
                  color: b.color,
                  width: 40,
                  textAlign: "right",
                  flexShrink: 0,
                }}
              >
                {b.impact}%
              </div>
              <div
                style={{
                  fontFamily: "JetBrains Mono,monospace",
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.soft,
                  width: 56,
                  textAlign: "right",
                  flexShrink: 0,
                }}
              >
                −{Math.round(((b.impact * SESSION.coinsMax) / 100) * 0.4)} coins
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Row 4: Timeline */}
      <div className="analytics-card" style={{ padding: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 900,
                letterSpacing: -0.4,
                marginBottom: 2,
              }}
            >
              Focus timeline
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.soft }}>
              Score per minute · green = peak window
            </div>
          </div>
          <div style={{ display: "flex", gap: 14 }}>
            <Legend color={C.accent} label="Focus score" />
            <Legend color={C.green} label="Peak window" />
            <Legend color={C.red} label="Low moments" />
          </div>
        </div>
        <TimelineChart data={TIMELINE} />
      </div>
    </div>
  );
}

function EyeTab() {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 20 }}
      className="analytics-fade-in"
    >
      <div className="analytics-card" style={{ padding: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 4 }}>
          Eye signal breakdown
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: C.soft,
            marginBottom: 20,
          }}
        >
          Computer vision analysis across the session
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
        >
          {EYE_SIGNALS.map((s) => (
            <SignalRow key={s.label} signal={s} />
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="analytics-card" style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 16 }}>
            Microsleep timeline
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { time: "9:52 AM", duration: "~2.1s", severity: "high" },
              { time: "9:57 AM", duration: "~1.4s", severity: "med" },
              { time: "10:01 AM", duration: "~3.2s", severity: "high" },
              { time: "10:03 AM", duration: "~0.8s", severity: "low" },
            ].map((m) => (
              <div
                key={m.time}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  background: C.bg,
                  borderRadius: 10,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background:
                      m.severity === "high"
                        ? C.red
                        : m.severity === "med"
                          ? C.yellow
                          : C.green,
                    flexShrink: 0,
                  }}
                />
                <div
                  style={{
                    fontFamily: "JetBrains Mono,monospace",
                    fontSize: 12,
                    fontWeight: 600,
                    color: C.soft,
                    width: 72,
                    flexShrink: 0,
                  }}
                >
                  {m.time}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  {m.duration}
                </div>
                <div
                  style={{
                    marginLeft: "auto",
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    color:
                      m.severity === "high"
                        ? C.red
                        : m.severity === "med"
                          ? C.yellow
                          : C.green,
                  }}
                >
                  {m.severity}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 14,
              padding: "10px 12px",
              background: C.redSoft,
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              color: C.red,
            }}
          >
            ⚠ 4 microsleeps in 11 min — significant fatigue cluster
          </div>
        </div>

        <div className="analytics-card" style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 16 }}>
            Blink rate over time
          </div>
          <BlinkChart />
          <div
            style={{
              marginTop: 12,
              fontSize: 12,
              fontWeight: 700,
              color: C.soft,
            }}
          >
            Healthy range: 12–20 blinks/min. Below 12 = screen dry-eye risk.
          </div>
        </div>
      </div>
    </div>
  );
}

function ComputerTab() {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 20 }}
      className="analytics-fade-in"
    >
      <div className="analytics-card" style={{ padding: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 4 }}>
          Computer signal breakdown
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: C.soft,
            marginBottom: 20,
          }}
        >
          Passive tracking of typing and tab behaviour
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
        >
          {COMPUTER_SIGNALS.map((s) => (
            <SignalRow key={s.label} signal={s} />
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="analytics-card" style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 14 }}>
            Typing speed over time
          </div>
          <TypingChart />
          <div
            style={{
              marginTop: 10,
              fontSize: 12,
              fontWeight: 700,
              color: C.soft,
            }}
          >
            Your baseline avg: 82 WPM. Drops below 60 indicate fatigue.
          </div>
        </div>

        <div className="analytics-card" style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 14 }}>
            Tab switch destinations
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {[
              { site: "Social media", count: 7, pct: 41, color: C.red },
              { site: "News / articles", count: 4, pct: 24, color: "#C97A3F" },
              { site: "Work tools", count: 3, pct: 18, color: C.green },
              { site: "Messaging", count: 2, pct: 12, color: C.yellow },
              { site: "Other", count: 1, pct: 5, color: C.soft },
            ].map((r) => (
              <div
                key={r.site}
                style={{ display: "flex", alignItems: "center", gap: 10 }}
              >
                <div
                  style={{
                    width: 120,
                    fontSize: 13,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {r.site}
                </div>
                <BreakBar
                  pct={r.pct}
                  color={r.color}
                  colorSoft={`${r.color}22`}
                />
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: C.soft,
                    width: 28,
                    flexShrink: 0,
                    textAlign: "right",
                  }}
                >
                  {r.count}×
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BreaksTab({
  expandedBreak,
  setExpandedBreak,
}: {
  expandedBreak: number | null;
  setExpandedBreak: (n: number | null) => void;
}) {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
      className="analytics-fade-in"
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: C.soft,
          marginBottom: 4,
        }}
      >
        Ranked by total impact on your focus score. Click any break to see
        details.
      </div>
      {BREAKS.map((b) => (
        <div
          key={b.rank}
          className="analytics-card"
          style={{ padding: 0, overflow: "hidden", cursor: "pointer" }}
          onClick={() =>
            setExpandedBreak(expandedBreak === b.rank ? null : b.rank)
          }
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "18px 22px",
              borderBottom:
                expandedBreak === b.rank ? `1.5px solid ${C.border}` : "none",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background:
                  b.rank === 1 ? C.accent : b.rank === 2 ? "#C97A3F" : C.soft,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 900,
                flexShrink: 0,
              }}
            >
              {b.rank}
            </div>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: b.colorSoft,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                flexShrink: 0,
              }}
            >
              {b.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{ fontSize: 15, fontWeight: 900, letterSpacing: -0.3 }}
              >
                {b.label}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.soft }}>
                {b.count}× detected ·{" "}
                {b.type === "eye" ? "Eye Signal" : "Computer Signal"}
              </div>
            </div>
            <div style={{ width: 160, flexShrink: 0 }}>
              <BreakBar
                pct={b.impact}
                color={b.color}
                colorSoft={b.colorSoft}
              />
            </div>
            <div
              style={{
                width: 44,
                textAlign: "right",
                fontSize: 16,
                fontWeight: 900,
                color: b.color,
                flexShrink: 0,
              }}
            >
              {b.impact}%
            </div>
            <div
              style={{
                color: C.soft,
                fontSize: 12,
                transition: "transform 0.2s",
                transform:
                  expandedBreak === b.rank ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              ▼
            </div>
          </div>
          {expandedBreak === b.rank && (
            <div style={{ padding: "18px 22px", background: b.colorSoft }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: C.ink,
                  lineHeight: 1.65,
                  marginBottom: 14,
                }}
              >
                {b.tip}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div
                  style={{
                    background: C.card,
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 12,
                    fontWeight: 800,
                    color: b.color,
                    flex: 1,
                    textAlign: "center",
                  }}
                >
                  {b.count}×<br />
                  <span style={{ fontWeight: 700, color: C.soft }}>
                    detected
                  </span>
                </div>
                <div
                  style={{
                    background: C.card,
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 12,
                    fontWeight: 800,
                    color: b.color,
                    flex: 1,
                    textAlign: "center",
                  }}
                >
                  {b.impact}%<br />
                  <span style={{ fontWeight: 700, color: C.soft }}>
                    of total impact
                  </span>
                </div>
                <div
                  style={{
                    background: C.card,
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 12,
                    fontWeight: 800,
                    color: b.type === "eye" ? C.accent : C.green,
                    flex: 1,
                    textAlign: "center",
                  }}
                >
                  {b.type === "eye" ? "Eye" : "Computer"}
                  <br />
                  <span style={{ fontWeight: 700, color: C.soft }}>
                    signal type
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TipsTab() {
  const tips = [
    {
      priority: "High",
      icon: "phone",
      title: "Eliminate phone proximity",
      body: "Place your phone in another room or a drawer during sessions. Studies show that phone presence alone reduces working memory capacity, even when it's silent.",
    },
    {
      priority: "High",
      icon: "zzz",
      title: "Address early-session fatigue",
      body: "Your microsleep cluster (9:52–10:03) suggests you started the session already fatigued. Try a 10-min walk or a 20-min nap before long focus blocks.",
    },
    {
      priority: "Med",
      icon: "tabs",
      title: "Reduce tab switching",
      body: "Install a site blocker for your focus app preset. Aim for <8 tab switches per session. Social media was the destination for 41% of your switches.",
    },
    {
      priority: "Med",
      icon: "blink",
      title: "Hydrate & blink consciously",
      body: "Your blink rate dipped below the healthy threshold in the second half. Use the 20-20-20 rule: every 20 min, look 20 ft away for 20 seconds.",
    },
    {
      priority: "Low",
      icon: "kb",
      title: "Watch typing speed as fatigue signal",
      body: "Your WPM dropped 14% below baseline. When you notice this happening, take a 2-min stretch break rather than pushing through with lower quality work.",
    },
    {
      priority: "Low",
      icon: "peak",
      title: "Leverage your peak window",
      body: "You consistently focus best 30–60 min into a session. Schedule your hardest cognitive tasks for that window, and use warm-up tasks at the start.",
    },
  ];
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 20 }}
      className="analytics-fade-in"
    >
      <div
        className="analytics-card"
        style={{ padding: 24, background: C.accentSoft, borderColor: C.accent }}
      >
        <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 8 }}>
          Your focus profile
        </div>
        <p
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: C.soft,
            lineHeight: 1.65,
            margin: 0,
          }}
        >
          You have a{" "}
          <strong style={{ color: C.ink }}>
            strong mid-session performance
          </strong>{" "}
          with a clear peak window around 10:15–10:47. Your main drag is an
          early-session fatigue cluster caused by phone proximity and low sleep
          quality. Here's a personalised plan:
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {tips.map((tip) => (
          <div key={tip.title} className="analytics-tip-card">
            <div style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>
              {tip.icon}
            </div>
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 900 }}>{tip.title}</div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    padding: "2px 7px",
                    borderRadius: 999,
                    background:
                      tip.priority === "High"
                        ? C.redSoft
                        : tip.priority === "Med"
                          ? C.yellowSoft
                          : C.greenSoft,
                    color:
                      tip.priority === "High"
                        ? C.red
                        : tip.priority === "Med"
                          ? "#8A6A10"
                          : C.green,
                  }}
                >
                  {tip.priority}
                </div>
              </div>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.soft,
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {tip.body}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div
        className="analytics-card"
        style={{
          padding: 22,
          display: "flex",
          alignItems: "center",
          gap: 20,
          background: C.greenSoft,
          borderColor: C.green,
        }}
      >
        <div style={{ fontSize: 32 }}>⏱</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 4 }}>
            Your peak focus window today
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: -0.5,
              color: C.green,
            }}
          >
            {SESSION.peakWindow.start} – {SESSION.peakWindow.end}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.soft }}>
            {SESSION.peakWindow.duration} of uninterrupted deep work · schedule
            your hardest tasks here next time
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Analytics page ───────────────────────────────────────

export function Component() {
  injectAnalyticsStyles();

  const [tab, setTab] = useState<Tab>("Overview");
  const [expandedBreak, setExpandedBreak] = useState<number | null>(null);
  const [blobMsg, setBlobMsg] = useState("great session today!");
  const [walkTrigger, setWalkTrigger] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const msgs: Record<Tab, string> = {
      Overview: "great session today!",
      "Eye Signal": "your eyes worked hard",
      Computer: "tab switching is #1 habit to fix",
      Breaks: "phone checks hurt the most",
      Tips: "let's improve together!",
    };
    setBlobMsg(msgs[tab]);
  }, [tab]);

  useEffect(() => {
    const id = setInterval(() => setWalkTrigger((w) => w + 1), 22000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        display: "grid",
        gridTemplateColumns: "220px 1fr",
        minHeight: "100vh",
        position: "relative",
        fontFamily: "Nunito, system-ui, sans-serif",
        color: C.ink,
        background: C.bg,
      }}
    >
      {/* ── Sidebar ── */}
      <aside
        style={{
          background: C.card,
          borderRight: `1.5px solid ${C.border}`,
          padding: "28px 16px",
          display: "flex",
          flexDirection: "column",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "hidden",
        }}
      >
        {/* Logo */}
        <a
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            marginBottom: 36,
            textDecoration: "none",
            color: C.ink,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: C.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 6px rgba(240,143,96,0.35)",
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#FFE8D9",
              }}
            />
          </div>
          <span style={{ fontWeight: 900, fontSize: 17, letterSpacing: -0.3 }}>
            Bloom
          </span>
        </a>

        {/* Session chip */}
        <div
          style={{
            background: C.accentSoft,
            borderRadius: 12,
            padding: "10px 12px",
            marginBottom: 24,
            fontSize: 11,
            fontWeight: 800,
            color: C.accent,
            textTransform: "uppercase",
            letterSpacing: 1.2,
          }}
        >
          Session recap · Apr 24
        </div>

        {/* Nav */}
        <nav
          style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}
        >
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="analytics-nav-tab"
              style={{
                background: tab === t ? C.accentSoft : "transparent",
                color: tab === t ? C.accent : C.soft,
              }}
            >
              {t}
            </button>
          ))}
        </nav>

        {/* Coins widget */}
        <div
          style={{
            background: C.bg,
            border: `1.5px solid ${C.border}`,
            borderRadius: 14,
            padding: "14px 14px 10px",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: C.soft,
              textTransform: "uppercase",
              letterSpacing: 1.2,
              marginBottom: 8,
            }}
          >
            Coins earned
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 900,
              color: C.accent,
              letterSpacing: -1,
              marginBottom: 6,
            }}
          >
            {SESSION.coins}
          </div>
          <div
            style={{ height: 6, borderRadius: 999, background: C.accentSoft }}
          >
            <div
              style={{
                height: "100%",
                borderRadius: 999,
                background: C.accent,
                width: `${(SESSION.coins / SESSION.coinsMax) * 100}%`,
                transition: "width 1.2s ease",
              }}
            />
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.soft,
              marginTop: 5,
            }}
          >
            {SESSION.coins} / {SESSION.coinsMax} this session
          </div>
        </div>

        {/* Back */}
        <a
          href="/login"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 16,
            fontSize: 13,
            fontWeight: 700,
            color: C.soft,
            textDecoration: "none",
          }}
        >
          ← Back
        </a>
      </aside>

      {/* ── Main content ── */}
      <main style={{ padding: "36px 40px", position: "relative", minWidth: 0 }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 32,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 32,
                fontWeight: 900,
                letterSpacing: -1,
                marginBottom: 4,
                margin: 0,
              }}
            >
              {tab}
            </h1>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: C.soft,
                marginTop: 4,
              }}
            >
              {SESSION.date} · {SESSION.duration}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div
              style={{
                background: SESSION.scoreDelta > 0 ? C.greenSoft : C.redSoft,
                color: SESSION.scoreDelta > 0 ? "#2D6A23" : C.red,
                borderRadius: 999,
                padding: "6px 14px",
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              {SESSION.scoreDelta > 0 ? "↑" : "↓"}{" "}
              {Math.abs(SESSION.scoreDelta)} pts
            </div>
          </div>
        </div>

        {tab === "Overview" && <OverviewTab key="overview" />}
        {tab === "Eye Signal" && <EyeTab key="eye" />}
        {tab === "Computer" && <ComputerTab key="computer" />}
        {tab === "Breaks" && (
          <BreaksTab
            key="breaks"
            expandedBreak={expandedBreak}
            setExpandedBreak={setExpandedBreak}
          />
        )}
        {tab === "Tips" && <TipsTab key="tips" />}
      </main>

      {/* Floating mascot */}
      <DesktopPet
        state="encouraging"
        palette="cream"
        shape="wide"
        size={100}
        bubble={{ text: blobMsg }}
        initialPos={{ x: 60, y: 400 }}
        bounds={{ left: 0, top: 80, right: 200, bottom: 700 }}
        containerRef={containerRef}
        walkTrigger={walkTrigger}
      />
    </div>
  );
}
