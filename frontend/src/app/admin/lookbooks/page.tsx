"use client";

import * as React from "react";
import Image from "next/image";
import { Plus, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

interface PickerProduct {
  _id: string;
  name: string;
  images?: { secureUrl: string }[];
}

interface AdminLookbook {
  _id: string;
  title: string;
  description?: string;
  active: boolean;
  products: PickerProduct[];
}

export default function AdminLookbooksPage() {
  const { toast } = useToast();
  const [lookbooks, setLookbooks] = React.useState<AdminLookbook[] | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [allProducts, setAllProducts] = React.useState<PickerProduct[]>([]);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(() => {
    apiFetch<{ lookbooks: AdminLookbook[] }>("/api/admin/lookbooks").then((d) => setLookbooks(d.lookbooks));
  }, []);

  React.useEffect(() => {
    load();
    apiFetch<{ products: PickerProduct[] }>("/api/admin/products?limit=50").then((d) => setAllProducts(d.products));
  }, [load]);

  async function create() {
    setSaving(true);
    try {
      await apiFetch("/api/admin/lookbooks", {
        method: "POST",
        json: { title, description: description || undefined, products: [...picked] },
      });
      toast({ title: "Lookbook published", variant: "success" });
      setModalOpen(false);
      setTitle("");
      setDescription("");
      setPicked(new Set());
      load();
    } catch (err) {
      toast({ title: "Couldn't create lookbook", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await apiFetch(`/api/admin/lookbooks/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl">Lookbooks</h1>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> New lookbook
        </Button>
      </div>

      {lookbooks?.length === 0 && <p className="mt-8 text-sm text-foreground/50">No lookbooks yet — compose your first outfit.</p>}

      <div className="mt-6 space-y-3">
        {lookbooks?.map((l) => (
          <div key={l._id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-3">
                {l.products.slice(0, 4).map((p) => (
                  <div key={p._id} className="relative h-12 w-10 overflow-hidden rounded-md border-2 border-surface bg-foreground/5">
                    {p.images?.[0] && <Image src={p.images[0].secureUrl} alt="" fill className="object-cover" />}
                  </div>
                ))}
              </div>
              <div>
                <p className="text-sm font-medium">{l.title}</p>
                <p className="text-xs text-foreground/50">{l.products.length} pieces</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={l.active ? "success" : "outline"}>{l.active ? "Live" : "Hidden"}</Badge>
              <button onClick={() => remove(l._id)} aria-label="Delete lookbook" className="rounded-lg p-1.5 text-foreground/50 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={modalOpen} onOpenChange={setModalOpen} title="Compose a lookbook" className="max-w-2xl">
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Golden Hour Edit" />
          <Input label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-foreground/70">Pick the pieces ({picked.size})</p>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {allProducts.map((p) => (
                <button
                  key={p._id}
                  onClick={() =>
                    setPicked((prev) => {
                      const next = new Set(prev);
                      if (next.has(p._id)) next.delete(p._id);
                      else next.add(p._id);
                      return next;
                    })
                  }
                  className={cn(
                    "overflow-hidden rounded-xl border-2 text-left",
                    picked.has(p._id) ? "border-accent" : "border-transparent"
                  )}
                >
                  <div className="relative aspect-[3/4] bg-foreground/5">
                    {p.images?.[0] && <Image src={p.images[0].secureUrl} alt={p.name} fill className="object-cover" />}
                  </div>
                  <p className="truncate p-1.5 text-[11px]">{p.name}</p>
                </button>
              ))}
            </div>
          </div>
          <Button className="w-full" disabled={saving || title.trim().length < 2 || picked.size === 0} onClick={create}>
            {saving ? "Publishing…" : "Publish lookbook"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
