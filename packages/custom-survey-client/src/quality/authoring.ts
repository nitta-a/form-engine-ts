import type { AuthoringRequest, FormSchema, JsonValue } from "@form-engine-ts/core";
import type { QualityIssue } from "../types";

export interface ApplyAndRecheckQualityResult<TApply, TQuality> {
  readonly applyResult?: TApply;
  readonly quality?: TQuality;
}

export async function applyAndRecheckQuality<TApply extends { readonly success: boolean }, TQuality>(
  apply: () => TApply | undefined | Promise<TApply | undefined>,
  recheck: () => Promise<TQuality>
): Promise<ApplyAndRecheckQualityResult<TApply, TQuality>> {
  const applyResult = await apply();
  if (applyResult === undefined) return {};
  if (!applyResult.success) return { applyResult };
  return { applyResult, quality: await recheck() };
}

const optionIssueCodes = new Set(["missing_choices", "missing_options", "poor_option_wording"]);

function fieldIdFromPath(path: string | undefined, schema: FormSchema): string | undefined {
  const match = /^fields(?:\.|\[)([^.\]]+)/u.exec(path ?? "");
  if (match === null) return undefined;
  const reference = match[1];
  if (reference === undefined) return undefined;
  if (/^\d+$/u.test(reference)) return schema.fields[Number(reference)]?.id;
  return schema.fields.find((field) => field.id === reference)?.id;
}

export function createAuthoringRequestFromQualityIssue(issue: QualityIssue, schema: FormSchema): AuthoringRequest {
  const fieldId = fieldIdFromPath(issue.path, schema);
  const context: Record<string, JsonValue> = {
    qualityIssueId: `${issue.code}:${issue.path ?? ""}`,
    qualityIssueType: issue.code,
    qualityIssueMessage: issue.message,
    ...(issue.severity === undefined ? {} : { qualityIssueSeverity: issue.severity }),
    ...(issue.metadata === undefined ? {} : { qualityIssueMetadata: issue.metadata })
  };
  return {
    intent: optionIssueCodes.has(issue.code)
      ? "generate_options"
      : fieldId === undefined
        ? "improve_text"
        : "rewrite_field",
    prompt: `Resolve this quality issue: ${issue.code}. ${issue.message}`,
    ...(fieldId === undefined ? {} : { target: { kind: "field" as const, fieldId } }),
    context
  };
}
