import type { ComponentType } from 'react';

interface EmptyStateProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 bg-[#162029] border border-white/10 rounded-2xl">
      <Icon className="w-12 h-12 text-gray-400 mb-4" />
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-white/60 max-w-sm mb-6">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="bg-pf-primary hover:bg-pf-primary-light text-white font-semibold px-6 py-2.5 rounded-xl transition-colors text-sm"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
