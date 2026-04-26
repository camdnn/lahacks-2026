(function () {
  'use strict';

  // ── Constants ────────────────────────────────────────────────────────────────

  const SIZE = 130;

  // Quadratic Bézier wide/cream blob body (matches Blob.tsx "wide" shape)
  const BODY_PATH = 'M50,23 Q104,25 104,62 Q108,80 100,113 Q50,121 0,113 Q-8,80 -4,62 Q0,25 50,23 Z';

  // ── MediaPipe landmark indices (478-pt face mesh, same as FocusContext.tsx) ──

  const R_EYE  = [33, 160, 158, 133, 153, 144];
  const L_EYE  = [362, 385, 387, 263, 373, 380];
  const NOSE_TIP = 4;
  const FOREHEAD = 10;
  const CHIN     = 152;
  const L_OUTER  = 33;
  const R_OUTER  = 263;
  const LIP_TOP  = 13;
  const LIP_BOT  = 14;
  const MOUTH_L  = 61;
  const MOUTH_R  = 291;

  // ── Distraction thresholds (same as FocusContext.tsx) ────────────────────────

  const WEIGHTS = { microsleep: 10, phone_check: 5, yawn: 3, eyes_off_screen: 2, head_tilt: 1 };
  const T = {
    EAR_CLOSE:   0.20, EAR_SECS:   1.5,
    MAR_YAWN:    0.48, MAR_SECS:   1.0,
    TILT_DEG:    22,   TILT_SECS:  2.0,
    PHONE_DELTA: 0.10, PHONE_SECS: 1.5,
    NO_FACE_SECS: 2.0,
  };

  // ── CV state ─────────────────────────────────────────────────────────────────

  let faceLandmarker = null;
  let cvReady        = false;
  let faceDetected   = false;
  let focusScore     = 100;
  let counts         = Object.fromEntries(Object.keys(WEIGHTS).map(k => [k, 0]));
  let sus            = { eyesClosed: 0, yawn: 0, headTilt: 0, phone: 0, noFace: 0 };
  let cal            = { noseBaseline: 0.57, tiltBaseline: 0, done: false };
  let calNose        = [];
  let calTilt        = [];
  let calDeadline    = 0;
  let lastMs         = 0;

  // ── Overlay state ─────────────────────────────────────────────────────────────

  let currentMood  = 'encouraging';
  let isBlinking   = false;
  let isPoking     = false;
  let isDragging   = false;
  let hasMoved     = false;
  let dragOffX     = 0;
  let dragOffY     = 0;
  let pupil        = { x: 0, y: 0 };
  let rafPending   = false;
  let pendingMouse = null;
  let svgEl        = null;

  // ── DOM refs ─────────────────────────────────────────────────────────────────

  const wrap     = document.getElementById('pudge-wrap');
  const inner    = document.getElementById('pudge-inner');
  const closeBtn = document.getElementById('pudge-close');
  const bubble   = document.getElementById('pudge-bubble');
  const videoEl  = document.getElementById('pudge-cam');

  // ── Metric helpers ───────────────────────────────────────────────────────────

  function pdist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function ear(lm, pts) {
    return (pdist(lm[pts[1]], lm[pts[5]]) + pdist(lm[pts[2]], lm[pts[4]])) / (2 * pdist(lm[pts[0]], lm[pts[3]]));
  }

  function scoreFromCounts(c) {
    return Math.max(0, 100 - Object.entries(c).reduce((s, [k, v]) => s + v * (WEIGHTS[k] || 0), 0));
  }

  // ── SVG helpers ──────────────────────────────────────────────────────────────

  function buildAccents(mood) {
    if (mood === 'distracted') {
      // Blue diamond — matches Blob.tsx distracted accent
      return `<path d="M82,32 Q79,38 82,42 Q85,38 82,32 Z" fill="#7BC8F5"/>`;
    }
    if (mood === 'focused') {
      // Two small dots — matches Blob.tsx focused accent
      return `<circle cx="14" cy="48" r="1.8" fill="#D4B894"/>
              <circle cx="86" cy="48" r="1.8" fill="#D4B894"/>`;
    }
    if (mood === 'encouraging') {
      return `<path d="M88,17 Q84,13 80,17 Q80,21 84,25 Q88,21 88,17 Z" fill="#FFA8B5"
                style="transform-origin:84px 19px;transform-box:fill-box;
                       animation:pudge-heart-pulse 2s ease-in-out infinite;"/>`;
    }
    if (mood === 'sad') {
      return `<ellipse cx="35" cy="68" rx="1.4" ry="2.4" fill="#7BC8F5"
                style="animation:pudge-tear-fall 2.2s ease-in-out infinite;"/>`;
    }
    return '';
  }

  function buildEye(cx, mood, blink, px, py) {
    const ey = 56;

    if (blink) {
      return `<path d="M${cx - 5},${ey} Q${cx},${ey + 2.5} ${cx + 5},${ey}"
                stroke="#3a2a1f" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
    }

    if (mood === 'sad') {
      return `
        <ellipse cx="${cx}" cy="${ey}" rx="3.6" ry="3.2" fill="#3a2a1f"/>
        <circle  cx="${cx + 0.5}" cy="${ey - 1.5}" r="1.2" fill="rgba(255,255,255,0.9)"/>
        <path d="M${cx - 6},${ey - 7} Q${cx},${ey - 9} ${cx + 6},${ey - 7}"
          stroke="#D4B894" stroke-width="1.5" fill="none" opacity="0.7"/>`;
    }

    if (mood === 'focused') {
      // Smaller squinting pupils — matches Blob.tsx focused eye (rx 3.4 ry 2.2)
      const ex = cx + px * 0.4;
      const ey2 = ey + py * 0.3;
      return `
        <ellipse cx="${ex.toFixed(2)}" cy="${ey2.toFixed(2)}" rx="3.4" ry="2.2" fill="#3a2a1f"/>
        <ellipse cx="${(ex + 1.2).toFixed(2)}" cy="${(ey2 - 1.4).toFixed(2)}" rx="1.1" ry="1.1"
                 fill="rgba(255,255,255,0.9)"/>
        <ellipse cx="${(ex - 1).toFixed(2)}" cy="${(ey2 + 1.6).toFixed(2)}" rx="0.7" ry="0.7"
                 fill="rgba(255,255,255,0.5)"/>`;
    }

    // encouraging / distracted / default — full tracking pupils
    const ex  = cx + px;
    const ey2 = ey + py;
    return `
      <ellipse cx="${ex.toFixed(2)}" cy="${ey2.toFixed(2)}" rx="4" ry="4.6" fill="#3a2a1f"/>
      <ellipse cx="${(ex + 1.2).toFixed(2)}" cy="${(ey2 - 1.4).toFixed(2)}" rx="1.3" ry="1.3"
               fill="rgba(255,255,255,0.9)"/>
      <ellipse cx="${(ex - 1).toFixed(2)}" cy="${(ey2 + 1.6).toFixed(2)}" rx="0.8" ry="0.8"
               fill="rgba(255,255,255,0.5)"/>`;
  }

  function buildMouth(mood) {
    const my = 76;
    if (mood === 'focused') {
      // Small curve + dot — matches Blob.tsx focused mouth
      return `<path d="M44,${my} Q50,${my + 3.5} 54,${my}" stroke="#3a2a1f" stroke-width="2"
                fill="none" stroke-linecap="round"/>
              <circle cx="56" cy="${my + 0.5}" r="1" fill="#3a2a1f"/>`;
    }
    if (mood === 'sad') {
      return `<path d="M44,${my + 3} Q50,${my - 2} 56,${my + 3}" stroke="#3a2a1f" stroke-width="2"
                fill="none" stroke-linecap="round"/>`;
    }
    if (mood === 'distracted') {
      // Small O — matches Blob.tsx distracted mouth
      return `<ellipse cx="50" cy="${my + 1}" rx="2.2" ry="1.6" fill="#3a2a1f"/>`;
    }
    // encouraging — wide smile
    return `<path d="M44,${my} Q50,${my + 5} 56,${my}" stroke="#3a2a1f" stroke-width="2"
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

  const MOOD_CLASSES = ['focused', 'distracted', 'encouraging', 'sad'];

  function setMood(mood) {
    const changed = mood !== currentMood;
    currentMood = mood;
    // Only replace mood classes — preserve no-session, poked, etc.
    MOOD_CLASSES.forEach(m => wrap.classList.remove(m));
    wrap.classList.add(mood);
    if (changed || !isBlinking) redraw();
  }

  // ── Blinking ─────────────────────────────────────────────────────────────────

  function schedBlink() {
    setTimeout(() => {
      if (wrap.style.display !== 'none') {
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

  // ── Click poke animation ─────────────────────────────────────────────────────

  wrap.addEventListener('click', (e) => {
    if (hasMoved || e.target === closeBtn || isPoking) return;
    isPoking = true;
    wrap.classList.add('poked');
    setTimeout(() => {
      wrap.classList.remove('poked');
      isPoking = false;
    }, 450);
  });

  // ── Eye tracking ─────────────────────────────────────────────────────────────

  document.addEventListener('mousemove', (e) => {
    pendingMouse = { x: e.clientX, y: e.clientY };
    if (!rafPending && !isBlinking && !isDragging) {
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

  wrap.addEventListener('mouseenter', () => {
    if (window.overlay) window.overlay.setIgnoreMouse(false);
  });
  wrap.addEventListener('mouseleave', () => {
    if (!isDragging && window.overlay) window.overlay.setIgnoreMouse(true);
  });
  document.addEventListener('mouseup', () => {
    if (window.overlay) window.overlay.setIgnoreMouse(true);
  });

  // ── Close button ──────────────────────────────────────────────────────────────

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    wrap.style.display = 'none';
    localStorage.setItem('pudge_hidden', 'true');
    if (window.overlay) window.overlay.setIgnoreMouse(true);
  });

  // ── Dock restore (main process sends 'show-pudge' on app.activate) ───────────

  if (window.overlay && window.overlay.onShow) {
    window.overlay.onShow(() => {
      wrap.style.display = 'block';
      localStorage.removeItem('pudge_hidden');
    });
  }

  // ── Speech bubble ─────────────────────────────────────────────────────────────

  function showBubble(msg) {
    setMood('encouraging');
    bubble.textContent = msg;
    wrap.classList.add('no-session');
    wrap.style.display = 'block';
  }

  function hideBubble() {
    wrap.classList.remove('no-session');
  }

  // ── Mood from CV ──────────────────────────────────────────────────────────────

  function moodFromCV() {
    if (!faceDetected) return 'distracted';
    if (focusScore >= 80) return 'focused';
    if (focusScore >= 50) return 'encouraging';
    return 'sad';
  }

  // ── CV detection tick (runs every 200ms) ─────────────────────────────────────

  function runDetection() {
    if (!cvReady || !faceLandmarker || videoEl.readyState < 2) return;

    const now = performance.now();
    const dt  = Math.min((now - lastMs) / 1000, 0.5); // cap at 0.5s
    lastMs = now;

    let lmks;
    try {
      lmks = faceLandmarker.detectForVideo(videoEl, now).faceLandmarks?.[0];
    } catch (_) { return; }

    if (!lmks) {
      faceDetected = false;
      sus.noFace += dt;
      if (sus.noFace >= T.NO_FACE_SECS) {
        counts.eyes_off_screen = (counts.eyes_off_screen || 0) + 1;
        focusScore = scoreFromCounts(counts);
        sus.noFace = 0;
      }
      sus.eyesClosed = sus.yawn = sus.headTilt = sus.phone = 0;
      if (localStorage.getItem('pudge_hidden') !== 'true') setMood('distracted');
      return;
    }

    faceDetected = true;
    sus.noFace = 0;

    const avgEar = (ear(lmks, R_EYE) + ear(lmks, L_EYE)) / 2;

    const mw  = pdist(lmks[MOUTH_L], lmks[MOUTH_R]);
    const mh  = pdist(lmks[LIP_TOP], lmks[LIP_BOT]);
    const mar = mw > 0.001 ? mh / mw : 0;

    const lex     = lmks[L_OUTER];
    const rex     = lmks[R_OUTER];
    const tiltDeg = Math.atan2(rex.y - lex.y, rex.x - lex.x) * (180 / Math.PI);

    const nose     = lmks[NOSE_TIP];
    const forehead = lmks[FOREHEAD];
    const chin_pt  = lmks[CHIN];
    const faceH    = chin_pt.y - forehead.y;
    const noseRatio = faceH > 0.001 ? (nose.y - forehead.y) / faceH : 0.5;

    // Auto-calibrate first 3 seconds
    if (!cal.done) {
      if (Date.now() < calDeadline) {
        calNose.push(noseRatio);
        calTilt.push(tiltDeg);
      } else if (calNose.length > 0) {
        calNose.sort((a, b) => a - b);
        calTilt.sort((a, b) => a - b);
        cal.noseBaseline = calNose[Math.floor(calNose.length / 2)];
        cal.tiltBaseline = calTilt[Math.floor(calTilt.length / 2)];
        cal.done = true;
      }
    }

    const tiltThresh  = Math.abs(cal.tiltBaseline) + T.TILT_DEG;
    const phoneThresh = cal.noseBaseline - T.PHONE_DELTA;

    if (avgEar < T.EAR_CLOSE) {
      sus.eyesClosed += dt;
      if (sus.eyesClosed >= T.EAR_SECS) {
        counts.microsleep = (counts.microsleep || 0) + 1;
        focusScore = scoreFromCounts(counts);
        sus.eyesClosed = 0;
      }
    } else { sus.eyesClosed = 0; }

    if (mar > T.MAR_YAWN) {
      sus.yawn += dt;
      if (sus.yawn >= T.MAR_SECS) {
        counts.yawn = (counts.yawn || 0) + 1;
        focusScore = scoreFromCounts(counts);
        sus.yawn = 0;
      }
    } else { sus.yawn = 0; }

    if (Math.abs(tiltDeg - cal.tiltBaseline) > tiltThresh) {
      sus.headTilt += dt;
      if (sus.headTilt >= T.TILT_SECS) {
        counts.head_tilt = (counts.head_tilt || 0) + 1;
        focusScore = scoreFromCounts(counts);
        sus.headTilt = 0;
      }
    } else { sus.headTilt = 0; }

    if (noseRatio < phoneThresh) {
      sus.phone += dt;
      if (sus.phone >= T.PHONE_SECS) {
        counts.phone_check = (counts.phone_check || 0) + 1;
        focusScore = scoreFromCounts(counts);
        sus.phone = 0;
      }
    } else { sus.phone = 0; }

    if (localStorage.getItem('pudge_hidden') !== 'true') {
      hideBubble();
      setMood(moodFromCV());
    }
  }

  // ── Init MediaPipe ────────────────────────────────────────────────────────────

  async function initCV() {
    showBubble('Loading Pudge…');
    try {
      const { FaceLandmarker, FilesetResolver } = await import(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/+esm'
      );
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
      );
      faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
      });

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      videoEl.srcObject = stream;
      videoEl.onloadeddata = () => {
        videoEl.play().then(() => {
          cvReady     = true;
          calDeadline = Date.now() + 3000;
          lastMs      = performance.now();
          hideBubble();
          setMood('encouraging');
        });
      };
    } catch (err) {
      console.error('[Pudge] MediaPipe init failed:', err);
      showBubble('Camera unavailable. Open Flicker to Flow in the browser instead!');
    }
  }

  // ── Init ─────────────────────────────────────────────────────────────────────

  const sx = parseFloat(localStorage.getItem('pudge_x'));
  const sy = parseFloat(localStorage.getItem('pudge_y'));
  applyPos(
    isNaN(sx) ? window.innerWidth  - SIZE - 24 : sx,
    isNaN(sy) ? window.innerHeight - SIZE - 24 : sy
  );

  if (localStorage.getItem('pudge_hidden') !== 'true') {
    wrap.style.display = 'block';
  }

  redraw();
  schedBlink();

  // Detection runs every 200ms; returns immediately until cvReady
  setInterval(runDetection, 200);

  initCV();
})();
