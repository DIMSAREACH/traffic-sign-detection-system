import { execSync } from "node:child_process";
import fs from "node:fs";

// Admin dev server uses 5174; only free this port so we don't kill the user app.
const ports = [5174];

function isWindows() {
  return process.platform === "win32";
}

// #region agent log
function dbg(message, data, hypothesisId = "A", runId = "pre-fix") {
  try {
    fs.appendFileSync(
      "debug-b6ba61.log",
      `${JSON.stringify({
        sessionId: "b6ba61",
        runId,
        hypothesisId,
        location: "frontend-admin/scripts/free-ports.mjs",
        message,
        data,
        timestamp: Date.now(),
      })}\n`,
      "utf8"
    );
  } catch {
    // ignore
  }
}
// #endregion agent log

function getPidsOnPort(port) {
  if (!isWindows()) return [];
  try {
    const out = execSync(`netstat -ano | findstr ":${port}"`, { stdio: ["ignore", "pipe", "ignore"] })
      .toString("utf8")
      .trim();
    if (!out) return [];
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/);
      const pid = parts.at(-1);
      if (pid && /^\d+$/.test(pid)) pids.add(pid);
    }
    return [...pids];
  } catch {
    return [];
  }
}

function killPid(pid, port) {
  if (!isWindows()) return;
  try {
    execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
    process.stdout.write(`Freed port ${port} PID ${pid}\n`);
    dbg("killed pid", { port, pid }, "A");
  } catch {
    // ignore
  }
}

if (isWindows()) {
  dbg("free-ports start", { cwd: process.cwd(), ports }, "A");
  for (const port of ports) {
    const pids = getPidsOnPort(port);
    if (pids.length) dbg("pids on port", { port, pids }, "A");
    for (const pid of pids) killPid(pid, port);
  }
  dbg("free-ports done", { ports }, "A");
} else {
  dbg("free-ports skipped (non-windows)", { platform: process.platform }, "C");
}

