import type { FormSchema } from "@form-engine-ts/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  applyAndRecheckQuality,
  createAuthoringRequestFromQualityIssue,
  SurveyProvider,
  SurveyQualityPanel
} from "../src";

const schema: FormSchema = {
  id: "quality-form",
  version: 1,
  title: "Survey",
  fields: [{ id: "q1", type: "text", title: "Question", required: false }]
};

describe("quality authoring integration", () => {
  it("maps an issue to a targeted authoring request without answers", () => {
    expect(
      createAuthoringRequestFromQualityIssue(
        { code: "leading_question", message: "The question is leading.", path: "fields.0.title" },
        schema
      )
    ).toEqual({
      intent: "rewrite_field",
      prompt: "Resolve this quality issue: leading_question. The question is leading.",
      target: { kind: "field", fieldId: "q1" },
      context: {
        qualityIssueId: "leading_question:fields.0.title",
        qualityIssueType: "leading_question",
        qualityIssueMessage: "The question is leading."
      }
    });
  });

  it("maps option issues and falls back without a target when the path is unknown", () => {
    for (const code of ["missing_choices", "missing_options", "poor_option_wording"] as const) {
      expect(
        createAuthoringRequestFromQualityIssue({ code, message: "Add better choices.", path: "fields.0" }, schema)
      ).toMatchObject({ intent: "generate_options", target: { kind: "field", fieldId: "q1" } });
    }
    const fallback = createAuthoringRequestFromQualityIssue(
      { code: "ambiguous_question", message: "The path is unavailable.", path: "unknown.title" },
      schema
    );
    expect(fallback.intent).toBe("improve_text");
    expect(fallback).not.toHaveProperty("target");
  });

  it("shows the AI fix action only when supplied", () => {
    const issue = { code: "leading_question", message: "The question is leading." };
    const onRequestAiFix = vi.fn();
    const result = { issues: [issue] };
    const { rerender } = render(<SurveyQualityPanel result={result} />);
    expect(screen.queryByRole("button", { name: "Fix with AI" })).not.toBeInTheDocument();
    rerender(<SurveyQualityPanel result={result} onRequestAiFix={onRequestAiFix} />);
    fireEvent.click(screen.getByRole("button", { name: "Fix with AI" }));
    expect(onRequestAiFix).toHaveBeenCalledWith(issue);
  });

  it("uses the existing survey translation scope for quality actions", () => {
    render(
      <SurveyProvider
        translation={{
          common: (key) => key,
          customSurvey: (key) =>
            ({
              "quality.accept": "承認",
              "quality.reject": "却下",
              "quality.fixWithAi": "AIで修正"
            })[key] ?? key
        }}
      >
        <SurveyQualityPanel
          result={{ issues: [{ code: "leading_question", message: "The question is leading." }] }}
          onDecide={vi.fn()}
          onRequestAiFix={vi.fn()}
        />
      </SurveyProvider>
    );
    expect(screen.getByRole("button", { name: "承認" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "却下" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AIで修正" })).toBeInTheDocument();
  });

  it("rechecks quality only after a successful authoring apply", async () => {
    const recheck = vi.fn().mockResolvedValue({ issues: [] });
    const applied = await applyAndRecheckQuality(async () => ({ success: true as const, schema }), recheck);
    expect(applied).toEqual({ applyResult: { success: true, schema }, quality: { issues: [] } });
    expect(recheck).toHaveBeenCalledOnce();

    recheck.mockClear();
    const rejected = await applyAndRecheckQuality(
      () => ({ success: false as const, error: { code: "validation_failed" } }),
      recheck
    );
    expect(rejected.quality).toBeUndefined();
    expect(recheck).not.toHaveBeenCalled();

    expect(await applyAndRecheckQuality(() => undefined, recheck)).toEqual({});
    expect(recheck).not.toHaveBeenCalled();

    const recheckError = new Error("quality unavailable");
    await expect(
      applyAndRecheckQuality(
        async () => ({ success: true as const, schema }),
        async () => {
          throw recheckError;
        }
      )
    ).rejects.toBe(recheckError);
  });
});
