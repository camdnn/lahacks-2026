import asyncio
import json
import threading
from pathlib import Path
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from database import database
from state import state
from routers import auth, sessions, eye_data, screen_data, events, calibrate
from cv.loop import run_cv_loop, stop_cv_loop, register_ws_client, unregister_ws_client
from monitor.screen_monitor import run_screen_monitor

app = FastAPI(title="Flicker to Flow API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(sessions.router)
app.include_router(eye_data.router)
app.include_router(screen_data.router)
app.include_router(events.router)
app.include_router(calibrate.router)


@app.on_event("startup")
async def startup():
    await database.connect()
    loop = asyncio.get_event_loop()
    t = threading.Thread(target=run_cv_loop, args=(loop,), daemon=True)
    t.start()
    t2 = threading.Thread(target=run_screen_monitor, args=(loop,), daemon=True)
    t2.start()


@app.on_event("shutdown")
async def shutdown():
    stop_cv_loop()
    await database.disconnect()


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/state")
async def get_state():
    return state.snapshot()


class FocusPush(BaseModel):
    face_detected: bool
    focus_score: float

@app.post("/state/push")
async def push_focus(body: FocusPush):
    state.push_browser_focus(body.face_detected, body.focus_score)
    return {"ok": True}


_DMG_PATH = Path(__file__).parent.parent / "overlay" / "dist" / "Pudge-1.0.0-arm64.dmg"

@app.get("/download/overlay")
async def download_overlay():
    if not _DMG_PATH.exists():
        raise HTTPException(status_code=404, detail="DMG not built yet — run `npm run dist` inside overlay/")
    return FileResponse(
        _DMG_PATH,
        media_type="application/octet-stream",
        filename="Pudge.dmg",
    )


@app.websocket("/ws/cv")
async def ws_cv(websocket: WebSocket):
    """
    Streams annotated camera frames (JPEG base64) + live metrics to the CV test page.
    Each message is JSON: { frame: "<base64>", metrics: { ... } }
    """
    await websocket.accept()
    q: asyncio.Queue = asyncio.Queue(maxsize=4)
    register_ws_client(q)
    try:
        while True:
            payload = await asyncio.wait_for(q.get(), timeout=30.0)
            await websocket.send_text(json.dumps(payload))
    except (WebSocketDisconnect, asyncio.TimeoutError, Exception):
        pass
    finally:
        unregister_ws_client(q)


@app.websocket("/ws/focus")
async def ws_focus(websocket: WebSocket):
    """
    Streams live focus state (no video) every second.
    Used by ActiveSession page to update mascot + score.
    """
    await websocket.accept()
    try:
        while True:
            await websocket.send_text(json.dumps(state.snapshot()))
            await asyncio.sleep(1.0)
    except (WebSocketDisconnect, Exception):
        pass
