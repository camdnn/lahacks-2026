import { useEffect, useRef, useState } from 'react';
import { Blob, type BlobState, type PaletteKey, type ShapeKey } from './Blob';
import { SpeechBubble } from './SpeechBubble';

interface DesktopPetProps {
  state?: BlobState;
  palette?: PaletteKey;
  shape?: ShapeKey;
  size?: number;
  bubble?: { text: string; side?: 'left' | 'right' } | null;
  initialPos?: { x: number; y: number };
  bounds?: { left: number; top: number; right: number; bottom: number } | null;
  onPoke?: () => void;
  containerRef?: { current: HTMLElement | null };
  walkTrigger?: number;
}

export function DesktopPet({
  state,
  palette = 'peach',
  shape = 'classic',
  size = 140,
  bubble = null,
  initialPos = { x: 200, y: 200 },
  bounds = null,
  onPoke,
  containerRef,
  walkTrigger = 0,
}: DesktopPetProps) {
  const [pos, setPos] = useState(initialPos);
  const [dragging, setDragging] = useState(false);
  const [eyeTarget, setEyeTarget] = useState<{ x: number; y: number } | null>(null);
  const [pokeKey, setPokeKey] = useState(0);
  const [internalState, setInternalState] = useState<BlobState | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    offsetX: number; offsetY: number;
    startX: number; startY: number;
    moved: boolean; pointerId: number;
  } | null>(null);
  const facingRef = useRef(1);
  const posRef = useRef(initialPos);
  useEffect(() => { posRef.current = pos; }, [pos]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => setEyeTarget({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    dragRef.current = {
      offsetX: e.clientX - r.left,
      offsetY: e.clientY - r.top,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      pointerId: e.pointerId,
    };
    ref.current.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || e.pointerId !== dragRef.current.pointerId) return;
    const d = dragRef.current;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 4) d.moved = true;
    if (!d.moved) return;
    const container = containerRef?.current;
    if (!container) return;
    const cr = container.getBoundingClientRect();
    let nx = e.clientX - cr.left - d.offsetX;
    let ny = e.clientY - cr.top - d.offsetY;
    if (bounds) {
      nx = Math.max(bounds.left, Math.min(bounds.right - size, nx));
      ny = Math.max(bounds.top, Math.min(bounds.bottom - size * 1.1, ny));
    }
    setPos({ x: nx, y: ny });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current || e.pointerId !== dragRef.current.pointerId) return;
    const wasMoved = dragRef.current.moved;
    ref.current?.releasePointerCapture(e.pointerId);
    dragRef.current = null;
    setDragging(false);
    if (!wasMoved) {
      setPokeKey(k => k + 1);
      setInternalState('poked');
      setTimeout(() => setInternalState(null), 500);
      onPoke?.();
    }
  };

  useEffect(() => {
    if (walkTrigger === 0) return;
    const container = containerRef?.current;
    if (!container) return;
    const cr = container.getBoundingClientRect();
    const targetX = bounds
      ? bounds.left + Math.random() * (bounds.right - bounds.left - size)
      : Math.random() * (cr.width - size);
    const targetY = bounds
      ? bounds.top + Math.random() * (bounds.bottom - bounds.top - size * 1.1)
      : Math.random() * (cr.height - size * 1.1);

    facingRef.current = targetX > posRef.current.x ? 1 : -1;
    setInternalState('walking');

    const startX = posRef.current.x;
    const startY = posRef.current.y;
    const dur = 1400;
    const startTime = performance.now();
    let rafId: number;

    const step = (t: number) => {
      const k = Math.min(1, (t - startTime) / dur);
      const easedK = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      setPos({
        x: startX + (targetX - startX) * easedK,
        y: startY + (targetY - startY) * easedK,
      });
      if (k < 1) rafId = requestAnimationFrame(step);
      else setInternalState(null);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [walkTrigger]);

  const finalState = internalState ?? state ?? 'idle';

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        width: size,
        height: size * 1.1,
        cursor: dragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
        transform: `scaleX(${facingRef.current})`,
        transition: dragging ? 'none' : 'transform 0.2s',
        zIndex: 10,
      }}
    >
      <div style={{ transform: `scaleX(${facingRef.current})`, position: 'relative', width: '100%', height: '100%' }}>
        <Blob
          key={pokeKey}
          state={finalState}
          palette={palette}
          shape={shape}
          size={size}
          eyeTarget={dragging ? null : eyeTarget}
          showGround
        />
        {bubble && (
          <SpeechBubble
            text={bubble.text}
            side={bubble.side ?? (pos.x < 200 ? 'right' : 'left')}
            visible={!dragging}
          />
        )}
      </div>
    </div>
  );
}
