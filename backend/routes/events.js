import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabase }    from '../lib/supabase.js';
import { getState }    from '../lib/state.js';

const router = Router();

// POST /events  — log a focus distraction event
router.post('/', requireAuth, async (req, res) => {
  try {
    const { session_id, event_type, duration_ms, metadata } = req.body;

    const { data: session, error: fetchErr } = await supabase
      .from('sessions')
      .select('session_id')
      .eq('session_id', session_id)
      .eq('user_id', req.user.id)
      .single();

    if (fetchErr || !session) return res.status(404).json({ error: 'Session not found' });

    const { error } = await supabase.from('focus_events').insert({
      session_id,
      user_id:     req.user.id,
      event_type,
      duration_ms: duration_ms ?? null,
      metadata:    metadata    ?? null,
    });

    if (error) return res.status(500).json({ error: error.message });

    getState(session_id)?.recordEvent(event_type);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
