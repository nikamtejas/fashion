import { logIntegrationCall, serviceMock, withTimeout } from "./index";

// India Post + Nominatim are free public APIs (no credentials), so pincode
// lookups can go live independently of the global flag (PINCODE_MOCK=false).
const PINCODE_MOCK = serviceMock("PINCODE");

export interface PincodeInfo {
  city: string;
  state: string;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

// Known anchors used by both mock functions so pincodes near the seeded
// stores resolve to sensible places.
const ANCHORS: Record<string, { city: string; state: string; lat: number; lng: number }> = {
  "1": { city: "New Delhi", state: "Delhi", lat: 28.6139, lng: 77.209 },
  "2": { city: "Lucknow", state: "Uttar Pradesh", lat: 26.8467, lng: 80.9462 },
  "3": { city: "Kolkata", state: "West Bengal", lat: 22.5726, lng: 88.3639 },
  "4": { city: "Mumbai", state: "Maharashtra", lat: 19.076, lng: 72.8777 },
  "5": { city: "Bengaluru", state: "Karnataka", lat: 12.9716, lng: 77.5946 },
  "6": { city: "Chennai", state: "Tamil Nadu", lat: 13.0827, lng: 80.2707 },
  "7": { city: "Guwahati", state: "Assam", lat: 26.1445, lng: 91.7362 },
  "8": { city: "Patna", state: "Bihar", lat: 25.5941, lng: 85.1376 },
  "9": { city: "Jaipur", state: "Rajasthan", lat: 26.9124, lng: 75.7873 },
  "0": { city: "Srinagar", state: "Jammu & Kashmir", lat: 34.0837, lng: 74.7973 },
};

function hashJitter(pincode: string): number {
  const hash = [...pincode].reduce((sum, c, i) => sum + c.charCodeAt(0) * (i + 1), 0);
  return ((hash % 100) - 50) / 500; // ±0.1°, ~±11km
}

/** City/state autofill from a pincode. Mock keys off the first digit
 * (India's real postal-circle structure); live mode uses India Post's
 * free API. */
const lookupCache = new Map<string, PincodeInfo | null>();
const geocodeCache = new Map<string, GeoPoint | null>();

export async function lookupPincode(pincode: string): Promise<PincodeInfo | null> {
  logIntegrationCall("pincode", "lookup", { pincode, mock: PINCODE_MOCK });
  if (!/^\d{6}$/.test(pincode)) return null;

  if (PINCODE_MOCK) {
    const anchor = ANCHORS[pincode[0]];
    return anchor ? { city: anchor.city, state: anchor.state } : null;
  }

  if (lookupCache.has(pincode)) return lookupCache.get(pincode)!;
  const res = await withTimeout(
    fetch(`https://api.postalpincode.in/pincode/${pincode}`),
    8000,
    "pincode:lookup"
  );
  const data = (await res.json()) as { Status: string; PostOffice?: { District: string; State: string }[] }[];
  const office = data?.[0]?.PostOffice?.[0];
  const info = office ? { city: office.District, state: office.State } : null;
  lookupCache.set(pincode, info);
  return info;
}

/** Rough geocode of a pincode for nearest-store math. Mock is anchored to
 * the pincode's postal circle with a deterministic jitter; live mode uses
 * OpenStreetMap Nominatim. */
export async function geocodePincode(pincode: string): Promise<GeoPoint | null> {
  logIntegrationCall("pincode", "geocode", { pincode, mock: PINCODE_MOCK });
  if (!/^\d{6}$/.test(pincode)) return null;

  if (PINCODE_MOCK) {
    const anchor = ANCHORS[pincode[0]];
    if (!anchor) return null;
    return { lat: anchor.lat + hashJitter(pincode), lng: anchor.lng + hashJitter(pincode.split("").reverse().join("")) };
  }

  if (geocodeCache.has(pincode)) return geocodeCache.get(pincode)!;
  const res = await withTimeout(
    fetch(`https://nominatim.openstreetmap.org/search?postalcode=${pincode}&country=india&format=json&limit=1`, {
      headers: { "User-Agent": "LuxeLoom/1.0" },
    }),
    8000,
    "pincode:geocode"
  );
  const data = (await res.json()) as { lat: string; lon: string }[];
  const point = data[0] ? { lat: Number(data[0].lat), lng: Number(data[0].lon) } : null;
  geocodeCache.set(pincode, point);
  return point;
}

/** Free-text geocode of a full street address (Nominatim). More precise than
 * the pincode centroid when it resolves; callers should fall back to
 * geocodePincode when it returns null. Mock mode always returns null. */
export async function geocodeAddress(query: string): Promise<GeoPoint | null> {
  logIntegrationCall("pincode", "geocodeAddress", { query, mock: PINCODE_MOCK });
  if (PINCODE_MOCK) return null;

  const key = `addr:${query.toLowerCase()}`;
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;
  const res = await withTimeout(
    fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=in&format=json&limit=1`,
      { headers: { "User-Agent": "LuxeLoom/1.0" } }
    ),
    8000,
    "pincode:geocodeAddress"
  );
  const data = (await res.json()) as { lat: string; lon: string }[];
  const point = data[0] ? { lat: Number(data[0].lat), lng: Number(data[0].lon) } : null;
  geocodeCache.set(key, point);
  return point;
}
