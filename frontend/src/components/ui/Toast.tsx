"use client";

import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "error";

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (t: Omit<ToastItem, "id" | "variant"> & { variant?: ToastVariant }) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const variantStyles: Record<ToastVariant, string> = {
  default: "border-border bg-surface text-foreground",
  success: "border-sage/40 bg-sage/10 text-[var(--color-sage-dark)]",
  error: "border-red-300 bg-red-50 text-red-700",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const toast = React.useCallback((t: Omit<ToastItem, "id" | "variant"> & { variant?: ToastVariant }) => {
    const id = crypto.randomUUID();
    setItems((prev) => [...prev, { id, variant: "default", ...t }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        <AnimatePresence>
          {items.map((item) => (
            <ToastPrimitive.Root
              key={item.id}
              duration={4000}
              asChild
              forceMount
              onOpenChange={(open) => {
                if (!open) setItems((prev) => prev.filter((i) => i.id !== item.id));
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
                className={cn("rounded-xl border px-4 py-3 shadow-lg", variantStyles[item.variant])}
              >
                <ToastPrimitive.Title className="text-sm font-medium">{item.title}</ToastPrimitive.Title>
                {item.description && (
                  <ToastPrimitive.Description className="mt-0.5 text-xs opacity-80">
                    {item.description}
                  </ToastPrimitive.Description>
                )}
              </motion.div>
            </ToastPrimitive.Root>
          ))}
        </AnimatePresence>
        <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-[100] flex w-80 max-w-[92vw] flex-col gap-2 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
