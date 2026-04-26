import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Blob } from "../components/Blob";
import { Coins, BarChart2, LogOut, ChevronDown, ShoppingBag, Play } from "lucide-react";

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
      <header className="flex items-center justify-between px-8 py-4 border-b border-border bg-card shrink-0">
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

        <div className="flex items-center gap-3">
          {/* Store link */}
          <button
            onClick={() => navigate("/store")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border hover:bg-accent transition-colors cursor-pointer text-sm font-bold"
          >
            <ShoppingBag className="size-4" style={{ color: "#C97A3F" }} />
            <span className="text-foreground">Store</span>
          </button>

          {/* Profile dropdown */}
          <div className="relative" ref={dropdownRef}>
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
                  onClick={() => { setProfileOpen(false); navigate("/store"); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-bold rounded-xl transition-colors cursor-pointer mb-1"
                  onMouseEnter={e => (e.currentTarget.style.background = "#FFF3D6")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <ShoppingBag className="size-4" style={{ color: "#F08F60" }} />
                  Character Shop
                </button>
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
        </div>
      </header>

      {/* Full-screen two-panel layout */}
      <main className="flex-1 flex overflow-hidden">
        {/* Start Session */}
        <button
          onClick={() => navigate("/start")}
          className="group flex-1 flex flex-col items-center justify-center gap-8 bg-background hover:bg-primary/5 transition-colors duration-200 cursor-pointer border-none"
        >
          <div className="pointer-events-none">
            <Blob palette="cream" shape="wide" size={180} state="encouraging" showGround />
          </div>
          <div className="flex flex-col items-center gap-3">
            <div
              className="size-16 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform"
              style={{ background: "rgba(240,143,96,0.12)" }}
            >
              <Play className="size-8 text-primary" />
            </div>
            <h2 className="font-black text-3xl tracking-tight">Start Session</h2>
            <p className="text-muted-foreground font-semibold text-base">General or specialized focus mode</p>
          </div>
        </button>

        {/* Divider */}
        <div className="w-px bg-border shrink-0" />

        {/* View Analytics */}
        <button
          onClick={() => navigate("/my-analytics")}
          className="group flex-1 flex flex-col items-center justify-center gap-8 bg-background hover:bg-green-500/5 transition-colors duration-200 cursor-pointer border-none"
        >
          <div className="pointer-events-none">
            <Blob palette="honey" shape="classic" size={180} state="idle" showGround />
          </div>
          <div className="flex flex-col items-center gap-3">
            <div
              className="size-16 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform"
              style={{ background: "#D9F0D3" }}
            >
              <BarChart2 className="size-8" style={{ color: "#7FB069" }} />
            </div>
            <h2 className="font-black text-3xl tracking-tight">View Analytics</h2>
            <p className="text-muted-foreground font-semibold text-base">Your focus insights</p>
          </div>
        </button>
      </main>
    </div>
  );
}
