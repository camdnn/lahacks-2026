import { Router } from 'express';
import { getState } from '../lib/state.js';

const router = Router();

// GET /state?session_id=xxx — current session snapshot (used by Electron overlay)
router.get('/state', (req, res) => {
  const { session_id } = req.query;
  const s = session_id ? getState(session_id) : null;
  res.json(s ? s.snapshot() : { session_id: null, is_active: false, focus_score: 100 });
});

// POST /state/push — browser MediaPipe reports face + score every 2 s
router.post('/state/push', (req, res) => {
  const { session_id, face_detected, focus_score } = req.body;
  const s = session_id ? getState(session_id) : null;
  if (s) s.pushBrowserFocus(face_detected, focus_score);
  res.json({ ok: true });
});

// POST /cv/push — Python CV bridge pushes raw sensor metrics every ~1 s
router.post('/cv/push', (req, res) => {
  const { session_id, ...metrics } = req.body;
  const s = session_id ? getState(session_id) : null;
  if (s) s.updateCV(metrics);
  res.json({ ok: true });
});

export default router;
