import { defineConfig } from "vite";

/** 本地默认 ./；CI 设 BASE_PATH=/fun/ 以匹配 https://<user>.github.io/fun/ */
const base = process.env.BASE_PATH || "./";

export default defineConfig({
  base,
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
