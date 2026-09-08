import { describe, expect, it } from "vitest";
import { toResponseSummary } from "../src/responseSummary";
import type { FormAnalytics, FormSchema } from "../src/types";

describe("toResponseSummary", () => {
  it("maps localized choice labels and clamps percentages", () => {
    const schema: FormSchema = {
      id: "poll",
      version: 1,
      title: "Poll",
      defaultLocale: "en",
      supportedLocales: ["en", "ja"],
      translations: { ja: { title: "投票" } },
      fields: [
        {
          id: "choice",
          type: "radio",
          title: "Choice",
          required: true,
          translations: { ja: { title: "選択" } },
          options: [{ id: "one", label: "One", translations: { ja: "一" } }]
        }
      ]
    };
    const analytics: FormAnalytics = {
      formId: "poll",
      formVersion: 1,
      submissionCount: 2,
      questions: [
        {
          fieldId: "choice",
          kind: "radio",
          answeredCount: 2,
          unansweredCount: 0,
          options: [{ id: "one", count: 2, percentageOfSubmissions: 120 }]
        }
      ]
    };
    expect(toResponseSummary(analytics, schema, "ja")).toMatchObject({
      title: "投票",
      questions: [{ label: "選択", options: [{ label: "一", percentage: 100 }] }]
    });
  });
});
