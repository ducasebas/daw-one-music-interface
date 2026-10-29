import { defineConfig } from "vite";
export default defineConfig({
  server: {
    proxy: {
      "/api": "http://127.0.0.1:3001",
      "/docs": "http://127.0.0.1:3001",
    },
  },
  build: { target: "es2022" },
});
