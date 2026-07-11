import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

// Called by the backend after a product create/update/delete so the storefront's
// cached listing/detail pages don't go stale until the next full rebuild.
export async function POST(request: Request) {
  const secret = request.headers.get("x-revalidate-secret");
  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const slug = typeof body?.slug === "string" ? body.slug : undefined;

  revalidatePath("/");
  if (slug) {
    revalidatePath(`/products/${slug}`);
  }

  return NextResponse.json({ revalidated: true });
}
