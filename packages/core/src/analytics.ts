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
import { validateAnswers } from "./validation";

function percentage(count: number, total: number): number {
  return total === 0 ? 0 : (count / total) * 100;
}

function answered(field: FormField, value: FormValue): boolean {
  if (value === undefined || value === "") return false;
  if (field.type === "multi-select") return Array.isArray(value) && value.length > 0;
  return true;
}

function aggregateField(field: FormField, submissions: readonly FormSubmission[]): QuestionAggregate {
  const values = submissions.map((submission) => submission.values[field.id]);
  const answeredCount = values.filter((value) => answered(field, value)).length;
  const base = { fieldId: field.id, answeredCount, unansweredCount: submissions.length - answeredCount };

  if (field.type === "text" || field.type === "textarea") return { ...base, kind: field.type };
  if (field.type === "number") {
    const numbers = values.filter((value): value is number => typeof value === "number");
    return {
      ...base,
      kind: "number",
      minimum: numbers.length === 0 ? null : Math.min(...numbers),
      maximum: numbers.length === 0 ? null : Math.max(...numbers),
      average: numbers.length === 0 ? null : numbers.reduce((sum, value) => sum + value, 0) / numbers.length
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
    const result = validateAnswers(schema, submission.values);
    if (!result.valid) throw new TypeError(`Submission ${submission.id} contains invalid answers.`);
  }
  return {
    formId: schema.id,
    formVersion: schema.version,
    submissionCount: submissions.length,
    questions: schema.fields.map((field) => aggregateField(field, submissions))
  };
}
