"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  side?: "right" | "left";
  children: React.ReactNode;
  className?: string;
}

export function Drawer({ open, onOpenChange, title, side = "right", children, className }: DrawerProps) {
  const isRight = side === "right";
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                className={cn(
                  "fixed top-0 z-50 flex h-full w-[92vw] max-w-md flex-col border-border bg-surface shadow-2xl",
                  isRight ? "right-0 border-l" : "left-0 border-r",
                  className
                )}
                initial={{ x: isRight ? "100%" : "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: isRight ? "100%" : "-100%" }}
                transition={{ type: "spring", stiffness: 320, damping: 34 }}
              >
                <div className="flex items-center justify-between border-b border-border px-6 py-4">
                  {title && <Dialog.Title className="font-display text-lg">{title}</Dialog.Title>}
                  <Dialog.Close className="ml-auto rounded-full p-1.5 text-foreground/60 hover:bg-foreground/5 hover:text-foreground">
                    <X className="h-4 w-4" />
                  </Dialog.Close>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
