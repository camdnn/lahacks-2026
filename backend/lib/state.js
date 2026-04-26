// In-memory session state — single instance shared across all routes.
// Updated by:
//   • Browser MediaPipe  →  POST /state/push  { face_detected, focus_score }
//   • Python CV bridge   →  POST /cv/push     { ear, mar, head_tilt, … }
//   • Event logging      →  POST /events      (recordEvent increments counts)

export const WEIGHTS = {
  microsleep:      10,
  phone_check:      5,
  yawn:             3,
  tab_switch:       2,
  eyes_off_screen:  2,
  head_tilt:        1,
};

export const TIPS = {
  microsleep:      "Take a 5-minute break every 25 minutes and ensure you're getting enough sleep.",
  phone_check:     "Put your phone face-down or in another room during focus sessions.",
  yawn:            "Stay hydrated and consider a quick walk to boost alertness.",
  tab_switch:      "Group all your research before starting — minimize context switching.",
  eyes_off_screen: "Position your monitor at eye level to reduce neck strain.",
  head_tilt:       "Adjust your monitor height so you look slightly downward.",
};

class SessionState {
  constructor() { this.reset(); }

  reset() {
    this.sessionId    = null;
    this.isActive     = false;
    this.startedAt    = null;
    this.counts       = Object.fromEntries(Object.keys(WEIGHTS).map(k => [k, 0]));
    this.focusScore   = 100;
    this.focusSeconds = 0;
    // Raw CV metrics (populated by Python bridge)
    this.ear          = 0.3;
    this.mar          = 0.1;
    this.headTilt     = 0;
    this.noseRatio    = 0.3;
    this.faceDetected = false;
    this.blinkRate    = 0;
    // Session config
    this.sessionType  = 'general';
    this.allowedTabs  = [];
    // Internal timing for focus-seconds accumulation
    this._lastPushMs  = null;
  }

  start(sessionId, { session_type = 'general', allowed_tabs = [] } = {}) {
    this.reset();
    this.sessionId   = sessionId;
    this.isActive    = true;
    this.startedAt   = new Date();
    this.sessionType = session_type;
    this.allowedTabs = allowed_tabs;
    this._lastPushMs = Date.now();
  }

  stop() { this.isActive = false; }

  // Called by POST /events — increments count and lowers score
  recordEvent(type) {
    if (type in this.counts) this.counts[type]++;
    this._recalculate();
  }

  _recalculate() {
    const deducted = Object.entries(this.counts)
      .reduce((sum, [k, v]) => sum + v * (WEIGHTS[k] ?? 0), 0);
    this.focusScore = Math.max(0, 100 - deducted);
  }

  topDistractors(n = 5) {
    return Object.entries(this.counts)
      .filter(([, v]) => v > 0)
      .sort((a, b) =>
        b[1] * (WEIGHTS[b[0]] ?? 0) - a[1] * (WEIGHTS[a[0]] ?? 0)
      )
      .slice(0, n);
  }

  // Called by POST /state/push (browser MediaPipe every 2 s)
  // Accumulates focus_seconds while face is detected and session is active
  pushBrowserFocus(faceDetected, focusScore) {
    const now = Date.now();
    if (this.isActive && this._lastPushMs !== null) {
      const dt = Math.min((now - this._lastPushMs) / 1000, 5); // cap at 5 s gap
      if (faceDetected) this.focusSeconds += dt;
    }
    this._lastPushMs  = now;
    this.faceDetected = Boolean(faceDetected);
    this.focusScore   = Math.max(0, Math.min(100, Number(focusScore)));
  }

  // Called by POST /cv/push (Python bridge every ~1 s)
  updateCV({ ear, mar, head_tilt, nose_ratio, face_detected, blink_rate } = {}) {
    if (ear          !== undefined) this.ear          = Number(ear);
    if (mar          !== undefined) this.mar          = Number(mar);
    if (head_tilt    !== undefined) this.headTilt     = Number(head_tilt);
    if (nose_ratio   !== undefined) this.noseRatio    = Number(nose_ratio);
    if (face_detected !== undefined) this.faceDetected = Boolean(face_detected);
    if (blink_rate   !== undefined) this.blinkRate    = Number(blink_rate);
  }

  snapshot() {
    return {
      session_id:      this.sessionId,
      is_active:       this.isActive,
      focus_score:     Math.round(this.focusScore * 100) / 100,
      counts:          { ...this.counts },
      top_distractors: this.topDistractors(5),
      ear:             this.ear,
      mar:             this.mar,
      head_tilt:       this.headTilt,
      nose_ratio:      this.noseRatio,
      face_detected:   this.faceDetected,
      blink_rate:      this.blinkRate,
      focus_seconds:   Math.round(this.focusSeconds * 10) / 10,
    };
  }
}

export const state = new SessionState();
