import math
import numpy as np

# MediaPipe face mesh landmark indices
LEFT_EYE  = [33, 160, 158, 133, 153, 144]
RIGHT_EYE = [362, 385, 387, 263, 373, 380]
MOUTH_OUTER = [61, 291, 0, 17, 402, 181]

LEFT_EAR_INDICES  = [33, 160, 158, 133, 153, 144]
RIGHT_EAR_INDICES = [362, 385, 387, 263, 373, 380]


def _dist(a, b):
    return math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)


def eye_aspect_ratio(landmarks, indices: list[int]) -> float:
    """
    EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
    Uses 6-point eye contour.
    """
    pts = [landmarks[i] for i in indices]
    vert1 = _dist(pts[1], pts[5])
    vert2 = _dist(pts[2], pts[4])
    horiz = _dist(pts[0], pts[3])
    if horiz < 1e-6:
        return 0.0
    return (vert1 + vert2) / (2.0 * horiz)


def mouth_aspect_ratio(landmarks) -> float:
    """
    MAR = vertical mouth opening / horizontal mouth width.
    """
    pts = [landmarks[i] for i in MOUTH_OUTER]
    vert = _dist(pts[2], pts[5])
    horiz = _dist(pts[0], pts[1])
    if horiz < 1e-6:
        return 0.0
    return vert / horiz


def head_tilt_degrees(landmarks) -> float:
    """
    Angle of the line between left and right eye corners from horizontal.
    """
    left  = landmarks[33]
    right = landmarks[263]
    dx = right.x - left.x
    dy = right.y - left.y
    return math.degrees(math.atan2(dy, dx))


def nose_vertical_ratio(landmarks) -> float:
    """
    Ratio of nose tip y position within face bounding box.
    High value (> 0.55) → head tilted down (phone check).
    """
    nose  = landmarks[1]
    chin  = landmarks[152]
    brow  = landmarks[10]
    face_h = abs(chin.y - brow.y)
    if face_h < 1e-6:
        return 0.5
    return (nose.y - brow.y) / face_h


def avg_ear(landmarks) -> float:
    left  = eye_aspect_ratio(landmarks, LEFT_EAR_INDICES)
    right = eye_aspect_ratio(landmarks, RIGHT_EAR_INDICES)
    return (left + right) / 2.0


def gaze_down_ratio(landmarks) -> float:
    """
    Iris vertical position within eye socket, averaged across both eyes.
    0.0 = looking up, 1.0 = looking down. Requires refine_landmarks=True.
    """
    def _eye_ratio(iris_idx, top_idx, bot_idx):
        iris = landmarks[iris_idx]
        top  = landmarks[top_idx]
        bot  = landmarks[bot_idx]
        h = abs(bot.y - top.y)
        if h < 1e-6:
            return 0.5
        return (iris.y - top.y) / h

    left  = _eye_ratio(468, 159, 145)
    right = _eye_ratio(473, 386, 374)
    return (left + right) / 2.0
