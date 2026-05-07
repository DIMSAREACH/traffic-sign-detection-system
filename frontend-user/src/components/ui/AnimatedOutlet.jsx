import { Suspense } from "react";
import { Outlet } from "react-router-dom";

/**
 * Keeps a stable min-height while a lazy route chunk loads so the shell (sidebar/header)
 * does not jump when the main column would otherwise collapse to zero height.
 */
function OutletChunkSpacer() {
  return <div className="outlet-suspense-spacer" aria-hidden="true" />;
}

export default function AnimatedOutlet() {
  return (
    <Suspense fallback={<OutletChunkSpacer />}>
      <Outlet />
    </Suspense>
  );
}
