import { apiFetch } from "./api";

export interface Settings {
  gstThreshold: number;
  gstRateLow: number;
  gstRateHigh: number;
}

export function getSettings() {
  return apiFetch<{ settings: Settings }>("/api/admin/settings");
}

export function updateSettings(input: Settings) {
  return apiFetch<{ settings: Settings }>("/api/admin/settings", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
