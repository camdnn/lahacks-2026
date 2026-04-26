import { useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, Monitor, Zap, Shield } from "lucide-react";
import { Blob } from "../components/Blob";

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
};

const HOW_IT_WORKS = [
  {
    icon: Eye,
    color: "#E26656",
    colorSoft: "#FFE0DB",
    title: "Eye Signal Tracking",
    desc: "MediaPipe's 478-point face mesh runs locally in your browser. Bloom watches your eye aspect ratio to catch microsleeps, your gaze direction to detect eyes off-screen, and your blink patterns to gauge alertness — all without a single frame leaving your device.",
  },
  {
    icon: Monitor,
    color: C.green,
    colorSoft: C.greenSoft,
    title: "Computer Behaviour",
    desc: "Bloom monitors head tilt and turn angles to spot when you've looked away, mouth openness to detect yawns, and tab-switching events during specialised sessions. Install the optional Pudge overlay for even deeper desktop-level insights.",
  },
  {
    icon: Zap,
    color: C.accent,
    colorSoft: C.accentSoft,
    title: "Flow Sessions & Coins",
    desc: "Every 5 seconds of detected focus earns you a coin, multiplied by your streak and score bonus — up to 3×. Your focus score (0–100) reflects distraction events in real time, and gradually recovers during clean stretches to reward sustained effort.",
  },
];

export default function Info() {
  const navigate = useNavigate();
  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        fontFamily: "Nunito, system-ui, sans-serif",
        color: C.ink,
        overflowX: "hidden",
      }}
    >
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px 80px" }}>
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
            marginBottom: 48,
            padding: 0,
          }}
        >
          <ArrowLeft size={15} />
          Back
        </button>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 72 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
            <Blob state="cheering" palette="peach" shape="classic" size={120} showGround />
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: C.accentSoft,
              color: C.accent,
              borderRadius: 999,
              padding: "5px 14px",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 1,
              textTransform: "uppercase",
              marginBottom: 20,
            }}
          >
            ✦ About Bloom
          </div>
          <h1
            style={{
              fontSize: "clamp(34px, 5vw, 56px)",
              fontWeight: 900,
              letterSpacing: -1.5,
              lineHeight: 1.05,
              marginBottom: 18,
              color: C.ink,
            }}
          >
            Your focus has a{" "}
            <span style={{ color: C.accent }}>new best friend.</span>
          </h1>
          <p
            style={{
              fontSize: 16,
              fontWeight: 500,
              color: C.soft,
              maxWidth: 540,
              margin: "0 auto",
              lineHeight: 1.7,
            }}
          >
            Bloom watches your eye signals and computer behaviour to catch micro-distractions
            before they steal your flow — and celebrates every win with coins and your personal
            blob companion.
          </p>
        </div>

        {/* How it works */}
        <h2
          style={{
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: -0.5,
            marginBottom: 24,
            color: C.ink,
          }}
        >
          How it works
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 64 }}>
          {HOW_IT_WORKS.map(({ icon: Icon, color, colorSoft, title, desc }) => (
            <div
              key={title}
              style={{
                background: C.card,
                border: `1.5px solid ${C.border}`,
                borderRadius: 20,
                padding: "24px 28px",
                display: "flex",
                gap: 20,
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: colorSoft,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon size={20} style={{ color }} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6, color: C.ink }}>
                  {title}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.soft, lineHeight: 1.65 }}>
                  {desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Privacy */}
        <div
          style={{
            background: C.greenSoft,
            border: `1.5px solid ${C.green}`,
            borderRadius: 20,
            padding: "28px 32px",
            marginBottom: 64,
            display: "flex",
            gap: 20,
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Shield size={20} style={{ color: C.green }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6, color: C.ink }}>
              Privacy-first by design
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "#4a6b40", lineHeight: 1.65 }}>
              All face-landmark processing runs entirely in your browser using WebAssembly.
              Raw video frames are never uploaded, stored, or transmitted. Only aggregated
              session metrics (focus score, distraction counts, coins earned) are saved to your
              account. You can delete your data at any time.
            </div>
          </div>
        </div>

        {/* Tech */}
        <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 16, color: C.ink }}>
          Built with
        </h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 64 }}>
          {[
            "MediaPipe FaceLandmarker",
            "React + TypeScript",
            "Tailwind CSS",
            "Supabase",
            "Vite",
            "Lucide Icons",
          ].map((tech) => (
            <span
              key={tech}
              style={{
                background: C.card,
                border: `1.5px solid ${C.border}`,
                borderRadius: 999,
                padding: "6px 14px",
                fontSize: 13,
                fontWeight: 700,
                color: C.soft,
              }}
            >
              {tech}
            </span>
          ))}
        </div>

        {/* CTA */}
        <div
          style={{
            background: C.card,
            border: `1.5px solid ${C.border}`,
            borderRadius: 24,
            padding: "48px 32px",
            textAlign: "center",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <Blob state="encouraging" palette="honey" shape="tall" size={90} showGround />
          </div>
          <h3 style={{ fontSize: 26, fontWeight: 900, marginBottom: 10, color: C.ink }}>
            Ready to find your flow?
          </h3>
          <p style={{ fontSize: 14, fontWeight: 500, color: C.soft, marginBottom: 24 }}>
            Start a free session — no credit card, no download required.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => navigate("/register")}
              style={{
                background: C.accent,
                color: "#fff",
                border: "none",
                borderRadius: 999,
                padding: "13px 28px",
                fontSize: 15,
                fontWeight: 800,
                cursor: "pointer",
                fontFamily: "inherit",
                boxShadow: "0 6px 20px rgba(240,143,96,0.35)",
              }}
            >
              Get started free →
            </button>
            <button
              onClick={() => navigate("/faq")}
              style={{
                background: "transparent",
                color: C.soft,
                border: `2px solid ${C.border}`,
                borderRadius: 999,
                padding: "13px 28px",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Read the FAQ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
