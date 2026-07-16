"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function BeforeAfterSlider({ before, after, className }: { before: string; after: string; className?: string }) {
  const [pct, setPct] = React.useState(50);
  const ref = React.useRef<HTMLDivElement>(null);

  function handleMove(clientX: number) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPct(Math.min(100, Math.max(0, next)));
  }

  return (
    <div
      ref={ref}
      className={cn("relative aspect-[3/4] w-full select-none overflow-hidden rounded-xl bg-foreground/5", className)}
      onMouseMove={(e) => e.buttons === 1 && handleMove(e.clientX)}
      onTouchMove={(e) => handleMove(e.touches[0].clientX)}
    >
      <Image src={before} alt="Before" fill sizes="(min-width: 640px) 50vw, 100vw" className="object-cover" />
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${pct}%` }}>
        <div className="relative h-full" style={{ width: `${(100 / pct) * 100 || 0}%` }}>
          <Image src={after} alt="After" fill sizes="(min-width: 640px) 50vw, 100vw" className="object-cover" />
        </div>
      </div>
      <div
        className="absolute top-0 h-full w-0.5 cursor-ew-resize bg-white shadow-lg"
        style={{ left: `${pct}%` }}
        onMouseDown={(e) => {
          e.preventDefault();
          const onMove = (ev: MouseEvent) => handleMove(ev.clientX);
          const onUp = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
          };
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        }}
      >
        <div className="absolute top-1/2 left-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow-lg">
          ⇔
        </div>
      </div>
      <span className="absolute left-2 top-2 rounded-full bg-ink/70 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ivory">
        Before
      </span>
      <span className="absolute right-2 top-2 rounded-full bg-ink/70 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ivory">
        After
      </span>
    </div>
  );
}
