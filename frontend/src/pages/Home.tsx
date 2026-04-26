import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Blob } from "../components/Blob";
import { Coins, Flame, Play, BarChart2, LogOut, ChevronDown, Download, Store } from "lucide-react";

export default function HomeDashboard() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="grid grid-cols-3 items-center px-8 py-4 border-b border-border bg-card">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-lg font-bold cursor-pointer hover:opacity-75 transition-opacity"
        >
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: "#F08F60",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 6px rgba(240,143,96,0.35)",
          }}>
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#FFE8D9" }} />
          </div>
          <span className="font-black tracking-tight">Bloom</span>
        </button>

        {/* Store button — centered */}
        <div className="flex justify-center">
          <button
            onClick={() => navigate("/store")}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-background hover:bg-accent hover:border-primary transition-all cursor-pointer font-black text-sm"
          >
            <Store className="size-4" style={{ color: "#F08F60" }} />
            Store
          </button>
        </div>

        {/* Profile dropdown */}
        <div className="relative flex justify-end" ref={dropdownRef}>
          <button
            onClick={() => setProfileOpen(o => !o)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border hover:bg-accent transition-colors cursor-pointer"
          >
            <div className="size-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-black text-primary select-none">
              {profile?.email?.[0]?.toUpperCase() ?? "U"}
            </div>
            <span className="text-sm font-semibold max-w-45 truncate text-foreground">
              {profile?.email ?? "Account"}
            </span>
            <ChevronDown className={`size-3 text-muted-foreground transition-transform ${profileOpen ? "rotate-180" : ""}`} />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-border bg-card shadow-lg p-3 z-50">
              <div className="px-2 py-1.5 mb-2">
                <p className="text-xs text-muted-foreground mb-0.5 font-bold uppercase tracking-wide">Signed in as</p>
                <p className="text-sm font-bold truncate">{profile?.email}</p>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-xl" style={{ background: "#FFF3D6" }}>
                <Coins className="size-4" style={{ color: "#C97A3F" }} />
                <span className="text-sm font-black" style={{ color: "#C97A3F" }}>
                  {profile?.coin_balance ?? 0} coins
                </span>
              </div>
              <hr className="border-border mb-2" />
              <button
                onClick={() => { logout(); setProfileOpen(false); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-bold rounded-xl transition-colors cursor-pointer"
                style={{ color: "#E26656" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#FFE0DB")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Full-height action cards */}
      <main className="flex-1 grid sm:grid-cols-2">
        {/* Start Session */}
        <button
          onClick={() => navigate("/start")}
          className="group relative overflow-hidden flex flex-col items-center justify-center p-16 gap-10 text-center cursor-pointer border-r border-border bg-card hover:bg-primary/5 transition-all duration-200"
        >
          <div className="flex items-end gap-4 pointer-events-none">
            <Blob palette="peach" shape="classic" size={80} state="idle" showGround />
            <Blob palette="cream" shape="wide" size={170} state="encouraging" showGround />
            <Blob palette="honey" shape="baby" size={70} state="idle" showGround />
          </div>
          <div>
            <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 mx-auto group-hover:scale-105 transition-transform">
              <Play className="size-8 text-primary" />
            </div>
            <h3 className="font-black text-4xl mb-2">Start Session</h3>
            <p className="text-muted-foreground font-semibold text-base">General or specialized focus mode</p>
          </div>
        </button>

        {/* View Analytics */}
        <button
          onClick={() => navigate("/my-analytics")}
          className="group relative overflow-hidden flex flex-col items-center justify-center p-16 gap-10 text-center cursor-pointer bg-background hover:bg-green/5 transition-all duration-200"
        >
          <div className="pointer-events-none">
            <Blob palette="honey" shape="classic" size={200} state="idle" showGround />
          </div>
          <div>
            <div className="size-16 rounded-2xl flex items-center justify-center mb-4 mx-auto group-hover:scale-105 transition-transform" style={{ background: "#D9F0D3" }}>
              <BarChart2 className="size-8" style={{ color: "#7FB069" }} />
            </div>
            <h3 className="font-black text-4xl mb-2">View Analytics</h3>
            <p className="text-muted-foreground font-semibold text-base">Your focus insights</p>
          </div>
        </button>
      </main>

      {/* Bottom bar */}
      <div className="shrink-0 border-t border-border bg-card px-8 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-muted-foreground text-sm font-bold">
          <Flame className="size-4" style={{ color: "#F08F60" }} />
          <span>
            Hey{profile?.username ? `, ${profile.username}` : profile?.email ? `, ${profile.email.split("@")[0]}` : ""}! Keep your streak alive — start a session today!
          </span>
        </div>
        <a
          href={`${(import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '')}/download/overlay`}
          download="Pudge.dmg"
          className="shrink-0 flex items-center gap-2 px-4 py-2 border border-border/60 rounded-full text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
        >
          <Download className="size-3" />
          Get Pudge for desktop
        </a>
      </div>
    </div>
  );
}