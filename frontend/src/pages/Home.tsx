import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Blob } from "../components/Blob";
import { Sparkles, Coins, Flame, Play, BarChart2, LogOut, ChevronDown, Home } from "lucide-react";

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
      <header className="flex items-center justify-between px-8 py-4 border-b border-border/40">
        {/* Logo — click to return to landing page */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-lg font-bold cursor-pointer hover:opacity-75 transition-opacity"
        >
          <Sparkles className="size-5 text-primary" />
          <span>Flicker to Flow</span>
        </button>

        {/* Profile dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setProfileOpen(o => !o)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-accent transition-colors cursor-pointer"
          >
            <div className="size-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary select-none">
              {profile?.email?.[0]?.toUpperCase() ?? "U"}
            </div>
            <span className="text-sm font-medium max-w-45 truncate">
              {profile?.email ?? "Account"}
            </span>
            <ChevronDown className={`size-3 text-muted-foreground transition-transform ${profileOpen ? "rotate-180" : ""}`} />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-border/60 bg-card shadow-lg p-3 z-50">
              <div className="px-2 py-1.5 mb-2">
                <p className="text-xs text-muted-foreground mb-0.5">Signed in as</p>
                <p className="text-sm font-semibold truncate">{profile?.email}</p>
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 mb-2 bg-amber-500/10 rounded-lg">
                <Coins className="size-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-600">
                  {profile?.coin_balance ?? 0} coins
                </span>
              </div>
              <hr className="border-border/40 mb-2" />
              <button
                onClick={() => { logout(); setProfileOpen(false); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
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
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            Hey{profile?.username ? `, ${profile.username}` : profile?.email ? `, ${profile.email.split("@")[0]}` : ""}!
          </h1>
          <p className="text-muted-foreground text-lg">Ready to crush your focus session?</p>
        </div>

        {/* Mascot trio */}
        <div className="flex items-end gap-6">
          <Blob palette="peach" shape="classic" size={90} state="idle" showGround />
          <Blob palette="cream" shape="wide" size={180} state="encouraging" showGround />
          <Blob palette="honey" shape="baby" size={75} state="idle" showGround />
        </div>

        {/* Action cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-lg">
          <button
            onClick={() => navigate("/start")}
            className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6 text-left hover:border-primary/40 hover:shadow-lg transition-all cursor-pointer"
          >
            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Play className="size-6 text-primary" />
            </div>
            <h3 className="font-bold text-lg mb-1">Start Session</h3>
            <p className="text-sm text-muted-foreground">General or specialized focus mode</p>
          </button>

          <div className="group relative overflow-hidden rounded-2xl border border-border/40 bg-card/50 p-6 text-left opacity-50 cursor-not-allowed select-none">
            <div className="size-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4">
              <BarChart2 className="size-6 text-emerald-600" />
            </div>
            <h3 className="font-bold text-lg mb-1">View Analytics</h3>
            <p className="text-sm text-muted-foreground">Coming soon</p>
          </div>
        </div>

        {/* Back to landing */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <Home className="size-4" />
          Back to home page
        </button>

        {/* Streak */}
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Flame className="size-4 text-orange-500" />
          <span>Keep your streak alive — start a session today!</span>
        </div>
      </main>
    </div>
  );
}
