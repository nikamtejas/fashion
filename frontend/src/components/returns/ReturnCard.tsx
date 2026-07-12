"use client";

import QRCode from "react-qr-code";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export interface ReturnView {
  id: string;
  orderNumber: string;
  status: string;
  method: "COURIER" | "STORE";
  reason: string;
  rejectionReason?: string;
  refundAmount?: number;
  expectedCreditDate?: string;
  items: { sku: string; qty: number; name: string }[];
  store?: { name: string; address?: string; city?: string } | null;
  appointment?: { date: string; timeSlot: string; status: string; qrCode?: string } | null;
  reverseShipment?: { awbNumber?: string; status: string } | null;
  events: { status: string; location?: string; description?: string; timestamp: string }[];
  createdAt: string;
}

const COURIER_STAGES = ["REQUESTED", "APPROVED", "ITEM_PICKED_UP", "RECEIVED", "REFUNDED"];
const STORE_STAGES = ["REQUESTED", "APPROVED", "RECEIVED", "REFUNDED"];

const STAGE_LABELS: Record<string, string> = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  ITEM_PICKED_UP: "Item picked up",
  RECEIVED: "Received",
  REFUNDED: "Refunded",
};

export function ReturnCard({ refund }: { refund: ReturnView }) {
  const stages = refund.method === "COURIER" ? COURIER_STAGES : STORE_STAGES;
  const currentIdx = stages.indexOf(refund.status);
  const rejected = refund.status === "REJECTED";
  const active = refund.appointment && ["BOOKED", "READY"].includes(refund.appointment.status) && !rejected;

  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            Return · {refund.items.map((i) => `${i.name} ×${i.qty}`).join(", ")}
          </p>
          <p className="mt-0.5 text-xs text-foreground/50">
            {refund.method === "STORE" ? `Store drop-off — ${refund.store?.name ?? ""}` : "Courier reverse pickup"}
            {refund.reverseShipment?.awbNumber ? ` · AWB ${refund.reverseShipment.awbNumber}` : ""}
          </p>
        </div>
        <Badge variant={refund.status === "REFUNDED" ? "success" : rejected ? "default" : "accent"}>
          {refund.status.replaceAll("_", " ")}
        </Badge>
      </div>

      {rejected ? (
        <p className="mt-3 text-xs text-red-600">Declined: {refund.rejectionReason}</p>
      ) : (
        <>
          <ol className="mt-4 flex items-center">
            {stages.map((stage, i) => {
              const done = i <= currentIdx;
              return (
                <li key={stage} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className={cn(
                        "h-3 w-3 rounded-full",
                        done ? "bg-sage" : "bg-border",
                        i === currentIdx && "shadow-[0_0_0_4px_rgba(138,154,126,0.25)]"
                      )}
                    />
                    <span className={cn("whitespace-nowrap text-[10px]", done ? "text-foreground" : "text-foreground/40")}>
                      {STAGE_LABELS[stage]}
                    </span>
                  </div>
                  {i < stages.length - 1 && <span className={cn("mx-1 mb-4 h-px flex-1", i < currentIdx ? "bg-sage" : "bg-border")} />}
                </li>
              );
            })}
          </ol>

          {refund.status === "REFUNDED" && refund.expectedCreditDate && (
            <p className="mt-3 text-xs text-[var(--color-sage-dark)]">
              ₹{refund.refundAmount?.toLocaleString("en-IN")} refunded — credit expected by{" "}
              {new Date(refund.expectedCreditDate).toLocaleDateString("en-IN")}
            </p>
          )}

          {active && refund.appointment?.qrCode && (
            <div className="mt-4 flex items-center gap-4 rounded-xl bg-surface p-3">
              <div className="rounded-lg bg-white p-2">
                <QRCode value={refund.appointment.qrCode} size={72} />
              </div>
              <div className="text-xs text-foreground/60">
                <p className="font-medium text-foreground">Show this at {refund.store?.name}</p>
                <p className="mt-0.5">
                  {new Date(refund.appointment.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                  , {refund.appointment.timeSlot}
                </p>
                <p className="mt-0.5 tracking-widest">{refund.appointment.qrCode}</p>
              </div>
            </div>
          )}

          {refund.events.length > 0 && (
            <div className="mt-3 space-y-1">
              {[...refund.events].reverse().slice(0, 3).map((e, i) => (
                <p key={i} className="text-xs text-foreground/50">
                  {e.description} {e.location ? `— ${e.location}` : ""} ·{" "}
                  {new Date(e.timestamp).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
