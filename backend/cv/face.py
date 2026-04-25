"""
Face detection + annotation helpers.
Draws landmarks, bounding boxes, and metric overlays on frames.
"""
import cv2
import numpy as np
import math

# Colours (BGR)
GREEN  = (80, 220, 80)
RED    = (60, 60, 220)
YELLOW = (40, 220, 220)
CYAN   = (220, 200, 40)
WHITE  = (255, 255, 255)
DARK   = (20, 20, 20)
ORANGE = (40, 150, 255)


def _text(img, txt: str, pos, color=WHITE, scale=0.55, thickness=1):
    cv2.putText(img, txt, pos, cv2.FONT_HERSHEY_SIMPLEX, scale, DARK, thickness + 2, cv2.LINE_AA)
    cv2.putText(img, txt, pos, cv2.FONT_HERSHEY_SIMPLEX, scale, color, thickness, cv2.LINE_AA)


def draw_eye_contour(img, landmarks, indices: list[int], h: int, w: int, color=GREEN):
    pts = np.array(
        [(int(landmarks[i].x * w), int(landmarks[i].y * h)) for i in indices],
        dtype=np.int32,
    )
    cv2.polylines(img, [pts], isClosed=True, color=color, thickness=1, lineType=cv2.LINE_AA)


def draw_mouth_contour(img, landmarks, h: int, w: int, color=CYAN):
    MOUTH_OUTER = [61, 291, 0, 17, 402, 181]
    pts = np.array(
        [(int(landmarks[i].x * w), int(landmarks[i].y * h)) for i in MOUTH_OUTER],
        dtype=np.int32,
    )
    cv2.polylines(img, [pts], isClosed=True, color=color, thickness=1, lineType=cv2.LINE_AA)


def draw_metrics_overlay(img, metrics: dict):
    """
    Draws a semi-transparent panel in the top-left with live metric readings.
    """
    h, w = img.shape[:2]
    panel_w, panel_h = 280, 210
    overlay = img.copy()
    cv2.rectangle(overlay, (8, 8), (8 + panel_w, 8 + panel_h), DARK, -1)
    cv2.addWeighted(overlay, 0.6, img, 0.4, 0, img)
    cv2.rectangle(img, (8, 8), (8 + panel_w, 8 + panel_h), (80, 80, 80), 1)

    ear   = metrics.get("ear", 0.0)
    mar   = metrics.get("mar", 0.0)
    tilt  = metrics.get("head_tilt", 0.0)
    nose  = metrics.get("nose_ratio", 0.5)
    blink = metrics.get("blink_rate", 0.0)
    face  = metrics.get("face_detected", False)
    score = metrics.get("focus_score", 100.0)

    ear_color   = RED if ear < 0.15 else GREEN
    mar_color   = RED if mar > 0.6  else GREEN
    tilt_color  = RED if abs(tilt) > 20 else GREEN
    nose_color  = RED if nose > 0.55 else GREEN
    score_color = RED if score < 50 else YELLOW if score < 80 else GREEN

    y = 30
    _text(img, f"Focus Score: {score:.0f}/100", (16, y), score_color, 0.6, 2); y += 28
    _text(img, f"Face Detected: {'YES' if face else 'NO'}", (16, y), GREEN if face else RED); y += 24
    _text(img, f"EAR (eye open): {ear:.3f}", (16, y), ear_color); y += 22
    _text(img, f"  -> {'MICROSLEEP' if ear < 0.15 else 'OK'}", (16, y), ear_color, 0.45); y += 20
    _text(img, f"MAR (mouth):    {mar:.3f}", (16, y), mar_color); y += 22
    _text(img, f"  -> {'YAWN' if mar > 0.6 else 'OK'}", (16, y), mar_color, 0.45); y += 20
    _text(img, f"Head tilt:      {tilt:.1f}°", (16, y), tilt_color); y += 22
    _text(img, f"Nose ratio:     {nose:.3f}", (16, y), nose_color); y += 22
    _text(img, f"Blink rate:     {blink:.1f}/min", (16, y), WHITE)


def draw_event_badge(img, event_type: str):
    """Flash a red alert badge when an event is detected."""
    h, w = img.shape[:2]
    labels = {
        "microsleep":     ("MICROSLEEP!", RED),
        "yawn":           ("YAWN!", YELLOW),
        "phone_check":    ("PHONE CHECK!", ORANGE),
        "head_tilt":      ("HEAD TILT!", YELLOW),
        "eyes_off_screen":("EYES OFF SCREEN!", RED),
    }
    if event_type in labels:
        txt, color = labels[event_type]
        (tw, th), _ = cv2.getTextSize(txt, cv2.FONT_HERSHEY_SIMPLEX, 0.9, 2)
        x = (w - tw) // 2
        y = h - 50
        cv2.rectangle(img, (x - 10, y - th - 10), (x + tw + 10, y + 10), DARK, -1)
        _text(img, txt, (x, y), color, 0.9, 2)
