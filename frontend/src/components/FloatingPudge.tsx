import { useState, useEffect, useRef, useCallback } from "react";
import { Blob, usePettable, type BlobState } from "./Blob";
import { useSession } from "../context/SessionContext";
import { useFocus } from "../context/FocusContext";

const SIZE = 110;

function moodFromFocus(score: number, faceDetected: boolean): BlobState {
  if (!faceDetected) return "sleeping";
  if (score >= 80) return "cheering";
  if (score >= 50) return "encouraging";
  return "sad";
}

export function FloatingPudge() {
  const { isActive } = useSession();
  const focus = useFocus();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const baseMood = moodFromFocus(focus.focus_score, focus.face_detected);
  const { blobState, onPet } = usePettable(baseMood);

  const isDragging = useRef(false);
  const hasMoved   = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Set initial position once
  useEffect(() => {
    if (pos === null) {
      setPos({
        x: window.innerWidth  - SIZE - 24,
        y: window.innerHeight - Math.round(SIZE * 1.1) - 24,
      });
    }
  }, [pos]);

  // Mouse tracking for eye movement
  useEffect(() => {
    const h = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);

  // Drag
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (pos === null) return;
    isDragging.current = true;
    hasMoved.current   = false;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  }, [pos]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      hasMoved.current = true;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth  - SIZE, e.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - SIZE, e.clientY - dragOffset.current.y)),
      });
    };
    const onUp = () => { isDragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
  }, []);

  const handleClick = useCallback(() => {
    if (!hasMoved.current) onPet();
  }, [onPet]);

  if (!isActive || pos === null) return null;

  return (
    <div
      style={{
        position:  "fixed",
        left:      pos.x,
        top:       pos.y,
        zIndex:    9999,
        cursor:    "grab",
        userSelect: "none",
        WebkitUserSelect: "none",
        filter:    "drop-shadow(0 6px 16px rgba(0,0,0,0.18))",
        touchAction: "none",
      }}
      onMouseDown={onMouseDown}
      onClick={handleClick}
      title="Drag to move · Click to pet Pudge!"
    >
      <Blob
        palette="cream"
        shape="wide"
        size={SIZE}
        state={blobState}
        eyeTarget={mousePos}
        showGround
      />
    </div>
  );
}
