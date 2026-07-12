"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";

const ROWS = [
  { size: "XS", chest: "34\"", waist: "27\"", hip: "35\"" },
  { size: "S", chest: "36\"", waist: "29\"", hip: "37\"" },
  { size: "M", chest: "38\"", waist: "31\"", hip: "39\"" },
  { size: "L", chest: "40\"", waist: "33\"", hip: "41\"" },
  { size: "XL", chest: "42\"", waist: "35\"", hip: "43\"" },
];

export function SizeGuideModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Size guide" description="Measurements in inches, laid flat.">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-foreground/50">
          <tr>
            <th className="py-2">Size</th>
            <th className="py-2">Chest</th>
            <th className="py-2">Waist</th>
            <th className="py-2">Hip</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.size} className="border-t border-border">
              <td className="py-2 font-medium">{r.size}</td>
              <td className="py-2">{r.chest}</td>
              <td className="py-2">{r.waist}</td>
              <td className="py-2">{r.hip}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}
