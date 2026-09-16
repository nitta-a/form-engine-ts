import { createResponseAccumulator } from "@form-engine-ts/core/analytics";
import { aggregateForms } from "@form-engine-ts/core/cross-form-analytics";
import { EN_MESSAGES } from "@form-engine-ts/core/i18n/en";
import { createFormEngineTranslator } from "@form-engine-ts/core/i18n/translator";
import { createFormLifecycleAdapter } from "@form-engine-ts/core/lifecycle";
import { mapSchema } from "@form-engine-ts/core/mapping";
import { validateFormSchema } from "@form-engine-ts/core/schema";
import { createSubmission } from "@form-engine-ts/core/submission";
import { validateSubmission } from "@form-engine-ts/core/validation";
import { describe, expect, it } from "vitest";

describe("package subpath exports", () => {
  it("loads representative runtime entries without using the root barrel", () => {
    expect(typeof createResponseAccumulator).toBe("function");
    expect(typeof aggregateForms).toBe("function");
    expect(typeof createFormEngineTranslator).toBe("function");
    expect(typeof createFormLifecycleAdapter).toBe("function");
    expect(typeof mapSchema).toBe("function");
    expect(typeof createSubmission).toBe("function");
    expect(typeof validateFormSchema).toBe("function");
    expect(typeof validateSubmission).toBe("function");
    expect(EN_MESSAGES["form.submit"]).toBe("Submit");
  });
});
