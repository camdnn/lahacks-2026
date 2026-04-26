from fastapi import APIRouter
from pydantic import BaseModel
from database import database
from state import state

router = APIRouter(prefix="/eye-data", tags=["eye-data"])


class EyeDataBody(BaseModel):
    session_id: str
    eyelid_openness: float | None = None
    blink_rate_per_min: float | None = None
    avg_blink_duration_ms: int | None = None
    is_looking_at_screen: bool | None = None
    head_tilt_degrees: float | None = None


class EyeDataBatchBody(BaseModel):
    records: list[EyeDataBody]


_INSERT_SQL = """INSERT INTO eye_data
   (session_id, eyelid_openness, blink_rate_per_min, avg_blink_duration_ms, is_looking_at_screen, head_tilt_degrees)
   VALUES (:sid, :eo, :br, :bd, :ls, :ht)"""


def _params(r: EyeDataBody) -> dict:
    return {
        "sid": r.session_id,
        "eo": r.eyelid_openness,
        "br": r.blink_rate_per_min,
        "bd": r.avg_blink_duration_ms,
        "ls": r.is_looking_at_screen,
        "ht": r.head_tilt_degrees,
    }


@router.post("/")
async def log_eye_data(body: EyeDataBody):
    await database.execute(_INSERT_SQL, _params(body))
    return {"ok": True}


@router.post("/batch")
async def log_eye_data_batch(body: EyeDataBatchBody):
    for record in body.records:
        await database.execute(_INSERT_SQL, _params(record))
    return {"ok": True, "count": len(body.records)}


@router.get("/live")
async def live_eye_data():
    snap = state.snapshot()
    return {
        "ear": snap["ear"],
        "mar": snap["mar"],
        "head_tilt": snap["head_tilt"],
        "nose_ratio": snap["nose_ratio"],
        "face_detected": snap["face_detected"],
        "blink_rate": snap["blink_rate"],
    }
