"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, MailCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, ApiError } from "@/lib/api";

export default function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { refresh } = useAuth();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  const [step, setStep] = React.useState<"details" | "verify">("details");
  const [name, setName] = React.useState("");
  const [dob, setDob] = React.useState("");
  const [email, setEmail] = React.useState(searchParams.get("email") ?? "");
  const [phone, setPhone] = React.useState("");
  const [emailCode, setEmailCode] = React.useState("");
  const [phoneCode, setPhoneCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const details = { name, dob, email, phone };

  async function handleSendCodes(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/api/auth/register/request", { method: "POST", json: details });
      setStep("verify");
      toast({
        title: "Two codes sent",
        description: `Check ${email} and the SMS inbox of your phone.`,
        variant: "success",
      });
    } catch (err) {
      if (err instanceof ApiError && err.code === "ALREADY_REGISTERED") {
        toast({ title: "Account exists", description: "This email is already registered — log in instead.", variant: "error" });
        router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
        return;
      }
      toast({
        title: "Couldn't start registration",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/api/auth/register/verify", {
        method: "POST",
        json: { ...details, emailCode, phoneCode },
      });
      await refresh();
      toast({ title: "Welcome to LuxeLoom", description: "Your account is ready.", variant: "success" });
      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      toast({
        title: "Verification failed",
        description: err instanceof Error ? err.message : "Check both codes and try again.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="font-display text-3xl">Create your account</h1>
        <p className="mt-2 text-sm text-foreground/60">
          {step === "details"
            ? "We verify both your email and mobile number with one-time codes."
            : `Enter the code emailed to ${email} and the code texted to ${phone}.`}
        </p>

        {step === "details" ? (
          <form onSubmit={handleSendCodes} className="mt-8 flex flex-col gap-4">
            <Input
              required
              label="Full name"
              placeholder="Aisha Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              type="date"
              required
              label="Date of birth"
              max={new Date().toISOString().slice(0, 10)}
              value={dob}
              onChange={(e) => setDob(e.target.value)}
            />
            <Input
              type="email"
              required
              label="Email address"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              type="tel"
              required
              label="Mobile number"
              placeholder="98765 43210"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Button type="submit" size="lg" disabled={loading} className="w-full">
              {loading ? "Sending codes…" : "Send verification codes"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="mt-8 flex flex-col gap-4">
            <div className="flex items-start gap-3 rounded-xl border border-border p-3">
              <MailCheck className="mt-2.5 h-4 w-4 shrink-0 text-accent" />
              <div className="flex-1">
                <Input
                  required
                  label="Email code"
                  placeholder="000000"
                  inputMode="numeric"
                  maxLength={6}
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-border p-3">
              <Smartphone className="mt-2.5 h-4 w-4 shrink-0 text-accent" />
              <div className="flex-1">
                <Input
                  required
                  label="SMS code"
                  placeholder="000000"
                  inputMode="numeric"
                  maxLength={6}
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value)}
                />
              </div>
            </div>
            <Button type="submit" size="lg" disabled={loading} className="w-full">
              {loading ? "Verifying…" : "Verify & create account"}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <div className="flex justify-between text-xs text-foreground/50">
              <button type="button" onClick={() => setStep("details")} className="underline underline-offset-2">
                Edit my details
              </button>
              <button type="button" disabled={loading} onClick={() => handleSendCodes()} className="underline underline-offset-2">
                Resend both codes
              </button>
            </div>
          </form>
        )}

        <p className="mt-8 text-center text-sm text-foreground/60">
          Already have an account?{" "}
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            className="text-accent underline underline-offset-2"
          >
            Log in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
