import type {
  AnswerValidationResult,
  FormField,
  FormSchema,
  FormValue,
  FormValues,
  ValidationCode,
  ValidationIssue
} from "./types";
import { calculateFieldVisibility } from "./visibility";

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

  if (typeof value !== "string") {
    addIssue(issues, field, "invalid_type");
  } else if (!allowed.has(value)) {
    addIssue(issues, field, "invalid_option");
  }
}

export function validateAnswers(schema: FormSchema, values: FormValues): AnswerValidationResult {
  const issues: ValidationIssue[] = [];
  const fields = new Map(schema.fields.map((field) => [field.id, field]));
  for (const key of Object.keys(values)) {
    if (!fields.has(key)) {
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
