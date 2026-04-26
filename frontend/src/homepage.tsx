import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Blob } from "./components/Blob";
import { useAuth } from "./context/AuthContext";
import { Coins, LogOut, ChevronDown, ShoppingBag } from "lucide-react";

// ── Inject page-level styles once ────────────────────────────
let landingStylesInjected = false;
function injectLandingStyles() {
  if (landingStylesInjected || typeof document === "undefined") return;
  landingStylesInjected = true;
  const s = document.createElement("style");
  s.id = "landing-styles";
  s.textContent = `
    @keyframes float-up { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
    @keyframes fade-in-up { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }

    .hero-blob { animation: float-up 4s ease-in-out infinite; }

    .fade-up { animation: fade-in-up 0.6s ease forwards; opacity: 0; }
    .fade-up-1 { animation-delay: 0.05s; }
    .fade-up-2 { animation-delay: 0.15s; }
    .fade-up-3 { animation-delay: 0.25s; }
    .fade-up-4 { animation-delay: 0.35s; }

    .landing-cta-btn {
      display: inline-flex; align-items: center; gap: 10px;
      background: #F08F60; color: #fff;
      padding: 16px 36px; border-radius: 999px;
      font-size: 17px; font-weight: 800; font-family: Nunito, system-ui, sans-serif;
      border: none; cursor: pointer; text-decoration: none;
      box-shadow: 0 8px 24px rgba(240,143,96,0.38);
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .landing-cta-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(240,143,96,0.46); }
    .landing-cta-btn:active { transform: scale(0.97); }

    .landing-ghost-btn {
      display: inline-flex; align-items: center; gap: 8px;
      background: transparent; color: #806550;
      padding: 14px 28px; border-radius: 999px;
      font-size: 15px; font-weight: 700; font-family: Nunito, system-ui, sans-serif;
      border: 2px solid #EAD7BE; cursor: pointer; text-decoration: none;
      transition: border-color 0.15s, color 0.15s;
    }
    .landing-ghost-btn:hover { border-color: #F08F60; color: #F08F60; }

    .landing-feature-card {
      background: #FFFAF1;
      border: 1.5px solid #EAD7BE;
      border-radius: 22px;
      padding: 28px 24px 24px;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .landing-feature-card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(60,42,27,0.1); }

    .landing-pill {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 5px 12px; border-radius: 999px;
      font-size: 12px; font-weight: 800;
      text-transform: uppercase; letter-spacing: 1.2px;
    }
  `;
  document.head.appendChild(s);
}

// ── Colors ────────────────────────────────────────────────────
const C = {
  bg: "#FBF1E5",
  card: "#FFFAF1",
  border: "#EAD7BE",
  ink: "#3D2A1B",
  soft: "#806550",
  accent: "#F08F60",
  accentSoft: "#FFE8D9",
  green: "#7FB069",
};

// ── Nav ───────────────────────────────────────────────────────
function Nav({ onLogin }: { onLogin: () => void }) {
  const { profile, logout, session, loading } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "20px 48px",
        position: "relative",
        zIndex: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: C.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(240,143,96,0.4)",
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "#FFE8D9",
            }}
          />
        </div>
        <span style={{ fontWeight: 900, fontSize: 20, letterSpacing: -0.4 }}>
          Bloom
        </span>
        <span
          style={{
            fontWeight: 600,
            fontSize: 12,
            color: C.soft,
            marginLeft: 2,
          }}
        >
          focus, with friends
        </span>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {!loading && session ? (
          <div className="relative" ref={dropdownRef}>
            {/* Profile dropdown */}
            <button
              onClick={() => setProfileOpen((o: boolean) => !o)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border hover:bg-accent transition-colors cursor-pointer"
            >
              <div className="size-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-black text-primary select-none">
                {profile?.email?.[0]?.toUpperCase() ?? "U"}
              </div>
              <span className="text-sm font-semibold max-w-45 truncate text-foreground">
                {profile?.email ?? "Account"}
              </span>
              <ChevronDown
                className={`size-3 text-muted-foreground transition-transform ${profileOpen ? "rotate-180" : ""}`}
              />
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-border bg-card shadow-lg p-3 z-50">
                <div className="px-2 py-1.5 mb-2">
                  <p className="text-xs text-muted-foreground mb-0.5 font-bold uppercase tracking-wide">
                    Signed in as
                  </p>
                  <p className="text-sm font-bold truncate">{profile?.email}</p>
                </div>
                <div
                  className="flex items-center gap-2 px-3 py-2 mb-2 rounded-xl"
                  style={{ background: "#FFF3D6" }}
                >
                  <Coins className="size-4" style={{ color: "#C97A3F" }} />
                  <span
                    className="text-sm font-black"
                    style={{ color: "#C97A3F" }}
                  >
                    {profile?.coin_balance ?? 0} coins
                  </span>
                </div>
                <hr className="border-border mb-2" />
                <button
                  onClick={() => { setProfileOpen(false); navigate("/store"); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-bold rounded-xl transition-colors cursor-pointer mb-1"
                  style={{ color: C.ink }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "#FFF3D6")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <ShoppingBag className="size-4" style={{ color: C.accent }} />
                  Character Shop
                </button>
                <button
                  onClick={async () => {
                    setProfileOpen(false);
                    await logout();
                    navigate("/");
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-bold rounded-xl transition-colors cursor-pointer"
                  style={{ color: "#E26656" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "#FFE0DB")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <LogOut className="size-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <button className="landing-ghost-btn" onClick={onLogin}>
              Sign in
            </button>
            <button
              className="landing-cta-btn"
              style={{ padding: "12px 24px", fontSize: 14 }}
              onClick={() => navigate("/register")}
            >
              Get started →
            </button>
          </>
        )}
      </div>
    </nav>
  );
}

// ── Hero ──────────────────────────────────────────────────────
function Hero({
  onLogin,
  onFocus,
  onAnalytics,
}: {
  onLogin: () => void;
  onFocus: () => void;
  onAnalytics: () => void;
}) {
  const [blobMsg, setBlobMsg] = useState("ready when you are :)");
  const msgs = [
    "flicker to flow",
    "let's focus today!",
    "i'll keep you on track",
    "we got this together",
  ];

  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % msgs.length;
      setBlobMsg(msgs[i]);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <section
      style={{
        position: "relative",
        minHeight: "calc(100vh - 74px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "90px 24px 80px",
        overflow: "hidden",
      }}
    >
      {/* Background orbs */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-10%",
            right: "-5%",
            width: 600,
            height: 600,
            borderRadius: "50%",
            background:
              "radial-gradient(circle,rgba(255,232,217,0.7) 0%,transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-5%",
            left: "-8%",
            width: 500,
            height: 500,
            borderRadius: "50%",
            background:
              "radial-gradient(circle,rgba(255,234,184,0.55) 0%,transparent 70%)",
          }}
        />
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          maxWidth: 720,
        }}
      >
        {/* Badge */}
        <div
          className="fade-up fade-up-1"
          style={{
            marginBottom: 24,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            className="landing-pill"
            style={{ background: C.accentSoft, color: C.accent }}
          >
            ✦ Flicker to Flow
          </div>
        </div>

        {/* Headline */}
        <h1
          className="fade-up fade-up-2"
          style={{
            fontSize: "clamp(44px, 6vw, 76px)",
            fontWeight: 900,
            letterSpacing: "-2px",
            lineHeight: 1.05,
            marginBottom: 22,
            color: C.ink,
          }}
        >
          Your focus has a new best friend.
        </h1>

        {/* Sub */}
        <p
          className="fade-up fade-up-3"
          style={{
            fontSize: 18,
            fontWeight: 500,
            lineHeight: 1.65,
            color: C.soft,
            maxWidth: 540,
            margin: "0 auto 36px",
          }}
        >
          Bloom watches your eye signals and computer behaviour to catch
          micro-distractions before they steal your flow — and celebrates every
          win with you.
        </p>

        {/* CTAs */}
        <div
          className="fade-up fade-up-4"
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
            marginBottom: 56,
          }}
        >
          <button
            className="landing-cta-btn"
            onClick={onFocus}
          >
            Start focusing free →
          </button>
          <button className="landing-ghost-btn" onClick={onAnalytics}>
            See your analytics
          </button>
        </div>

        {/* Mascot */}
        <div
          className="fade-up fade-up-4"
          style={{
            display: "flex",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <div
            className="hero-blob"
            style={{ position: "relative", display: "inline-block" }}
          >
            <Blob
              state="encouraging"
              palette="cream"
              shape="wide"
              size={180}
              showGround
            />
            <div
              style={{
                position: "absolute",
                left: "calc(100% + 8px)",
                top: 10,
                background: C.card,
                border: `2px solid ${C.border}`,
                borderRadius: 18,
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: 700,
                color: "#5a3e2a",
                boxShadow: "0 4px 14px rgba(180,120,80,0.18)",
                whiteSpace: "nowrap",
                animation: "fade-in-up 0.4s ease",
                zIndex: 2,
              }}
            >
              {blobMsg}
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                style={{ position: "absolute", bottom: 8, left: -10 }}
              >
                <path d="M14 0 L 14 14 L 0 7 Z" fill={C.card} />
                <path
                  d="M14 0 L 0 7 L 14 14"
                  fill="none"
                  stroke={C.border}
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Trust strip */}
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            marginTop: 48,
            flexWrap: "wrap",
          }}
        >
          {[
            "Eye Signal tracking",
            "Computer behaviour",
            "Coin rewards",
            "Deep analytics",
          ].map((label) => (
            <div
              key={label}
              style={{
                padding: "10px 20px",
                border: `1.5px solid ${C.border}`,
                borderRadius: 12,
                background: C.card,
                fontSize: 13,
                fontWeight: 800,
                color: C.soft,
                letterSpacing: -0.2,
                boxShadow: "0 2px 8px rgba(60,42,27,0.05)",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Features ──────────────────────────────────────────────────
function Features() {
  const features = [
    {
      icon: "eye",
      color: "#FF9180",
      colorSoft: "#FFE0DB",
      title: "Eye Signal",
      desc: "Computer vision detects yawning, head tilts, blink rate, microsleeps, and whether you're looking at your phone — catching fatigue before it strikes.",
      items: [
        "Blink speed & frequency",
        "Yawn detection (3× mouth size)",
        "Phone-check detection",
        "Microsleep alerts",
      ],
    },
    {
      icon: "kb",
      color: "#7FB069",
      colorSoft: "#D9F0D3",
      title: "Computer Signals",
      desc: "Passive tracking of typing speed and tab-switching patterns reveals your focus without any manual input.",
      items: [
        "Typing cadence baseline",
        "Tab-switch frequency",
        "App focus sessions",
        "Productivity trends",
      ],
    },
    {
      icon: "flow",
      color: "#F08F60",
      colorSoft: "#FFE8D9",
      title: "Flow Sessions",
      desc: "Set a focus window, pick your apps, and let Bloom guide you. The mascot celebrates your coins and holds you accountable.",
      items: [
        "Custom time windows",
        "App & tab presets",
        "Coin rewards",
        "Session-end insights",
      ],
    },
  ];

  return (
    <section style={{ padding: "80px 48px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 52 }}>
        <div
          className="landing-pill"
          style={{
            background: C.accentSoft,
            color: C.accent,
            marginBottom: 16,
          }}
        >
          How it works
        </div>
        <h2
          style={{
            fontSize: 40,
            fontWeight: 900,
            letterSpacing: -1.2,
            marginBottom: 12,
            color: C.ink,
          }}
        >
          Three layers of intelligence
        </h2>
        <p
          style={{
            color: C.soft,
            fontWeight: 500,
            fontSize: 16,
            maxWidth: 480,
            margin: "0 auto",
          }}
        >
          Bloom fuses biosignals and computer behaviour into a single focus
          score.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20,
        }}
      >
        {features.map((f) => (
          <div key={f.title} className="landing-feature-card">
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                background: f.colorSoft,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                marginBottom: 18,
              }}
            >
              {f.icon}
            </div>
            <h3
              style={{
                fontSize: 20,
                fontWeight: 900,
                letterSpacing: -0.4,
                marginBottom: 8,
                color: C.ink,
              }}
            >
              {f.title}
            </h3>
            <p
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: C.soft,
                lineHeight: 1.6,
                marginBottom: 18,
              }}
            >
              {f.desc}
            </p>
            <ul
              style={{
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: 7,
              }}
            >
              {f.items.map((it) => (
                <li
                  key={it}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    color: C.ink,
                  }}
                >
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: f.color,
                      flexShrink: 0,
                    }}
                  />
                  {it}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Score Preview ─────────────────────────────────────────────
function ScorePreview({ onAnalytics }: { onAnalytics: () => void }) {
  const breaks = [
    { rank: 1, label: "Phone checks", pct: 34, color: "#E26656" },
    { rank: 2, label: "Microsleeps detected", pct: 22, color: "#F08F60" },
    { rank: 3, label: "Tab switching", pct: 18, color: "#F5C24A" },
  ];

  return (
    <section
      style={{
        background: C.card,
        borderTop: `1.5px solid ${C.border}`,
        borderBottom: `1.5px solid ${C.border}`,
        padding: "80px 48px",
      }}
    >
      <div
        style={{
          maxWidth: 1000,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 64,
          alignItems: "center",
        }}
      >
        <div>
          <div
            className="landing-pill"
            style={{
              background: C.accentSoft,
              color: C.accent,
              marginBottom: 20,
            }}
          >
            End-session insights
          </div>
          <h2
            style={{
              fontSize: 38,
              fontWeight: 900,
              letterSpacing: -1.2,
              lineHeight: 1.1,
              marginBottom: 18,
              color: C.ink,
            }}
          >
            Know exactly
            <br />
            where you drifted.
          </h2>
          <p
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: C.soft,
              lineHeight: 1.7,
              marginBottom: 28,
            }}
          >
            After every session, Bloom ranks your top 5 most harmful break
            patterns, shows you your peak-focus window, and tells you exactly
            how to improve — with timestamps.
          </p>
          <button className="landing-cta-btn" onClick={onAnalytics}>
            View sample analytics →
          </button>
        </div>

        {/* Mini score card */}
        <div
          style={{
            background: C.bg,
            border: `1.5px solid ${C.border}`,
            borderRadius: 24,
            padding: 28,
            boxShadow: "0 8px 32px rgba(60,42,27,0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 20,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: 1.4,
                  color: C.soft,
                  marginBottom: 4,
                }}
              >
                Focus score
              </div>
              <div
                style={{
                  fontSize: 52,
                  fontWeight: 900,
                  letterSpacing: -2,
                  lineHeight: 1,
                  color: C.ink,
                }}
              >
                84
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.green }}>
                ↑ 12 pts from last session
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: C.accent }}>
                142
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.soft }}>
                coins earned
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: C.soft,
                textTransform: "uppercase",
                letterSpacing: 1.2,
                marginBottom: 8,
              }}
            >
              Top break patterns
            </div>
            {breaks.map((b) => (
              <div key={b.rank} style={{ marginBottom: 8 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    fontWeight: 700,
                    marginBottom: 3,
                    color: C.ink,
                  }}
                >
                  <span>
                    {b.rank}. {b.label}
                  </span>
                  <span style={{ color: C.soft }}>{b.pct}%</span>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 999,
                    background: C.accentSoft,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 999,
                      background: b.color,
                      width: `${b.pct}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              background: C.accentSoft,
              borderRadius: 12,
              padding: "10px 14px",
              fontSize: 12,
              fontWeight: 700,
              color: C.ink,
            }}
          >
            ✦ Peak focus: <strong>10:14–10:47 AM</strong> · 33 min uninterrupted
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Footer CTA ────────────────────────────────────────────────
function FooterCTA({ onFocus }: { onFocus: () => void }) {
  return (
    <section
      style={{
        padding: "100px 48px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 60%,rgba(240,143,96,0.12) 0%,transparent 65%)",
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 28,
          }}
        >
          <Blob
            state="cheering"
            palette="cream"
            shape="wide"
            size={120}
            showGround
          />
        </div>
        <h2
          style={{
            fontSize: 44,
            fontWeight: 900,
            letterSpacing: -1.5,
            marginBottom: 14,
            color: C.ink,
          }}
        >
          Ready to find your flow?
        </h2>
        <p
          style={{
            fontSize: 16,
            fontWeight: 500,
            color: C.soft,
            marginBottom: 36,
          }}
        >
          Join Bloom and turn every session into a win.
        </p>
        <button
          className="landing-cta-btn"
          style={{ fontSize: 18, padding: "18px 44px" }}
          onClick={onFocus}
        >
          Start for free →
        </button>
      </div>
    </section>
  );
}

// ── Main component ────────────────────────────────────────────
export default function Homepage() {
  injectLandingStyles();
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const cta = () => navigate(!loading && session ? "/home" : "/login");
  const ctaFocus = () => navigate(!loading && session ? "/home" : "/register");
  const ctaAnalytics = () => navigate(!loading && session ? "/my-analytics" : "/analytics");

  useEffect(() => {
    if (!loading && session) navigate("/home", { replace: true });
  }, [session, loading, navigate]);

  return (
    <div
      style={{
        background: C.bg,
        fontFamily: "Nunito, system-ui, sans-serif",
        color: C.ink,
        minHeight: "100vh",
        overflowX: "hidden",
      }}
    >
      <Nav onLogin={cta} />
      <Hero onLogin={cta} onFocus={ctaFocus} onAnalytics={ctaAnalytics} />
      <Features />
      <ScorePreview onAnalytics={() => navigate("/analytics")} />
      <FooterCTA onFocus={ctaFocus} />
      <footer
        style={{
          borderTop: `1.5px solid ${C.border}`,
          padding: "24px 48px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 12,
          fontWeight: 700,
          color: C.soft,
        }}
      >
        <div>© 2026 Bloom · focus, with friends</div>
        <div style={{ display: "flex", gap: 24 }}>
          {[
            { label: "Sign in", action: cta },
            { label: "FAQ", action: () => navigate("/faq") },
            { label: "About", action: () => navigate("/about") },
            { label: "Store", action: () => navigate("/store") },
            { label: "Analytics", action: () => navigate("/analytics") },
          ].map(({ label, action }) => (
            <button
              key={label}
              onClick={action}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
                color: C.soft,
                fontFamily: "inherit",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
