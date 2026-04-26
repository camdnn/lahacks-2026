import { Router } from 'express';
import { requireAuth }    from '../middleware/auth.js';
import { supabase }       from '../lib/supabase.js';
import { state, WEIGHTS, TIPS } from '../lib/state.js';

const router = Router();

// POST /sessions/start
router.post('/start', requireAuth, async (req, res) => {
  try {
    const {
      session_type       = 'general',
      focus_duration_mins = null,
      allowed_tabs       = [],
    } = req.body;

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        user_id:             req.user.id,
        session_type,
        focus_duration_mins: focus_duration_mins ?? null,
        allowed_tabs,
      })
      .select('session_id, started_at')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    state.start(data.session_id, { session_type, allowed_tabs });

    res.json({ session_id: data.session_id, started_at: data.started_at });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /sessions/end/:session_id
router.post('/end/:session_id', requireAuth, async (req, res) => {
  try {
    const { session_id } = req.params;

    // Verify the session belongs to this user
    const { data: session, error: fetchErr } = await supabase
      .from('sessions')
      .select('*')
      .eq('session_id', session_id)
      .eq('user_id', req.user.id)
      .single();

    if (fetchErr || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const snap = state.snapshot();
    state.stop();

    const now         = new Date();
    const started     = new Date(session.started_at);
    const duration_mins = Math.max(1, Math.round((now - started) / 60_000));
    const coins       = Math.floor(snap.focus_seconds / 5);

    const top_d = snap.top_distractors; // [ [type, count], … ]
    const top_distractors = top_d.map(([type, count]) => ({
      type,
      count,
      impact: count * (WEIGHTS[type] ?? 1),
    }));
    const improvement_tips = Object.fromEntries(
      top_d.slice(0, 5).map(([k]) => [k, TIPS[k] ?? ''])
    );

    // Persist session summary
    await supabase
      .from('sessions')
      .update({
        ended_at:            now.toISOString(),
        focus_duration_mins: duration_mins,
        focus_score:         snap.focus_score,
        coins_earned:        coins,
        top_distractors,
        improvement_tips,
      })
      .eq('session_id', session_id);

    // Update coin balance in profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('coin_balance')
      .eq('id', req.user.id)
      .single();

    const coin_balance = (profile?.coin_balance ?? 0) + coins;
    await supabase
      .from('profiles')
      .update({ coin_balance })
      .eq('id', req.user.id);

    // Update streak
    const today = now.toISOString().split('T')[0];
    const { data: streak } = await supabase
      .from('streaks')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    if (streak) {
      const daysDiff = streak.last_session_date
        ? Math.floor(
            (new Date(today) - new Date(streak.last_session_date)) / 86_400_000
          )
        : null;

      const current =
        daysDiff === 1   ? streak.current_streak + 1 :
        daysDiff === 0   ? streak.current_streak      : 1;

      await supabase
        .from('streaks')
        .update({
          current_streak:    current,
          longest_streak:    Math.max(streak.longest_streak, current),
          last_session_date: today,
        })
        .eq('user_id', req.user.id);
    } else {
      await supabase.from('streaks').insert({
        user_id:           req.user.id,
        current_streak:    1,
        longest_streak:    1,
        last_session_date: today,
      });
    }

    res.json({
      session_id,
      duration_mins,
      focus_score:      snap.focus_score,
      coins_earned:     coins,
      coin_balance,
      top_distractors,
      improvement_tips,
      event_counts:     snap.counts,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
