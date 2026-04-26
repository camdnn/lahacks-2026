import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { Blob, type BlobState } from "../components/Blob";
import { ArrowLeft, BookOpen, Check, Clock, Code2, Globe, PenLine, Settings2, Users, Zap } from "lucide-react";

const DURATIONS = [15, 25, 45, 60, 90];

const ALL_CHECKS = [
  { id: "microsleep",  label: "Eyes Closed" },
  { id: "yawn",        label: "Yawn" },
  { id: "phone_check", label: "Phone Check" },
  { id: "head_tilt",   label: "Head Tilt" },
  { id: "yaw",         label: "Head Turn" },
  { id: "gaze",        label: "Gaze Drift" },
];

const PRESETS = [
  { id: "studying", label: "Studying",       icon: BookOpen,  disabled: [] as string[] },
  { id: "coding",   label: "Coding",         icon: Code2,     disabled: ["yaw", "gaze"] },
  { id: "notes",    label: "Taking Notes",   icon: PenLine,   disabled: ["yaw", "gaze", "phone_check"] },
  { id: "meeting",  label: "Meeting / Call", icon: Users,     disabled: ["yaw", "gaze", "head_tilt"] },
  { id: "custom",   label: "Custom",         icon: Settings2, disabled: null as string[] | null },
];

type Step = "config" | "calibrating" | "done";

export default function StartFocus() {
  const navigate = useNavigate();
  const { start } = useSession();
  const [step, setStep]                 = useState<Step>("config");
  const [sessionType, setSessionType]   = useState<"general" | "specialized">("general");
  const [duration, setDuration]         = useState(25);
  const [allowedTabInput, setAllowedTabInput] = useState("");
  const [allowedTabs, setAllowedTabs]   = useState<string[]>([]);
  const [preset, setPreset]             = useState("studying");
  const [customDisabled, setCustomDisabled] = useState<string[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const [countdown, setCountdown]       = useState(5);
  const [mousePos, setMousePos]         = useState<{ x: number; y: number } | null>(null);
  const [calibStream, setCalibStream]   = useState<MediaStream | null>(null);
  const [calibBlink, setCalibBlink]     = useState(false);
  const calibVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // Bind calibration video element to stream
  useEffect(() => {
    if (calibVideoRef.current && calibStream) {
      calibVideoRef.current.srcObject = calibStream;
    }
  }, [calibStream]);

  // Pudge blink animation during calibration
  useEffect(() => {
    if (step !== "calibrating" || !calibStream) return;
    let timer: ReturnType<typeof setTimeout>;
    const sched = () => {
      timer = setTimeout(() => {
        setCalibBlink(true);
        setTimeout(() => { setCalibBlink(false); sched(); }, 120);
      }, 2500 + Math.random() * 2000);
    };
    sched();
    return () => clearTimeout(timer);
  }, [step, calibStream]);

  // Drive countdown timer during calibration
  useEffect(() => {
    if (step !== "calibrating") return;
    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(interval); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  const addTab = () => {
    const val = allowedTabInput.trim();
    if (val && !allowedTabs.includes(val)) setAllowedTabs((t) => [...t, val]);
    setAllowedTabInput("");
  };

  const handleCalibrate = async () => {
    setStep("calibrating");
    setError("");

    // Start a temporary camera preview so user can see they're in frame
    let localStream: MediaStream | null = null;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setCalibStream(localStream);
    } catch { /* permission denied — show placeholder */ }

    await new Promise(r => setTimeout(r, 5000));

    // Stop preview before FocusContext opens its own stream (use local var to avoid stale closure)
    localStream?.getTracks().forEach(t => t.stop());
    setCalibStream(null);

    await handleStart();
  };

  const finalDisabled =
    preset === "custom"
      ? customDisabled
      : (PRESETS.find(p => p.id === preset)?.disabled ?? []) as string[];

  const handleStart = async () => {
    setLoading(true);
    setError("");
    try {
      await start(sessionType, duration, sessionType === "specialized" ? allowedTabs : [], finalDisabled);
      navigate("/session");
    } catch {
      setError("Failed to start session. Is the backend running?");
      setStep("config");
    } finally {
      setLoading(false);
    }
  };

  const pudgeState: BlobState =
    step === "calibrating" ? "focused" :
    step === "done"        ? "cheering" :
    loading                ? "walking"  : "encouraging";

  // ── Calibration overlay ──────────────────────────────────────────────────
  if (step === "calibrating") {
    const pct = ((5 - countdown) / 5) * 100;
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 gap-6">
        <div className="text-center max-w-md">
          <h1 className="text-3xl font-bold mb-2">Calibrating…</h1>
          <p className="text-muted-foreground text-sm">
            Look straight at your screen naturally. Pudge is learning your resting position.
          </p>
        </div>

        {/* Camera preview */}
        <div className="relative w-full max-w-xs">
          {calibStream ? (
            <video
              ref={calibVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full rounded-2xl object-cover aspect-video border-2"
              style={{ borderColor: "rgba(240,143,96,0.4)", transform: "scaleX(-1)" }}
            />
          ) : (
            <div className="w-full rounded-2xl aspect-video bg-muted/30 border-2 border-border/30 flex items-center justify-center">
              <p className="text-sm text-muted-foreground animate-pulse">Requesting camera…</p>
            </div>
          )}
          <div style={{
            position: "absolute", bottom: 8, left: 8, right: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "4px 0", borderRadius: 12, fontSize: 11, fontWeight: 700, backdropFilter: "blur(8px)",
            background: calibStream ? "rgba(127,176,105,0.25)" : "rgba(61,42,27,0.1)",
            color: calibStream ? "#7FB069" : "#806550",
          }}>
            {calibStream ? "Pudge can see you" : "Waiting for camera…"}
          </div>
        </div>

        <Blob
          palette="cream"
          shape="wide"
          size={140}
          state={calibBlink ? "sleeping" : calibStream ? "cheering" : "focused"}
          eyeTarget={mousePos}
          showGround
        />

        {/* Progress ring */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative size-20">
            <svg className="size-20 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="6" fill="none" className="text-border" />
              <circle
                cx="40" cy="40" r="34"
                stroke="currentColor" strokeWidth="6" fill="none"
                className="text-primary transition-all duration-1000"
                strokeDasharray={`${2 * Math.PI * 34}`}
                strokeDashoffset={`${2 * Math.PI * 34 * (1 - pct / 100)}`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold tabular-nums">
              {countdown}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">seconds remaining</p>
        </div>
      </div>
    );
  }

  // ── Config form ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <button
          onClick={() => navigate("/home")}
          className="flex cursor-pointer items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors font-bold text-sm"
        >
          <ArrowLeft className="size-4" /> Back
        </button>

        <div className="flex justify-center mb-8">
          <Blob palette="cream" shape="wide" size={130} state={pudgeState} eyeTarget={mousePos} showGround />
        </div>

        <h1 className="text-3xl font-black text-center tracking-tight mb-2">Start a Focus Session</h1>
        <p className="text-muted-foreground text-center mb-8 font-semibold">Pudge will keep an eye on you</p>

        {/* Session type */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {(["general", "specialized"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setSessionType(t)}
              className={`relative rounded-2xl border-2 p-4 text-left cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md active:scale-[0.98] ${
                sessionType === t
                  ? "border-primary bg-accent shadow-sm"
                  : "border-border hover:border-primary"
              }`}
            >
              {sessionType === t && (
                <span className="absolute top-2 right-2 size-5 bg-primary rounded-full flex items-center justify-center">
                  <Check className="size-3 text-white" />
                </span>
              )}
              <div className="mb-2" style={{ color: sessionType === t ? "#F08F60" : "#806550" }}>
                {t === "general" ? <Zap className="size-5" /> : <Globe className="size-5" />}
              </div>
              <div className={`font-black capitalize ${sessionType === t ? "text-primary" : "text-foreground"}`}>
                {t}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 font-semibold">
                {t === "general" ? "Full focus, all distractors tracked" : "Specific tabs allowed"}
              </div>
            </button>
          ))}
        </div>

        {/* Duration */}
        <div className="mb-6">
          <Label className="mb-3 block font-black text-sm uppercase tracking-wide text-muted-foreground">
            Session Duration
          </Label>
          <div className="flex gap-2 flex-wrap">
            {DURATIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`flex items-center cursor-pointer gap-1.5 px-4 py-2 rounded-full text-sm font-black border-2 transition-all hover:scale-105 active:scale-95 ${
                  duration === d
                    ? "border-primary bg-primary text-primary-foreground scale-105"
                    : "border-border bg-card text-foreground hover:border-primary"
                }`}
              >
                <Clock className="size-3" /> {d}m
              </button>
            ))}
          </div>
        </div>

        {/* Activity preset */}
        <div className="mb-6">
          <Label className="mb-3 block font-black text-sm uppercase tracking-wide text-muted-foreground">
            What are you doing?
          </Label>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {PRESETS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setPreset(id)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-black cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] ${
                  preset === id
                    ? "border-primary bg-accent text-primary"
                    : "border-border text-muted-foreground hover:border-primary"
                }`}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-card border border-border">
            {ALL_CHECKS.map(({ id, label }) => (
              <label
                key={id}
                className="flex items-center gap-2 text-sm font-semibold select-none"
                style={{
                  cursor: preset === "custom" ? "pointer" : "default",
                  opacity: preset === "custom" ? 1 : 0.65,
                }}
              >
                <input
                  type="checkbox"
                  checked={!finalDisabled.includes(id)}
                  disabled={preset !== "custom"}
                  onChange={(e) =>
                    setCustomDisabled(prev =>
                      e.target.checked ? prev.filter(x => x !== id) : [...prev, id]
                    )
                  }
                  style={{ accentColor: "#F08F60" }}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Allowed tabs */}
        {sessionType === "specialized" && (
          <div className="mb-6">
            <Label className="mb-3 block font-black text-sm uppercase tracking-wide text-muted-foreground">
              Allowed Sites / Keywords
            </Label>
            <div className="flex gap-2 mb-3">
              <Input
                value={allowedTabInput}
                onChange={(e) => setAllowedTabInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTab()}
                placeholder="e.g. React Docs, GitHub"
                className="h-10 bg-card border-border"
              />
              <Button type="button" onClick={addTab} variant="outline" className="h-10 px-4 border-border bg-card hover:bg-accent hover:border-primary font-black">
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {allowedTabs.map((tab) => (
                <span
                  key={tab}
                  className="flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold"
                  style={{ background: "#FFE8D9", color: "#F08F60" }}
                >
                  {tab}
                  <button
                    onClick={() => setAllowedTabs((t) => t.filter((x) => x !== tab))}
                    className="ml-1 opacity-60 hover:opacity-100 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 text-sm font-bold rounded-xl mb-4 border"
            style={{ background: "#FFE0DB", color: "#E26656", borderColor: "#E26656" }}>
            {error}
          </div>
        )}

        {/* Two-button row: calibrate + skip */}
        <div className="flex gap-3">
          <Button
            onClick={handleCalibrate}
            disabled={loading}
            className="flex-1 h-12 text-base font-semibold cursor-pointer"
          >
            Calibrate &amp; Start
          </Button>
          <Button
            onClick={handleStart}
            disabled={loading}
            variant="outline"
            className="h-12 px-5 text-sm cursor-pointer"
          >
            {loading ? "Starting…" : "Skip"}
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-3">
          Calibration takes 5 seconds and improves phone-check &amp; head-tilt accuracy
        </p>
      </div>
    </div>
  );
}
