import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/odoo": {
        target: "http://odoo:8069",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/odoo/, "")
      }
    }
  }
});