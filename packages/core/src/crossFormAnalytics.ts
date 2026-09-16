import { aggregateResponses } from "./analytics";
import { evaluateQuizLocally, getFormContentMode, type QuizEvaluationResult } from "./contentMode";
import { assertValidFormSchema } from "./schema";
import type { FormAnalytics, FormPolicy, FormSchema, FormSubmission } from "./types";
import { validateAnswers } from "./validation";

export type CrossFormSkipReason = "schema_missing" | "invalid_answers" | "not_quiz" | "evaluation_failed";
export interface CrossFormAnalyticsOptions<TSubmission extends FormSubmission = FormSubmission> {
  readonly policy?: FormPolicy;
  readonly byLocale?: boolean;
  readonly byContentMode?: boolean;
  readonly metadata?: Readonly<
    Record<string, (submission: TSubmission) => string | number | boolean | null | undefined>
  >;
  readonly scores?: boolean;
  readonly includeSkipDetails?: boolean;
}
export interface CrossFormScoreSummary {
  readonly evaluatedCount: number;
  readonly averageScore: number | null;
  readonly scoreRate: number | null;
  readonly passCount: number;
  readonly passEligibleCount: number;
  readonly passRate: number | null;
}
export interface CrossFormAnalytics {
  readonly processedCount: number;
  readonly aggregatedCount: number;
  readonly forms: readonly FormAnalytics[];
  readonly groups: Readonly<
    Record<
      string,
      readonly {
        readonly key: string | number | boolean | null;
        readonly count: number;
        readonly forms: readonly FormAnalytics[];
        readonly scores?: CrossFormScoreSummary;
      }[]
    >
  >;
  readonly scores?: CrossFormScoreSummary;
  readonly skipCounts: Readonly<Record<CrossFormSkipReason, number>>;
  readonly skipDetails?: readonly { readonly submissionId: string; readonly reason: CrossFormSkipReason }[];
}

export function aggregateForms<TSubmission extends FormSubmission = FormSubmission>(
  schemas: readonly FormSchema[],
  submissions: readonly TSubmission[],
  options: CrossFormAnalyticsOptions<TSubmission> = {}
): CrossFormAnalytics {
  const key = (id: string, version: number) => JSON.stringify([id, version]);
  const index = new Map<string, FormSchema>();
  for (const schema of schemas) {
    assertValidFormSchema(schema, options.policy === undefined ? {} : { policy: options.policy });
    const identity = key(schema.id, schema.version);
    if (index.has(identity)) throw new TypeError(`Duplicate schema: ${identity}`);
    index.set(identity, schema);
  }
  const groups = new Map<string, Map<string | number | boolean | null, TSubmission[]>>();
  const accepted: TSubmission[] = [];
  const evaluations = new Map<TSubmission, QuizEvaluationResult>();
  const skipCounts: Record<CrossFormSkipReason, number> = {
    schema_missing: 0,
    invalid_answers: 0,
    not_quiz: 0,
    evaluation_failed: 0
  };
  const skipDetails: { submissionId: string; reason: CrossFormSkipReason }[] = [];
  const skip = (submissionId: string, reason: CrossFormSkipReason) => {
    skipCounts[reason]++;
    if (options.includeSkipDetails === true) skipDetails.push({ submissionId, reason });
  };
  const group = (dimension: string, value: string | number | boolean | null | undefined, submission: TSubmission) => {
    if (typeof value === "number" && !Number.isFinite(value)) throw new TypeError("Grouping keys must be finite.");
    const entries = groups.get(dimension) ?? new Map<string | number | boolean | null, TSubmission[]>();
    const groupKey = value ?? null;
    const members = entries.get(groupKey) ?? [];
    members.push(submission);
    entries.set(groupKey, members);
    groups.set(dimension, entries);
  };
  const summarize = (members: readonly TSubmission[]) => {
    const perForm = new Map<string, TSubmission[]>();
    let evaluatedCount = 0;
    let score = 0;
    let maximum = 0;
    let passCount = 0;
    let passEligibleCount = 0;
    for (const submission of members) {
      const identity = key(submission.formId, submission.formVersion);
      const responses = perForm.get(identity) ?? [];
      responses.push(submission);
      perForm.set(identity, responses);
      const evaluation = evaluations.get(submission);
      if (evaluation === undefined) continue;
      evaluatedCount++;
      score += evaluation.totalScore;
      maximum += evaluation.maxPossibleScore;
      if (evaluation.isPassed !== undefined) {
        passEligibleCount++;
        if (evaluation.isPassed) passCount++;
      }
    }
    const forms = [...perForm].map(([identity, responses]) => {
      const schema = index.get(identity);
      if (schema === undefined) throw new Error("Missing indexed schema.");
      return aggregateResponses(schema, responses, options.policy === undefined ? {} : { policy: options.policy });
    });
    return {
      forms,
      ...(options.scores !== true
        ? {}
        : {
            scores: {
              evaluatedCount,
              averageScore: evaluatedCount === 0 ? null : score / evaluatedCount,
              scoreRate: maximum === 0 ? null : score / maximum,
              passCount,
              passEligibleCount,
              passRate: passEligibleCount === 0 ? null : passCount / passEligibleCount
            }
          })
    };
  };
  for (const submission of submissions) {
    const schema = index.get(key(submission.formId, submission.formVersion));
    if (schema === undefined) {
      skip(submission.id, "schema_missing");
      continue;
    }
    if (!validateAnswers(schema, submission.values).valid) {
      skip(submission.id, "invalid_answers");
      continue;
    }
    accepted.push(submission);
    const mode = getFormContentMode(schema.metadata);
    if (options.byLocale === true) group("locale", submission.locale, submission);
    if (options.byContentMode === true) group("contentMode", mode, submission);
    for (const [name, select] of Object.entries(options.metadata ?? {}))
      group(`metadata:${name}`, select(submission), submission);
    if (options.scores !== true) continue;
    if (mode !== "quiz") {
      skip(submission.id, "not_quiz");
      continue;
    }
    try {
      const evaluation = evaluateQuizLocally(schema, submission.values, options.policy);
      evaluations.set(submission, evaluation);
    } catch {
      skip(submission.id, "evaluation_failed");
    }
  }
  return {
    processedCount: submissions.length,
    aggregatedCount: accepted.length,
    ...summarize(accepted),
    groups: Object.fromEntries(
      [...groups].map(([dimension, entries]) => [
        dimension,
        [...entries].map(([key, members]) => ({ key, count: members.length, ...summarize(members) }))
      ])
    ),
    skipCounts,
    ...(options.includeSkipDetails === true ? { skipDetails } : {})
  };
}
