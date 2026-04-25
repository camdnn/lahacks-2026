from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from datetime import datetime, date
from jose import jwt, JWTError
import os

from database import database
from state import state, DISTRACTOR_WEIGHTS

router = APIRouter(prefix="/sessions", tags=["sessions"])
SECRET    = os.getenv("JWT_SECRET", "dev-secret-change-me")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

TIPS = {
    "microsleep":     "Take a 5-minute break every 25 minutes and ensure you're getting enough sleep.",
    "phone_check":    "Put your phone face-down or in another room during focus sessions.",
    "disallowed_tab": "Use a site blocker extension to prevent tab temptation.",
    "yawn":           "Stay hydrated and consider a quick walk to boost alertness.",
    "tab_switch":     "Group all your research before starting — minimize context switching.",
    "eyes_off_screen":"Position your monitor at eye level to reduce neck strain.",
    "rewind":         "Try active note-taking instead of rewatching — it improves retention.",
    "head_tilt":      "Adjust your monitor height so you look slightly downward.",
}


def _decode_token(authorization: str = Header(...)):
    try:
        scheme, token = authorization.split()
        payload = jwt.decode(token, SECRET, algorithms=[ALGORITHM])
        return payload["sub"]
    except (JWTError, Exception):
        raise HTTPException(401, "Invalid token")


class StartBody(BaseModel):
    session_type: str = "general"
    focus_duration_mins: int | None = None
    allowed_tabs: list[str] = []


@router.post("/start")
async def start_session(body: StartBody, user_id: str = Depends(_decode_token)):
    row = await database.fetch_one(
        """INSERT INTO sessions (user_id, session_type, focus_duration_mins, allowed_tabs)
           VALUES (:uid, :st, :dur, :tabs)
           RETURNING session_id, started_at""",
        {"uid": user_id, "st": body.session_type, "dur": body.focus_duration_mins,
         "tabs": body.allowed_tabs},
    )
    sid = str(row["session_id"])
    state.start(sid, session_type=body.session_type, allowed_tabs=body.allowed_tabs)
    return {"session_id": sid, "started_at": row["started_at"]}


@router.post("/end/{session_id}")
async def end_session(session_id: str, user_id: str = Depends(_decode_token)):
    session = await database.fetch_one(
        "SELECT * FROM sessions WHERE session_id = :sid AND user_id = :uid",
        {"sid": session_id, "uid": user_id},
    )
    if not session:
        raise HTTPException(404, "Session not found")

    snap = state.snapshot()
    state.stop()

    now = datetime.utcnow()
    started = session["started_at"]
    duration_mins = max(1, int((now - started.replace(tzinfo=None)).total_seconds() / 60))

    focus_score = snap["focus_score"]

    base = focus_score * 0.5
    duration_bonus = min(30, duration_mins / 2)
    excellence_bonus = 20 if focus_score >= 90 else 0
    coins = int(base + duration_bonus + excellence_bonus)

    top_d = snap["top_distractors"]
    top_distractors = [{"type": k, "count": v, "impact": v * DISTRACTOR_WEIGHTS.get(k, 1)} for k, v in top_d]
    improvement_tips = {k: TIPS.get(k, "") for k, _ in top_d[:5]}

    await database.execute(
        """UPDATE sessions SET ended_at=:now, focus_duration_mins=:dur, focus_score=:fs,
           coins_earned=:coins, top_distractors=:td, improvement_tips=:tips
           WHERE session_id=:sid""",
        {"now": now, "dur": duration_mins, "fs": focus_score, "coins": coins,
         "td": str(top_distractors), "tips": str(improvement_tips), "sid": session_id},
    )
    await database.execute(
        "UPDATE users SET coin_balance = coin_balance + :c WHERE user_id = :uid",
        {"c": coins, "uid": user_id},
    )

    # Streak update
    today = date.today()
    streak_row = await database.fetch_one("SELECT * FROM streaks WHERE user_id = :uid", {"uid": user_id})
    if streak_row:
        last = streak_row["last_session_date"]
        cur = streak_row["current_streak"]
        longest = streak_row["longest_streak"]
        if last and (today - last).days == 1:
            cur += 1
        elif not last or (today - last).days > 1:
            cur = 1
        longest = max(longest, cur)
        await database.execute(
            """UPDATE streaks SET current_streak=:c, longest_streak=:l, last_session_date=:d
               WHERE user_id=:uid""",
            {"c": cur, "l": longest, "d": today, "uid": user_id},
        )

    user = await database.fetch_one("SELECT coin_balance FROM users WHERE user_id = :uid", {"uid": user_id})

    return {
        "session_id": session_id,
        "duration_mins": duration_mins,
        "focus_score": focus_score,
        "coins_earned": coins,
        "coin_balance": user["coin_balance"],
        "top_distractors": top_distractors,
        "improvement_tips": improvement_tips,
        "event_counts": snap["counts"],
    }
