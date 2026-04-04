import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "base" | "raised" | "bordered";
  children: ReactNode;
}

const variantStyles = {
  base:     "bg-(--color-bg-base)   border border-(--color-neutral-600) rounded-(--radius-lg) p-6",
  raised:   "bg-(--color-bg-raised) border border-(--color-neutral-600) rounded-(--radius-lg) p-6",
  bordered: "bg-transparent         border border-(--color-neutral-600) rounded-(--radius-lg) p-6",
};

export function Card({ variant = "base", children, className = "", ...props }: CardProps) {
  return (
    <div className={[variantStyles[variant], className].join(" ")} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "", ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={["flex items-center justify-between mb-4", className].join(" ")} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = "", ...props }: HTMLAttributes<HTMLHeadingElement> & { children: ReactNode }) {
  return (
    <h3 className={["text-base font-semibold text-(--color-neutral-100)", className].join(" ")} {...props}>
      {children}
    </h3>
  );
}
