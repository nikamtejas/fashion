export default function Loading() {
  return (
    <div className="px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-2">
        <div className="aspect-[3/4] w-full animate-pulse rounded-lg bg-black/10 dark:bg-white/10" />
        <div className="flex flex-col gap-3">
          <div className="h-4 w-20 animate-pulse rounded bg-black/10 dark:bg-white/10" />
          <div className="h-8 w-2/3 animate-pulse rounded bg-black/10 dark:bg-white/10" />
          <div className="h-6 w-24 animate-pulse rounded bg-black/10 dark:bg-white/10" />
          <div className="mt-4 h-20 w-full animate-pulse rounded bg-black/10 dark:bg-white/10" />
        </div>
      </div>
    </div>
  );
}
