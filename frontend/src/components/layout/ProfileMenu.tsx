"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { User, LogOut, Package, Heart, LayoutDashboard, Moon, Sun, UserCircle, MessageCircle } from "lucide-react";
import { useTheme } from "@/components/layout/ThemeProvider";
import { useAuth } from "@/context/AuthContext";

export function ProfileMenu() {
  const { user, loading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [imageFailed, setImageFailed] = React.useState(false);

  if (loading) return <div className="h-8 w-8 rounded-full bg-foreground/5" />;

  if (!user) {
    return (
      <Link
        href="/login"
        aria-label="Login"
        className="rounded-full p-2 text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground"
      >
        <User className="h-5 w-5" />
      </Link>
    );
  }

  const initials = (user.name ?? user.email ?? "?").charAt(0).toUpperCase();
  const showImage = Boolean(user.image) && !imageFailed;

  async function handleLogout() {
    await logout();
    router.push("/");
    router.refresh();
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          aria-label="Account menu"
          className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-ink text-xs font-semibold text-ivory dark:bg-ivory dark:text-ink"
        >
          {showImage ? (
            // Avatar comes from an arbitrary external OAuth provider (e.g.
            // Google) — a plain img avoids next/image's remote-pattern
            // allowlist for a single small, already-optimized thumbnail.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
            />
          ) : (
            initials
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={12}
          className="z-50 w-56 rounded-2xl border border-border bg-surface p-2 shadow-2xl"
        >
          <div className="px-3 py-2 text-xs text-foreground/50">{user.email}</div>
          <DropdownMenu.Item asChild>
            <Link href="/account/profile" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-foreground/5">
              <UserCircle className="h-4 w-4" /> My Profile
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link href="/account/orders" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-foreground/5">
              <Package className="h-4 w-4" /> My Orders
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link href="/account/profile?tab=support" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-foreground/5">
              <MessageCircle className="h-4 w-4" /> Support
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link href="/favorites" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-foreground/5">
              <Heart className="h-4 w-4" /> Favorites
            </Link>
          </DropdownMenu.Item>
          {user.role === "ADMIN" && (
            <DropdownMenu.Item asChild>
              <Link href="/admin" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-foreground/5">
                <LayoutDashboard className="h-4 w-4" /> Admin Dashboard
              </Link>
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Item
            onSelect={(e) => {
              e.preventDefault();
              toggleTheme();
            }}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-foreground/5"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item
            onSelect={handleLogout}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
