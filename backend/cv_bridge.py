"""
Bloom CV bridge — Python's only job is data collection.

Runs the MediaPipe face-detection loop and periodically pushes raw CV
metrics to the Express backend at POST /cv/push.  No HTTP routes here.

Usage:
    python cv_bridge.py

Keep this running alongside `npm start` in the backend/ directory.
"""
import asyncio
import threading
import time
import urllib.request
import json

from cv.loop import run_cv_loop, stop_cv_loop
from state import state  # Python in-memory state (updated by cv/loop.py)

EXPRESS_URL = "http://127.0.0.1:3000"
PUSH_INTERVAL_S = 1.0  # how often to sync raw metrics to Express


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
        with urllib.request.urlopen(req, timeout=0.5) as response:
            pass
    except Exception:
        pass  # Express may not be running yet — silently skip


def _pusher_loop(stop_event: threading.Event) -> None:
    """Background thread: reads Python state snapshot and POSTs to Express."""
    while not stop_event.is_set():
        snap = state.snapshot()
        push_cv_metrics({
            "ear":          snap["ear"],
            "mar":          snap["mar"],
            "head_tilt":    snap["head_tilt"],
            "nose_ratio":   snap["nose_ratio"],
            "face_detected": snap["face_detected"],
            "blink_rate":   snap["blink_rate"],
        })
        time.sleep(PUSH_INTERVAL_S)


def main() -> None:
    loop      = asyncio.new_event_loop()
    stop_flag = threading.Event()

    # Start MediaPipe CV loop (reads from webcam, updates Python state)
    cv_thread = threading.Thread(
        target=run_cv_loop,
        args=(loop,),
        daemon=True,
    )
    cv_thread.start()

    # Start periodic pusher (syncs Python state → Express)
    push_thread = threading.Thread(
        target=_pusher_loop,
        args=(stop_flag,),
        daemon=True,
    )
    push_thread.start()

    print("[CV Bridge] MediaPipe running. Pushing metrics to Express on :3000.")
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
