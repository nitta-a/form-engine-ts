import { assertValidFormSchema } from "./schema";
import type {
  BaseSubmissionMetadata,
  ChoiceQuestionAggregate,
  CrossTabulationResult,
  FormAnalytics,
  FormField,
  FormResponse,
  FormSchema,
  FormSubmission,
  FormValue,
  FormValues,
  QuestionAggregate
} from "./types";
import { calculateFieldVisibility, selectVisibleAnswers } from "./visibility";

export interface ChoiceDistributionEntry {
  readonly count: number;
  readonly percentage: number;
}

export interface NumericSummary {
  readonly average: number | null;
  readonly min: number | null;
  readonly max: number | null;
  readonly total: number;
}

function percentage(count: number, total: number): number {
  return total === 0 ? 0 : (count / total) * 100;
}

export function calculateChoiceDistribution(
  responses: readonly FormSubmission[],
  questionId: string
): Record<string, ChoiceDistributionEntry> {
  const counts = new Map<string, number>();
  for (const response of responses) {
    const value = response.values[questionId];
    const selections = new Set(Array.isArray(value) ? value : typeof value === "string" && value !== "" ? [value] : []);
    for (const selection of selections) counts.set(selection, (counts.get(selection) ?? 0) + 1);
  }
  return Object.fromEntries(
    [...counts].map(([value, count]) => [value, { count, percentage: percentage(count, responses.length) }])
  );
}

export function calculateNumericSummary(responses: readonly FormSubmission[], questionId: string): NumericSummary {
  const numbers = responses
    .map((response) => response.values[questionId])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const total = numbers.reduce((sum, value) => sum + value, 0);
  return {
    total,
    average: numbers.length === 0 ? null : total / numbers.length,
    min: numbers.length === 0 ? null : Math.min(...numbers),
    max: numbers.length === 0 ? null : Math.max(...numbers)
  };
}

export function calculateCrossTabulation(
  responses: readonly FormSubmission[],
  rowQuestionId: string,
  colQuestionId: string
): CrossTabulationResult {
  const matrix: Record<string, Record<string, number>> = {};
  const rowTotals: Record<string, number> = {};
  const colTotals: Record<string, number> = {};
  let grandTotal = 0;
  for (const response of responses) {
    const row = response.values[rowQuestionId];
    const col = response.values[colQuestionId];
    if (typeof row !== "string" || row.length === 0 || typeof col !== "string" || col.length === 0) continue;
    matrix[row] ??= {};
    matrix[row][col] = (matrix[row][col] ?? 0) + 1;
    rowTotals[row] = (rowTotals[row] ?? 0) + 1;
    colTotals[col] = (colTotals[col] ?? 0) + 1;
    grandTotal += 1;
  }
  return { rowQuestionId, colQuestionId, matrix, rowTotals, colTotals, grandTotal };
}

function valueIsValid(field: FormField, value: FormValue): boolean {
  if (value === undefined || value === "") return false;
  if (field.type === "text" || field.type === "textarea") {
    if (typeof value !== "string") return false;
    const normalized = value.trim();
    if (normalized.length === 0) return false;
    if (field.minLength !== undefined && normalized.length < field.minLength) return false;
    if (field.maxLength !== undefined && normalized.length > field.maxLength) return false;
    return field.pattern === undefined || new RegExp(field.pattern).test(normalized);
  }
  if (field.type === "number" || field.type === "rating") {
    if (typeof value !== "number" || !Number.isFinite(value)) return false;
    const min = field.type === "rating" ? (field.min ?? 1) : field.min;
    const max = field.type === "rating" ? (field.max ?? 5) : field.max;
    if ((min !== undefined && value < min) || (max !== undefined && value > max)) return false;
    if (field.type === "rating") return Number.isInteger(value);
    if (field.step === undefined) return true;
    const quotient = (value - (field.min ?? 0)) / field.step;
    return Math.abs(quotient - Math.round(quotient)) <= 1e-9;
  }
  if (field.type === "checkbox") return typeof value === "boolean";
  if (!("options" in field)) return false;
  const allowed = new Set(field.options.map((option) => option.id));
  if (field.type === "multi-select") {
    return (
      Array.isArray(value) &&
      value.length > 0 &&
      new Set(value).size === value.length &&
      value.every((item) => allowed.has(item)) &&
      (field.minSelections === undefined || value.length >= field.minSelections) &&
      (field.maxSelections === undefined || value.length <= field.maxSelections)
    );
  }
  return typeof value === "string" && allowed.has(value);
}

function aggregateField(
  schema: FormSchema,
  field: FormField,
  submissions: readonly FormSubmission[]
): QuestionAggregate {
  const values = submissions.map((submission) => {
    const visibility = calculateFieldVisibility(schema, submission.values);
    const value = submission.values[field.id];
    return visibility[field.id] === true && valueIsValid(field, value) ? value : undefined;
  });
  const answeredCount = values.filter((value) => value !== undefined).length;
  const base = { fieldId: field.id, answeredCount, unansweredCount: submissions.length - answeredCount };

  if (field.type === "text" || field.type === "textarea") return { ...base, kind: field.type };
  if (field.type === "number" || field.type === "rating") {
    const numbers = values.filter((value): value is number => typeof value === "number");
    const total = numbers.reduce((sum, value) => sum + value, 0);
    return {
      ...base,
      kind: field.type,
      minimum: numbers.length === 0 ? null : Math.min(...numbers),
      maximum: numbers.length === 0 ? null : Math.max(...numbers),
      average: numbers.length === 0 ? null : total / numbers.length,
      total
    };
  }
  if (field.type === "checkbox") {
    const trueCount = values.filter((value) => value === true).length;
    const falseCount = values.filter((value) => value === false).length;
    return {
      ...base,
      kind: "checkbox",
      trueCount,
      falseCount,
      truePercentageOfSubmissions: percentage(trueCount, submissions.length),
      falsePercentageOfSubmissions: percentage(falseCount, submissions.length)
    };
  }

  if (!("options" in field)) throw new TypeError(`Field ${field.id} cannot be aggregated.`);
  const optionCounts = new Map(field.options.map((option) => [option.id, 0]));
  for (const value of values) {
    const selections = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
    for (const selection of selections) optionCounts.set(selection, (optionCounts.get(selection) ?? 0) + 1);
  }
  const aggregate: ChoiceQuestionAggregate = {
    ...base,
    kind: field.type,
    options: field.options.map((option) => {
      const count = optionCounts.get(option.id) ?? 0;
      return { id: option.id, count, percentageOfSubmissions: percentage(count, submissions.length) };
    })
  };
  return aggregate;
}

export function aggregateResponses(schema: FormSchema, submissions: readonly FormSubmission[]): FormAnalytics {
  assertValidFormSchema(schema);
  for (const submission of submissions) {
    if (submission.formId !== schema.id || submission.formVersion !== schema.version) {
      throw new TypeError(`Submission ${submission.id} does not match ${schema.id}@${schema.version}.`);
    }
  }
  return {
    formId: schema.id,
    formVersion: schema.version,
    submissionCount: submissions.length,
    questions: schema.fields.map((field) => aggregateField(schema, field, submissions))
  };
}

export type AccumulatorResponse = FormSubmission | FormResponse;

export type AccumulatorSkipReason = "form_id_mismatch" | "version_mismatch" | "invalid_structure";

export interface AccumulatorReport {
  readonly processedCount: number;
  readonly skippedCount: number;
  readonly skipReasons: readonly { readonly responseId: string; readonly reason: AccumulatorSkipReason }[];
}

export interface ResponseAccumulator {
  add(submission: AccumulatorResponse): {
    readonly success: boolean;
    readonly skipped?: boolean;
    readonly error?: string;
  };
  addMany(submissions: Iterable<AccumulatorResponse>): AccumulatorReport;
  merge(other: ResponseAccumulator): ResponseAccumulator;
  finalize(): FormAnalytics;
  getReport(): AccumulatorReport;
}

export interface ResponseAccumulatorOptions {
  readonly mode?: "strict" | "lenient";
}

interface FieldAccumulator {
  answeredCount: number;
  total: number;
  minimum: number | null;
  maximum: number | null;
  trueCount: number;
  falseCount: number;
  readonly optionCounts: Map<string, number>;
}

function responseValues(submission: AccumulatorResponse): unknown {
  if (typeof submission !== "object" || submission === null) return undefined;
  if ("values" in submission) return submission.values;
  return "answers" in submission ? submission.answers : undefined;
}

function responseIdentifier(submission: AccumulatorResponse): string {
  if (typeof submission !== "object" || submission === null) return "<unknown>";
  if ("id" in submission && typeof submission.id === "string" && submission.id.length > 0) return submission.id;
  if ("responseId" in submission && typeof submission.responseId === "string" && submission.responseId.length > 0) {
    return submission.responseId;
  }
  return "<unknown>";
}

function isAnswerRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function responseProblem(
  schema: FormSchema,
  submission: AccumulatorResponse
): { readonly reason: AccumulatorSkipReason; readonly error: string } | undefined {
  if (typeof submission !== "object" || submission === null) {
    return { reason: "invalid_structure", error: "Submission structure is invalid." };
  }
  const identifier = responseIdentifier(submission);
  const values = responseValues(submission);
  if (
    typeof identifier !== "string" ||
    identifier.length === 0 ||
    typeof submission.formId !== "string" ||
    typeof submission.submittedAt !== "string" ||
    !isAnswerRecord(values)
  ) {
    return { reason: "invalid_structure", error: `Submission ${String(identifier)} structure is invalid.` };
  }
  if (submission.formId !== schema.id) {
    return { reason: "form_id_mismatch", error: `Submission ${identifier} does not match form ${schema.id}.` };
  }
  if (
    "formVersion" in submission &&
    submission.formVersion !== undefined &&
    submission.formVersion !== schema.version
  ) {
    return {
      reason: "version_mismatch",
      error: `Submission ${identifier} does not match ${schema.id}@${schema.version}.`
    };
  }
  return undefined;
}

class IncrementalResponseAccumulator implements ResponseAccumulator {
  readonly #schema: FormSchema;
  readonly #mode: "strict" | "lenient";
  readonly #fields: Map<string, FieldAccumulator>;
  readonly #skipReasons: { responseId: string; reason: AccumulatorSkipReason }[] = [];
  #submissionCount = 0;

  constructor(schema: FormSchema, options: ResponseAccumulatorOptions) {
    assertValidFormSchema(schema);
    this.#schema = JSON.parse(JSON.stringify(schema)) as FormSchema;
    this.#mode = options.mode ?? "strict";
    this.#fields = new Map(
      schema.fields.map((field) => [
        field.id,
        {
          answeredCount: 0,
          total: 0,
          minimum: null,
          maximum: null,
          trueCount: 0,
          falseCount: 0,
          optionCounts: new Map("options" in field ? field.options.map((option) => [option.id, 0]) : [])
        }
      ])
    );
  }

  add(submission: AccumulatorResponse): {
    readonly success: boolean;
    readonly skipped?: boolean;
    readonly error?: string;
  } {
    const problem = responseProblem(this.#schema, submission);
    if (problem !== undefined) {
      if (this.#mode === "strict") return { success: false, error: problem.error };
      this.#skipReasons.push({ responseId: responseIdentifier(submission), reason: problem.reason });
      return { success: true, skipped: true };
    }
    const values = responseValues(submission);
    if (!isAnswerRecord(values)) throw new Error("Validated response answers are unavailable.");
    const visibility = calculateFieldVisibility(this.#schema, values);
    for (const field of this.#schema.fields) {
      const accumulator = this.#fields.get(field.id);
      if (accumulator === undefined) throw new Error(`Accumulator for ${field.id} is unavailable.`);
      const candidate = values[field.id];
      if (visibility[field.id] !== true || !valueIsValid(field, candidate as FormValue)) continue;
      accumulator.answeredCount += 1;
      if ((field.type === "number" || field.type === "rating") && typeof candidate === "number") {
        accumulator.total += candidate;
        accumulator.minimum = accumulator.minimum === null ? candidate : Math.min(accumulator.minimum, candidate);
        accumulator.maximum = accumulator.maximum === null ? candidate : Math.max(accumulator.maximum, candidate);
      } else if (field.type === "checkbox") {
        if (candidate === true) accumulator.trueCount += 1;
        if (candidate === false) accumulator.falseCount += 1;
      } else if ("options" in field) {
        const selections = Array.isArray(candidate) ? candidate : typeof candidate === "string" ? [candidate] : [];
        for (const selection of selections) {
          accumulator.optionCounts.set(selection, (accumulator.optionCounts.get(selection) ?? 0) + 1);
        }
      }
    }
    this.#submissionCount += 1;
    return { success: true };
  }

  addMany(submissions: Iterable<AccumulatorResponse>): AccumulatorReport {
    for (const submission of submissions) {
      const result = this.add(submission);
      if (!result.success) throw new TypeError(result.error ?? "Submission could not be accumulated.");
    }
    return this.getReport();
  }

  merge(other: ResponseAccumulator): ResponseAccumulator {
    if (!(other instanceof IncrementalResponseAccumulator)) {
      throw new TypeError("Only form-engine response accumulators can be merged.");
    }
    if (
      other.#schema.id !== this.#schema.id ||
      other.#schema.version !== this.#schema.version ||
      JSON.stringify(other.#schema.fields) !== JSON.stringify(this.#schema.fields)
    ) {
      throw new TypeError("Response accumulators must use the same schema.");
    }
    this.#submissionCount += other.#submissionCount;
    this.#skipReasons.push(...other.#skipReasons);
    for (const [fieldId, source] of other.#fields) {
      const target = this.#fields.get(fieldId);
      if (target === undefined) throw new Error(`Accumulator for ${fieldId} is unavailable.`);
      target.answeredCount += source.answeredCount;
      target.total += source.total;
      target.minimum =
        target.minimum === null
          ? source.minimum
          : source.minimum === null
            ? target.minimum
            : Math.min(target.minimum, source.minimum);
      target.maximum =
        target.maximum === null
          ? source.maximum
          : source.maximum === null
            ? target.maximum
            : Math.max(target.maximum, source.maximum);
      target.trueCount += source.trueCount;
      target.falseCount += source.falseCount;
      for (const [optionId, count] of source.optionCounts) {
        target.optionCounts.set(optionId, (target.optionCounts.get(optionId) ?? 0) + count);
      }
    }
    return this;
  }

  getReport(): AccumulatorReport {
    return {
      processedCount: this.#submissionCount,
      skippedCount: this.#skipReasons.length,
      skipReasons: this.#skipReasons.map((reason) => ({ ...reason }))
    };
  }

  finalize(): FormAnalytics {
    return {
      formId: this.#schema.id,
      formVersion: this.#schema.version,
      submissionCount: this.#submissionCount,
      questions: this.#schema.fields.map((field): QuestionAggregate => {
        const accumulator = this.#fields.get(field.id);
        if (accumulator === undefined) throw new Error(`Accumulator for ${field.id} is unavailable.`);
        const base = {
          fieldId: field.id,
          answeredCount: accumulator.answeredCount,
          unansweredCount: this.#submissionCount - accumulator.answeredCount
        };
        if (field.type === "text" || field.type === "textarea") return { ...base, kind: field.type };
        if (field.type === "number" || field.type === "rating") {
          return {
            ...base,
            kind: field.type,
            minimum: accumulator.minimum,
            maximum: accumulator.maximum,
            average: accumulator.answeredCount === 0 ? null : accumulator.total / accumulator.answeredCount,
            total: accumulator.total
          };
        }
        if (field.type === "checkbox") {
          return {
            ...base,
            kind: "checkbox",
            trueCount: accumulator.trueCount,
            falseCount: accumulator.falseCount,
            truePercentageOfSubmissions: percentage(accumulator.trueCount, this.#submissionCount),
            falsePercentageOfSubmissions: percentage(accumulator.falseCount, this.#submissionCount)
          };
        }
        if (!("options" in field)) throw new TypeError(`Field ${field.id} cannot be aggregated.`);
        return {
          ...base,
          kind: field.type,
          options: field.options.map((option) => {
            const count = accumulator.optionCounts.get(option.id) ?? 0;
            return { id: option.id, count, percentageOfSubmissions: percentage(count, this.#submissionCount) };
          })
        };
      })
    };
  }
}

export function createResponseAccumulator(
  schema: FormSchema,
  options: ResponseAccumulatorOptions = {}
): ResponseAccumulator {
  return new IncrementalResponseAccumulator(schema, options);
}

export function escapeCsvCell(value: string | number | boolean | null | undefined, neutralizeFormulas = true): string {
  if (value === null || value === undefined) return "";
  let stringValue = String(value);
  if (neutralizeFormulas && typeof value === "string") {
    const trimmed = stringValue.trimStart();
    if (trimmed.length > 0 && ["=", "+", "-", "@"].includes(trimmed[0] ?? "")) {
      stringValue = `'${stringValue}`;
    }
  }
  return /[",\r\n]/.test(stringValue) ? `"${stringValue.replaceAll('"', '""')}"` : stringValue;
}

function serializeValue(value: FormValue): string | number | boolean {
  if (value === undefined) return "";
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? value
    : JSON.stringify(value);
}

export interface CsvColumnDefinition<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata> {
  readonly key: string;
  readonly header: string;
  readonly getValue: (
    submission: FormSubmission<TMeta>,
    schema: FormSchema
  ) => string | number | boolean | null | undefined;
}

export interface CsvExportOptions<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata> {
  readonly withBom?: boolean;
  readonly neutralizeFormulas?: boolean;
  /** Alias for withBom used by the public export contract. */
  readonly useBom?: boolean;
  /** Alias for neutralizeFormulas used by the public export contract. */
  readonly preventFormulaInjection?: boolean;
  readonly customColumns?: readonly CsvColumnDefinition<TMeta>[];
  readonly includePiiStatus?: boolean;
  readonly includeLocale?: boolean;
}

export interface CsvColumnDef {
  readonly header: string;
  readonly getValue: (
    context: CsvColumnContext
  ) => string | number | boolean | null | undefined | Promise<string | number | boolean | null | undefined>;
}

export interface CsvColumnContext extends FormResponse {
  readonly submission: FormResponse;
  readonly formVersion: number;
  readonly schema: FormSchema;
}

export interface StreamCsvOptions extends CsvExportOptions {
  readonly columns?: readonly CsvColumnDef[];
  readonly includeDefaultColumns?: boolean;
}

function asFormResponse(submission: AccumulatorResponse): FormResponse {
  if (!("values" in submission)) return submission;
  return {
    responseId: submission.id,
    formId: submission.formId,
    sourceLocale: submission.locale,
    formVersion: submission.formVersion,
    answers: submission.values,
    submittedAt: submission.submittedAt,
    ...(submission.metadata === undefined ? {} : { metadata: submission.metadata }),
    ...(submission.translationMetadata === undefined ? {} : { translationMetadata: submission.translationMetadata })
  };
}

function serializeUnknown(value: unknown): string | number | boolean {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return JSON.stringify(value);
}

function submissionWithMetadata(submission: FormSubmission): FormSubmission<BaseSubmissionMetadata> {
  return { ...submission, metadata: submission.metadata ?? {} };
}

export async function* exportResponsesToCsvStream(
  schema: FormSchema,
  submissions: AsyncIterable<AccumulatorResponse>,
  options: StreamCsvOptions = {}
): AsyncIterable<string> {
  assertValidFormSchema(schema);
  const includeDefaultColumns = options.includeDefaultColumns ?? true;
  const customColumns = options.columns ?? [];
  const contractColumns = options.customColumns ?? [];
  const includeLocale = options.includeLocale ?? true;
  const includePiiStatus = options.includePiiStatus ?? false;
  const headers = [
    ...(includeDefaultColumns
      ? [
          "submissionId",
          "submittedAt",
          ...(includeLocale ? ["locale"] : []),
          ...(includePiiStatus ? ["piiStatus"] : []),
          ...schema.fields.map((field) => field.id)
        ]
      : []),
    ...customColumns.map((column) => column.header),
    ...contractColumns.map((column) => column.header)
  ];
  const neutralizeFormulas = options.preventFormulaInjection ?? options.neutralizeFormulas ?? true;
  const header = headers.map((value) => escapeCsvCell(value, neutralizeFormulas)).join(",");
  yield `${(options.withBom ?? true) ? "\uFEFF" : ""}${header}`;
  for await (const submission of submissions) {
    const problem = responseProblem(schema, submission);
    if (problem !== undefined) throw new TypeError(problem.error);
    const response = asFormResponse(submission);
    const answers = response.answers;
    const visible = selectVisibleAnswers(schema, answers as FormValues);
    const piiStatus = response.metadata?.piiConfirmed === true ? "confirmed" : "unconfirmed";
    const defaultCells = includeDefaultColumns
      ? [
          response.responseId,
          response.submittedAt,
          ...(includeLocale ? [response.sourceLocale ?? ""] : []),
          ...(includePiiStatus ? [piiStatus] : []),
          ...schema.fields.map((field) => serializeUnknown(visible[field.id]))
        ]
      : [];
    const context: CsvColumnContext = {
      ...response,
      submission: response,
      formVersion: response.formVersion ?? schema.version,
      schema
    };
    const customCells = await Promise.all(customColumns.map((column) => column.getValue(context)));
    const contractCells =
      "values" in submission
        ? contractColumns.map((column) => column.getValue(submissionWithMetadata(submission), schema))
        : contractColumns.map(() => undefined);
    yield `\r\n${[...defaultCells, ...customCells, ...contractCells]
      .map((value) => escapeCsvCell(value, neutralizeFormulas))
      .join(",")}`;
  }
}

export interface NodeWritableStream {
  write(chunk: Uint8Array): boolean;
  once(event: "drain", listener: () => void): unknown;
  once(event: "error", listener: (error: Error) => void): unknown;
  removeListener(event: "drain", listener: () => void): unknown;
  removeListener(event: "error", listener: (error: Error) => void): unknown;
  end(callback: () => void): unknown;
}

function isWebWritableStream(
  writable: WritableStream<Uint8Array> | NodeWritableStream
): writable is WritableStream<Uint8Array> {
  return "getWriter" in writable && typeof writable.getWriter === "function";
}

async function writeNodeChunk(
  writable: NodeWritableStream,
  chunk: Uint8Array,
  streamError: Promise<never>
): Promise<void> {
  if (writable.write(chunk)) return;
  let onDrain: (() => void) | undefined;
  const drain = new Promise<void>((resolve) => {
    onDrain = resolve;
    writable.once("drain", resolve);
  });
  try {
    await Promise.race([drain, streamError]);
  } finally {
    if (onDrain !== undefined) writable.removeListener("drain", onDrain);
  }
}

export async function pipeResponsesToCsvStream(
  schema: FormSchema,
  submissions: AsyncIterable<AccumulatorResponse>,
  writable: WritableStream<Uint8Array> | NodeWritableStream,
  options: StreamCsvOptions = {}
): Promise<void> {
  const encoder = new TextEncoder();
  if (isWebWritableStream(writable)) {
    const writer = writable.getWriter();
    try {
      for await (const chunk of exportResponsesToCsvStream(schema, submissions, options)) {
        await writer.write(encoder.encode(chunk));
      }
      await writer.close();
    } catch (cause) {
      await writer.abort(cause);
      throw cause;
    } finally {
      writer.releaseLock();
    }
    return;
  }
  let onStreamError: ((error: Error) => void) | undefined;
  const streamError = new Promise<never>((_resolve, reject) => {
    onStreamError = reject;
    writable.once("error", reject);
  });
  try {
    for await (const chunk of exportResponsesToCsvStream(schema, submissions, options)) {
      await writeNodeChunk(writable, encoder.encode(chunk), streamError);
    }
    await Promise.race([new Promise<void>((resolve) => writable.end(resolve)), streamError]);
  } finally {
    if (onStreamError !== undefined) writable.removeListener("error", onStreamError);
  }
}

export function exportResponsesToCsv(
  schema: FormSchema,
  responses: readonly FormSubmission[],
  options: CsvExportOptions = {}
): string {
  assertValidFormSchema(schema);
  for (const response of responses) {
    if (response.formId !== schema.id || response.formVersion !== schema.version) {
      throw new TypeError(`Submission ${response.id} does not match ${schema.id}@${schema.version}.`);
    }
  }
  const includeLocale = options.includeLocale ?? true;
  const includePiiStatus = options.includePiiStatus ?? false;
  const customColumns = options.customColumns ?? [];
  const headers = [
    "submissionId",
    "submittedAt",
    ...(includeLocale ? ["locale"] : []),
    ...(includePiiStatus ? ["piiStatus"] : []),
    ...schema.fields.map((field) => field.id),
    ...customColumns.map((column) => column.header)
  ];
  const rows = [
    headers,
    ...responses.map((response) => {
      const visible = selectVisibleAnswers(schema, response.values);
      const piiStatus = response.metadata?.piiConfirmed === true ? "confirmed" : "unconfirmed";
      const submissionForCustomColumns = submissionWithMetadata(response);
      return [
        response.id,
        response.submittedAt,
        ...(includeLocale ? [response.locale] : []),
        ...(includePiiStatus ? [piiStatus] : []),
        ...schema.fields.map((field) => serializeValue(visible[field.id] as FormValue)),
        ...customColumns.map((column) => column.getValue(submissionForCustomColumns, schema))
      ];
    })
  ];
  const neutralizeFormulas = options.preventFormulaInjection ?? options.neutralizeFormulas ?? true;
  const csv = rows.map((row) => row.map((cell) => escapeCsvCell(cell, neutralizeFormulas)).join(",")).join("\r\n");
  return (options.useBom ?? options.withBom ?? true) ? `\uFEFF${csv}` : csv;
}
