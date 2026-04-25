from fastapi import APIRouter
from pydantic import BaseModel
from datetime import datetime

from database import database
from state import state

router = APIRouter(prefix="/events", tags=["events"])


class EventBody(BaseModel):
    session_id: str
    event_type: str
    duration_ms: int | None = None
    metadata: dict | None = None


@router.post("/")
async def log_event(body: EventBody):
    await database.execute(
        """INSERT INTO focus_events (session_id, event_type, duration_ms, metadata)
           VALUES (:sid, :et, :dur, :meta)""",
        {"sid": body.session_id, "et": body.event_type,
         "dur": body.duration_ms, "meta": str(body.metadata) if body.metadata else None},
    )
    state.increment(body.event_type)
    return {"ok": True}


@router.get("/summary/{session_id}")
async def event_summary(session_id: str):
    rows = await database.fetch_all(
        "SELECT event_type, COUNT(*) as count FROM focus_events WHERE session_id=:sid GROUP BY event_type",
        {"sid": session_id},
    )
    return {"counts": {r["event_type"]: r["count"] for r in rows}, "focus_score": state.focus_score}
