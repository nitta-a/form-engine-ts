import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@form-engine-ts/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
      "@form-engine-ts/privacy": fileURLToPath(new URL("../privacy/src/index.ts", import.meta.url)),
      "@form-engine-ts/react": fileURLToPath(new URL("../react/src/index.ts", import.meta.url))
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"]
  }
});
