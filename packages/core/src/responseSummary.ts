import { resolveLocalizedSchema } from "./translation";
import type { FormAnalytics, FormField, FormSchema, QuestionAggregate } from "./types";
import type { FormVersionRecord } from "./versioning";

export type ResponseSummaryInput =
  | FormAnalytics
  | { readonly questions: readonly QuestionAggregate[]; readonly formId?: string; readonly formVersion?: number };

export interface ResponseSummaryLanguageAggregate {
  readonly language: string;
  readonly submissionCount: number;
  readonly summary: ResponseSummaryInput;
}

export interface ResponseSummarySkipReason {
  readonly reason: string;
  readonly count: number;
  readonly language?: string;
}

export interface ResponseSummaryQuestion {
  readonly fieldId: string;
  readonly label: string;
  readonly kind: QuestionAggregate["kind"];
  readonly answeredCount: number;
  readonly unansweredCount: number;
  readonly definition?: unknown;
  readonly optionDefinitions?: Readonly<Record<string, unknown>>;
  readonly options?: readonly {
    readonly id: string;
    readonly label: string;
    readonly count: number;
    readonly percentage: number;
  }[];
  readonly statistics?: Readonly<Record<string, number | null>>;
}

export interface ResponseSummaryData<TCustomData = unknown, TSkipReason = ResponseSummarySkipReason> {
  readonly formId: string;
  readonly version: number;
  readonly sourceLanguage: string;
  readonly title: string;
  readonly questions: readonly ResponseSummaryQuestion[];
  readonly languages?: readonly ResponseSummaryLanguageAggregate[];
  readonly skipReasons?: readonly TSkipReason[];
  readonly customData?: TCustomData;
}

export interface ResponseSummaryLabels {
  readonly languages?: string;
  readonly answered?: string;
  readonly unanswered?: string;
  readonly skipReasons?: string;
  readonly options?: string;
  readonly statistics?: string;
  readonly average?: string;
  readonly minimum?: string;
  readonly maximum?: string;
  readonly total?: string;
  readonly checked?: string;
  readonly unchecked?: string;
  readonly percentage?: string;
}

function schemaFor(version: FormVersionRecord | FormSchema): FormSchema {
  return "schema" in version ? version.schema : version;
}

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function questionData(
  aggregate: ResponseSummaryInput["questions"][number],
  field: FormField,
  schema: FormSchema,
  sourceLanguage: string
): ResponseSummaryQuestion {
  const localized = resolveLocalizedSchema(schema, sourceLanguage);
  const localizedField = localized.fields.find((candidate) => candidate.id === field.id);
  const base = {
    fieldId: aggregate.fieldId,
    label: localizedField?.title ?? field.title,
    kind: aggregate.kind,
    answeredCount: aggregate.answeredCount,
    unansweredCount: aggregate.unansweredCount
  };
  if (aggregate.kind === "select" || aggregate.kind === "radio" || aggregate.kind === "multi-select") {
    const options = "options" in field ? field.options : [];
    const localizedOptions = localizedField !== undefined && "options" in localizedField ? localizedField.options : [];
    return {
      ...base,
      options: aggregate.options.map((option) => ({
        id: option.id,
        count: option.count,
        label:
          localizedOptions.find((candidate) => candidate.id === option.id)?.label ??
          options.find((candidate) => candidate.id === option.id)?.label ??
          option.id,
        percentage: clampPercentage(option.percentageOfSubmissions)
      }))
    };
  }
  if (aggregate.kind === "number" || aggregate.kind === "rating") {
    return {
      ...base,
      statistics: {
        average: aggregate.average,
        minimum: aggregate.minimum,
        maximum: aggregate.maximum,
        total: aggregate.total
      }
    };
  }
  if (aggregate.kind === "checkbox") {
    return {
      ...base,
      statistics: {
        trueCount: aggregate.trueCount,
        falseCount: aggregate.falseCount,
        truePercentage: aggregate.truePercentageOfSubmissions,
        falsePercentage: aggregate.falsePercentageOfSubmissions
      }
    };
  }
  return base;
}

export function toResponseSummary(
  summary: ResponseSummaryInput,
  version: FormVersionRecord | FormSchema,
  sourceLanguage: string
): ResponseSummaryData {
  const schema = schemaFor(version);
  const localized = resolveLocalizedSchema(schema, sourceLanguage);
  const fields = new Map(schema.fields.map((field) => [field.id, field]));
  return {
    formId: summary.formId ?? schema.id,
    version: summary.formVersion ?? schema.version,
    sourceLanguage,
    title: localized.title,
    questions: summary.questions.flatMap((aggregate) => {
      const field = fields.get(aggregate.fieldId);
      return field === undefined ? [] : [questionData(aggregate, field, schema, sourceLanguage)];
    })
  };
}
