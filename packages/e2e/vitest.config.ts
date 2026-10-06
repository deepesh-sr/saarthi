import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@sarathi/core": resolve(__dirname, "../core/src/index.ts"),
      "@sarathi/babel": resolve(__dirname, "../babel/src/index.ts"),
      "@sarathi/next": resolve(__dirname, "../next/src/index.ts"),
      "@sarathi/viewer": resolve(__dirname, "../viewer/src/index.ts"),
      "sarathi": resolve(__dirname, "../cli/src/index.ts"),
    },
  },
});
