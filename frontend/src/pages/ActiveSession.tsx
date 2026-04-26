import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import { useFocus } from "../context/FocusContext";
import { Blob, type BlobState } from "../components/Blob";
import { Button } from "../components/ui/Button";
import { Download } from "lucide-react";
import { CartoonCoin } from "../components/CartoonCoin";

function fmt(secs: number) {
  const m = Math.floor(secs / 60)
    .toString()
    .padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const DISTRACTOR_LABELS: Record<string, string> = {
  microsleep: "Microsleep",
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
  const [ending, setEnding] = useState(false);
  const [poked, setPoked] = useState(false);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isActive && !ending) navigate("/home");
  }, [isActive, ending, navigate]);

  useEffect(() => {
    const h = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);

  // Bind camera stream to the preview element
  useEffect(() => {
    if (videoRef.current && focus.cameraStream) {
      videoRef.current.srcObject = focus.cameraStream;
    }
  }, [focus.cameraStream]);

  // Auto-end when timer runs out
  useEffect(() => {
    if (durationMins && elapsed >= durationMins * 60 && !ending) {
      handleEnd();
    }
  }, [elapsed, durationMins]);

  const handlePoke = () => {
    if (poked) return;
    setPoked(true);
    setTimeout(() => setPoked(false), 500);
  };

  const handleEnd = async () => {
    if (ending) return;
    setEnding(true);
    try {
      const summary = await end();
      navigate("/summary", { state: { summary } });
    } catch {
      const localSummary = {
        duration_mins: durationMins ?? Math.round(elapsed / 60),
        focus_score: focus.focus_score,
        coins_earned: focus.coinsEarned,
        coin_balance: 0,
        top_distractors: focus.top_distractors.map(([type, count]) => ({
          type,
          count,
          impact: 0,
        })),
        improvement_tips: {},
        event_counts: focus.counts,
      };
      navigate("/summary", { state: { summary: localSummary } });
    }
  };

  const remaining = durationMins
    ? Math.max(0, durationMins * 60 - elapsed)
    : elapsed;
  const progress = durationMins
    ? Math.min(1, elapsed / (durationMins * 60))
    : 0;
  const score = focus.focus_score;

  const scoreColor =
    score >= 80
      ? "text-emerald-500"
      : score >= 50
        ? "text-amber-500"
        : "text-red-500";
  const ringColor =
    score >= 80 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";

  const topDistractors = Object.entries(focus.counts)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="min-h-screen bg-background grid lg:grid-cols-2">
      {/* Desktop download hint — replaces the removed browser FloatingPudge */}
      <a
        href="http://localhost:8000/download/overlay"
        download="Pudge.dmg"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-3 py-2 bg-card border border-border/60 rounded-full text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 shadow-sm transition-all"
      >
        <Download className="size-3 shrink-0" />
        Get Pudge for desktop
      </a>
      {/* Left — camera + mascot panel */}
      <div className="hidden lg:flex flex-col items-center justify-center bg-linear-to-br from-primary/90 via-primary to-primary/80 p-12 relative overflow-hidden gap-6">
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-size-[20px_20px]" />

        {/* Camera preview */}
        <div className="relative z-10 w-full max-w-65">
          {focus.cameraStream ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full rounded-2xl object-cover aspect-video border-2 border-white/20"
              style={{ transform: "scaleX(-1)" }}
            />
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

        {/* Focus score ring */}
        <div className="relative z-10">
          <svg width="120" height="120" className="-rotate-90">
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="10"
            />
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke={ringColor}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 50}`}
              strokeDashoffset={`${2 * Math.PI * 50 * (1 - score / 100)}`}
              style={{ transition: "stroke-dashoffset 0.8s ease, stroke 0.5s" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-black ${scoreColor}`}>
              {Math.round(score)}
            </span>
            <span className="text-primary-foreground/70 text-xs font-medium">
              focus
            </span>
          </div>
        </div>

        {/* Mascot */}
        <div className="z-10 cursor-pointer select-none" onClick={handlePoke}>
          <Blob
            palette="cream"
            shape="wide"
            size={160}
            state={poked ? "poked" : getBlobState(score, focus.face_detected)}
            eyeTarget={mousePos}
            showGround
          />
        </div>

        {/* Face detection badge */}
        <div
          className={`z-10 mt-4 px-4 py-1.5 rounded-full text-sm font-semibold ${
            focus.face_detected
              ? "bg-emerald-500/20 text-emerald-300"
              : "bg-red-500/20 text-red-300"
          }`}
        >
          {focus.face_detected ? "Face detected" : "Face not detected"}
        </div>
      </div>

      {/* Right — timer + distractors */}
      <div className="flex flex-col items-center justify-center p-8 gap-8">
        {/* Timer */}
        <div className="text-center">
          <div className="text-7xl font-black tabular-nums tracking-tight mb-2">
            {fmt(remaining)}
          </div>
          <p className="text-muted-foreground">
            {durationMins
              ? `remaining of ${durationMins}min session`
              : "elapsed"}
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

        {/* Coin counter */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <CartoonCoin size={36} />
            <span className="text-4xl font-black text-amber-500 tabular-nums">{focus.coinsEarned}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            coins earned (1 per 5 s focused)
          </p>
        </div>

        {/* Distractor counts */}
        <div className="w-full max-w-xs">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Distractions
          </h3>
          {topDistractors.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No distractions yet — great work!
            </p>
          ) : (
            <div className="space-y-2">
              {topDistractors.map(([type, count]) => (
                <div
                  key={type}
                  className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/40"
                >
                  <span className="text-sm font-medium">
                    {DISTRACTOR_LABELS[type] ?? type}
                  </span>
                  <span className="text-sm font-bold text-red-500">
                    ×{count}
                  </span>
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
  );
}
