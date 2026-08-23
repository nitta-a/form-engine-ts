import { assertValidFormSchema } from "./schema";
import type {
  ChoiceQuestionAggregate,
  FormAnalytics,
  FormField,
  FormSchema,
  FormSubmission,
  FormValue,
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
  const allowed = new Set(field.options.map((option) => option.value));
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
  const optionCounts = new Map(field.options.map((option) => [option.value, 0]));
  for (const value of values) {
    const selections = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
    for (const selection of selections) optionCounts.set(selection, (optionCounts.get(selection) ?? 0) + 1);
  }
  const aggregate: ChoiceQuestionAggregate = {
    ...base,
    kind: field.type,
    options: field.options.map((option) => {
      const count = optionCounts.get(option.value) ?? 0;
      return { value: option.value, count, percentageOfSubmissions: percentage(count, submissions.length) };
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

export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  return /[",\r\n]/.test(stringValue) ? `"${stringValue.replaceAll('"', '""')}"` : stringValue;
}

function serializeValue(value: FormValue): string {
  if (value === undefined) return "";
  if (Array.isArray(value)) return JSON.stringify(value);
  return String(value);
}

export function exportResponsesToCsv(schema: FormSchema, responses: readonly FormSubmission[]): string {
  assertValidFormSchema(schema);
  for (const response of responses) {
    if (response.formId !== schema.id || response.formVersion !== schema.version) {
      throw new TypeError(`Submission ${response.id} does not match ${schema.id}@${schema.version}.`);
    }
  }
  const rows = [
    ["submissionId", "submittedAt", "locale", ...schema.fields.map((field) => field.id)],
    ...responses.map((response) => {
      const visible = selectVisibleAnswers(schema, response.values);
      return [
        response.id,
        response.submittedAt,
        response.locale,
        ...schema.fields.map((field) => serializeValue(visible[field.id] as FormValue))
      ];
    })
  ];
  return `\uFEFF${rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(",")).join("\r\n")}`;
}
