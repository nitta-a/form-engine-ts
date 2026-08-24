import {
  type FieldOption,
  type FieldType,
  type FormField,
  type FormPage,
  type FormSchema,
  type SchemaIssue,
  validateFormSchema
} from "@form-engine-ts/core";
import { useCallback, useMemo } from "react";

export interface BuilderPolicy {
  readonly allowedFieldTypes?: readonly FieldType[];
  readonly maxFields?: number;
  readonly maxOptionsPerField?: number;
  readonly maxTextLength?: number;
  readonly requiredLocales?: readonly string[];
}

export interface FormBuilderOptions {
  readonly schema: FormSchema;
  readonly onChange: (schema: FormSchema) => void;
  readonly policy?: BuilderPolicy;
  readonly idFactory?: (kind: "field" | "option" | "page", existingIds: ReadonlySet<string>) => string;
}

export type BuilderActionError =
  | { readonly type: "max_fields_exceeded"; readonly max: number }
  | { readonly type: "max_options_exceeded"; readonly max: number }
  | { readonly type: "disallowed_field_type"; readonly fieldType: FieldType }
  | { readonly type: "invalid_operation"; readonly message: string };

export interface BuilderActionResult {
  readonly success: boolean;
  readonly error?: BuilderActionError;
}

export interface FormBuilderResult {
  readonly schema: FormSchema;
  readonly addField: (type: FieldType, pageId?: string) => BuilderActionResult;
  readonly removeField: (fieldId: string) => void;
  readonly moveField: (fieldId: string, targetIndex: number) => void;
  readonly updateField: (fieldId: string, updater: (field: FormField) => FormField) => void;
  readonly addOption: (fieldId: string) => BuilderActionResult;
  readonly removeOption: (fieldId: string, optionId: string) => void;
  readonly moveOption: (fieldId: string, optionId: string, targetIndex: number) => void;
  readonly addPage: (questionId?: string) => void;
  readonly removePage: (pageId: string) => void;
  readonly setLocaleTranslation: (locale: string, target: "form" | string, property: string, text: string) => void;
  readonly validationIssues: readonly SchemaIssue[];
}

const DEFAULT_PREFIXES = { field: "q", option: "opt", page: "page" } as const;

function defaultIdFactory(kind: keyof typeof DEFAULT_PREFIXES, existingIds: ReadonlySet<string>): string {
  const prefix = DEFAULT_PREFIXES[kind];
  let id: string;
  do {
    id = `${prefix}_${globalThis.crypto.randomUUID().slice(0, 8)}`;
  } while (existingIds.has(id));
  return id;
}

function newField(type: FieldType, id: string, optionId?: string): FormField | undefined {
  const base = { id, title: "New question", required: false } as const;
  if (type === "text" || type === "textarea") return { ...base, type };
  if (type === "number") return { ...base, type };
  if (type === "rating") return { ...base, type, min: 1, max: 5 };
  if (type === "checkbox") return { ...base, type };
  return optionId === undefined ? undefined : { ...base, type, options: [{ id: optionId, label: "Option 1" }] };
}

function move<T>(items: readonly T[], sourceIndex: number, targetIndex: number): readonly T[] | undefined {
  if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= items.length || sourceIndex === targetIndex)
    return undefined;
  const result = [...items];
  const [item] = result.splice(sourceIndex, 1);
  if (item === undefined) return undefined;
  result.splice(targetIndex, 0, item);
  return result;
}

function addPolicyIssues(schema: FormSchema, policy: BuilderPolicy | undefined, issues: SchemaIssue[]): void {
  if (policy?.maxFields !== undefined && schema.fields.length > policy.maxFields) {
    issues.push({
      path: "fields",
      code: "max_fields_exceeded",
      message: `At most ${policy.maxFields} fields are allowed.`
    });
  }
  schema.fields.forEach((field, index) => {
    if (policy?.allowedFieldTypes !== undefined && !policy.allowedFieldTypes.includes(field.type)) {
      issues.push({
        path: `fields[${index}].type`,
        code: "disallowed_field_type",
        message: `Field type ${field.type} is not allowed.`
      });
    }
    if (policy?.maxTextLength !== undefined) {
      for (const [property, text] of [
        ["title", field.title],
        ["description", field.description]
      ] as const) {
        if (text !== undefined && text.length > policy.maxTextLength) {
          issues.push({
            path: `fields[${index}].${property}`,
            code: "max_text_length_exceeded",
            message: `Text must be at most ${policy.maxTextLength} characters.`
          });
        }
      }
    }
    if (
      policy?.maxOptionsPerField !== undefined &&
      "options" in field &&
      field.options.length > policy.maxOptionsPerField
    ) {
      issues.push({
        path: `fields[${index}].options`,
        code: "max_options_exceeded",
        message: `At most ${policy.maxOptionsPerField} options are allowed.`
      });
    }
  });
  for (const locale of policy?.requiredLocales ?? []) {
    if (!(schema.supportedLocales ?? []).includes(locale)) {
      issues.push({
        path: "supportedLocales",
        code: "required_locale_missing",
        message: `Required locale ${locale} is missing.`
      });
    }
    if (locale === schema.defaultLocale) continue;
    const requiredTranslations: Array<{ path: string; value: string | undefined }> = [
      { path: `translations.${locale}.title`, value: schema.translations?.[locale]?.title },
      ...schema.fields.map((field, index) => ({
        path: `fields[${index}].translations.${locale}.title`,
        value: field.translations?.[locale]?.title
      })),
      ...schema.fields.flatMap((field, fieldIndex) =>
        "options" in field
          ? field.options.map((option, optionIndex) => ({
              path: `fields[${fieldIndex}].options[${optionIndex}].translations.${locale}`,
              value: option.translations?.[locale]
            }))
          : []
      ),
      ...(schema.pages?.flatMap((page, pageIndex) =>
        page.title === undefined
          ? []
          : [{ path: `pages[${pageIndex}].translations.${locale}.title`, value: page.translations?.[locale]?.title }]
      ) ?? [])
    ];
    for (const translation of requiredTranslations) {
      if (translation.value === undefined || translation.value.trim().length === 0) {
        issues.push({
          path: translation.path,
          code: "required_translation_missing",
          message: `A translation for required locale ${locale} is missing.`
        });
      }
    }
  }
}

export function useFormBuilder({
  schema,
  onChange,
  policy,
  idFactory = defaultIdFactory
}: FormBuilderOptions): FormBuilderResult {
  const createId = useCallback(
    (kind: "field" | "option" | "page", existingIds: ReadonlySet<string>): string | undefined => {
      const id = idFactory(kind, existingIds).trim();
      return id.length > 0 && !existingIds.has(id) ? id : undefined;
    },
    [idFactory]
  );

  const addField = useCallback(
    (type: FieldType, pageId?: string): BuilderActionResult => {
      if (policy?.allowedFieldTypes !== undefined && !policy.allowedFieldTypes.includes(type)) {
        return { success: false, error: { type: "disallowed_field_type", fieldType: type } };
      }
      if (policy?.maxFields !== undefined && schema.fields.length >= policy.maxFields) {
        return { success: false, error: { type: "max_fields_exceeded", max: policy.maxFields } };
      }
      const fieldId = createId("field", new Set(schema.fields.map((field) => field.id)));
      const needsOption = ["select", "radio", "multi-select"].includes(type);
      const optionId = needsOption
        ? createId(
            "option",
            new Set(
              schema.fields.flatMap((field) => ("options" in field ? field.options.map((option) => option.id) : []))
            )
          )
        : undefined;
      if (fieldId === undefined || (needsOption && optionId === undefined)) {
        return {
          success: false,
          error: { type: "invalid_operation", message: "idFactory returned a duplicate or empty ID." }
        };
      }
      const field = newField(type, fieldId, optionId);
      if (field === undefined) {
        return { success: false, error: { type: "invalid_operation", message: "Could not create the field." } };
      }
      const pages = schema.pages?.map((page, index) => ({
        ...page,
        questionIds:
          page.id === pageId || (pageId === undefined && index === (schema.pages?.length ?? 0) - 1)
            ? [...page.questionIds, fieldId]
            : page.questionIds
      }));
      if (schema.pages !== undefined && !schema.pages.some((page) => page.id === pageId) && pageId !== undefined) {
        return { success: false, error: { type: "invalid_operation", message: `Unknown page: ${pageId}` } };
      }
      onChange({ ...schema, fields: [...schema.fields, field], ...(pages === undefined ? {} : { pages }) });
      return { success: true };
    },
    [createId, onChange, policy, schema]
  );

  const removeField = useCallback(
    (fieldId: string) => {
      if (schema.fields.length <= 1 || !schema.fields.some((field) => field.id === fieldId)) return;
      const fields = schema.fields
        .filter((field) => field.id !== fieldId)
        .map((field) =>
          field.displayCondition?.questionId === fieldId
            ? (({ displayCondition: _condition, ...candidate }) => candidate)(field)
            : field
        ) as readonly FormField[];
      const remainingPages = schema.pages
        ?.map((page) => ({ ...page, questionIds: page.questionIds.filter((id) => id !== fieldId) }))
        .filter((page) => page.questionIds.length > 0);
      if (schema.pages !== undefined && remainingPages?.length === 0) {
        const { pages: _pages, ...singlePageSchema } = schema;
        onChange({ ...singlePageSchema, fields });
      } else {
        onChange({ ...schema, fields, ...(remainingPages === undefined ? {} : { pages: remainingPages }) });
      }
    },
    [onChange, schema]
  );

  const moveField = useCallback(
    (fieldId: string, targetIndex: number) => {
      const fields = move(
        schema.fields,
        schema.fields.findIndex((field) => field.id === fieldId),
        targetIndex
      );
      if (fields !== undefined) {
        const indexById = new Map(fields.map((field, index) => [field.id, index]));
        const safeFields = fields.map((field, index): FormField => {
          const sourceIndex =
            field.displayCondition === undefined ? undefined : indexById.get(field.displayCondition.questionId);
          if (field.displayCondition === undefined || (sourceIndex !== undefined && sourceIndex < index)) return field;
          const { displayCondition: _condition, ...withoutCondition } = field;
          return withoutCondition as FormField;
        });
        onChange({ ...schema, fields: safeFields });
      }
    },
    [onChange, schema]
  );

  const updateField = useCallback(
    (fieldId: string, updater: (field: FormField) => FormField) => {
      const current = schema.fields.find((field) => field.id === fieldId);
      if (current === undefined) return;
      const updated = updater(current);
      if (updated.id !== fieldId) return;
      if (policy?.allowedFieldTypes !== undefined && !policy.allowedFieldTypes.includes(updated.type)) return;
      const maxTextLength = policy?.maxTextLength;
      if (
        maxTextLength !== undefined &&
        [updated.title, updated.description].some((text) => text !== undefined && text.length > maxTextLength)
      ) {
        return;
      }
      onChange({ ...schema, fields: schema.fields.map((field) => (field.id === fieldId ? updated : field)) });
    },
    [onChange, policy, schema]
  );

  const addOption = useCallback(
    (fieldId: string): BuilderActionResult => {
      const field = schema.fields.find((candidate) => candidate.id === fieldId);
      if (field === undefined || !("options" in field)) {
        return { success: false, error: { type: "invalid_operation", message: `Field ${fieldId} has no options.` } };
      }
      if (policy?.maxOptionsPerField !== undefined && field.options.length >= policy.maxOptionsPerField) {
        return { success: false, error: { type: "max_options_exceeded", max: policy.maxOptionsPerField } };
      }
      const existingIds = new Set(
        schema.fields.flatMap((candidate) =>
          "options" in candidate ? candidate.options.map((option) => option.id) : []
        )
      );
      const optionId = createId("option", existingIds);
      if (optionId === undefined) {
        return {
          success: false,
          error: { type: "invalid_operation", message: "idFactory returned a duplicate or empty ID." }
        };
      }
      const option: FieldOption = { id: optionId, label: `Option ${field.options.length + 1}` };
      onChange({
        ...schema,
        fields: schema.fields.map((candidate) =>
          candidate.id === fieldId && "options" in candidate
            ? ({ ...candidate, options: [...candidate.options, option] } as FormField)
            : candidate
        )
      });
      return { success: true };
    },
    [createId, onChange, policy, schema]
  );

  const removeOption = useCallback(
    (fieldId: string, optionId: string) => {
      const field = schema.fields.find((candidate) => candidate.id === fieldId);
      if (field === undefined || !("options" in field) || field.options.length <= 1) return;
      onChange({
        ...schema,
        fields: schema.fields.map((candidate) =>
          candidate.id === fieldId && "options" in candidate
            ? ({ ...candidate, options: candidate.options.filter((option) => option.id !== optionId) } as FormField)
            : candidate
        )
      });
    },
    [onChange, schema]
  );

  const moveOption = useCallback(
    (fieldId: string, optionId: string, targetIndex: number) => {
      const field = schema.fields.find((candidate) => candidate.id === fieldId);
      if (field === undefined || !("options" in field)) return;
      const options = move(
        field.options,
        field.options.findIndex((option) => option.id === optionId),
        targetIndex
      );
      if (options === undefined) return;
      onChange({
        ...schema,
        fields: schema.fields.map((candidate) =>
          candidate.id === fieldId && "options" in candidate ? ({ ...candidate, options } as FormField) : candidate
        )
      });
    },
    [onChange, schema]
  );

  const addPage = useCallback(
    (questionId?: string) => {
      const existingIds = new Set(schema.pages?.map((page) => page.id) ?? []);
      const pageId = createId("page", existingIds);
      if (pageId === undefined) return;
      if (schema.pages === undefined) {
        onChange({ ...schema, pages: [{ id: pageId, questionIds: schema.fields.map((field) => field.id) }] });
        return;
      }
      const movableQuestionId =
        questionId ?? schema.pages.find((page) => page.questionIds.length > 1)?.questionIds.at(-1);
      if (movableQuestionId === undefined) return;
      const sourcePage = schema.pages.find((page) => page.questionIds.includes(movableQuestionId));
      if (sourcePage === undefined || sourcePage.questionIds.length <= 1) return;
      const pages: readonly FormPage[] = [
        ...schema.pages.map((page) => ({
          ...page,
          questionIds: page.questionIds.filter((id) => id !== movableQuestionId)
        })),
        { id: pageId, questionIds: [movableQuestionId] }
      ];
      onChange({ ...schema, pages });
    },
    [createId, onChange, schema]
  );

  const removePage = useCallback(
    (pageId: string) => {
      if (schema.pages === undefined) return;
      const index = schema.pages.findIndex((page) => page.id === pageId);
      const removed = schema.pages[index];
      if (removed === undefined) return;
      if (schema.pages.length === 1) {
        const { pages: _pages, ...singlePage } = schema;
        onChange(singlePage);
        return;
      }
      const targetIndex = index === 0 ? 1 : index - 1;
      onChange({
        ...schema,
        pages: schema.pages
          .map((page, pageIndex) =>
            pageIndex === targetIndex ? { ...page, questionIds: [...page.questionIds, ...removed.questionIds] } : page
          )
          .filter((page) => page.id !== pageId)
      });
    },
    [onChange, schema]
  );

  const setLocaleTranslation = useCallback(
    (locale: string, target: "form" | string, property: string, text: string) => {
      if (locale.trim().length === 0 || (policy?.maxTextLength !== undefined && text.length > policy.maxTextLength))
        return;
      const supportedLocales = [...new Set([...(schema.supportedLocales ?? []), locale])];
      if (target === "form" && ["title", "description", "completionMessage"].includes(property)) {
        onChange({
          ...schema,
          supportedLocales,
          translations: { ...schema.translations, [locale]: { ...schema.translations?.[locale], [property]: text } }
        });
        return;
      }
      const fields = schema.fields.map((field): FormField => {
        if (field.id === target && ["title", "description"].includes(property)) {
          return {
            ...field,
            translations: { ...field.translations, [locale]: { ...field.translations?.[locale], [property]: text } }
          } as FormField;
        }
        if (!("options" in field) || property !== "label") return field;
        return {
          ...field,
          options: field.options.map((option) =>
            option.id === target ? { ...option, translations: { ...option.translations, [locale]: text } } : option
          )
        } as FormField;
      });
      const pages = schema.pages?.map((page) =>
        page.id === target && ["title", "description"].includes(property)
          ? {
              ...page,
              translations: { ...page.translations, [locale]: { ...page.translations?.[locale], [property]: text } }
            }
          : page
      );
      onChange({ ...schema, supportedLocales, fields, ...(pages === undefined ? {} : { pages }) });
    },
    [onChange, policy, schema]
  );

  const validationIssues = useMemo(() => {
    const result = validateFormSchema(schema);
    const issues = result.valid ? [] : [...result.issues];
    addPolicyIssues(schema, policy, issues);
    return issues;
  }, [policy, schema]);

  return {
    schema,
    addField,
    removeField,
    moveField,
    updateField,
    addOption,
    removeOption,
    moveOption,
    addPage,
    removePage,
    setLocaleTranslation,
    validationIssues
  };
}
