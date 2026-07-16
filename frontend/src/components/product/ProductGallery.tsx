"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface GalleryImage {
  url: string;
  thumbUrl?: string;
  altText?: string;
  type: string;
}

export function ProductGallery({ images }: { images: GalleryImage[] }) {
  const [active, setActive] = React.useState(0);
  const [zoomPos, setZoomPos] = React.useState({ x: 50, y: 50 });
  const [zooming, setZooming] = React.useState(false);
  const current = images[active] ?? images[0];

  return (
    <div>
      <div className="flex gap-4">
        <div className="hidden flex-col gap-3 sm:flex">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={cn(
                "relative h-20 w-16 overflow-hidden rounded-lg border-2 transition-colors",
                active === i ? "border-accent" : "border-transparent opacity-70 hover:opacity-100"
              )}
            >
              <Image src={img.thumbUrl ?? img.url} alt={img.altText ?? ""} fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>

        <div
          className="relative flex-1 aspect-[3/4] cursor-zoom-in overflow-hidden rounded-2xl bg-foreground/5"
          onMouseEnter={() => setZooming(true)}
          onMouseLeave={() => setZooming(false)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setZoomPos({
              x: ((e.clientX - rect.left) / rect.width) * 100,
              y: ((e.clientY - rect.top) / rect.height) * 100,
            });
          }}
        >
          {current && (
            <Image
              src={current.url}
              alt={current.altText ?? ""}
              fill
              priority
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-cover transition-transform duration-150 ease-out"
              style={
                zooming
                  ? { transform: "scale(1.8)", transformOrigin: `${zoomPos.x}% ${zoomPos.y}%` }
                  : undefined
              }
            />
          )}
          {current?.type === "AI_MODEL" && (
            <span className="absolute bottom-3 left-3 rounded-full bg-ink/70 px-2.5 py-1 text-[10px] uppercase tracking-wider text-ivory">
              Visualized on AI model
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 flex gap-2 sm:hidden">
        {images.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={cn("h-1.5 flex-1 rounded-full", active === i ? "bg-accent" : "bg-border")}
          />
        ))}
      </div>
    </div>
  );
}
