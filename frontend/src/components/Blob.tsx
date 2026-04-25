import { useRef, useState, useEffect } from "react";

const BLOB_PALETTES = {
  peach:  { name: 'Peach',  body: '#FFB088', bodyDark: '#F08F60', belly: '#FFD9C2', cheek: '#FF8FA3', accent: '#F5C24A', ground: '#F4E1CC' },
  butter: { name: 'Butter', body: '#FFD680', bodyDark: '#E8B449', belly: '#FFEAB8', cheek: '#F69C7A', accent: '#F08F60', ground: '#F7E6BC' },
  coral:  { name: 'Coral',  body: '#FF9180', bodyDark: '#E26656', belly: '#FFC4B6', cheek: '#E85B6E', accent: '#FFD680', ground: '#F4D2C8' },
  cream:  { name: 'Cream',  body: '#F4E2C9', bodyDark: '#D4B894', belly: '#FBF3E2', cheek: '#FFA8B5', accent: '#FFB088', ground: '#EDDCC4' },
  rose:   { name: 'Rose',   body: '#FFAEB6', bodyDark: '#E37684', belly: '#FFD2D7', cheek: '#E25D72', accent: '#FFD680', ground: '#F4D4D8' },
  honey:  { name: 'Honey',  body: '#F2A766', bodyDark: '#C97A3F', belly: '#F9CC9A', cheek: '#E25D72', accent: '#FFE3A3', ground: '#EDD2B0' },
} as const;

export type PaletteKey = keyof typeof BLOB_PALETTES;
export type ShapeKey = 'classic' | 'tall' | 'wide' | 'eared' | 'spike' | 'baby';
export type BlobState = 'idle' | 'focused' | 'cheering' | 'sleeping' | 'distracted' | 'encouraging' | 'sad' | 'walking' | 'poked';

type Palette = typeof BLOB_PALETTES[PaletteKey];

const BLOB_SHAPES: Record<ShapeKey, { topBump: number; sideSquish: number; hasNub: boolean; hasEars: boolean; hasSpike: boolean }> = {
  classic: { topBump: 6,  sideSquish: 0,  hasNub: true,  hasEars: false, hasSpike: false },
  tall:    { topBump: 14, sideSquish: -4, hasNub: true,  hasEars: false, hasSpike: false },
  wide:    { topBump: 2,  sideSquish: 8,  hasNub: false, hasEars: false, hasSpike: false },
  eared:   { topBump: 4,  sideSquish: 0,  hasNub: false, hasEars: true,  hasSpike: false },
  spike:   { topBump: 4,  sideSquish: 0,  hasNub: false, hasEars: false, hasSpike: true  },
  baby:    { topBump: 3,  sideSquish: 4,  hasNub: true,  hasEars: false, hasSpike: false },
};

function injectBlobStyles() {
  if (typeof document === 'undefined' || document.getElementById('blob-styles')) return;
  const s = document.createElement('style');
  s.id = 'blob-styles';
  s.textContent = `
    .blob-idle .blob-body { animation: blob-breathe 3.4s ease-in-out infinite; }
    @keyframes blob-breathe {
      0%, 100% { transform: scaleY(1) scaleX(1); }
      50%      { transform: scaleY(1.03) scaleX(0.98); }
    }
    .blob-cheering .blob-body { animation: blob-cheer 0.55s ease-in-out infinite; }
    @keyframes blob-cheer {
      0%, 100% { transform: scaleY(1) scaleX(1) translateY(0); }
      40%      { transform: scaleY(1.1) scaleX(0.92) translateY(-6px); }
      70%      { transform: scaleY(0.92) scaleX(1.08) translateY(0); }
    }
    .blob-cheering .blob-shadow { animation: blob-shadow-pulse 0.55s ease-in-out infinite; }
    @keyframes blob-shadow-pulse {
      0%, 100% { transform: scaleX(1); opacity: 0.18; }
      40%      { transform: scaleX(0.7); opacity: 0.1; }
    }
    .blob-sparkles .blob-sparkle { animation: blob-sparkle 1.4s ease-in-out infinite; }
    @keyframes blob-sparkle {
      0%, 100% { transform: scale(0); opacity: 0; }
      50%      { transform: scale(1); opacity: 1; }
    }
    .blob-sleeping .blob-body { animation: blob-sleep 4.2s ease-in-out infinite; }
    @keyframes blob-sleep {
      0%, 100% { transform: scaleY(0.95) scaleX(1.03); }
      50%      { transform: scaleY(1.02) scaleX(0.97); }
    }
    .blob-zzz { animation: blob-zzz-float 3s ease-in-out infinite; transform-origin: 84px 24px; }
    @keyframes blob-zzz-float {
      0%   { transform: translateY(4px); opacity: 0; }
      30%  { opacity: 1; }
      100% { transform: translateY(-8px); opacity: 0; }
    }
    .blob-focused .blob-body { animation: blob-focus 2.8s ease-in-out infinite; }
    @keyframes blob-focus {
      0%, 100% { transform: scaleY(1) scaleX(1); }
      50%      { transform: scaleY(1.015) scaleX(0.99); }
    }
    .blob-focus-aura circle { animation: blob-orbit 2s linear infinite; }
    @keyframes blob-orbit {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
    }
    .blob-distracted .blob-body { animation: blob-shake 0.8s ease-in-out infinite; }
    @keyframes blob-shake {
      0%, 100% { transform: rotate(0); }
      25%      { transform: rotate(-3deg); }
      75%      { transform: rotate(3deg); }
    }
    .blob-encouraging .blob-body { animation: blob-nod 1.6s ease-in-out infinite; }
    @keyframes blob-nod {
      0%, 100% { transform: translateY(0) scaleY(1); }
      50%      { transform: translateY(-2px) scaleY(1.02); }
    }
    .blob-encourage path { animation: blob-heart 1.4s ease-in-out infinite; transform-origin: 84px 22px; }
    @keyframes blob-heart {
      0%, 100% { transform: scale(1); }
      30%      { transform: scale(1.18); }
      60%      { transform: scale(0.95); }
    }
    .blob-sad .blob-body { animation: blob-droop 4s ease-in-out infinite; }
    @keyframes blob-droop {
      0%, 100% { transform: translateY(2px) scaleY(0.96) scaleX(1.04); }
      50%      { transform: translateY(3px) scaleY(0.94) scaleX(1.05); }
    }
    .blob-tear { animation: blob-tear 2.4s ease-in infinite; }
    @keyframes blob-tear {
      0%   { transform: translateY(-6px); opacity: 0; }
      20%  { opacity: 1; }
      100% { transform: translateY(20px); opacity: 0; }
    }
    .blob-walking .blob-body { animation: blob-walk 0.6s ease-in-out infinite; }
    @keyframes blob-walk {
      0%, 100% { transform: translateY(0) scaleY(1) scaleX(1); }
      40%      { transform: translateY(-8px) scaleY(1.06) scaleX(0.95); }
      80%      { transform: translateY(0) scaleY(0.92) scaleX(1.08); }
    }
    .blob-poked .blob-body { animation: blob-poke 0.45s ease-out; }
    @keyframes blob-poke {
      0%   { transform: scaleY(1) scaleX(1); }
      30%  { transform: scaleY(0.7) scaleX(1.25); }
      60%  { transform: scaleY(1.1) scaleX(0.92); }
      100% { transform: scaleY(1) scaleX(1); }
    }
  `;
  document.head.appendChild(s);
}

interface BlobProps {
  state?: BlobState;
  palette?: PaletteKey;
  shape?: ShapeKey;
  size?: number;
  eyeTarget?: { x: number; y: number } | null;
  showGround?: boolean;
  lean?: number;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function Blob({
  state = 'idle',
  palette = 'peach',
  shape = 'classic',
  size = 160,
  eyeTarget = null,
  showGround = false,
  lean = 0,
  onClick,
  style,
}: BlobProps) {
  injectBlobStyles();

  const P = BLOB_PALETTES[palette] ?? BLOB_PALETTES.peach;
  const S = BLOB_SHAPES[shape] ?? BLOB_SHAPES.classic;
  const svgRef = useRef<SVGSVGElement>(null);

  const [pupil, setPupil] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (!eyeTarget || !svgRef.current) {
      setPupil({ x: 0, y: 0 });
      return;
    }
    const r = svgRef.current.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = eyeTarget.x - cx;
    const dy = eyeTarget.y - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const max = 3.2;
    const nx = (dx / dist) * Math.min(max, dist / 60);
    const ny = (dy / dist) * Math.min(max, dist / 60);
    setPupil({ x: nx, y: ny });
  }, [eyeTarget?.x, eyeTarget?.y]);

  const [blinking, setBlinking] = useState(false);
  useEffect(() => {
    if (state === 'sleeping') return;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      setBlinking(true);
      setTimeout(() => !cancelled && setBlinking(false), 130);
      if (Math.random() < 0.3) {
        setTimeout(() => !cancelled && setBlinking(true), 250);
        setTimeout(() => !cancelled && setBlinking(false), 380);
      }
      setTimeout(tick, 2200 + Math.random() * 3500);
    };
    const t = setTimeout(tick, 1000 + Math.random() * 2000);
    return () => { cancelled = true; clearTimeout(t); };
  }, [state]);

  const bodyW = 100 + S.sideSquish;
  const bodyH = 92 + S.topBump;
  const blobCy = 70;
  const eyeY = state === 'sleeping' ? 60 : state === 'focused' ? 58 : 56;

  return (
    <div
      onClick={onClick}
      style={{
        display: 'inline-block',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        transform: `skewX(${lean}deg)`,
        transformOrigin: 'bottom center',
        transition: 'transform 0.4s ease-out',
        ...style,
      }}
    >
      <svg
        ref={svgRef}
        viewBox="0 0 100 110"
        width={size}
        height={size * 1.1}
        style={{ overflow: 'visible', display: 'block' }}
        className={`blob blob-${state}`}
      >
        {showGround && (
          <ellipse cx="50" cy="104" rx="32" ry="4" fill="rgba(60,40,30,0.18)" className="blob-shadow" />
        )}

        <g className="blob-body" style={{ transformOrigin: '50px 100px', transformBox: 'fill-box' } as React.CSSProperties}>
          {S.hasEars && (
            <>
              <ellipse cx="28" cy="22" rx="7" ry="11" fill={P.bodyDark} transform="rotate(-18 28 22)" />
              <ellipse cx="72" cy="22" rx="7" ry="11" fill={P.bodyDark} transform="rotate(18 72 22)" />
              <ellipse cx="28" cy="24" rx="3.5" ry="6" fill={P.cheek} opacity={0.5} transform="rotate(-18 28 24)" />
              <ellipse cx="72" cy="24" rx="3.5" ry="6" fill={P.cheek} opacity={0.5} transform="rotate(18 72 24)" />
            </>
          )}

          {S.hasSpike && (
            <path d="M50 8 Q 53 18 56 28 Q 50 24 44 28 Q 47 18 50 8 Z" fill={P.bodyDark} />
          )}

          <BlobBody w={bodyW} h={bodyH} cy={blobCy} fill={P.body} stroke={P.bodyDark} />

          <ellipse cx="50" cy={blobCy + 14} rx={bodyW * 0.36} ry={bodyH * 0.32} fill={P.belly} opacity={0.85} />
          <ellipse cx="38" cy="32" rx="9" ry="5" fill="#fff" opacity={0.45} transform="rotate(-20 38 32)" />

          {S.hasNub && (
            <>
              <ellipse cx="50" cy="14" rx="4.5" ry="6" fill={P.bodyDark} />
              <circle cx="50" cy="9" r="3" fill={P.body} />
            </>
          )}

          <ellipse cx="28" cy={eyeY + 10} rx="5.5" ry="3.3" fill={P.cheek} opacity={0.55} />
          <ellipse cx="72" cy={eyeY + 10} rx="5.5" ry="3.3" fill={P.cheek} opacity={0.55} />

          <BlobEye cx={38} cy={eyeY} blinking={blinking} state={state} pupil={pupil} P={P} />
          <BlobEye cx={62} cy={eyeY} blinking={blinking} state={state} pupil={pupil} P={P} />

          <BlobMouth state={state} P={P} />
          <BlobAccents state={state} P={P} />
        </g>
      </svg>
    </div>
  );
}

function BlobBody({ w, h, cy, fill, stroke }: { w: number; h: number; cy: number; fill: string; stroke: string }) {
  const left = 50 - w / 2;
  const right = 50 + w / 2;
  const top = cy - h / 2;
  const bottom = cy + h / 2;
  const d = [
    `M50 ${top}`,
    `Q ${right - 4} ${top + 2} ${right} ${cy - 8}`,
    `Q ${right + 4} ${cy + 8} ${right - 4} ${bottom - 4}`,
    `Q 50 ${bottom + 4} ${left + 4} ${bottom - 4}`,
    `Q ${left - 4} ${cy + 8} ${left} ${cy - 8}`,
    `Q ${left + 4} ${top + 2} 50 ${top}`,
    'Z',
  ].join(' ');
  return (
    <>
      <path d={d} fill={stroke} transform="translate(0 2)" opacity={0.35} />
      <path d={d} fill={fill} />
    </>
  );
}

function BlobEye({ cx, cy, blinking, state, pupil, P }: {
  cx: number; cy: number; blinking: boolean; state: BlobState;
  pupil: { x: number; y: number }; P: Palette;
}) {
  if (state === 'sleeping') {
    return <path d={`M ${cx - 5} ${cy} Q ${cx} ${cy + 4} ${cx + 5} ${cy}`} stroke="#3a2a1f" strokeWidth="2.2" fill="none" strokeLinecap="round" />;
  }
  if (blinking) {
    return <path d={`M ${cx - 5} ${cy} Q ${cx} ${cy + 2.5} ${cx + 5} ${cy}`} stroke="#3a2a1f" strokeWidth="2.2" fill="none" strokeLinecap="round" />;
  }
  if (state === 'cheering') {
    return <path d={`M ${cx - 5} ${cy + 1} Q ${cx} ${cy - 4} ${cx + 5} ${cy + 1}`} stroke="#3a2a1f" strokeWidth="2.4" fill="none" strokeLinecap="round" />;
  }
  if (state === 'sad') {
    return (
      <>
        <ellipse cx={cx} cy={cy + 1} rx="3.6" ry="3.2" fill="#3a2a1f" />
        <circle cx={cx + 1} cy={cy - 0.5} r="1.2" fill="#fff" opacity={0.9} />
        <path d={`M ${cx - 6} ${cy - 4} Q ${cx} ${cy - 6} ${cx + 6} ${cy - 4}`} stroke={P.bodyDark} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity={0.7} />
      </>
    );
  }
  if (state === 'focused') {
    return <ellipse cx={cx + pupil.x * 0.4} cy={cy + pupil.y * 0.3} rx="3.4" ry="2.2" fill="#3a2a1f" />;
  }
  const offsetX = state === 'distracted' ? 2.5 : pupil.x;
  return (
    <>
      <ellipse cx={cx + offsetX} cy={cy + pupil.y} rx="4" ry="4.6" fill="#3a2a1f" />
      <circle cx={cx + offsetX + 1.2} cy={cy + pupil.y - 1.4} r="1.4" fill="#fff" />
      <circle cx={cx + offsetX - 1} cy={cy + pupil.y + 1.6} r="0.7" fill="#fff" opacity={0.8} />
    </>
  );
}

function BlobMouth({ state, P }: { state: BlobState; P: Palette }) {
  const my = 76;
  switch (state) {
    case 'cheering':
      return (
        <g>
          <path d={`M 42 ${my - 1} Q 50 ${my + 8} 58 ${my - 1} L 56 ${my - 2} Q 50 ${my + 5} 44 ${my - 2} Z`} fill="#3a2a1f" />
          <path d={`M 45 ${my + 3} Q 50 ${my + 6} 55 ${my + 3}`} stroke={P.cheek} strokeWidth="1.5" fill={P.cheek} opacity={0.8} />
        </g>
      );
    case 'sleeping':
      return <ellipse cx="50" cy={my + 1} rx="3.5" ry="2.5" fill="#3a2a1f" opacity={0.6} />;
    case 'sad':
      return <path d={`M 44 ${my + 3} Q 50 ${my - 2} 56 ${my + 3}`} stroke="#3a2a1f" strokeWidth="2" fill="none" strokeLinecap="round" />;
    case 'focused':
      return (
        <g>
          <path d={`M 47 ${my} Q 50 ${my + 2} 53 ${my}`} stroke="#3a2a1f" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <ellipse cx="52" cy={my + 2.5} rx="1.8" ry="1.4" fill={P.cheek} />
        </g>
      );
    case 'distracted':
      return <ellipse cx="50" cy={my + 1} rx="2.2" ry="1.6" fill="#3a2a1f" />;
    case 'encouraging':
      return <path d={`M 44 ${my} Q 50 ${my + 5} 56 ${my}`} stroke="#3a2a1f" strokeWidth="2" fill="none" strokeLinecap="round" />;
    case 'walking':
      return <path d={`M 45 ${my + 1} Q 50 ${my + 4} 55 ${my + 1}`} stroke="#3a2a1f" strokeWidth="2" fill="none" strokeLinecap="round" />;
    case 'poked':
      return <ellipse cx="50" cy={my + 1} rx="3" ry="2.5" fill="#3a2a1f" />;
    default:
      return <path d={`M 46 ${my} Q 50 ${my + 3.5} 54 ${my}`} stroke="#3a2a1f" strokeWidth="2" fill="none" strokeLinecap="round" />;
  }
}

function BlobAccents({ state, P }: { state: BlobState; P: Palette }) {
  switch (state) {
    case 'sleeping':
      return (
        <g className="blob-zzz">
          <text x="78" y="32" fontFamily="Nunito, system-ui, sans-serif" fontSize="11" fontWeight="800" fill={P.bodyDark}>z</text>
          <text x="84" y="22" fontFamily="Nunito, system-ui, sans-serif" fontSize="9" fontWeight="800" fill={P.bodyDark} opacity={0.7}>z</text>
          <text x="89" y="14" fontFamily="Nunito, system-ui, sans-serif" fontSize="7" fontWeight="800" fill={P.bodyDark} opacity={0.5}>z</text>
        </g>
      );
    case 'cheering':
      return (
        <g className="blob-sparkles">
          <BlobSparkle x={14} y={20} size={6} color={P.accent} />
          <BlobSparkle x={86} y={26} size={5} color={P.accent} delay="0.4s" />
          <BlobSparkle x={20} y={66} size={4} color={P.accent} delay="0.8s" />
          <BlobSparkle x={84} y={64} size={5} color={P.accent} delay="0.2s" />
        </g>
      );
    case 'focused':
      return (
        <g className="blob-focus-aura">
          <circle cx="14" cy="48" r="1.8" fill={P.accent} />
          <circle cx="86" cy="48" r="1.8" fill={P.accent} />
        </g>
      );
    case 'distracted':
      return (
        <g className="blob-distracted">
          <path d="M82 32 Q 79 38 82 42 Q 85 38 82 32 Z" fill="#7BC8F5" />
          <ellipse cx="80.5" cy="35" rx="0.8" ry="1.2" fill="#fff" opacity={0.7} />
        </g>
      );
    case 'encouraging':
      return (
        <g className="blob-encourage">
          <path d="M88 18 Q 84 14 80 18 Q 80 22 84 26 Q 88 22 88 18 Z" fill={P.cheek} />
        </g>
      );
    case 'sad':
      return (
        <g>
          <ellipse cx="35" cy="68" rx="1.4" ry="2.4" fill="#7BC8F5" className="blob-tear" />
        </g>
      );
    case 'poked':
      return (
        <g className="blob-poked">
          <text x="80" y="22" fontFamily="Nunito, system-ui, sans-serif" fontSize="14" fontWeight="800" fill={P.bodyDark}>!</text>
          <line x1="20" y1="20" x2="14" y2="14" stroke={P.bodyDark} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="14" y1="50" x2="6" y2="50" stroke={P.bodyDark} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="86" y1="50" x2="94" y2="50" stroke={P.bodyDark} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      );
    default:
      return null;
  }
}

function BlobSparkle({ x, y, size = 5, color = '#F5C24A', delay = '0s' }: {
  x: number; y: number; size?: number; color?: string; delay?: string;
}) {
  return (
    <g
      className="blob-sparkle"
      style={{ transformOrigin: `${x}px ${y}px`, animationDelay: delay } as React.CSSProperties}
    >
      <path
        d={`M ${x} ${y - size} L ${x + size * 0.3} ${y - size * 0.3} L ${x + size} ${y} L ${x + size * 0.3} ${y + size * 0.3} L ${x} ${y + size} L ${x - size * 0.3} ${y + size * 0.3} L ${x - size} ${y} L ${x - size * 0.3} ${y - size * 0.3} Z`}
        fill={color}
      />
    </g>
  );
}
