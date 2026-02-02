import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig({
  base: "/",
  define: {
    __APP_ID__: JSON.stringify("gbfs-explorer"),
    __APP_BASE_PATH__: JSON.stringify("/"),
  },
  plugins: [react(), tsConfigPaths()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@/components/ui": path.resolve(__dirname, "./src/extensions/shadcn/components"),
      "@/hooks": path.resolve(__dirname, "./src/extensions/shadcn/hooks"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
