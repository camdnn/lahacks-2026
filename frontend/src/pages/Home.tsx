import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Blob } from "../components/Blob";
import { Sparkles, Coins, Flame, LogOut, Play, Download } from "lucide-react";

export default function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-border/40">
        <div className="flex items-center gap-2 text-lg font-bold">
          <Sparkles className="size-5 text-primary" />
          <span>Flicker to Flow</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 rounded-full text-amber-600 font-semibold text-sm">
            <Coins className="size-4" />
            {user?.coin_balance ?? 0} coins
          </div>
          <button onClick={logout} className="text-muted-foreground hover:text-foreground transition-colors">
            <LogOut className="size-5" />
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center gap-12 px-8 py-12">
        {/* Welcome */}
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            Hey{user?.username ? `, ${user.username}` : ""}! 👋
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
            className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6 text-left hover:border-primary/40 hover:shadow-lg transition-all"
          >
            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Play className="size-6 text-primary" />
            </div>
            <h3 className="font-bold text-lg mb-1">Start Session</h3>
            <p className="text-sm text-muted-foreground">General or specialized focus mode</p>
          </button>

          <button
            onClick={() => navigate("/cv-test")}
            className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6 text-left hover:border-primary/40 hover:shadow-lg transition-all"
          >
            <div className="size-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4">
              <span className="text-2xl">📷</span>
            </div>
            <h3 className="font-bold text-lg mb-1">CV Test</h3>
            <p className="text-sm text-muted-foreground">Test camera detection live</p>
          </button>
        </div>

        {/* Download overlay */}
        <a
          href="http://localhost:8000/download/overlay"
          download="Pudge.dmg"
          className="group flex items-center gap-4 w-full max-w-lg rounded-2xl border border-border/60 bg-card px-6 py-4 hover:border-primary/40 hover:shadow-lg transition-all"
        >
          <div className="size-12 shrink-0 rounded-xl bg-orange-500/10 flex items-center justify-center">
            <Download className="size-6 text-orange-500 group-hover:translate-y-0.5 transition-transform" />
          </div>
          <div className="flex-1 text-left">
            <div className="font-bold text-base">Download Pudge Overlay</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Desktop app — Pudge floats above every window
            </div>
          </div>
          <span className="text-xs text-muted-foreground border border-border/60 rounded-full px-2.5 py-1 shrink-0">
            .dmg
          </span>
        </a>

        {/* Streak */}
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Flame className="size-4 text-orange-500" />
          <span>Keep your streak alive — start a session today!</span>
        </div>
      </main>
    </div>
  );
}
