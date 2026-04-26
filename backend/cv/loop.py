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

from cv.eye import avg_ear, mouth_aspect_ratio, head_tilt_degrees, nose_vertical_ratio, head_yaw_ratio
from cv.eye import LEFT_EAR_INDICES, RIGHT_EAR_INDICES
from cv.face import draw_eye_contour, draw_mouth_contour, draw_metrics_overlay, draw_event_badge
from state import state

# Thresholds
EAR_THRESHOLD   = 0.19   # below = microsleep (raised so partial closes count, not just fully shut)
MAR_THRESHOLD   = 0.65   # above = yawn
TILT_THRESHOLD  = 8.0    # degrees — noticeable but not exaggerated shoulder-tilt
NOSE_THRESHOLD  = 0.46   # above = phone check — strict, slight head-down triggers it
YAW_THRESHOLD   = 0.12   # abs deviation from 0.5 — moderate turn catches gaze-away without needing full head rotation
EAR_CONSEC_FRAMES = 3    # ~100ms at 30fps — catches quick closes without needing eyes fully shut
YAW_CONSEC_FRAMES = 3    # ~100ms — catches a quick sideways glance

BLINK_EAR_THRESHOLD = 0.22  # for counting blinks (higher than microsleep)

mp_face_mesh = mp.solutions.face_mesh

# Shared set of WebSocket queues for CV test clients
_ws_clients: set[asyncio.Queue] = set()
_ws_lock = threading.Lock()
_stop_event = threading.Event()


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


def stop_cv_loop():
    _stop_event.set()


def run_cv_loop(event_loop: asyncio.AbstractEventLoop):
    """Main CV loop — call in a daemon thread."""
    _stop_event.clear()
    cap = None

    ear_consec = 0
    yaw_consec = 0
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

    last_frame_time = time.time()
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

        while not _stop_event.is_set():
            if not state.is_active:
                if cap is not None:
                    cap.release()
                    cap = None
                    state.update_cv(ear=0.3, mar=0.1, head_tilt=0.0,
                                    nose_ratio=0.5, face_detected=False, blink_rate=0.0)
                time.sleep(0.1)
                continue

            if cap is None:
                cap = cv2.VideoCapture(1)
                if not cap.isOpened():
                    print("[CV] No webcam found — waiting for session to end.")
                    cap = None
                    time.sleep(0.5)
                    continue
                cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

            ret, frame = cap.read()
            if not ret:
                time.sleep(0.05)
                continue

            now_frame = time.time()
            frame_dt = now_frame - last_frame_time
            last_frame_time = now_frame

            h, w = frame.shape[:2]
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = face_mesh.process(rgb)

            now = time.time()
            face_detected = results.multi_face_landmarks is not None

            ear = 0.3
            mar = 0.1
            tilt = 0.0
            nose = 0.5

            # Dynamic thresholds — use calibrated baseline if available
            nose_thresh = (state.nose_baseline + 0.03) if state.calibrated else NOSE_THRESHOLD
            tilt_thresh = (abs(state.tilt_baseline) + 5.0) if state.calibrated else TILT_THRESHOLD

            with _ws_lock:
                has_clients = bool(_ws_clients)

            if face_detected:
                lm = results.multi_face_landmarks[0].landmark

                ear = avg_ear(lm)
                mar = mouth_aspect_ratio(lm)
                tilt = head_tilt_degrees(lm)
                nose = nose_vertical_ratio(lm)
                yaw = head_yaw_ratio(lm)

                # Feed calibration if running
                if state.is_calibrating:
                    state.add_calibration_frame(nose, tilt)

                # Draw contours only when a CV-test client is watching
                if has_clients:
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
                    microsleep_cooldown = now + 3.0

                # ── Yawn ──
                if mar > MAR_THRESHOLD and yawn_cooldown < now:
                    if state.is_active:
                        state.increment("yawn")
                    last_event = "yawn"
                    event_display_until = now + 2.0
                    yawn_cooldown = now + 2.5

                # ── Head tilt ──
                if abs(tilt - state.tilt_baseline) > tilt_thresh and tilt_cooldown < now:
                    if state.is_active:
                        state.increment("head_tilt")
                    last_event = "head_tilt"
                    event_display_until = now + 1.5
                    tilt_cooldown = now + 1.0

                # ── Phone check ──
                if nose > nose_thresh and phone_cooldown < now:
                    if state.is_active:
                        state.increment("phone_check")
                    last_event = "phone_check"
                    event_display_until = now + 2.0
                    phone_cooldown = now + 2.0

                # ── Looking sideways (yaw) ──
                if abs(yaw - 0.5) > YAW_THRESHOLD:
                    yaw_consec += 1
                else:
                    yaw_consec = 0
                if yaw_consec >= YAW_CONSEC_FRAMES and eyes_off_cooldown < now:
                    if state.is_active:
                        state.increment("eyes_off_screen")
                    last_event = "eyes_off_screen"
                    event_display_until = now + 1.5
                    eyes_off_cooldown = now + 1.5
                    yaw_consec = 0

            else:
                blink_rate = 0.0
                ear_consec = 0
                yaw_consec = 0

                if eyes_off_cooldown < now:
                    if state.is_active:
                        state.increment("eyes_off_screen")
                    last_event = "eyes_off_screen"
                    event_display_until = now + 1.5
                    eyes_off_cooldown = now + 1.5

            # Accumulate focus time when face is visible
            if face_detected and state.is_active:
                state.add_focus_time(frame_dt)

            # Update shared state
            state.update_cv(
                ear=ear,
                mar=mar,
                head_tilt=tilt,
                nose_ratio=nose,
                face_detected=face_detected,
                blink_rate=blink_rate if face_detected else 0.0,
            )

            # Skip all expensive draw + encode work when nobody is watching
            if has_clients:
                metrics = state.snapshot()
                draw_metrics_overlay(frame, {**metrics, "blink_rate": blink_rate if face_detected else 0.0})
                if last_event and now < event_display_until:
                    draw_event_badge(frame, last_event)
                _broadcast_frame(event_loop, frame, metrics)

            # Snapshot to DB every 10s (if session active) — handled by routers
            # using state.snapshot(); no direct DB call here to keep loop clean.

            time.sleep(0.033)  # ~30fps cap

    if cap is not None:
        cap.release()
