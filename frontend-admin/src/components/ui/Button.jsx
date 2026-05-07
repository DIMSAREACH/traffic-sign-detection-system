import { motion } from "framer-motion";
import clsx from "./clsx.js";

const variants = {
  primary: "bg-primary-800 text-white hover:bg-primary-700 shadow-sm shadow-black/10",
  ghost:
    "bg-transparent text-[color:var(--ds-text)] hover:bg-black/5 dark:hover:bg-white/5 border border-[color:var(--ds-border)]",
  danger: "bg-red-600 text-white hover:bg-red-500 shadow-sm shadow-black/10",
};

const sizes = {
  sm: "h-9 px-3 text-sm rounded-lg",
  md: "h-10 px-4 text-sm rounded-xl",
  lg: "h-11 px-5 text-base rounded-xl",
};

export default function Button({
  as: Comp = "button",
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}) {
  const base =
    "inline-flex items-center justify-center gap-2 font-semibold tracking-tight " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700/40 " +
    "disabled:opacity-60 disabled:cursor-not-allowed transition-colors";

  const MotionComp = motion.create(Comp);

  return (
    <MotionComp
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={clsx(base, variants[variant] || variants.primary, sizes[size] || sizes.md, className)}
      {...props}
    >
      {children}
    </MotionComp>
  );
}

