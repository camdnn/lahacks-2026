"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "./components/ui/Button";
import { Input } from "./components/ui/Input";
import { Label } from "./components/ui/Label";
import { Checkbox } from "./components/ui/Checkbox";
import { Eye, EyeOff, Mail, Sparkles } from "lucide-react";
import { Blob, type BlobState } from "./components/Blob";





function LoginPage() {
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

  const eyeTarget = mouseX !== null && mouseY !== null ? { x: mouseX, y: mouseY } : null;

  const peachieRef = useRef<HTMLDivElement>(null);
  const pudgeRef = useRef<HTMLDivElement>(null);
  const bubsRef = useRef<HTMLDivElement>(null);

  const isActive = isTyping || isPasswordFocused;

  const computeLean = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (!ref.current || mouseX === null) return 0;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const deltaX = mouseX - centerX;
    const multiplier = isActive ? 2.2 : 1;
    return Math.max(-8, Math.min(8, (-deltaX / 100) * multiplier));
  };

  const getPudgeState = (): BlobState => {
    if (isLoading) return 'walking';
    if (error) return 'sad';
    if (isPasswordFocused && showPassword) return 'distracted';
    if (isPasswordFocused) return 'focused';
    if (isTyping) return 'encouraging';
    return 'idle';
  };

  const getCompanionState = (idx: number): BlobState => {
    if (isLoading) return idx === 0 ? 'cheering' : 'walking';
    if (error) return 'sad';
    if (isTyping) return 'idle';
    return 'idle';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Simulate API delay (quick)
    await new Promise(resolve => setTimeout(resolve, 300));

    // Mock authentication - validate against dummy credentials
    if (email === "erik@gmail.com" && password === "1234") {
      console.log("✅ Login successful!");
      alert("Login successful! Welcome, Erik!");
      // In a real app, you would:
      // - Store auth token
      // - Redirect to dashboard
      // - Set user session
    } else {
      setError("Invalid email or password. Please try again.");
      console.log("❌ Login failed");
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left Content Section */}
      <div className="relative hidden lg:flex flex-col justify-between bg-linear-to-br from-primary/90 via-primary to-primary/80 p-12 text-primary-foreground">
        <div className="relative z-20">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <div className="size-8 rounded-lg bg-primary-foreground/10 backdrop-blur-sm flex items-center justify-center">
              <Sparkles className="size-4" />
            </div>
            <span>YourBrand</span>
          </div>
        </div>

        <div className="relative z-20 flex items-end justify-center h-125">
          {/* Blob mascots — Pudge is main, Peachie + Bubs as companions */}
          <div className="flex items-end gap-6 pb-8">
            {/* Peachie — small left companion */}
            <div ref={peachieRef}>
              <Blob
                state={getCompanionState(0)}
                palette="peach"
                shape="classic"
                size={110}
                eyeTarget={eyeTarget}
                lean={computeLean(peachieRef)}
                showGround
              />
            </div>
            {/* Pudge — main mascot (cream, wide, cozy) */}
            <div ref={pudgeRef}>
              <Blob
                state={getPudgeState()}
                palette="cream"
                shape="wide"
                size={210}
                eyeTarget={eyeTarget}
                lean={computeLean(pudgeRef)}
                showGround
              />
            </div>
            {/* Bubs — small right companion */}
            <div ref={bubsRef}>
              <Blob
                state={getCompanionState(1)}
                palette="honey"
                shape="baby"
                size={90}
                eyeTarget={eyeTarget}
                lean={computeLean(bubsRef)}
                showGround
              />
            </div>
          </div>
        </div>

        <div className="relative z-20 flex items-center gap-8 text-sm text-primary-foreground/60">
          <a href="#" className="hover:text-primary-foreground transition-colors">
            Privacy Policy
          </a>
          <a href="#" className="hover:text-primary-foreground transition-colors">
            Terms of Service
          </a>
          <a href="#" className="hover:text-primary-foreground transition-colors">
            Contact
          </a>
        </div>

        {/* Decorative elements */}
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-size-[20px_20px]" />
        <div className="absolute top-1/4 right-1/4 size-64 bg-primary-foreground/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 size-96 bg-primary-foreground/5 rounded-full blur-3xl" />
      </div>

      {/* Right Login Section */}
      <div className="flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-105">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 text-lg font-semibold mb-12">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="size-4 text-primary" />
            </div>
            <span>YourBrand</span>
          </div>

          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome back!</h1>
            <p className="text-muted-foreground text-sm">Please enter your details</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
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
                  {showPassword ? (
                    <EyeOff className="size-5" />
                  ) : (
                    <Eye className="size-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox id="remember" />
                <Label
                  htmlFor="remember"
                  className="text-sm font-normal cursor-pointer"
                >
                  Remember for 30 days
                </Label>
              </div>
              <a
                href="#"
                className="text-sm text-primary hover:underline font-medium"
              >
                Forgot password?
              </a>
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
              {isLoading ? "Signing in..." : "Log in"}
            </Button>
          </form>

          {/* Social Login */}
          <div className="mt-6">
            <Button 
              variant="outline" 
              className="w-full h-12 bg-background border-border/60 hover:bg-accent"
              type="button"
            >
              <Mail className="mr-2 size-5" />
              Log in with Google
            </Button>
          </div>

          {/* Sign Up Link */}
          <div className="text-center text-sm text-muted-foreground mt-8">
            Don't have an account?{" "}
            <a href="#" className="text-foreground font-medium hover:underline">
              Sign Up
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}



export const Component = LoginPage;