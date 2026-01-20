/**
 * Skeleton Loader Components
 * 
 * Provides various placeholder loading states (Skeleton Cards, Tables, and Generic content) 
 * matching the app's visual design system.
 */

export function SkeletonCard() {
  return (
    <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-zinc-800">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-2 h-6 w-3/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
        <div className="h-12 w-12 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
      </div>

      <div className="mb-6 space-y-3">
        <div className="h-4 w-1/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="flex gap-2">
          <div className="h-6 w-20 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
        </div>
      </div>

      <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
        <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
    </div>
  );
}

export function SkeletonTable() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-lg bg-white p-4 shadow-sm dark:bg-zinc-800"
        >
          <div className="h-4 w-1/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-4 w-1/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-4 w-1/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-4 w-1/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonGeneric() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-3/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="h-4 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="h-4 w-5/6 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="h-4 w-4/6 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
    </div>
  );
}
