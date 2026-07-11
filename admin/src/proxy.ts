import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/constants";

// Optimistic-only check: the whole admin app is gated except /login. The backend
// still verifies the JWT (and admin role) on every API call — this just avoids
// flashing protected UI before redirecting an unauthenticated visitor.
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);

  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|_next|favicon.ico).*)"],
};
