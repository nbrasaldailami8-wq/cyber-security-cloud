"use client";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "card" | "avatar" | "chart" | "table";
  count?: number;
}

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-lg ${className || ""}`}
      style={{ minHeight: "1em" }}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="glass-card p-6 space-y-4">
      <SkeletonBlock className="h-6 w-3/4" />
      <SkeletonBlock className="h-4 w-1/2" />
      <div className="pt-2">
        <SkeletonBlock className="h-20 w-full" />
      </div>
      <div className="flex gap-2 pt-2">
        <SkeletonBlock className="h-8 w-20 rounded-md" />
        <SkeletonBlock className="h-8 w-20 rounded-md" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex gap-4 pb-2 border-b border-[#30363d]">
        <SkeletonBlock className="h-4 w-1/4" />
        <SkeletonBlock className="h-4 w-1/4" />
        <SkeletonBlock className="h-4 w-1/4" />
        <SkeletonBlock className="h-4 w-1/4" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <SkeletonBlock className="h-4 w-1/4" />
          <SkeletonBlock className="h-4 w-1/4" />
          <SkeletonBlock className="h-4 w-1/4" />
          <SkeletonBlock className="h-4 w-1/4" />
        </div>
      ))}
    </div>
  );
}

export function StatsCardSkeleton() {
  return (
    <div className="glass-card p-6 space-y-3">
      <SkeletonBlock className="h-4 w-1/3" />
      <SkeletonBlock className="h-8 w-1/2" />
      <SkeletonBlock className="h-3 w-2/3" />
    </div>
  );
}

export default function LoadingSkeleton({ variant = "card", count = 1 }: SkeletonProps) {
  const items = Array.from({ length: count });

  switch (variant) {
    case "card":
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((_, i) => <CardSkeleton key={i} />)}
        </div>
      );
    case "table":
      return <TableSkeleton rows={count * 3} />;
    case "chart":
      return (
        <div className="glass-card p-6 space-y-4">
          <SkeletonBlock className="h-4 w-1/4" />
          <SkeletonBlock className="h-48 w-full" />
        </div>
      );
    default:
      return <CardSkeleton />;
  }
}
