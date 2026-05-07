import { motion } from "framer-motion";
import clsx from "./clsx.js";

export default function Card({ className, children, hoverLift = true, ...props }) {
  return (
    <motion.div
      className={clsx("glass rounded-xl2 p-4", hoverLift ? "will-change-transform" : "", className)}
      whileHover={hoverLift ? { y: -3, boxShadow: "var(--ds-shadow-lift)" } : undefined}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

