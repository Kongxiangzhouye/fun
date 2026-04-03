import { defineConfig } from "vite";

/** 本地默认 ./；CI 设 BASE_PATH=/funv2/ 以匹配 https://kongxiangzhouye.github.io/funv2/ */
const base = process.env.BASE_PATH || "./";
const isCi = process.env.CI === "true";

export default defineConfig({
  base,
  server: {
    host: true,
  },
  build: {
    target: "es2022",
    sourcemap: isCi,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
