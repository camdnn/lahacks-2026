"""
Screen monitor: keyboard listener + tab/idle polling.
Runs as two daemon threads started by main.py.

Collects:
  - Typing speed (WPM) via rolling 60s keystroke window
  - Mistype rate via backspace ratio
  - Active tab URL via AppleScript (Chrome / Safari / Firefox)
  - Tab switch events → state.increment("tab_switch")
  - Disallowed tab events → state.increment("disallowed_tab")
  - Idle / digital-break detection via time since last keypress
"""
import asyncio
import collections
import subprocess
import threading
import time

from pynput import keyboard

from state import state

IDLE_THRESHOLD_SECS = 300   # 5 min no keypresses = digital break
TAB_POLL_INTERVAL   = 2.0   # seconds between active-tab polls
SNAPSHOT_INTERVAL   = 30.0  # seconds between screen_data DB writes
WPM_WINDOW          = 60.0  # rolling window (seconds) for WPM calculation

# AppleScript queries for each browser
_BROWSER_SCRIPTS = [
    ("Google Chrome", 'tell application "Google Chrome" to return URL of active tab of front window'),
    ("Safari",        'tell application "Safari" to return URL of front document'),
    ("Firefox",       'tell application "Firefox" to return URL of front window'),
]
_FRONTMOST_SCRIPT = 'tell application "System Events" to return name of first process whose frontmost is true'


class ScreenMonitor:
    def __init__(self, event_loop: asyncio.AbstractEventLoop):
        self._loop = event_loop
        self._lock = threading.Lock()

        # Keyboard tracking (reset on each session start via _reset_session)
        self._key_times: collections.deque = collections.deque()  # timestamps of printable chars
        self._backspace_count = 0
        self._total_chars = 0
        self._last_keypress = time.time()

        # Idle state
        self._is_idle = False

        # Tab tracking
        self._prev_app: str | None = None
        self._prev_url: str | None = None

        # Snapshot timing
        self._last_snapshot = 0.0

        # Track last session_id so we can reset counters on new session
        self._last_session_id: str | None = None

    # ──────────────────────────────────────────────────────────
    # Keyboard listener callbacks (called from pynput thread)
    # ──────────────────────────────────────────────────────────

    def _on_key_press(self, key):
        now = time.time()
        with self._lock:
            self._last_keypress = now
            if key == keyboard.Key.backspace:
                self._backspace_count += 1
            else:
                try:
                    key.char  # AttributeError for non-character keys
                    self._key_times.append(now)
                    self._total_chars += 1
                except AttributeError:
                    pass  # special key (shift, ctrl, etc.) — still updated _last_keypress

    # ──────────────────────────────────────────────────────────
    # WPM / mistype calculation
    # ──────────────────────────────────────────────────────────

    def _get_wpm(self) -> tuple[float, float]:
        """Return (wpm, mistype_rate) based on the current rolling window."""
        now = time.time()
        cutoff = now - WPM_WINDOW
        # Prune stale entries
        while self._key_times and self._key_times[0] < cutoff:
            self._key_times.popleft()
        chars_in_window = len(self._key_times)
        wpm = (chars_in_window / 5.0) / (WPM_WINDOW / 60.0)
        mistype_rate = self._backspace_count / max(self._total_chars, 1)
        return round(wpm, 2), round(mistype_rate, 4)

    # ──────────────────────────────────────────────────────────
    # Active-tab detection via AppleScript
    # ──────────────────────────────────────────────────────────

    def _get_active_tab(self) -> tuple[str | None, str | None]:
        """Return (app_name, url) for the current foreground browser tab."""
        for app, script in _BROWSER_SCRIPTS:
            try:
                result = subprocess.run(
                    ["osascript", "-e", script],
                    capture_output=True, text=True, timeout=1.0,
                )
                if result.returncode == 0 and result.stdout.strip():
                    return app, result.stdout.strip()
            except Exception:
                pass
        # Fallback: just the frontmost app name
        try:
            result = subprocess.run(
                ["osascript", "-e", _FRONTMOST_SCRIPT],
                capture_output=True, text=True, timeout=1.0,
            )
            if result.returncode == 0 and result.stdout.strip():
                return result.stdout.strip(), None
        except Exception:
            pass
        return None, None

    # ──────────────────────────────────────────────────────────
    # DB write (runs on the asyncio event loop)
    # ──────────────────────────────────────────────────────────

    def _write_snapshot(self, wpm: float, mistype_rate: float, url: str | None):
        from database import database

        async def _insert():
            if not state.session_id:
                return
            await database.execute(
                """INSERT INTO screen_data
                   (session_id, typing_speed_wpm, mistype_rate, active_tab_url)
                   VALUES (:sid, :wpm, :mr, :url)""",
                {"sid": state.session_id, "wpm": wpm, "mr": mistype_rate, "url": url},
            )

        asyncio.run_coroutine_threadsafe(_insert(), self._loop)

    # ──────────────────────────────────────────────────────────
    # Session reset — clear per-session counters when a new session starts
    # ──────────────────────────────────────────────────────────

    def _maybe_reset_session(self):
        sid = state.session_id
        if sid != self._last_session_id:
            with self._lock:
                self._key_times.clear()
                self._backspace_count = 0
                self._total_chars = 0
                self._last_snapshot = time.time()
                self._is_idle = False
            self._last_session_id = sid

    # ──────────────────────────────────────────────────────────
    # Main polling loop (daemon thread)
    # ──────────────────────────────────────────────────────────

    def _run(self):
        while True:
            time.sleep(TAB_POLL_INTERVAL)
            now = time.time()

            self._maybe_reset_session()

            # ── Tab / window monitoring ──
            app, url = self._get_active_tab()
            if app is not None:
                changed = (app != self._prev_app) or (
                    url is not None and url != self._prev_url
                )
                if changed and self._prev_app is not None:
                    if state.is_active:
                        state.increment("tab_switch")
                        # Disallowed-tab check for specialized sessions
                        if state.session_type == "specialized" and url:
                            allowed = state.allowed_tabs
                            if allowed and not any(a in url for a in allowed):
                                state.increment("disallowed_tab")
                    state.update_screen(active_tab=url or app)

                self._prev_app, self._prev_url = app, url

            # ── Idle / digital-break detection ──
            with self._lock:
                idle_secs = now - self._last_keypress

            is_now_idle = idle_secs > IDLE_THRESHOLD_SECS
            if is_now_idle and not self._is_idle:
                self._is_idle = True
                state.update_screen(is_idle=True)
            elif not is_now_idle and self._is_idle:
                self._is_idle = False
                state.update_screen(is_idle=False)

            # ── Periodic DB snapshot (every 30s during active session) ──
            if state.is_active and (now - self._last_snapshot) >= SNAPSHOT_INTERVAL:
                with self._lock:
                    wpm, mistype_rate = self._get_wpm()
                state.update_screen(typing_speed_wpm=wpm, mistype_rate=mistype_rate)
                self._write_snapshot(wpm, mistype_rate, self._prev_url)
                self._last_snapshot = now

    # ──────────────────────────────────────────────────────────
    # Entry point
    # ──────────────────────────────────────────────────────────

    def start(self):
        # pynput keyboard listener runs in its own thread internally
        listener = keyboard.Listener(on_press=self._on_key_press)
        listener.daemon = True
        listener.start()

        t = threading.Thread(target=self._run, daemon=True)
        t.start()


def run_screen_monitor(event_loop: asyncio.AbstractEventLoop):
    """Entry point called from main.py startup — mirrors run_cv_loop."""
    monitor = ScreenMonitor(event_loop)
    monitor.start()
    # Keep thread alive (pynput listener + inner thread handle themselves)
    while True:
        time.sleep(60)
