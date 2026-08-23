import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@form-engine\/core$/,
        replacement: fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url))
      },
      {
        find: /^@form-engine\/react$/,
        replacement: fileURLToPath(new URL("../../packages/react/src/index.ts", import.meta.url))
      },
      {
        find: /^@form-engine\/react\/styles\.css$/,
        replacement: fileURLToPath(new URL("../../packages/react/src/styles.css", import.meta.url))
      },
      {
        find: /^@form-engine\/storage-localstorage$/,
        replacement: fileURLToPath(new URL("../../packages/storage-localstorage/src/index.ts", import.meta.url))
      },
      {
        find: /^@form-engine\/storage-memory$/,
        replacement: fileURLToPath(new URL("../../packages/storage-memory/src/index.ts", import.meta.url))
      },
      {
        find: /^@form-engine\/translator-mock$/,
        replacement: fileURLToPath(new URL("../../packages/translator-mock/src/index.ts", import.meta.url))
      }
    ]
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"]
  }
});
