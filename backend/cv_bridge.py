"""
Bloom CV bridge — Python's only job is data collection.

Runs the MediaPipe face-detection loop and periodically pushes raw CV
metrics to the Express backend at POST /cv/push.  No HTTP routes here.

Usage:
    EXPRESS_URL=https://your-app.railway.app python cv_bridge.py

Set EXPRESS_URL to the hosted backend URL (default: http://127.0.0.1:3000).
The bridge reads the active session_id from Python state and includes it
in every push so the cloud server can route metrics to the right session.
"""
import asyncio
import threading
import time
import urllib.request
import json
import os

from dotenv import load_dotenv
from cv.loop import run_cv_loop, stop_cv_loop
from state import state  # Python in-memory state (updated by cv/loop.py)

load_dotenv()

EXPRESS_URL      = os.getenv("EXPRESS_URL", "http://127.0.0.1:3000")
PUSH_INTERVAL_S  = 1.0


def push_cv_metrics(metrics: dict) -> None:
    """POST raw CV sensor metrics to Express (fire-and-forget)."""
    try:
        data = json.dumps(metrics).encode("utf-8")
        req = urllib.request.Request(
            f"{EXPRESS_URL}/cv/push",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=0.5):
            pass
    except Exception:
        pass  # server may not be running yet — silently skip


def _pusher_loop(stop_event: threading.Event) -> None:
    """Background thread: reads Python state snapshot and POSTs to Express."""
    while not stop_event.is_set():
        snap = state.snapshot()
        metrics = {
            "ear":           snap["ear"],
            "mar":           snap["mar"],
            "head_tilt":     snap["head_tilt"],
            "nose_ratio":    snap["nose_ratio"],
            "face_detected": snap["face_detected"],
            "blink_rate":    snap["blink_rate"],
        }
        # Include session_id so the cloud server routes to the right session
        if snap.get("session_id"):
            metrics["session_id"] = snap["session_id"]
        push_cv_metrics(metrics)
        time.sleep(PUSH_INTERVAL_S)


def main() -> None:
    loop      = asyncio.new_event_loop()
    stop_flag = threading.Event()

    cv_thread = threading.Thread(
        target=run_cv_loop,
        args=(loop,),
        daemon=True,
    )
    cv_thread.start()

    push_thread = threading.Thread(
        target=_pusher_loop,
        args=(stop_flag,),
        daemon=True,
    )
    push_thread.start()

    print(f"[CV Bridge] MediaPipe running. Pushing metrics to {EXPRESS_URL}.")
    print("            Press Ctrl-C to stop.")

    try:
        loop.run_forever()
    except KeyboardInterrupt:
        print("\n[CV Bridge] Shutting down.")
        stop_flag.set()
        stop_cv_loop()
        loop.close()


if __name__ == "__main__":
    main()
