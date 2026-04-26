import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ArrowLeft } from "lucide-react";
import { Blob } from "../components/Blob";

const C = {
  bg: "#FBF1E5",
  card: "#FFFAF1",
  border: "#EAD7BE",
  ink: "#3D2A1B",
  soft: "#806550",
  accent: "#F08F60",
  accentSoft: "#FFE8D9",
};

const FAQS = [
  {
    q: "What is Bloom?",
    a: "Bloom is a focus companion app that uses your webcam to detect micro-distractions — like microsleeps, phone checks, and yawning — and helps you stay in a state of deep flow. Your personal blob mascot cheers you on and rewards you with coins for every focused minute.",
  },
  {
    q: "How does Bloom track my focus?",
    a: "Bloom uses MediaPipe's face landmark model running entirely in your browser to measure eye openness (detecting microsleeps), mouth openness (detecting yawns), head tilt and turn angles, and gaze direction. It also monitors tab-switching behavior during specialised sessions. No data ever leaves your device.",
  },
  {
    q: "What equipment do I need?",
    a: "Just a webcam and a modern browser (Chrome or Edge recommended). No extra hardware, no downloads required — unless you want the optional Pudge desktop overlay for deeper computer-signal tracking.",
  },
  {
    q: "How do I earn coins?",
    a: "You earn 1 coin for every 5 seconds of detected focus during a session. Your earnings are multiplied by a streak bonus (up to +2×) and a score bonus (up to +1×), for a maximum of 3× coins. The longer you stay focused without distraction, the faster your coins stack up.",
  },
  {
    q: "What is the focus score?",
    a: "Your focus score starts at 100 each session and decreases when distractions are detected — microsleeps cost the most (−10 pts), while small head tilts barely dent it (−1 pt). The score gradually recovers at +1 point per 60 seconds of clean focus. It feeds into your coin multiplier.",
  },
  {
    q: "What is the multiplier?",
    a: "The multiplier (shown during a session) combines a streak bonus and a score bonus. Maintaining a focused streak for over 30 s adds 0.5×, over 60 s adds 1×, and over 120 s adds 2×. A focus score above 70, 80, or 90 adds an additional 0.25×, 0.5×, or 1× respectively. Max multiplier is 3×.",
  },
  {
    q: "What can I buy with coins?",
    a: "Head to the Character Shop (accessible from your profile menu or the footer link). You can unlock new blob characters — each with a unique colour palette and shape — to accompany you during focus sessions. Prices range from 150 to 350 coins.",
  },
  {
    q: "Is my camera data stored or shared?",
    a: "No. All face-landmark processing runs locally in your browser using WebAssembly. Raw video frames never leave your device. Only aggregated session metrics (focus score, distraction counts, coins earned) are saved to your account.",
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        background: C.card,
        border: `1.5px solid ${open ? C.accent : C.border}`,
        borderRadius: 16,
        overflow: "hidden",
        transition: "border-color 0.2s",
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 24px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "Nunito, system-ui, sans-serif",
          gap: 16,
        }}
      >
        <span style={{ fontWeight: 800, fontSize: 15, color: C.ink, lineHeight: 1.4 }}>{q}</span>
        <ChevronDown
          size={18}
          style={{
            color: C.accent,
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        />
      </button>
      {open && (
        <div
          style={{
            padding: "0 24px 20px",
            fontSize: 14,
            fontWeight: 500,
            color: C.soft,
            lineHeight: 1.7,
            borderTop: `1px solid ${C.border}`,
            paddingTop: 16,
          }}
        >
          {a}
        </div>
      )}
    </div>
  );
}

export default function FAQ() {
  const navigate = useNavigate();
  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        fontFamily: "Nunito, system-ui, sans-serif",
        color: C.ink,
        padding: "0 0 80px",
      }}
    >
      {/* Header */}
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "40px 24px 0",
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 700,
            color: C.soft,
            fontFamily: "inherit",
            marginBottom: 40,
            padding: 0,
          }}
        >
          <ArrowLeft size={15} />
          Back
        </button>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
          <Blob state="encouraging" palette="cream" shape="wide" size={100} showGround />
        </div>

        <h1
          style={{
            fontSize: "clamp(32px, 5vw, 52px)",
            fontWeight: 900,
            letterSpacing: -1.5,
            textAlign: "center",
            marginBottom: 12,
            color: C.ink,
          }}
        >
          Frequently Asked Questions
        </h1>
        <p
          style={{
            textAlign: "center",
            fontSize: 15,
            fontWeight: 500,
            color: C.soft,
            marginBottom: 48,
          }}
        >
          Everything you need to know about Bloom.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {FAQS.map((item) => (
            <FAQItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 56 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: C.soft, marginBottom: 16 }}>
            Still have questions?
          </p>
          <button
            onClick={() => navigate("/")}
            style={{
              background: C.accent,
              color: "#fff",
              border: "none",
              borderRadius: 999,
              padding: "12px 28px",
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: "0 6px 20px rgba(240,143,96,0.35)",
            }}
          >
            Back to home →
          </button>
        </div>
      </div>
    </div>
  );
}
