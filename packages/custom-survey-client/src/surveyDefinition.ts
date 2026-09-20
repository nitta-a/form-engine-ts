import type {
  DisplayCondition,
  DisplayRule,
  FieldOption,
  FormField,
  FormPage,
  FormSchema,
  FormSubmissionSettings,
  JsonValue,
  MultiSelectField,
  NumberField,
  RatingField,
  SchemaTranslations,
  SelectField,
  TextField,
  ValidationCode
} from "@form-engine-ts/core";
import type { SurveyMetadata, SurveyMetadataCodec } from "./types";

export type SurveyDefinitionQuestionType =
  | "text"
  | "textarea"
  | "date"
  | "time"
  | "email"
  | "tel"
  | "url"
  | "number"
  | "rating"
  | "radio"
  | "select"
  | "single-choice"
  | "checkbox"
  | "multi-select";

export type SurveyDefinitionSelectionStyle = "radio" | "select";

type SurveyDefinitionNodeMetadata<TMetadata extends SurveyMetadata, TTranslationMetadata extends SurveyMetadata> = {
  readonly metadata?: TMetadata;
  readonly translationMetadata?: SurveyDefinitionTranslationMetadata<TTranslationMetadata>;
};

export type SurveyDefinitionTranslationMetadata<TTranslationMetadata extends SurveyMetadata = SurveyMetadata> =
  Readonly<Record<string, Readonly<Record<string, TTranslationMetadata>>>>;

export interface TypedSurveyDefinitionOption<
  TMetadata extends SurveyMetadata = SurveyMetadata,
  TTranslationMetadata extends SurveyMetadata = SurveyMetadata
> extends SurveyDefinitionNodeMetadata<TMetadata, TTranslationMetadata> {
  readonly id: string;
  readonly label: string;
  readonly textInput?: boolean;
  readonly pinned?: boolean;
  readonly translations?: Readonly<Record<string, string>>;
}

interface TypedSurveyDefinitionQuestionBase<
  TMetadata extends SurveyMetadata,
  TTranslationMetadata extends SurveyMetadata
> extends SurveyDefinitionNodeMetadata<TMetadata, TTranslationMetadata> {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly required?: boolean;
  readonly translationKey?: string;
  readonly messages?: Partial<Record<ValidationCode, string>>;
  readonly displayCondition?: DisplayCondition;
  readonly displayRule?: DisplayRule;
  readonly translations?: SchemaTranslations;
}

export interface TypedSurveyDefinitionTextQuestion<
  TMetadata extends SurveyMetadata = SurveyMetadata,
  TTranslationMetadata extends SurveyMetadata = SurveyMetadata
> extends TypedSurveyDefinitionQuestionBase<TMetadata, TTranslationMetadata> {
  readonly type: "text" | "textarea";
  readonly placeholderKey?: string;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
}

export interface TypedSurveyDefinitionTypedStringQuestion<
  TMetadata extends SurveyMetadata = SurveyMetadata,
  TTranslationMetadata extends SurveyMetadata = SurveyMetadata
> extends TypedSurveyDefinitionQuestionBase<TMetadata, TTranslationMetadata> {
  readonly type: "date" | "time" | "email" | "tel" | "url";
  readonly placeholderKey?: string;
  readonly minDate?: string;
  readonly maxDate?: string;
  readonly minTime?: string;
  readonly maxTime?: string;
}

export interface TypedSurveyDefinitionNumberQuestion<
  TMetadata extends SurveyMetadata = SurveyMetadata,
  TTranslationMetadata extends SurveyMetadata = SurveyMetadata
> extends TypedSurveyDefinitionQuestionBase<TMetadata, TTranslationMetadata> {
  readonly type: "number";
  readonly placeholderKey?: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
}

export interface TypedSurveyDefinitionRatingQuestion<
  TMetadata extends SurveyMetadata = SurveyMetadata,
  TTranslationMetadata extends SurveyMetadata = SurveyMetadata
> extends TypedSurveyDefinitionQuestionBase<TMetadata, TTranslationMetadata> {
  readonly type: "rating";
  readonly min?: number;
  readonly max?: number;
}

export interface TypedSurveyDefinitionChoiceQuestion<
  TMetadata extends SurveyMetadata = SurveyMetadata,
  TTranslationMetadata extends SurveyMetadata = SurveyMetadata
> extends TypedSurveyDefinitionQuestionBase<TMetadata, TTranslationMetadata> {
  readonly type: "radio" | "select";
  readonly options: readonly TypedSurveyDefinitionOption<TMetadata, TTranslationMetadata>[];
  readonly shuffleOptions?: boolean;
}

export interface TypedSurveyDefinitionSingleChoiceQuestion<
  TMetadata extends SurveyMetadata = SurveyMetadata,
  TTranslationMetadata extends SurveyMetadata = SurveyMetadata
> extends TypedSurveyDefinitionQuestionBase<TMetadata, TTranslationMetadata> {
  readonly type: "single-choice";
  readonly selectionStyle: SurveyDefinitionSelectionStyle;
  readonly options: readonly TypedSurveyDefinitionOption<TMetadata, TTranslationMetadata>[];
  readonly shuffleOptions?: boolean;
}

export interface TypedSurveyDefinitionMultiSelectQuestion<
  TMetadata extends SurveyMetadata = SurveyMetadata,
  TTranslationMetadata extends SurveyMetadata = SurveyMetadata
> extends TypedSurveyDefinitionQuestionBase<TMetadata, TTranslationMetadata> {
  readonly type: "multi-select";
  readonly options: readonly TypedSurveyDefinitionOption<TMetadata, TTranslationMetadata>[];
  readonly shuffleOptions?: boolean;
  readonly minSelections?: number;
  readonly maxSelections?: number;
}

export interface TypedSurveyDefinitionCheckboxQuestion<
  TMetadata extends SurveyMetadata = SurveyMetadata,
  TTranslationMetadata extends SurveyMetadata = SurveyMetadata
> extends TypedSurveyDefinitionQuestionBase<TMetadata, TTranslationMetadata> {
  readonly type: "checkbox";
}

export type TypedSurveyDefinitionQuestion<
  TMetadata extends SurveyMetadata = SurveyMetadata,
  TTranslationMetadata extends SurveyMetadata = SurveyMetadata
> =
  | TypedSurveyDefinitionTextQuestion<TMetadata, TTranslationMetadata>
  | TypedSurveyDefinitionTypedStringQuestion<TMetadata, TTranslationMetadata>
  | TypedSurveyDefinitionNumberQuestion<TMetadata, TTranslationMetadata>
  | TypedSurveyDefinitionRatingQuestion<TMetadata, TTranslationMetadata>
  | TypedSurveyDefinitionChoiceQuestion<TMetadata, TTranslationMetadata>
  | TypedSurveyDefinitionSingleChoiceQuestion<TMetadata, TTranslationMetadata>
  | TypedSurveyDefinitionMultiSelectQuestion<TMetadata, TTranslationMetadata>
  | TypedSurveyDefinitionCheckboxQuestion<TMetadata, TTranslationMetadata>;

export interface TypedSurveyDefinitionPage<
  TMetadata extends SurveyMetadata = SurveyMetadata,
  TTranslationMetadata extends SurveyMetadata = SurveyMetadata
> extends SurveyDefinitionNodeMetadata<TMetadata, TTranslationMetadata> {
  readonly id: string;
  readonly title?: string;
  readonly description?: string;
  readonly questionIds: readonly string[];
  readonly displayCondition?: DisplayCondition;
  readonly translations?: SchemaTranslations;
}

export type TypedSurveyDefinitionSubmissionSettings<
  TMetadata extends SurveyMetadata = SurveyMetadata,
  TTranslationMetadata extends SurveyMetadata = SurveyMetadata
> = Omit<FormSubmissionSettings, "metadata" | "translationMetadata"> &
  SurveyDefinitionNodeMetadata<TMetadata, TTranslationMetadata>;

export interface TypedSurveyDefinition<
  TMetadata extends SurveyMetadata = SurveyMetadata,
  TTranslationMetadata extends SurveyMetadata = SurveyMetadata
> extends SurveyDefinitionNodeMetadata<TMetadata, TTranslationMetadata> {
  readonly id: string;
  readonly version: number;
  readonly locale: string;
  /** Preserved when the source schema has an explicit non-legacy locale configuration. */
  readonly defaultLocale?: string;
  readonly supportedLocales?: readonly string[];
  readonly title: string;
  readonly description?: string;
  readonly completionMessage?: string;
  readonly submitLabelKey?: string;
  readonly translations?: SchemaTranslations;
  readonly fields: readonly TypedSurveyDefinitionQuestion<TMetadata, TTranslationMetadata>[];
  readonly pages?: readonly TypedSurveyDefinitionPage<TMetadata, TTranslationMetadata>[];
  readonly submissionSettings?: TypedSurveyDefinitionSubmissionSettings<TMetadata, TTranslationMetadata>;
}

interface SurveyDefinitionQuestionBase {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly required?: boolean;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
  readonly translationKey?: string;
  readonly messages?: Partial<Record<ValidationCode, string>>;
  readonly displayCondition?: DisplayCondition;
  readonly displayRule?: DisplayRule;
  readonly translations?: SchemaTranslations;
  readonly translationMetadata?: SurveyDefinitionTranslationMetadata;
}

export interface SurveyDefinitionOption {
  readonly id: string;
  readonly label: string;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
  readonly textInput?: boolean;
  readonly pinned?: boolean;
  readonly translations?: Readonly<Record<string, string>>;
}

export interface SurveyDefinitionTextQuestion extends SurveyDefinitionQuestionBase {
  readonly type: "text" | "textarea";
  readonly placeholderKey?: string;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
}

export interface SurveyDefinitionTypedStringQuestion extends SurveyDefinitionQuestionBase {
  readonly type: "date" | "time" | "email" | "tel" | "url";
  readonly placeholderKey?: string;
  readonly minDate?: string;
  readonly maxDate?: string;
  readonly minTime?: string;
  readonly maxTime?: string;
}

export interface SurveyDefinitionNumberQuestion extends SurveyDefinitionQuestionBase {
  readonly type: "number";
  readonly placeholderKey?: string;
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
  readonly shuffleOptions?: boolean;
}

export interface SurveyDefinitionSingleChoiceQuestion extends SurveyDefinitionQuestionBase {
  readonly type: "single-choice";
  readonly selectionStyle: SurveyDefinitionSelectionStyle;
  readonly options: readonly SurveyDefinitionOption[];
  readonly shuffleOptions?: boolean;
}

export interface SurveyDefinitionMultiSelectQuestion extends SurveyDefinitionQuestionBase {
  readonly type: "multi-select";
  readonly options: readonly SurveyDefinitionOption[];
  readonly shuffleOptions?: boolean;
  readonly minSelections?: number;
  readonly maxSelections?: number;
}

export interface SurveyDefinitionCheckboxQuestion extends SurveyDefinitionQuestionBase {
  readonly type: "checkbox";
}

export type SurveyDefinitionQuestion =
  | SurveyDefinitionTextQuestion
  | SurveyDefinitionTypedStringQuestion
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
  readonly defaultLocale?: string;
  readonly supportedLocales?: readonly string[];
  readonly title: string;
  readonly description?: string;
  readonly completionMessage?: string;
  readonly submitLabelKey?: string;
  readonly translations?: SchemaTranslations;
  readonly translationMetadata?: SurveyDefinitionTranslationMetadata;
  readonly fields: readonly SurveyDefinitionQuestion[];
  readonly pages?: readonly TypedSurveyDefinitionPage[];
  readonly submissionSettings?: TypedSurveyDefinitionSubmissionSettings;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface SurveyDefinitionToFormSchemaOptions<
  TMetadata extends SurveyMetadata = SurveyMetadata,
  TTranslationMetadata extends SurveyMetadata = SurveyMetadata
> {
  readonly metadataCodec?: SurveyMetadataCodec<TMetadata>;
  readonly translationMetadataCodec?: SurveyMetadataCodec<TTranslationMetadata>;
}

export interface TypedFormSchemaToSurveyDefinitionOptions<
  TMetadata extends SurveyMetadata = SurveyMetadata,
  TTranslationMetadata extends SurveyMetadata = SurveyMetadata
> {
  /** Used only when the schema has neither defaultLocale nor supportedLocales. */
  readonly locale?: string;
  readonly metadataCodec?: SurveyMetadataCodec<TMetadata>;
  readonly translationMetadataCodec?: SurveyMetadataCodec<TTranslationMetadata>;
}

export interface FormSchemaToSurveyDefinitionOptions {
  /** Used only when the schema has neither defaultLocale nor supportedLocales. */
  readonly locale?: string;
  readonly metadataCodec?: SurveyMetadataCodec;
  readonly translationMetadataCodec?: SurveyMetadataCodec;
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

function encodeMetadata<TMetadata extends SurveyMetadata>(
  metadata: TMetadata | undefined,
  codec: SurveyMetadataCodec<TMetadata> | undefined,
  path: string
): SurveyMetadata | undefined {
  if (metadata === undefined) return undefined;
  return encodeRequiredMetadata(metadata, codec, path);
}

function encodeRequiredMetadata<TMetadata extends SurveyMetadata>(
  metadata: TMetadata,
  codec: SurveyMetadataCodec<TMetadata> | undefined,
  path: string
): SurveyMetadata {
  const encoded = codec === undefined ? metadata : codec.toEngine(metadata);
  assertMetadata(encoded, path);
  return encoded;
}

function decodeMetadata<TMetadata extends SurveyMetadata>(
  metadata: SurveyMetadata | undefined,
  codec: SurveyMetadataCodec<TMetadata> | undefined
): TMetadata | undefined {
  if (metadata === undefined) return undefined;
  return codec === undefined ? (metadata as TMetadata) : codec.fromEngine(metadata);
}

function encodeTranslationMetadata<TTranslationMetadata extends SurveyMetadata>(
  metadata: SurveyDefinitionTranslationMetadata<TTranslationMetadata> | undefined,
  codec: SurveyMetadataCodec<TTranslationMetadata> | undefined,
  path: string
): FormSchema["translationMetadata"] | undefined {
  if (metadata === undefined) return undefined;
  return Object.fromEntries(
    Object.entries(metadata).map(([locale, properties]) => [
      locale,
      Object.fromEntries(
        Object.entries(properties).map(([property, value]) => [
          property,
          encodeRequiredMetadata(value, codec, `${path}.${locale}.${property}`)
        ])
      )
    ])
  );
}

function decodeTranslationMetadata<TTranslationMetadata extends SurveyMetadata>(
  metadata: FormSchema["translationMetadata"] | undefined,
  codec: SurveyMetadataCodec<TTranslationMetadata> | undefined
): SurveyDefinitionTranslationMetadata<TTranslationMetadata> | undefined {
  if (metadata === undefined) return undefined;
  const decoded: Record<string, Record<string, TTranslationMetadata>> = {};
  for (const [locale, properties] of Object.entries(metadata)) {
    decoded[locale] = {};
    for (const [property, value] of Object.entries(properties)) {
      decoded[locale][property] = codec === undefined ? (value as TTranslationMetadata) : codec.fromEngine(value);
    }
  }
  return decoded;
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
  if (
    question.type === "date" ||
    question.type === "time" ||
    question.type === "email" ||
    question.type === "tel" ||
    question.type === "url"
  ) {
    if (question.placeholderKey !== undefined) assertNonEmptyString(question.placeholderKey, `${path}.placeholderKey`);
    for (const key of ["minDate", "maxDate", "minTime", "maxTime"] as const) {
      if (question[key] !== undefined) assertNonEmptyString(question[key], `${path}.${key}`);
    }
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

function optionToFieldOption<TMetadata extends SurveyMetadata, TTranslationMetadata extends SurveyMetadata>(
  option: TypedSurveyDefinitionOption<TMetadata, TTranslationMetadata>,
  metadataCodec: SurveyMetadataCodec<TMetadata> | undefined,
  translationMetadataCodec: SurveyMetadataCodec<TTranslationMetadata> | undefined,
  path: string
): FieldOption {
  const metadata = encodeMetadata(option.metadata, metadataCodec, `${path}.metadata`);
  const translationMetadata = encodeTranslationMetadata(
    option.translationMetadata,
    translationMetadataCodec,
    `${path}.translationMetadata`
  );
  return {
    id: option.id,
    label: option.label,
    ...(metadata === undefined ? {} : { metadata }),
    ...(option.textInput === undefined ? {} : { textInput: option.textInput }),
    ...(option.pinned === undefined ? {} : { pinned: option.pinned }),
    ...(option.translations === undefined ? {} : { translations: option.translations }),
    ...(translationMetadata === undefined ? {} : { translationMetadata })
  };
}

function questionToField<TMetadata extends SurveyMetadata, TTranslationMetadata extends SurveyMetadata>(
  question: TypedSurveyDefinitionQuestion<TMetadata, TTranslationMetadata>,
  metadataCodec: SurveyMetadataCodec<TMetadata> | undefined,
  translationMetadataCodec: SurveyMetadataCodec<TTranslationMetadata> | undefined,
  path: string
): FormField {
  const metadata = encodeMetadata(question.metadata, metadataCodec, `${path}.metadata`);
  const translationMetadata = encodeTranslationMetadata(
    question.translationMetadata,
    translationMetadataCodec,
    `${path}.translationMetadata`
  );
  const base = {
    id: question.id,
    title: question.title,
    ...(question.description === undefined ? {} : { description: question.description }),
    required: question.required ?? false,
    ...(metadata === undefined ? {} : { metadata }),
    ...(question.translationKey === undefined ? {} : { translationKey: question.translationKey }),
    ...(question.messages === undefined ? {} : { messages: question.messages }),
    ...(question.displayCondition === undefined ? {} : { displayCondition: question.displayCondition }),
    ...(question.displayRule === undefined ? {} : { displayRule: question.displayRule }),
    ...(question.translations === undefined ? {} : { translations: question.translations }),
    ...(translationMetadata === undefined ? {} : { translationMetadata })
  };
  if (question.type === "text" || question.type === "textarea") {
    return {
      ...base,
      type: question.type,
      ...(question.placeholderKey === undefined ? {} : { placeholderKey: question.placeholderKey }),
      ...(question.minLength === undefined ? {} : { minLength: question.minLength }),
      ...(question.maxLength === undefined ? {} : { maxLength: question.maxLength }),
      ...(question.pattern === undefined ? {} : { pattern: question.pattern })
    } satisfies TextField;
  }
  if (
    question.type === "date" ||
    question.type === "time" ||
    question.type === "email" ||
    question.type === "tel" ||
    question.type === "url"
  ) {
    return {
      ...base,
      type: question.type,
      ...(question.placeholderKey === undefined ? {} : { placeholderKey: question.placeholderKey }),
      ...(question.minDate === undefined ? {} : { minDate: question.minDate }),
      ...(question.maxDate === undefined ? {} : { maxDate: question.maxDate }),
      ...(question.minTime === undefined ? {} : { minTime: question.minTime }),
      ...(question.maxTime === undefined ? {} : { maxTime: question.maxTime })
    } as FormField;
  }
  if (question.type === "number") {
    return {
      ...base,
      type: question.type,
      ...(question.placeholderKey === undefined ? {} : { placeholderKey: question.placeholderKey }),
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
      options: question.options.map((option, index) =>
        optionToFieldOption(option, metadataCodec, translationMetadataCodec, `${path}.options[${index}]`)
      ),
      ...(question.shuffleOptions === undefined ? {} : { shuffleOptions: question.shuffleOptions }),
      ...(question.minSelections === undefined ? {} : { minSelections: question.minSelections }),
      ...(question.maxSelections === undefined ? {} : { maxSelections: question.maxSelections })
    } satisfies MultiSelectField;
  }
  if (question.type === "single-choice") {
    return {
      ...base,
      type: question.selectionStyle,
      options: question.options.map((option, index) =>
        optionToFieldOption(option, metadataCodec, translationMetadataCodec, `${path}.options[${index}]`)
      ),
      ...(question.shuffleOptions === undefined ? {} : { shuffleOptions: question.shuffleOptions })
    } satisfies SelectField;
  }
  if (question.type === "radio" || question.type === "select") {
    if (!("options" in question)) throw new SurveyDefinitionConversionError("options", "Options are required.");
    return {
      ...base,
      type: question.type,
      options: question.options.map((option, index) =>
        optionToFieldOption(option, metadataCodec, translationMetadataCodec, `${path}.options[${index}]`)
      ),
      ...(question.shuffleOptions === undefined ? {} : { shuffleOptions: question.shuffleOptions })
    } satisfies SelectField;
  }
  throw new SurveyDefinitionConversionError("type", "Unsupported question type.");
}

function pageToFormPage<TMetadata extends SurveyMetadata, TTranslationMetadata extends SurveyMetadata>(
  page: TypedSurveyDefinitionPage<TMetadata, TTranslationMetadata>,
  metadataCodec: SurveyMetadataCodec<TMetadata> | undefined,
  translationMetadataCodec: SurveyMetadataCodec<TTranslationMetadata> | undefined,
  path: string
): FormPage {
  const { metadata, ...rest } = page;
  const encoded = encodeMetadata(metadata, metadataCodec, `${path}.metadata`);
  const translationMetadata = encodeTranslationMetadata(
    page.translationMetadata,
    translationMetadataCodec,
    `${path}.translationMetadata`
  );
  return {
    ...rest,
    ...(encoded === undefined ? {} : { metadata: encoded }),
    ...(translationMetadata === undefined ? {} : { translationMetadata })
  };
}

function submissionSettingsToFormSettings<
  TMetadata extends SurveyMetadata,
  TTranslationMetadata extends SurveyMetadata
>(
  settings: TypedSurveyDefinitionSubmissionSettings<TMetadata, TTranslationMetadata>,
  metadataCodec: SurveyMetadataCodec<TMetadata> | undefined,
  translationMetadataCodec: SurveyMetadataCodec<TTranslationMetadata> | undefined
): FormSubmissionSettings {
  const { metadata, ...rest } = settings;
  const encoded = encodeMetadata(metadata, metadataCodec, "submissionSettings.metadata");
  const translationMetadata = encodeTranslationMetadata(
    settings.translationMetadata,
    translationMetadataCodec,
    "submissionSettings.translationMetadata"
  );
  return {
    ...rest,
    ...(encoded === undefined ? {} : { metadata: encoded }),
    ...(translationMetadata === undefined ? {} : { translationMetadata })
  };
}

function pageToDefinition<TMetadata extends SurveyMetadata, TTranslationMetadata extends SurveyMetadata>(
  page: FormPage,
  metadataCodec: SurveyMetadataCodec<TMetadata> | undefined,
  translationMetadataCodec: SurveyMetadataCodec<TTranslationMetadata> | undefined
): TypedSurveyDefinitionPage<TMetadata, TTranslationMetadata> {
  const { metadata, translationMetadata: _translationMetadata, ...rest } = page;
  const decoded = decodeMetadata(metadata, metadataCodec);
  const translationMetadata = decodeTranslationMetadata(page.translationMetadata, translationMetadataCodec);
  return {
    ...rest,
    ...(decoded === undefined ? {} : { metadata: decoded }),
    ...(translationMetadata === undefined ? {} : { translationMetadata })
  };
}

function submissionSettingsToDefinition<TMetadata extends SurveyMetadata, TTranslationMetadata extends SurveyMetadata>(
  settings: FormSubmissionSettings,
  metadataCodec: SurveyMetadataCodec<TMetadata> | undefined,
  translationMetadataCodec: SurveyMetadataCodec<TTranslationMetadata> | undefined
): TypedSurveyDefinitionSubmissionSettings<TMetadata, TTranslationMetadata> {
  const { metadata, translationMetadata: _translationMetadata, ...rest } = settings;
  const decoded = decodeMetadata(metadata, metadataCodec);
  const translationMetadata = decodeTranslationMetadata(settings.translationMetadata, translationMetadataCodec);
  return {
    ...rest,
    ...(decoded === undefined ? {} : { metadata: decoded }),
    ...(translationMetadata === undefined ? {} : { translationMetadata })
  };
}

export function surveyDefinitionToFormSchema(definition: SurveyDefinition): FormSchema;
export function surveyDefinitionToFormSchema<
  TMetadata extends SurveyMetadata,
  TTranslationMetadata extends SurveyMetadata
>(
  definition: TypedSurveyDefinition<TMetadata, TTranslationMetadata>,
  options?: SurveyDefinitionToFormSchemaOptions<TMetadata, TTranslationMetadata>
): FormSchema;
export function surveyDefinitionToFormSchema(
  definition: SurveyDefinition | TypedSurveyDefinition,
  options: SurveyDefinitionToFormSchemaOptions = {}
): FormSchema {
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
  const metadata = encodeMetadata(definition.metadata, options.metadataCodec, "metadata");
  const translationMetadata = encodeTranslationMetadata(
    definition.translationMetadata,
    options.translationMetadataCodec,
    "translationMetadata"
  );
  const localeConfig = Object.hasOwn(definition, "defaultLocale") || Object.hasOwn(definition, "supportedLocales");
  const result = {
    id: definition.id,
    version: definition.version,
    title: definition.title,
    ...(definition.description === undefined ? {} : { description: definition.description }),
    ...(definition.completionMessage === undefined ? {} : { completionMessage: definition.completionMessage }),
    ...(definition.submitLabelKey === undefined ? {} : { submitLabelKey: definition.submitLabelKey }),
    ...(localeConfig
      ? {
          ...(definition.defaultLocale === undefined ? {} : { defaultLocale: definition.defaultLocale }),
          ...(definition.supportedLocales === undefined ? {} : { supportedLocales: definition.supportedLocales })
        }
      : { defaultLocale: definition.locale, supportedLocales: [definition.locale] }),
    ...(definition.translations === undefined ? {} : { translations: definition.translations }),
    ...(translationMetadata === undefined ? {} : { translationMetadata }),
    fields: definition.fields.map((field, index) =>
      questionToField(field, options.metadataCodec, options.translationMetadataCodec, `fields[${index}]`)
    ),
    ...(definition.pages === undefined
      ? {}
      : {
          pages: definition.pages.map((page, index) =>
            pageToFormPage(page, options.metadataCodec, options.translationMetadataCodec, `pages[${index}]`)
          )
        }),
    ...(definition.submissionSettings === undefined
      ? {}
      : {
          submissionSettings: submissionSettingsToFormSettings(
            definition.submissionSettings,
            options.metadataCodec,
            options.translationMetadataCodec
          )
        }),
    ...(metadata === undefined ? {} : { metadata })
  };
  return result;
}

function fieldOptionToDefinition<TMetadata extends SurveyMetadata, TTranslationMetadata extends SurveyMetadata>(
  option: FieldOption,
  metadataCodec: SurveyMetadataCodec<TMetadata> | undefined,
  translationMetadataCodec: SurveyMetadataCodec<TTranslationMetadata> | undefined
): TypedSurveyDefinitionOption<TMetadata, TTranslationMetadata> {
  const metadata = decodeMetadata(option.metadata, metadataCodec);
  const translationMetadata = decodeTranslationMetadata(option.translationMetadata, translationMetadataCodec);
  return {
    id: option.id,
    label: option.label,
    ...(metadata === undefined ? {} : { metadata }),
    ...(option.textInput === undefined ? {} : { textInput: option.textInput }),
    ...(option.pinned === undefined ? {} : { pinned: option.pinned }),
    ...(option.translations === undefined ? {} : { translations: option.translations }),
    ...(translationMetadata === undefined ? {} : { translationMetadata })
  };
}

function fieldToQuestion<TMetadata extends SurveyMetadata, TTranslationMetadata extends SurveyMetadata>(
  field: FormField,
  metadataCodec: SurveyMetadataCodec<TMetadata> | undefined,
  translationMetadataCodec: SurveyMetadataCodec<TTranslationMetadata> | undefined,
  path: string
): TypedSurveyDefinitionQuestion<TMetadata, TTranslationMetadata> {
  const metadata = decodeMetadata(field.metadata, metadataCodec);
  const translationMetadata = decodeTranslationMetadata(field.translationMetadata, translationMetadataCodec);
  const base = {
    id: field.id,
    title: field.title,
    ...(field.description === undefined ? {} : { description: field.description }),
    required: field.required,
    ...(metadata === undefined ? {} : { metadata }),
    ...(field.translationKey === undefined ? {} : { translationKey: field.translationKey }),
    ...(field.messages === undefined ? {} : { messages: field.messages }),
    ...(field.displayCondition === undefined ? {} : { displayCondition: field.displayCondition }),
    ...(field.displayRule === undefined ? {} : { displayRule: field.displayRule }),
    ...(field.translations === undefined ? {} : { translations: field.translations }),
    ...(translationMetadata === undefined ? {} : { translationMetadata })
  };
  if (field.type === "text" || field.type === "textarea") {
    return {
      ...base,
      type: field.type,
      ...(field.placeholderKey === undefined ? {} : { placeholderKey: field.placeholderKey }),
      ...(field.minLength === undefined ? {} : { minLength: field.minLength }),
      ...(field.maxLength === undefined ? {} : { maxLength: field.maxLength }),
      ...(field.pattern === undefined ? {} : { pattern: field.pattern })
    };
  }
  if (
    field.type === "date" ||
    field.type === "time" ||
    field.type === "email" ||
    field.type === "tel" ||
    field.type === "url"
  ) {
    return {
      ...base,
      type: field.type,
      ...(field.placeholderKey === undefined ? {} : { placeholderKey: field.placeholderKey }),
      ...(field.type === "date"
        ? {
            ...(field.minDate === undefined ? {} : { minDate: field.minDate }),
            ...(field.maxDate === undefined ? {} : { maxDate: field.maxDate })
          }
        : {}),
      ...(field.type === "time"
        ? {
            ...(field.minTime === undefined ? {} : { minTime: field.minTime }),
            ...(field.maxTime === undefined ? {} : { maxTime: field.maxTime })
          }
        : {})
    };
  }
  if (field.type === "number") {
    return {
      ...base,
      type: field.type,
      ...(field.placeholderKey === undefined ? {} : { placeholderKey: field.placeholderKey }),
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
      options: field.options.map((option) => fieldOptionToDefinition(option, metadataCodec, translationMetadataCodec)),
      ...(field.shuffleOptions === undefined ? {} : { shuffleOptions: field.shuffleOptions }),
      ...(field.minSelections === undefined ? {} : { minSelections: field.minSelections }),
      ...(field.maxSelections === undefined ? {} : { maxSelections: field.maxSelections })
    };
  }
  if (!("options" in field)) {
    throw new SurveyDefinitionConversionError(`${path}.options`, "Options are required.");
  }
  return {
    ...base,
    type: "single-choice",
    selectionStyle: field.type,
    options: field.options.map((option) => fieldOptionToDefinition(option, metadataCodec, translationMetadataCodec)),
    ...(field.shuffleOptions === undefined ? {} : { shuffleOptions: field.shuffleOptions })
  };
}

export function formSchemaToSurveyDefinition(
  schema: FormSchema,
  options?: FormSchemaToSurveyDefinitionOptions
): SurveyDefinition;
export function formSchemaToSurveyDefinition<
  TMetadata extends SurveyMetadata,
  TTranslationMetadata extends SurveyMetadata
>(
  schema: FormSchema,
  options?: TypedFormSchemaToSurveyDefinitionOptions<TMetadata, TTranslationMetadata>
): TypedSurveyDefinition<TMetadata, TTranslationMetadata>;
export function formSchemaToSurveyDefinition<
  TMetadata extends SurveyMetadata = SurveyMetadata,
  TTranslationMetadata extends SurveyMetadata = SurveyMetadata
>(
  schema: FormSchema,
  options: TypedFormSchemaToSurveyDefinitionOptions<TMetadata, TTranslationMetadata> = {}
): TypedSurveyDefinition<TMetadata, TTranslationMetadata> {
  const locale = schema.defaultLocale ?? schema.supportedLocales?.[0] ?? options.locale;
  if (locale === undefined) {
    throw new SurveyDefinitionConversionError(
      "locale",
      "A defaultLocale, supported locale, or fallback locale is required."
    );
  }
  assertNonEmptyString(locale, "locale");
  const metadata = decodeMetadata(schema.metadata, options.metadataCodec);
  const translationMetadata = decodeTranslationMetadata(schema.translationMetadata, options.translationMetadataCodec);
  const preserveLocaleConfig =
    schema.defaultLocale !== locale ||
    schema.supportedLocales === undefined ||
    schema.supportedLocales.length !== 1 ||
    schema.supportedLocales[0] !== locale;
  const result = {
    id: schema.id,
    version: schema.version,
    locale,
    ...(preserveLocaleConfig
      ? {
          ...(schema.defaultLocale === undefined ? {} : { defaultLocale: schema.defaultLocale }),
          ...(schema.supportedLocales === undefined ? {} : { supportedLocales: schema.supportedLocales })
        }
      : {}),
    title: schema.title,
    ...(schema.description === undefined ? {} : { description: schema.description }),
    ...(schema.completionMessage === undefined ? {} : { completionMessage: schema.completionMessage }),
    ...(schema.submitLabelKey === undefined ? {} : { submitLabelKey: schema.submitLabelKey }),
    ...(schema.translations === undefined ? {} : { translations: schema.translations }),
    ...(translationMetadata === undefined ? {} : { translationMetadata }),
    fields: schema.fields.map((field, index) =>
      fieldToQuestion(field, options.metadataCodec, options.translationMetadataCodec, `fields[${index}]`)
    )
  } as Omit<TypedSurveyDefinition<TMetadata, TTranslationMetadata>, "metadata" | "pages" | "submissionSettings"> & {
    metadata?: TMetadata;
    pages?: readonly TypedSurveyDefinitionPage<TMetadata, TTranslationMetadata>[];
    submissionSettings?: TypedSurveyDefinitionSubmissionSettings<TMetadata, TTranslationMetadata>;
  };
  if (metadata !== undefined) result.metadata = metadata;
  if (schema.pages !== undefined)
    result.pages = schema.pages.map((page) =>
      pageToDefinition(page, options.metadataCodec, options.translationMetadataCodec)
    );
  if (schema.submissionSettings !== undefined) {
    result.submissionSettings = submissionSettingsToDefinition(
      schema.submissionSettings,
      options.metadataCodec,
      options.translationMetadataCodec
    );
  }
  return result as TypedSurveyDefinition<TMetadata, TTranslationMetadata>;
}
