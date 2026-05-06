import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-arena-border bg-arena-surface p-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
