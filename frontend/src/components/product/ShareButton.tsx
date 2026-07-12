"use client";

import { Share2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

export function ShareButton({ title }: { title: string }) {
  const { toast } = useToast();

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // user cancelled — no-op
      }
      return;
    }
    await navigator.clipboard.writeText(url);
    toast({ title: "Link copied", description: "Product link copied to clipboard.", variant: "success" });
  }

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-1.5 text-xs text-foreground/60 hover:text-foreground"
    >
      <Share2 className="h-3.5 w-3.5" /> Share
    </button>
  );
}
