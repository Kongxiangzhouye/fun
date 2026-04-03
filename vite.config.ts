import { defineConfig } from "vite";

/** 本地默认 ./；CI 设 BASE_PATH=/fun/ 以匹配项目站 https://kongxiangzhouye.github.io/fun/（路径须与仓库名一致） */
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
