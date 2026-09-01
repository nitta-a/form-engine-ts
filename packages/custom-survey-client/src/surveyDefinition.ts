import type {
  FieldOption,
  FormField,
  FormSchema,
  JsonValue,
  MultiSelectField,
  NumberField,
  RatingField,
  SelectField,
  TextField
} from "@form-engine-ts/core";

export type SurveyDefinitionQuestionType =
  | "text"
  | "textarea"
  | "number"
  | "rating"
  | "radio"
  | "select"
  | "single-choice"
  | "checkbox"
  | "multi-select";

export type SurveyDefinitionSelectionStyle = "radio" | "select";

export interface SurveyDefinitionOption {
  readonly id: string;
  readonly label: string;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

interface SurveyDefinitionQuestionBase {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly required?: boolean;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface SurveyDefinitionTextQuestion extends SurveyDefinitionQuestionBase {
  readonly type: "text" | "textarea";
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
}

export interface SurveyDefinitionNumberQuestion extends SurveyDefinitionQuestionBase {
  readonly type: "number";
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
}

export interface SurveyDefinitionRatingQuestion extends SurveyDefinitionQuestionBase {
  readonly type: "rating";
  readonly min?: number;
  readonly max?: number;
}

export interface SurveyDefinitionChoiceQuestion extends SurveyDefinitionQuestionBase {
  readonly type: "radio" | "select";
  readonly options: readonly SurveyDefinitionOption[];
}

export interface SurveyDefinitionSingleChoiceQuestion extends SurveyDefinitionQuestionBase {
  readonly type: "single-choice";
  readonly selectionStyle: SurveyDefinitionSelectionStyle;
  readonly options: readonly SurveyDefinitionOption[];
}

export interface SurveyDefinitionMultiSelectQuestion extends SurveyDefinitionQuestionBase {
  readonly type: "multi-select";
  readonly options: readonly SurveyDefinitionOption[];
  readonly minSelections?: number;
  readonly maxSelections?: number;
}

export interface SurveyDefinitionCheckboxQuestion extends SurveyDefinitionQuestionBase {
  readonly type: "checkbox";
}

export type SurveyDefinitionQuestion =
  | SurveyDefinitionTextQuestion
  | SurveyDefinitionNumberQuestion
  | SurveyDefinitionRatingQuestion
  | SurveyDefinitionChoiceQuestion
  | SurveyDefinitionSingleChoiceQuestion
  | SurveyDefinitionMultiSelectQuestion
  | SurveyDefinitionCheckboxQuestion;

export interface SurveyDefinition {
  readonly id: string;
  readonly version: number;
  readonly locale: string;
  readonly title: string;
  readonly description?: string;
  readonly completionMessage?: string;
  readonly fields: readonly SurveyDefinitionQuestion[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface FormSchemaToSurveyDefinitionOptions {
  /** Used only when the schema has neither defaultLocale nor supportedLocales. */
  readonly locale?: string;
}

export class SurveyDefinitionConversionError extends TypeError {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "SurveyDefinitionConversionError";
    this.path = path;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown, ancestors = new Set<object>()): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  if (ancestors.has(value)) return false;
  const nextAncestors = new Set(ancestors).add(value);
  if (Array.isArray(value)) return value.every((item) => isJsonValue(item, nextAncestors));
  return (
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.values(value).every((item) => isJsonValue(item, nextAncestors))
  );
}

function assertNonEmptyString(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new SurveyDefinitionConversionError(path, "Expected a non-empty string.");
  }
}

function assertFiniteNumber(value: unknown, path: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new SurveyDefinitionConversionError(path, "Expected a finite number.");
  }
}

function assertOptionalFiniteNumber(value: unknown, path: string): void {
  if (value !== undefined) assertFiniteNumber(value, path);
}

function assertMetadata(value: unknown, path: string): asserts value is Readonly<Record<string, JsonValue>> {
  if (!isRecord(value) || !isJsonValue(value)) {
    throw new SurveyDefinitionConversionError(path, "Expected JSON-serializable metadata.");
  }
}

function assertOption(option: unknown, path: string): asserts option is SurveyDefinitionOption {
  if (!isRecord(option)) throw new SurveyDefinitionConversionError(path, "Expected an option object.");
  assertNonEmptyString(option.id, `${path}.id`);
  assertNonEmptyString(option.label, `${path}.label`);
  if (option.metadata !== undefined) assertMetadata(option.metadata, `${path}.metadata`);
}

function assertOptions(options: unknown, path: string): asserts options is readonly SurveyDefinitionOption[] {
  if (!Array.isArray(options) || options.length === 0) {
    throw new SurveyDefinitionConversionError(path, "Expected at least one option.");
  }
  const ids = new Set<string>();
  options.forEach((option, index) => {
    const optionPath = `${path}[${index}]`;
    assertOption(option, optionPath);
    if (ids.has(option.id)) throw new SurveyDefinitionConversionError(`${optionPath}.id`, "Option IDs must be unique.");
    ids.add(option.id);
  });
}

function assertQuestion(question: unknown, path: string): asserts question is SurveyDefinitionQuestion {
  if (!isRecord(question)) throw new SurveyDefinitionConversionError(path, "Expected a question object.");
  assertNonEmptyString(question.id, `${path}.id`);
  assertNonEmptyString(question.title, `${path}.title`);
  if (question.description !== undefined) assertNonEmptyString(question.description, `${path}.description`);
  if (question.required !== undefined && typeof question.required !== "boolean") {
    throw new SurveyDefinitionConversionError(`${path}.required`, "Expected a boolean.");
  }
  if (question.metadata !== undefined) assertMetadata(question.metadata, `${path}.metadata`);
  if (question.type === "text" || question.type === "textarea") {
    assertOptionalFiniteNumber(question.minLength, `${path}.minLength`);
    assertOptionalFiniteNumber(question.maxLength, `${path}.maxLength`);
    if (question.pattern !== undefined) assertNonEmptyString(question.pattern, `${path}.pattern`);
    return;
  }
  if (question.type === "number") {
    assertOptionalFiniteNumber(question.min, `${path}.min`);
    assertOptionalFiniteNumber(question.max, `${path}.max`);
    assertOptionalFiniteNumber(question.step, `${path}.step`);
    return;
  }
  if (question.type === "rating") {
    assertOptionalFiniteNumber(question.min, `${path}.min`);
    assertOptionalFiniteNumber(question.max, `${path}.max`);
    return;
  }
  if (question.type === "radio" || question.type === "select" || question.type === "multi-select") {
    assertOptions(question.options, `${path}.options`);
    if (question.type === "multi-select") {
      assertOptionalFiniteNumber(question.minSelections, `${path}.minSelections`);
      assertOptionalFiniteNumber(question.maxSelections, `${path}.maxSelections`);
    }
    return;
  }
  if (question.type === "single-choice") {
    if (question.selectionStyle !== "radio" && question.selectionStyle !== "select") {
      throw new SurveyDefinitionConversionError(`${path}.selectionStyle`, "Expected radio or select.");
    }
    assertOptions(question.options, `${path}.options`);
    return;
  }
  if (question.type !== "checkbox") {
    throw new SurveyDefinitionConversionError(`${path}.type`, "Unsupported question type.");
  }
}

function optionToFieldOption(option: SurveyDefinitionOption): FieldOption {
  return {
    id: option.id,
    label: option.label,
    ...(option.metadata === undefined ? {} : { metadata: option.metadata })
  };
}

function questionToField(question: SurveyDefinitionQuestion): FormField {
  const base = {
    id: question.id,
    title: question.title,
    ...(question.description === undefined ? {} : { description: question.description }),
    required: question.required ?? false,
    ...(question.metadata === undefined ? {} : { metadata: question.metadata })
  };
  if (question.type === "text" || question.type === "textarea") {
    return {
      ...base,
      type: question.type,
      ...(question.minLength === undefined ? {} : { minLength: question.minLength }),
      ...(question.maxLength === undefined ? {} : { maxLength: question.maxLength }),
      ...(question.pattern === undefined ? {} : { pattern: question.pattern })
    } satisfies TextField;
  }
  if (question.type === "number") {
    return {
      ...base,
      type: question.type,
      ...(question.min === undefined ? {} : { min: question.min }),
      ...(question.max === undefined ? {} : { max: question.max }),
      ...(question.step === undefined ? {} : { step: question.step })
    } satisfies NumberField;
  }
  if (question.type === "rating") {
    return {
      ...base,
      type: question.type,
      ...(question.min === undefined ? {} : { min: question.min }),
      ...(question.max === undefined ? {} : { max: question.max })
    } satisfies RatingField;
  }
  if (question.type === "checkbox") return { ...base, type: question.type };
  if (question.type === "multi-select") {
    return {
      ...base,
      type: question.type,
      options: question.options.map(optionToFieldOption),
      ...(question.minSelections === undefined ? {} : { minSelections: question.minSelections }),
      ...(question.maxSelections === undefined ? {} : { maxSelections: question.maxSelections })
    } satisfies MultiSelectField;
  }
  if (question.type === "single-choice") {
    return {
      ...base,
      type: question.selectionStyle,
      options: question.options.map(optionToFieldOption)
    } satisfies SelectField;
  }
  if (question.type === "radio" || question.type === "select") {
    if (!("options" in question)) throw new SurveyDefinitionConversionError("options", "Options are required.");
    return { ...base, type: question.type, options: question.options.map(optionToFieldOption) } satisfies SelectField;
  }
  throw new SurveyDefinitionConversionError("type", "Unsupported question type.");
}

export function surveyDefinitionToFormSchema(definition: SurveyDefinition): FormSchema {
  assertNonEmptyString(definition.id, "id");
  assertFiniteNumber(definition.version, "version");
  if (!Number.isInteger(definition.version) || definition.version < 0) {
    throw new SurveyDefinitionConversionError("version", "Expected a non-negative integer.");
  }
  assertNonEmptyString(definition.locale, "locale");
  assertNonEmptyString(definition.title, "title");
  if (definition.description !== undefined) assertNonEmptyString(definition.description, "description");
  if (definition.completionMessage !== undefined)
    assertNonEmptyString(definition.completionMessage, "completionMessage");
  if (definition.metadata !== undefined) assertMetadata(definition.metadata, "metadata");
  if (!Array.isArray(definition.fields)) throw new SurveyDefinitionConversionError("fields", "Expected an array.");
  const fieldIds = new Set<string>();
  definition.fields.forEach((field, index) => {
    const path = `fields[${index}]`;
    assertQuestion(field, path);
    if (fieldIds.has(field.id)) throw new SurveyDefinitionConversionError(`${path}.id`, "Question IDs must be unique.");
    fieldIds.add(field.id);
  });
  return {
    id: definition.id,
    version: definition.version,
    title: definition.title,
    ...(definition.description === undefined ? {} : { description: definition.description }),
    ...(definition.completionMessage === undefined ? {} : { completionMessage: definition.completionMessage }),
    defaultLocale: definition.locale,
    supportedLocales: [definition.locale],
    fields: definition.fields.map(questionToField),
    ...(definition.metadata === undefined ? {} : { metadata: definition.metadata })
  };
}

function fieldOptionToDefinition(option: FieldOption): SurveyDefinitionOption {
  return {
    id: option.id,
    label: option.label,
    ...(option.metadata === undefined ? {} : { metadata: option.metadata })
  };
}

function fieldToQuestion(field: FormField): SurveyDefinitionQuestion {
  const base = {
    id: field.id,
    title: field.title,
    ...(field.description === undefined ? {} : { description: field.description }),
    required: field.required,
    ...(field.metadata === undefined ? {} : { metadata: field.metadata })
  };
  if (field.type === "text" || field.type === "textarea") {
    return {
      ...base,
      type: field.type,
      ...(field.minLength === undefined ? {} : { minLength: field.minLength }),
      ...(field.maxLength === undefined ? {} : { maxLength: field.maxLength }),
      ...(field.pattern === undefined ? {} : { pattern: field.pattern })
    };
  }
  if (field.type === "number") {
    return {
      ...base,
      type: field.type,
      ...(field.min === undefined ? {} : { min: field.min }),
      ...(field.max === undefined ? {} : { max: field.max }),
      ...(field.step === undefined ? {} : { step: field.step })
    };
  }
  if (field.type === "rating") {
    return {
      ...base,
      type: field.type,
      ...(field.min === undefined ? {} : { min: field.min }),
      ...(field.max === undefined ? {} : { max: field.max })
    };
  }
  if (field.type === "checkbox") return { ...base, type: field.type };
  if (field.type === "multi-select") {
    return {
      ...base,
      type: field.type,
      options: field.options.map(fieldOptionToDefinition),
      ...(field.minSelections === undefined ? {} : { minSelections: field.minSelections }),
      ...(field.maxSelections === undefined ? {} : { maxSelections: field.maxSelections })
    };
  }
  if (!("options" in field)) {
    throw new SurveyDefinitionConversionError("fields.options", "Options are required.");
  }
  return {
    ...base,
    type: "single-choice",
    selectionStyle: field.type,
    options: field.options.map(fieldOptionToDefinition)
  };
}

export function formSchemaToSurveyDefinition(
  schema: FormSchema,
  options: FormSchemaToSurveyDefinitionOptions = {}
): SurveyDefinition {
  const locale = schema.defaultLocale ?? schema.supportedLocales?.[0] ?? options.locale;
  if (locale === undefined) {
    throw new SurveyDefinitionConversionError(
      "locale",
      "A defaultLocale, supported locale, or fallback locale is required."
    );
  }
  assertNonEmptyString(locale, "locale");
  return {
    id: schema.id,
    version: schema.version,
    locale,
    title: schema.title,
    ...(schema.description === undefined ? {} : { description: schema.description }),
    ...(schema.completionMessage === undefined ? {} : { completionMessage: schema.completionMessage }),
    fields: schema.fields.map(fieldToQuestion),
    ...(schema.metadata === undefined ? {} : { metadata: schema.metadata })
  };
}
