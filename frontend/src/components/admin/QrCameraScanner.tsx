"use client";

import * as React from "react";
import jsQR from "jsqr";

/**
 * Live camera QR scanner. Opens the device camera (back camera on phones),
 * samples frames onto a canvas and decodes with jsQR; calls onScan once with
 * the first decoded value, then stops. Requires a secure context (https or
 * localhost) — getUserMedia is unavailable otherwise.
 */
export function QrCameraScanner({ onScan }: { onScan: (text: string) => void }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let done = false;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const stopStream = () => {
      if (timer) clearInterval(timer);
      timer = null;
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
    };

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera needs a secure context — open the app via https or localhost.");
        return;
      }
      let acquired: MediaStream;
      try {
        acquired = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch {
        if (!done) setError("Couldn't access the camera — allow camera permission or type the code instead.");
        return;
      }
      // Unmounted while the permission prompt / camera warm-up was pending:
      // the cleanup has already run, so this stream has no owner and must be
      // stopped here or the camera light stays on.
      if (done) {
        acquired.getTracks().forEach((t) => t.stop());
        return;
      }
      stream = acquired;
      const video = videoRef.current;
      if (!video) {
        stopStream();
        return;
      }
      video.srcObject = acquired;
      await video.play().catch(() => undefined);

      timer = setInterval(() => {
        if (done || !ctx || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        if (!canvas.width || !canvas.height) return;
        ctx.drawImage(video, 0, 0);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        // attemptBoth also reads inverted (light-on-dark) codes — phone
        // screenshots and dark-mode wallets render them that way.
        const result = jsQR(image.data, image.width, image.height, { inversionAttempts: "attemptBoth" });
        if (result?.data) {
          // One-shot: camera goes dark the instant a code is read, before the
          // parent even processes it — no lingering stream while (or after)
          // the lookup runs.
          done = true;
          stopStream();
          onScan(result.data);
        }
      }, 250);
    }

    start();
    return () => {
      done = true;
      stopStream();
    };
    // onScan is intentionally captured once — the scanner lives per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return <p className="rounded-xl border border-border bg-foreground/5 p-3 text-xs text-foreground/60">{error}</p>;
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-ink">
      <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" />
      {/* viewfinder frame */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-40 w-40 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
      </div>
      <p className="absolute inset-x-0 bottom-2 text-center text-[11px] text-white/80">
        Keep the whole QR code inside the frame — steady, well-lit, ~15&nbsp;cm away
      </p>
    </div>
  );
}
