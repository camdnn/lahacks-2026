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
        self._lock = threading.Lock()
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
            # Screen signal metrics (updated by screen_monitor)
            self.session_type: str = "general"
            self.allowed_tabs: list = []
            self.typing_speed_wpm: float = 0.0
            self.mistype_rate: float = 0.0
            self.active_tab: str | None = None
            self.is_idle: bool = False

    def start(self, session_id: str, *, session_type: str = "general", allowed_tabs: list | None = None):
        with self._lock:
            self.session_id = session_id
            self.is_active = True
            self.started_at = datetime.utcnow()
            self.counts = {k: 0 for k in DISTRACTOR_WEIGHTS}
            self.focus_score = 100.0
            self.session_type = session_type
            self.allowed_tabs = allowed_tabs or []
            self.typing_speed_wpm = 0.0
            self.mistype_rate = 0.0
            self.active_tab = None
            self.is_idle = False

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

    def update_cv(self, *, ear, mar, head_tilt, nose_ratio, face_detected, blink_rate=0.0):
        with self._lock:
            self.ear = ear
            self.mar = mar
            self.head_tilt = head_tilt
            self.nose_ratio = nose_ratio
            self.face_detected = face_detected
            self.blink_rate = blink_rate

    def update_screen(self, **kwargs):
        with self._lock:
            for key, val in kwargs.items():
                if hasattr(self, key):
                    setattr(self, key, val)

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
                # Screen signals
                "typing_speed_wpm": round(self.typing_speed_wpm, 2),
                "mistype_rate": round(self.mistype_rate, 4),
                "active_tab": self.active_tab,
                "is_idle": self.is_idle,
            }


state = SessionState()
