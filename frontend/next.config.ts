import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Without this, the Turbopack dev server silently refuses to hydrate
  // pages (and rejects the HMR websocket) when opened from any origin
  // other than localhost — e.g. a phone on the same LAN hitting the
  // machine's IP. Add every LAN IP you test from here.
  allowedDevOrigins: ["192.168.0.101"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  // Proxies browser API calls to the backend server-side (Next's server,
  // not the browser, makes the actual http://localhost:4000 request). This
  // keeps every browser request same-origin as the frontend, which matters
  // once the frontend runs over https (--experimental-https, for camera
  // access on phones) — an https page can't fetch a plain-http API
  // directly (mixed content), but it can always call its own origin.
  async rewrites() {
    return [{ source: "/api/:path*", destination: "http://localhost:4000/api/:path*" }];
  },
};

export default nextConfig;
