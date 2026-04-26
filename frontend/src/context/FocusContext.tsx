import {
  createContext, useContext, useState, useEffect,
  useRef, useCallback, type ReactNode,
} from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { useSession } from "./SessionContext";
import { logEvent, BASE_URL, saveSessionSnapshot } from "../api/client";

// ── types ──────────────────────────────────────────────────────────────────────

export interface KeyPoints {
  leftEye:   [number, number][];
  rightEye:  [number, number][];
  nose:      [number, number];
  tiltL:     [number, number];
  tiltR:     [number, number];
  lipTop:    [number, number];
  lipBot:    [number, number];
  mouthL:    [number, number];
  mouthR:    [number, number];
  leftIris?: [number, number];
  rightIris?:[number, number];
}

interface FocusState {
  focus_score:     number;
  counts:          Record<string, number>;
  top_distractors: [string, number][];
  ear:             number;
  mar:             number;
  head_tilt:       number;  // roll (backward compat)
  pitch:           number;  // +° = looking down
  yaw:             number;  // |yaw| > 25° = head turned
  gaze_x:          number;  // iris offset from eye center
  gaze_y:          number;
  face_detected:   boolean;
  blink_rate:      number;
}

export interface TimelinePoint { elapsed: number; score: number }
export interface EventPoint    { elapsed: number; type: string }

interface FocusCtx extends FocusState {
  connected:           boolean;
  cameraStream:        MediaStream | null;
  coinsEarned:         number;
  multiplier:          number;
  streak_secs:         number;
  keyPoints:           KeyPoints | null;
  nextCoinPct:         number;
  secsToScoreRecovery: number;
  getTimelines: () => { focus: TimelinePoint[]; events: EventPoint[] };
}

// ── utility functions ──────────────────────────────────────────────────────────

type LM = { x: number; y: number };

function calculateHeadPose(lm: LM[]) {
  const nose      = lm[1];
  const forehead  = lm[10];
  const chin      = lm[152];
  const leftEdge  = lm[234];
  const rightEdge = lm[454];
  const leftEye   = lm[33];
  const rightEye  = lm[263];

  const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);

  const leftDist  = Math.abs(nose.x - leftEdge.x);
  const rightDist = Math.abs(nose.x - rightEdge.x);
  const total = leftDist + rightDist;
  const yaw = total > 0.01 ? ((leftDist - rightDist) / total) * 60 : 0;

  const faceH  = chin.y - forehead.y;
  const noseRel = faceH > 0.01 ? (nose.y - forehead.y) / faceH : 0.55;
  const pitch  = (noseRel - 0.55) * 80;

  return { roll, yaw, pitch, noseRel };
}

function calculateGaze(lm: LM[]): { gazeX: number; gazeY: number } {
  if (lm.length < 478) return { gazeX: 0, gazeY: 0 };
  const li = lm[468], ri = lm[473];
  const lCx = (lm[33].x + lm[133].x) / 2;
  const lCy = (lm[159].y + lm[145].y) / 2;
  const lW  = Math.abs(lm[33].x - lm[133].x);
  const rCx = (lm[263].x + lm[362].x) / 2;
  const rCy = (lm[386].y + lm[374].y) / 2;
  const rW  = Math.abs(lm[263].x - lm[362].x);
  const lgX = lW > 0.001 ? (li.x - lCx) / lW : 0;
  const rgX = rW > 0.001 ? (ri.x - rCx) / rW : 0;
  const lgY = lW > 0.001 ? (li.y - lCy) / lW : 0;
  const rgY = rW > 0.001 ? (ri.y - rCy) / rW : 0;
  return { gazeX: (lgX + rgX) / 2, gazeY: (lgY + rgY) / 2 };
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

// ── constants ──────────────────────────────────────────────────────────────────

const WEIGHTS: Record<string, number> = {
  microsleep:      4,
  phone_check:     5,
  yawn:            3,
  tab_switch:      2,
  eyes_off_screen: 2,
  head_tilt:       1,
};

const T = {
  EAR_RATIO:     0.60,   // 60% of baseline — eyes need to close more before triggering
  EAR_SECS:      3.5,
  MAR_YAWN:      0.55,
  MAR_SECS:      2.0,
  YAWN_COOLDOWN: 5.0,
  TILT_DEG:      28,
  TILT_SECS:     3.0,
  PHONE_DELTA:   0.13,
  PHONE_SECS:    2.5,
  NO_FACE_SECS:  3.5,
  WINDOW_MS:     5 * 60 * 1000,
  YAW_DEG:       30,
  YAW_SECS:      3.0,
  PITCH_DOWN:    25,
  GAZE_X:        0.22,
  GAZE_SECS:     3.0,
};

// MediaPipe landmark indices
const R_EYE_PTS = [33,  160, 158, 133, 153, 144];
const L_EYE_PTS = [362, 385, 387, 263, 373, 380];
const NOSE_TIP  = 4;
const L_OUTER   = 33;
const R_OUTER   = 263;
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

const ZERO_COUNTS = () => Object.fromEntries(Object.keys(WEIGHTS).map(k => [k, 0]));

const DEFAULTS: FocusState = {
  focus_score: 100, counts: ZERO_COUNTS(),
  top_distractors: [], ear: 0.3, mar: 0.1,
  head_tilt: 0, pitch: 0, yaw: 0, gaze_x: 0, gaze_y: 0,
  face_detected: false, blink_rate: 0,
};

function getMultiplier(streakS: number, score: number): number {
  const streakBonus = streakS > 120 ? 2 : streakS > 60 ? 1 : streakS > 30 ? 0.5 : 0;
  const scoreBonus  = score >= 90 ? 1 : score >= 80 ? 0.5 : score >= 70 ? 0.25 : 0;
  return Math.min(3, +(1 + streakBonus + scoreBonus).toFixed(1));
}

const FocusContext = createContext<FocusCtx>({
  ...DEFAULTS, connected: false, cameraStream: null,
  coinsEarned: 0, multiplier: 1, streak_secs: 0, keyPoints: null,
  nextCoinPct: 0, secsToScoreRecovery: 0,
  getTimelines: () => ({ focus: [], events: [] }),
});

// ── provider ───────────────────────────────────────────────────────────────────

export function FocusProvider({ children }: { children: ReactNode }) {
  const { isActive, sessionId, sessionType, disabledChecks } = useSession();
  const disabledRef = useRef<Set<string>>(new Set());
  useEffect(() => { disabledRef.current = new Set(disabledChecks); }, [disabledChecks]);
  const [data, setData]                 = useState<FocusState>(DEFAULTS);
  const [connected, setConnected]       = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [coinsEarned, setCoinsEarned]   = useState(0);
  const [multiplier, setMultiplier]     = useState(1);
  const [streakSecs, setStreakSecs]     = useState(0);
  const [keyPoints, setKeyPoints]           = useState<KeyPoints | null>(null);
  const [nextCoinPct, setNextCoinPct]       = useState(0);
  const [secsToScoreRecovery, setSecsToScoreRecovery] = useState(0);

  const landmarkerRef  = useRef<FaceLandmarker | null>(null);
  const videoRef       = useRef<HTMLVideoElement | null>(null);
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef   = useRef<string | null>(null);
  const countsRef      = useRef<Record<string, number>>(ZERO_COUNTS());
  const streamRef      = useRef<MediaStream | null>(null);
  const lastDisplayRef = useRef<number>(0);
  const focusSecsRef   = useRef<number>(0);
  const streakSecsRef  = useRef<number>(0);
  const lastBlockRef   = useRef<number>(0);
  const coinsAccRef    = useRef<number>(0);
  const scoreRef       = useRef<number>(100);
  const lastRegenRef   = useRef<number>(0);

  const sessionStartRef    = useRef<number>(0);
  const focusTimelineRef   = useRef<TimelinePoint[]>([]);
  const eventTimelineRef   = useRef<EventPoint[]>([]);
  const timelineTickRef    = useRef<number>(0);

  const getTimelines = useCallback(() => ({
    focus:  [...focusTimelineRef.current],
    events: [...eventTimelineRef.current],
  }), []);

  const sus = useRef({ eyesClosed: 0, yawn: 0, headTilt: 0, phone: 0, noFace: 0, yaw: 0, gaze: 0 });
  const cal = useRef({
    noseBaseline: 0.57, tiltBaseline: 0,
    earBaseline: 0.28,  earThreshold: 0.20,
    done: false,
  });

  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  // ── event recorder ─────────────────────────────────────────────────────────
  const recordEvent = useCallback((type: string) => {
    countsRef.current[type] = (countsRef.current[type] ?? 0) + 1;
    streakSecsRef.current = 0;
    lastRegenRef.current  = 0;
    scoreRef.current = Math.max(0, scoreRef.current - (WEIGHTS[type] ?? 0));
    if (sessionStartRef.current > 0) {
      eventTimelineRef.current.push({
        elapsed: Math.round((Date.now() - sessionStartRef.current) / 1000),
        type,
      });
    }
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
      setKeyPoints(null);
      setMultiplier(1);
      setStreakSecs(0);
      countsRef.current = ZERO_COUNTS();
      sus.current = { eyesClosed: 0, yawn: 0, headTilt: 0, phone: 0, noFace: 0, yaw: 0, gaze: 0 };
      cal.current = { noseBaseline: 0.57, tiltBaseline: 0, earBaseline: 0.28, earThreshold: 0.20, done: false };
      focusSecsRef.current = 0;
      streakSecsRef.current = 0;
      lastBlockRef.current = 0;
      coinsAccRef.current = 0;
      scoreRef.current = 100;
      lastRegenRef.current = 0;
      focusTimelineRef.current = [];
      eventTimelineRef.current = [];
      timelineTickRef.current = 0;
      sessionStartRef.current = 0;
      setCoinsEarned(0);
      setNextCoinPct(0);
      setSecsToScoreRecovery(0);
      return;
    }

    let cancelled = false;
    const calNose: number[] = [], calTilt: number[] = [], calEar: number[] = [];
    const calDeadline = Date.now() + 3000;
    let lastMs = performance.now();
    sessionStartRef.current = Date.now();
    focusTimelineRef.current = [];
    eventTimelineRef.current = [];
    timelineTickRef.current = 0;

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

      intervalRef.current = setInterval(() => {
        if (cancelled || !landmarkerRef.current || !videoRef.current) return;
        const now = performance.now();
        const dt  = (now - lastMs) / 1000;
        lastMs = now;

        timelineTickRef.current += dt;
        if (timelineTickRef.current >= 10) {
          timelineTickRef.current = 0;
          focusTimelineRef.current.push({
            elapsed: Math.round((Date.now() - sessionStartRef.current) / 1000),
            score: Math.round(scoreRef.current),
          });
        }

        const res  = landmarkerRef.current.detectForVideo(videoRef.current, now);
        const lmks = res.faceLandmarks?.[0];

        if (!lmks) {
          sus.current.noFace += dt;
          if (sus.current.noFace >= T.NO_FACE_SECS && !disabledRef.current.has("no_face")) {
            recordEvent("eyes_off_screen");
            sus.current.noFace = 0;
            streakSecsRef.current = 0;
          }
          sus.current.eyesClosed = sus.current.yawn = sus.current.headTilt = 0;
          sus.current.phone = sus.current.yaw = sus.current.gaze = 0;

          if (now - lastDisplayRef.current > 300) {
            lastDisplayRef.current = now;
            setData(prev => ({ ...prev, face_detected: false }));
            setKeyPoints(null);
          }
          return;
        }

        sus.current.noFace = 0;
        focusSecsRef.current += dt;
        streakSecsRef.current += dt;

        const rEar   = ear(lmks, R_EYE_PTS);
        const lEar   = ear(lmks, L_EYE_PTS);
        const avgEar = (rEar + lEar) / 2;

        const mw  = d(lmks[MOUTH_L], lmks[MOUTH_R]);
        const mh  = d(lmks[LIP_TOP], lmks[LIP_BOT]);
        const mar = mw > 0.001 ? mh / mw : 0;

        const { roll, yaw, pitch, noseRel } = calculateHeadPose(lmks);
        const { gazeX, gazeY } = calculateGaze(lmks);

        // ── Auto-calibrate first 3s ────────────────────────────────────────
        if (!cal.current.done) {
          if (Date.now() < calDeadline) {
            calNose.push(noseRel);
            calTilt.push(roll);
            calEar.push(avgEar);
          } else if (calNose.length > 0) {
            const med = (arr: number[]) => {
              const s = [...arr].sort((a, b) => a - b);
              return s[Math.floor(s.length / 2)];
            };
            cal.current.noseBaseline = med(calNose);
            cal.current.tiltBaseline = med(calTilt);
            cal.current.earBaseline  = med(calEar);
            cal.current.earThreshold = cal.current.earBaseline * T.EAR_RATIO;
            cal.current.done = true;
          }
        }

        const tiltThresh  = Math.abs(cal.current.tiltBaseline) + T.TILT_DEG;
        const phoneThresh = cal.current.noseBaseline + T.PHONE_DELTA;
        const earThresh   = cal.current.earThreshold;

        // ── Sustained-event detection ──────────────────────────────────────
        const dis = disabledRef.current;

        // Eyes closed
        if (!dis.has("microsleep") && avgEar < earThresh) {
          sus.current.eyesClosed += dt;
          if (sus.current.eyesClosed >= T.EAR_SECS) { recordEvent("microsleep"); sus.current.eyesClosed = 0; }
        } else { sus.current.eyesClosed = 0; }

        // Yawn — cooldown prevents re-fire while mouth stays open
        if (!dis.has("yawn") && mar > T.MAR_YAWN) {
          sus.current.yawn += dt;
          if (sus.current.yawn >= T.MAR_SECS) { recordEvent("yawn"); sus.current.yawn = -T.YAWN_COOLDOWN; }
        } else if (dis.has("yawn") || mar <= T.MAR_YAWN) { sus.current.yawn = 0; }

        // Roll tilt (shoulder tilt)
        if (!dis.has("head_tilt") && Math.abs(roll - cal.current.tiltBaseline) > tiltThresh) {
          sus.current.headTilt += dt;
          if (sus.current.headTilt >= T.TILT_SECS) { recordEvent("head_tilt"); sus.current.headTilt = 0; }
        } else { sus.current.headTilt = 0; }

        // Phone check: nose ratio rises above baseline (head tilts down) OR pitch > threshold
        if (!dis.has("phone_check") && (noseRel > phoneThresh || pitch > T.PITCH_DOWN)) {
          sus.current.phone += dt;
          if (sus.current.phone >= T.PHONE_SECS) { recordEvent("phone_check"); sus.current.phone = 0; }
        } else { sus.current.phone = 0; }

        // Yaw: head turning too far sideways
        if (!dis.has("yaw") && Math.abs(yaw) > T.YAW_DEG) {
          sus.current.yaw += dt;
          if (sus.current.yaw >= T.YAW_SECS) { recordEvent("eyes_off_screen"); sus.current.yaw = 0; }
        } else { sus.current.yaw = 0; }

        // Gaze off-centre (iris deviation while head is mostly forward)
        if (!dis.has("gaze") && Math.abs(gazeX) > T.GAZE_X && Math.abs(yaw) < 15) {
          sus.current.gaze += dt;
          if (sus.current.gaze >= T.GAZE_SECS) { recordEvent("eyes_off_screen"); sus.current.gaze = 0; }
        } else { sus.current.gaze = 0; }

        // ── Continuous baseline adaptation ─────────────────────────────────
        const anyActive = Object.values(sus.current).some(v => v > 0);
        if (cal.current.done && !anyActive) {
          const R = 0.002;
          cal.current.earBaseline  = lerp(cal.current.earBaseline, avgEar, R);
          cal.current.earThreshold = cal.current.earBaseline * T.EAR_RATIO;
          cal.current.noseBaseline = lerp(cal.current.noseBaseline, noseRel, R);
          cal.current.tiltBaseline = lerp(cal.current.tiltBaseline, roll, R);
        }

        // ── Regen score: +1 pt per 60s clean streak ────────────────────────
        const regenBoundary = Math.floor(streakSecsRef.current / 60);
        if (regenBoundary > lastRegenRef.current) {
          scoreRef.current = Math.min(100, scoreRef.current + (regenBoundary - lastRegenRef.current));
          lastRegenRef.current = regenBoundary;
        }
        const rollingScore = scoreRef.current;

        // ── Streak & multiplier ────────────────────────────────────────────
        const streakS = Math.floor(streakSecsRef.current);
        const mult    = getMultiplier(streakS, rollingScore);

        // Coins: 1 block per 5 focused seconds × multiplier
        const blocks = Math.floor(focusSecsRef.current / 5);
        if (blocks > lastBlockRef.current) {
          const newBlocks = blocks - lastBlockRef.current;
          lastBlockRef.current = blocks;
          coinsAccRef.current += newBlocks * mult;
          setCoinsEarned(Math.round(coinsAccRef.current));
        }

        // ── Key points for canvas overlay ──────────────────────────────────
        setKeyPoints({
          leftEye:  L_EYE_PTS.map(i => [lmks[i].x, lmks[i].y] as [number, number]),
          rightEye: R_EYE_PTS.map(i => [lmks[i].x, lmks[i].y] as [number, number]),
          nose:     [lmks[NOSE_TIP].x, lmks[NOSE_TIP].y],
          tiltL:    [lmks[L_OUTER].x,  lmks[L_OUTER].y],
          tiltR:    [lmks[R_OUTER].x,  lmks[R_OUTER].y],
          lipTop:   [lmks[LIP_TOP].x,  lmks[LIP_TOP].y],
          lipBot:   [lmks[LIP_BOT].x,  lmks[LIP_BOT].y],
          mouthL:   [lmks[MOUTH_L].x,  lmks[MOUTH_L].y],
          mouthR:   [lmks[MOUTH_R].x,  lmks[MOUTH_R].y],
          leftIris:  lmks.length >= 478 ? [lmks[468].x, lmks[468].y] : undefined,
          rightIris: lmks.length >= 478 ? [lmks[473].x, lmks[473].y] : undefined,
        });

        // ── Throttled display update (300ms) ───────────────────────────────
        if (now - lastDisplayRef.current > 300) {
          lastDisplayRef.current = now;
          const topD = Object.entries(countsRef.current)
            .filter(([, v]) => v > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5) as [string, number][];
          setData({
            face_detected:   true,
            ear:             +avgEar.toFixed(3),
            mar:             +mar.toFixed(3),
            head_tilt:       +roll.toFixed(1),
            pitch:           +pitch.toFixed(1),
            yaw:             +yaw.toFixed(1),
            gaze_x:          +gazeX.toFixed(3),
            gaze_y:          +gazeY.toFixed(3),
            counts:          { ...countsRef.current },
            focus_score:     rollingScore,
            top_distractors: topD,
            blink_rate:      0,
          });
          setMultiplier(mult);
          setStreakSecs(streakS);

          // Coin progress gauge
          setNextCoinPct((focusSecsRef.current % 5) / 5);

          // Score recovery gauge — seconds until next +1 regen tick
          setSecsToScoreRecovery(
            scoreRef.current < 100 ? Math.max(1, 60 - Math.floor(streakSecsRef.current % 60)) : 0
          );
        }
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

  // ── Sync browser focus state → backend ────────────────────────────────────
  const focusSyncRef = useRef({ face_detected: false, focus_score: 100 });
  useEffect(() => {
    focusSyncRef.current = { face_detected: data.face_detected, focus_score: data.focus_score };
  }, [data.face_detected, data.focus_score]);

  useEffect(() => {
    if (!isActive || !sessionId) return;
    const iv = setInterval(() => {
      fetch(`${BASE_URL}/state/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, ...focusSyncRef.current }),
      }).catch(() => {});
    }, 2000);
    return () => clearInterval(iv);
  }, [isActive, sessionId]);

  // ── Persist eye_data snapshot to DB every 30s ──────────────────────────────
  const snapshotRef = useRef({ ear: 0.3, face_detected: false, head_tilt: 0, blink_rate: 0 });
  useEffect(() => {
    snapshotRef.current = {
      ear:           data.ear,
      face_detected: data.face_detected,
      head_tilt:     data.head_tilt,
      blink_rate:    data.blink_rate,
    };
  }, [data.ear, data.face_detected, data.head_tilt, data.blink_rate]);

  useEffect(() => {
    if (!isActive || !sessionId) return;
    const iv = setInterval(() => {
      const s = snapshotRef.current;
      saveSessionSnapshot({
        session_id:          sessionId,
        ear:                 s.ear,
        is_looking_at_screen: s.face_detected,
        head_tilt_degrees:   s.head_tilt,
        blink_rate_per_min:  s.blink_rate || undefined,
      }).catch(() => {});
    }, 30_000);
    return () => clearInterval(iv);
  }, [isActive, sessionId]);

  // Stop camera on tab/window close
  useEffect(() => {
    if (!isActive) return;
    const onUnload = () => streamRef.current?.getTracks().forEach(t => t.stop());
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [isActive]);

  // ── Tab-switch detection (specialized sessions only) ──────────────────────
  useEffect(() => {
    if (!isActive || sessionType !== "specialized") return;
    const onVisibility = () => { if (document.hidden) recordEvent("tab_switch"); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [isActive, sessionType, recordEvent]);

  return (
    <FocusContext.Provider value={{
      ...data, connected, cameraStream,
      coinsEarned, multiplier, streak_secs: streakSecs, keyPoints,
      nextCoinPct, secsToScoreRecovery, getTimelines,
    }}>
      {children}
    </FocusContext.Provider>
  );
}

export function useFocus() { return useContext(FocusContext); }
