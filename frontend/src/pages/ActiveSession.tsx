import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import { useFocus } from "../context/FocusContext";
import { useAuth } from "../context/AuthContext";
import { Blob, type BlobState } from "../components/Blob";
import { Download, ChevronDown, LogOut } from "lucide-react";
import { CartoonCoin } from "../components/CartoonCoin";

// ── Bloom palette ──────────────────────────────────────────────
const C = {
  bg:          "#FBF1E5",
  card:        "#FFFAF1",
  border:      "#EAD7BE",
  ink:         "#3D2A1B",
  soft:        "#806550",
  accent:      "#F08F60",
  accentSoft:  "#FFE8D9",
  green:       "#7FB069",
  greenSoft:   "#D9F0D3",
  red:         "#E26656",
  redSoft:     "#FFE0DB",
  yellow:      "#F5C24A",
  yellowSoft:  "#FFF3D6",
  panelBg:     "#1E0F06",
  panelBorder: "rgba(234,215,190,0.12)",
};

const T_WINDOW_S = 60;

function fmt(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const DISTRACTOR_LABELS: Record<string, string> = {
  microsleep:      "Eyes Closed",
  yawn:            "Yawn",
  phone_check:     "Phone Check",
  head_tilt:       "Head Tilt",
  eyes_off_screen: "Eyes Off Screen",
  tab_switch:      "Tab Switch",
};

function getBlobState(score: number, face: boolean): BlobState {
  if (!face) return "distracted";
  if (score >= 80) return "focused";
  if (score >= 50) return "encouraging";
  return "sad";
}

// ── Human-readable signal row ──────────────────────────────────
function SignalRow({
  label, value, status, hint,
}: { label: string; value: string; status: "good" | "warn" | "bad"; hint: string }) {
  const dot = status === "good" ? C.green : status === "warn" ? C.yellow : C.red;
  const valColor = dot;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(251,241,229,0.55)", lineHeight: 1 }}>{label}</div>
        <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(251,241,229,0.3)", marginTop: 1 }}>{hint}</div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 900, color: valColor, fontFamily: "monospace", flexShrink: 0 }}>{value}</div>
    </div>
  );
}

export default function ActiveSession() {
  const navigate = useNavigate();
  const { durationMins, elapsed, end, isActive } = useSession();
  const focus = useFocus();
  const { profile, updateCoins, logout } = useAuth();

  const [ending, setEnding] = useState(false);
  const [poked, setPoked] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const videoRef       = useRef<HTMLVideoElement>(null);
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const dropdownRef    = useRef<HTMLDivElement>(null);
  const goingToSummary = useRef(false);

  useEffect(() => {
    if (!isActive && !ending && !goingToSummary.current) navigate("/home");
  }, [isActive, ending, navigate]);

  useEffect(() => {
    const h = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setProfileOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (videoRef.current && focus.cameraStream)
      videoRef.current.srcObject = focus.cameraStream;
  }, [focus.cameraStream]);

  // Auto-end when timer runs out
  useEffect(() => {
    if (durationMins && elapsed >= durationMins * 60 && !ending) handleEnd();
  }, [elapsed, durationMins]);

  // ── Landmark canvas overlay ────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    if (!focus.keyPoints) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const video = videoRef.current;
    if (video) {
      canvas.width  = video.offsetWidth;
      canvas.height = video.offsetHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const W = canvas.width, H = canvas.height;
    const px = (x: number) => (1 - x) * W;
    const py = (y: number) => y * H;

    const drawPoly = (pts: [number, number][], color: string, close = true) => {
      if (!pts.length) return;
      ctx.beginPath();
      ctx.moveTo(px(pts[0][0]), py(pts[0][1]));
      for (let i = 1; i < pts.length; i++) ctx.lineTo(px(pts[i][0]), py(pts[i][1]));
      if (close) ctx.closePath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };

    const { leftEye, rightEye, nose, tiltL, tiltR, lipTop, lipBot, mouthL, mouthR } = focus.keyPoints;

    const eyeColor = focus.ear > 0.22 ? C.green : C.red;
    drawPoly(leftEye, eyeColor);
    drawPoly(rightEye, eyeColor);

    ctx.beginPath();
    ctx.moveTo(px(tiltL[0]), py(tiltL[1]));
    ctx.lineTo(px(tiltR[0]), py(tiltR[1]));
    ctx.strokeStyle = Math.abs(focus.head_tilt) < 22 ? C.green : C.yellow;
    ctx.lineWidth = 2;
    ctx.stroke();

    const mouthColor = focus.mar < 0.48 ? C.green : C.red;
    drawPoly([mouthL, lipTop, mouthR, lipBot], mouthColor);

    ctx.beginPath();
    ctx.arc(px(nose[0]), py(nose[1]), 3, 0, Math.PI * 2);
    ctx.fillStyle = "#7BC8F5";
    ctx.fill();

    const irisColor = Math.abs(focus.gaze_x ?? 0) > 0.15 ? C.yellow : "#b39ddb";
    for (const iris of [focus.keyPoints?.leftIris, focus.keyPoints?.rightIris]) {
      if (!iris) continue;
      ctx.beginPath();
      ctx.arc(px(iris[0]), py(iris[1]), 3, 0, Math.PI * 2);
      ctx.fillStyle = irisColor;
      ctx.fill();
    }
  }, [focus.keyPoints, focus.ear, focus.mar, focus.head_tilt, focus.yaw, focus.pitch, focus.gaze_x]);

  const handlePoke = () => {
    if (poked) return;
    setPoked(true);
    setTimeout(() => setPoked(false), 500);
  };

  const handleEnd = async () => {
    if (ending) return;
    setEnding(true);
    const timelines = focus.getTimelines();
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 12_000)
      );
      const summary = await Promise.race([end(), timeoutPromise]);
      goingToSummary.current = true;
      navigate("/summary", { state: { summary: { ...summary, focus_timeline: timelines.focus, event_timeline: timelines.events } } });
    } catch (err) {
      console.error("[handleEnd] falling back to local summary:", err);
      const newBalance = (profile?.coin_balance ?? 0) + focus.coinsEarned;
      updateCoins(newBalance);
      const localSummary = {
        duration_mins: durationMins ?? Math.round(elapsed / 60),
        focus_score: focus.focus_score,
        coins_earned: focus.coinsEarned,
        coin_balance: newBalance,
        top_distractors: focus.top_distractors.map(([type, count]) => ({ type, count, impact: 0 })),
        improvement_tips: {},
        event_counts: focus.counts,
        focus_timeline: timelines.focus,
        event_timeline: timelines.events,
      };
      goingToSummary.current = true;
      navigate("/summary", { state: { summary: localSummary } });
    } finally {
      setEnding(false);
    }
  };

  const remaining = durationMins ? Math.max(0, durationMins * 60 - elapsed) : elapsed;
  const progress  = durationMins ? Math.min(1, elapsed / (durationMins * 60)) : 0;
  const score = focus.focus_score;

  const scoreColor = score >= 80 ? C.green : score >= 50 ? C.yellow : C.red;
  const ringColor  = scoreColor;

  const topDistractors = Object.entries(focus.counts)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  // Human-readable signal interpretations
  const eyeStatus   = focus.ear > 0.22 ? "good" : focus.ear > 0.18 ? "warn" : "bad";
  const mouthStatus = focus.mar < 0.48 ? "good" : "bad";
  const yawStatus   = Math.abs(focus.yaw ?? 0) < 25 ? "good" : Math.abs(focus.yaw ?? 0) < 40 ? "warn" : "bad";
  const pitchStatus = Math.abs(focus.pitch ?? 0) < 20 ? "good" : Math.abs(focus.pitch ?? 0) < 35 ? "warn" : "bad";

  const eyeLabel   = focus.ear > 0.22 ? "Open" : focus.ear > 0.18 ? "Drowsy" : "Closed";
  const mouthLabel = focus.mar < 0.48 ? "Closed" : "Open / Yawning";
  const yawLabel   = Math.abs(focus.yaw ?? 0) < 25 ? "Centered" : (focus.yaw ?? 0) > 0 ? "Looking Left" : "Looking Right";
  const pitchLabel = Math.abs(focus.pitch ?? 0) < 20 ? "Level" : (focus.pitch ?? 0) > 0 ? "Looking Down" : "Looking Up";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: C.bg, color: C.ink, fontFamily: "Nunito, system-ui, sans-serif" }}>

      {/* ── Exit dialog ── */}
      {showExitDialog && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(30,15,6,0.6)", backdropFilter: "blur(4px)" }}>
          <div style={{ background: C.card, borderRadius: 24, border: `1.5px solid ${C.border}`, padding: 28, maxWidth: 360, width: "100%", margin: "0 16px", boxShadow: "0 16px 48px rgba(60,42,27,0.18)" }}>
            <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 6 }}>End your session?</h2>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.soft, marginBottom: 24, lineHeight: 1.6 }}>
              Your progress and coins will be saved and you'll see your summary.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { setShowExitDialog(false); handleEnd(); }}
                disabled={ending}
                style={{ flex: 1, height: 44, borderRadius: 12, background: C.accent, color: "#fff", border: "none", fontSize: 15, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}
              >
                {ending ? "Ending…" : "End & See Summary"}
              </button>
              <button
                onClick={() => setShowExitDialog(false)}
                style={{ flex: 1, height: 44, borderRadius: 12, background: C.bg, color: C.ink, border: `1.5px solid ${C.border}`, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}
              >
                Resume
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Top bar ── */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 32px", borderBottom: `1.5px solid ${C.border}`, background: C.card, flexShrink: 0 }}>
        <button
          onClick={() => setShowExitDialog(true)}
          style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
        >
          <div style={{ width: 32, height: 32, borderRadius: 9, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(240,143,96,0.35)" }}>
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: C.accentSoft }} />
          </div>
          <span style={{ fontSize: 17, fontWeight: 900, letterSpacing: -0.3, color: C.ink }}>Bloom</span>
        </button>

        <div style={{ position: "relative" }} ref={dropdownRef}>
          <button
            onClick={() => setProfileOpen(o => !o)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999, border: `1.5px solid ${C.border}`, background: C.bg, cursor: "pointer", fontFamily: "inherit" }}
          >
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: C.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: C.accent }}>
              {profile?.email?.[0]?.toUpperCase() ?? "U"}
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.ink, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {profile?.email ?? "Account"}
            </span>
            <ChevronDown style={{ width: 12, height: 12, color: C.soft, transform: profileOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </button>

          {profileOpen && (
            <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 220, borderRadius: 18, border: `1.5px solid ${C.border}`, background: C.card, boxShadow: "0 8px 32px rgba(60,42,27,0.12)", padding: 12, zIndex: 50 }}>
              <div style={{ padding: "6px 8px 10px", borderBottom: `1px solid ${C.border}`, marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: C.soft, marginBottom: 3 }}>Signed in as</div>
                <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile?.email}</div>
              </div>
              <button
                onClick={() => { logout(); setProfileOpen(false); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, border: "none", background: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 800, color: C.red }}
                onMouseEnter={e => (e.currentTarget.style.background = C.redSoft)}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
              >
                <LogOut style={{ width: 14, height: 14 }} /> Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Desktop download hint ── */}
      <a
        href={`${(import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "")}/download/overlay`}
        download="Pudge.dmg"
        style={{ position: "fixed", bottom: 20, right: 20, zIndex: 40, display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 999, fontSize: 12, fontWeight: 700, color: C.soft, textDecoration: "none", boxShadow: "0 2px 12px rgba(60,42,27,0.08)", transition: "all 0.15s" }}
      >
        <Download style={{ width: 12, height: 12, flexShrink: 0 }} />
        Get Pudge for desktop
      </a>

      {/* ── Main grid ── */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr" }}>

        {/* ── Left — camera + signals ── */}
        <div
          className="hidden lg:flex"
          style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, gap: 20, background: C.panelBg, position: "relative", overflow: "hidden" }}
        >
          {/* Warm vignette */}
          <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "80%", height: 200, borderRadius: "50%", background: "radial-gradient(ellipse,rgba(240,143,96,0.08) 0%,transparent 70%)", pointerEvents: "none" }} />

          {/* Camera feed */}
          <div style={{ position: "relative", width: "100%", maxWidth: 280, zIndex: 1 }}>
            {focus.cameraStream ? (
              <>
                <video ref={videoRef} autoPlay muted playsInline
                  style={{ width: "100%", borderRadius: 18, objectFit: "cover", aspectRatio: "16/9", border: `2px solid ${C.panelBorder}`, transform: "scaleX(-1)" }}
                />
                <canvas ref={canvasRef}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", borderRadius: 18, pointerEvents: "none" }}
                />
              </>
            ) : (
              <div style={{ width: "100%", borderRadius: 18, aspectRatio: "16/9", background: "rgba(0,0,0,0.35)", border: `2px solid ${C.panelBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
                <p style={{ fontSize: 12, color: "rgba(251,241,229,0.4)", fontWeight: 600 }}>
                  {focus.connected ? "Camera starting…" : "Loading MediaPipe…"}
                </p>
              </div>
            )}
            {/* Face detection badge */}
            <div style={{
              position: "absolute", bottom: 8, left: 8, right: 8,
              padding: "5px 10px", borderRadius: 10, textAlign: "center",
              fontSize: 11, fontWeight: 800, backdropFilter: "blur(8px)",
              background: focus.face_detected ? "rgba(127,176,105,0.25)" : "rgba(226,102,86,0.25)",
              color: focus.face_detected ? C.green : C.red,
              border: `1px solid ${focus.face_detected ? "rgba(127,176,105,0.35)" : "rgba(226,102,86,0.35)"}`,
            }}>
              {focus.face_detected ? "Face detected" : "No face detected"}
            </div>
          </div>

          {/* Human-readable signal panel */}
          <div style={{ width: "100%", maxWidth: 280, background: "rgba(0,0,0,0.28)", borderRadius: 16, border: `1px solid ${C.panelBorder}`, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12, zIndex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.5, color: "rgba(251,241,229,0.35)", marginBottom: -2 }}>Live signals</div>
            <SignalRow label="Eyes"      value={eyeLabel}   status={eyeStatus}   hint="Blink rate & openness" />
            <SignalRow label="Mouth"     value={mouthLabel} status={mouthStatus} hint="Yawn detection" />
            <SignalRow label="Head turn" value={yawLabel}   status={yawStatus}   hint="Left / right rotation" />
            <SignalRow label="Head nod"  value={pitchLabel} status={pitchStatus} hint="Up / down tilt" />
            <div style={{ borderTop: `1px solid ${C.panelBorder}`, paddingTop: 10, display: "flex", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(251,241,229,0.35)", marginBottom: 2 }}>Focus streak</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: focus.streak_secs > 30 ? C.green : C.yellow }}>{focus.streak_secs}s</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(251,241,229,0.35)", marginBottom: 2 }}>Coin multiplier</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: focus.multiplier > 1 ? C.yellow : "rgba(251,241,229,0.5)" }}>{focus.multiplier}×</div>
              </div>
            </div>
          </div>

          {/* Focus score ring */}
          <div style={{ position: "relative", zIndex: 1 }}>
            <svg width="110" height="110" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="55" cy="55" r="46" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="9" />
              <circle cx="55" cy="55" r="46" fill="none"
                stroke={ringColor} strokeWidth="9" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 46}`}
                strokeDashoffset={`${2 * Math.PI * 46 * (1 - score / 100)}`}
                style={{ transition: "stroke-dashoffset 0.8s ease, stroke 0.5s" }}
              />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: scoreColor }}>{Math.round(score)}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(251,241,229,0.45)" }}>focus</span>
            </div>
          </div>

          {/* Mascot */}
          <div style={{ zIndex: 1, cursor: "pointer", userSelect: "none" }} onClick={handlePoke}>
            <Blob palette="cream" shape="wide" size={140}
              state={poked ? "poked" : getBlobState(score, focus.face_detected)}
              eyeTarget={mousePos} showGround
            />
          </div>
        </div>

        {/* ── Right — timer + stats ── */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, gap: 28 }}>

          {/* Timer */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 80, fontWeight: 900, fontVariantNumeric: "tabular-nums", letterSpacing: -3, lineHeight: 1, marginBottom: 8, color: C.ink }}>
              {fmt(remaining)}
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.soft }}>
              {durationMins ? `remaining · ${durationMins}min session` : "elapsed"}
            </p>
            {durationMins && (
              <div style={{ marginTop: 14, height: 8, width: 260, background: C.border, borderRadius: 999, overflow: "hidden", margin: "14px auto 0" }}>
                <div style={{ height: "100%", background: C.accent, borderRadius: 999, width: `${progress * 100}%`, transition: "width 1s linear" }} />
              </div>
            )}
          </div>

          {/* Coin counter */}
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <CartoonCoin size={34} />
              <span style={{ fontSize: 44, fontWeight: 900, color: C.yellow, fontVariantNumeric: "tabular-nums" }}>{focus.coinsEarned}</span>
              {focus.multiplier > 1 && (
                <span style={{ fontSize: 13, fontWeight: 900, color: C.yellow, background: C.yellowSoft, border: `1.5px solid ${C.yellow}`, borderRadius: 999, padding: "4px 10px" }}>
                  {focus.multiplier}×
                </span>
              )}
            </div>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.soft, marginTop: 4 }}>
              {focus.multiplier > 1
                ? `${focus.multiplier}× multiplier — ${focus.streak_secs}s streak!`
                : "Stay focused to build your streak"}
            </p>
          </div>

          {/* Next coin progress */}
          <div style={{ width: "100%", maxWidth: 280 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: C.soft }}>Next coin</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.soft }}>
                {focus.nextCoinPct >= 0.99 ? "Earned!" : `${((1 - focus.nextCoinPct) * 5).toFixed(1)}s`}
              </span>
            </div>
            <div style={{ height: 8, background: C.border, borderRadius: 999, overflow: "hidden" }}>
              <div style={{ height: "100%", background: C.yellow, borderRadius: 999, width: `${focus.nextCoinPct * 100}%`, transition: "width 0.3s" }} />
            </div>
          </div>

          {/* Score recovery */}
          {focus.focus_score < 100 && focus.secsToScoreRecovery > 0 && (
            <div style={{ width: "100%", maxWidth: 280 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: C.soft }}>Score recovering in</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.green }}>{fmt(focus.secsToScoreRecovery)}</span>
              </div>
              <div style={{ height: 8, background: C.border, borderRadius: 999, overflow: "hidden" }}>
                <div style={{ height: "100%", background: C.green, borderRadius: 999, width: `${((T_WINDOW_S - focus.secsToScoreRecovery) / T_WINDOW_S) * 100}%`, transition: "width 1s linear" }} />
              </div>
            </div>
          )}

          {/* Distractors */}
          <div style={{ width: "100%", maxWidth: 280 }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.4, color: C.soft, marginBottom: 12 }}>
              Distractions this session
            </div>
            {topDistractors.length === 0 ? (
              <div style={{ padding: "14px 18px", borderRadius: 16, background: C.greenSoft, border: `1.5px solid ${C.green}`, fontSize: 13, fontWeight: 700, color: C.green, textAlign: "center" }}>
                No distractions yet — great work!
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {topDistractors.map(([type, count], i) => (
                  <div key={type} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 14, background: C.card, border: `1.5px solid ${C.border}` }}>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 800 }}>{DISTRACTOR_LABELS[type] ?? type}</span>
                    <span style={{ fontSize: 13, fontWeight: 900, color: i === 0 ? C.red : C.soft, background: i === 0 ? C.redSoft : C.border, borderRadius: 999, padding: "2px 10px" }}>
                      ×{count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* End session button */}
          <button
            onClick={handleEnd}
            disabled={ending}
            style={{ width: "100%", maxWidth: 280, height: 48, borderRadius: 14, border: `1.5px solid ${C.red}`, background: "transparent", color: C.red, fontSize: 15, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = C.redSoft)}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            {ending ? "Ending…" : "End Session"}
          </button>
        </div>
      </div>
    </div>
  );
}
