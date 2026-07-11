"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepperStep {
  label: string;
}

export function Stepper({
  steps,
  currentStep,
  className,
}: {
  steps: StepperStep[];
  currentStep: number;
  className?: string;
}) {
  return (
    <ol className={cn("flex w-full items-center", className)}>
      {steps.map((step, i) => {
        const isComplete = i < currentStep;
        const isCurrent = i === currentStep;
        return (
          <li key={step.label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <motion.div
                initial={false}
                animate={{
                  backgroundColor: isComplete || isCurrent ? "var(--color-sienna)" : "transparent",
                  borderColor: isComplete || isCurrent ? "var(--color-sienna)" : "var(--border)",
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold"
              >
                {isComplete ? (
                  <Check className="h-4 w-4 text-white" />
                ) : (
                  <span className={isCurrent ? "text-white" : "text-foreground/50"}>{i + 1}</span>
                )}
              </motion.div>
              <span
                className={cn(
                  "whitespace-nowrap text-xs font-medium",
                  isCurrent ? "text-foreground" : "text-foreground/50"
                )}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="mx-2 mb-5 h-px flex-1 bg-border">
                <motion.div
                  className="h-px bg-sienna"
                  initial={false}
                  animate={{ width: isComplete ? "100%" : "0%" }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
