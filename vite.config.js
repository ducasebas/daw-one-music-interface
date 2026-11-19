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
  plugins:[{
    name:'offline-asset-inventory',
    generateBundle(_options,bundle){
      const assets=Object.keys(bundle).filter(path=>path.startsWith('assets/')&&/\.(js|css)$/.test(path)).map(path=>'/'+path).sort();
      this.emitFile({type:'asset',fileName:'offline-assets.json',source:JSON.stringify(assets)+'\n'});
    },
  }],
  define: {
    __DAW_BUILD_INFO__: JSON.stringify({
      revision,
      createdAt: new Date().toISOString(),
    }),
  },
  server: {
    open: "/demo.html",
    proxy: {
      "/api": { target: "http://127.0.0.1:3001", changeOrigin: false, xfwd: true },
      "/docs": "http://127.0.0.1:3001",
    },
  },
  build: { target: "es2022", rollupOptions: { input: { main: "index.html", remote: "remote.html" } } },
});
