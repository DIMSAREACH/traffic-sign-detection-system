import clsx from "./clsx.js";

export default function Skeleton({ className }) {
  return (
    <div className={clsx("relative overflow-hidden rounded-xl bg-black/5 dark:bg-white/5", className)}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.35s_infinite] bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent" />
    </div>
  );
}

