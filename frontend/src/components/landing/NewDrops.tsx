"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";

export interface NewDropProduct {
  slug: string;
  name: string;
  price: number;
  mrp?: number;
  image: string | null;
}

export function NewDrops({ products }: { products: NewDropProduct[] }) {
  const trackRef = useRef<HTMLDivElement>(null);

  function scrollBy(dir: 1 | -1) {
    trackRef.current?.scrollBy({ left: dir * 420, behavior: "smooth" });
  }

  if (products.length === 0) return null;

  return (
    <section className="py-20">
      <div className="mx-auto flex max-w-7xl items-end justify-between px-4 sm:px-6 lg:px-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-sienna">Just In</p>
          <h2 className="font-display mt-2 text-3xl sm:text-4xl">New Drops</h2>
        </div>
        <div className="hidden gap-2 sm:flex">
          <button
            onClick={() => scrollBy(-1)}
            aria-label="Scroll left"
            className="rounded-full border border-border p-2.5 hover:border-accent hover:text-accent"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scrollBy(1)}
            aria-label="Scroll right"
            className="rounded-full border border-border p-2.5 hover:border-accent hover:text-accent"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        className="mt-8 flex snap-x gap-6 overflow-x-auto px-4 pb-4 sm:px-6 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {products.map((p, i) => (
          <motion.div
            key={p.slug}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className="group w-64 shrink-0 snap-start sm:w-72"
          >
            <Link href={`/products/${p.slug}`}>
              <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-foreground/5">
                {p.image && (
                  <Image
                    src={p.image}
                    alt={p.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <p className="text-sm font-medium">{p.name}</p>
              </div>
              <div className="mt-1 flex items-baseline gap-2 text-sm text-foreground/60">
                <span>₹{p.price.toLocaleString("en-IN")}</span>
                {p.mrp && p.mrp > p.price && (
                  <span className="text-xs text-foreground/40 line-through">₹{p.mrp.toLocaleString("en-IN")}</span>
                )}
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
