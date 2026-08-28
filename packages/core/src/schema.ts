import { collectSchemaLocales } from "./policy";
import { validateSchemaStructure } from "./sanitization";
import type {
  DisplayCondition,
  DisplayConditionGroup,
  DisplayRule,
  FieldOption,
  FormField,
  FormPolicy,
  FormSchema,
  SchemaIssue,
  SchemaValidationResult
} from "./types";

export interface ValidateFormSchemaOptions {
  readonly policy?: FormPolicy;
}

const FIELD_TYPES = new Set(["text", "textarea", "number", "rating", "select", "multi-select", "checkbox", "radio"]);
const CONDITION_OPERATORS = new Set([
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "is_empty",
  "is_not_empty",
  "greater_than",
  "less_than",
  "not_empty"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function issue(issues: SchemaIssue[], path: string, code: string, message: string): void {
  issues.push({ path, code, message });
}

function fieldConstraintIssue(
  issues: SchemaIssue[],
  field: FormField,
  fieldIndex: number,
  property: string,
  expected: boolean | number | readonly [number, number],
  message: string
): void {
  issues.push({
    path: `fields[${fieldIndex}].${property}`,
    code: "field_constraint_violation",
    type: "field_constraint_violation",
    message,
    fieldId: field.id,
    property,
    expected
  });
}

function validateJsonValue(value: unknown, path: string, issues: SchemaIssue[], ancestors = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) issue(issues, path, "invalid_metadata", "Metadata numbers must be finite.");
    return;
  }
  if (typeof value !== "object") {
    issue(issues, path, "invalid_metadata", "Expected JSON-serializable metadata.");
    return;
  }
  if (ancestors.has(value)) {
    issue(issues, path, "invalid_metadata", "Metadata must not contain cycles.");
    return;
  }
  const nextAncestors = new Set(ancestors).add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      validateJsonValue(item, `${path}[${index}]`, issues, nextAncestors);
    });
    return;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    issue(issues, path, "invalid_metadata", "Metadata objects must be plain JSON objects.");
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    validateJsonValue(item, `${path}.${key}`, issues, nextAncestors);
  }
}

function validateExtensibleNode(value: Record<string, unknown>, path: string, issues: SchemaIssue[]): void {
  for (const property of ["metadata", "translationMetadata"] as const) {
    const candidate = value[property];
    if (candidate === undefined) continue;
    if (!isRecord(candidate)) {
      issue(
        issues,
        path.length === 0 ? property : `${path}.${property}`,
        "invalid_metadata",
        "Expected a metadata object."
      );
      continue;
    }
    validateJsonValue(candidate, path.length === 0 ? property : `${path}.${property}`, issues);
  }
}

function validateLocalizedTextMap(value: unknown, path: string, issues: SchemaIssue[]): void {
  if (!isRecord(value)) {
    issue(issues, path, "invalid_translations", "Expected a locale-to-translation object.");
    return;
  }
  for (const [locale, translation] of Object.entries(value)) {
    if (!isNonEmptyString(locale) || !isRecord(translation)) {
      issue(issues, `${path}.${locale}`, "invalid_translation", "Expected a translation object.");
      continue;
    }
    for (const key of ["title", "description", "completionMessage"] as const) {
      if (translation[key] !== undefined && !isNonEmptyString(translation[key])) {
        issue(issues, `${path}.${locale}.${key}`, "invalid_translation", "Expected non-empty translated text.");
      }
    }
  }
}

function validateOptionTranslations(value: unknown, path: string, issues: SchemaIssue[]): void {
  if (!isRecord(value)) {
    issue(issues, path, "invalid_translations", "Expected a locale-to-label object.");
    return;
  }
  for (const [locale, label] of Object.entries(value)) {
    if (!isNonEmptyString(locale) || !isNonEmptyString(label)) {
      issue(issues, `${path}.${locale}`, "invalid_translation", "Expected a non-empty translated label.");
    }
  }
}

function rejectLegacyProperties(
  value: Record<string, unknown>,
  path: string,
  properties: readonly string[],
  issues: SchemaIssue[]
): void {
  for (const property of properties) {
    if (Object.hasOwn(value, property)) {
      issue(
        issues,
        path.length === 0 ? property : `${path}.${property}`,
        "legacy_property",
        `${property} is not supported by the natural-language schema.`
      );
    }
  }
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
    rejectLegacyProperties(option, optionPath, ["value", "labelKey"], issues);
    validateExtensibleNode(option, optionPath, issues);
    if (!isNonEmptyString(option.id)) {
      issue(issues, `${optionPath}.id`, "invalid_option_id", "Expected a non-empty option ID.");
    } else if (seen.has(option.id)) {
      issue(issues, `${optionPath}.id`, "duplicate_option", "Option IDs must be unique.");
    } else {
      seen.add(option.id);
    }
    if (!isNonEmptyString(option.label)) {
      issue(issues, `${optionPath}.label`, "invalid_label", "Expected a non-empty option label.");
    }
    if (option.translations !== undefined)
      validateOptionTranslations(option.translations, `${optionPath}.translations`, issues);
  });
  return true;
}

function validateDisplayCondition(value: unknown, path: string, issues: SchemaIssue[]): value is DisplayCondition {
  if (!isRecord(value)) {
    issue(issues, path, "invalid_condition", "Expected a display condition object.");
    return false;
  }
  if (!isNonEmptyString(value.questionId)) {
    issue(issues, `${path}.questionId`, "invalid_condition_source", "Expected a question ID.");
  }
  if (typeof value.operator !== "string" || !CONDITION_OPERATORS.has(value.operator)) {
    issue(issues, `${path}.operator`, "invalid_condition_operator", "Unsupported condition operator.");
    return false;
  }
  const hasValue = Object.hasOwn(value, "value") && value.value !== undefined;
  if (value.operator === "not_empty" || value.operator === "is_empty" || value.operator === "is_not_empty") {
    if (hasValue) issue(issues, `${path}.value`, "unexpected_condition_value", "not_empty does not accept a value.");
  } else if (!hasValue) {
    issue(issues, `${path}.value`, "missing_condition_value", `${value.operator} requires a value.`);
  } else if (!["string", "number", "boolean"].includes(typeof value.value)) {
    issue(issues, `${path}.value`, "invalid_condition_value", "Expected a string, number, or boolean.");
  } else if (typeof value.value === "number" && !Number.isFinite(value.value)) {
    issue(issues, `${path}.value`, "invalid_condition_value", "Expected a finite number.");
  }
  return true;
}

function validateDisplayConditionGroup(
  value: unknown,
  path: string,
  issues: SchemaIssue[]
): value is DisplayConditionGroup {
  if (!isRecord(value)) {
    issue(issues, path, "invalid_condition_group", "Expected a display condition group.");
    return false;
  }
  if (value.logic !== "all" && value.logic !== "any") {
    issue(issues, `${path}.logic`, "invalid_condition_logic", "Expected all or any.");
  }
  if (!Array.isArray(value.conditions)) {
    issue(issues, `${path}.conditions`, "invalid_condition_group", "Expected a conditions array.");
    return false;
  }
  value.conditions.forEach((condition, index) => {
    const conditionPath = `${path}.conditions[${index}]`;
    if (isRecord(condition) && Object.hasOwn(condition, "logic")) {
      validateDisplayConditionGroup(condition, conditionPath, issues);
      return;
    }
    if (!isRecord(condition)) {
      issue(issues, conditionPath, "invalid_condition", "Expected a field display condition.");
      return;
    }
    if (!isNonEmptyString(condition.fieldId)) {
      issue(issues, `${conditionPath}.fieldId`, "invalid_condition_source", "Expected a field ID.");
    }
    if (typeof condition.operator !== "string" || !CONDITION_OPERATORS.has(condition.operator)) {
      issue(issues, `${conditionPath}.operator`, "invalid_condition_operator", "Unsupported condition operator.");
      return;
    }
    const needsValue = !["not_empty", "is_empty", "is_not_empty"].includes(condition.operator);
    const hasValue = Object.hasOwn(condition, "value") && condition.value !== undefined;
    if (needsValue && !hasValue)
      issue(issues, `${conditionPath}.value`, "missing_condition_value", "A value is required.");
  });
  return true;
}

function validateDisplayRule(value: unknown, path: string, issues: SchemaIssue[]): value is DisplayRule {
  if (!isRecord(value)) {
    issue(issues, path, "invalid_display_rule", "Expected a display rule object.");
    return false;
  }
  if (value.action !== "show" && value.action !== "hide") {
    issue(issues, `${path}.action`, "invalid_display_action", "Expected show or hide.");
  }
  validateDisplayConditionGroup(value.condition, `${path}.condition`, issues);
  return true;
}

function validateSubmissionSettings(value: unknown, path: string, issues: SchemaIssue[]): void {
  if (!isRecord(value)) {
    issue(issues, path, "invalid_submission_settings", "Expected submission settings to be an object.");
    return;
  }
  validateExtensibleNode(value, path, issues);
  if (value.showConfirmationBeforeSubmit !== undefined && typeof value.showConfirmationBeforeSubmit !== "boolean") {
    issue(issues, `${path}.showConfirmationBeforeSubmit`, "invalid_submission_setting", "Expected a boolean.");
  }
  if (
    value.confirmationRenderMode !== undefined &&
    !["dialog", "inline", "replace"].includes(String(value.confirmationRenderMode))
  ) {
    issue(
      issues,
      `${path}.confirmationRenderMode`,
      "invalid_submission_setting",
      "Unsupported confirmation render mode."
    );
  }
  for (const key of ["confirmButtonLabel", "cancelButtonLabel"] as const) {
    if (value[key] !== undefined && !isNonEmptyString(value[key]))
      issue(issues, `${path}.${key}`, "invalid_submission_setting", "Expected non-empty text.");
  }
}

function validateField(value: unknown, path: string, issues: SchemaIssue[]): value is FormField {
  if (!isRecord(value)) {
    issue(issues, path, "invalid_field", "Expected a field object.");
    return false;
  }
  rejectLegacyProperties(value, path, ["titleKey", "labelKey", "helpTextKey", "descriptionKey"], issues);
  validateExtensibleNode(value, path, issues);
  if (!isNonEmptyString(value.id)) issue(issues, `${path}.id`, "invalid_id", "Expected a non-empty ID.");
  if (!isNonEmptyString(value.title)) {
    issue(issues, `${path}.title`, "invalid_title", "Expected a non-empty question title.");
  }
  if (value.description !== undefined && !isNonEmptyString(value.description)) {
    issue(issues, `${path}.description`, "invalid_description", "Expected a non-empty question description.");
  }
  if (value.translationKey !== undefined && !isNonEmptyString(value.translationKey)) {
    issue(issues, `${path}.translationKey`, "invalid_translation_key", "Expected a translation key.");
  }
  if (typeof value.required !== "boolean") {
    issue(issues, `${path}.required`, "invalid_required", "Expected a boolean.");
  }
  if (value.displayCondition !== undefined) {
    validateDisplayCondition(value.displayCondition, `${path}.displayCondition`, issues);
  }
  if (value.displayRule !== undefined) validateDisplayRule(value.displayRule, `${path}.displayRule`, issues);
  if (value.translations !== undefined) validateLocalizedTextMap(value.translations, `${path}.translations`, issues);
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

  if (value.type === "rating") {
    for (const key of ["min", "max"] as const) {
      const bound = value[key];
      if (bound !== undefined && (!Number.isInteger(bound) || !Number.isFinite(bound))) {
        issue(issues, `${path}.${key}`, "invalid_bound", "Expected a finite integer.");
      }
    }
    const min = typeof value.min === "number" ? value.min : 1;
    const max = typeof value.max === "number" ? value.max : 5;
    if (min > max) issue(issues, path, "contradictory_bounds", "min cannot exceed max.");
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

interface TextEntry {
  readonly path: string;
  readonly value: string;
}

function collectSchemaText(schema: FormSchema): readonly TextEntry[] {
  const entries: TextEntry[] = [{ path: "title", value: schema.title }];
  if (schema.description !== undefined) entries.push({ path: "description", value: schema.description });
  if (schema.completionMessage !== undefined)
    entries.push({ path: "completionMessage", value: schema.completionMessage });
  for (const [locale, translation] of Object.entries(schema.translations ?? {})) {
    for (const property of ["title", "description", "completionMessage"] as const) {
      const value = translation[property];
      if (value !== undefined) entries.push({ path: `translations.${locale}.${property}`, value });
    }
  }
  schema.fields.forEach((field, fieldIndex) => {
    entries.push({ path: `fields[${fieldIndex}].title`, value: field.title });
    if (field.description !== undefined)
      entries.push({ path: `fields[${fieldIndex}].description`, value: field.description });
    for (const [locale, translation] of Object.entries(field.translations ?? {})) {
      for (const property of ["title", "description"] as const) {
        const value = translation[property];
        if (value !== undefined)
          entries.push({ path: `fields[${fieldIndex}].translations.${locale}.${property}`, value });
      }
    }
    if (!("options" in field)) return;
    field.options.forEach((option, optionIndex) => {
      entries.push({ path: `fields[${fieldIndex}].options[${optionIndex}].label`, value: option.label });
      for (const [locale, value] of Object.entries(option.translations ?? {})) {
        entries.push({ path: `fields[${fieldIndex}].options[${optionIndex}].translations.${locale}`, value });
      }
    });
  });
  schema.pages?.forEach((page, pageIndex) => {
    if (page.title !== undefined) entries.push({ path: `pages[${pageIndex}].title`, value: page.title });
    if (page.description !== undefined)
      entries.push({ path: `pages[${pageIndex}].description`, value: page.description });
    for (const [locale, translation] of Object.entries(page.translations ?? {})) {
      for (const property of ["title", "description"] as const) {
        const value = translation[property];
        if (value !== undefined)
          entries.push({ path: `pages[${pageIndex}].translations.${locale}.${property}`, value });
      }
    }
  });
  return entries;
}

function addRequiredTranslationIssues(schema: FormSchema, locale: string, issues: SchemaIssue[]): void {
  if (!(schema.supportedLocales ?? []).includes(locale)) {
    issue(issues, "supportedLocales", "required_locale_missing", `Required locale ${locale} is missing.`);
  }
  if (locale === schema.defaultLocale) return;
  const required: Array<{ readonly path: string; readonly value: string | undefined }> = [
    { path: `translations.${locale}.title`, value: schema.translations?.[locale]?.title }
  ];
  if (schema.description !== undefined)
    required.push({ path: `translations.${locale}.description`, value: schema.translations?.[locale]?.description });
  if (schema.completionMessage !== undefined) {
    required.push({
      path: `translations.${locale}.completionMessage`,
      value: schema.translations?.[locale]?.completionMessage
    });
  }
  schema.fields.forEach((field, fieldIndex) => {
    required.push({
      path: `fields[${fieldIndex}].translations.${locale}.title`,
      value: field.translations?.[locale]?.title
    });
    if (field.description !== undefined) {
      required.push({
        path: `fields[${fieldIndex}].translations.${locale}.description`,
        value: field.translations?.[locale]?.description
      });
    }
    if (!("options" in field)) return;
    field.options.forEach((option, optionIndex) => {
      required.push({
        path: `fields[${fieldIndex}].options[${optionIndex}].translations.${locale}`,
        value: option.translations?.[locale]
      });
    });
  });
  schema.pages?.forEach((page, pageIndex) => {
    if (page.title !== undefined) {
      required.push({
        path: `pages[${pageIndex}].translations.${locale}.title`,
        value: page.translations?.[locale]?.title
      });
    }
    if (page.description !== undefined) {
      required.push({
        path: `pages[${pageIndex}].translations.${locale}.description`,
        value: page.translations?.[locale]?.description
      });
    }
  });
  for (const translation of required) {
    if (translation.value === undefined || translation.value.trim().length === 0) {
      issue(
        issues,
        translation.path,
        "required_translation_missing",
        `A translation for required locale ${locale} is missing.`
      );
    }
  }
}

function validatePolicy(schema: FormSchema, policy: FormPolicy, issues: SchemaIssue[]): void {
  if (policy.maxFields !== undefined && schema.fields.length > policy.maxFields) {
    issue(issues, "fields", "max_fields_exceeded", `At most ${policy.maxFields} fields are allowed.`);
  }
  schema.fields.forEach((field, fieldIndex) => {
    if (policy.allowedFieldTypes !== undefined && !policy.allowedFieldTypes.includes(field.type)) {
      issue(issues, `fields[${fieldIndex}].type`, "disallowed_field_type", `Field type ${field.type} is not allowed.`);
    }
    if (
      policy.maxOptionsPerField !== undefined &&
      "options" in field &&
      field.options.length > policy.maxOptionsPerField
    ) {
      issue(
        issues,
        `fields[${fieldIndex}].options`,
        "max_options_exceeded",
        `At most ${policy.maxOptionsPerField} options are allowed.`
      );
    }

    const constraint = policy.fieldConstraints?.[field.type];
    if (constraint === undefined) return;
    if (constraint.fixedRequired !== undefined && field.required !== constraint.fixedRequired) {
      fieldConstraintIssue(
        issues,
        field,
        fieldIndex,
        "required",
        constraint.fixedRequired,
        `Field required must be ${String(constraint.fixedRequired)} for field type ${field.type}.`
      );
    }
    if (field.type === "rating") {
      const ratingConstraint =
        "fixedMin" in constraint ||
        "fixedMax" in constraint ||
        "allowedMinRange" in constraint ||
        "allowedMaxRange" in constraint
          ? constraint
          : undefined;
      if (ratingConstraint?.fixedMin !== undefined && field.min !== ratingConstraint.fixedMin) {
        fieldConstraintIssue(
          issues,
          field,
          fieldIndex,
          "min",
          ratingConstraint.fixedMin,
          `Rating minimum must be ${ratingConstraint.fixedMin}.`
        );
      }
      if (
        ratingConstraint !== undefined &&
        "fixedMax" in ratingConstraint &&
        ratingConstraint.fixedMax !== undefined &&
        field.max !== ratingConstraint.fixedMax
      ) {
        fieldConstraintIssue(
          issues,
          field,
          fieldIndex,
          "max",
          ratingConstraint.fixedMax,
          `Rating maximum must be ${ratingConstraint.fixedMax}.`
        );
      }
      if (
        ratingConstraint !== undefined &&
        "allowedMinRange" in ratingConstraint &&
        ratingConstraint.allowedMinRange !== undefined &&
        typeof field.min === "number" &&
        (field.min < ratingConstraint.allowedMinRange[0] || field.min > ratingConstraint.allowedMinRange[1])
      ) {
        fieldConstraintIssue(
          issues,
          field,
          fieldIndex,
          "min",
          ratingConstraint.allowedMinRange,
          `Rating minimum must be between ${ratingConstraint.allowedMinRange[0]} and ${ratingConstraint.allowedMinRange[1]}.`
        );
      }
      if (
        ratingConstraint !== undefined &&
        "allowedMaxRange" in ratingConstraint &&
        ratingConstraint.allowedMaxRange !== undefined &&
        typeof field.max === "number" &&
        (field.max < ratingConstraint.allowedMaxRange[0] || field.max > ratingConstraint.allowedMaxRange[1])
      ) {
        fieldConstraintIssue(
          issues,
          field,
          fieldIndex,
          "max",
          ratingConstraint.allowedMaxRange,
          `Rating maximum must be between ${ratingConstraint.allowedMaxRange[0]} and ${ratingConstraint.allowedMaxRange[1]}.`
        );
      }
    }
    if (
      (field.type === "text" || field.type === "textarea") &&
      "maxMaxLength" in constraint &&
      constraint.maxMaxLength !== undefined
    ) {
      if (field.maxLength !== undefined && field.maxLength > constraint.maxMaxLength) {
        fieldConstraintIssue(
          issues,
          field,
          fieldIndex,
          "maxLength",
          constraint.maxMaxLength,
          `Maximum text length must be at most ${constraint.maxMaxLength}.`
        );
      }
    }
    if (
      (field.type === "select" || field.type === "radio" || field.type === "multi-select") &&
      "minOptions" in constraint &&
      constraint.minOptions !== undefined &&
      field.options.length < constraint.minOptions
    ) {
      fieldConstraintIssue(
        issues,
        field,
        fieldIndex,
        "options",
        constraint.minOptions,
        `At least ${constraint.minOptions} options are required.`
      );
    }
    if (
      (field.type === "select" || field.type === "radio" || field.type === "multi-select") &&
      "maxOptions" in constraint &&
      constraint.maxOptions !== undefined &&
      field.options.length > constraint.maxOptions
    ) {
      fieldConstraintIssue(
        issues,
        field,
        fieldIndex,
        "options",
        constraint.maxOptions,
        `At most ${constraint.maxOptions} options are allowed.`
      );
    }
  });
  if (policy.maxTextLength !== undefined) {
    for (const entry of collectSchemaText(schema)) {
      if (entry.value.length > policy.maxTextLength) {
        issue(
          issues,
          entry.path,
          "max_text_length_exceeded",
          `Text must be at most ${policy.maxTextLength} characters.`
        );
      }
    }
  }
  const collectedLocales = collectSchemaLocales(schema);
  const registeredLocales = new Set([
    ...(schema.defaultLocale === undefined ? [] : [schema.defaultLocale]),
    ...(schema.supportedLocales ?? [])
  ]);
  for (const locale of collectedLocales.translationLocales) {
    if (registeredLocales.has(locale)) continue;
    for (const path of collectedLocales.translationLocalePaths.get(locale) ?? []) {
      issue(
        issues,
        path,
        "unregistered_translation_locale",
        `Translation locale ${locale} is not registered by defaultLocale or supportedLocales.`
      );
    }
  }
  if (policy.allowedLocales !== undefined) {
    const pathsByLocale = new Map<string, string[]>();
    if (schema.defaultLocale !== undefined) pathsByLocale.set(schema.defaultLocale, ["defaultLocale"]);
    schema.supportedLocales?.forEach((locale, index) => {
      pathsByLocale.set(locale, [...(pathsByLocale.get(locale) ?? []), `supportedLocales[${index}]`]);
    });
    for (const [locale, paths] of collectedLocales.translationLocalePaths) {
      pathsByLocale.set(locale, [...(pathsByLocale.get(locale) ?? []), ...paths]);
    }
    for (const [locale, paths] of pathsByLocale) {
      if (!policy.allowedLocales.includes(locale)) {
        for (const path of paths) {
          issue(issues, path, "disallowed_locale", `Locale ${locale} is not allowed by the form policy.`);
        }
      }
    }
    for (const locale of policy.requiredLocales ?? []) {
      if (!policy.allowedLocales.includes(locale)) {
        issue(
          issues,
          "policy.requiredLocales",
          "required_locale_not_allowed",
          `Required locale ${locale} is not included in allowedLocales.`
        );
      }
    }
  }
  if (policy.maxLocales !== undefined && collectedLocales.allUniqueLocales.size > policy.maxLocales) {
    issue(issues, "supportedLocales", "max_locales_exceeded", `At most ${policy.maxLocales} locales are allowed.`);
  }
  for (const locale of policy.requiredLocales ?? []) addRequiredTranslationIssues(schema, locale, issues);
  if (policy.maxSchemaBytes !== undefined) {
    try {
      const byteLength = new TextEncoder().encode(JSON.stringify(schema)).byteLength;
      if (byteLength > policy.maxSchemaBytes) {
        issue(issues, "$", "max_schema_bytes_exceeded", `Schema must be at most ${policy.maxSchemaBytes} bytes.`);
      }
    } catch {
      // Structural validation reports non-serializable schema values separately.
    }
  }
}

export function validateFormSchema(input: unknown, options: ValidateFormSchemaOptions = {}): SchemaValidationResult {
  const issues: SchemaIssue[] = [];
  if (!isRecord(input)) {
    return { valid: false, issues: [{ path: "$", code: "invalid_schema", message: "Expected a schema object." }] };
  }
  rejectLegacyProperties(input, "", ["titleKey", "descriptionKey"], issues);
  validateExtensibleNode(input, "", issues);
  if (!isNonEmptyString(input.id)) issue(issues, "id", "invalid_id", "Expected a non-empty ID.");
  if (!Number.isInteger(input.version) || (input.version as number) < 1) {
    issue(issues, "version", "invalid_version", "Expected a positive integer version.");
  }
  if (!isNonEmptyString(input.title)) {
    issue(issues, "title", "invalid_title", "Expected a non-empty form title.");
  }
  for (const key of ["description", "completionMessage", "submitLabelKey"] as const) {
    if (input[key] !== undefined && !isNonEmptyString(input[key])) {
      issue(
        issues,
        key,
        key === "submitLabelKey" ? "invalid_translation_key" : "invalid_description",
        key === "submitLabelKey" ? "Expected a translation key." : "Expected non-empty form text."
      );
    }
  }
  if (input.defaultLocale !== undefined && !isNonEmptyString(input.defaultLocale)) {
    issue(issues, "defaultLocale", "invalid_locale", "Expected a non-empty default locale.");
  }
  if (input.supportedLocales !== undefined) {
    if (!Array.isArray(input.supportedLocales) || input.supportedLocales.length === 0) {
      issue(issues, "supportedLocales", "invalid_locales", "Expected at least one supported locale.");
    } else {
      const locales = new Set<string>();
      input.supportedLocales.forEach((locale, index) => {
        if (!isNonEmptyString(locale)) {
          issue(issues, `supportedLocales[${index}]`, "invalid_locale", "Expected a non-empty locale.");
        } else if (locales.has(locale)) {
          issue(issues, `supportedLocales[${index}]`, "duplicate_locale", "Locales must be unique.");
        } else {
          locales.add(locale);
        }
      });
    }
  }
  if (input.translations !== undefined) validateLocalizedTextMap(input.translations, "translations", issues);
  if (input.submissionSettings !== undefined)
    validateSubmissionSettings(input.submissionSettings, "submissionSettings", issues);
  if (!Array.isArray(input.fields) || input.fields.length === 0) {
    issue(issues, "fields", "invalid_fields", "Expected at least one field.");
  } else {
    const inputFields = input.fields;
    const ids = new Set<string>();
    inputFields.forEach((field, index) => {
      validateField(field, `fields[${index}]`, issues);
      if (isRecord(field) && isNonEmptyString(field.id)) {
        if (ids.has(field.id)) issue(issues, `fields[${index}].id`, "duplicate_field", "Field IDs must be unique.");
        ids.add(field.id);
      }
    });
    const structuralSchema = {
      id: typeof input.id === "string" ? input.id : "invalid",
      version: typeof input.version === "number" ? input.version : 1,
      title: typeof input.title === "string" ? input.title : "invalid",
      fields: inputFields.filter((field): field is FormField => isRecord(field) && isNonEmptyString(field.id))
    } as FormSchema;
    for (const structuralIssue of validateSchemaStructure(structuralSchema)) {
      if (
        structuralIssue.type !== "dangling_condition_reference" &&
        structuralIssue.type !== "self_condition_reference" &&
        structuralIssue.type !== "cyclic_condition_reference"
      ) {
        continue;
      }
      const fieldIndex = inputFields.findIndex((field) => isRecord(field) && field.id === structuralIssue.questionId);
      const currentField = inputFields[fieldIndex];
      const usesDisplayRule = isRecord(currentField) && currentField.displayRule !== undefined;
      const code =
        structuralIssue.type === "dangling_condition_reference"
          ? "unknown_condition_source"
          : structuralIssue.type === "self_condition_reference"
            ? "self_condition"
            : usesDisplayRule
              ? "circular_display_condition"
              : "condition_cycle";
      const path = usesDisplayRule ? `fields[${fieldIndex}].displayRule` : `fields[${fieldIndex}].displayCondition`;
      if (usesDisplayRule && structuralIssue.type === "cyclic_condition_reference") {
        issues.push({
          path,
          code,
          type: code,
          message: structuralIssue.message,
          ...(structuralIssue.cycle === undefined ? {} : { cycle: structuralIssue.cycle })
        });
      } else issue(issues, path, code, structuralIssue.message);
    }

    if (input.pages !== undefined) {
      if (!Array.isArray(input.pages) || input.pages.length === 0) {
        issue(issues, "pages", "invalid_pages", "Expected at least one page when pages is defined.");
      } else {
        const pageIds = new Set<string>();
        const assigned = new Map<string, number>();
        input.pages.forEach((page, pageIndex) => {
          const pagePath = `pages[${pageIndex}]`;
          if (!isRecord(page)) {
            issue(issues, pagePath, "invalid_page", "Expected a page object.");
            return;
          }
          validateExtensibleNode(page, pagePath, issues);
          if (!isNonEmptyString(page.id)) {
            issue(issues, `${pagePath}.id`, "invalid_page_id", "Expected a non-empty page ID.");
          } else if (pageIds.has(page.id)) {
            issue(issues, `${pagePath}.id`, "duplicate_page", "Page IDs must be unique.");
          } else {
            pageIds.add(page.id);
          }
          for (const key of ["title", "description"] as const) {
            if (page[key] !== undefined && !isNonEmptyString(page[key])) {
              issue(issues, `${pagePath}.${key}`, "invalid_page_text", "Expected non-empty page text.");
            }
          }
          if (page.translations !== undefined) {
            validateLocalizedTextMap(page.translations, `${pagePath}.translations`, issues);
          }
          if (page.displayCondition !== undefined) {
            validateDisplayCondition(page.displayCondition, `${pagePath}.displayCondition`, issues);
          }
          if (!Array.isArray(page.questionIds) || page.questionIds.length === 0) {
            issue(issues, `${pagePath}.questionIds`, "invalid_page_questions", "Expected at least one question ID.");
            return;
          }
          page.questionIds.forEach((questionId, questionIndex) => {
            const questionPath = `${pagePath}.questionIds[${questionIndex}]`;
            if (!isNonEmptyString(questionId)) {
              issue(issues, questionPath, "invalid_question_reference", "Expected a question ID.");
            } else if (!ids.has(questionId)) {
              issue(issues, questionPath, "unknown_page_question", "Page references an unknown question.");
            } else if (assigned.has(questionId)) {
              issue(issues, questionPath, "duplicate_page_question", "A question may belong to only one page.");
            } else {
              assigned.set(questionId, pageIndex);
            }
          });
        });
        for (const fieldId of ids) {
          if (!assigned.has(fieldId))
            issue(issues, "pages", "unassigned_page_question", `Question ${fieldId} has no page.`);
        }
        input.pages.forEach((page, pageIndex) => {
          if (!isRecord(page) || !isRecord(page.displayCondition)) return;
          const sourceId = page.displayCondition.questionId;
          if (typeof sourceId !== "string") return;
          const sourcePageIndex = assigned.get(sourceId);
          if (sourcePageIndex === undefined) {
            issue(
              issues,
              `pages[${pageIndex}].displayCondition.questionId`,
              "unknown_page_condition_source",
              "Page condition references an unknown question."
            );
          } else if (sourcePageIndex >= pageIndex) {
            issue(
              issues,
              `pages[${pageIndex}].displayCondition.questionId`,
              "forward_page_condition",
              "Page conditions must reference a question on an earlier page."
            );
          }
        });
      }
    }
  }
  if (Array.isArray(input.fields)) {
    const policyIssues: SchemaIssue[] = [];
    try {
      validatePolicy(input as unknown as FormSchema, options.policy ?? {}, policyIssues);
      issues.push(...policyIssues);
    } catch {
      // Unsafe shapes are already described by structural issues above.
    }
  }
  return issues.length === 0
    ? { valid: true, value: input as unknown as FormSchema, issues: [] }
    : { valid: false, issues };
}

export function assertValidFormSchema(input: unknown): asserts input is FormSchema {
  const result = validateFormSchema(input);
  if (!result.valid) {
    throw new TypeError(
      `Invalid form schema: ${result.issues.map((item) => `${item.path}: ${item.message}`).join("; ")}`
    );
  }
}
