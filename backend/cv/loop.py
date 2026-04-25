"""
CV loop: webcam → MediaPipe → event detection → state updates.
Runs in a background thread started by main.py.
Also broadcasts annotated JPEG frames to connected WebSocket clients.
"""
import asyncio
import base64
import time
import threading
import cv2
import mediapipe as mp
import numpy as np

from cv.eye import avg_ear, mouth_aspect_ratio, head_tilt_degrees, nose_vertical_ratio
from cv.eye import LEFT_EAR_INDICES, RIGHT_EAR_INDICES
from cv.face import draw_eye_contour, draw_mouth_contour, draw_metrics_overlay, draw_event_badge
from state import state

# Thresholds (from PDF spec)
EAR_THRESHOLD   = 0.15   # below = microsleep
MAR_THRESHOLD   = 0.60   # above = yawn
TILT_THRESHOLD  = 20.0   # degrees
NOSE_THRESHOLD  = 0.55   # above = phone check
EAR_CONSEC_FRAMES = 2    # consecutive frames for microsleep

BLINK_EAR_THRESHOLD = 0.22  # for counting blinks (higher than microsleep)

mp_face_mesh = mp.solutions.face_mesh

# Shared set of WebSocket queues for CV test clients
_ws_clients: set[asyncio.Queue] = set()
_ws_lock = threading.Lock()


def register_ws_client(q: asyncio.Queue):
    with _ws_lock:
        _ws_clients.add(q)


def unregister_ws_client(q: asyncio.Queue):
    with _ws_lock:
        _ws_clients.discard(q)


def _broadcast_frame(loop: asyncio.AbstractEventLoop, frame: np.ndarray, metrics: dict):
    """Encode frame as JPEG base64 and push to all connected WS clients."""
    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
    b64 = base64.b64encode(buf).decode()
    payload = {"frame": b64, "metrics": metrics}
    with _ws_lock:
        for q in list(_ws_clients):
            try:
                loop.call_soon_threadsafe(q.put_nowait, payload)
            except Exception:
                pass


def run_cv_loop(event_loop: asyncio.AbstractEventLoop):
    """Main CV loop — call in a daemon thread."""
    cap = cv2.VideoCapture(1)
    if not cap.isOpened():
        print("[CV] No webcam found — CV loop not running.")
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    ear_consec = 0
    blink_consec = 0
    in_blink = False
    blink_count = 0
    yawn_cooldown = 0
    phone_cooldown = 0
    tilt_cooldown = 0
    eyes_off_cooldown = 0
    microsleep_cooldown = 0
    last_event: str | None = None
    event_display_until = 0.0

    blink_window_start = time.time()
    blinks_in_window = 0

    snapshot_timer = time.time()
    SNAPSHOT_INTERVAL = 10

    # 10 second rolling blink rate window
    BLINK_WINDOW = 60.0

    with mp_face_mesh.FaceMesh(
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    ) as face_mesh:

        while True:
            ret, frame = cap.read()
            if not ret:
                time.sleep(0.05)
                continue

            h, w = frame.shape[:2]
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = face_mesh.process(rgb)

            now = time.time()
            face_detected = results.multi_face_landmarks is not None

            ear = 0.3
            mar = 0.1
            tilt = 0.0
            nose = 0.5

            if face_detected:
                lm = results.multi_face_landmarks[0].landmark

                ear = avg_ear(lm)
                mar = mouth_aspect_ratio(lm)
                tilt = head_tilt_degrees(lm)
                nose = nose_vertical_ratio(lm)

                # Draw contours
                draw_eye_contour(frame, lm, LEFT_EAR_INDICES, h, w)
                draw_eye_contour(frame, lm, RIGHT_EAR_INDICES, h, w)
                draw_mouth_contour(frame, lm, h, w)

                # ── Blink counting ──
                if ear < BLINK_EAR_THRESHOLD:
                    blink_consec += 1
                    in_blink = True
                else:
                    if in_blink and blink_consec >= 1:
                        blinks_in_window += 1
                    blink_consec = 0
                    in_blink = False

                blink_window_elapsed = now - blink_window_start
                if blink_window_elapsed >= BLINK_WINDOW:
                    blink_rate = (blinks_in_window / blink_window_elapsed) * 60
                    blinks_in_window = 0
                    blink_window_start = now
                else:
                    blink_rate = (blinks_in_window / max(blink_window_elapsed, 1)) * 60

                # ── Microsleep ──
                if ear < EAR_THRESHOLD:
                    ear_consec += 1
                else:
                    ear_consec = 0

                if ear_consec >= EAR_CONSEC_FRAMES and microsleep_cooldown < now:
                    if state.is_active:
                        state.increment("microsleep")
                    last_event = "microsleep"
                    event_display_until = now + 2.0
                    microsleep_cooldown = now + 5.0

                # ── Yawn ──
                if mar > MAR_THRESHOLD and yawn_cooldown < now:
                    if state.is_active:
                        state.increment("yawn")
                    last_event = "yawn"
                    event_display_until = now + 2.0
                    yawn_cooldown = now + 4.0

                # ── Head tilt ──
                if abs(tilt) > TILT_THRESHOLD and tilt_cooldown < now:
                    if state.is_active:
                        state.increment("head_tilt")
                    last_event = "head_tilt"
                    event_display_until = now + 1.5
                    tilt_cooldown = now + 3.0

                # ── Phone check ──
                if nose > NOSE_THRESHOLD and phone_cooldown < now:
                    if state.is_active:
                        state.increment("phone_check")
                    last_event = "phone_check"
                    event_display_until = now + 2.0
                    phone_cooldown = now + 5.0

            else:
                blink_rate = 0.0
                ear_consec = 0

                if eyes_off_cooldown < now:
                    if state.is_active:
                        state.increment("eyes_off_screen")
                    last_event = "eyes_off_screen"
                    event_display_until = now + 1.5
                    eyes_off_cooldown = now + 5.0

            # Update shared state
            state.update_cv(
                ear=ear,
                mar=mar,
                head_tilt=tilt,
                nose_ratio=nose,
                face_detected=face_detected,
                blink_rate=blink_rate if face_detected else 0.0,
            )

            metrics = state.snapshot()

            # ── Draw overlays ──
            draw_metrics_overlay(frame, {**metrics, "blink_rate": blink_rate if face_detected else 0.0})

            if last_event and now < event_display_until:
                draw_event_badge(frame, last_event)

            # Broadcast to WebSocket clients
            _broadcast_frame(event_loop, frame, metrics)

            # Snapshot to DB every 10s (if session active) — handled by routers
            # using state.snapshot(); no direct DB call here to keep loop clean.

            time.sleep(0.033)  # ~30fps cap

    cap.release()
