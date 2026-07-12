"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldCheck, ArrowRight, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, ApiError } from "@/lib/api";

/** One-stop admin bootstrap: grants the ADMIN role via the key-guarded
 * backend route, then chains straight into the normal email-OTP login so
 * you leave this page already signed in at /admin. */
export default function AdminSetupForm() {
  const router = useRouter();
  const { toast } = useToast();
  const { refresh } = useAuth();

  const [step, setStep] = React.useState<"setup" | "code">("setup");
  const [email, setEmail] = React.useState("");
  const [key, setKey] = React.useState("");
  const [code, setCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/api/auth/admin/setup", { method: "POST", json: { email, key } });
      // Account now exists with the ADMIN role — send the login code.
      await apiFetch("/api/auth/otp/request", { method: "POST", json: { email } });
      setStep("code");
      toast({ title: "Admin role granted", description: `Login code sent to ${email}.`, variant: "success" });
    } catch (err) {
      const detail =
        err instanceof ApiError && err.status === 403
          ? "The setup key doesn't match ADMIN_SETUP_KEY in the backend .env."
          : err instanceof Error
            ? err.message
            : undefined;
      toast({ title: "Setup failed", description: detail, variant: "error" });
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
      toast({ title: "Signed in as admin", variant: "success" });
      router.push("/admin");
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
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-accent" />
          <h1 className="font-display text-3xl">Admin setup</h1>
        </div>
        <p className="mt-2 text-sm text-foreground/60">
          {step === "setup"
            ? "Creates (or promotes) an ADMIN account, then signs you in. Requires the setup key from the backend .env."
            : `Enter the 6-digit code sent to ${email} to finish signing in.`}
        </p>

        {step === "setup" ? (
          <form onSubmit={handleSetup} className="mt-8 flex flex-col gap-4">
            <Input
              type="email"
              required
              label="Admin email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              type="password"
              required
              label="Setup key (ADMIN_SETUP_KEY)"
              placeholder="mp-setup-…"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
            <Button type="submit" size="lg" disabled={loading} className="w-full">
              {loading ? "Setting up…" : "Grant admin & send login code"}
              <KeyRound className="h-4 w-4" />
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
              {loading ? "Verifying…" : "Sign in to admin"}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <button
              type="button"
              onClick={() => setStep("setup")}
              className="text-xs text-foreground/50 underline underline-offset-2"
            >
              Use a different email
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
