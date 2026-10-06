import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@saarthi/core": resolve(__dirname, "../core/src/index.ts"),
      "@saarthi/babel": resolve(__dirname, "../babel/src/index.ts"),
      "@saarthi/next": resolve(__dirname, "../next/src/index.ts"),
      "@saarthi/viewer": resolve(__dirname, "../viewer/src/index.ts"),
      "saarthi": resolve(__dirname, "../cli/src/index.ts"),
    },
  },
});
