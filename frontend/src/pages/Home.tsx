import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Blob } from "../components/Blob";
import { Coins, Flame, Play, BarChart2, LogOut, ChevronDown, ShoppingBag, HelpCircle, Info } from "lucide-react";

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
      <header className="flex items-center justify-between px-8 py-4 border-b border-border bg-card">
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
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center gap-12 px-8 py-12">
        {/* Welcome */}
        <div className="text-center">
          <h1 className="text-4xl font-black tracking-tight mb-2">
            Hey{profile?.username ? `, ${profile.username}` : profile?.email ? `, ${profile.email.split("@")[0]}` : ""}!
          </h1>
          <p className="text-muted-foreground text-lg font-semibold">Ready to crush your focus session?</p>
        </div>

        {/* Mascot trio */}
        <div className="flex items-end gap-6">
          <Blob palette="peach" shape="classic" size={90} state="idle" showGround />
          <Blob palette="cream" shape="wide" size={180} state="encouraging" showGround />
          <Blob palette="honey" shape="baby" size={75} state="idle" showGround />
        </div>

        {/* Action cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-2xl">
          <button
            onClick={() => navigate("/start")}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 text-left hover:border-primary hover:shadow-lg transition-all cursor-pointer"
          >
            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Play className="size-6 text-primary" />
            </div>
            <h3 className="font-black text-lg mb-1">Start Session</h3>
            <p className="text-sm text-muted-foreground font-semibold">General or specialized focus mode</p>
          </button>

          <button
            onClick={() => navigate("/store")}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 text-left hover:border-primary hover:shadow-lg transition-all cursor-pointer"
          >
            <div className="size-12 rounded-xl flex items-center justify-center mb-4" style={{ background: "#FFF3D6" }}>
              <ShoppingBag className="size-6" style={{ color: "#C97A3F" }} />
            </div>
            <h3 className="font-black text-lg mb-1">Character Shop</h3>
            <p className="text-sm text-muted-foreground font-semibold">Spend coins on new blobs</p>
          </button>

          <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 text-left opacity-40 cursor-not-allowed select-none">
            <div className="size-12 rounded-xl flex items-center justify-center mb-4" style={{ background: "#D9F0D3" }}>
              <BarChart2 className="size-6" style={{ color: "#7FB069" }} />
            </div>
            <h3 className="font-black text-lg mb-1">View Analytics</h3>
            <p className="text-sm text-muted-foreground font-semibold">Coming soon</p>
          </div>
        </div>

{/* Streak */}
        <div className="flex items-center gap-2 text-muted-foreground text-sm font-bold">
          <Flame className="size-4" style={{ color: "#F08F60" }} />
          <span>Keep your streak alive — start a session today!</span>
        </div>

        {/* Secondary links */}
        <div className="flex items-center gap-6 text-xs font-bold text-muted-foreground">
          <button
            onClick={() => navigate("/faq")}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer bg-transparent border-none font-bold text-xs"
            style={{ fontFamily: "inherit" }}
          >
            <HelpCircle className="size-3.5" />
            FAQ
          </button>
          <button
            onClick={() => navigate("/about")}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer bg-transparent border-none font-bold text-xs"
            style={{ fontFamily: "inherit" }}
          >
            <Info className="size-3.5" />
            About Bloom
          </button>
        </div>
      </main>
    </div>
  );
}
