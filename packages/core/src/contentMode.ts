import type { FormPolicy, FormSchema, JsonValue } from "./types";
import { calculateFieldVisibility } from "./visibility";

export type FormContentMode = "survey" | "poll" | "quiz";
export interface PollMetadata {
  readonly resultVisibility: "after_submit" | "always" | "closed_only" | "private";
  readonly strictOneVotePerUser?: boolean;
}
export interface QuizFieldMetadata {
  readonly correctOptionId: string;
  readonly explanation?: string;
  readonly points?: number;
}
export interface QuizMetadata {
  readonly showExplanation: "after_submit" | "immediate";
  readonly passingScore?: number;
}
export interface CustomFormMetadata {
  readonly mode: FormContentMode;
  readonly poll?: PollMetadata;
  readonly quiz?: QuizMetadata;
  readonly [key: string]: unknown;
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value));
}
export function getFormContentMode(metadata: unknown): FormContentMode {
  const { mode } = record(metadata);
  if (mode === "poll" || mode === "quiz") return mode;
  return "survey";
}
export function readPollMetadata(metadata: unknown): PollMetadata {
  const { resultVisibility, strictOneVotePerUser } = record(record(metadata).poll);
  return {
    resultVisibility:
      resultVisibility === "always" || resultVisibility === "closed_only" || resultVisibility === "private"
        ? resultVisibility
        : "after_submit",
    ...(typeof strictOneVotePerUser === "boolean" ? { strictOneVotePerUser } : {})
  };
}
export function readQuizMetadata(metadata: unknown): QuizMetadata {
  const { showExplanation, passingScore } = record(record(metadata).quiz);
  return {
    showExplanation: showExplanation === "immediate" ? "immediate" : "after_submit",
    ...(typeof passingScore === "number" ? { passingScore } : {})
  };
}
export function readQuizFieldMetadata(metadata: unknown): QuizFieldMetadata {
  const { correctOptionId, explanation, points } = record(record(metadata).quiz);
  return {
    correctOptionId: typeof correctOptionId === "string" ? correctOptionId : "",
    ...(typeof explanation === "string" ? { explanation } : {}),
    ...(typeof points === "number" ? { points } : {})
  };
}
/** Explicit JSON boundary: rejects non-JSON values instead of silently dropping them. */
export function contentMetadataToJson(value: unknown): Readonly<Record<string, JsonValue>> {
  const visit = (input: unknown, ancestors: Set<object>): JsonValue => {
    if (input === null || typeof input === "string" || typeof input === "boolean") return input;
    if (typeof input === "number" && Number.isFinite(input)) return input;
    if (typeof input !== "object" || input === null || ancestors.has(input))
      throw new TypeError("Expected JSON metadata.");
    const next = new Set(ancestors).add(input);
    if (Array.isArray(input)) return input.map((item) => visit(item, next));
    if (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null)
      throw new TypeError("Expected plain metadata.");
    return Object.fromEntries(Object.entries(input).map(([key, item]) => [key, visit(item, next)]));
  };
  const json = visit(value, new Set());
  if (json === null || typeof json !== "object" || Array.isArray(json))
    throw new TypeError("Expected metadata object.");
  return Object.fromEntries(Object.entries(json));
}
export function createInitialSchemaByMode(
  mode: FormContentMode,
  options: { readonly title: string; readonly locale: string; readonly id?: string }
): FormSchema {
  const { title, locale, id = "form-draft" } = options;
  const ja = locale.startsWith("ja");
  const metadata: CustomFormMetadata = {
    mode,
    ...(mode === "poll" ? { poll: { resultVisibility: "after_submit" } as const } : {}),
    ...(mode === "quiz" ? { quiz: { showExplanation: "after_submit" } as const } : {})
  };
  return {
    id,
    version: 1,
    title,
    defaultLocale: locale,
    supportedLocales: [locale],
    metadata: contentMetadataToJson(metadata),
    fields:
      mode === "survey"
        ? []
        : [
            {
              id: "question-1",
              type: "radio",
              title: ja ? "質問" : "Question",
              required: true,
              options: [
                { id: "option-1", label: ja ? "選択肢1" : "Option 1" },
                { id: "option-2", label: ja ? "選択肢2" : "Option 2" }
              ]
            }
          ]
  };
}
export function getContentModePolicy(mode: FormContentMode, policy: FormPolicy = {}): FormPolicy {
  if (mode === "survey") return policy;
  const allowedFieldTypes: NonNullable<FormPolicy["allowedFieldTypes"]> =
    mode === "poll" ? ["radio", "multi-select"] : ["radio"];
  return {
    ...policy,
    allowedFieldTypes: allowedFieldTypes.filter(
      (type) => policy.allowedFieldTypes === undefined || policy.allowedFieldTypes.includes(type)
    ),
    ...(mode === "poll" ? { maxFields: Math.min(1, policy.maxFields ?? 1) } : {})
  };
}
export interface ContentModeIssue {
  readonly path: string;
  readonly message: string;
}
export type ContentModeIssueCode =
  | "poll_field_count"
  | "quiz_field_count"
  | "unsupported_field_type"
  | "options_minimum"
  | "correct_option_missing"
  | "points_type"
  | "explanation_type"
  | "points_range"
  | "poll_result_visibility"
  | "poll_strict_one_vote"
  | "quiz_explanation_timing"
  | "quiz_passing_score";
export interface ContentModeDiagnostic extends ContentModeIssue {
  readonly code: ContentModeIssueCode;
}
/** Opt-in validation, separate from the backwards-compatible base schema validator. */
export function getContentModeDiagnostics(schema: FormSchema): readonly ContentModeDiagnostic[] {
  const mode = getFormContentMode(schema.metadata);
  const issues: ContentModeDiagnostic[] = [];
  const add = (path: string, code: ContentModeIssueCode, message: string) => issues.push({ path, code, message });
  if (mode === "survey") return issues;
  if (mode === "poll" && schema.fields.length !== 1)
    add("fields", "poll_field_count", "Polls require exactly one question.");
  if (mode === "quiz" && schema.fields.length === 0)
    add("fields", "quiz_field_count", "Quizzes require at least one question.");
  let total = 0;
  for (const field of schema.fields) {
    if (field.type !== "radio" && !(mode === "poll" && field.type === "multi-select"))
      add(field.id, "unsupported_field_type", "Unsupported question type.");
    if (!("options" in field) || field.options.length < 2)
      add(field.id, "options_minimum", "At least two options are required.");
    if (mode !== "quiz") continue;
    const quiz = readQuizFieldMetadata(field.metadata);
    if (!("options" in field) || !field.options.some((option) => option.id === quiz.correctOptionId))
      add(field.id, "correct_option_missing", "Select a correct option.");
    const rawQuiz = record(field.metadata?.quiz);
    if (rawQuiz.points !== undefined && typeof rawQuiz.points !== "number")
      add(field.id, "points_type", "Points must be a number.");
    if (rawQuiz.explanation !== undefined && typeof rawQuiz.explanation !== "string")
      add(field.id, "explanation_type", "Explanation must be text.");
    const points = quiz.points ?? 1;
    if (!Number.isFinite(points) || points < 0)
      add(field.id, "points_range", "Points must be finite and non-negative.");
    total += points;
  }
  const raw = record(record(schema.metadata)[mode]);
  if (
    mode === "poll" &&
    raw.resultVisibility !== undefined &&
    !["after_submit", "always", "closed_only", "private"].includes(String(raw.resultVisibility))
  )
    add("metadata.poll", "poll_result_visibility", "Invalid result visibility.");
  if (mode === "poll" && raw.strictOneVotePerUser !== undefined && typeof raw.strictOneVotePerUser !== "boolean")
    add("metadata.poll", "poll_strict_one_vote", "One-vote setting must be boolean.");
  if (mode === "quiz") {
    if (
      raw.showExplanation !== undefined &&
      raw.showExplanation !== "after_submit" &&
      raw.showExplanation !== "immediate"
    )
      add("metadata.quiz", "quiz_explanation_timing", "Invalid explanation timing.");
    const score = raw.passingScore;
    if (score !== undefined && (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > total))
      add("metadata.quiz.passingScore", "quiz_passing_score", "Passing score must be between zero and total points.");
  }
  return issues;
}
/** Opt-in validation, separate from the backwards-compatible base schema validator. */
export function validateContentMode(schema: FormSchema): readonly ContentModeIssue[] {
  return getContentModeDiagnostics(schema).map(({ path, message }) => ({ path, message }));
}
export interface QuizQuestionResult {
  readonly fieldId: string;
  readonly title: string;
  readonly correct: boolean;
  readonly correctOption: string;
  readonly explanation?: string;
  readonly points: number;
  readonly earned: number;
}
export interface QuizResult {
  readonly questions: readonly QuizQuestionResult[];
  readonly score: number;
  readonly total: number;
  readonly passed?: boolean;
}
export function evaluateQuiz(schema: FormSchema, answers: Readonly<Record<string, unknown>>): QuizResult {
  if (getFormContentMode(schema.metadata) !== "quiz" || validateContentMode(schema).length > 0)
    throw new TypeError("Invalid quiz schema.");
  const visibility = calculateFieldVisibility(schema, answers);
  const questions: QuizQuestionResult[] = [];
  for (const field of schema.fields) {
    if (!visibility[field.id] || !("options" in field)) continue;
    const { correctOptionId, explanation, points = 1 } = readQuizFieldMetadata(field.metadata);
    const correct = answers[field.id] === correctOptionId;
    questions.push({
      fieldId: field.id,
      title: field.title,
      correct,
      correctOption: field.options.find((option) => option.id === correctOptionId)?.label ?? "",
      ...(explanation === undefined ? {} : { explanation }),
      points,
      earned: correct ? points : 0
    });
  }
  const score = questions.reduce((sum, question) => sum + question.earned, 0);
  const total = questions.reduce((sum, question) => sum + question.points, 0);
  const { passingScore } = readQuizMetadata(schema.metadata);
  return { questions, score, total, ...(passingScore === undefined ? {} : { passed: score >= passingScore }) };
}
export interface PollAccessContext {
  readonly submitted: boolean;
  readonly closed: boolean;
  readonly canViewResults: boolean;
}
export function canShowPollResults(metadata: PollMetadata, context: PollAccessContext): boolean {
  if (!context.canViewResults) return false;
  switch (metadata.resultVisibility) {
    case "always":
      return true;
    case "after_submit":
      return context.submitted;
    case "closed_only":
      return context.closed;
    case "private":
      return false;
  }
}
/** Implementations must enforce identity and authorization at the persistence boundary. */
export interface PollRuntimeAdapter<TSummary> {
  readonly loadResults: (schema: FormSchema, signal: AbortSignal) => Promise<TSummary>;
  readonly canVote: (schema: FormSchema) => Promise<boolean>;
}
