import type { FormSchema } from "@form-engine-ts/core";
import { createStandardPrivacyDetector } from "../src";

const schema: FormSchema = {
  id: "privacy",
  version: 1,
  title: "Privacy",
  fields: [
    { id: "freeText", type: "textarea", title: "Free text", required: false },
    { id: "choice", type: "select", title: "Choice", required: false, options: [{ id: "a", label: "A" }] }
  ]
};

describe("createStandardPrivacyDetector", () => {
  it("detects email, phone, URL, and Japanese postal-code candidates only in text fields", () => {
    const detector = createStandardPrivacyDetector();
    const findings = detector.detect(schema, {
      freeText: "mail ada@example.com phone +81 90-1234-5678 https://example.com 100-0001",
      choice: "ignored@example.com"
    });
    expect(findings.map((finding) => finding.type)).toEqual(["email", "url", "phone", "postal_code"]);
    expect(findings.every((finding) => finding.fieldId === "freeText")).toBe(true);
    expect(findings[0]).toMatchObject({ matchedText: "ada@example.com", start: 5, end: 20 });
  });

  it("supports disabling standard rules and adding custom detectors", () => {
    const detector = createStandardPrivacyDetector({
      rules: [{ type: "email", pattern: /unused/u, enabled: false }],
      customDetectors: [
        (fieldId, text) => (text.includes("SECRET") ? [{ fieldId, type: "secret", matchedText: "SECRET" }] : [])
      ]
    });
    expect(detector.detect(schema, { freeText: "ada@example.com SECRET" })).toEqual([
      { fieldId: "freeText", type: "secret", matchedText: "SECRET" }
    ]);
  });
});
