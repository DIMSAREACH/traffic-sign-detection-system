import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), "");
  const viteAdminPort =
    (fileEnv.VITE_ADMIN_PORT && String(fileEnv.VITE_ADMIN_PORT).trim()) ||
    (mode === "admin" ? "5174" : "");

  return {
    plugins: [react()],
    ...(viteAdminPort
      ? { define: { "import.meta.env.VITE_ADMIN_PORT": JSON.stringify(viteAdminPort) } }
      : {}),
    server: {
      port: 5173,
      host: true,
      strictPort: true,
      proxy: {
        "/api": {
          target: "http://127.0.0.1:8000",
          changeOrigin: true,
        },
        "/media": {
          target: "http://127.0.0.1:8000",
          changeOrigin: true,
        },
      },
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "./src/test/setup.js",
      css: true,
    },
  };
});
