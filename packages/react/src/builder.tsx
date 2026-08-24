import {
  type AsyncTranslationAdapter,
  type ConditionOperator,
  type ConditionValue,
  type DisplayCondition,
  type FieldOption,
  type FieldType,
  type FormField,
  type FormSchema,
  populateSchemaTranslations,
  sanitizeSchema,
  type TranslationAdapter
} from "@form-engine-ts/core";
import { useState } from "react";
import { type BuilderPolicy, useFormBuilder } from "./hooks/useFormBuilder";

const FIELD_TYPES: readonly FieldType[] = [
  "text",
  "textarea",
  "number",
  "rating",
  "select",
  "multi-select",
  "checkbox",
  "radio"
];

const BUILDER_DEFAULTS: Readonly<Record<string, string>> = {
  "builder.formBuilder": "Form builder",
  "builder.moveUp": "Move {{title}} up",
  "builder.moveDown": "Move {{title}} down",
  "builder.delete": "Delete {{title}}",
  "builder.deleteAction": "Delete",
  "builder.questionTitle": "質問文 / Question Title",
  "builder.questionTitlePlaceholder": "Example: Tell us what we could improve",
  "builder.newQuestionTitle": "New question",
  "builder.type": "Type",
  "builder.required": "Required",
  "builder.minimum": "Minimum",
  "builder.maximum": "Maximum",
  "builder.options": "Options",
  "builder.optionLabel": "選択肢 / Option Label {{index}}",
  "builder.optionLabelPlaceholder": "Example: Very satisfied",
  "builder.newOptionLabel": "Option {{index}}",
  "builder.remove": "Remove",
  "builder.addOption": "Add option",
  "builder.displayCondition": "Display condition",
  "builder.alwaysVisible": "Always visible",
  "builder.conditionOperator": "Condition operator",
  "builder.conditionValue": "Condition value",
  "builder.conditionTrue": "true",
  "builder.conditionFalse": "false",
  "builder.addQuestion": "Add question",
  "builder.pages": "Page manager",
  "builder.enablePages": "Enable multi-step pages",
  "builder.addPage": "Add page",
  "builder.newPage": "New page",
  "builder.pageTitle": "Page title",
  "builder.pageDescription": "Page description",
  "builder.pageQuestion": "Question to move to the new page",
  "builder.questionPage": "Page",
  "builder.pageCondition": "Page display condition",
  "builder.localization": "Localization",
  "builder.defaultLocale": "Default locale",
  "builder.supportedLocales": "Supported locales",
  "builder.addLocale": "Add locale",
  "builder.editLocale": "Edit locale",
  "builder.autoTranslate": "Translate all text",
  "builder.translationUnavailable": "Provide an async translation adapter to enable automatic translation.",
  "builder.fieldType.text": "Text",
  "builder.fieldType.textarea": "Textarea",
  "builder.fieldType.number": "Number",
  "builder.fieldType.rating": "Rating",
  "builder.fieldType.select": "Select",
  "builder.fieldType.multi-select": "Multi-select",
  "builder.fieldType.checkbox": "Checkbox",
  "builder.fieldType.radio": "Radio",
  "builder.operator.equals": "equals",
  "builder.operator.not_equals": "does not equal",
  "builder.operator.contains": "contains",
  "builder.operator.not_empty": "is not empty"
};

function interpolate(template: string, params: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (token, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : token
  );
}

function fieldTypeKey(type: FieldType): string {
  return `builder.fieldType.${type}`;
}

function operatorKey(operator: ConditionOperator): string {
  return `builder.operator.${operator}`;
}

function createUniqueId(prefix: "q" | "opt" | "page", existingIds: ReadonlySet<string>): string {
  let id: string;
  do {
    id = `${prefix}_${globalThis.crypto.randomUUID().slice(0, 8)}`;
  } while (existingIds.has(id));
  return id;
}

function baseField(field: FormField, type: FieldType) {
  return {
    id: field.id,
    type,
    title: field.title,
    ...(field.description === undefined ? {} : { description: field.description }),
    ...(field.translationKey === undefined ? {} : { translationKey: field.translationKey }),
    required: field.required,
    ...(field.displayCondition === undefined ? {} : { displayCondition: field.displayCondition })
  };
}

function normalizeField(field: FormField, type: FieldType, newOptionLabel: string): FormField {
  const base = baseField(field, type);
  if (type === "text" || type === "textarea") return { ...base, type };
  if (type === "number") return { ...base, type };
  if (type === "rating") return { ...base, type, min: 1, max: 5 };
  if (type === "checkbox") return { ...base, type };
  const options: readonly FieldOption[] =
    "options" in field && field.options.length > 0
      ? field.options
      : [{ id: createUniqueId("opt", new Set()), label: newOptionLabel }];
  return { ...base, type, options };
}

function defaultConditionValue(field: FormField): ConditionValue {
  if (field.type === "checkbox") return true;
  if (field.type === "number" || field.type === "rating") return field.min ?? 1;
  if ("options" in field) return field.options[0]?.id ?? "";
  return "";
}

function conditionOperators(field: FormField): readonly ConditionOperator[] {
  if (field.type === "multi-select") return ["contains", "not_empty"];
  if (field.type === "text" || field.type === "textarea") {
    return ["equals", "not_equals", "contains", "not_empty"];
  }
  return ["equals", "not_equals", "not_empty"];
}

function withoutDisplayCondition(field: FormField): FormField {
  const { displayCondition: _displayCondition, ...rest } = field;
  return rest as FormField;
}

function sanitizeBuilderSchema(schema: FormSchema): FormSchema {
  const sanitized = sanitizeSchema(schema);
  const indexById = new Map(sanitized.fields.map((field, index) => [field.id, index]));
  const fields = sanitized.fields.map((field, index) => {
    const sourceId = field.displayCondition?.questionId;
    if (sourceId === undefined) return field;
    const sourceIndex = indexById.get(sourceId);
    return sourceIndex !== undefined && sourceIndex < index ? field : withoutDisplayCondition(field);
  });
  return {
    ...sanitized,
    fields,
    ...(sanitized.pages === undefined
      ? {}
      : {
          pages: sanitized.pages.map((page) => ({
            ...page,
            questionIds: fields.filter((field) => page.questionIds.includes(field.id)).map((field) => field.id)
          }))
        })
  };
}

function conditionWithValue(questionId: string, operator: ConditionOperator, value: ConditionValue): DisplayCondition {
  return operator === "not_empty" ? { questionId, operator } : { questionId, operator, value };
}

function ConditionValueEditor({
  source,
  condition,
  onChange,
  translate
}: {
  readonly source: FormField;
  readonly condition: DisplayCondition;
  readonly onChange: (condition: DisplayCondition) => void;
  readonly translate: (key: string, params?: Readonly<Record<string, string | number>>) => string;
}) {
  if (condition.operator === "not_empty") return null;
  const update = (value: ConditionValue) => onChange({ ...condition, value });
  if (source.type === "checkbox") {
    return (
      <select value={String(condition.value)} onChange={(event) => update(event.currentTarget.value === "true")}>
        <option value="true">{translate("builder.conditionTrue")}</option>
        <option value="false">{translate("builder.conditionFalse")}</option>
      </select>
    );
  }
  if (source.type === "number" || source.type === "rating") {
    return (
      <input
        aria-label={translate("builder.conditionValue")}
        type="number"
        value={typeof condition.value === "number" ? condition.value : ""}
        onChange={(event) => update(event.currentTarget.value === "" ? 0 : event.currentTarget.valueAsNumber)}
      />
    );
  }
  if ("options" in source) {
    return (
      <select value={String(condition.value ?? "")} onChange={(event) => update(event.currentTarget.value)}>
        {source.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      aria-label={translate("builder.conditionValue")}
      type="text"
      value={typeof condition.value === "string" ? condition.value : ""}
      onChange={(event) => update(event.currentTarget.value)}
    />
  );
}

export interface FormBuilderProps {
  readonly schema: FormSchema;
  readonly onChange: (newSchema: FormSchema) => void;
  readonly locale?: string;
  readonly translator?: TranslationAdapter;
  readonly translationAdapter?: AsyncTranslationAdapter;
  readonly policy?: BuilderPolicy;
  readonly idFactory?: (kind: "field" | "option" | "page", existingIds: ReadonlySet<string>) => string;
}

export function FormBuilder({
  schema,
  onChange,
  locale = "en",
  translator,
  translationAdapter,
  policy,
  idFactory
}: FormBuilderProps) {
  const headless = useFormBuilder({
    schema,
    onChange,
    ...(policy === undefined ? {} : { policy }),
    ...(idFactory === undefined ? {} : { idFactory })
  });
  const [newPageQuestionId, setNewPageQuestionId] = useState("");
  const [newLocale, setNewLocale] = useState("");
  const [editingLocale, setEditingLocale] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const translate = (key: string, params: Readonly<Record<string, string | number>> = {}) => {
    const translated = translator?.translate(key, locale, params);
    return translated === undefined ? interpolate(BUILDER_DEFAULTS[key] ?? key, params) : translated;
  };
  const emitSchema = (candidate: FormSchema) => onChange(sanitizeBuilderSchema(candidate));

  const updateField = headless.updateField;

  const changeType = (fieldId: string, type: FieldType) => {
    emitSchema({
      ...schema,
      fields: schema.fields.map((field) => {
        if (field.id === fieldId) {
          return normalizeField(field, type, translate("builder.newOptionLabel", { index: 1 }));
        }
        if (field.displayCondition?.questionId === fieldId) {
          const { displayCondition: _condition, ...withoutCondition } = field;
          return withoutCondition as FormField;
        }
        return field;
      })
    });
  };

  const removeField = headless.removeField;

  const moveField = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= schema.fields.length) return;
    const fields = [...schema.fields];
    const current = fields[index];
    const other = fields[target];
    if (current === undefined || other === undefined) return;
    fields[index] = other;
    fields[target] = current;
    emitSchema({ ...schema, fields });
  };

  const addField = () => headless.addField("text");

  const enablePages = () => {
    if (schema.pages !== undefined) return;
    emitSchema({
      ...schema,
      pages: [
        {
          id: createUniqueId("page", new Set()),
          title: translate("builder.newPage"),
          questionIds: schema.fields.map((field) => field.id)
        }
      ]
    });
  };

  const pageForField = (fieldId: string) => schema.pages?.find((page) => page.questionIds.includes(fieldId));
  const movablePageQuestions =
    schema.pages?.flatMap((page) => (page.questionIds.length > 1 ? page.questionIds : [])) ?? [];

  const addPage = () => {
    if (schema.pages === undefined) {
      enablePages();
      return;
    }
    const questionId = movablePageQuestions.includes(newPageQuestionId) ? newPageQuestionId : movablePageQuestions[0];
    if (questionId === undefined) return;
    const pageId = createUniqueId("page", new Set(schema.pages.map((page) => page.id)));
    emitSchema({
      ...schema,
      pages: [
        ...schema.pages.map((page) => ({
          ...page,
          questionIds: page.questionIds.filter((id) => id !== questionId)
        })),
        { id: pageId, title: translate("builder.newPage"), questionIds: [questionId] }
      ]
    });
    setNewPageQuestionId("");
  };

  const removePage = (pageIndex: number) => {
    if (schema.pages === undefined) return;
    const removed = schema.pages[pageIndex];
    if (removed === undefined) return;
    if (schema.pages.length === 1) {
      const { pages: _pages, ...singlePage } = schema;
      emitSchema(singlePage);
      return;
    }
    const targetIndex = pageIndex === 0 ? 1 : pageIndex - 1;
    emitSchema({
      ...schema,
      pages: schema.pages
        .map((page, index) =>
          index === targetIndex ? { ...page, questionIds: [...page.questionIds, ...removed.questionIds] } : page
        )
        .filter((_page, index) => index !== pageIndex)
    });
  };

  const movePage = (pageIndex: number, offset: -1 | 1) => {
    if (schema.pages === undefined) return;
    const target = pageIndex + offset;
    if (target < 0 || target >= schema.pages.length) return;
    const pages = [...schema.pages];
    const current = pages[pageIndex];
    const other = pages[target];
    if (current === undefined || other === undefined) return;
    pages[pageIndex] = other;
    pages[target] = current;
    emitSchema({ ...schema, pages });
  };

  const updatePage = (
    pageId: string,
    update: (page: NonNullable<FormSchema["pages"]>[number]) => NonNullable<FormSchema["pages"]>[number]
  ) => {
    if (schema.pages === undefined) return;
    emitSchema({ ...schema, pages: schema.pages.map((page) => (page.id === pageId ? update(page) : page)) });
  };

  const assignFieldToPage = (fieldId: string, pageId: string) => {
    if (schema.pages === undefined) return;
    emitSchema({
      ...schema,
      pages: schema.pages
        .map((page) => ({
          ...page,
          questionIds:
            page.id === pageId
              ? schema.fields
                  .filter((field) => page.questionIds.includes(field.id) || field.id === fieldId)
                  .map((field) => field.id)
              : page.questionIds.filter((id) => id !== fieldId)
        }))
        .filter((page) => page.questionIds.length > 0)
    });
  };

  const addLocale = () => {
    const normalized = newLocale.trim();
    if (normalized.length === 0) return;
    const supportedLocales = [
      ...new Set([
        ...(schema.defaultLocale === undefined ? [] : [schema.defaultLocale]),
        ...(schema.supportedLocales ?? []),
        normalized
      ])
    ];
    emitSchema({ ...schema, supportedLocales });
    setEditingLocale(normalized);
    setNewLocale("");
  };

  const translateAll = async () => {
    if (translationAdapter === undefined || editingLocale.length === 0) return;
    setIsTranslating(true);
    setTranslationError(null);
    try {
      const populated = await populateSchemaTranslations(schema, [editingLocale], translationAdapter, {
        overwrite: "all"
      });
      onChange(populated.schema);
    } catch (cause) {
      setTranslationError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setIsTranslating(false);
    }
  };

  const updateFormTranslation = (key: "title" | "description", value: string) => {
    if (editingLocale.length === 0) return;
    const current = schema.translations?.[editingLocale];
    const next =
      key === "title"
        ? value.length === 0
          ? { description: current?.description }
          : { ...current, title: value }
        : value.length === 0
          ? { title: current?.title }
          : { ...current, description: value };
    emitSchema({
      ...schema,
      translations: {
        ...schema.translations,
        [editingLocale]: {
          ...(next.title === undefined ? {} : { title: next.title }),
          ...(next.description === undefined ? {} : { description: next.description })
        }
      }
    });
  };

  return (
    <section className="form-engine-builder" aria-label={translate("builder.formBuilder")}>
      <section className="form-engine-builder__pages" aria-labelledby="builder-pages-heading">
        <h2 id="builder-pages-heading">{translate("builder.pages")}</h2>
        {schema.pages === undefined ? (
          <button type="button" onClick={enablePages}>
            {translate("builder.enablePages")}
          </button>
        ) : (
          <>
            {schema.pages.map((page, pageIndex) => {
              const priorQuestionIds = new Set(schema.pages?.slice(0, pageIndex).flatMap((item) => item.questionIds));
              const availableSources = schema.fields.filter((field) => priorQuestionIds.has(field.id));
              const source = schema.fields.find((field) => field.id === page.displayCondition?.questionId);
              return (
                <fieldset className="form-engine-builder__page" key={page.id}>
                  <legend>{page.title ?? `${translate("builder.newPage")} ${pageIndex + 1}`}</legend>
                  <div className="form-engine-builder__toolbar">
                    <button
                      type="button"
                      disabled={pageIndex === 0}
                      aria-label={translate("builder.moveUp", { title: page.title ?? page.id })}
                      onClick={() => movePage(pageIndex, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={pageIndex === (schema.pages?.length ?? 0) - 1}
                      aria-label={translate("builder.moveDown", { title: page.title ?? page.id })}
                      onClick={() => movePage(pageIndex, 1)}
                    >
                      ↓
                    </button>
                    <button type="button" onClick={() => removePage(pageIndex)}>
                      {translate("builder.deleteAction")}
                    </button>
                  </div>
                  <div className="form-engine-builder__grid">
                    <label>
                      {translate("builder.pageTitle")}
                      <input
                        value={page.title ?? ""}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          updatePage(page.id, (current) => {
                            if (value.length > 0) return { ...current, title: value };
                            const { title: _title, ...withoutTitle } = current;
                            return withoutTitle;
                          });
                        }}
                      />
                    </label>
                    <label>
                      {translate("builder.pageDescription")}
                      <input
                        value={page.description ?? ""}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          updatePage(page.id, (current) => {
                            if (value.length > 0) return { ...current, description: value };
                            const { description: _description, ...withoutDescription } = current;
                            return withoutDescription;
                          });
                        }}
                      />
                    </label>
                  </div>
                  {editingLocale.length === 0 ? null : (
                    <div className="form-engine-builder__translation-editor">
                      <strong>{editingLocale}</strong>
                      <div className="form-engine-builder__grid">
                        <label>
                          {translate("builder.pageTitle")}
                          <input
                            value={page.translations?.[editingLocale]?.title ?? ""}
                            onChange={(event) => {
                              const value = event.currentTarget.value;
                              updatePage(page.id, (current) => ({
                                ...current,
                                translations: {
                                  ...current.translations,
                                  [editingLocale]: {
                                    ...(value.length === 0 ? {} : { title: value }),
                                    ...(current.translations?.[editingLocale]?.description === undefined
                                      ? {}
                                      : { description: current.translations[editingLocale]?.description })
                                  }
                                }
                              }));
                            }}
                          />
                        </label>
                        <label>
                          {translate("builder.pageDescription")}
                          <input
                            value={page.translations?.[editingLocale]?.description ?? ""}
                            onChange={(event) => {
                              const value = event.currentTarget.value;
                              updatePage(page.id, (current) => ({
                                ...current,
                                translations: {
                                  ...current.translations,
                                  [editingLocale]: {
                                    ...(current.translations?.[editingLocale]?.title === undefined
                                      ? {}
                                      : { title: current.translations[editingLocale]?.title }),
                                    ...(value.length === 0 ? {} : { description: value })
                                  }
                                }
                              }));
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  )}
                  <div className="form-engine-builder__condition">
                    <label>
                      {translate("builder.pageCondition")}
                      <select
                        value={page.displayCondition?.questionId ?? ""}
                        onChange={(event) => {
                          const selected = schema.fields.find((field) => field.id === event.currentTarget.value);
                          updatePage(page.id, (current) => {
                            if (selected === undefined) {
                              const { displayCondition: _condition, ...withoutCondition } = current;
                              return withoutCondition;
                            }
                            return {
                              ...current,
                              displayCondition: conditionWithValue(
                                selected.id,
                                conditionOperators(selected)[0] ?? "not_empty",
                                defaultConditionValue(selected)
                              )
                            };
                          });
                        }}
                      >
                        <option value="">{translate("builder.alwaysVisible")}</option>
                        {availableSources.map((field) => (
                          <option value={field.id} key={field.id}>
                            {field.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    {page.displayCondition !== undefined && source !== undefined ? (
                      <>
                        <select
                          aria-label={translate("builder.conditionOperator")}
                          value={page.displayCondition.operator}
                          onChange={(event) => {
                            const operator = event.currentTarget.value as ConditionOperator;
                            updatePage(page.id, (current) => ({
                              ...current,
                              displayCondition: conditionWithValue(source.id, operator, defaultConditionValue(source))
                            }));
                          }}
                        >
                          {conditionOperators(source).map((operator) => (
                            <option key={operator} value={operator}>
                              {translate(operatorKey(operator))}
                            </option>
                          ))}
                        </select>
                        <ConditionValueEditor
                          source={source}
                          condition={page.displayCondition}
                          onChange={(condition) =>
                            updatePage(page.id, (current) => ({ ...current, displayCondition: condition }))
                          }
                          translate={translate}
                        />
                      </>
                    ) : null}
                  </div>
                </fieldset>
              );
            })}
            <div className="form-engine-builder__page-add">
              <label>
                {translate("builder.pageQuestion")}
                <select
                  value={newPageQuestionId}
                  disabled={movablePageQuestions.length === 0}
                  onChange={(event) => setNewPageQuestionId(event.currentTarget.value)}
                >
                  <option value="">—</option>
                  {schema.fields
                    .filter((field) => movablePageQuestions.includes(field.id))
                    .map((field) => (
                      <option key={field.id} value={field.id}>
                        {field.title}
                      </option>
                    ))}
                </select>
              </label>
              <button type="button" disabled={movablePageQuestions.length === 0} onClick={addPage}>
                {translate("builder.addPage")}
              </button>
            </div>
          </>
        )}
      </section>

      <section className="form-engine-builder__localization" aria-labelledby="builder-localization-heading">
        <h2 id="builder-localization-heading">{translate("builder.localization")}</h2>
        <div className="form-engine-builder__grid">
          <label>
            {translate("builder.defaultLocale")}
            <input
              value={schema.defaultLocale ?? ""}
              onChange={(event) => {
                const value = event.currentTarget.value.trim();
                emitSchema(
                  value.length === 0
                    ? schema
                    : {
                        ...schema,
                        defaultLocale: value,
                        supportedLocales: [...new Set([value, ...(schema.supportedLocales ?? [])])]
                      }
                );
              }}
            />
          </label>
          <label>
            {translate("builder.addLocale")}
            <input value={newLocale} onChange={(event) => setNewLocale(event.currentTarget.value)} />
          </label>
          <button type="button" onClick={addLocale}>
            {translate("builder.addLocale")}
          </button>
          <label>
            {translate("builder.editLocale")}
            <select value={editingLocale} onChange={(event) => setEditingLocale(event.currentTarget.value)}>
              <option value="">—</option>
              {(schema.supportedLocales ?? [])
                .filter((item) => item !== schema.defaultLocale)
                .map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            disabled={translationAdapter === undefined || editingLocale.length === 0 || isTranslating}
            onClick={() => void translateAll()}
          >
            {translate("builder.autoTranslate")}
          </button>
        </div>
        {translationAdapter === undefined ? <p>{translate("builder.translationUnavailable")}</p> : null}
        {translationError === null ? null : <p className="form-engine-builder__error">{translationError}</p>}
        {editingLocale.length === 0 ? null : (
          <div className="form-engine-builder__grid">
            <label>
              {translate("builder.questionTitle")}
              <input
                value={schema.translations?.[editingLocale]?.title ?? ""}
                onChange={(event) => updateFormTranslation("title", event.currentTarget.value)}
              />
            </label>
            <label>
              {translate("builder.pageDescription")}
              <input
                value={schema.translations?.[editingLocale]?.description ?? ""}
                onChange={(event) => updateFormTranslation("description", event.currentTarget.value)}
              />
            </label>
          </div>
        )}
      </section>

      <div className="form-engine-builder__list">
        {schema.fields.map((field, index) => {
          const condition = field.displayCondition;
          const source =
            condition === undefined ? undefined : schema.fields.find((item) => item.id === condition.questionId);
          const availableSources = schema.fields.slice(0, index);
          return (
            <fieldset className="form-engine-builder__question" key={field.id}>
              <legend>{field.title}</legend>
              <div className="form-engine-builder__toolbar">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveField(index, -1)}
                  aria-label={translate("builder.moveUp", { title: field.title })}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={index === schema.fields.length - 1}
                  onClick={() => moveField(index, 1)}
                  aria-label={translate("builder.moveDown", { title: field.title })}
                >
                  ↓
                </button>
                <button
                  type="button"
                  disabled={schema.fields.length === 1}
                  onClick={() => removeField(field.id)}
                  aria-label={translate("builder.delete", { title: field.title })}
                >
                  {translate("builder.deleteAction")}
                </button>
              </div>
              <div className="form-engine-builder__grid">
                <label>
                  {translate("builder.questionTitle")}
                  <input
                    value={field.title}
                    placeholder={translate("builder.questionTitlePlaceholder")}
                    onChange={(event) =>
                      updateField(field.id, (current) => ({
                        ...current,
                        title: event.currentTarget.value.trim().length === 0 ? current.title : event.currentTarget.value
                      }))
                    }
                  />
                </label>
                <label>
                  {translate("builder.type")}
                  <select
                    value={field.type}
                    onChange={(event) => changeType(field.id, event.currentTarget.value as FieldType)}
                  >
                    {FIELD_TYPES.filter(
                      (type) => policy?.allowedFieldTypes === undefined || policy.allowedFieldTypes.includes(type)
                    ).map((type) => (
                      <option key={type} value={type}>
                        {translate(fieldTypeKey(type))}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-engine-builder__check">
                  <input
                    type="checkbox"
                    checked={field.required === true}
                    onChange={(event) =>
                      updateField(field.id, (current) => ({ ...current, required: event.currentTarget.checked }))
                    }
                  />
                  {translate("builder.required")}
                </label>
              </div>

              {schema.pages === undefined ? null : (
                <label>
                  {translate("builder.questionPage")}
                  <select
                    value={pageForField(field.id)?.id ?? ""}
                    onChange={(event) => assignFieldToPage(field.id, event.currentTarget.value)}
                  >
                    {schema.pages.map((page, pageIndex) => (
                      <option key={page.id} value={page.id}>
                        {page.title ?? `${translate("builder.newPage")} ${pageIndex + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {editingLocale.length === 0 ? null : (
                <div className="form-engine-builder__translation-editor">
                  <strong>{editingLocale}</strong>
                  <div className="form-engine-builder__grid">
                    <label>
                      {translate("builder.questionTitle")}
                      <input
                        value={field.translations?.[editingLocale]?.title ?? ""}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          updateField(field.id, (current) => ({
                            ...current,
                            translations: {
                              ...current.translations,
                              [editingLocale]: {
                                ...(value.length === 0 ? {} : { title: value }),
                                ...(current.translations?.[editingLocale]?.description === undefined
                                  ? {}
                                  : { description: current.translations[editingLocale]?.description })
                              }
                            }
                          }));
                        }}
                      />
                    </label>
                    <label>
                      {translate("builder.pageDescription")}
                      <input
                        value={field.translations?.[editingLocale]?.description ?? ""}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          updateField(field.id, (current) => ({
                            ...current,
                            translations: {
                              ...current.translations,
                              [editingLocale]: {
                                ...(current.translations?.[editingLocale]?.title === undefined
                                  ? {}
                                  : { title: current.translations[editingLocale]?.title }),
                                ...(value.length === 0 ? {} : { description: value })
                              }
                            }
                          }));
                        }}
                      />
                    </label>
                  </div>
                  {"options" in field
                    ? field.options.map((option, optionIndex) => (
                        <label key={option.id}>
                          {translate("builder.optionLabel", { index: optionIndex + 1 })} ({editingLocale})
                          <input
                            value={option.translations?.[editingLocale] ?? ""}
                            onChange={(event) => {
                              const value = event.currentTarget.value;
                              updateField(field.id, (current) => {
                                if (!("options" in current)) return current;
                                return {
                                  ...current,
                                  options: current.options.map((candidate) =>
                                    candidate.id === option.id
                                      ? {
                                          ...candidate,
                                          translations: Object.fromEntries([
                                            ...Object.entries(candidate.translations ?? {}).filter(
                                              ([localeKey]) => localeKey !== editingLocale
                                            ),
                                            ...(value.length === 0 ? [] : [[editingLocale, value] as const])
                                          ])
                                        }
                                      : candidate
                                  )
                                };
                              });
                            }}
                          />
                        </label>
                      ))
                    : null}
                </div>
              )}

              {field.type === "rating" ? (
                <div className="form-engine-builder__grid">
                  <label>
                    {translate("builder.minimum")}
                    <input
                      type="number"
                      value={field.min ?? 1}
                      onChange={(event) => {
                        const min = event.currentTarget.valueAsNumber;
                        if (!Number.isInteger(min)) return;
                        updateField(field.id, (current) =>
                          current.type === "rating"
                            ? { ...current, min, max: Math.max(min, current.max ?? 5) }
                            : current
                        );
                      }}
                    />
                  </label>
                  <label>
                    {translate("builder.maximum")}
                    <input
                      type="number"
                      value={field.max ?? 5}
                      onChange={(event) => {
                        const max = event.currentTarget.valueAsNumber;
                        if (!Number.isInteger(max)) return;
                        updateField(field.id, (current) =>
                          current.type === "rating"
                            ? { ...current, min: Math.min(current.min ?? 1, max), max }
                            : current
                        );
                      }}
                    />
                  </label>
                </div>
              ) : null}

              {"options" in field ? (
                <div className="form-engine-builder__options">
                  <strong>{translate("builder.options")}</strong>
                  {field.options.map((option, optionIndex) => (
                    <div className="form-engine-builder__option" key={option.id}>
                      <input
                        aria-label={translate("builder.optionLabel", { index: optionIndex + 1 })}
                        value={option.label}
                        placeholder={translate("builder.optionLabelPlaceholder")}
                        onChange={(event) =>
                          updateField(field.id, (current) => {
                            if (!("options" in current)) return current;
                            const label = event.currentTarget.value;
                            if (label.trim().length === 0) return current;
                            return {
                              ...current,
                              options: current.options.map((item, itemIndex) =>
                                itemIndex === optionIndex ? { ...item, label } : item
                              )
                            };
                          })
                        }
                      />
                      <button
                        type="button"
                        disabled={field.options.length === 1}
                        onClick={() => headless.removeOption(field.id, option.id)}
                      >
                        {translate("builder.remove")}
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    disabled={
                      policy?.maxOptionsPerField !== undefined && field.options.length >= policy.maxOptionsPerField
                    }
                    onClick={() => headless.addOption(field.id)}
                  >
                    {translate("builder.addOption")}
                  </button>
                </div>
              ) : null}

              <div className="form-engine-builder__condition">
                <label>
                  {translate("builder.displayCondition")}
                  <select
                    value={condition?.questionId ?? ""}
                    onChange={(event) => {
                      const selected = schema.fields.find((item) => item.id === event.currentTarget.value);
                      updateField(field.id, (current) => {
                        if (selected === undefined) {
                          const { displayCondition: _condition, ...withoutCondition } = current;
                          return withoutCondition as FormField;
                        }
                        const operator = conditionOperators(selected)[0] ?? "not_empty";
                        return {
                          ...current,
                          displayCondition: conditionWithValue(selected.id, operator, defaultConditionValue(selected))
                        };
                      });
                    }}
                  >
                    <option value="">{translate("builder.alwaysVisible")}</option>
                    {availableSources.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.title}
                      </option>
                    ))}
                  </select>
                </label>
                {condition !== undefined && source !== undefined ? (
                  <>
                    <select
                      aria-label={translate("builder.conditionOperator")}
                      value={condition.operator}
                      onChange={(event) => {
                        const operator = event.currentTarget.value as ConditionOperator;
                        updateField(field.id, (current) => ({
                          ...current,
                          displayCondition: conditionWithValue(source.id, operator, defaultConditionValue(source))
                        }));
                      }}
                    >
                      {conditionOperators(source).map((operator) => (
                        <option key={operator} value={operator}>
                          {translate(operatorKey(operator))}
                        </option>
                      ))}
                    </select>
                    <ConditionValueEditor
                      source={source}
                      condition={condition}
                      onChange={(next) => updateField(field.id, (current) => ({ ...current, displayCondition: next }))}
                      translate={translate}
                    />
                  </>
                ) : null}
              </div>
            </fieldset>
          );
        })}
      </div>
      <button
        className="form-engine-builder__add"
        type="button"
        disabled={policy?.maxFields !== undefined && schema.fields.length >= policy.maxFields}
        onClick={addField}
      >
        {translate("builder.addQuestion")}
      </button>
    </section>
  );
}
