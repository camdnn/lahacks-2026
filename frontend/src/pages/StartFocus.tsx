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
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="size-4" /> Back
        </button>

        <div className="flex justify-center mb-8">
          <Blob palette="cream" shape="wide" size={130} state="encouraging" showGround />
        </div>

        <h1 className="text-3xl font-bold text-center mb-2">Start a Focus Session</h1>
        <p className="text-muted-foreground text-center mb-8">Pudge will keep an eye on you 👀</p>

        {/* Session type */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {(["general", "specialized"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setSessionType(t)}
              className={`rounded-xl border p-4 text-left transition-all ${
                sessionType === t
                  ? "border-primary bg-primary/5"
                  : "border-border/60 hover:border-border"
              }`}
            >
              <div className="text-xl mb-1">{t === "general" ? <Zap className="size-5" /> : <Globe className="size-5" />}</div>
              <div className="font-semibold capitalize">{t}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {t === "general" ? "Full focus, all distractors tracked" : "Specific tabs allowed"}
              </div>
            </button>
          ))}
        </div>

        {/* Duration */}
        <div className="mb-6">
          <Label className="mb-2 block">Session Duration</Label>
          <div className="flex gap-2 flex-wrap">
            {DURATIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                  duration === d
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/60 hover:border-border"
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
            <Label className="mb-2 block">Allowed Sites / Keywords</Label>
            <div className="flex gap-2 mb-2">
              <Input
                value={allowedTabInput}
                onChange={(e) => setAllowedTabInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTab()}
                placeholder="e.g. React Docs, GitHub"
                className="h-10"
              />
              <Button type="button" onClick={addTab} variant="outline" className="h-10 px-4">Add</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {allowedTabs.map((tab) => (
                <span
                  key={tab}
                  className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                >
                  {tab}
                  <button onClick={() => setAllowedTabs((t) => t.filter((x) => x !== tab))} className="ml-1 opacity-60 hover:opacity-100">×</button>
                </span>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <Button onClick={handleStart} disabled={loading} className="w-full h-12 text-base font-semibold">
          {loading ? "Starting…" : `Start ${duration}min Session`}
        </Button>
      </div>
    </div>
  );
}
