"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    // initial={false}: skip the fade on first paint so icons/content show up
    // immediately on load instead of waiting out a 250ms opacity ramp.
    // mode="popLayout": the outgoing page animates out while the new one
    // animates in at the same time, instead of waiting for it to fully
    // exit first — halves the perceived delay on every navigation.
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
