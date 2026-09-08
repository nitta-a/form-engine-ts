import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: /^@form-engine-ts\/mui\/builder$/,
        replacement: fileURLToPath(new URL("../../packages/mui/src/builder.ts", import.meta.url))
      },
      {
        find: /^@form-engine-ts\/mui\/renderer$/,
        replacement: fileURLToPath(new URL("../../packages/mui/src/renderer.ts", import.meta.url))
      },
      {
        find: /^@form-engine-ts\/mui$/,
        replacement: fileURLToPath(new URL("../../packages/mui/src/index.ts", import.meta.url))
      },
      {
        find: /^@form-engine-ts\/custom-survey-client$/,
        replacement: fileURLToPath(new URL("../../packages/custom-survey-client/src/index.ts", import.meta.url))
      },
      {
        find: /^@form-engine-ts\/core$/,
        replacement: fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url))
      },
      {
        find: /^@form-engine-ts\/react$/,
        replacement: fileURLToPath(new URL("../../packages/react/src/index.ts", import.meta.url))
      },
      {
        find: /^@form-engine-ts\/react\/styles\.css$/,
        replacement: fileURLToPath(new URL("../../packages/react/src/styles.css", import.meta.url))
      },
      {
        find: /^@form-engine-ts\/storage-localstorage$/,
        replacement: fileURLToPath(new URL("../../packages/storage-localstorage/src/index.ts", import.meta.url))
      },
      {
        find: /^@form-engine-ts\/storage-memory$/,
        replacement: fileURLToPath(new URL("../../packages/storage-memory/src/index.ts", import.meta.url))
      },
      {
        find: /^@form-engine-ts\/translator-mock$/,
        replacement: fileURLToPath(new URL("../../packages/translator-mock/src/index.ts", import.meta.url))
      }
    ]
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    testTimeout: 30000
  }
});
