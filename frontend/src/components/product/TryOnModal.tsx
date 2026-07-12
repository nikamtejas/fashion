"use client";

import * as React from "react";
import { Wand2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export function TryOnButton({ slug }: { slug: string }) {
  const [open, setOpen] = React.useState(false);
  const [image, setImage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function generate() {
    setOpen(true);
    if (image || busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<{ image: string }>("/api/stylist/try-on", { method: "POST", json: { slug } });
      setImage(data.image);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Try-on failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={generate} className="flex items-center gap-1.5 text-xs text-foreground/60 hover:text-foreground">
        <Wand2 className="h-3.5 w-3.5" /> See it on a model
      </button>

      <Modal open={open} onOpenChange={setOpen} title="Virtual try-on" description="A quick AI visualization of this piece.">
        {busy && (
          <div className="flex aspect-[3/4] flex-col items-center justify-center gap-3 rounded-xl bg-foreground/5">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p className="text-xs text-foreground/50">Dressing the model…</p>
          </div>
        )}
        {error && <p className="py-8 text-center text-sm text-red-600">{error}</p>}
        {image && (
          <div className="relative overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="AI-generated try-on visualization" className="w-full object-cover" />
            <span className="absolute bottom-2 left-2 rounded-full bg-ink/70 px-2.5 py-1 text-[10px] uppercase tracking-wider text-ivory">
              AI-generated visualization
            </span>
          </div>
        )}
        {image && (
          <Button
            size="sm"
            variant="outline"
            className="mt-3 w-full"
            magnetic={false}
            onClick={() => {
              setImage(null);
              generate();
            }}
          >
            Generate again
          </Button>
        )}
      </Modal>
    </>
  );
}
