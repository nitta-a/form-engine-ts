import type { FormPolicy } from "@form-engine-ts/core";

export const previewPolicy: FormPolicy = {
  maxFields: 20,
  maxOptionsPerField: 10,
  maxTextLength: 500,
  requiredLocales: ["ja", "en"],
  allowedLocales: ["ja", "en"],
  maxLocales: 2
};
