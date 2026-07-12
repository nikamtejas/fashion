"use client";

import * as React from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

interface Coupon {
  _id: string;
  code: string;
  type: "FLAT" | "PERCENTAGE";
  value: number;
  maxDiscount?: number;
  minOrderValue: number;
  usageLimit?: number;
  perUserLimit: number;
  usedCount: number;
  expiresAt?: string;
  firstOrderOnly: boolean;
  active: boolean;
}

interface CouponForm {
  code: string;
  type: "FLAT" | "PERCENTAGE";
  value: number;
  maxDiscount?: number;
  minOrderValue: number;
  usageLimit?: number;
  perUserLimit: number;
  expiresAt?: string;
  firstOrderOnly: boolean;
  active: boolean;
}

const EMPTY: CouponForm = {
  code: "",
  type: "PERCENTAGE",
  value: 10,
  minOrderValue: 0,
  perUserLimit: 1,
  firstOrderOnly: false,
  active: true,
};

export default function AdminCouponsPage() {
  const { toast } = useToast();
  const [coupons, setCoupons] = React.useState<Coupon[] | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Coupon | null>(null);
  const [form, setForm] = React.useState<CouponForm>(EMPTY);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(() => {
    apiFetch<{ coupons: Coupon[] }>("/api/admin/coupons").then((data) => setCoupons(data.coupons));
  }, []);

  React.useEffect(load, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  }

  function openEdit(c: Coupon) {
    setEditing(c);
    setForm({
      code: c.code,
      type: c.type,
      value: c.value,
      maxDiscount: c.maxDiscount,
      minOrderValue: c.minOrderValue,
      usageLimit: c.usageLimit,
      perUserLimit: c.perUserLimit,
      expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : undefined,
      firstOrderOnly: c.firstOrderOnly,
      active: c.active,
    });
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        maxDiscount: form.maxDiscount || null,
        usageLimit: form.usageLimit || null,
        expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59`).toISOString() : null,
      };
      if (editing) {
        await apiFetch(`/api/admin/coupons/${editing._id}`, { method: "PATCH", json: payload });
      } else {
        await apiFetch("/api/admin/coupons", { method: "POST", json: payload });
      }
      toast({ title: editing ? "Coupon updated" : "Coupon created", variant: "success" });
      setModalOpen(false);
      load();
    } catch (err) {
      toast({ title: "Couldn't save coupon", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: Coupon) {
    await apiFetch(`/api/admin/coupons/${c._id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl">Coupons</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> New coupon
        </Button>
      </div>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wider text-foreground/50">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Discount</th>
              <th className="px-4 py-3">Min order</th>
              <th className="px-4 py-3">Used</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {coupons?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-foreground/50">
                  No coupons yet.
                </td>
              </tr>
            )}
            {coupons?.map((c) => (
              <tr key={c._id} className="border-t border-border">
                <td className="px-4 py-3 font-medium tracking-wider">{c.code}</td>
                <td className="px-4 py-3">
                  {c.type === "PERCENTAGE" ? `${c.value}%` : `₹${c.value}`}
                  {c.maxDiscount ? ` (max ₹${c.maxDiscount})` : ""}
                  {c.firstOrderOnly ? " · first order" : ""}
                </td>
                <td className="px-4 py-3">₹{c.minOrderValue}</td>
                <td className="px-4 py-3">
                  {c.usedCount}
                  {c.usageLimit ? ` / ${c.usageLimit}` : ""}
                </td>
                <td className="px-4 py-3">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("en-IN") : "—"}</td>
                <td className="px-4 py-3">
                  <Badge variant={c.active ? "success" : "outline"}>{c.active ? "Active" : "Inactive"}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => openEdit(c)} className="rounded-lg p-1.5 text-foreground/50 hover:bg-foreground/5">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(c)} className="rounded-lg p-1.5 text-foreground/50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onOpenChange={setModalOpen} title={editing ? `Edit ${editing.code}` : "New coupon"}>
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Code"
            required
            value={form.code}
            disabled={Boolean(editing)}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-foreground/70">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as "FLAT" | "PERCENTAGE" }))}
                className="h-12 rounded-lg border border-border bg-surface px-3 text-sm"
              >
                <option value="PERCENTAGE">Percentage</option>
                <option value="FLAT">Flat ₹</option>
              </select>
            </div>
            <Input
              label={form.type === "PERCENTAGE" ? "Percent off" : "Rupees off"}
              type="number"
              required
              min={1}
              value={form.value || ""}
              onChange={(e) => setForm((f) => ({ ...f, value: Number(e.target.value) }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {form.type === "PERCENTAGE" && (
              <Input
                label="Max discount ₹ (optional)"
                type="number"
                min={0}
                value={form.maxDiscount ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, maxDiscount: e.target.value ? Number(e.target.value) : undefined }))}
              />
            )}
            <Input
              label="Min order value ₹"
              type="number"
              min={0}
              value={form.minOrderValue || ""}
              onChange={(e) => setForm((f) => ({ ...f, minOrderValue: Number(e.target.value) || 0 }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Global usage limit (optional)"
              type="number"
              min={1}
              value={form.usageLimit ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value ? Number(e.target.value) : undefined }))}
            />
            <Input
              label="Per-user limit"
              type="number"
              min={1}
              value={form.perUserLimit || ""}
              onChange={(e) => setForm((f) => ({ ...f, perUserLimit: Number(e.target.value) || 1 }))}
            />
          </div>
          <Input
            label="Expiry date (optional)"
            type="date"
            value={form.expiresAt ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value || undefined }))}
          />
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.firstOrderOnly}
                onChange={(e) => setForm((f) => ({ ...f, firstOrderOnly: e.target.checked }))}
              />
              First order only
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
              Active
            </label>
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Create coupon"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
