export function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Downscales + re-encodes as JPEG before upload. A raw phone camera photo
 * (routinely 8-15MB+) sent untouched as base64 — inflated another ~33% by
 * the encoding — was the actual cause of "adding images" being slow or
 * outright failing: a huge JSON body over this app's already-latent DB/API
 * connection, sometimes large enough to brush the server's 20MB
 * request-body cap. Nothing downstream needs the untouched original —
 * Cloudinary re-transforms every image for display anyway (see
 * cloudinaryUrl() on the backend, capped at 1200px for even the full
 * product-gallery zoom), so 1600px here is already generous headroom. */
export async function compressImageForUpload(dataUri: string, maxDimension = 1600, quality = 0.85): Promise<string> {
  const img = await loadImage(dataUri);
  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUri; // canvas unavailable — fall back to the original rather than block the upload

  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

export interface QualityWarning {
  message: string;
}

/** Lightweight, non-blocking client-side heuristics — not a real quality
 * gate, just friendly hints before the admin uploads. */
export async function checkImageQuality(dataUri: string): Promise<QualityWarning[]> {
  const warnings: QualityWarning[] = [];

  const img = await loadImage(dataUri);
  const canvas = document.createElement("canvas");
  const size = 100;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return warnings;
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  let totalBrightness = 0;
  const gray = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[i] = lum;
    totalBrightness += lum;
  }
  const avgBrightness = totalBrightness / (size * size);
  if (avgBrightness < 60) {
    warnings.push({ message: "This photo looks quite dark — consider retaking it in better light." });
  }

  // Rough blur heuristic: variance of a simple horizontal gradient.
  let gradientSum = 0;
  let gradientSumSq = 0;
  let count = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 1; x < size; x++) {
      const diff = gray[y * size + x] - gray[y * size + x - 1];
      gradientSum += diff;
      gradientSumSq += diff * diff;
      count++;
    }
  }
  const meanGrad = gradientSum / count;
  const variance = gradientSumSq / count - meanGrad * meanGrad;
  if (variance < 8) {
    warnings.push({ message: "This photo may be blurry — try holding the camera steady." });
  }

  if (img.width < 400 || img.height < 400) {
    warnings.push({ message: "This photo is quite small/cropped — a larger photo works best." });
  }

  return warnings;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
