import { useEffect, useState } from 'react';

let injected = false;
function injectStyles() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.id = 'speech-bubble-styles';
  s.textContent = `
    .speech-bubble { animation: bubble-pop 0.28s cubic-bezier(.34,1.56,.64,1); transform-origin: 0 100%; }
    .speech-bubble-left { transform-origin: 100% 100%; }
    @keyframes bubble-pop { 0% { transform: scale(0.6); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
    @keyframes bubble-caret { 0%, 100% { opacity: 0.6; } 50% { opacity: 0; } }
  `;
  document.head.appendChild(s);
}

export interface SpeechBubbleProps {
  text: string;
  side?: 'left' | 'right';
  visible?: boolean;
  theme?: 'cream' | 'white';
}

export function SpeechBubble({ text, side = 'right', visible = true, theme = 'cream' }: SpeechBubbleProps) {
  injectStyles();
  const [shown, setShown] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!visible || !text) { setShown(''); setDone(false); return; }
    setShown(''); setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) { clearInterval(id); setDone(true); }
    }, 28);
    return () => clearInterval(id);
  }, [text, visible]);

  if (!visible) return null;

  const bg = theme === 'cream' ? '#FFFAF1' : '#fff';
  const border = '#E8C9A8';

  return (
    <div
      className={`speech-bubble ${side === 'left' ? 'speech-bubble-left' : ''}`}
      style={{
        position: 'absolute',
        background: bg,
        border: `2px solid ${border}`,
        borderRadius: 18,
        padding: '10px 14px',
        fontFamily: 'Nunito, system-ui, sans-serif',
        fontSize: 13,
        fontWeight: 600,
        color: '#5a3e2a',
        maxWidth: 180,
        lineHeight: 1.35,
        boxShadow: '0 4px 14px rgba(180,120,80,0.18)',
        whiteSpace: 'pre-wrap',
        zIndex: 2,
        ...(side === 'right' ? { left: 'calc(100% - 8px)', top: 8 } : { right: 'calc(100% - 8px)', top: 8 }),
      }}
    >
      {shown}
      {!done && <span style={{ animation: 'bubble-caret 0.7s steps(2) infinite', opacity: 0.6, marginLeft: 1 }}>|</span>}
      <svg
        width={14} height={14} viewBox="0 0 14 14"
        style={{
          position: 'absolute',
          bottom: 8,
          ...(side === 'right' ? { left: -10 } : { right: -10, transform: 'scaleX(-1)' }),
        }}
      >
        <path d="M14 0 L 14 14 L 0 7 Z" fill={bg} />
        <path d="M14 0 L 0 7 L 14 14" fill="none" stroke={border} strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
