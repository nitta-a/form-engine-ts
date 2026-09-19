import type {
  AnswerValidationResult,
  BaseSubmissionMetadata,
  FormField,
  FormSchema,
  FormSubmission,
  FormValue,
  FormValues,
  ValidationCode,
  ValidationIssue
} from "./types";
import { isRadioTextAnswer, selectedOptionId } from "./value";
import { calculateFieldVisibility } from "./visibility";

export interface SensitiveDataFinding {
  readonly fieldId: string;
  readonly type: string;
  readonly start?: number;
  readonly end?: number;
  readonly matchedText?: string;
  readonly maskedText?: string;
}

export interface PrivacyEngine {
  detect(schema: FormSchema, values: Record<string, unknown>): readonly SensitiveDataFinding[];
}

export interface SubmissionValidationResult {
  readonly valid: boolean;
  readonly fieldErrors: Readonly<Record<string, string>>;
  readonly formErrors: readonly string[];
  readonly piiFindings?: readonly SensitiveDataFinding[];
}

/** A Zod-compatible schema accepted by storage and RPC integrations. */
export interface SubmissionSchema<TOutput = unknown> {
  readonly safeParse: (
    value: unknown
  ) => { readonly success: true; readonly data: TOutput } | { readonly success: false; readonly error: unknown };
}

export type FormSubmissionValidatorResult = undefined | boolean | SubmissionValidationResult;

/** Application-owned submission validation callback. */
export type FormSubmissionValidator<TMeta extends BaseSubmissionMetadata | undefined = undefined> = (
  submission: FormSubmission<TMeta>
) => unknown | Promise<unknown>;

export type FormSubmissionValidationSource<TMeta extends BaseSubmissionMetadata | undefined = undefined> =
  | FormSchema
  | SubmissionSchema
  | FormSubmissionValidator<TMeta>;

const DEFAULT_MESSAGES: Record<ValidationCode, string> = {
  required: "validation.required",
  invalid_type: "validation.invalidType",
  min_length: "validation.minLength",
  max_length: "validation.maxLength",
  pattern: "validation.pattern",
  min: "validation.min",
  max: "validation.max",
  step: "validation.step",
  invalid_option: "validation.invalidOption",
  min_selections: "validation.minSelections",
  max_selections: "validation.maxSelections",
  invalid_format: "validation.invalidFormat",
  unknown_field: "validation.unknownField"
};

function addIssue(
  issues: ValidationIssue[],
  field: FormField,
  code: ValidationCode,
  params: Record<string, string | number> = {}
): void {
  issues.push({
    fieldId: field.id,
    code,
    messageKey: field.messages?.[code] ?? DEFAULT_MESSAGES[code],
    params
  });
}

function isEmpty(field: FormField, value: FormValue): boolean {
  if (value === undefined || value === "") return true;
  if (field.type === "checkbox") return value !== true;
  if (field.type === "multi-select") return Array.isArray(value) && value.length === 0;
  return false;
}

function isValidDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() + 1 === Number(match[2]) &&
    date.getUTCDate() === Number(match[3])
  );
}

function isValidTime(value: string): boolean {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (match === null) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] === undefined ? 0 : Number(match[3]);
  return hours < 24 && minutes < 60 && seconds < 60;
}

function validateField(field: FormField, value: FormValue, issues: ValidationIssue[]): void {
  if (isEmpty(field, value)) {
    if (field.required) addIssue(issues, field, "required");
    return;
  }

  if (field.type === "text" || field.type === "textarea") {
    if (typeof value !== "string") {
      addIssue(issues, field, "invalid_type");
      return;
    }
    const normalized = value.trim();
    if (field.required && normalized.length === 0) {
      addIssue(issues, field, "required");
      return;
    }
    if (field.minLength !== undefined && normalized.length < field.minLength) {
      addIssue(issues, field, "min_length", { min: field.minLength });
    }
    if (field.maxLength !== undefined && normalized.length > field.maxLength) {
      addIssue(issues, field, "max_length", { max: field.maxLength });
    }
    if (field.pattern !== undefined && !new RegExp(field.pattern).test(normalized)) {
      addIssue(issues, field, "pattern");
    }
    return;
  }

  if (
    field.type === "date" ||
    field.type === "time" ||
    field.type === "email" ||
    field.type === "tel" ||
    field.type === "url"
  ) {
    if (typeof value !== "string") {
      addIssue(issues, field, "invalid_type");
      return;
    }
    const normalized = value.trim();
    const validFormat =
      field.type === "date"
        ? isValidDate(normalized)
        : field.type === "time"
          ? isValidTime(normalized)
          : field.type === "email"
            ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
            : field.type === "tel"
              ? /^[+()\d][+()\d\s-]*$/.test(normalized)
              : /^https?:\/\/[^\s]+$/i.test(normalized) &&
                (() => {
                  try {
                    new URL(normalized);
                    return true;
                  } catch {
                    return false;
                  }
                })();
    if (!validFormat) addIssue(issues, field, "invalid_format");
    if (field.type === "date") {
      if (field.minDate !== undefined && normalized < field.minDate)
        addIssue(issues, field, "min", { min: field.minDate });
      if (field.maxDate !== undefined && normalized > field.maxDate)
        addIssue(issues, field, "max", { max: field.maxDate });
    }
    if (field.type === "time") {
      if (field.minTime !== undefined && normalized < field.minTime)
        addIssue(issues, field, "min", { min: field.minTime });
      if (field.maxTime !== undefined && normalized > field.maxTime)
        addIssue(issues, field, "max", { max: field.maxTime });
    }
    return;
  }

  if (field.type === "number" || field.type === "rating") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      addIssue(issues, field, "invalid_type");
      return;
    }
    const min = field.type === "rating" ? (field.min ?? 1) : field.min;
    const max = field.type === "rating" ? (field.max ?? 5) : field.max;
    if (min !== undefined && value < min) addIssue(issues, field, "min", { min });
    if (max !== undefined && value > max) addIssue(issues, field, "max", { max });
    if (field.type === "rating" && !Number.isInteger(value)) {
      addIssue(issues, field, "step", { step: 1 });
    } else if (field.type === "number" && field.step !== undefined) {
      const origin = field.min ?? 0;
      const quotient = (value - origin) / field.step;
      if (Math.abs(quotient - Math.round(quotient)) > 1e-9) {
        addIssue(issues, field, "step", { step: field.step });
      }
    }
    return;
  }

  if (field.type === "checkbox") {
    if (typeof value !== "boolean") addIssue(issues, field, "invalid_type");
    return;
  }

  if (!("options" in field)) {
    addIssue(issues, field, "invalid_type");
    return;
  }
  const allowed = new Set(field.options.map((option) => option.id));
  if (field.type === "multi-select") {
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
      addIssue(issues, field, "invalid_type");
      return;
    }
    const unique = new Set(value);
    if (unique.size !== value.length || value.some((item) => !allowed.has(item))) {
      addIssue(issues, field, "invalid_option");
    }
    if (field.minSelections !== undefined && value.length < field.minSelections) {
      addIssue(issues, field, "min_selections", { min: field.minSelections });
    }
    if (field.maxSelections !== undefined && value.length > field.maxSelections) {
      addIssue(issues, field, "max_selections", { max: field.maxSelections });
    }
    return;
  }

  if (isRadioTextAnswer(value)) {
    if (field.type !== "radio") {
      addIssue(issues, field, "invalid_type");
      return;
    }
    const option = field.options.find((candidate) => candidate.id === value.optionId);
    if (option === undefined || option.textInput !== true) addIssue(issues, field, "invalid_option");
    return;
  }
  const optionId = selectedOptionId(value);
  if (typeof optionId !== "string") {
    addIssue(issues, field, "invalid_type");
  } else if (!allowed.has(optionId)) {
    addIssue(issues, field, "invalid_option");
  }
}

/** Validates one non-empty field value with the same rules used by form submission validation. */
export function validateFieldValue(field: FormField, value: FormValue): boolean {
  const issues: ValidationIssue[] = [];
  validateField(field, value, issues);
  return issues.length === 0;
}

export function validateAnswers(schema: FormSchema, values: FormValues): AnswerValidationResult {
  const issues: ValidationIssue[] = [];
  const fields = new Map(schema.fields.map((field) => [field.id, field]));
  const honeypotFieldId = schema.submissionSettings?.honeypotFieldId;
  for (const key of Object.keys(values)) {
    if (key !== honeypotFieldId && !fields.has(key)) {
      issues.push({
        fieldId: key,
        code: "unknown_field",
        messageKey: DEFAULT_MESSAGES.unknown_field,
        params: {}
      });
    }
  }
  const visibility = calculateFieldVisibility(schema, values);
  for (const field of schema.fields) {
    if (visibility[field.id] === true) validateField(field, values[field.id], issues);
  }
  return issues.length === 0 ? { valid: true, issues: [] } : { valid: false, issues };
}

export function validatePageAnswers(schema: FormSchema, pageIndex: number, values: FormValues): AnswerValidationResult {
  if (schema.pages === undefined || schema.pages.length === 0) return validateAnswers(schema, values);
  const page = schema.pages[pageIndex];
  if (page === undefined) return { valid: true, issues: [] };
  const targetIds = new Set(page.questionIds);
  const visibility = calculateFieldVisibility(schema, values);
  const issues: ValidationIssue[] = [];
  for (const field of schema.fields) {
    if (targetIds.has(field.id) && visibility[field.id] === true) validateField(field, values[field.id], issues);
  }
  return issues.length === 0 ? { valid: true, issues: [] } : { valid: false, issues };
}

export function validateSubmission<TMeta extends BaseSubmissionMetadata | undefined = undefined>(
  schema: FormSchema,
  submission: FormSubmission<TMeta>,
  options?: { readonly privacyEngine?: PrivacyEngine }
): SubmissionValidationResult {
  const values = submission.values;
  const answerValidation = validateAnswers(schema, values);
  const fieldErrors: Record<string, string> = {};
  for (const issue of answerValidation.issues) {
    const existing = fieldErrors[issue.fieldId];
    fieldErrors[issue.fieldId] = existing === undefined ? issue.messageKey : `${existing}; ${issue.messageKey}`;
  }

  const piiFindings = options?.privacyEngine?.detect(schema, { ...values });
  if (piiFindings !== undefined) {
    for (const finding of piiFindings) {
      const existing = fieldErrors[finding.fieldId];
      fieldErrors[finding.fieldId] =
        existing === undefined ? "validation.sensitiveData" : `${existing}; validation.sensitiveData`;
    }
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    formErrors: [],
    ...(piiFindings === undefined ? {} : { piiFindings })
  };
}
