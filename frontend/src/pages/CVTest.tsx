import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Wifi, WifiOff } from "lucide-react";

interface CVMetrics {
  focus_score: number;
  ear: number;
  mar: number;
  head_tilt: number;
  nose_ratio: number;
  face_detected: boolean;
  blink_rate: number;
  counts: Record<string, number>;
  is_active?: boolean;
}

const EVENT_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  microsleep:      { label: "Microsleep",       emoji: "", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  yawn:            { label: "Yawn",             emoji: "", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  phone_check:     { label: "Phone Check",      emoji: "", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  head_tilt:       { label: "Head Tilt",        emoji: "", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  eyes_off_screen: { label: "Eyes Off Screen",  emoji: "", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  tab_switch:      { label: "Tab Switch",       emoji: "", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
};

function MetricBar({ label, value, min, max, danger, warn }: {
  label: string; value: number; min: number; max: number; danger?: number; warn?: number;
}) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const isDanger = danger !== undefined && value < danger;
  const isWarn   = warn   !== undefined && value > warn;
  const color    = isDanger || isWarn ? "bg-red-500" : "bg-emerald-500";

  return (
    <div className="mb-3">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs font-medium text-slate-300">{label}</span>
        <span className={`text-sm font-bold tabular-nums ${isDanger || isWarn ? "text-red-400" : "text-emerald-400"}`}>
          {value.toFixed(3)}
        </span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-200 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function CVTest() {
  const navigate = useNavigate();
  const imgRef   = useRef<HTMLImageElement>(null);
  const wsRef    = useRef<WebSocket | null>(null);
  const [connected, setConnected]   = useState(false);
  const [metrics, setMetrics]       = useState<CVMetrics | null>(null);
  const [fps, setFps]               = useState(0);
  const [error, setError]           = useState("");
  const frameCount = useRef(0);
  const lastFpsTime = useRef(Date.now());

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, []);

  function connect() {
    setError("");
    const ws = new WebSocket("ws://localhost:8000/ws/cv");
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);

      // Update frame in <img> via object URL
      if (data.frame && imgRef.current) {
        const binary = atob(data.frame);
        const bytes  = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: "image/jpeg" });
        const url  = URL.createObjectURL(blob);
        const old  = imgRef.current.src;
        imgRef.current.src = url;
        if (old.startsWith("blob:")) URL.revokeObjectURL(old);
      }

      if (data.metrics) setMetrics(data.metrics);

      // FPS counter
      frameCount.current++;
      const now = Date.now();
      if (now - lastFpsTime.current >= 1000) {
        setFps(frameCount.current);
        frameCount.current = 0;
        lastFpsTime.current = now;
      }
    };

    ws.onerror = () => setError("Could not connect to backend. Make sure the server is running.");
    ws.onclose = () => { setConnected(false); };
  }

  const scoreColor = !metrics ? "text-slate-400" :
    metrics.focus_score >= 80 ? "text-emerald-400" :
    metrics.focus_score >= 50 ? "text-amber-400" : "text-red-400";

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
        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-sm font-mono">{fps} fps</span>
          <div className={`flex items-center gap-1.5 text-sm font-medium ${connected ? "text-emerald-400" : "text-red-400"}`}>
            {connected ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}
            {connected ? "Connected" : "Disconnected"}
          </div>
        </div>
        <h1 className="text-sm font-bold text-slate-300 hidden md:block">CV Detection Test</h1>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-0">
        {/* Camera feed */}
        <div className="flex-1 flex items-center justify-center bg-slate-900 relative min-h-[360px]">
          {error ? (
            <div className="text-center p-8">
              <div className="text-4xl mb-4 font-mono text-slate-400">[cam]</div>
              <p className="text-red-400 font-medium mb-2">Connection Error</p>
              <p className="text-slate-400 text-sm mb-4">{error}</p>
              <button
                onClick={connect}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
              >
                Retry
              </button>
            </div>
          ) : !connected ? (
            <div className="text-center">
              <div className="animate-pulse text-4xl mb-4 font-mono text-slate-400">[connecting]</div>
              <p className="text-slate-400">Connecting to CV pipeline…</p>
            </div>
          ) : (
            <img
              ref={imgRef}
              alt="CV feed"
              className="max-w-full max-h-full object-contain"
              style={{ imageRendering: "auto" }}
            />
          )}

          {/* Focus score overlay */}
          {metrics && (
            <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur-sm rounded-xl px-4 py-2 border border-slate-700">
              <div className={`text-3xl font-black tabular-nums ${scoreColor}`}>
                {Math.round(metrics.focus_score)}
              </div>
              <div className="text-xs text-slate-400">focus score</div>
            </div>
          )}
        </div>

        {/* Sidebar metrics */}
        <div className="w-full lg:w-80 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 p-5 overflow-y-auto">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Live Metrics</h2>

          {metrics ? (
            <>
              {/* Face detection */}
              <div className={`flex items-center gap-2 mb-4 px-3 py-2 rounded-lg border text-sm font-medium ${
                metrics.face_detected
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-red-500/10 border-red-500/30 text-red-400"
              }`}>
                <span>{metrics.face_detected ? "✓" : "✗"}</span>
                Face {metrics.face_detected ? "Detected" : "Not Detected"}
              </div>

              {/* EAR */}
              <MetricBar
                label="EAR — Eye Aspect Ratio (open-eye)"
                value={metrics.ear}
                min={0} max={0.4}
                danger={0.15}
              />
              {metrics.ear < 0.15 && (
                <div className="text-xs text-red-400 -mt-2 mb-3 font-semibold">⚠ MICROSLEEP THRESHOLD</div>
              )}

              {/* MAR */}
              <MetricBar
                label="MAR — Mouth Aspect Ratio (yawn)"
                value={metrics.mar}
                min={0} max={0.9}
                warn={0.6}
              />
              {metrics.mar > 0.6 && (
                <div className="text-xs text-orange-400 -mt-2 mb-3 font-semibold">⚠ YAWN DETECTED</div>
              )}

              {/* Head tilt */}
              <div className="mb-3">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-xs font-medium text-slate-300">Head Tilt (degrees)</span>
                  <span className={`text-sm font-bold tabular-nums ${Math.abs(metrics.head_tilt) > 20 ? "text-red-400" : "text-emerald-400"}`}>
                    {metrics.head_tilt.toFixed(1)}°
                  </span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden relative">
                  <div className="absolute inset-x-1/2 top-0 h-full w-px bg-slate-500" />
                  <div
                    className={`h-full rounded-full transition-all duration-200 absolute top-0 ${Math.abs(metrics.head_tilt) > 20 ? "bg-red-500" : "bg-emerald-500"}`}
                    style={{
                      left: "50%",
                      width: `${Math.min(50, Math.abs(metrics.head_tilt / 45) * 50)}%`,
                      transform: metrics.head_tilt < 0 ? "translateX(-100%)" : "none",
                    }}
                  />
                </div>
              </div>

              {/* Nose ratio */}
              <MetricBar
                label="Nose Ratio (phone check)"
                value={metrics.nose_ratio}
                min={0.2} max={0.8}
                warn={0.55}
              />
              {metrics.nose_ratio > 0.55 && (
                <div className="text-xs text-yellow-400 -mt-2 mb-3 font-semibold">⚠ PHONE CHECK</div>
              )}

              {/* Blink rate */}
              <MetricBar
                label="Blink Rate (per min)"
                value={metrics.blink_rate}
                min={0} max={40}
              />

              {/* Event counts */}
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 mt-5">Event Counts</h2>
              <div className="space-y-2">
                {Object.entries(EVENT_LABELS).map(([key, { label, emoji, color }]) => {
                  const count = metrics.counts?.[key] ?? 0;
                  return (
                    <div key={key} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${
                      count > 0 ? color : "border-slate-800 text-slate-600"
                    }`}>
                      <span>{emoji} {label}</span>
                      <span className="font-bold tabular-nums">×{count}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-slate-500 text-sm">Waiting for data…</div>
          )}
        </div>
      </div>
    </div>
  );
}
