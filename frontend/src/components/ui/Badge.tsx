import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider",
  {
    variants: {
      variant: {
        default: "bg-ink/5 text-foreground dark:bg-ivory/10",
        accent: "bg-sienna/10 text-sienna",
        success: "bg-sage/15 text-[var(--color-sage-dark)]",
        outline: "border border-border text-foreground/70",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
