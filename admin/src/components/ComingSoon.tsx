export function ComingSoon({ title, milestone }: { title: string; milestone: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        Coming in {milestone}.
      </p>
    </div>
  );
}
