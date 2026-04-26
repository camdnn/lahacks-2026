import threading
from datetime import datetime

DISTRACTOR_WEIGHTS = {
    "microsleep":      10,
    "phone_check":      5,
    "disallowed_tab":   4,
    "yawn":             3,
    "tab_switch":       2,
    "eyes_off_screen":  2,
    "rewind":           2,
    "head_tilt":        1,
}

class SessionState:
    def __init__(self):
        self._lock = threading.RLock()
        self.reset()

    def reset(self):
        with self._lock:
            self.session_id = None
            self.is_active = False
            self.started_at = None
            self.counts: dict[str, int] = {k: 0 for k in DISTRACTOR_WEIGHTS}
            self.focus_score: float = 100.0
            # Latest CV metrics (updated every frame)
            self.ear: float = 0.3
            self.mar: float = 0.1
            self.head_tilt: float = 0.0
            self.nose_ratio: float = 0.3
            self.face_detected: bool = False
            self.blink_count: int = 0
            self.blink_rate: float = 0.0
            # Focus time accumulator (seconds face was detected during session)
            self.focus_seconds: float = 0.0
            # Calibration
            self.is_calibrating: bool = False
            self.calibrated: bool = False
            self._cal_nose: list[float] = []
            self._cal_tilt: list[float] = []
            self.nose_baseline: float = 0.5
            self.tilt_baseline: float = 0.0

    def start(self, session_id: str):
        with self._lock:
            self.session_id = session_id
            self.is_active = True
            self.started_at = datetime.utcnow()
            self.counts = {k: 0 for k in DISTRACTOR_WEIGHTS}
            self.focus_score = 100.0

    def stop(self):
        with self._lock:
            self.is_active = False

    def increment(self, event_type: str):
        with self._lock:
            if event_type in self.counts:
                self.counts[event_type] += 1
            self._recalculate()

    def _recalculate(self):
        deducted = sum(
            self.counts[k] * DISTRACTOR_WEIGHTS[k]
            for k in self.counts
        )
        self.focus_score = max(0.0, 100.0 - deducted)

    def top_distractors(self, n: int = 5):
        with self._lock:
            ranked = sorted(
                ((k, v) for k, v in self.counts.items() if v > 0),
                key=lambda x: x[1] * DISTRACTOR_WEIGHTS[x[0]],
                reverse=True,
            )
            return ranked[:n]

    def start_calibration(self):
        with self._lock:
            self.is_calibrating = True
            self.calibrated = False
            self._cal_nose = []
            self._cal_tilt = []

    def add_calibration_frame(self, nose: float, tilt: float):
        with self._lock:
            if self.is_calibrating:
                self._cal_nose.append(nose)
                self._cal_tilt.append(tilt)

    def finish_calibration(self):
        import statistics
        with self._lock:
            if self._cal_nose:
                self.nose_baseline = statistics.median(self._cal_nose)
                self.tilt_baseline = statistics.median(self._cal_tilt)
            self.is_calibrating = False
            self.calibrated = True

    def add_focus_time(self, dt: float):
        with self._lock:
            self.focus_seconds += dt

    def push_browser_focus(self, face_detected: bool, focus_score: float):
        """Called by the browser's MediaPipe pipeline so the desktop overlay stays in sync."""
        with self._lock:
            self.face_detected = face_detected
            self.focus_score = max(0.0, min(100.0, focus_score))

    def update_cv(self, *, ear, mar, head_tilt, nose_ratio, face_detected, blink_rate=0.0):
        with self._lock:
            self.ear = ear
            self.mar = mar
            self.head_tilt = head_tilt
            self.nose_ratio = nose_ratio
            self.face_detected = face_detected
            self.blink_rate = blink_rate

    def snapshot(self) -> dict:
        with self._lock:
            return {
                "session_id": self.session_id,
                "is_active": self.is_active,
                "focus_score": round(self.focus_score, 2),
                "counts": dict(self.counts),
                "top_distractors": self.top_distractors(5),
                "ear": round(self.ear, 4),
                "mar": round(self.mar, 4),
                "head_tilt": round(self.head_tilt, 2),
                "nose_ratio": round(self.nose_ratio, 4),
                "face_detected": self.face_detected,
                "blink_rate": round(self.blink_rate, 2),
                "focus_seconds": round(self.focus_seconds, 1),
                "calibrated": self.calibrated,
                "is_calibrating": self.is_calibrating,
                "nose_baseline": round(self.nose_baseline, 4),
                "tilt_baseline": round(self.tilt_baseline, 2),
            }


state = SessionState()
