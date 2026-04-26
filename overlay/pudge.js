(function () {
  'use strict';

  // ── Constants ────────────────────────────────────────────────────────────────

  const SIZE = 130; // render px

  // Quadratic Bézier wide/cream blob body (matches Blob.tsx "wide" shape)
  const BODY_PATH = 'M50,23 Q104,25 104,62 Q108,80 100,113 Q50,121 0,113 Q-8,80 -4,62 Q0,25 50,23 Z';

  // ── State ────────────────────────────────────────────────────────────────────

  let currentMood = 'encouraging';
  let isBlinking  = false;
  let isDragging  = false;
  let hasMoved    = false;
  let dragOffX    = 0;
  let dragOffY    = 0;
  let pupil       = { x: 0, y: 0 };
  let rafPending  = false;
  let pendingMouse = null;
  let svgEl       = null;

  // ── DOM refs ─────────────────────────────────────────────────────────────────

  const wrap     = document.getElementById('pudge-wrap');
  const inner    = document.getElementById('pudge-inner');
  const closeBtn = document.getElementById('pudge-close');

  // ── SVG helpers ──────────────────────────────────────────────────────────────

  function buildSparkle(cx, cy, r, delay) {
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const a   = (i * Math.PI) / 4;
      const rad = i % 2 === 0 ? r : r * 0.38;
      pts.push((cx + Math.cos(a) * rad).toFixed(1) + ',' + (cy + Math.sin(a) * rad).toFixed(1));
    }
    return `<polygon points="${pts.join(' ')}" fill="#FFB088"
      style="transform-origin:${cx}px ${cy}px;transform-box:fill-box;
             animation:pudge-sparkle-pop 1.4s ease-in-out infinite ${delay}s;"/>`;
  }

  function buildAccents(mood) {
    if (mood === 'sleeping') {
      return `
        <text x="79" y="32" font-family="system-ui,sans-serif" font-size="11" font-weight="bold"
              fill="#D4B894"
              style="animation:pudge-zzz-float 2.4s ease-in-out infinite 0s">z</text>
        <text x="87" y="22" font-family="system-ui,sans-serif" font-size="9" font-weight="bold"
              fill="#D4B894" opacity="0.8"
              style="animation:pudge-zzz-float 2.4s ease-in-out infinite 0.5s">z</text>
        <text x="93" y="14" font-family="system-ui,sans-serif" font-size="7" font-weight="bold"
              fill="#D4B894" opacity="0.6"
              style="animation:pudge-zzz-float 2.4s ease-in-out infinite 1s">z</text>`;
    }
    if (mood === 'cheering') {
      return buildSparkle(14, 22, 5, 0) +
             buildSparkle(86, 28, 4, 0.35) +
             buildSparkle(18, 68, 3.5, 0.7) +
             buildSparkle(83, 65, 4, 1.05);
    }
    if (mood === 'encouraging') {
      return `<path d="M88,17 Q84,13 80,17 Q80,21 84,25 Q88,21 88,17 Z" fill="#FFA8B5"
                style="transform-origin:84px 19px;transform-box:fill-box;
                       animation:pudge-heart-pulse 2s ease-in-out infinite;"/>`;
    }
    if (mood === 'sad') {
      return `<ellipse cx="33" cy="68" rx="1.5" ry="2.5" fill="#7BC8F5"
                style="animation:pudge-tear-fall 2.2s ease-in-out infinite;"/>`;
    }
    return '';
  }

  function buildEye(cx, mood, blink, px, py) {
    const ey = mood === 'sleeping' ? 60 : 56;

    if (blink || mood === 'sleeping') {
      return `<path d="M${cx - 5},${ey} Q${cx},${ey + 5} ${cx + 5},${ey}"
                stroke="#3a2a1f" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
    }
    if (mood === 'cheering') {
      return `<path d="M${cx - 5},${ey + 1} Q${cx},${ey - 5} ${cx + 5},${ey + 1}"
                stroke="#3a2a1f" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
    }
    if (mood === 'sad') {
      return `
        <ellipse cx="${cx}" cy="${ey}" rx="3.6" ry="3.2" fill="#3a2a1f"/>
        <circle  cx="${cx + 0.5}" cy="${ey - 1.5}" r="1.2" fill="rgba(255,255,255,0.9)"/>
        <path d="M${cx - 6},${ey - 7} Q${cx},${ey - 9} ${cx + 6},${ey - 7}"
          stroke="#D4B894" stroke-width="1.5" fill="none" opacity="0.7"/>`;
    }
    // encouraging / default — pupils track cursor
    const ex = cx + px;
    const ey2 = ey + py;
    return `
      <ellipse cx="${ex.toFixed(2)}" cy="${ey2.toFixed(2)}" rx="4" ry="4.6" fill="#3a2a1f"/>
      <ellipse cx="${(ex + 1.2).toFixed(2)}" cy="${(ey2 - 1.5).toFixed(2)}" rx="1.5" ry="1.5"
               fill="rgba(255,255,255,0.9)"/>
      <ellipse cx="${(ex - 1.5).toFixed(2)}" cy="${(ey2 + 1).toFixed(2)}" rx="0.9" ry="0.9"
               fill="rgba(255,255,255,0.5)"/>`;
  }

  function buildMouth(mood) {
    if (mood === 'cheering') {
      return `<path d="M42,75 Q50,84 58,75 L56,74 Q50,81 44,74 Z" fill="#3a2a1f"/>
              <path d="M45,79 Q50,82 55,79" stroke="#FFA8B5" stroke-width="1.5"
                fill="none" opacity="0.8"/>`;
    }
    if (mood === 'sad') {
      return `<path d="M44,79 Q50,74 56,79" stroke="#3a2a1f" stroke-width="2"
                fill="none" stroke-linecap="round"/>`;
    }
    if (mood === 'sleeping') {
      return `<ellipse cx="50" cy="76" rx="3.5" ry="2.5" fill="#3a2a1f" opacity="0.55"/>`;
    }
    // encouraging
    return `<path d="M44,76 Q50,81 56,76" stroke="#3a2a1f" stroke-width="2"
              fill="none" stroke-linecap="round"/>`;
  }

  function buildSVG(mood, blink, px, py) {
    return `<svg viewBox="0 0 100 110" width="${SIZE}" height="${Math.round(SIZE * 1.1)}"
                 style="overflow:visible;display:block;" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="104" rx="32" ry="4" fill="rgba(60,40,30,0.18)"/>
      <g style="transform-origin:50px 100px;transform-box:fill-box;">
        <path d="${BODY_PATH}" fill="#D4B894" transform="translate(0,2)" opacity="0.35"/>
        <path d="${BODY_PATH}" fill="#F4E2C9"/>
        <ellipse cx="50" cy="84" rx="38.9" ry="30.1" fill="#FBF3E2" opacity="0.85"/>
        <ellipse cx="38" cy="32" rx="9" ry="5" fill="#fff" opacity="0.45" transform="rotate(-20,38,32)"/>
        <ellipse cx="28" cy="66" rx="5.5" ry="3.3" fill="#FFA8B5" opacity="0.55"/>
        <ellipse cx="72" cy="66" rx="5.5" ry="3.3" fill="#FFA8B5" opacity="0.55"/>
        ${buildEye(38, mood, blink, px, py)}
        ${buildEye(62, mood, blink, px, py)}
        ${buildMouth(mood)}
        ${buildAccents(mood)}
      </g>
    </svg>`;
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  function redraw() {
    inner.innerHTML = buildSVG(currentMood, isBlinking, pupil.x, pupil.y);
    svgEl = inner.querySelector('svg');
  }

  function setMood(mood) {
    const changed = mood !== currentMood;
    currentMood = mood;
    wrap.className = mood;
    if (changed || !isBlinking) redraw();
  }

  // ── Blinking ─────────────────────────────────────────────────────────────────

  function schedBlink() {
    setTimeout(() => {
      if (wrap.style.display !== 'none' && currentMood !== 'sleeping') {
        isBlinking = true;
        redraw();
        setTimeout(() => {
          isBlinking = false;
          redraw();
          if (Math.random() < 0.3) {
            setTimeout(() => {
              isBlinking = true; redraw();
              setTimeout(() => { isBlinking = false; redraw(); }, 130);
            }, 120);
          }
        }, 130);
      }
      schedBlink();
    }, 2200 + Math.random() * 3500);
  }

  // ── Position ─────────────────────────────────────────────────────────────────

  function clampPos(x, y) {
    return {
      x: Math.max(0, Math.min(window.innerWidth  - SIZE, x)),
      y: Math.max(0, Math.min(window.innerHeight - SIZE, y)),
    };
  }

  function applyPos(x, y) {
    const p = clampPos(x, y);
    wrap.style.left = p.x + 'px';
    wrap.style.top  = p.y + 'px';
  }

  // ── Drag ─────────────────────────────────────────────────────────────────────

  wrap.addEventListener('mousedown', (e) => {
    if (e.target === closeBtn) return;
    isDragging = true;
    hasMoved   = false;
    const rect = wrap.getBoundingClientRect();
    dragOffX = e.clientX - rect.left;
    dragOffY = e.clientY - rect.top;
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      hasMoved = true;
      applyPos(e.clientX - dragOffX, e.clientY - dragOffY);
    }
  });

  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    if (hasMoved) {
      const rect = wrap.getBoundingClientRect();
      localStorage.setItem('pudge_x', rect.left);
      localStorage.setItem('pudge_y', rect.top);
    }
  });

  // ── Eye tracking ─────────────────────────────────────────────────────────────

  document.addEventListener('mousemove', (e) => {
    pendingMouse = { x: e.clientX, y: e.clientY };
    if (!rafPending && !isBlinking && !isDragging && currentMood !== 'sleeping') {
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        if (!svgEl || !pendingMouse) return;
        const r    = svgEl.getBoundingClientRect();
        const dx   = pendingMouse.x - (r.left + r.width  / 2);
        const dy   = pendingMouse.y - (r.top  + r.height / 2);
        const dist = Math.hypot(dx, dy) || 1;
        const max  = 3.2;
        const s    = Math.min(max, dist / 60) / dist;
        pupil.x    = dx * s;
        pupil.y    = dy * s;
        redraw();
      });
    }
  });

  // ── Click-through IPC ─────────────────────────────────────────────────────────
  // When mouse enters Pudge: stop ignoring mouse events so we can interact.
  // When mouse leaves: resume click-through so the rest of the screen works.

  wrap.addEventListener('mouseenter', () => {
    if (window.overlay) window.overlay.setIgnoreMouse(false);
  });
  wrap.addEventListener('mouseleave', () => {
    if (!isDragging && window.overlay) window.overlay.setIgnoreMouse(true);
  });
  document.addEventListener('mouseup', () => {
    // Re-enable click-through after drag ends even if mouse left wrap during drag
    if (window.overlay) window.overlay.setIgnoreMouse(true);
  });

  // ── Close button ──────────────────────────────────────────────────────────────

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    wrap.style.display = 'none';
    localStorage.setItem('pudge_hidden', 'true');
    if (window.overlay) window.overlay.setIgnoreMouse(true);
  });

  // ── Backend polling ──────────────────────────────────────────────────────────

  function pollBackend() {
    fetch('http://127.0.0.1:8000/state')
      .then((r) => r.json())
      .then((data) => {
        if (!data.is_active) {
          wrap.style.display = 'none';
          return;
        }
        if (localStorage.getItem('pudge_hidden') !== 'true') {
          wrap.style.display = 'block';
        }
        const mood =
          !data.face_detected    ? 'sleeping'    :
          data.focus_score >= 80 ? 'cheering'    :
          data.focus_score >= 50 ? 'encouraging' : 'sad';
        setMood(mood);
      })
      .catch(() => {
        wrap.style.display = 'none';
      });
  }

  // ── Init ─────────────────────────────────────────────────────────────────────

  const sx = parseFloat(localStorage.getItem('pudge_x'));
  const sy = parseFloat(localStorage.getItem('pudge_y'));
  applyPos(
    isNaN(sx) ? window.innerWidth  - SIZE - 24 : sx,
    isNaN(sy) ? window.innerHeight - SIZE - 24 : sy
  );

  redraw();
  setMood('encouraging');
  schedBlink();

  pollBackend();
  setInterval(pollBackend, 2000);
})();
