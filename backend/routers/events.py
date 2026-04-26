import json
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


class EventBatchBody(BaseModel):
    records: list[EventBody]


@router.post("/")
async def log_event(body: EventBody):
    await database.execute(
        """INSERT INTO focus_events (session_id, event_type, duration_ms, metadata)
           VALUES (:sid, :et, :dur, :meta)""",
        {
            "sid": body.session_id,
            "et": body.event_type,
            "dur": body.duration_ms,
            "meta": json.dumps(body.metadata) if body.metadata else None,
        },
    )
    state.increment(body.event_type)
    return {"ok": True}


@router.post("/batch")
async def log_event_batch(body: EventBatchBody):
    for record in body.records:
        await database.execute(
            """INSERT INTO focus_events (session_id, event_type, duration_ms, metadata)
               VALUES (:sid, :et, :dur, :meta)""",
            {
                "sid": record.session_id,
                "et": record.event_type,
                "dur": record.duration_ms,
                "meta": json.dumps(record.metadata) if record.metadata else None,
            },
        )
        state.increment(record.event_type)
    return {"ok": True, "count": len(body.records)}


@router.get("/summary/{session_id}")
async def event_summary(session_id: str):
    rows = await database.fetch_all(
        "SELECT event_type, COUNT(*) as count FROM focus_events WHERE session_id=:sid GROUP BY event_type",
        {"sid": session_id},
    )
    return {"counts": {r["event_type"]: r["count"] for r in rows}, "focus_score": state.focus_score}
