import type { FormField, FormPolicy, FormSchema, FormValues, JsonValue, SchemaIssue } from "./types";
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

export type ContentModeConstraintCode =
  | "POLL_SINGLE_FIELD_REQUIRED"
  | "POLL_INVALID_FIELD_TYPE"
  | "POLL_MIN_OPTIONS_REQUIRED"
  | "QUIZ_CORRECT_OPTION_MISSING"
  | "QUIZ_INVALID_CORRECT_OPTION";

export interface ContentModeConstraintIssue extends SchemaIssue {
  readonly code: ContentModeConstraintCode;
}

export interface ContentModeValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ContentModeConstraintIssue[];
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

function isChoiceField(
  field: FormField
): field is Extract<FormField, { readonly type: "select" | "radio" | "multi-select" }> {
  return field.type === "select" || field.type === "radio" || field.type === "multi-select";
}

function addConstraintIssue(
  issues: ContentModeConstraintIssue[],
  path: string,
  code: ContentModeConstraintCode,
  message: string
): void {
  issues.push({ path, code, message });
}

export function validateContentModeConstraints(schema: FormSchema): ContentModeValidationResult {
  const mode = getFormContentMode(schema.metadata);
  const issues: ContentModeConstraintIssue[] = [];
  if (mode === "survey") return { valid: true, issues };

  if (mode === "poll") {
    if (schema.fields.length !== 1)
      addConstraintIssue(issues, "fields", "POLL_SINGLE_FIELD_REQUIRED", "Polls require exactly one question.");
    schema.fields.forEach((field, index) => {
      if (field.type !== "radio" && field.type !== "multi-select") {
        addConstraintIssue(
          issues,
          `fields[${index}].type`,
          "POLL_INVALID_FIELD_TYPE",
          "Poll questions must use radio or multi-select fields."
        );
        return;
      }
      const options = Array.isArray(field.options) ? field.options : [];
      if (options.length < 2)
        addConstraintIssue(
          issues,
          `fields[${index}].options`,
          "POLL_MIN_OPTIONS_REQUIRED",
          "Poll questions require at least two options."
        );
    });
  }

  if (mode === "quiz") {
    schema.fields.forEach((field, index) => {
      if (!isChoiceField(field)) return;
      const metadata = readQuizFieldMetadata(field.metadata);
      if (metadata.correctOptionId.length === 0) {
        addConstraintIssue(
          issues,
          `fields[${index}].metadata.quiz.correctOptionId`,
          "QUIZ_CORRECT_OPTION_MISSING",
          "Quiz questions require a correct option."
        );
        return;
      }
      const options = Array.isArray(field.options) ? field.options : [];
      if (!options.some((option) => option.id === metadata.correctOptionId))
        addConstraintIssue(
          issues,
          `fields[${index}].metadata.quiz.correctOptionId`,
          "QUIZ_INVALID_CORRECT_OPTION",
          "Quiz correctOptionId must reference an existing option."
        );
    });
  }

  return { valid: issues.length === 0, issues };
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
              ],
              ...(mode === "quiz" ? { metadata: contentMetadataToJson({ quiz: { correctOptionId: "option-1" } }) } : {})
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
    const options = "options" in field && Array.isArray(field.options) ? field.options : undefined;
    if (options === undefined || options.length < 2)
      add(field.id, "options_minimum", "At least two options are required.");
    if (mode !== "quiz") continue;
    const quiz = readQuizFieldMetadata(field.metadata);
    if (options === undefined || !options.some((option) => option.id === quiz.correctOptionId))
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

export interface QuizQuestionEvaluation {
  readonly questionId: string;
  readonly isCorrect: boolean;
  readonly correctOptionId?: string;
  readonly selectedOptionId?: string;
  readonly explanation?: string;
  readonly scoreEarned: number;
  readonly maxScore: number;
}

export interface QuizEvaluationResult {
  readonly totalScore: number;
  readonly maxPossibleScore: number;
  readonly isPassed?: boolean;
  readonly questions: readonly QuizQuestionEvaluation[];
  readonly reward?: {
    readonly type: "coupon" | "badge" | "text";
    readonly code?: string;
    readonly message?: string;
  };
}

export function evaluateQuizLocally(schema: FormSchema, answers: FormValues): QuizEvaluationResult {
  if (getFormContentMode(schema.metadata) !== "quiz" || !validateContentModeConstraints(schema).valid)
    throw new TypeError("Invalid quiz schema.");
  const visibility = calculateFieldVisibility(schema, answers);
  const questions: QuizQuestionEvaluation[] = [];
  for (const field of schema.fields) {
    if (!visibility[field.id] || !isChoiceField(field)) continue;
    const { correctOptionId, explanation, points = 1 } = readQuizFieldMetadata(field.metadata);
    const answer = answers[field.id];
    const selectedOptionId = typeof answer === "string" ? answer : undefined;
    const isCorrect = selectedOptionId === correctOptionId;
    questions.push({
      questionId: field.id,
      isCorrect,
      ...(correctOptionId.length === 0 ? {} : { correctOptionId }),
      ...(selectedOptionId === undefined ? {} : { selectedOptionId }),
      ...(explanation === undefined ? {} : { explanation }),
      scoreEarned: isCorrect ? points : 0,
      maxScore: points
    });
  }
  const totalScore = questions.reduce((sum, question) => sum + question.scoreEarned, 0);
  const maxPossibleScore = questions.reduce((sum, question) => sum + question.maxScore, 0);
  const { passingScore } = readQuizMetadata(schema.metadata);
  return {
    totalScore,
    maxPossibleScore,
    ...(passingScore === undefined ? {} : { isPassed: totalScore >= passingScore }),
    questions
  };
}

export function evaluateQuiz(schema: FormSchema, answers: FormValues): QuizResult {
  const evaluation = evaluateQuizLocally(schema, answers);
  return {
    questions: evaluation.questions.map((question) => {
      const field = schema.fields.find((candidate) => candidate.id === question.questionId);
      return {
        fieldId: question.questionId,
        title: field?.title ?? question.questionId,
        correct: question.isCorrect,
        correctOption:
          field !== undefined && isChoiceField(field)
            ? (field.options.find((option) => option.id === question.correctOptionId)?.label ?? "")
            : "",
        ...(question.explanation === undefined ? {} : { explanation: question.explanation }),
        points: question.maxScore,
        earned: question.scoreEarned
      };
    }),
    score: evaluation.totalScore,
    total: evaluation.maxPossibleScore,
    ...(evaluation.isPassed === undefined ? {} : { passed: evaluation.isPassed })
  };
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
