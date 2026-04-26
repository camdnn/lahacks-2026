import asyncio
from fastapi import APIRouter
from state import state

router = APIRouter(prefix="/calibrate", tags=["calibrate"])


@router.post("/start")
async def start_calibration():
    state.start_calibration()
    await asyncio.sleep(5)
    state.finish_calibration()
    return {
        "calibrated": True,
        "nose_baseline": round(state.nose_baseline, 4),
        "tilt_baseline": round(state.tilt_baseline, 2),
    }


@router.get("/status")
async def calibration_status():
    return {
        "calibrated": state.calibrated,
        "is_calibrating": state.is_calibrating,
        "nose_baseline": round(state.nose_baseline, 4),
        "tilt_baseline": round(state.tilt_baseline, 2),
    }
