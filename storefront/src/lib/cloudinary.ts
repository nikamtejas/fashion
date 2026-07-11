// Inserts Cloudinary's auto-format/auto-quality transformation into a delivery URL,
// per the spec's performance budget (f_auto,q_auto on every catalog image).
export function withCloudinaryTransform(url: string, transform: string): string {
  return url.replace("/upload/", `/upload/${transform}/`);
}
