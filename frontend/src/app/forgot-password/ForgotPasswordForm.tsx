"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

export default function ForgotPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { refresh } = useAuth();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  const [step, setStep] = React.useState<"email" | "reset">("email");
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleRequestCode(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/api/auth/password/forgot", { method: "POST", json: { email } });
      setStep("reset");
      toast({
        title: "Check your email",
        description: `If an account uses ${email}, we've sent a reset code.`,
        variant: "success",
      });
    } catch (err) {
      toast({ title: "Couldn't send code", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "error" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "error" });
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/api/auth/password/reset", { method: "POST", json: { email, code, password } });
      await refresh();
      toast({ title: "Password updated", description: "You're logged in.", variant: "success" });
      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      toast({
        title: "Couldn't reset password",
        description: err instanceof Error ? err.message : "Check the code and try again.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="font-display text-3xl">Reset your password</h1>
        <p className="mt-2 text-sm text-foreground/60">
          {step === "email"
            ? "Enter your account email and we'll send you a reset code."
            : `Enter the code we sent to ${email} and choose a new password.`}
        </p>

        {step === "email" ? (
          <form onSubmit={handleRequestCode} className="mt-8 flex flex-col gap-4">
            <Input
              type="email"
              required
              label="Email address"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" size="lg" disabled={loading} className="w-full">
              {loading ? "Sending…" : "Send reset code"}
              <Mail className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="mt-8 flex flex-col gap-4">
            <Input
              required
              label="6-digit code"
              placeholder="000000"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Input
              type="password"
              required
              minLength={8}
              label="New password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Input
              type="password"
              required
              minLength={8}
              label="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <Button type="submit" size="lg" disabled={loading} className="w-full">
              {loading ? "Resetting…" : "Reset password & log in"}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <div className="flex justify-between text-xs text-foreground/50">
              <button type="button" onClick={() => setStep("email")} className="underline underline-offset-2">
                Use a different email
              </button>
              <button type="button" disabled={loading} onClick={() => handleRequestCode()} className="underline underline-offset-2">
                Resend code
              </button>
            </div>
          </form>
        )}

        <p className="mt-8 text-center text-sm text-foreground/60">
          Remembered your password?{" "}
          <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="text-accent underline underline-offset-2">
            Log in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
