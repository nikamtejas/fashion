"use client";

import * as React from "react";
import { BadgeCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

export function PersonalInfoSection() {
  const { user, refresh } = useAuth();
  const { toast } = useToast();

  const [name, setName] = React.useState(user?.name ?? "");
  const [dob, setDob] = React.useState(user?.dob ?? "");
  const [saving, setSaving] = React.useState(false);

  // Phone change: request an SMS code, then confirm it.
  const [phone, setPhone] = React.useState("");
  const [phoneStep, setPhoneStep] = React.useState<"idle" | "code">("idle");
  const [phoneCode, setPhoneCode] = React.useState("");
  const [phoneBusy, setPhoneBusy] = React.useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch("/api/profile", { method: "PATCH", json: { name, ...(dob ? { dob } : {}) } });
      await refresh();
      toast({ title: "Profile updated", variant: "success" });
    } catch (err) {
      toast({ title: "Couldn't save", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handlePhoneRequest(e: React.FormEvent) {
    e.preventDefault();
    setPhoneBusy(true);
    try {
      await apiFetch("/api/profile/phone/request", { method: "POST", json: { phone } });
      setPhoneStep("code");
      toast({ title: "Code sent", description: "Check your SMS inbox.", variant: "success" });
    } catch (err) {
      toast({ title: "Couldn't send code", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setPhoneBusy(false);
    }
  }

  async function handlePhoneVerify(e: React.FormEvent) {
    e.preventDefault();
    setPhoneBusy(true);
    try {
      await apiFetch("/api/profile/phone/verify", { method: "POST", json: { phone, code: phoneCode } });
      await refresh();
      setPhoneStep("idle");
      setPhone("");
      setPhoneCode("");
      toast({ title: "Phone number verified", variant: "success" });
    } catch (err) {
      toast({ title: "Verification failed", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setPhoneBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleSave} className="space-y-4 rounded-2xl border border-border p-5">
        <Input label="Email" value={user?.email ?? ""} disabled />
        <Input label="Full name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          type="date"
          label="Date of birth"
          max={new Date().toISOString().slice(0, 10)}
          value={dob}
          onChange={(e) => setDob(e.target.value)}
        />
        <Button type="submit" size="sm" disabled={saving} magnetic={false}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </form>

      <div className="rounded-2xl border border-border p-5">
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-medium uppercase tracking-wider text-foreground/70">Mobile number</h2>
        </div>
        {user?.phone ? (
          <p className="mt-3 flex items-center gap-1.5 text-sm">
            {user.phone}
            {user.phoneVerified && (
              <span className="flex items-center gap-1 text-xs text-[var(--color-sage-dark)]">
                <BadgeCheck className="h-3.5 w-3.5" /> verified
              </span>
            )}
          </p>
        ) : (
          <p className="mt-3 text-sm text-foreground/50">No mobile number on your account yet.</p>
        )}

        {phoneStep === "idle" ? (
          <form onSubmit={handlePhoneRequest} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                type="tel"
                required
                label={user?.phone ? "New mobile number" : "Mobile number"}
                placeholder="98765 43210"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <Button type="submit" size="sm" disabled={phoneBusy} magnetic={false}>
              {phoneBusy ? "Sending…" : "Send SMS code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handlePhoneVerify} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                required
                label={`Code sent to ${phone}`}
                placeholder="000000"
                inputMode="numeric"
                maxLength={6}
                value={phoneCode}
                onChange={(e) => setPhoneCode(e.target.value)}
              />
            </div>
            <Button type="submit" size="sm" disabled={phoneBusy} magnetic={false}>
              {phoneBusy ? "Verifying…" : "Verify"}
            </Button>
            <Button type="button" size="sm" variant="ghost" magnetic={false} onClick={() => setPhoneStep("idle")}>
              Cancel
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
