import type { FormEngineTranslationKey } from "../src";
import { EN_MESSAGES, JA_MESSAGES } from "../src";

describe("official i18n catalogs", () => {
  it("contains the complete public key catalog", () => {
    const keys: readonly FormEngineTranslationKey[] = [
      "builder.formTitle",
      "builder.localization.title",
      "builder.submissionSettings.renderMode",
      "renderer.submitButton",
      "workspace.errors.translationFailed"
    ];

    for (const key of keys) {
      expect(JA_MESSAGES[key]).toBeTruthy();
      expect(EN_MESSAGES[key]).toBeTruthy();
    }
  });
});
