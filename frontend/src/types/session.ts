export interface SessionStartPayload {
  session_type: 'general' | 'specialized';
  focus_duration_mins?: number;
  allowed_tabs?: string[];
  disabled_checks?: string[];
}

export interface DetectorSnapshotPayload {
  session_id: string;
  ear: number;                   // EAR → eyelid_openness (0–1)
  blink_rate_per_min?: number;
  avg_blink_duration_ms?: number;
  is_looking_at_screen: boolean; // face_detected from FocusState
  head_tilt_degrees: number;     // roll angle from FocusState
}

export interface FocusEventPayload {
  session_id: string;
  event_type: 'microsleep' | 'yawn' | 'phone_check' | 'head_tilt' | 'eyes_off_screen' | 'tab_switch';
  duration_ms?: number;
  metadata?: Record<string, unknown>;
}

export interface SessionSummary {
  session_id: string;
  duration_mins: number;
  focus_score: number;
  coins_earned: number;
  coin_balance: number;
  top_distractors: { type: string; count: number; impact: number }[];
  improvement_tips: Record<string, string>;
  event_counts: Record<string, number>;
}
