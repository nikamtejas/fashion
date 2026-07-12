"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface StoreSettings {
  emiMinimumOrderValue: number;
  codMaxOrderValue: number;
  codConvenienceFee: number;
}

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = React.useState<StoreSettings | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    apiFetch<{ settings: StoreSettings }>("/api/admin/settings").then((data) => setSettings(data.settings));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      await apiFetch("/api/admin/settings", {
        method: "PATCH",
        json: {
          emiMinimumOrderValue: settings.emiMinimumOrderValue,
          codMaxOrderValue: settings.codMaxOrderValue,
          codConvenienceFee: settings.codConvenienceFee,
        },
      });
      toast({ title: "Settings saved", variant: "success" });
    } catch (err) {
      toast({ title: "Couldn't save settings", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <p className="text-sm text-foreground/50">Loading settings…</p>;

  return (
    <div className="max-w-md">
      <h1 className="font-display text-2xl">Payment settings</h1>
      <form onSubmit={handleSave} className="mt-8 space-y-5">
        <div>
          <Input
            label="EMI minimum order value (₹)"
            type="number"
            min={0}
            value={settings.emiMinimumOrderValue}
            onChange={(e) => setSettings((s) => s && { ...s, emiMinimumOrderValue: Number(e.target.value) })}
          />
          <p className="mt-1 text-xs text-foreground/50">
            Snapmint EMI appears only when the payable amount meets this. Products and carts below it never mention EMI.
          </p>
        </div>
        <div>
          <Input
            label="COD maximum order value (₹)"
            type="number"
            min={0}
            value={settings.codMaxOrderValue}
            onChange={(e) => setSettings((s) => s && { ...s, codMaxOrderValue: Number(e.target.value) })}
          />
          <p className="mt-1 text-xs text-foreground/50">Cash on Delivery is refused above this order value.</p>
        </div>
        <div>
          <Input
            label="COD convenience fee (₹)"
            type="number"
            min={0}
            value={settings.codConvenienceFee}
            onChange={(e) => setSettings((s) => s && { ...s, codConvenienceFee: Number(e.target.value) })}
          />
          <p className="mt-1 text-xs text-foreground/50">Added as its own line on COD orders. Set 0 to disable.</p>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </form>
    </div>
  );
}
