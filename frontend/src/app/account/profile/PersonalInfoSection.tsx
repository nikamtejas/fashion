"use client";

import * as React from "react";
import { BadgeCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 100 }, (_, i) => CURRENT_YEAR - i);
const selectClass =
  "h-12 min-w-0 rounded-lg border border-border bg-surface px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-accent";

/** Native `<input type="date">` renders its own internal day/month/year
 * segments + calendar icon with a browser-controlled minimum width that
 * `width: 100%` can't override — on some mobile browsers a filled-in value
 * overflowed its card no matter how it was padded/styled. Plain `<select>`s
 * have no such quirk, so this is the only way to actually guarantee it
 * fits, on every device, rather than fighting native widget internals. */
function DateOfBirthField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [year, month, day] = value ? value.split("-") : ["", "", ""];

  function update(next: { year?: string; month?: string; day?: string }) {
    const y = next.year ?? year;
    const m = next.month ?? month;
    const d = next.day ?? day;
    onChange(y && m && d ? `${y}-${m}-${d}` : "");
  }

  const daysInMonth = year && month ? new Date(Number(year), Number(month), 0).getDate() : 31;
  const days = Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, "0"));

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wider text-foreground/70">Date of birth</label>
      <div className="grid grid-cols-3 gap-2">
        <select
          aria-label="Day"
          value={day}
          onChange={(e) => update({ day: e.target.value })}
          className={cn(selectClass, !day && "text-foreground/40")}
        >
          <option value="">Day</option>
          {days.map((d) => (
            <option key={d} value={d}>
              {Number(d)}
            </option>
          ))}
        </select>
        <select
          aria-label="Month"
          value={month}
          onChange={(e) => update({ month: e.target.value })}
          className={cn(selectClass, !month && "text-foreground/40")}
        >
          <option value="">Month</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1).padStart(2, "0")}>
              {m}
            </option>
          ))}
        </select>
        <select
          aria-label="Year"
          value={year}
          onChange={(e) => update({ year: e.target.value })}
          className={cn(selectClass, !year && "text-foreground/40")}
        >
          <option value="">Year</option>
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

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
        <DateOfBirthField value={dob} onChange={setDob} />
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
