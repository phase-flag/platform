import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?:   string;
  error?:   string;
  hint?:    string;
}

export function Input({ label, error, hint, id, className = "", ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-(--color-neutral-200)"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={[
          "w-full px-3 py-2 text-sm rounded-(--radius-md)",
          "bg-(--color-bg-raised) border text-(--color-neutral-100)",
          "placeholder:text-(--color-neutral-400)",
          "transition-colors duration-(--duration-fast)",
          "focus:outline-2 focus:outline-(--color-accent) focus:outline-offset-0",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          error
            ? "border-(--color-danger)"
            : "border-(--color-neutral-600) focus:border-(--color-accent)",
          className,
        ].join(" ")}
        {...props}
      />
      {error && <p className="text-xs text-(--color-danger)">{error}</p>}
      {hint && !error && <p className="text-xs text-(--color-neutral-400)">{hint}</p>}
    </div>
  );
}
