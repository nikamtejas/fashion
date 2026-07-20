"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, FileText, PackageSearch } from "lucide-react";
import { apiFetch, API_URL } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

interface OrderDetail {
  _id: string;
  orderNumber: string;
  status: string;
  deliveryMethod: "HOME" | "PICKUP";
  pricing: { total: number };
  storeLocation?: { name: string; address: string; city: string };
}

interface Appointment {
  _id: string;
  date: string;
  timeSlot: string;
  qrCode: string;
}

const TIMELINE_HOME = ["Order placed", "Confirmed", "Packed", "Shipped", "Delivered"];
const TIMELINE_PICKUP = ["Order placed", "Being prepared", "Ready for pickup", "Picked up"];

export default function ConfirmationPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [order, setOrder] = React.useState<OrderDetail | null>(null);
  const [appointment, setAppointment] = React.useState<Appointment | null>(null);

  React.useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  React.useEffect(() => {
    if (!user) return;
    apiFetch<{ order: OrderDetail; appointment: Appointment | null }>(`/api/orders/${id}`)
      .then((data) => {
        setOrder(data.order);
        setAppointment(data.appointment);
      })
      .catch(() => router.replace("/account/orders"));
    // First-order celebration: a burst of confetti for the very first one.
    apiFetch<{ orders: unknown[] }>("/api/orders")
      .then((d) => {
        if (d.orders.length === 1) {
          // Loaded on demand — only the very first order of a shopper's
          // account ever reaches this branch, so it shouldn't ship in this
          // route's initial JS chunk for everyone else.
          import("canvas-confetti").then(({ default: confetti }) => {
            confetti({ particleCount: 140, spread: 90, origin: { y: 0.6 }, colors: ["#C15B3C", "#8A9A7E", "#141414", "#FAF7F2"] });
          });
        }
      })
      .catch(() => {});
  }, [user, id, router]);

  if (!order) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16">
        <Skeleton className="h-20 w-20 rounded-full" />
        <Skeleton className="mt-6 h-8 w-48" />
        <Skeleton className="mt-3 h-4 w-56" />
        <div className="mt-10 flex w-full justify-between">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-3 rounded-full" />
          ))}
        </div>
        <div className="mt-10 flex gap-3">
          <Skeleton className="h-11 w-32" />
          <Skeleton className="h-11 w-40" />
        </div>
      </div>
    );
  }

  const timeline = order.deliveryMethod === "PICKUP" ? TIMELINE_PICKUP : TIMELINE_HOME;

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}
        className="flex h-20 w-20 items-center justify-center rounded-full bg-sage/20"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.3 }}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-sage text-white"
        >
          <Check className="h-6 w-6" />
        </motion.div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <h1 className="font-display mt-6 text-3xl">Order placed</h1>
        <p className="mt-2 text-sm text-foreground/60">
          Order <span className="font-medium text-foreground">{order.orderNumber}</span> · ₹
          {order.pricing.total.toLocaleString("en-IN")}
        </p>

        {order.deliveryMethod === "PICKUP" && order.storeLocation && appointment && (
          <p className="mt-2 text-sm text-foreground/60">
            Pickup at <span className="font-medium text-foreground">{order.storeLocation.name}</span> on{" "}
            {new Date(appointment.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })},{" "}
            {appointment.timeSlot}
          </p>
        )}
      </motion.div>

      <motion.ol
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-10 flex w-full items-center"
      >
        {timeline.map((label, i) => (
          <li key={label} className="flex flex-1 flex-col items-center gap-2 last:flex-none">
            <div
              className={`h-3 w-3 rounded-full ${i === 0 ? "bg-sage" : "bg-border"}`}
            />
            <span className={`text-[10px] ${i === 0 ? "text-foreground" : "text-foreground/40"}`}>{label}</span>
          </li>
        ))}
      </motion.ol>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="mt-10 flex flex-wrap justify-center gap-3"
      >
        <Button asChild>
          <Link href={`/account/orders/${order._id}`}>
            <PackageSearch className="h-4 w-4" /> Track order
          </Link>
        </Button>
        <Button variant="outline" magnetic={false} asChild>
          <a href={`${API_URL}/api/orders/${order._id}/invoice.pdf`} target="_blank" rel="noreferrer">
            <FileText className="h-4 w-4" /> Download invoice
          </a>
        </Button>
      </motion.div>

      {appointment && (
        <motion.a
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          href={`${API_URL}/api/appointments/${appointment._id}/ics`}
          className="mt-4 text-xs text-accent underline underline-offset-2"
        >
          Add pickup to calendar (.ics)
        </motion.a>
      )}
    </div>
  );
}
