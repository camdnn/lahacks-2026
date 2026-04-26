import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import { useFocus } from "../context/FocusContext";
import { useAuth } from "../context/AuthContext";
import { Blob, type BlobState } from "../components/Blob";
import { Button } from "../components/ui/Button";
import { Download, ChevronDown, LogOut } from "lucide-react";
import { CartoonCoin } from "../components/CartoonCoin";

const T_WINDOW_S = 60;

function fmt(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const DISTRACTOR_LABELS: Record<string, string> = {
  microsleep: "Eyes Closed",
  yawn: "Yawn",
  phone_check: "Phone Check",
  head_tilt: "Head Tilt",
  eyes_off_screen: "Eyes Off Screen",
  tab_switch: "Tab Switch",
};

function getBlobState(score: number, face: boolean): BlobState {
  if (!face) return "distracted";
  if (score >= 80) return "focused";
  if (score >= 50) return "encouraging";
  return "sad";
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

  const videoRef        = useRef<HTMLVideoElement>(null);
  const canvasRef       = useRef<HTMLCanvasElement>(null);
  const dropdownRef     = useRef<HTMLDivElement>(null);
  const goingToSummary  = useRef(false);

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

    // Match canvas to displayed video size
    const video = videoRef.current;
    if (video) {
      canvas.width  = video.offsetWidth;
      canvas.height = video.offsetHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const W = canvas.width, H = canvas.height;
    // Mirror x to align with the CSS-mirrored video
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

    // Eyes — green healthy, red if EAR is low (near microsleep)
    const eyeColor = focus.ear > 0.22 ? "#22c55e" : "#ef4444";
    drawPoly(leftEye, eyeColor);
    drawPoly(rightEye, eyeColor);

    // Tilt line — green normal, amber if tilted
    ctx.beginPath();
    ctx.moveTo(px(tiltL[0]), py(tiltL[1]));
    ctx.lineTo(px(tiltR[0]), py(tiltR[1]));
    ctx.strokeStyle = Math.abs(focus.head_tilt) < 22 ? "#22c55e" : "#f59e0b";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Mouth — green normal, red if yawning
    const mouthColor = focus.mar < 0.48 ? "#22c55e" : "#ef4444";
    drawPoly([mouthL, lipTop, mouthR, lipBot], mouthColor);

    // Nose dot
    ctx.beginPath();
    ctx.arc(px(nose[0]), py(nose[1]), 3, 0, Math.PI * 2);
    ctx.fillStyle = "#60a5fa";
    ctx.fill();

    // Iris dots (gaze visualization) — purple when centered, amber when off-center
    const irisColor = Math.abs(focus.gaze_x ?? 0) > 0.15 ? "#f59e0b" : "#a78bfa";
    if (focus.keyPoints?.leftIris) {
      const [ix, iy] = focus.keyPoints.leftIris;
      ctx.beginPath();
      ctx.arc(px(ix), py(iy), 3, 0, Math.PI * 2);
      ctx.fillStyle = irisColor;
      ctx.fill();
    }
    if (focus.keyPoints?.rightIris) {
      const [ix, iy] = focus.keyPoints.rightIris;
      ctx.beginPath();
      ctx.arc(px(ix), py(iy), 3, 0, Math.PI * 2);
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
        setTimeout(() => reject(new Error('timeout')), 12_000)
      );
      const summary = await Promise.race([end(), timeoutPromise]);
      goingToSummary.current = true;
      navigate("/summary", { state: { summary: { ...summary, focus_timeline: timelines.focus, event_timeline: timelines.events } } });
    } catch (err) {
      console.error('[handleEnd] falling back to local summary:', err);
      const newBalance = (profile?.coin_balance ?? 0) + focus.coinsEarned;
      updateCoins(newBalance);
      const localSummary = {
        duration_mins: durationMins ?? Math.round(elapsed / 60),
        focus_score: focus.focus_score,
        coins_earned: focus.coinsEarned,
        coin_balance: newBalance,
        top_distractors: focus.top_distractors.map(([type, count]) => ({
          type, count, impact: 0,
        })),
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

  const scoreColor = score >= 80 ? "text-emerald-500" : score >= 50 ? "text-amber-500" : "text-red-500";
  const ringColor  = score >= 80 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";

  const topDistractors = Object.entries(focus.counts)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Exit-session confirmation dialog */}
      {showExitDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card rounded-2xl border border-border p-6 max-w-sm w-full mx-4 shadow-xl">
            <h2 className="text-lg font-black mb-1">End your session?</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Your progress and coins will be saved and you'll see your summary.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => { setShowExitDialog(false); handleEnd(); }}
                disabled={ending}
                className="flex-1 h-10"
              >
                {ending ? "Ending…" : "End & Go Home"}
              </Button>
              <Button
                onClick={() => setShowExitDialog(false)}
                variant="outline"
                className="flex-1 h-10"
              >
                Resume
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-border bg-card shrink-0">
        <button
          onClick={() => setShowExitDialog(true)}
          className="flex items-center gap-2 text-lg font-bold cursor-pointer hover:opacity-75 transition-opacity"
        >
          <div style={{
            width: 32, height: 32, borderRadius: 9, background: "#F08F60",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 6px rgba(240,143,96,0.35)",
          }}>
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#FFE8D9" }} />
          </div>
          <span className="font-black tracking-tight">Bloom</span>
        </button>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setProfileOpen(o => !o)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border hover:bg-accent transition-colors cursor-pointer"
          >
            <div className="size-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-black text-primary select-none">
              {profile?.email?.[0]?.toUpperCase() ?? "U"}
            </div>
            <span className="text-sm font-semibold max-w-45 truncate text-foreground">
              {profile?.email ?? "Account"}
            </span>
            <ChevronDown className={`size-3 text-muted-foreground transition-transform ${profileOpen ? "rotate-180" : ""}`} />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-border bg-card shadow-lg p-3 z-50">
              <div className="px-2 py-1.5 mb-2">
                <p className="text-xs text-muted-foreground mb-0.5 font-bold uppercase tracking-wide">Signed in as</p>
                <p className="text-sm font-bold truncate">{profile?.email}</p>
              </div>
              <hr className="border-border mb-2" />
              <button
                onClick={() => { logout(); setProfileOpen(false); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-bold rounded-xl transition-colors cursor-pointer"
                style={{ color: "#E26656" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#FFE0DB")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Desktop download hint */}
      <a
        href={`${(import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '')}/download/overlay`}
        download="Pudge.dmg"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-3 py-2 bg-card border border-border/60 rounded-full text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 shadow-sm transition-all"
      >
        <Download className="size-3 shrink-0" />
        Get Pudge for desktop
      </a>

      {/* Main content */}
      <div className="flex-1 grid lg:grid-cols-2">

        {/* Left — camera + mascot panel */}
        <div className="hidden lg:flex flex-col items-center justify-center p-10 relative overflow-hidden gap-5" style={{ background: "linear-gradient(135deg, #1A0B04 0%, #2D1609 100%)" }}>
          <div className="absolute inset-0 bg-grid-white/[0.05] bg-size-[20px_20px]" />

          {/* Camera preview with landmark canvas overlay */}
          <div className="relative z-10 w-full max-w-65">
            {focus.cameraStream ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full rounded-2xl object-cover aspect-video border-2 border-white/20"
                  style={{ transform: "scaleX(-1)" }}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full rounded-2xl pointer-events-none"
                />
              </>
            ) : (
              <div className="w-full rounded-2xl aspect-video bg-black/30 border-2 border-white/10 flex items-center justify-center">
                <div className="text-center text-primary-foreground/60">
                  <div className="text-2xl mb-1 animate-pulse">👁</div>
                  <p className="text-xs">
                    {focus.connected ? "Camera starting…" : "Loading MediaPipe…"}
                  </p>
                </div>
              </div>
            )}
            {/* Face detection badge over the preview */}
            <div
              className={`absolute bottom-2 left-2 right-2 flex items-center justify-center gap-1.5 py-1 rounded-xl text-xs font-semibold backdrop-blur-sm ${
                focus.face_detected
                  ? "bg-emerald-500/30 text-emerald-200"
                  : "bg-red-500/30 text-red-200"
              }`}
            >
              {focus.face_detected ? "👁 Face detected" : "⚠ Face not detected"}
            </div>
          </div>

          {/* Live diagnostics panel */}
          <div className="relative z-10 w-full max-w-65 bg-black/30 rounded-xl border border-white/10 px-4 py-3 font-mono text-xs text-white/80 grid grid-cols-2 gap-x-4 gap-y-1.5">
            <span className="text-white/40">EAR</span>
            <span className={focus.ear > 0.22 ? "text-emerald-400" : "text-red-400"}>
              {focus.ear.toFixed(3)}
            </span>
            <span className="text-white/40">MAR</span>
            <span className={focus.mar < 0.48 ? "text-emerald-400" : "text-red-400"}>
              {focus.mar.toFixed(3)}
            </span>
            <span className="text-white/40">Yaw</span>
            <span className={Math.abs(focus.yaw ?? 0) < 25 ? "text-emerald-400" : "text-amber-400"}>
              {(focus.yaw ?? 0).toFixed(1)}°
            </span>
            <span className="text-white/40">Pitch</span>
            <span className={Math.abs(focus.pitch ?? 0) < 20 ? "text-emerald-400" : "text-amber-400"}>
              {(focus.pitch ?? 0).toFixed(1)}°
            </span>
            <span className="text-white/40">Streak</span>
            <span className="text-blue-300">{focus.streak_secs}s</span>
            <span className="text-white/40">Multiplier</span>
            <span className={focus.multiplier > 1 ? "text-amber-400 font-black" : "text-white/60"}>
              {focus.multiplier}×
            </span>
          </div>

          {/* Focus score ring */}
          <div className="relative z-10">
            <svg width="120" height="120" className="-rotate-90">
              <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="10" />
              <circle
                cx="60" cy="60" r="50" fill="none"
                stroke={ringColor} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 50}`}
                strokeDashoffset={`${2 * Math.PI * 50 * (1 - score / 100)}`}
                style={{ transition: "stroke-dashoffset 0.8s ease, stroke 0.5s" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-black ${scoreColor}`}>{Math.round(score)}</span>
              <span className="text-primary-foreground/70 text-xs font-medium">focus</span>
            </div>
          </div>

          {/* Mascot */}
          <div className="z-10 cursor-pointer select-none" onClick={handlePoke}>
            <Blob
              palette="cream"
              shape="wide"
              size={140}
              state={poked ? "poked" : getBlobState(score, focus.face_detected)}
              eyeTarget={mousePos}
              showGround
            />
          </div>
        </div>

        {/* Right — timer + coins + distractors */}
        <div className="flex flex-col items-center justify-center p-8 gap-8">

          {/* Timer */}
          <div className="text-center">
            <div className="text-7xl font-black tabular-nums tracking-tight mb-2">
              {fmt(remaining)}
            </div>
            <p className="text-muted-foreground">
              {durationMins ? `remaining of ${durationMins}min session` : "elapsed"}
            </p>
            {durationMins && (
              <div className="mt-3 h-2 w-64 bg-border/40 rounded-full overflow-hidden mx-auto">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-1000"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            )}
          </div>

          {/* Coin counter with multiplier badge */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <CartoonCoin size={36} />
              <span className="text-4xl font-black text-amber-500 tabular-nums">{focus.coinsEarned}</span>
              {focus.multiplier > 1 && (
                <span className="text-sm font-black text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded-full px-2 py-0.5">
                  {focus.multiplier}×
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {focus.multiplier > 1
                ? `${focus.multiplier}× multiplier — ${focus.streak_secs}s streak!`
                : "1 coin per 5 s · build a streak for a multiplier"}
            </p>
          </div>

          {/* Coin progress gauge */}
          <div className="w-full max-w-xs">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold">Next coin</span>
                <span className="font-black text-amber-500 bg-amber-500/10 rounded-full px-1.5 py-0.5 text-[10px]">+1</span>
              </div>
              <span>{focus.nextCoinPct >= 0.99 ? "Earned!" : `${((1 - focus.nextCoinPct) * 5).toFixed(1)}s`}</span>
            </div>
            <div className="h-2.5 w-full bg-border/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-300"
                style={{ width: `${focus.nextCoinPct * 100}%` }}
              />
            </div>
          </div>

          {/* Score recovery gauge */}
          {focus.focus_score < 100 && focus.secsToScoreRecovery > 0 && (
            <div className="w-full max-w-xs">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold">Score recovers in</span>
                  <span className="font-black text-emerald-500 bg-emerald-500/10 rounded-full px-1.5 py-0.5 text-[10px]">+1</span>
                </div>
                <span>{fmt(focus.secsToScoreRecovery)}</span>
              </div>
              <div className="h-2.5 w-full bg-border/40 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                  style={{ width: `${((T_WINDOW_S - focus.secsToScoreRecovery) / T_WINDOW_S) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Distractor counts */}
          <div className="w-full max-w-xs">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Distractions
            </h3>
            {topDistractors.length === 0 ? (
              <p className="text-muted-foreground text-sm">No distractions yet — great work!</p>
            ) : (
              <div className="space-y-2">
                {topDistractors.map(([type, count]) => (
                  <div
                    key={type}
                    className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/40"
                  >
                    <span className="text-sm font-medium">{DISTRACTOR_LABELS[type] ?? type}</span>
                    <span className="text-sm font-bold text-red-500">×{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* End button */}
          <Button
            onClick={handleEnd}
            disabled={ending}
            variant="outline"
            className="w-full max-w-xs h-12 text-base border-red-500/40 text-red-500 hover:bg-red-500/10"
          >
            {ending ? "Ending…" : "End Session"}
          </Button>
        </div>

      </div>
    </div>
  );
}
