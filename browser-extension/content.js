(function () {
  'use strict';

  // Don't run on extension pages or chrome:// URLs
  if (!document.body) return;
  if (document.getElementById('pudge-ext-root')) return;

  const SIZE = 110;
  let currentMood = 'idle';
  let isBlinking  = false;
  let wasActive   = false;
  let isDragging  = false;
  let hasMoved    = false;
  let dragOffX    = 0;
  let dragOffY    = 0;

  // ── SVG helpers ────────────────────────────────────────────────────────────

  function eyeSVG(mood, blink, ex) {
    const ey = 37;
    if (blink || mood === 'sleeping') {
      return `<path d="M${ex - 5},${ey} Q${ex},${ey + 6} ${ex + 5},${ey}"
                stroke="#3a2a1f" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
    }
    if (mood === 'cheering') {
      return `<path d="M${ex - 5},${ey + 1} Q${ex},${ey - 5} ${ex + 5},${ey + 1}"
                stroke="#3a2a1f" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
    }
    if (mood === 'sad') {
      return `<ellipse cx="${ex}" cy="${ey}" rx="4" ry="4.5" fill="#3a2a1f"/>
              <ellipse cx="${ex + 0.5}" cy="${ey - 2.5}" rx="2" ry="2" fill="rgba(255,255,255,0.9)"/>`;
    }
    // idle / encouraging
    return `<ellipse cx="${ex}" cy="${ey}" rx="4.5" ry="5" fill="#3a2a1f"/>
            <ellipse cx="${ex + 1}" cy="${ey - 3}" rx="2.5" ry="2.5" fill="rgba(255,255,255,0.9)"/>
            <ellipse cx="${ex - 3}" cy="${ey + 1.5}" rx="1.5" ry="1.5" fill="rgba(255,255,255,0.55)"/>`;
  }

  function mouthSVG(mood) {
    if (mood === 'cheering') {
      return `<path d="M38,66 Q55,79 72,66" stroke="#3a2a1f" stroke-width="2.2" fill="none" stroke-linecap="round"/>
              <ellipse cx="55" cy="73" rx="5" ry="3" fill="#FFA8B5"/>`;
    }
    if (mood === 'sad') {
      return `<path d="M43,72 Q55,63 67,72" stroke="#3a2a1f" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
    }
    if (mood === 'sleeping') {
      return `<ellipse cx="55" cy="68" rx="3" ry="2.5" fill="rgba(58,42,31,0.55)"/>`;
    }
    // idle / encouraging
    return `<path d="M43,67 Q55,75 67,67" stroke="#3a2a1f" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  }

  function buildSVG(mood, blink) {
    const zzz = mood === 'sleeping'
      ? `<text x="79" y="28" font-family="sans-serif" font-size="11" font-weight="bold" fill="#D4B894">z</text>
         <text x="87" y="18" font-family="sans-serif" font-size="8"  font-weight="bold" fill="#D4B894">z</text>`
      : '';
    return `<svg width="110" height="105" viewBox="0 0 110 105" xmlns="http://www.w3.org/2000/svg">
      <!-- ground shadow -->
      <ellipse cx="55" cy="97" rx="34" ry="4" fill="rgba(180,140,90,0.35)"/>
      <!-- body shadow -->
      <ellipse cx="57" cy="54" rx="49" ry="41" fill="rgba(196,162,117,0.4)"/>
      <!-- body -->
      <path d="M55,11 C80,9 102,28 102,53 C102,78 84,93 55,93 C26,93 8,78 8,53 C8,28 30,9 55,11 Z"
            fill="#F4E2C9" stroke="#D4B894" stroke-width="1.2"/>
      <!-- belly -->
      <ellipse cx="55" cy="65" rx="23" ry="22" fill="#FBF3E2"/>
      <!-- sheen -->
      <ellipse cx="36" cy="26" rx="10" ry="8" fill="rgba(255,255,255,0.27)"/>
      <!-- cheeks -->
      <ellipse cx="22" cy="59" rx="9" ry="5" fill="rgba(255,168,181,0.65)"/>
      <ellipse cx="88" cy="59" rx="9" ry="5" fill="rgba(255,168,181,0.65)"/>
      <!-- eyes -->
      ${eyeSVG(mood, blink, 37)}
      ${eyeSVG(mood, blink, 73)}
      <!-- mouth -->
      ${mouthSVG(mood)}
      ${zzz}
    </svg>`;
  }

  // ── Inject styles ──────────────────────────────────────────────────────────

  const style = document.createElement('style');
  style.textContent = `
    #pudge-ext-root {
      position: fixed !important;
      z-index: 2147483647 !important;
      cursor: grab !important;
      user-select: none !important;
      -webkit-user-select: none !important;
      filter: drop-shadow(0 6px 16px rgba(0,0,0,0.18));
      transition: opacity 0.3s;
      touch-action: none;
    }
    #pudge-ext-root:active { cursor: grabbing !important; }
    #pudge-ext-inner { animation: pudge-ext-bob 2.2s ease-in-out infinite; }
    #pudge-ext-root.cheering #pudge-ext-inner {
      animation: pudge-ext-bounce 1.1s ease-in-out infinite;
    }
    @keyframes pudge-ext-bob {
      0%,100% { transform: translateY(0px); }
      50%      { transform: translateY(-1px); }
    }
    @keyframes pudge-ext-bounce {
      0%,100% { transform: translateY(0px); }
      50%     { transform: translateY(-3px); }
    }
    #pudge-ext-close {
      position: absolute !important;
      top: 4px !important; right: 4px !important;
      width: 18px !important; height: 18px !important;
      border-radius: 50% !important;
      background: rgba(0,0,0,0.5) !important;
      border: none !important;
      color: white !important;
      font-size: 12px !important;
      line-height: 1 !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      opacity: 0 !important;
      transition: opacity 0.15s !important;
      z-index: 1 !important;
      padding: 0 !important;
      font-family: sans-serif !important;
    }
    #pudge-ext-root:hover #pudge-ext-close { opacity: 1 !important; }
  `;
  document.head.appendChild(style);

  // ── Build DOM ──────────────────────────────────────────────────────────────

  const root = document.createElement('div');
  root.id = 'pudge-ext-root';
  root.style.display = 'none';

  const inner = document.createElement('div');
  inner.id = 'pudge-ext-inner';
  inner.innerHTML = buildSVG('idle', false);

  const closeBtn = document.createElement('button');
  closeBtn.id = 'pudge-ext-close';
  closeBtn.textContent = '×';
  closeBtn.title = 'Hide Pudge';
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    root.style.display = 'none';
    chrome.storage.local.set({ pudge_hidden: true });
  });

  root.appendChild(inner);
  root.appendChild(closeBtn);
  document.body.appendChild(root);

  // ── Position ───────────────────────────────────────────────────────────────

  function clampPos(x, y) {
    return {
      x: Math.max(0, Math.min(window.innerWidth  - SIZE, x)),
      y: Math.max(0, Math.min(window.innerHeight - SIZE, y)),
    };
  }

  function applyPos(x, y) {
    const p = clampPos(x, y);
    root.style.left = p.x + 'px';
    root.style.top  = p.y + 'px';
  }

  // Set default position first, then override from storage
  applyPos(window.innerWidth - SIZE - 24, window.innerHeight - SIZE - 24);
  chrome.storage.local.get(['pudge_x', 'pudge_y'], (res) => {
    if (res.pudge_x !== undefined) applyPos(res.pudge_x, res.pudge_y);
  });

  // ── Drag ──────────────────────────────────────────────────────────────────

  root.addEventListener('mousedown', (e) => {
    if (e.target === closeBtn) return;
    isDragging = true;
    hasMoved   = false;
    const rect = root.getBoundingClientRect();
    dragOffX = e.clientX - rect.left;
    dragOffY = e.clientY - rect.top;
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    hasMoved = true;
    applyPos(e.clientX - dragOffX, e.clientY - dragOffY);
  });

  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    if (hasMoved) {
      const rect = root.getBoundingClientRect();
      chrome.storage.local.set({ pudge_x: rect.left, pudge_y: rect.top });
    }
  });

  // ── Blink ──────────────────────────────────────────────────────────────────

  function schedBlink() {
    setTimeout(() => {
      if (root.style.display !== 'none' && currentMood !== 'sleeping') {
        isBlinking = true;
        inner.innerHTML = buildSVG(currentMood, true);
        setTimeout(() => {
          isBlinking = false;
          inner.innerHTML = buildSVG(currentMood, false);
        }, 120);
      }
      schedBlink();
    }, 2200 + Math.random() * 3000);
  }
  schedBlink();

  // ── Mood ───────────────────────────────────────────────────────────────────

  function setMood(mood) {
    if (mood === currentMood && !isBlinking) return;
    currentMood = mood;
    root.className = mood === 'cheering' ? 'cheering' : '';
    if (!isBlinking) inner.innerHTML = buildSVG(mood, false);
  }

  // ── Receive state from background service worker ───────────────────────────
  // Content scripts cannot fetch localhost directly (CORS blocks it from
  // non-localhost pages). All polling is done in background.js, which
  // broadcasts PUDGE_UPDATE messages to every tab.

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type !== 'PUDGE_UPDATE') return;
    const { is_active, focus_score, face_detected } = message.state;

    if (!is_active) {
      root.style.display = 'none';
      wasActive = false;
      return;
    }

    if (!wasActive) {
      wasActive = true;
      chrome.storage.local.set({ pudge_hidden: false });
      root.style.display = '';
    } else {
      chrome.storage.local.get(['pudge_hidden'], (s) => {
        if (!s.pudge_hidden) root.style.display = '';
      });
    }

    const mood =
      !face_detected    ? 'sleeping' :
      focus_score >= 80 ? 'cheering' :
      focus_score >= 50 ? 'idle'     : 'sad';

    setMood(mood);
  });

  // ── Position sync across tabs ──────────────────────────────────────────────
  // Re-read both coords from storage to avoid crash when only one changes.
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.pudge_x !== undefined || changes.pudge_y !== undefined) {
      chrome.storage.local.get(['pudge_x', 'pudge_y'], ({ pudge_x, pudge_y }) => {
        if (pudge_x !== undefined && pudge_y !== undefined) applyPos(pudge_x, pudge_y);
      });
    }
  });

  // ── Keep Service Worker Alive ──────────────────────────────────────────────
  // Manifest V3 service workers sleep after ~30s of inactivity.
  // We ping the background script every 10 seconds to keep it awake.
  setInterval(() => {
    chrome.runtime.sendMessage({ type: 'KEEP_ALIVE' }, () => void chrome.runtime.lastError);
  }, 10000);
})();
