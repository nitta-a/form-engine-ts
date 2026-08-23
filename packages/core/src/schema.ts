import type { FieldOption, FormField, FormSchema, SchemaIssue, SchemaValidationResult } from "./types";

const FIELD_TYPES = new Set(["text", "textarea", "number", "select", "multi-select", "checkbox", "radio"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function issue(issues: SchemaIssue[], path: string, code: string, message: string): void {
  issues.push({ path, code, message });
}

function validateOptionalNonNegativeInteger(
  value: unknown,
  path: string,
  issues: SchemaIssue[]
): value is number | undefined {
  if (value === undefined) return true;
  if (!Number.isInteger(value) || (value as number) < 0) {
    issue(issues, path, "invalid_bound", "Expected a non-negative integer.");
    return false;
  }
  return true;
}

function validateOptions(value: unknown, path: string, issues: SchemaIssue[]): value is FieldOption[] {
  if (!Array.isArray(value) || value.length === 0) {
    issue(issues, path, "invalid_options", "Expected at least one option.");
    return false;
  }
  const seen = new Set<string>();
  value.forEach((option, index) => {
    const optionPath = `${path}[${index}]`;
    if (!isRecord(option)) {
      issue(issues, optionPath, "invalid_option", "Expected an option object.");
      return;
    }
    if (!isNonEmptyString(option.value)) {
      issue(issues, `${optionPath}.value`, "invalid_option_value", "Expected a non-empty value.");
    } else if (seen.has(option.value)) {
      issue(issues, `${optionPath}.value`, "duplicate_option", "Option values must be unique.");
    } else {
      seen.add(option.value);
    }
    if (!isNonEmptyString(option.labelKey)) {
      issue(issues, `${optionPath}.labelKey`, "invalid_translation_key", "Expected a translation key.");
    }
  });
  return true;
}

function validateField(value: unknown, path: string, issues: SchemaIssue[]): value is FormField {
  if (!isRecord(value)) {
    issue(issues, path, "invalid_field", "Expected a field object.");
    return false;
  }
  if (!isNonEmptyString(value.id)) issue(issues, `${path}.id`, "invalid_id", "Expected a non-empty ID.");
  if (!isNonEmptyString(value.labelKey)) {
    issue(issues, `${path}.labelKey`, "invalid_translation_key", "Expected a translation key.");
  }
  if (value.helpTextKey !== undefined && !isNonEmptyString(value.helpTextKey)) {
    issue(issues, `${path}.helpTextKey`, "invalid_translation_key", "Expected a translation key.");
  }
  if (value.required !== undefined && typeof value.required !== "boolean") {
    issue(issues, `${path}.required`, "invalid_required", "Expected a boolean.");
  }
  if (typeof value.type !== "string" || !FIELD_TYPES.has(value.type)) {
    issue(issues, `${path}.type`, "invalid_field_type", "Unsupported field type.");
    return false;
  }

  if (value.type === "text" || value.type === "textarea") {
    const minValid = validateOptionalNonNegativeInteger(value.minLength, `${path}.minLength`, issues);
    const maxValid = validateOptionalNonNegativeInteger(value.maxLength, `${path}.maxLength`, issues);
    if (
      minValid &&
      maxValid &&
      typeof value.minLength === "number" &&
      typeof value.maxLength === "number" &&
      value.minLength > value.maxLength
    ) {
      issue(issues, path, "contradictory_bounds", "minLength cannot exceed maxLength.");
    }
    if (value.pattern !== undefined) {
      if (typeof value.pattern !== "string") {
        issue(issues, `${path}.pattern`, "invalid_pattern", "Expected a regular expression string.");
      } else {
        try {
          new RegExp(value.pattern);
        } catch {
          issue(issues, `${path}.pattern`, "invalid_pattern", "Regular expression is invalid.");
        }
      }
    }
  }

  if (value.type === "number") {
    for (const key of ["min", "max", "step"] as const) {
      const bound = value[key];
      if (bound !== undefined && (typeof bound !== "number" || !Number.isFinite(bound))) {
        issue(issues, `${path}.${key}`, "invalid_bound", "Expected a finite number.");
      }
    }
    if (typeof value.step === "number" && value.step <= 0) {
      issue(issues, `${path}.step`, "invalid_step", "step must be greater than zero.");
    }
    if (typeof value.min === "number" && typeof value.max === "number" && value.min > value.max) {
      issue(issues, path, "contradictory_bounds", "min cannot exceed max.");
    }
  }

  if (value.type === "select" || value.type === "radio" || value.type === "multi-select") {
    validateOptions(value.options, `${path}.options`, issues);
  }
  if (value.type === "multi-select") {
    const minValid = validateOptionalNonNegativeInteger(value.minSelections, `${path}.minSelections`, issues);
    const maxValid = validateOptionalNonNegativeInteger(value.maxSelections, `${path}.maxSelections`, issues);
    if (
      minValid &&
      maxValid &&
      typeof value.minSelections === "number" &&
      typeof value.maxSelections === "number" &&
      value.minSelections > value.maxSelections
    ) {
      issue(issues, path, "contradictory_bounds", "minSelections cannot exceed maxSelections.");
    }
    if (
      Array.isArray(value.options) &&
      typeof value.maxSelections === "number" &&
      value.maxSelections > value.options.length
    ) {
      issue(issues, `${path}.maxSelections`, "invalid_bound", "maxSelections cannot exceed option count.");
    }
  }
  return true;
}

export function validateFormSchema(input: unknown): SchemaValidationResult {
  const issues: SchemaIssue[] = [];
  if (!isRecord(input)) {
    return { valid: false, issues: [{ path: "$", code: "invalid_schema", message: "Expected a schema object." }] };
  }
  if (!isNonEmptyString(input.id)) issue(issues, "id", "invalid_id", "Expected a non-empty ID.");
  if (!Number.isInteger(input.version) || (input.version as number) < 1) {
    issue(issues, "version", "invalid_version", "Expected a positive integer version.");
  }
  if (!isNonEmptyString(input.titleKey)) {
    issue(issues, "titleKey", "invalid_translation_key", "Expected a translation key.");
  }
  for (const key of ["descriptionKey", "submitLabelKey"] as const) {
    if (input[key] !== undefined && !isNonEmptyString(input[key])) {
      issue(issues, key, "invalid_translation_key", "Expected a translation key.");
    }
  }
  if (!Array.isArray(input.fields) || input.fields.length === 0) {
    issue(issues, "fields", "invalid_fields", "Expected at least one field.");
  } else {
    const ids = new Set<string>();
    input.fields.forEach((field, index) => {
      validateField(field, `fields[${index}]`, issues);
      if (isRecord(field) && isNonEmptyString(field.id)) {
        if (ids.has(field.id)) issue(issues, `fields[${index}].id`, "duplicate_field", "Field IDs must be unique.");
        ids.add(field.id);
      }
    });
  }
  return issues.length === 0
    ? { valid: true, value: input as unknown as FormSchema, issues: [] }
    : { valid: false, issues };
}

export class InvalidFormSchemaError extends Error {
  readonly issues: readonly SchemaIssue[];

  constructor(issues: readonly SchemaIssue[]) {
    super(`Invalid form schema: ${issues.map((item) => `${item.path}: ${item.message}`).join("; ")}`);
    this.name = "InvalidFormSchemaError";
    this.issues = issues;
  }
}

export function assertValidFormSchema(input: unknown): asserts input is FormSchema {
  const result = validateFormSchema(input);
  if (!result.valid) throw new InvalidFormSchemaError(result.issues);
}
