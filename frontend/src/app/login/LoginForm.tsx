"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, ArrowRight } from "lucide-react";
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

  const [step, setStep] = React.useState<"email" | "code">("email");
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);

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
      await refresh();
      router.push(callbackUrl);
      router.refresh();
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

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="font-display text-3xl">Welcome to LuxeLoom</h1>
        <p className="mt-2 text-sm text-foreground/60">
          {step === "email" ? "Sign in with a one-time code sent to your email." : `Enter the 6-digit code sent to ${email}.`}
        </p>

        {step === "email" ? (
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
