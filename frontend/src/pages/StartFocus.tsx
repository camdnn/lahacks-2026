import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { Blob } from "../components/Blob";
import { ArrowLeft, Clock, Globe, Zap } from "lucide-react";

const DURATIONS = [15, 25, 45, 60, 90];

export default function StartFocus() {
  const navigate = useNavigate();
  const { start } = useSession();
  const [sessionType, setSessionType] = useState<"general" | "specialized">("general");
  const [duration, setDuration]       = useState(25);
  const [allowedTabInput, setAllowedTabInput] = useState("");
  const [allowedTabs, setAllowedTabs] = useState<string[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");

  const addTab = () => {
    const val = allowedTabInput.trim();
    if (val && !allowedTabs.includes(val)) {
      setAllowedTabs((t) => [...t, val]);
    }
    setAllowedTabInput("");
  };

  const handleStart = async () => {
    setLoading(true);
    setError("");
    try {
      await start(sessionType, duration, sessionType === "specialized" ? allowedTabs : []);
      navigate("/session");
    } catch {
      setError("Failed to start session. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-lg">
        <button
          onClick={() => navigate("/home")}
          className="flex cursor-pointer items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors font-bold text-sm"
        >
          <ArrowLeft className="size-4" /> Back
        </button>

        <div className="flex justify-center mb-8">
          <Blob palette="cream" shape="wide" size={130} state="encouraging" showGround />
        </div>

        <h1 className="text-3xl font-black text-center tracking-tight mb-2">Start a Focus Session</h1>
        <p className="text-muted-foreground text-center mb-8 font-semibold">Pudge will keep an eye on you</p>

        {/* Session type */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {(["general", "specialized"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setSessionType(t)}
              className={`rounded-2xl border-2 p-4 text-left cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md active:scale-[0.98] ${
                sessionType === t
                  ? "border-primary bg-accent shadow-sm"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <div className="mb-2" style={{ color: sessionType === t ? "#F08F60" : "#806550" }}>
                {t === "general" ? <Zap className="size-5" /> : <Globe className="size-5" />}
              </div>
              <div className={`font-black capitalize ${sessionType === t ? "text-primary" : "text-foreground"}`}>
                {t}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 font-semibold">
                {t === "general" ? "Full focus, all distractors tracked" : "Specific tabs allowed"}
              </div>
            </button>
          ))}
        </div>

        {/* Duration */}
        <div className="mb-6">
          <Label className="mb-3 block font-black text-sm uppercase tracking-wide text-muted-foreground">
            Session Duration
          </Label>
          <div className="flex gap-2 flex-wrap">
            {DURATIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`flex items-center cursor-pointer gap-1.5 px-4 py-2 rounded-full text-sm font-black border-2 transition-all hover:scale-105 active:scale-95 ${
                  duration === d
                    ? "border-primary bg-accent text-primary scale-105"
                    : "border-border bg-card text-foreground hover:border-primary/50"
                }`}
              >
                <Clock className="size-3" /> {d}m
              </button>
            ))}
          </div>
        </div>

        {/* Allowed tabs (specialized only) */}
        {sessionType === "specialized" && (
          <div className="mb-6">
            <Label className="mb-3 block font-black text-sm uppercase tracking-wide text-muted-foreground">
              Allowed Sites / Keywords
            </Label>
            <div className="flex gap-2 mb-3">
              <Input
                value={allowedTabInput}
                onChange={(e) => setAllowedTabInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTab()}
                placeholder="e.g. React Docs, GitHub"
                className="h-10 bg-card border-border"
              />
              <Button type="button" onClick={addTab} variant="outline" className="h-10 px-4 border-border bg-card hover:bg-accent hover:border-primary font-black">
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {allowedTabs.map((tab) => (
                <span
                  key={tab}
                  className="flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold"
                  style={{ background: "#FFE8D9", color: "#F08F60" }}
                >
                  {tab}
                  <button
                    onClick={() => setAllowedTabs((t) => t.filter((x) => x !== tab))}
                    className="ml-1 opacity-60 hover:opacity-100 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 text-sm font-bold rounded-xl mb-4 border"
            style={{ background: "#FFE0DB", color: "#E26656", borderColor: "#E26656" }}>
            {error}
          </div>
        )}

        <Button
          onClick={handleStart}
          disabled={loading}
          className="w-full h-12 cursor-pointer text-base font-black tracking-tight transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
        >
          {loading ? "Starting…" : `Start ${duration}min Session`}
        </Button>
      </div>
    </div>
  );
}
