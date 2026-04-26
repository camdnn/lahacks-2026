"use client";

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./components/ui/Button";
import { Input } from "./components/ui/Input";
import { Label } from "./components/ui/Label";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import { Blob, usePettable, type BlobState } from "./components/Blob";
import { useAuth } from "./context/AuthContext";

function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mouseX, setMouseX] = useState<number | null>(null);
  const [mouseY, setMouseY] = useState<number | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const eyeTarget = mouseX !== null && mouseY !== null ? { x: mouseX, y: mouseY } : null;

  const peachieRef = useRef<HTMLDivElement>(null);
  const pudgeRef = useRef<HTMLDivElement>(null);
  const bubsRef = useRef<HTMLDivElement>(null);

  const isActive = isTyping || isPasswordFocused;
  const { blobState: pudgeState, onPet: onPetPudge } = usePettable(getPudgeState());
  const { blobState: peachieState, onPet: onPetPeachie } = usePettable(getCompanionState(0));
  const { blobState: bubsState, onPet: onPetBubs } = usePettable(getCompanionState(1));

  const computeLean = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (!ref.current || mouseX === null) return 0;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const deltaX = mouseX - centerX;
    const multiplier = isActive ? 2.2 : 1;
    return Math.max(-8, Math.min(8, (-deltaX / 100) * multiplier));
  };

  const getPudgeState = (): BlobState => {
    if (isLoading) return "walking";
    if (error) return "sad";
    if (isPasswordFocused && showPassword) return "distracted";
    if (isPasswordFocused) return "focused";
    if (isTyping) return "encouraging";
    return "idle";
  };

  const getCompanionState = (idx: number): BlobState => {
    if (isLoading) return idx === 0 ? "cheering" : "walking";
    if (error) return "sad";
    return "idle";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await register(email, password, username || undefined);
      navigate("/");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? "Could not create account. Try a different email.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left mascot panel */}
      <div className="relative hidden lg:flex flex-col justify-between bg-linear-to-br from-primary/90 via-primary to-primary/80 p-12 text-primary-foreground">
        <div className="relative z-20">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <div className="size-8 rounded-lg bg-primary-foreground/10 backdrop-blur-sm flex items-center justify-center">
              <Sparkles className="size-4" />
            </div>
            <span>Flicker to Flow</span>
          </div>
        </div>

        <div className="relative z-20 flex items-end justify-center h-125">
          <div className="flex items-end gap-6 pb-8">
            <div ref={peachieRef}>
              <Blob
                state={peachieState}
                palette="peach"
                shape="classic"
                size={110}
                eyeTarget={eyeTarget}
                lean={computeLean(peachieRef)}
                showGround
                onClick={onPetPeachie}
              />
            </div>
            <div ref={pudgeRef}>
              <Blob
                state={pudgeState}
                palette="cream"
                shape="wide"
                size={210}
                eyeTarget={eyeTarget}
                lean={computeLean(pudgeRef)}
                showGround
                onClick={onPetPudge}
              />
            </div>
            <div ref={bubsRef}>
              <Blob
                state={bubsState}
                palette="honey"
                shape="baby"
                size={90}
                eyeTarget={eyeTarget}
                lean={computeLean(bubsRef)}
                showGround
                onClick={onPetBubs}
              />
            </div>
          </div>
        </div>

        <div className="relative z-20 flex items-center gap-8 text-sm text-primary-foreground/60">
          <a href="#" className="hover:text-primary-foreground transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-primary-foreground transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-primary-foreground transition-colors">Contact</a>
        </div>

        <div className="absolute inset-0 bg-grid-white/[0.05] bg-size-[20px_20px]" />
        <div className="absolute top-1/4 right-1/4 size-64 bg-primary-foreground/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 size-96 bg-primary-foreground/5 rounded-full blur-3xl" />
      </div>

      {/* Right register form */}
      <div className="flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-105">
          <div className="lg:hidden flex items-center justify-center gap-2 text-lg font-semibold mb-12">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="size-4 text-primary" />
            </div>
            <span>Flicker to Flow</span>
          </div>

          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold tracking-tight mb-2">Create an account</h1>
            <p className="text-muted-foreground text-sm">Start your focus journey today</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="pudge"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onFocus={() => setIsTyping(true)}
                onBlur={() => setIsTyping(false)}
                className="h-12 bg-background border-border/60 focus:border-primary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="anna@gmail.com"
                value={email}
                autoComplete="off"
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setIsTyping(true)}
                onBlur={() => setIsTyping(false)}
                required
                className="h-12 bg-background border-border/60 focus:border-primary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setIsPasswordFocused(true)}
                  onBlur={() => setIsPasswordFocused(false)}
                  required
                  className="h-12 pr-10 bg-background border-border/60 focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 text-sm text-red-400 bg-red-950/20 border border-red-900/30 rounded-lg">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base font-medium"
              size="lg"
              disabled={isLoading}
            >
              {isLoading ? "Creating account..." : "Sign Up"}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground mt-8">
            Already have an account?{" "}
            <a href="/login" className="text-foreground font-medium hover:underline">
              Log in
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Component = RegisterPage;
