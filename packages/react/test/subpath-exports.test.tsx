import { FormBuilder } from "@form-engine-ts/react/builder";
import { useFormBuilder } from "@form-engine-ts/react/hooks";
import { BUILDER_TRANSLATION_KEYS } from "@form-engine-ts/react/i18n";
import { FormRenderer } from "@form-engine-ts/react/renderer";
import { createSubmissionController } from "@form-engine-ts/react/submission";
import { describe, expect, it } from "vitest";

describe("package subpath exports", () => {
  it("loads representative runtime entries without using the root barrel", () => {
    expect(typeof FormBuilder).toBe("function");
    expect(typeof FormRenderer).toBe("function");
    expect(BUILDER_TRANSLATION_KEYS.ADD_FIELD).toBe("builder.actions.addField");
    expect(typeof createSubmissionController).toBe("function");
    expect(typeof useFormBuilder).toBe("function");
  });
});
