interface SkeletonProps {
  variant: 'card' | 'row' | 'text';
  count?: number;
}

function SkeletonCard() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3 overflow-hidden">
      <div className="h-4 bg-white/5 rounded animate-shimmer w-1/3" />
      <div className="h-8 bg-white/5 rounded animate-shimmer w-1/2" />
      <div className="h-3 bg-white/5 rounded animate-shimmer w-2/3" />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 py-3 px-4 border-b border-white/5 overflow-hidden">
      <div className="w-8 h-8 rounded-full bg-white/5 animate-shimmer shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-white/5 rounded animate-shimmer w-1/3" />
        <div className="h-3 bg-white/5 rounded animate-shimmer w-1/2" />
      </div>
      <div className="h-3 bg-white/5 rounded animate-shimmer w-16" />
    </div>
  );
}

function SkeletonText() {
  return (
    <div className="space-y-2 overflow-hidden">
      <div className="h-3 bg-white/5 rounded animate-shimmer w-full" />
      <div className="h-3 bg-white/5 rounded animate-shimmer w-5/6" />
      <div className="h-3 bg-white/5 rounded animate-shimmer w-4/6" />
    </div>
  );
}

export default function Skeleton({ variant, count = 1 }: SkeletonProps) {
  const items = Array.from({ length: count }, (_, i) => i);

  if (variant === 'card') {
    return (
      <div className="space-y-4">
        {items.map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (variant === 'row') {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        {items.map((i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((i) => (
        <SkeletonText key={i} />
      ))}
    </div>
  );
}
