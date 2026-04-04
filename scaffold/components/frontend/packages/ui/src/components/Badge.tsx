import type { HTMLAttributes, ReactNode } from "react";

type BadgeVariant = "accent" | "success" | "warning" | "danger" | "neutral";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: ReactNode;
}

const styles: Record<BadgeVariant, string> = {
  accent:  "bg-(--color-accent)/15   text-(--color-accent)  border border-(--color-accent)/30",
  success: "bg-(--color-success)/15  text-(--color-success) border border-(--color-success)/30",
  warning: "bg-(--color-warning)/15  text-(--color-warning) border border-(--color-warning)/30",
  danger:  "bg-(--color-danger)/15   text-(--color-danger)  border border-(--color-danger)/30",
  neutral: "bg-(--color-neutral-600)/20 text-(--color-neutral-200) border border-(--color-neutral-600)",
};

export function Badge({ variant = "neutral", children, className = "", ...props }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center px-2 py-0.5 rounded-(--radius-full) text-xs font-medium",
        styles[variant],
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </span>
  );
}
