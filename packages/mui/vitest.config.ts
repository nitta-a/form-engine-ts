import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@form-engine-ts/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url))
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: [fileURLToPath(new URL("./test/setup.ts", import.meta.url))],
    testTimeout: 15000
  }
});
