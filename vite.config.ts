import { defineConfig } from "vite";

export default defineConfig({
  base: "./fun",
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
