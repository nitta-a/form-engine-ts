import {
  type ChoiceOption,
  type DisplayCondition,
  type FormField,
  type FormPage,
  type FormPolicy,
  type FormSchema,
  type JsonValue,
  type QuestionType,
  type SchemaIssue,
  transformFieldType,
  validateFormSchema
} from "@form-engine-ts/core";
import { useCallback, useMemo } from "react";

/** @deprecated Import FormPolicy from @form-engine-ts/core instead. */
export type BuilderPolicy = FormPolicy;
export type BuilderIdKind = "field" | "option" | "page";

export interface BuilderFactories {
  readonly createField?: (type: QuestionType, id: string) => FormField;
  readonly createOption?: (field: FormField, id: string) => ChoiceOption;
  readonly createPage?: (id: string, questionIds: string[]) => FormPage;
}

export interface BuilderTextTarget {
  readonly kind: "form" | "page" | "field" | "option";
  readonly id?: string;
}

export interface FormBuilderOptions {
  readonly schema: FormSchema;
  readonly onChange: (schema: FormSchema) => void;
  readonly policy?: FormPolicy;
  readonly idFactory?: (kind: BuilderIdKind, existingIds: ReadonlySet<string>) => string;
  readonly factories?: BuilderFactories;
}

export type BuilderActionError =
  | { readonly type: "invalid_id"; readonly kind: BuilderIdKind; readonly id: string }
  | { readonly type: "max_fields_exceeded"; readonly max: number }
  | { readonly type: "max_options_exceeded"; readonly max: number }
  | { readonly type: "max_text_length_exceeded"; readonly max: number }
  | { readonly type: "disallowed_field_type"; readonly fieldType: QuestionType }
  | { readonly type: "node_not_found"; readonly kind: BuilderTextTarget["kind"]; readonly id: string }
  | { readonly type: "invalid_operation"; readonly message: string };

export type BuilderActionResult =
  | { readonly success: true }
  | { readonly success: false; readonly error: BuilderActionError };

export interface FormBuilderResult {
  readonly schema: FormSchema;
  readonly addField: (type: QuestionType, pageId?: string) => BuilderActionResult;
  readonly removeField: (fieldId: string) => BuilderActionResult;
  readonly moveField: (fieldId: string, targetIndex: number) => BuilderActionResult;
  readonly updateField: (fieldId: string, updater: (field: FormField) => FormField) => BuilderActionResult;
  readonly changeFieldType: (fieldId: string, type: QuestionType) => BuilderActionResult;
  readonly addOption: (fieldId: string) => BuilderActionResult;
  readonly updateOption: (
    fieldId: string,
    optionId: string,
    updater: (option: ChoiceOption) => ChoiceOption
  ) => BuilderActionResult;
  readonly removeOption: (fieldId: string, optionId: string) => BuilderActionResult;
  readonly moveOption: (fieldId: string, optionId: string, targetIndex: number) => BuilderActionResult;
  readonly addPage: (questionId?: string) => BuilderActionResult;
  readonly updatePage: (pageId: string, updater: (page: FormPage) => FormPage) => BuilderActionResult;
  readonly removePage: (pageId: string) => BuilderActionResult;
  readonly movePage: (pageId: string, targetIndex: number) => BuilderActionResult;
  readonly assignFieldToPage: (fieldId: string, pageId: string | null) => BuilderActionResult;
  readonly setDisplayCondition: (fieldId: string, condition?: DisplayCondition) => BuilderActionResult;
  readonly setSourceText: (target: BuilderTextTarget, property: string, text: string) => BuilderActionResult;
  readonly setLocaleTranslation: (
    locale: string,
    target: BuilderTextTarget,
    property: string,
    text: string,
    options?: { readonly metadata?: Readonly<Record<string, JsonValue>> }
  ) => BuilderActionResult;
  readonly addLocale: (locale: string) => BuilderActionResult;
  readonly setDefaultLocale: (locale: string) => BuilderActionResult;
  readonly validationIssues: readonly SchemaIssue[];
}

const DEFAULT_PREFIXES = { field: "q", option: "opt", page: "page" } as const;
const CHOICE_TYPES: readonly QuestionType[] = ["select", "radio", "multi-select"];

function defaultIdFactory(kind: BuilderIdKind, existingIds: ReadonlySet<string>): string {
  const prefix = DEFAULT_PREFIXES[kind];
  let id: string;
  do id = `${prefix}_${globalThis.crypto.randomUUID().slice(0, 8)}`;
  while (existingIds.has(id));
  return id;
}

function defaultCreateField(type: QuestionType, id: string): FormField {
  const base = { id, title: "New question", required: false } as const;
  if (type === "text" || type === "textarea" || type === "number" || type === "checkbox") return { ...base, type };
  if (type === "rating") return { ...base, type, min: 1, max: 5 };
  return { ...base, type, options: [] };
}

function defaultCreateOption(field: FormField, id: string): ChoiceOption {
  return { id, label: `Option ${"options" in field ? field.options.length + 1 : 1}` };
}

function defaultCreatePage(id: string, questionIds: string[]): FormPage {
  return { id, title: "New page", questionIds };
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

function withoutDisplayCondition(field: FormField): FormField {
  const { displayCondition: _displayCondition, ...rest } = field;
  return rest as FormField;
}

function removeLocalizedProperty(
  translations: FormSchema["translations"],
  locale: string,
  property: "title" | "description" | "completionMessage"
): FormSchema["translations"] {
  const current = translations?.[locale];
  if (current === undefined) return translations;
  const { [property]: _removed, ...remaining } = current;
  return { ...translations, [locale]: remaining };
}

function setTranslationMetadata<T extends { readonly translationMetadata?: FormSchema["translationMetadata"] }>(
  node: T,
  locale: string,
  property: string,
  metadata: Readonly<Record<string, JsonValue>> | undefined,
  remove: boolean
): T {
  const localeMetadata = node.translationMetadata?.[locale];
  if (metadata === undefined && !remove) return node;
  const nextLocaleMetadata = remove
    ? Object.fromEntries(Object.entries(localeMetadata ?? {}).filter(([key]) => key !== property))
    : { ...localeMetadata, [property]: metadata ?? {} };
  return { ...node, translationMetadata: { ...node.translationMetadata, [locale]: nextLocaleMetadata } };
}

function failedId(kind: BuilderIdKind, result: { readonly error?: BuilderActionError }): BuilderActionResult {
  return { success: false, error: result.error ?? { type: "invalid_id", kind, id: "" } };
}

export function useFormBuilder({
  schema,
  onChange,
  policy,
  idFactory = defaultIdFactory,
  factories = {}
}: FormBuilderOptions): FormBuilderResult {
  const createId = useCallback(
    (
      kind: BuilderIdKind,
      existingIds: ReadonlySet<string>
    ): { readonly id?: string; readonly error?: BuilderActionError } => {
      const rawId = idFactory(kind, existingIds);
      const id = rawId.trim();
      return id.length > 0 && !existingIds.has(id) ? { id } : { error: { type: "invalid_id", kind, id: rawId } };
    },
    [idFactory]
  );
  const textPolicyError = useCallback(
    (text: string): BuilderActionResult | undefined =>
      policy?.maxTextLength !== undefined && text.length > policy.maxTextLength
        ? { success: false, error: { type: "max_text_length_exceeded", max: policy.maxTextLength } }
        : undefined,
    [policy?.maxTextLength]
  );

  const updateField = useCallback(
    (fieldId: string, updater: (field: FormField) => FormField): BuilderActionResult => {
      const current = schema.fields.find((field) => field.id === fieldId);
      if (current === undefined)
        return { success: false, error: { type: "node_not_found", kind: "field", id: fieldId } };
      const updated = updater(current);
      if (updated.id !== fieldId)
        return { success: false, error: { type: "invalid_id", kind: "field", id: updated.id } };
      if (policy?.allowedFieldTypes !== undefined && !policy.allowedFieldTypes.includes(updated.type))
        return { success: false, error: { type: "disallowed_field_type", fieldType: updated.type } };
      for (const text of [updated.title, updated.description]) {
        if (text !== undefined) {
          const error = textPolicyError(text);
          if (error !== undefined) return error;
        }
      }
      onChange({ ...schema, fields: schema.fields.map((field) => (field.id === fieldId ? updated : field)) });
      return { success: true };
    },
    [onChange, policy?.allowedFieldTypes, schema, textPolicyError]
  );

  const updateOption = useCallback(
    (fieldId: string, optionId: string, updater: (option: ChoiceOption) => ChoiceOption): BuilderActionResult => {
      const field = schema.fields.find((candidate) => candidate.id === fieldId);
      if (field === undefined) return { success: false, error: { type: "node_not_found", kind: "field", id: fieldId } };
      if (!("options" in field))
        return { success: false, error: { type: "invalid_operation", message: `Field ${fieldId} has no options.` } };
      const current = field.options.find((option) => option.id === optionId);
      if (current === undefined)
        return { success: false, error: { type: "node_not_found", kind: "option", id: optionId } };
      const updated = updater(current);
      if (updated.id !== optionId)
        return { success: false, error: { type: "invalid_id", kind: "option", id: updated.id } };
      const error = textPolicyError(updated.label);
      if (error !== undefined) return error;
      onChange({
        ...schema,
        fields: schema.fields.map((candidate) =>
          candidate.id === fieldId && "options" in candidate
            ? ({
                ...candidate,
                options: candidate.options.map((option) => (option.id === optionId ? updated : option))
              } as FormField)
            : candidate
        )
      });
      return { success: true };
    },
    [onChange, schema, textPolicyError]
  );

  const updatePage = useCallback(
    (pageId: string, updater: (page: FormPage) => FormPage): BuilderActionResult => {
      const page = schema.pages?.find((candidate) => candidate.id === pageId);
      if (page === undefined) return { success: false, error: { type: "node_not_found", kind: "page", id: pageId } };
      const pages = schema.pages;
      if (pages === undefined) return { success: false, error: { type: "node_not_found", kind: "page", id: pageId } };
      const updated = updater(page);
      if (updated.id !== pageId) return { success: false, error: { type: "invalid_id", kind: "page", id: updated.id } };
      onChange({ ...schema, pages: pages.map((candidate) => (candidate.id === pageId ? updated : candidate)) });
      return { success: true };
    },
    [onChange, schema]
  );

  const addField = useCallback(
    (type: QuestionType, pageId?: string): BuilderActionResult => {
      if (policy?.allowedFieldTypes !== undefined && !policy.allowedFieldTypes.includes(type))
        return { success: false, error: { type: "disallowed_field_type", fieldType: type } };
      if (policy?.maxFields !== undefined && schema.fields.length >= policy.maxFields)
        return { success: false, error: { type: "max_fields_exceeded", max: policy.maxFields } };
      if (pageId !== undefined && !schema.pages?.some((page) => page.id === pageId))
        return { success: false, error: { type: "node_not_found", kind: "page", id: pageId } };
      const fieldIds = new Set(schema.fields.map((field) => field.id));
      const fieldId = createId("field", fieldIds);
      if (fieldId.id === undefined) return failedId("field", fieldId);
      let field = (factories.createField ?? defaultCreateField)(type, fieldId.id);
      if (field.id !== fieldId.id || field.type !== type || fieldIds.has(field.id))
        return { success: false, error: { type: "invalid_id", kind: "field", id: field.id } };
      if (CHOICE_TYPES.includes(type) && "options" in field && field.options.length === 0) {
        const optionIds = new Set(
          schema.fields.flatMap((item) => ("options" in item ? item.options.map((option) => option.id) : []))
        );
        const optionId = createId("option", optionIds);
        if (optionId.id === undefined) return failedId("option", optionId);
        const option = (factories.createOption ?? defaultCreateOption)(field, optionId.id);
        if (option.id !== optionId.id || optionIds.has(option.id))
          return { success: false, error: { type: "invalid_id", kind: "option", id: option.id } };
        field = { ...field, options: [option] } as FormField;
      }
      const pages = schema.pages?.map((page, index) => ({
        ...page,
        questionIds:
          page.id === pageId || (pageId === undefined && index === (schema.pages?.length ?? 0) - 1)
            ? [...page.questionIds, field.id]
            : page.questionIds
      }));
      onChange({ ...schema, fields: [...schema.fields, field], ...(pages === undefined ? {} : { pages }) });
      return { success: true };
    },
    [createId, factories, onChange, policy, schema]
  );

  const removeField = useCallback(
    (fieldId: string): BuilderActionResult => {
      if (!schema.fields.some((field) => field.id === fieldId))
        return { success: false, error: { type: "node_not_found", kind: "field", id: fieldId } };
      if (schema.fields.length <= 1)
        return { success: false, error: { type: "invalid_operation", message: "A form must contain one field." } };
      const fields = schema.fields
        .filter((field) => field.id !== fieldId)
        .map((field) => (field.displayCondition?.questionId === fieldId ? withoutDisplayCondition(field) : field));
      const pages = schema.pages
        ?.map((page) => ({ ...page, questionIds: page.questionIds.filter((id) => id !== fieldId) }))
        .filter((page) => page.questionIds.length > 0);
      if (schema.pages !== undefined && pages?.length === 0) {
        const { pages: _pages, ...single } = schema;
        onChange({ ...single, fields });
      } else onChange({ ...schema, fields, ...(pages === undefined ? {} : { pages }) });
      return { success: true };
    },
    [onChange, schema]
  );

  const moveField = useCallback(
    (fieldId: string, targetIndex: number): BuilderActionResult => {
      const sourceIndex = schema.fields.findIndex((field) => field.id === fieldId);
      if (sourceIndex < 0) return { success: false, error: { type: "node_not_found", kind: "field", id: fieldId } };
      const fields = move(schema.fields, sourceIndex, targetIndex);
      if (fields === undefined)
        return { success: false, error: { type: "invalid_operation", message: "Invalid field position." } };
      const indexById = new Map(fields.map((field, index) => [field.id, index]));
      onChange({
        ...schema,
        fields: fields.map((field, index) => {
          const source = field.displayCondition?.questionId;
          return source === undefined || (indexById.get(source) ?? index) < index
            ? field
            : withoutDisplayCondition(field);
        })
      });
      return { success: true };
    },
    [onChange, schema]
  );

  const addOption = useCallback(
    (fieldId: string): BuilderActionResult => {
      const field = schema.fields.find((candidate) => candidate.id === fieldId);
      if (field === undefined) return { success: false, error: { type: "node_not_found", kind: "field", id: fieldId } };
      if (!("options" in field))
        return { success: false, error: { type: "invalid_operation", message: `Field ${fieldId} has no options.` } };
      if (policy?.maxOptionsPerField !== undefined && field.options.length >= policy.maxOptionsPerField)
        return { success: false, error: { type: "max_options_exceeded", max: policy.maxOptionsPerField } };
      const ids = new Set(
        schema.fields.flatMap((item) => ("options" in item ? item.options.map((option) => option.id) : []))
      );
      const id = createId("option", ids);
      if (id.id === undefined) return failedId("option", id);
      const option = (factories.createOption ?? defaultCreateOption)(field, id.id);
      if (option.id !== id.id || ids.has(option.id))
        return { success: false, error: { type: "invalid_id", kind: "option", id: option.id } };
      onChange({
        ...schema,
        fields: schema.fields.map((item) =>
          item.id === fieldId && "options" in item
            ? ({ ...item, options: [...item.options, option] } as FormField)
            : item
        )
      });
      return { success: true };
    },
    [createId, factories.createOption, onChange, policy?.maxOptionsPerField, schema]
  );

  const removeOption = useCallback(
    (fieldId: string, optionId: string): BuilderActionResult => {
      const field = schema.fields.find((item) => item.id === fieldId);
      if (field === undefined) return { success: false, error: { type: "node_not_found", kind: "field", id: fieldId } };
      if (!("options" in field) || !field.options.some((option) => option.id === optionId))
        return { success: false, error: { type: "node_not_found", kind: "option", id: optionId } };
      if (field.options.length <= 1)
        return { success: false, error: { type: "invalid_operation", message: "A choice field needs one option." } };
      onChange({
        ...schema,
        fields: schema.fields.map((item) =>
          item.id === fieldId && "options" in item
            ? ({ ...item, options: item.options.filter((option) => option.id !== optionId) } as FormField)
            : item
        )
      });
      return { success: true };
    },
    [onChange, schema]
  );

  const moveOption = useCallback(
    (fieldId: string, optionId: string, targetIndex: number): BuilderActionResult => {
      const field = schema.fields.find((item) => item.id === fieldId);
      if (field === undefined) return { success: false, error: { type: "node_not_found", kind: "field", id: fieldId } };
      if (!("options" in field))
        return { success: false, error: { type: "invalid_operation", message: `Field ${fieldId} has no options.` } };
      const options = move(
        field.options,
        field.options.findIndex((option) => option.id === optionId),
        targetIndex
      );
      if (options === undefined)
        return { success: false, error: { type: "invalid_operation", message: "Invalid option position." } };
      onChange({
        ...schema,
        fields: schema.fields.map((item) =>
          item.id === fieldId && "options" in item ? ({ ...item, options } as FormField) : item
        )
      });
      return { success: true };
    },
    [onChange, schema]
  );

  const changeFieldType = useCallback(
    (fieldId: string, type: QuestionType): BuilderActionResult => {
      const field = schema.fields.find((item) => item.id === fieldId);
      if (field === undefined) return { success: false, error: { type: "node_not_found", kind: "field", id: fieldId } };
      if (policy?.allowedFieldTypes !== undefined && !policy.allowedFieldTypes.includes(type))
        return { success: false, error: { type: "disallowed_field_type", fieldType: type } };
      let transformed = transformFieldType(field, type);
      if (CHOICE_TYPES.includes(type) && !("options" in field) && "options" in transformed) {
        const ids = new Set(
          schema.fields.flatMap((item) => ("options" in item ? item.options.map((option) => option.id) : []))
        );
        const id = createId("option", ids);
        if (id.id === undefined) return failedId("option", id);
        const option = (factories.createOption ?? defaultCreateOption)(transformed, id.id);
        if (option.id !== id.id || ids.has(option.id))
          return { success: false, error: { type: "invalid_id", kind: "option", id: option.id } };
        transformed = { ...transformed, options: [option] } as FormField;
      }
      onChange({ ...schema, fields: schema.fields.map((item) => (item.id === fieldId ? transformed : item)) });
      return { success: true };
    },
    [createId, factories.createOption, onChange, policy?.allowedFieldTypes, schema]
  );

  const addPage = useCallback(
    (questionId?: string): BuilderActionResult => {
      const ids = new Set(schema.pages?.map((page) => page.id) ?? []);
      const id = createId("page", ids);
      if (id.id === undefined) return failedId("page", id);
      const questionIds =
        schema.pages === undefined
          ? schema.fields.map((field) => field.id)
          : [questionId ?? schema.pages.find((page) => page.questionIds.length > 1)?.questionIds.at(-1)].filter(
              (value): value is string => value !== undefined
            );
      if (questionIds.length === 0)
        return { success: false, error: { type: "invalid_operation", message: "No question can be moved." } };
      const source = schema.pages?.find((page) => page.questionIds.includes(questionIds[0] ?? ""));
      if (schema.pages !== undefined && (source === undefined || source.questionIds.length <= 1))
        return { success: false, error: { type: "invalid_operation", message: "A page cannot be left empty." } };
      const page = (factories.createPage ?? defaultCreatePage)(id.id, [...questionIds]);
      if (page.id !== id.id || ids.has(page.id))
        return { success: false, error: { type: "invalid_id", kind: "page", id: page.id } };
      const pages =
        schema.pages === undefined
          ? [page]
          : [
              ...schema.pages.map((item) => ({
                ...item,
                questionIds: item.questionIds.filter((fieldId) => !questionIds.includes(fieldId))
              })),
              page
            ];
      onChange({ ...schema, pages });
      return { success: true };
    },
    [createId, factories.createPage, onChange, schema]
  );

  const removePage = useCallback(
    (pageId: string): BuilderActionResult => {
      const index = schema.pages?.findIndex((page) => page.id === pageId) ?? -1;
      const removed = schema.pages?.[index];
      if (removed === undefined) return { success: false, error: { type: "node_not_found", kind: "page", id: pageId } };
      const currentPages = schema.pages;
      if (currentPages === undefined)
        return { success: false, error: { type: "node_not_found", kind: "page", id: pageId } };
      if ((schema.pages?.length ?? 0) === 1) {
        const { pages: _pages, ...single } = schema;
        onChange(single);
        return { success: true };
      }
      const targetIndex = index === 0 ? 1 : index - 1;
      onChange({
        ...schema,
        pages: currentPages
          .map((page, pageIndex) =>
            pageIndex === targetIndex ? { ...page, questionIds: [...page.questionIds, ...removed.questionIds] } : page
          )
          .filter((page) => page.id !== pageId)
      });
      return { success: true };
    },
    [onChange, schema]
  );

  const movePage = useCallback(
    (pageId: string, targetIndex: number): BuilderActionResult => {
      const sourceIndex = schema.pages?.findIndex((page) => page.id === pageId) ?? -1;
      if (sourceIndex < 0) return { success: false, error: { type: "node_not_found", kind: "page", id: pageId } };
      const pages = move(schema.pages ?? [], sourceIndex, targetIndex);
      if (pages === undefined)
        return { success: false, error: { type: "invalid_operation", message: "Invalid page position." } };
      const assignment = new Map(pages.flatMap((page, index) => page.questionIds.map((id) => [id, index] as const)));
      onChange({
        ...schema,
        pages: pages.map((page, index) => {
          const source = page.displayCondition?.questionId;
          if (source === undefined || (assignment.get(source) ?? index) < index) return page;
          const { displayCondition: _condition, ...rest } = page;
          return rest;
        })
      });
      return { success: true };
    },
    [onChange, schema]
  );

  const assignFieldToPage = useCallback(
    (fieldId: string, pageId: string | null): BuilderActionResult => {
      if (!schema.fields.some((field) => field.id === fieldId))
        return { success: false, error: { type: "node_not_found", kind: "field", id: fieldId } };
      if (pageId === null) {
        if (schema.pages !== undefined) {
          const { pages: _pages, ...single } = schema;
          onChange(single);
        }
        return { success: true };
      }
      if (!schema.pages?.some((page) => page.id === pageId))
        return { success: false, error: { type: "node_not_found", kind: "page", id: pageId } };
      const pages = schema.pages
        .map((page) => ({
          ...page,
          questionIds:
            page.id === pageId
              ? schema.fields
                  .filter((field) => page.questionIds.includes(field.id) || field.id === fieldId)
                  .map((field) => field.id)
              : page.questionIds.filter((id) => id !== fieldId)
        }))
        .filter((page) => page.questionIds.length > 0);
      onChange({ ...schema, pages });
      return { success: true };
    },
    [onChange, schema]
  );

  const setDisplayCondition = useCallback(
    (fieldId: string, condition?: DisplayCondition): BuilderActionResult => {
      const index = schema.fields.findIndex((field) => field.id === fieldId);
      if (index < 0) return { success: false, error: { type: "node_not_found", kind: "field", id: fieldId } };
      if (condition !== undefined) {
        const sourceIndex = schema.fields.findIndex((field) => field.id === condition.questionId);
        if (sourceIndex < 0 || sourceIndex >= index)
          return {
            success: false,
            error: { type: "invalid_operation", message: "Conditions require an earlier field." }
          };
      }
      onChange({
        ...schema,
        fields: schema.fields.map((field) =>
          field.id !== fieldId
            ? field
            : condition === undefined
              ? withoutDisplayCondition(field)
              : ({ ...field, displayCondition: condition } as FormField)
        )
      });
      return { success: true };
    },
    [onChange, schema]
  );

  const setSourceText = useCallback(
    (target: BuilderTextTarget, property: string, text: string): BuilderActionResult => {
      const error = textPolicyError(text);
      if (error !== undefined) return error;
      if (target.kind === "form") {
        if (!["title", "description", "completionMessage"].includes(property))
          return {
            success: false,
            error: { type: "invalid_operation", message: `Unsupported form property: ${property}` }
          };
        if (property === "title") onChange({ ...schema, title: text });
        else if (property === "description") {
          const { description: _description, ...withoutDescription } = schema;
          onChange(text.length === 0 ? withoutDescription : { ...schema, description: text });
        } else {
          const { completionMessage: _completionMessage, ...withoutCompletionMessage } = schema;
          onChange(text.length === 0 ? withoutCompletionMessage : { ...schema, completionMessage: text });
        }
        return { success: true };
      }
      if (target.id === undefined)
        return { success: false, error: { type: "invalid_operation", message: "A target ID is required." } };
      if (target.kind === "field") {
        if (!["title", "description"].includes(property))
          return {
            success: false,
            error: { type: "invalid_operation", message: `Unsupported field property: ${property}` }
          };
        return updateField(target.id, (field) => {
          if (property === "title") return { ...field, title: text };
          const { description: _description, ...withoutDescription } = field;
          return text.length === 0 ? (withoutDescription as FormField) : ({ ...field, description: text } as FormField);
        });
      }
      if (target.kind === "option") {
        if (property !== "label")
          return {
            success: false,
            error: { type: "invalid_operation", message: `Unsupported option property: ${property}` }
          };
        for (const field of schema.fields)
          if ("options" in field && field.options.some((option) => option.id === target.id))
            return updateOption(field.id, target.id, (option) => ({ ...option, label: text }));
        return { success: false, error: { type: "node_not_found", kind: "option", id: target.id } };
      }
      if (!["title", "description"].includes(property))
        return {
          success: false,
          error: { type: "invalid_operation", message: `Unsupported page property: ${property}` }
        };
      return updatePage(target.id, (page) => {
        if (property === "title") {
          const { title: _title, ...withoutTitle } = page;
          return text.length === 0 ? withoutTitle : { ...page, title: text };
        }
        const { description: _description, ...withoutDescription } = page;
        return text.length === 0 ? withoutDescription : { ...page, description: text };
      });
    },
    [onChange, schema, textPolicyError, updateField, updateOption, updatePage]
  );

  const setLocaleTranslation = useCallback(
    (
      locale: string,
      target: BuilderTextTarget,
      property: string,
      text: string,
      options: { readonly metadata?: Readonly<Record<string, JsonValue>> } = {}
    ): BuilderActionResult => {
      const normalized = locale.trim();
      if (normalized.length === 0)
        return { success: false, error: { type: "invalid_operation", message: "Locale must not be empty." } };
      const error = textPolicyError(text);
      if (error !== undefined) return error;
      const supportedLocales = [...new Set([...(schema.supportedLocales ?? []), normalized])];
      const remove = text.length === 0;
      if (target.kind === "form") {
        if (!["title", "description", "completionMessage"].includes(property))
          return {
            success: false,
            error: { type: "invalid_operation", message: `Unsupported form property: ${property}` }
          };
        const key = property as "title" | "description" | "completionMessage";
        const translations = remove
          ? removeLocalizedProperty(schema.translations, normalized, key)
          : { ...schema.translations, [normalized]: { ...schema.translations?.[normalized], [key]: text } };
        onChange(
          setTranslationMetadata(
            { ...schema, supportedLocales, ...(translations === undefined ? {} : { translations }) },
            normalized,
            property,
            options.metadata,
            remove
          )
        );
        return { success: true };
      }
      if (target.id === undefined)
        return { success: false, error: { type: "invalid_operation", message: "A target ID is required." } };
      let found = false;
      const fields = schema.fields.map((field): FormField => {
        if (target.kind === "field" && field.id === target.id && ["title", "description"].includes(property)) {
          found = true;
          const key = property as "title" | "description";
          const translations = remove
            ? removeLocalizedProperty(field.translations, normalized, key)
            : { ...field.translations, [normalized]: { ...field.translations?.[normalized], [key]: text } };
          return setTranslationMetadata(
            { ...field, ...(translations === undefined ? {} : { translations }) } as FormField,
            normalized,
            property,
            options.metadata,
            remove
          );
        }
        if (target.kind !== "option" || property !== "label" || !("options" in field)) return field;
        return {
          ...field,
          options: field.options.map((option) => {
            if (option.id !== target.id) return option;
            found = true;
            const translations = remove
              ? Object.fromEntries(Object.entries(option.translations ?? {}).filter(([key]) => key !== normalized))
              : { ...option.translations, [normalized]: text };
            return setTranslationMetadata({ ...option, translations }, normalized, property, options.metadata, remove);
          })
        } as FormField;
      });
      const pages = schema.pages?.map((page) => {
        if (target.kind !== "page" || page.id !== target.id || !["title", "description"].includes(property))
          return page;
        found = true;
        const key = property as "title" | "description";
        const translations = remove
          ? removeLocalizedProperty(page.translations, normalized, key)
          : { ...page.translations, [normalized]: { ...page.translations?.[normalized], [key]: text } };
        return setTranslationMetadata(
          { ...page, ...(translations === undefined ? {} : { translations }) },
          normalized,
          property,
          options.metadata,
          remove
        );
      });
      if (!found) return { success: false, error: { type: "node_not_found", kind: target.kind, id: target.id } };
      onChange({ ...schema, supportedLocales, fields, ...(pages === undefined ? {} : { pages }) });
      return { success: true };
    },
    [onChange, schema, textPolicyError]
  );

  const addLocale = useCallback(
    (locale: string): BuilderActionResult => {
      const normalized = locale.trim();
      if (normalized.length === 0)
        return { success: false, error: { type: "invalid_operation", message: "Locale must not be empty." } };
      onChange({
        ...schema,
        supportedLocales: [
          ...new Set([
            ...(schema.defaultLocale === undefined ? [] : [schema.defaultLocale]),
            ...(schema.supportedLocales ?? []),
            normalized
          ])
        ]
      });
      return { success: true };
    },
    [onChange, schema]
  );

  const setDefaultLocale = useCallback(
    (locale: string): BuilderActionResult => {
      const normalized = locale.trim();
      if (normalized.length === 0)
        return { success: false, error: { type: "invalid_operation", message: "Locale must not be empty." } };
      onChange({
        ...schema,
        defaultLocale: normalized,
        supportedLocales: [...new Set([normalized, ...(schema.supportedLocales ?? [])])]
      });
      return { success: true };
    },
    [onChange, schema]
  );

  const validationIssues = useMemo(() => {
    const result = validateFormSchema(schema, policy === undefined ? {} : { policy });
    return result.valid ? [] : result.issues;
  }, [policy, schema]);

  return {
    schema,
    addField,
    removeField,
    moveField,
    updateField,
    changeFieldType,
    addOption,
    updateOption,
    removeOption,
    moveOption,
    addPage,
    updatePage,
    removePage,
    movePage,
    assignFieldToPage,
    setDisplayCondition,
    setSourceText,
    setLocaleTranslation,
    addLocale,
    setDefaultLocale,
    validationIssues
  };
}
