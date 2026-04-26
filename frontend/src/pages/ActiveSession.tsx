import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import { useFocus } from "../context/FocusContext";
import { useAuth } from "../context/AuthContext";
import { Blob, type BlobState } from "../components/Blob";
import { Button } from "../components/ui/Button";
import { Download, ChevronDown, LogOut } from "lucide-react";
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
  const { profile, updateCoins, logout } = useAuth();
  const [ending, setEnding] = useState(false);
  const [poked, setPoked] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive && !ending) navigate("/home");
  }, [isActive, ending, navigate]);

  useEffect(() => {
    const h = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
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
      const newBalance = (profile?.coin_balance ?? 0) + focus.coinsEarned;
      updateCoins(newBalance);
      const localSummary = {
        duration_mins: durationMins ?? Math.round(elapsed / 60),
        focus_score: focus.focus_score,
        coins_earned: focus.coinsEarned,
        coin_balance: newBalance,
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
            width: 32, height: 32, borderRadius: 9,
            background: "#F08F60",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 6px rgba(240,143,96,0.35)",
          }}>
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#FFE8D9" }} />
          </div>
          <span className="font-black tracking-tight">Bloom</span>
        </button>

        {/* Profile dropdown */}
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
        href="http://localhost:8000/download/overlay"
        download="Pudge.dmg"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-3 py-2 bg-card border border-border/60 rounded-full text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 shadow-sm transition-all"
      >
        <Download className="size-3 shrink-0" />
        Get Pudge for desktop
      </a>

      {/* Main content */}
      <div className="flex-1 grid lg:grid-cols-2">
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
    </div>
  );
}
