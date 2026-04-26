import { Router } from 'express';
import { state } from '../lib/state.js';

const router = Router();

// GET /state — current session + CV snapshot (used by Electron overlay)
router.get('/state', (_req, res) => res.json(state.snapshot()));

// POST /state/push — browser MediaPipe reports face + score every 2 s
router.post('/state/push', (req, res) => {
  const { face_detected, focus_score } = req.body;
  state.pushBrowserFocus(face_detected, focus_score);
  res.json({ ok: true });
});

// POST /cv/push — Python CV bridge pushes raw sensor metrics every ~1 s
router.post('/cv/push', (req, res) => {
  state.updateCV(req.body);
  res.json({ ok: true });
});

export default router;
