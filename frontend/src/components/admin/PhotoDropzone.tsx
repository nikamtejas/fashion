"use client";

import * as React from "react";
import Image from "next/image";
import { Camera, Upload, AlertTriangle } from "lucide-react";
import { fileToDataUri, checkImageQuality, type QualityWarning } from "@/lib/imageQuality";
import { cn } from "@/lib/utils";

export function PhotoDropzone({
  label,
  currentUrl,
  onSelect,
  disabled,
}: {
  label: string;
  currentUrl?: string;
  onSelect: (dataUri: string) => void;
  disabled?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [warnings, setWarnings] = React.useState<QualityWarning[]>([]);
  const [dragOver, setDragOver] = React.useState(false);

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    const dataUri = await fileToDataUri(file);
    setWarnings(await checkImageQuality(dataUri));
    onSelect(dataUri);
  }

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-foreground/70">{label}</p>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          "relative flex aspect-[3/4] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-surface transition-colors",
          dragOver && "border-accent bg-accent/5",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        {currentUrl ? (
          <Image src={currentUrl} alt={label} fill className="object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-foreground/40">
            <Upload className="h-6 w-6" />
            <span className="text-xs">Drop or tap to upload</span>
            <span className="flex items-center gap-1 text-[10px]">
              <Camera className="h-3 w-3" /> Camera supported on mobile
            </span>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          disabled={disabled}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {warnings.length > 0 && (
        <div className="mt-2 space-y-1">
          {warnings.map((w, i) => (
            <p key={i} className="flex items-start gap-1.5 text-xs text-amber-600">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {w.message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
