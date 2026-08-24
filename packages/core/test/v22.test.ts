import { type FormPolicy, type FormSchema, validateFormSchema } from "../src";

const schema: FormSchema = {
  id: "locale-policy",
  version: 1,
  title: "Locale policy",
  defaultLocale: "en",
  supportedLocales: ["en", "ja", "zh"],
  fields: [{ id: "name", type: "text", title: "Name", required: false }]
};

function issueCodes(policy: FormPolicy): readonly string[] {
  const result = validateFormSchema(schema, { policy });
  if (result.valid) return [];
  return result.issues.map((item) => item.code);
}

describe("v2.2 locale policy", () => {
  it("rejects unsupported default and registered locales", () => {
    expect(issueCodes({ allowedLocales: ["en", "ja"] })).toContain("disallowed_locale");
    const invalidDefault = validateFormSchema(
      { ...schema, defaultLocale: "zh" },
      { policy: { allowedLocales: ["en"] } }
    );
    expect(invalidDefault.valid).toBe(false);
    if (!invalidDefault.valid) {
      expect(invalidDefault.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "defaultLocale", code: "disallowed_locale" }),
          expect.objectContaining({ path: "supportedLocales[1]", code: "disallowed_locale" })
        ])
      );
    }
  });

  it("counts unique default and supported locales against maxLocales", () => {
    expect(issueCodes({ maxLocales: 2 })).toContain("max_locales_exceeded");
    const withinLimit = validateFormSchema(
      { ...schema, supportedLocales: ["en", "ja"] },
      { policy: { maxLocales: 2 } }
    );
    expect(withinLimit.valid).toBe(true);
  });

  it("reports contradictory required and allowed locale policies", () => {
    expect(issueCodes({ allowedLocales: ["en", "ja"], requiredLocales: ["zh"] })).toContain(
      "required_locale_not_allowed"
    );
  });
});
