import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabase }    from '../lib/supabase.js';
import { state }       from '../lib/state.js';

const router = Router();

// POST /events  — log a focus distraction event
router.post('/', requireAuth, async (req, res) => {
  try {
    const { session_id, event_type, duration_ms, metadata } = req.body;

    const { error } = await supabase.from('focus_events').insert({
      session_id,
      event_type,
      duration_ms: duration_ms ?? null,
      metadata:    metadata    ?? null,
    });

    if (error) return res.status(500).json({ error: error.message });

    // Sync distraction count into in-memory state for session-end summary
    state.recordEvent(event_type);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
