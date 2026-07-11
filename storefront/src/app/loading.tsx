export default function Loading() {
  return (
    <div className="px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6 h-6 w-24 animate-pulse rounded bg-black/10 dark:bg-white/10" />
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i}>
            <div className="aspect-[3/4] w-full animate-pulse rounded-lg bg-black/10 dark:bg-white/10" />
            <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-black/10 dark:bg-white/10" />
            <div className="mt-1 h-4 w-1/3 animate-pulse rounded bg-black/10 dark:bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  );
}
