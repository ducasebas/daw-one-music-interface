import { execFileSync } from "node:child_process";
import { defineConfig } from "vite";
let revision = "source";
try {
  revision = execFileSync("git", ["rev-parse", "--short=7", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
} catch {}
export default defineConfig({
  define: {
    __DAW_BUILD_INFO__: JSON.stringify({
      revision,
      createdAt: new Date().toISOString(),
    }),
  },
  server: {
    open: "/demo.html",
    proxy: {
      "/api": "http://127.0.0.1:3001",
      "/docs": "http://127.0.0.1:3001",
    },
  },
  build: { target: "es2022" },
});
