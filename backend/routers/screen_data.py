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


@router.post("/")
async def log_screen_data(body: ScreenDataBody):
    await database.execute(
        """INSERT INTO screen_data
           (session_id, typing_speed_wpm, mistype_rate, scroll_velocity, active_tab_url)
           VALUES (:sid, :wpm, :mr, :sv, :url)""",
        {"sid": body.session_id, "wpm": body.typing_speed_wpm, "mr": body.mistype_rate,
         "sv": body.scroll_velocity, "url": body.active_tab_url},
    )
    return {"ok": True}
