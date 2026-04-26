"use client";

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./components/ui/Button";
import { Input } from "./components/ui/Input";
import { Label } from "./components/ui/Label";
import { Eye, EyeOff } from "lucide-react";
import { Blob, type BlobState } from "./components/Blob";
import { useAuth } from "./context/AuthContext";

const GoogleIcon = () => (
  <svg className="mr-2 size-5" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

const GitHubIcon = () => (
  <svg
    className="mr-2 size-5"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

function RegisterPage() {
  const { registerWithEmail, loginWithGoogle, loginWithGitHub } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
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

  const eyeTarget =
    mouseX !== null && mouseY !== null ? { x: mouseX, y: mouseY } : null;
  const peachieRef = useRef<HTMLDivElement>(null);
  const pudgeRef = useRef<HTMLDivElement>(null);
  const bubsRef = useRef<HTMLDivElement>(null);
  const isActive = isTyping || isPasswordFocused;

  const computeLean = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (!ref.current || mouseX === null) return 0;
    const rect = ref.current.getBoundingClientRect();
    const deltaX = mouseX - (rect.left + rect.width / 2);
    return Math.max(-8, Math.min(8, (-deltaX / 100) * (isActive ? 2.2 : 1)));
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

  const isValidEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      await registerWithEmail(email, password);
      navigate("/");
    } catch (err: unknown) {
      setError(
        (err as { message?: string })?.message ??
          "Could not create account. Try a different email.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    try {
      await loginWithGoogle();
    } catch (err: unknown) {
      setError(
        (err as { message?: string })?.message ?? "Google sign-in failed.",
      );
    }
  };

  const handleGitHub = async () => {
    setError("");
    try {
      await loginWithGitHub();
    } catch (err: unknown) {
      setError(
        (err as { message?: string })?.message ?? "GitHub sign-in failed.",
      );
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* ── Left panel – mascots ── */}
      <div
        className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden"
        style={{ background: "#FFFAF1", borderRight: "1.5px solid #EAD7BE" }}
      >
        {/* Logo */}
        <div className="relative z-10 flex items-center gap-2.5">
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: "#F08F60",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 6px rgba(240,143,96,0.35)",
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#FFE8D9",
              }}
            />
          </div>
          <span
            className="font-black text-lg tracking-tight"
            style={{ color: "#3D2A1B" }}
          >
            Bloom
          </span>
          <span className="text-xs font-semibold" style={{ color: "#806550" }}>
            focus, with friends
          </span>
        </div>

        {/* Blobs */}
        <div className="relative z-10 flex flex-1 items-end justify-center pb-10">
          <div className="flex items-end gap-10">
            <div ref={peachieRef}>
              <Blob
                state={getCompanionState(0)}
                palette="peach"
                shape="classic"
                size={135}
                eyeTarget={eyeTarget}
                lean={computeLean(peachieRef)}
                showGround
              />
            </div>
            <div ref={pudgeRef}>
              <Blob
                state={getPudgeState()}
                palette="cream"
                shape="wide"
                size={215}
                eyeTarget={eyeTarget}
                lean={computeLean(pudgeRef)}
                showGround
              />
            </div>
            <div ref={bubsRef}>
              <Blob
                state={getCompanionState(1)}
                palette="honey"
                shape="baby"
                size={115}
                eyeTarget={eyeTarget}
                lean={computeLean(bubsRef)}
                showGround
              />
            </div>
          </div>
        </div>

        {/* Footer links */}
        <div
          className="relative z-10 flex items-center gap-8 text-sm font-semibold"
          style={{ color: "rgba(61,42,27,0.45)" }}
        >
          <a
            href="#"
            className="hover:opacity-80 transition-opacity cursor-pointer"
            style={{ color: "inherit" }}
          >
            Privacy
          </a>
          <a
            href="#"
            className="hover:opacity-80 transition-opacity cursor-pointer"
            style={{ color: "inherit" }}
          >
            Terms
          </a>
          <a
            href="#"
            className="hover:opacity-80 transition-opacity cursor-pointer"
            style={{ color: "inherit" }}
          >
            Contact
          </a>
        </div>

        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-48 rounded-full blur-3xl pointer-events-none"
          style={{ background: "rgba(240,143,96,0.12)" }}
        />
      </div>

      {/* ── Right panel – form ── */}
      <div className="flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2.5 mb-12">
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: "#F08F60",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: "#FFE8D9",
                }}
              />
            </div>
            <span className="font-black text-lg tracking-tight">Bloom</span>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-black tracking-tight mb-2">
              Create an account
            </h1>
            <p className="text-muted-foreground text-sm font-semibold">
              Start your focus journey today
            </p>
          </div>

          {/* OAuth */}
          <div className="flex flex-col gap-3 mb-6">
            <Button
              variant="outline"
              className="w-full h-11 bg-card border-border hover:bg-accent font-bold cursor-pointer"
              type="button"
              onClick={handleGoogle}
            >
              <GoogleIcon />
              Continue with Google
            </Button>
            <Button
              variant="outline"
              className="w-full h-11 bg-card border-border hover:bg-accent font-bold cursor-pointer"
              type="button"
              onClick={handleGitHub}
            >
              <GitHubIcon />
              Continue with GitHub
            </Button>
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-3 text-muted-foreground font-black tracking-widest">
                or
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-black">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                autoComplete="off"
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setIsTyping(true)}
                onBlur={() => setIsTyping(false)}
                required
                className="h-11 bg-card border-border focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-black">
                Password
              </Label>
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
                  className="h-11 pr-10 bg-card border-border focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div
                className="p-3 text-sm font-bold rounded-xl border"
                style={{
                  background: "#FFE0DB",
                  color: "#E26656",
                  borderColor: "#E26656",
                }}
              >
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 text-base font-black cursor-pointer"
              disabled={isLoading}
            >
              {isLoading ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6 font-semibold">
            Already have an account?{" "}
            <button
              onClick={() => navigate("/login")}
              className="font-black hover:underline cursor-pointer"
              style={{ color: "#3D2A1B" }}
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export const Component = RegisterPage;
