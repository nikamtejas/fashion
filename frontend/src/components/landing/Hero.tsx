"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/Button";

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "35%"]);
  const opacity = useTransform(scrollYProgress, [0, 1], [1, 0.2]);

  return (
    <div ref={ref} className="relative h-[92vh] min-h-[560px] w-full overflow-hidden">
      <motion.div style={{ y }} className="absolute inset-0 -top-16 h-[calc(100%+4rem)]">
        <Image
          src="https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?w=1920&q=80"
          alt="LuxeLoom editorial campaign"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/20 to-ink/40" />
      </motion.div>

      <motion.div
        style={{ opacity }}
        className="relative flex h-full flex-col items-start justify-end px-6 pb-20 sm:px-10 lg:px-16"
      >
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-xs font-medium uppercase tracking-[0.3em] text-ivory/80"
        >
          Autumn / Winter Collection
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.7 }}
          className="font-display mt-4 max-w-2xl text-5xl leading-[1.05] text-ivory sm:text-6xl lg:text-7xl"
        >
          Considered pieces, worn with intent.
        </motion.h1>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.7 }}
          className="mt-8"
        >
          <Button asChild size="lg" variant="accent">
            <Link href="/shop">
              Shop the collection
            </Link>
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
