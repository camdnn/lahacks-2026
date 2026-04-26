import asyncio
import io
import json
import threading
import zipfile
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from database import database
from state import state
from routers import auth, sessions, eye_data, screen_data, events, calibrate
from cv.loop import run_cv_loop, stop_cv_loop, register_ws_client, unregister_ws_client

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


_OVERLAY_DIR = Path(__file__).parent.parent / "overlay"
_SKIP = {"node_modules", "dist", ".git", "__pycache__"}

@app.get("/download/overlay")
async def download_overlay():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(_OVERLAY_DIR.rglob("*")):
            if not path.is_file():
                continue
            if any(part in _SKIP for part in path.parts):
                continue
            zf.write(path, Path("pudge-overlay") / path.relative_to(_OVERLAY_DIR))
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="pudge-overlay.zip"'},
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
