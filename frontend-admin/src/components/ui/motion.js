export const motionDurations = {
  fast: 0.18,
  base: 0.22,
  slow: 0.26,
};

export const motionEasing = {
  standard: [0.16, 1, 0.3, 1],
};

export const pageTransition = {
  initial: { opacity: 0, y: 6 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: motionDurations.fast, ease: motionEasing.standard },
  },
  exit: {
    opacity: 0,
    y: 4,
    transition: { duration: 0.12, ease: motionEasing.standard },
  },
};

