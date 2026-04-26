import json
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from datetime import datetime
from jose import jwt, JWTError
import os

from database import database
from state import state, DISTRACTOR_WEIGHTS

router = APIRouter(prefix="/sessions", tags=["sessions"])
SECRET    = os.getenv("JWT_SECRET", "dev-secret-change-me")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

TIPS = {
    "microsleep":      "Take a 5-minute break every 25 minutes and ensure you're getting enough sleep.",
    "phone_check":     "Put your phone face-down or in another room during focus sessions.",
    "disallowed_tab":  "Use a site blocker extension to prevent tab temptation.",
    "yawn":            "Stay hydrated and consider a quick walk to boost alertness.",
    "tab_switch":      "Group all your research before starting — minimize context switching.",
    "eyes_off_screen": "Position your monitor at eye level to reduce neck strain.",
    "rewind":          "Try active note-taking instead of rewatching — it improves retention.",
    "head_tilt":       "Adjust your monitor height so you look slightly downward.",
}

DISTRACTION_TYPES = list(DISTRACTOR_WEIGHTS.keys())


def _decode_token(authorization: str = Header(...)):
    try:
        scheme, token = authorization.split()
        payload = jwt.decode(token, SECRET, algorithms=[ALGORITHM])
        return payload["sub"]
    except (JWTError, Exception):
        raise HTTPException(401, "Invalid token")


async def _compute_peak_focus(
    session_id: str,
    started_at: datetime,
    ended_at: datetime,
) -> tuple[datetime, datetime]:
    """
    Find the best sustained focus window from eye_data snapshots.
    Score per row: is_looking_at_screen * 0.6 + clamp(eyelid_openness / 0.3, 0, 1) * 0.4
    Uses a sliding window of up to 30 records (~5 min at 10s intervals).
    Falls back to the full session window if fewer than 2 rows exist.
    """
    rows = await database.fetch_all(
        "SELECT recorded_at, eyelid_openness, is_looking_at_screen "
        "FROM eye_data WHERE session_id = :sid ORDER BY recorded_at ASC",
        {"sid": session_id},
    )
    if len(rows) < 2:
        return started_at, ended_at

    window = min(30, len(rows))
    best_score, best_i = -1.0, 0

    for i in range(len(rows) - window + 1):
        score = sum(
            (1.0 if r["is_looking_at_screen"] else 0.0) * 0.6
            + min((r["eyelid_openness"] or 0.0) / 0.3, 1.0) * 0.4
            for r in rows[i : i + window]
        ) / window
        if score > best_score:
            best_score, best_i = score, i

    return rows[best_i]["recorded_at"], rows[best_i + window - 1]["recorded_at"]


async def _build_top_distractors(session_id: str) -> list[dict]:
    """
    Query focus_events to produce [{type, count, total_duration_ms}] for the top 5
    distraction types, ranked by count descending.
    """
    rows = await database.fetch_all(
        """SELECT event_type,
                  COUNT(*) AS count,
                  COALESCE(SUM(duration_ms), 0) AS total_duration_ms
           FROM focus_events
           WHERE session_id = :sid
             AND event_type = ANY(:types)
           GROUP BY event_type
           ORDER BY count DESC
           LIMIT 5""",
        {"sid": session_id, "types": DISTRACTION_TYPES},
    )
    return [
        {
            "type": r["event_type"],
            "count": r["count"],
            "total_duration_ms": r["total_duration_ms"],
        }
        for r in rows
    ]


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
        {
            "uid": user_id,
            "st": body.session_type,
            "dur": body.focus_duration_mins,
            "tabs": body.allowed_tabs,
        },
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
    started = session["started_at"].replace(tzinfo=None)
    duration_mins = max(1, int((now - started).total_seconds() / 60))

    focus_score = snap["focus_score"]

    # 1 coin per 5 seconds of face-detected focus time
    coins = int(snap.get("focus_seconds", 0) // 5)

    top_distractors = await _build_top_distractors(session_id)
    improvement_tips = {
        d["type"]: TIPS.get(d["type"], "")
        for d in top_distractors[:5]
    }

    peak_start, peak_end = await _compute_peak_focus(session_id, started, now)

    await database.execute(
        """UPDATE sessions
           SET ended_at          = :now,
               focus_duration_mins = :dur,
               focus_score       = :fs,
               coins_earned      = :coins,
               top_distractors   = :td,
               improvement_tips  = :tips,
               peak_focus_start  = :pfs,
               peak_focus_end    = :pfe,
               status            = 'completed',
               ended_reason      = 'manual'
           WHERE session_id = :sid""",
        {
            "now":   now,
            "dur":   duration_mins,
            "fs":    focus_score,
            "coins": coins,
            "td":    json.dumps(top_distractors),
            "tips":  json.dumps(improvement_tips),
            "pfs":   peak_start,
            "pfe":   peak_end,
            "sid":   session_id,
        },
    )

    await database.execute(
        "UPDATE users SET coin_balance = coin_balance + :c WHERE user_id = :uid",
        {"c": coins, "uid": user_id},
    )

    user = await database.fetch_one(
        "SELECT coin_balance FROM users WHERE user_id = :uid", {"uid": user_id}
    )

    return {
        "session_id":      session_id,
        "duration_mins":   duration_mins,
        "focus_score":     focus_score,
        "coins_earned":    coins,
        "coin_balance":    user["coin_balance"],
        "top_distractors": top_distractors,
        "improvement_tips": improvement_tips,
        "peak_focus_start": peak_start,
        "peak_focus_end":   peak_end,
        "event_counts":    snap["counts"],
    }


@router.post("/interrupt/{session_id}")
async def interrupt_session(session_id: str, user_id: str = Depends(_decode_token)):
    """
    Mark a session as interrupted (browser closed, crash, etc.).
    Persists what was collected but does not award coins.
    """
    session = await database.fetch_one(
        "SELECT * FROM sessions WHERE session_id = :sid AND user_id = :uid AND status = 'active'",
        {"sid": session_id, "uid": user_id},
    )
    if not session:
        raise HTTPException(404, "Active session not found")

    # Stop in-memory state if it matches this session
    if state.session_id == session_id:
        state.stop()

    now = datetime.utcnow()
    started = session["started_at"].replace(tzinfo=None)
    duration_mins = max(0, int((now - started).total_seconds() / 60))

    top_distractors = await _build_top_distractors(session_id)
    peak_start, peak_end = await _compute_peak_focus(session_id, started, now)

    await database.execute(
        """UPDATE sessions
           SET ended_at            = :now,
               focus_duration_mins = :dur,
               top_distractors     = :td,
               peak_focus_start    = :pfs,
               peak_focus_end      = :pfe,
               status              = 'interrupted',
               ended_reason        = 'interrupted'
           WHERE session_id = :sid""",
        {
            "now": now,
            "dur": duration_mins,
            "td":  json.dumps(top_distractors),
            "pfs": peak_start,
            "pfe": peak_end,
            "sid": session_id,
        },
    )

    return {
        "session_id":    session_id,
        "status":        "interrupted",
        "duration_mins": duration_mins,
    }
