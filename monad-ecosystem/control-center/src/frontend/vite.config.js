import { fileURLToPath, URL } from "url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import environment from "vite-plugin-environment";
import { logocApiPlugin } from "./vite-plugin-logoc-api.js";

const ii_url =
  process.env.DFX_NETWORK === "local"
    ? `http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:8081/`
    : `https://identity.internetcomputer.org/`;

process.env.II_URL = process.env.II_URL || ii_url;
process.env.STORAGE_GATEWAY_URL =
  process.env.STORAGE_GATEWAY_URL || "https://blob.caffeine.ai";
process.env.VITE_GNOSTIC_API_URL = process.env.VITE_GNOSTIC_API_URL || "";

export default defineConfig({
  logLevel: "error",
  build: {
    emptyOutDir: true,
    sourcemap: false,
    minify: false,
  },
  css: {
    postcss: "./postcss.config.js",
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
  server: {
    proxy: {
      // Vector 4.3 — Sovereign Express host (gate-acl + Cardia SSE).
      // More specific than generic /api so ICP canister proxy still works.
      "/api/v1/gate-acl": {
        target: process.env.VITE_SOVEREIGN_HOST || "http://localhost:3001",
        changeOrigin: true,
      },
      "/api/v1/cardia": {
        target: process.env.VITE_SOVEREIGN_HOST || "http://localhost:3001",
        changeOrigin: true,
        // SSE: disable buffering if the proxy supports it
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            if (
              proxyRes.headers["content-type"]?.includes("text/event-stream")
            ) {
              proxyRes.headers["cache-control"] = "no-cache";
              proxyRes.headers["x-accel-buffering"] = "no";
            }
          });
        },
      },
      "/api": {
        target: "http://127.0.0.1:4943",
        changeOrigin: true,
      },
      // Gnostic Engine — Phase C live feed proxy
      // Proxies /gnostic-api/* → http://localhost:8001/*
      // Keeps SSE CORS-free in local dev; VITE_GNOSTIC_API_URL overrides in prod.
      "/gnostic-api": {
        target: "http://localhost:8001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gnostic-api/, ""),
      },
    },
  },
  plugins: [
    environment("all", { prefix: "CANISTER_" }),
    environment("all", { prefix: "DFX_" }),
    environment(["II_URL"]),
    environment(["STORAGE_GATEWAY_URL"]),
    environment(["VITE_GNOSTIC_API_URL"]),
    react(),
    logocApiPlugin(), // Live LOGOC corpus API — reads from master_corpus_v5.8_final.jsonl
  ],
  resolve: {
    alias: [
      {
        find: "declarations",
        replacement: fileURLToPath(new URL("../declarations", import.meta.url)),
      },
      {
        find: "@",
        replacement: fileURLToPath(new URL("./src", import.meta.url)),
      },
    ],
    dedupe: ["@dfinity/agent"]
  },
});
