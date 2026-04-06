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
        manualChunks(id) {
          if (id.includes("node_modules/pixi.js") || id.includes("node_modules/gsap")) return "vendor-fx";
          if (id.includes("node_modules/decimal.js")) return "vendor-math";
          if (id.includes("/src/systems/dungeon") || id.includes("/src/systems/combatHp")) return "feature-dungeon";
          if (id.includes("/src/ui/extraPanels") || id.includes("/src/ui/visualAssets")) return "feature-ui";
          return undefined;
        },
      },
    },
  },
});
