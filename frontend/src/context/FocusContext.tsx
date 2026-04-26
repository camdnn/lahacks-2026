import {
  createContext, useContext, useState, useEffect,
  useRef, useCallback, type ReactNode,
} from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { useSession } from "./SessionContext";
import { logEvent } from "../api/client";

// ── types ──────────────────────────────────────────────────────────────────────

interface FocusState {
  focus_score: number;
  counts: Record<string, number>;
  top_distractors: [string, number][];
  ear: number;
  mar: number;
  head_tilt: number;
  face_detected: boolean;
  blink_rate: number;
}

interface FocusCtx extends FocusState {
  connected: boolean;
  cameraStream: MediaStream | null;
  coinsEarned: number;
}

// ── constants ──────────────────────────────────────────────────────────────────

const WEIGHTS: Record<string, number> = {
  microsleep:     10,
  phone_check:     5,
  yawn:            3,
  tab_switch:      2,
  eyes_off_screen: 2,
  head_tilt:       1,
};

const T = {
  EAR_CLOSE:    0.20,   // EAR below → eyes closed
  EAR_SECS:     1.5,    // sustained → microsleep event
  MAR_YAWN:     0.48,   // MAR above → yawning
  MAR_SECS:     1.0,
  TILT_DEG:     22,     // degrees above baseline → head tilt
  TILT_SECS:    2.0,
  PHONE_DELTA:  0.10,   // nose_ratio below (baseline - delta) → phone check
  PHONE_SECS:   1.5,
  NO_FACE_SECS: 2.0,
  THROTTLE_MS:  66,     // ~15 fps for MediaPipe
};

// MediaPipe landmark indices (478-point face mesh)
const R_EYE_PTS = [33,  160, 158, 133, 153, 144]; // [p1,p2,p3,p4,p5,p6]
const L_EYE_PTS = [362, 385, 387, 263, 373, 380];
const NOSE_TIP  = 4;
const FOREHEAD  = 10;
const CHIN      = 152;
const L_OUTER   = 33;   // left eye outer corner
const R_OUTER   = 263;  // right eye outer corner
const LIP_TOP   = 13;
const LIP_BOT   = 14;
const MOUTH_L   = 61;
const MOUTH_R   = 291;

// ── helpers ────────────────────────────────────────────────────────────────────

type P = { x: number; y: number };
const d = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
const ear = (lm: P[], idx: number[]) => {
  const [p1, p2, p3, p4, p5, p6] = idx.map(i => lm[i]);
  return (d(p2, p6) + d(p3, p5)) / (2 * d(p1, p4));
};
const scoreFromCounts = (c: Record<string, number>) =>
  Math.max(0, 100 - Object.entries(c).reduce((s, [k, v]) => s + v * (WEIGHTS[k] ?? 0), 0));

const ZERO_COUNTS = () => Object.fromEntries(Object.keys(WEIGHTS).map(k => [k, 0]));

const DEFAULTS: FocusState = {
  focus_score: 100, counts: ZERO_COUNTS(),
  top_distractors: [], ear: 0.3, mar: 0.1,
  head_tilt: 0, face_detected: false, blink_rate: 0,
};

const FocusContext = createContext<FocusCtx>({ ...DEFAULTS, connected: false, cameraStream: null, coinsEarned: 0 });

// ── provider ───────────────────────────────────────────────────────────────────

export function FocusProvider({ children }: { children: ReactNode }) {
  const { isActive, sessionId } = useSession();
  const [data, setData]               = useState<FocusState>(DEFAULTS);
  const [connected, setConnected]     = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [coinsEarned, setCoinsEarned] = useState(0);

  const landmarkerRef  = useRef<FaceLandmarker | null>(null);
  const videoRef       = useRef<HTMLVideoElement | null>(null);
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef   = useRef<string | null>(null);
  const countsRef      = useRef<Record<string, number>>(ZERO_COUNTS());
  const streamRef      = useRef<MediaStream | null>(null);
  const lastDisplayRef = useRef<number>(0);
  const focusSecsRef   = useRef<number>(0);
  const lastCoinsRef   = useRef<number>(0);

  // Sustained-event accumulators (seconds condition held true)
  const sus = useRef({ eyesClosed: 0, yawn: 0, headTilt: 0, phone: 0, noFace: 0 });
  const cal = useRef({ noseBaseline: 0.57, tiltBaseline: 0, done: false });

  // Keep sessionId ref in sync without re-creating recordEvent
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  // ── event recorder ─────────────────────────────────────────────────────────
  const recordEvent = useCallback((type: string) => {
    countsRef.current[type] = (countsRef.current[type] ?? 0) + 1;
    setData(prev => {
      const counts = { ...prev.counts, [type]: (prev.counts[type] ?? 0) + 1 };
      return { ...prev, counts, focus_score: scoreFromCounts(counts) };
    });
    const sid = sessionIdRef.current;
    if (sid) logEvent({ session_id: sid, event_type: type }).catch(() => {});
  }, []);

  // ── MediaPipe lifecycle ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      videoRef.current = null;
      setCameraStream(null);
      setConnected(false);
      setData(DEFAULTS);
      countsRef.current = ZERO_COUNTS();
      sus.current = { eyesClosed: 0, yawn: 0, headTilt: 0, phone: 0, noFace: 0 };
      cal.current = { noseBaseline: 0.57, tiltBaseline: 0, done: false };
      focusSecsRef.current = 0;
      lastCoinsRef.current = 0;
      setCoinsEarned(0);
      return;
    }

    let cancelled = false;
    const calNose: number[] = [], calTilt: number[] = [];
    const calDeadline = Date.now() + 3000;
    let lastMs = performance.now();

    async function init() {
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

      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      await video.play();

      videoRef.current = video;
      setCameraStream(stream);
      setConnected(true);

      // Process at 5 fps — gives the main thread 200ms between heavyweight
      // MediaPipe calls so the UI stays responsive.
      intervalRef.current = setInterval(() => {
        if (cancelled || !landmarkerRef.current || !videoRef.current) return;
        const now = performance.now();
        const dt  = (now - lastMs) / 1000;
        lastMs = now;

        const res  = landmarkerRef.current.detectForVideo(videoRef.current, now);
        const lmks = res.faceLandmarks?.[0];

        if (!lmks) {
          setData(prev => ({ ...prev, face_detected: false }));
          sus.current.noFace += dt;
          if (sus.current.noFace >= T.NO_FACE_SECS) {
            recordEvent("eyes_off_screen");
            sus.current.noFace = 0;
          }
          sus.current.eyesClosed = sus.current.yawn = sus.current.headTilt = sus.current.phone = 0;
          return;
        }

        sus.current.noFace = 0;

        // Accumulate focus seconds and award 1 coin per 5 s
        focusSecsRef.current += dt;
        const newCoins = Math.floor(focusSecsRef.current / 5);
        if (newCoins !== lastCoinsRef.current) {
          lastCoinsRef.current = newCoins;
          setCoinsEarned(newCoins);
        }

        const rEar = ear(lmks, R_EYE_PTS);
        const lEar = ear(lmks, L_EYE_PTS);
        const avgEar = (rEar + lEar) / 2;

        const mw  = d(lmks[MOUTH_L], lmks[MOUTH_R]);
        const mh  = d(lmks[LIP_TOP], lmks[LIP_BOT]);
        const mar = mw > 0.001 ? mh / mw : 0;

        const lex = lmks[L_OUTER], rex = lmks[R_OUTER];
        const tiltDeg = Math.atan2(rex.y - lex.y, rex.x - lex.x) * (180 / Math.PI);

        const nose      = lmks[NOSE_TIP];
        const forehead  = lmks[FOREHEAD];
        const chin      = lmks[CHIN];
        const faceH     = chin.y - forehead.y;
        const noseRatio = faceH > 0.001 ? (nose.y - forehead.y) / faceH : 0.5;

        // Auto-calibrate for first 3 seconds
        if (!cal.current.done) {
          if (Date.now() < calDeadline) {
            calNose.push(noseRatio);
            calTilt.push(tiltDeg);
          } else if (calNose.length > 0) {
            calNose.sort((a, b) => a - b);
            calTilt.sort((a, b) => a - b);
            cal.current.noseBaseline = calNose[Math.floor(calNose.length / 2)];
            cal.current.tiltBaseline = calTilt[Math.floor(calTilt.length / 2)];
            cal.current.done = true;
          }
        }

        if (now - lastDisplayRef.current > 300) {
          lastDisplayRef.current = now;
          setData(prev => ({
            ...prev,
            face_detected: true,
            ear: +avgEar.toFixed(3),
            mar: +mar.toFixed(3),
            head_tilt: +tiltDeg.toFixed(1),
          }));
        } else {
          setData(prev => prev.face_detected ? prev : { ...prev, face_detected: true });
        }

        const tiltThresh  = Math.abs(cal.current.tiltBaseline) + T.TILT_DEG;
        const phoneThresh = cal.current.noseBaseline - T.PHONE_DELTA;

        if (avgEar < T.EAR_CLOSE) {
          sus.current.eyesClosed += dt;
          if (sus.current.eyesClosed >= T.EAR_SECS) { recordEvent("microsleep"); sus.current.eyesClosed = 0; }
        } else { sus.current.eyesClosed = 0; }

        if (mar > T.MAR_YAWN) {
          sus.current.yawn += dt;
          if (sus.current.yawn >= T.MAR_SECS) { recordEvent("yawn"); sus.current.yawn = 0; }
        } else { sus.current.yawn = 0; }

        if (Math.abs(tiltDeg - cal.current.tiltBaseline) > tiltThresh) {
          sus.current.headTilt += dt;
          if (sus.current.headTilt >= T.TILT_SECS) { recordEvent("head_tilt"); sus.current.headTilt = 0; }
        } else { sus.current.headTilt = 0; }

        if (noseRatio < phoneThresh) {
          sus.current.phone += dt;
          if (sus.current.phone >= T.PHONE_SECS) { recordEvent("phone_check"); sus.current.phone = 0; }
        } else { sus.current.phone = 0; }
      }, 200);
    }

    init().catch(err => {
      console.error("[FocusContext] MediaPipe init failed:", err);
      setConnected(false);
    });

    return () => {
      cancelled = true;
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      videoRef.current = null;
    };
  }, [isActive, recordEvent]);

  // Stop camera on hard tab/window close
  useEffect(() => {
    if (!isActive) return;
    const onUnload = () => streamRef.current?.getTracks().forEach(t => t.stop());
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [isActive]);

  // ── tab-switch detection ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive) return;
    const onVisibility = () => { if (document.hidden) recordEvent("tab_switch"); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [isActive, recordEvent]);

  return (
    <FocusContext.Provider value={{ ...data, connected, cameraStream, coinsEarned }}>
      {children}
    </FocusContext.Provider>
  );
}

export function useFocus() { return useContext(FocusContext); }
