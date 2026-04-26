from fastapi import APIRouter
from pydantic import BaseModel
from database import database

router = APIRouter(prefix="/screen-data", tags=["screen-data"])


class ScreenDataBody(BaseModel):
    session_id: str
    typing_speed_wpm: float | None = None
    mistype_rate: float | None = None
    scroll_velocity: float | None = None
    active_tab_url: str | None = None


class ScreenDataBatchBody(BaseModel):
    records: list[ScreenDataBody]


_INSERT_SQL = """INSERT INTO screen_data
   (session_id, typing_speed_wpm, mistype_rate, scroll_velocity, active_tab_url)
   VALUES (:sid, :wpm, :mr, :sv, :url)"""


def _params(r: ScreenDataBody) -> dict:
    return {
        "sid": r.session_id,
        "wpm": r.typing_speed_wpm,
        "mr": r.mistype_rate,
        "sv": r.scroll_velocity,
        "url": r.active_tab_url,
    }


@router.post("/")
async def log_screen_data(body: ScreenDataBody):
    await database.execute(_INSERT_SQL, _params(body))
    return {"ok": True}


@router.post("/batch")
async def log_screen_data_batch(body: ScreenDataBatchBody):
    for record in body.records:
        await database.execute(_INSERT_SQL, _params(record))
    return {"ok": True, "count": len(body.records)}
