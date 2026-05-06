import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arena-accent disabled:pointer-events-none disabled:opacity-40",
        {
          primary:
            "bg-arena-accent text-white hover:bg-arena-accent-hover",
          ghost:
            "border border-arena-border bg-transparent text-arena-text hover:bg-arena-surface",
          danger:
            "bg-red-600 text-white hover:bg-red-700",
        }[variant],
        { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm", lg: "px-6 py-3 text-base" }[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
