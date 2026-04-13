import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 5173,
    open: false
  },
  preview:
  {
    port: 4173,
    open: false
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"]
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("react-router")) {
            return "router-vendor";
          }

          if (id.includes("react") || id.includes("scheduler") || id.includes("zustand")) {
            return "react-vendor";
          }

          return undefined;
        }
      }
    }
  }
});
