"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, ArrowRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, ApiError, API_URL } from "@/lib/api";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { refresh } = useAuth();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  const [mode, setMode] = React.useState<"otp" | "password">("otp");
  const [step, setStep] = React.useState<"email" | "code">("email");
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function finishLogin() {
    await refresh();
    router.push(callbackUrl);
    router.refresh();
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/api/auth/otp/request", { method: "POST", json: { email } });
      setStep("code");
      toast({ title: "Code sent", description: `Check ${email} for your login code.`, variant: "success" });
    } catch (err) {
      if (err instanceof ApiError && err.code === "NOT_REGISTERED") {
        toast({ title: "No account yet", description: "Create your LuxeLoom account first.", variant: "error" });
        router.push(`/register?email=${encodeURIComponent(email)}&callbackUrl=${encodeURIComponent(callbackUrl)}`);
        return;
      }
      toast({ title: "Couldn't send code", description: "Please try again.", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/api/auth/otp/verify", { method: "POST", json: { email, code } });
      await finishLogin();
    } catch (err) {
      toast({
        title: "Invalid code",
        description: err instanceof Error ? err.message : "That code is incorrect or expired.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/api/auth/password/login", { method: "POST", json: { email, password } });
      await finishLogin();
    } catch (err) {
      if (err instanceof ApiError && err.code === "NOT_REGISTERED") {
        toast({ title: "No account yet", description: "Create your LuxeLoom account first.", variant: "error" });
        router.push(`/register?email=${encodeURIComponent(email)}&callbackUrl=${encodeURIComponent(callbackUrl)}`);
        return;
      }
      if (err instanceof ApiError && err.code === "NO_PASSWORD_SET") {
        toast({ title: "No password set yet", description: err.message, variant: "error" });
        return;
      }
      toast({
        title: "Couldn't log in",
        description: err instanceof Error ? err.message : "Check your email and password.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="font-display text-3xl">Welcome to LuxeLoom</h1>
        <p className="mt-2 text-sm text-foreground/60">
          {mode === "otp"
            ? step === "email"
              ? "Sign in with a one-time code sent to your email."
              : `Enter the 6-digit code sent to ${email}.`
            : "Sign in with your email and password."}
        </p>

        {mode === "otp" ? (
          step === "email" ? (
            <form onSubmit={handleSendCode} className="mt-8 flex flex-col gap-4">
              <Input
                type="email"
                required
                label="Email address"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" size="lg" disabled={loading} className="w-full">
                {loading ? "Sending…" : "Send login code"}
                <Mail className="h-4 w-4" />
              </Button>
              <button
                type="button"
                onClick={() => setMode("password")}
                className="text-xs text-foreground/50 underline underline-offset-2"
              >
                Log in with a password instead
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="mt-8 flex flex-col gap-4">
              <Input
                required
                label="6-digit code"
                placeholder="000000"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <Button type="submit" size="lg" disabled={loading} className="w-full">
                {loading ? "Verifying…" : "Verify & continue"}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <button
                type="button"
                onClick={() => setStep("email")}
                className="text-xs text-foreground/50 underline underline-offset-2"
              >
                Use a different email
              </button>
            </form>
          )
        ) : (
          <form onSubmit={handlePasswordLogin} className="mt-8 flex flex-col gap-4">
            <Input
              type="email"
              required
              label="Email address"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              type="password"
              required
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" size="lg" disabled={loading} className="w-full">
              {loading ? "Signing in…" : "Log in"}
              <Lock className="h-4 w-4" />
            </Button>
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setMode("otp")}
                className="text-foreground/50 underline underline-offset-2"
              >
                Use a login code instead
              </button>
              <Link href="/forgot-password" className="text-accent underline underline-offset-2">
                Forgot password?
              </Link>
            </div>
          </form>
        )}

        <div className="my-8 flex items-center gap-4 text-xs uppercase tracking-widest text-foreground/40">
          <div className="h-px flex-1 bg-border" />
          or
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button
          variant="outline"
          size="lg"
          className="w-full"
          magnetic={false}
          onClick={() => {
            window.location.href = `${API_URL}/api/auth/google`;
          }}
        >
          Continue with Google
        </Button>

        <p className="mt-6 text-center text-sm text-foreground/60">
          New to LuxeLoom?{" "}
          <Link
            href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            className="text-accent underline underline-offset-2"
          >
            Create an account
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
