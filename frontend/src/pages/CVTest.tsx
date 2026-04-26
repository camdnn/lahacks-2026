import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { ArrowLeft, RefreshCw } from "lucide-react";

// ── landmark indices (identical to FocusContext) ─────────────────────────────
const R_EYE = [33, 160, 158, 133, 153, 144];
const L_EYE = [362, 385, 387, 263, 373, 380];
const FOREHEAD = 10;
const CHIN = 152;
const NOSE_TIP = 4;
const L_OUTER = 33;
const R_OUTER = 263;
const LIP_TOP = 13;
const LIP_BOT = 14;
const MOUTH_L = 61;
const MOUTH_R = 291;

type P = { x: number; y: number; z?: number };
const dst = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);

function drawOverlay(lmks: P[] | null, canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Match canvas resolution to its displayed size
  const { clientWidth: W, clientHeight: H } = canvas;
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width  = W;
    canvas.height = H;
  }
  ctx.clearRect(0, 0, W, H);
  if (!lmks) return;

  // Normalize → canvas pixels (X flipped to match the CSS scaleX(-1) on the video)
  const px = (lm: P) => [(1 - lm.x) * W, lm.y * H] as [number, number];

  function stroke(indices: number[], color: string, close = false) {
    if (indices.length < 2) return;
    ctx!.beginPath();
    const [x0, y0] = px(lmks![indices[0]]);
    ctx!.moveTo(x0, y0);
    for (let i = 1; i < indices.length; i++) {
      const [x, y] = px(lmks![indices[i]]);
      ctx!.lineTo(x, y);
    }
    if (close) ctx!.closePath();
    ctx!.strokeStyle = color;
    ctx!.lineWidth   = 1.8;
    ctx!.lineJoin    = "round";
    ctx!.stroke();
  }

  stroke(R_EYE, "rgba(0,220,255,0.85)", true);
  stroke(L_EYE, "rgba(0,220,255,0.85)", true);
  stroke([MOUTH_L, LIP_TOP, MOUTH_R, LIP_BOT], "rgba(255,160,0,0.85)", true);
}
const calcEar = (lm: P[], idx: number[]) => {
  const [p1, p2, p3, p4, p5, p6] = idx.map(i => lm[i]);
  return (dst(p2, p6) + dst(p3, p5)) / (2 * dst(p1, p4));
};

// ── default thresholds ────────────────────────────────────────────────────────
const DEFAULT_T = {
  earClose:   0.20,
  earSecs:    1.5,
  marYawn:    0.48,
  marSecs:    1.0,
  tiltDeg:    22,
  tiltSecs:   2.0,
  phoneDelta: 0.10,
  phoneSecs:  1.5,
  noFaceSecs: 2.0,
};

const ZERO_COUNTS = () => ({
  microsleep: 0, yawn: 0, phone_check: 0, head_tilt: 0, eyes_off_screen: 0,
});

// ── sub-components ────────────────────────────────────────────────────────────

function MetricBar({ label, value, min, max, threshold, threshHigh = false }: {
  label: string; value: number; min: number; max: number;
  threshold?: number; threshHigh?: boolean;
}) {
  const pct      = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const threshPct = threshold !== undefined
    ? Math.max(0, Math.min(100, ((threshold - min) / (max - min)) * 100))
    : null;
  const alert  = threshold !== undefined && (threshHigh ? value > threshold : value < threshold);
  const color  = alert ? "bg-red-500" : "bg-emerald-500";

  return (
    <div className="mb-3">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs font-medium text-slate-300">{label}</span>
        <span className={`text-sm font-bold tabular-nums ${alert ? "text-red-400" : "text-emerald-400"}`}>
          {value.toFixed(3)}
        </span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden relative">
        <div className={`h-full rounded-full transition-all duration-150 ${color}`} style={{ width: `${pct}%` }} />
        {threshPct !== null && (
          <div className="absolute top-0 h-full w-0.5 bg-yellow-400/80" style={{ left: `${threshPct}%` }} />
        )}
      </div>
    </div>
  );
}

function ThreshSlider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mb-3">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs font-medium text-slate-300">{label}</span>
        <span className="text-xs font-bold text-amber-400 tabular-nums w-10 text-right">{value.toFixed(2)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 accent-amber-400"
      />
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function CVTest() {
  const navigate = useNavigate();

  // Refs — survive re-renders without causing them
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const mediaVideoRef = useRef<HTMLVideoElement | null>(null); // hidden, for MediaPipe
  const streamRef     = useRef<MediaStream | null>(null);
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const sus           = useRef({ eyes: 0, yawn: 0, tilt: 0, phone: 0, noFace: 0 });
  const cal           = useRef({ noseBl: 0.57, tiltBl: 0, done: false });
  const countsRef     = useRef(ZERO_COUNTS());
  const lastMsRef     = useRef(performance.now());
  const fpsCountRef   = useRef(0);
  const lastFpsRef    = useRef(Date.now());
  const threshRef     = useRef({ ...DEFAULT_T });

  // Display refs
  const displayVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef       = useRef<HTMLCanvasElement>(null);

  // React state
  const [thresholds, setThresholds] = useState({ ...DEFAULT_T });
  const [status, setStatus]         = useState<"loading" | "running" | "error">("loading");
  const [errorMsg, setErrorMsg]     = useState("");
  const [fps, setFps]               = useState(0);
  const [calibrated, setCalibrated] = useState(false);
  const [metrics, setMetrics]       = useState({
    ear: 0.3, mar: 0.1, tiltDeg: 0, noseRatio: 0.5, faceDetected: false,
  });
  const [counts, setCounts]         = useState(ZERO_COUNTS());
  const [events, setEvents]         = useState<string[]>([]);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Keep threshRef in sync with slider state
  useEffect(() => { threshRef.current = thresholds; }, [thresholds]);

  // Bind stream to visible video element
  useEffect(() => {
    if (displayVideoRef.current && cameraStream) {
      displayVideoRef.current.srcObject = cameraStream;
      displayVideoRef.current.play().catch(() => {});
    }
  }, [cameraStream]);

  const addEvent = useCallback((type: string) => {
    countsRef.current[type as keyof typeof countsRef.current] =
      (countsRef.current[type as keyof typeof countsRef.current] ?? 0) + 1;
    setCounts({ ...countsRef.current });
    setEvents(prev => [`${new Date().toLocaleTimeString()} — ${type}`, ...prev].slice(0, 30));
  }, []);

  const resetCounts = () => {
    countsRef.current = ZERO_COUNTS();
    setCounts(ZERO_COUNTS());
    setEvents([]);
    cal.current = { noseBl: 0.57, tiltBl: 0, done: false };
    sus.current = { eyes: 0, yawn: 0, tilt: 0, phone: 0, noFace: 0 };
    setCalibrated(false);
  };

  // ── MediaPipe lifecycle ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const calNose: number[] = [], calTilt: number[] = [];
    const calDeadline = Date.now() + 3000;

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm",
        );
        const lm = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          },
          runningMode: "VIDEO",
          numFaces: 1,
        });
        if (cancelled) { lm.close(); return; }
        landmarkerRef.current = lm;

        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        // Hidden video element for MediaPipe input
        const vid = document.createElement("video");
        vid.srcObject = stream;
        vid.muted = true;
        vid.autoplay = true;
        vid.playsInline = true;
        await vid.play();
        mediaVideoRef.current = vid;

        setCameraStream(stream);
        setStatus("running");

        intervalRef.current = setInterval(() => {
          if (cancelled || !landmarkerRef.current || !mediaVideoRef.current) return;

          const now = performance.now();
          const dt  = (now - lastMsRef.current) / 1000;
          lastMsRef.current = now;
          const T = threshRef.current;

          // FPS
          fpsCountRef.current++;
          const wall = Date.now();
          if (wall - lastFpsRef.current >= 1000) {
            setFps(fpsCountRef.current);
            fpsCountRef.current = 0;
            lastFpsRef.current = wall;
          }

          const res  = landmarkerRef.current.detectForVideo(mediaVideoRef.current, now);
          const lmks = res.faceLandmarks?.[0];

          if (!lmks) {
            setMetrics(m => ({ ...m, faceDetected: false }));
            sus.current.noFace += dt;
            if (sus.current.noFace >= T.noFaceSecs) { addEvent("eyes_off_screen"); sus.current.noFace = 0; }
            sus.current.eyes = sus.current.yawn = sus.current.tilt = sus.current.phone = 0;
            drawOverlay(null, canvasRef.current);
            return;
          }

          sus.current.noFace = 0;

          const avgEar = (calcEar(lmks, R_EYE) + calcEar(lmks, L_EYE)) / 2;

          const mw  = dst(lmks[MOUTH_L], lmks[MOUTH_R]);
          const mh  = dst(lmks[LIP_TOP], lmks[LIP_BOT]);
          const mar = mw > 0.001 ? mh / mw : 0;

          const lex     = lmks[L_OUTER], rex = lmks[R_OUTER];
          const tiltDeg = Math.atan2(rex.y - lex.y, rex.x - lex.x) * (180 / Math.PI);

          const nose      = lmks[NOSE_TIP];
          const forehead  = lmks[FOREHEAD];
          const chin      = lmks[CHIN];
          const faceH     = chin.y - forehead.y;
          const noseRatio = faceH > 0.001 ? (nose.y - forehead.y) / faceH : 0.5;

          // Auto-calibrate first 3 s
          if (!cal.current.done) {
            if (Date.now() < calDeadline) {
              calNose.push(noseRatio);
              calTilt.push(tiltDeg);
            } else if (calNose.length > 0) {
              calNose.sort((a, b) => a - b);
              calTilt.sort((a, b) => a - b);
              cal.current.noseBl = calNose[Math.floor(calNose.length / 2)];
              cal.current.tiltBl = calTilt[Math.floor(calTilt.length / 2)];
              cal.current.done = true;
              setCalibrated(true);
            }
          }

          setMetrics({ ear: avgEar, mar, tiltDeg, noseRatio, faceDetected: true });

          const tiltThresh  = Math.abs(cal.current.tiltBl) + T.tiltDeg;
          const phoneThresh = cal.current.noseBl - T.phoneDelta;

          if (avgEar < T.earClose) {
            sus.current.eyes += dt;
            if (sus.current.eyes >= T.earSecs) { addEvent("microsleep"); sus.current.eyes = 0; }
          } else { sus.current.eyes = 0; }

          if (mar > T.marYawn) {
            sus.current.yawn += dt;
            if (sus.current.yawn >= T.marSecs) { addEvent("yawn"); sus.current.yawn = 0; }
          } else { sus.current.yawn = 0; }

          if (Math.abs(tiltDeg - cal.current.tiltBl) > tiltThresh) {
            sus.current.tilt += dt;
            if (sus.current.tilt >= T.tiltSecs) { addEvent("head_tilt"); sus.current.tilt = 0; }
          } else { sus.current.tilt = 0; }

          if (noseRatio < phoneThresh) {
            sus.current.phone += dt;
            if (sus.current.phone >= T.phoneSecs) { addEvent("phone_check"); sus.current.phone = 0; }
          } else { sus.current.phone = 0; }

          drawOverlay(lmks, canvasRef.current);
        }, 200);

      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg(String(err));
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      mediaVideoRef.current = null;
    };
  }, [addEvent]);

  // ── derived alert states ──────────────────────────────────────────────────
  const T = thresholds;
  const { ear, mar, tiltDeg, noseRatio, faceDetected } = metrics;
  const tiltThresh  = Math.abs(cal.current.tiltBl) + T.tiltDeg;
  const phoneThresh = cal.current.noseBl - T.phoneDelta;
  const earAlert    = ear < T.earClose;
  const marAlert    = mar > T.marYawn;
  const tiltAlert   = Math.abs(tiltDeg - cal.current.tiltBl) > tiltThresh;
  const phoneAlert  = noseRatio < phoneThresh;

  const EVENT_LABELS: Record<string, string> = {
    microsleep:      "😴 Microsleep",
    yawn:            "🥱 Yawn",
    phone_check:     "📱 Phone Check",
    head_tilt:       "↩ Head Tilt",
    eyes_off_screen: "👀 Eyes Off Screen",
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="size-4" /> Back
        </button>
        <h1 className="text-sm font-bold text-slate-300 hidden md:block">CV Detection Test</h1>
        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-sm font-mono">{fps} fps</span>
          <div className={`text-sm font-medium ${
            status === "running" ? "text-emerald-400" :
            status === "loading" ? "text-amber-400" : "text-red-400"
          }`}>
            {status === "running"
              ? (calibrated ? "● Calibrated" : "● Calibrating…")
              : status === "loading" ? "Loading MediaPipe…" : "Error"}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-0 min-h-0">
        {/* Camera feed */}
        <div className="flex-1 flex items-center justify-center bg-slate-900 relative min-h-64">
          {status === "error" ? (
            <div className="text-center p-8">
              <div className="text-4xl mb-3">📷</div>
              <p className="text-red-400 font-medium mb-2">Camera error</p>
              <p className="text-slate-400 text-sm">{errorMsg}</p>
            </div>
          ) : status === "loading" ? (
            <div className="text-center animate-pulse">
              <p className="text-slate-400">Loading MediaPipe model…</p>
              <p className="text-slate-500 text-xs mt-1">First load may take ~10s</p>
            </div>
          ) : (
            <div className="relative max-w-full max-h-full">
              <video
                ref={displayVideoRef}
                autoPlay muted playsInline
                className="max-w-full max-h-full object-contain block"
                style={{ transform: "scaleX(-1)" }}
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
            </div>
          )}

          {/* Alert badges */}
          {status === "running" && (
            <div className="absolute top-4 left-4 flex flex-col gap-1.5">
              <div className={`px-2.5 py-1 rounded text-xs font-semibold ${
                faceDetected ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
              }`}>
                {faceDetected ? "✓ Face Detected" : "✗ No Face"}
              </div>
              {earAlert   && <div className="px-2.5 py-1 rounded text-xs font-semibold bg-red-500/20    text-red-400">⚠ Eyes Closed</div>}
              {marAlert   && <div className="px-2.5 py-1 rounded text-xs font-semibold bg-orange-500/20 text-orange-400">⚠ Yawning</div>}
              {tiltAlert  && <div className="px-2.5 py-1 rounded text-xs font-semibold bg-blue-500/20   text-blue-400">⚠ Head Tilt</div>}
              {phoneAlert && <div className="px-2.5 py-1 rounded text-xs font-semibold bg-yellow-500/20 text-yellow-400">⚠ Phone Check</div>}
            </div>
          )}

          {status === "running" && !calibrated && (
            <div className="absolute bottom-4 inset-x-4 text-center bg-slate-900/80 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-slate-400">
              Calibrating baseline… look straight ahead (3 s)
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-80 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col overflow-hidden">
          <div className="overflow-y-auto flex-1">

            {/* Live metrics */}
            <div className="p-5 border-b border-slate-800">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Live Metrics</h2>
              <MetricBar
                label={`EAR — Eye Aspect Ratio (thresh ${T.earClose.toFixed(2)})`}
                value={ear} min={0} max={0.45} threshold={T.earClose}
              />
              <MetricBar
                label={`MAR — Mouth Aspect Ratio (thresh ${T.marYawn.toFixed(2)})`}
                value={mar} min={0} max={0.9} threshold={T.marYawn} threshHigh
              />

              {/* Head tilt — centered bar */}
              <div className="mb-3">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-xs font-medium text-slate-300">
                    Head Tilt (±{T.tiltDeg}° thresh)
                  </span>
                  <span className={`text-sm font-bold tabular-nums ${tiltAlert ? "text-red-400" : "text-emerald-400"}`}>
                    {tiltDeg.toFixed(1)}°
                  </span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden relative">
                  <div className="absolute inset-x-1/2 top-0 h-full w-px bg-slate-500" />
                  <div
                    className={`h-full rounded-full transition-all duration-150 absolute top-0 ${tiltAlert ? "bg-red-500" : "bg-emerald-500"}`}
                    style={{
                      left: "50%",
                      width: `${Math.min(50, Math.abs((tiltDeg - cal.current.tiltBl) / 45) * 50)}%`,
                      transform: (tiltDeg - cal.current.tiltBl) < 0 ? "translateX(-100%)" : "none",
                    }}
                  />
                </div>
              </div>

              <MetricBar
                label={`Nose Ratio (phone check, thresh ${phoneThresh.toFixed(2)})`}
                value={noseRatio} min={0.2} max={0.8} threshold={phoneThresh}
              />
            </div>

            {/* Event counts */}
            <div className="p-5 border-b border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Event Counts</h2>
                <button
                  onClick={resetCounts}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <RefreshCw className="size-3" /> Reset
                </button>
              </div>
              <div className="space-y-1.5">
                {Object.entries(EVENT_LABELS).map(([key, label]) => {
                  const count = counts[key as keyof typeof counts] ?? 0;
                  return (
                    <div
                      key={key}
                      className={`flex items-center justify-between px-3 py-1.5 rounded-lg border text-sm ${
                        count > 0
                          ? "border-amber-500/30 text-amber-300 bg-amber-500/5"
                          : "border-slate-800 text-slate-600"
                      }`}
                    >
                      <span>{label}</span>
                      <span className="font-bold tabular-nums">×{count}</span>
                    </div>
                  );
                })}
              </div>

              {/* Recent event log */}
              {events.length > 0 && (
                <div className="mt-4 space-y-0.5">
                  {events.slice(0, 8).map((e, i) => (
                    <p key={i} className="text-xs text-slate-500 font-mono">{e}</p>
                  ))}
                </div>
              )}
            </div>

            {/* Threshold sliders */}
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Thresholds</h2>
                <button
                  onClick={() => setThresholds({ ...DEFAULT_T })}
                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Reset defaults
                </button>
              </div>

              <p className="text-xs text-slate-500 mb-3">EAR / Eyes</p>
              <ThreshSlider label="EAR close (microsleep trigger)" value={T.earClose} min={0.10} max={0.35} step={0.01} onChange={v => setThresholds(t => ({ ...t, earClose: v }))} />
              <ThreshSlider label="EAR sustained (s)" value={T.earSecs} min={0.3} max={4.0} step={0.1} onChange={v => setThresholds(t => ({ ...t, earSecs: v }))} />

              <p className="text-xs text-slate-500 mb-3 mt-2">MAR / Mouth</p>
              <ThreshSlider label="MAR yawn trigger" value={T.marYawn} min={0.30} max={0.70} step={0.01} onChange={v => setThresholds(t => ({ ...t, marYawn: v }))} />
              <ThreshSlider label="MAR sustained (s)" value={T.marSecs} min={0.3} max={3.0} step={0.1} onChange={v => setThresholds(t => ({ ...t, marSecs: v }))} />

              <p className="text-xs text-slate-500 mb-3 mt-2">Head Tilt</p>
              <ThreshSlider label="Tilt degrees (from baseline)" value={T.tiltDeg} min={5} max={45} step={1} onChange={v => setThresholds(t => ({ ...t, tiltDeg: v }))} />
              <ThreshSlider label="Tilt sustained (s)" value={T.tiltSecs} min={0.3} max={4.0} step={0.1} onChange={v => setThresholds(t => ({ ...t, tiltSecs: v }))} />

              <p className="text-xs text-slate-500 mb-3 mt-2">Phone Check</p>
              <ThreshSlider label="Nose delta (below baseline)" value={T.phoneDelta} min={0.02} max={0.25} step={0.01} onChange={v => setThresholds(t => ({ ...t, phoneDelta: v }))} />
              <ThreshSlider label="Phone sustained (s)" value={T.phoneSecs} min={0.3} max={4.0} step={0.1} onChange={v => setThresholds(t => ({ ...t, phoneSecs: v }))} />

              <p className="text-xs text-slate-500 mb-3 mt-2">Face Off Screen</p>
              <ThreshSlider label="No face sustained (s)" value={T.noFaceSecs} min={0.3} max={6.0} step={0.1} onChange={v => setThresholds(t => ({ ...t, noFaceSecs: v }))} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
