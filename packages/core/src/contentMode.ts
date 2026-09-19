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
  | "CONTENT_MODE_CONSTRAINT"
  | "POLL_SINGLE_FIELD_REQUIRED"
  | "POLL_INVALID_FIELD_TYPE"
  | "POLL_MIN_OPTIONS_REQUIRED"
  | "RADIO_TEXT_INPUT_SURVEY_ONLY"
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

export interface ContentModeSettings {
  readonly minFields?: number;
  readonly maxFields?: number;
  readonly allowedFieldTypes?: FormPolicy["allowedFieldTypes"];
  readonly minOptionsPerField?: number;
  readonly maxOptionsPerField?: number;
  readonly evaluateQuiz?: (schema: FormSchema, answers: FormValues) => QuizEvaluationResult;
}

export function resolveContentModeSettings(mode: FormContentMode, policy: FormPolicy = {}): ContentModeSettings {
  const settings = policy.contentMode ?? {};
  for (const value of [
    settings.minFields,
    settings.maxFields,
    settings.minOptionsPerField,
    settings.maxOptionsPerField,
    policy.maxFields,
    policy.maxOptionsPerField
  ]) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0))
      throw new TypeError("Content mode limits must be non-negative safe integers.");
  }
  const defaults = mode === "poll" ? (["radio", "multi-select"] as const) : (["radio"] as const);
  const allowed = settings.allowedFieldTypes ?? (mode === "survey" ? undefined : defaults);
  const minimum = (a: number | undefined, b: number | undefined) =>
    a === undefined ? b : b === undefined ? a : Math.min(a, b);
  const maxFields = minimum(settings.maxFields, policy.maxFields);
  const maxOptionsPerField = minimum(settings.maxOptionsPerField, policy.maxOptionsPerField);
  const minFields = settings.minFields ?? (mode === "survey" ? 0 : 1);
  const minOptionsPerField = settings.minOptionsPerField ?? (mode === "survey" ? 0 : 2);
  return {
    ...settings,
    minFields,
    minOptionsPerField,
    ...(maxFields === undefined ? {} : { maxFields }),
    ...(maxOptionsPerField === undefined ? {} : { maxOptionsPerField }),
    ...(allowed === undefined
      ? policy.allowedFieldTypes === undefined
        ? {}
        : { allowedFieldTypes: policy.allowedFieldTypes }
      : {
          allowedFieldTypes: allowed.filter(
            (type) => policy.allowedFieldTypes === undefined || policy.allowedFieldTypes.includes(type)
          )
        })
  };
}

export function validateContentModeConstraints(
  schema: FormSchema,
  policy: FormPolicy = {}
): ContentModeValidationResult {
  const diagnostics = getContentModeDiagnostics(schema, policy);
  const codes: Partial<Record<ContentModeIssueCode, ContentModeConstraintCode>> = {
    poll_field_count: "POLL_SINGLE_FIELD_REQUIRED",
    unsupported_field_type:
      getFormContentMode(schema.metadata) === "poll" ? "POLL_INVALID_FIELD_TYPE" : "CONTENT_MODE_CONSTRAINT",
    options_minimum: "POLL_MIN_OPTIONS_REQUIRED",
    radio_text_input: "RADIO_TEXT_INPUT_SURVEY_ONLY",
    correct_option_missing: "QUIZ_CORRECT_OPTION_MISSING"
  };
  const issues = diagnostics.map(({ path, code, message }) => {
    const index = schema.fields.findIndex((field) => field.id === path);
    const field = schema.fields[index];
    const mappedCode =
      code === "correct_option_missing" &&
      field !== undefined &&
      readQuizFieldMetadata(field.metadata).correctOptionId.length > 0
        ? "QUIZ_INVALID_CORRECT_OPTION"
        : (codes[code] ?? "CONTENT_MODE_CONSTRAINT");
    const suffix =
      code === "unsupported_field_type"
        ? ".type"
        : code === "radio_text_input"
          ? ".options"
          : code === "correct_option_missing"
            ? ".metadata.quiz.correctOptionId"
            : ".options";
    return { path: index < 0 ? path : `fields[${index}]${suffix}`, code: mappedCode, message };
  });
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
  const settings = resolveContentModeSettings(mode, policy);
  return {
    ...policy,
    ...(settings.allowedFieldTypes === undefined ? {} : { allowedFieldTypes: settings.allowedFieldTypes }),
    ...(settings.maxFields === undefined ? {} : { maxFields: settings.maxFields }),
    ...(settings.maxOptionsPerField === undefined ? {} : { maxOptionsPerField: settings.maxOptionsPerField })
  };
}
export interface ContentModeIssue {
  readonly path: string;
  readonly message: string;
}
export type ContentModeIssueCode =
  | "field_count"
  | "options_maximum"
  | "quiz_evaluator_missing"
  | "poll_field_count"
  | "quiz_field_count"
  | "unsupported_field_type"
  | "options_minimum"
  | "radio_text_input"
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
export function getContentModeDiagnostics(
  schema: FormSchema,
  policy: FormPolicy = {}
): readonly ContentModeDiagnostic[] {
  const mode = getFormContentMode(schema.metadata);
  const issues: ContentModeDiagnostic[] = [];
  const add = (path: string, code: ContentModeIssueCode, message: string) => issues.push({ path, code, message });
  const settings = resolveContentModeSettings(mode, policy);
  if (
    schema.fields.length < (settings.minFields ?? 0) ||
    (settings.maxFields !== undefined && schema.fields.length > settings.maxFields)
  )
    add(
      "fields",
      mode === "poll" ? "poll_field_count" : mode === "quiz" ? "quiz_field_count" : "field_count",
      "Question count is outside the configured limits."
    );
  let total = 0;
  for (const field of schema.fields) {
    if (settings.allowedFieldTypes !== undefined && !settings.allowedFieldTypes.includes(field.type))
      add(field.id, "unsupported_field_type", "Unsupported question type.");
    const options = "options" in field && Array.isArray(field.options) ? field.options : undefined;
    if (isChoiceField(field) && (options?.length ?? 0) < (settings.minOptionsPerField ?? 0))
      add(field.id, "options_minimum", "Too few options for the configured minimum.");
    if (
      options !== undefined &&
      settings.maxOptionsPerField !== undefined &&
      options.length > settings.maxOptionsPerField
    )
      add(field.id, "options_maximum", "Too many options for the configured maximum.");
    if (mode !== "survey" && field.type === "radio" && options?.some((option) => option.textInput === true))
      add(field.id, "radio_text_input", "Option text input is supported only in survey mode.");
    if (mode !== "quiz") continue;
    if (settings.evaluateQuiz !== undefined) continue;
    if (field.type !== "radio") {
      add(field.id, "quiz_evaluator_missing", "A custom evaluator is required for this question type.");
      continue;
    }
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
    if (
      score !== undefined &&
      (typeof score !== "number" ||
        !Number.isFinite(score) ||
        score < 0 ||
        (settings.evaluateQuiz === undefined && score > total))
    )
      add("metadata.quiz.passingScore", "quiz_passing_score", "Passing score must be between zero and total points.");
  }
  return issues;
}
/** Opt-in validation, separate from the backwards-compatible base schema validator. */
export function validateContentMode(schema: FormSchema, policy: FormPolicy = {}): readonly ContentModeIssue[] {
  return getContentModeDiagnostics(schema, policy).map(({ path, message }) => ({ path, message }));
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

export function evaluateQuizLocally(
  schema: FormSchema,
  answers: FormValues,
  policy: FormPolicy = {}
): QuizEvaluationResult {
  if (getFormContentMode(schema.metadata) !== "quiz" || !validateContentModeConstraints(schema, policy).valid)
    throw new TypeError("Invalid quiz schema.");
  const evaluator = policy.contentMode?.evaluateQuiz;
  if (evaluator !== undefined) {
    const result = evaluator(schema, answers);
    if (
      !Number.isFinite(result.totalScore) ||
      !Number.isFinite(result.maxPossibleScore) ||
      result.totalScore < 0 ||
      result.maxPossibleScore < result.totalScore ||
      result.questions.some(
        (question) =>
          !Number.isFinite(question.scoreEarned) ||
          !Number.isFinite(question.maxScore) ||
          question.scoreEarned < 0 ||
          question.maxScore < question.scoreEarned
      )
    )
      throw new TypeError("Invalid quiz evaluation.");
    return result;
  }
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

export function evaluateQuiz(schema: FormSchema, answers: FormValues, policy: FormPolicy = {}): QuizResult {
  const evaluation = evaluateQuizLocally(schema, answers, policy);
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
