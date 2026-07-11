"use client";

import { useEffect, useState } from "react";
import { getSettings, updateSettings, type Settings } from "@/lib/settings";
import { ApiRequestError } from "@/lib/api";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    getSettings()
      .then((res) => setSettings(res.settings))
      .catch((err) => setError(err instanceof ApiRequestError ? err.message : "Failed to load settings"));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setError(null);
    setSaved(false);
    setIsSaving(true);
    try {
      const res = await updateSettings(settings);
      setSettings(res.settings);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  }

  if (error && !settings) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!settings) {
    return (
      <div className="flex max-w-md flex-col gap-4">
        <div className="h-8 w-48 animate-pulse rounded bg-black/10 dark:bg-white/10" />
        <div className="h-40 w-full animate-pulse rounded-xl bg-black/10 dark:bg-white/10" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 max-w-md text-sm text-black/60 dark:text-white/60">
        GST threshold and rates used to pre-fill new products&apos; pricing. Verify against
        current GST portal guidance — this isn&apos;t hardcoded anywhere in the app, so you
        can update it here whenever policy changes. Existing products keep the values they
        were created with unless you edit them individually.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex max-w-sm flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          GST threshold (₹)
          <input
            type="number"
            min={0}
            step="0.01"
            value={settings.gstThreshold}
            onChange={(e) => setSettings({ ...settings, gstThreshold: Number(e.target.value) || 0 })}
            className="h-11 rounded-lg border border-black/15 bg-transparent px-3 text-sm outline-none focus:border-black dark:border-white/20 dark:focus:border-white"
          />
          <span className="text-xs font-normal text-black/50 dark:text-white/50">
            Pre-tax price at or above this uses the high rate; below it uses the low rate.
          </span>
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          GST rate below threshold (%)
          <input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={settings.gstRateLow}
            onChange={(e) => setSettings({ ...settings, gstRateLow: Number(e.target.value) || 0 })}
            className="h-11 rounded-lg border border-black/15 bg-transparent px-3 text-sm outline-none focus:border-black dark:border-white/20 dark:focus:border-white"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          GST rate at/above threshold (%)
          <input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={settings.gstRateHigh}
            onChange={(e) => setSettings({ ...settings, gstRateHigh: Number(e.target.value) || 0 })}
            className="h-11 rounded-lg border border-black/15 bg-transparent px-3 text-sm outline-none focus:border-black dark:border-white/20 dark:focus:border-white"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-700 dark:text-green-400">Saved.</p>}

        <button
          type="submit"
          disabled={isSaving}
          className="h-11 w-fit rounded-full bg-black px-6 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}
