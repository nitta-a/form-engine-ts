import {
  type AsyncTranslationAdapter,
  type ConditionOperator,
  type ConditionValue,
  type DisplayCondition,
  type FieldType,
  type FormField,
  type FormPolicy,
  type FormSchema,
  type PopulateTranslationOptions,
  populateSchemaTranslations,
  type TranslationAdapter,
  type TranslationReport
} from "@form-engine-ts/core";
import { useState } from "react";
import { type BuilderFactories, useFormBuilder } from "./hooks/useFormBuilder";

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
  "builder.completionMessage": "Completion message",
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
  readonly translationOptions?: PopulateTranslationOptions;
  readonly onTranslationReport?: (report: TranslationReport) => void;
  readonly policy?: FormPolicy;
  readonly idFactory?: (kind: "field" | "option" | "page", existingIds: ReadonlySet<string>) => string;
  readonly factories?: BuilderFactories;
}

export function FormBuilder({
  schema,
  onChange,
  locale = "en",
  translator,
  translationAdapter,
  translationOptions,
  onTranslationReport,
  policy,
  idFactory,
  factories
}: FormBuilderProps) {
  const headless = useFormBuilder({
    schema,
    onChange,
    ...(policy === undefined ? {} : { policy }),
    ...(idFactory === undefined ? {} : { idFactory }),
    ...(factories === undefined ? {} : { factories })
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
  const updateField = headless.updateField;
  const changeType = headless.changeFieldType;

  const removeField = headless.removeField;

  const moveField = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    const field = schema.fields[index];
    if (field !== undefined) headless.moveField(field.id, target);
  };

  const addField = () => headless.addField("text");

  const enablePages = () => {
    if (schema.pages === undefined) headless.addPage();
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
    headless.addPage(questionId);
    setNewPageQuestionId("");
  };

  const removePage = (pageIndex: number) => {
    const page = schema.pages?.[pageIndex];
    if (page !== undefined) headless.removePage(page.id);
  };

  const movePage = (pageIndex: number, offset: -1 | 1) => {
    const target = pageIndex + offset;
    const page = schema.pages?.[pageIndex];
    if (page !== undefined) headless.movePage(page.id, target);
  };

  const updatePage = (
    pageId: string,
    update: (page: NonNullable<FormSchema["pages"]>[number]) => NonNullable<FormSchema["pages"]>[number]
  ) => {
    headless.updatePage(pageId, update);
  };

  const assignFieldToPage = (fieldId: string, pageId: string) => {
    headless.assignFieldToPage(fieldId, pageId);
  };

  const addLocale = () => {
    const normalized = newLocale.trim();
    if (normalized.length === 0) return;
    headless.addLocale(normalized);
    setEditingLocale(normalized);
    setNewLocale("");
  };

  const translateAll = async () => {
    if (translationAdapter === undefined || editingLocale.length === 0) return;
    setIsTranslating(true);
    setTranslationError(null);
    try {
      const populated = await populateSchemaTranslations(
        schema,
        [editingLocale],
        translationAdapter,
        translationOptions ?? { overwrite: "all" }
      );
      onChange(populated.schema);
      onTranslationReport?.(populated.report);
    } catch (cause) {
      setTranslationError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setIsTranslating(false);
    }
  };

  const updateFormTranslation = (key: "title" | "description" | "completionMessage", value: string) => {
    if (editingLocale.length === 0) return;
    headless.setLocaleTranslation(editingLocale, { kind: "form" }, key, value);
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
                            onChange={(event) =>
                              headless.setLocaleTranslation(
                                editingLocale,
                                { kind: "page", id: page.id },
                                "title",
                                event.currentTarget.value
                              )
                            }
                          />
                        </label>
                        <label>
                          {translate("builder.pageDescription")}
                          <input
                            value={page.translations?.[editingLocale]?.description ?? ""}
                            onChange={(event) =>
                              headless.setLocaleTranslation(
                                editingLocale,
                                { kind: "page", id: page.id },
                                "description",
                                event.currentTarget.value
                              )
                            }
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
        <label>
          {translate("builder.completionMessage")}
          <input
            value={schema.completionMessage ?? ""}
            onChange={(event) =>
              headless.setSourceText({ kind: "form" }, "completionMessage", event.currentTarget.value)
            }
          />
        </label>
        <div className="form-engine-builder__grid">
          <label>
            {translate("builder.defaultLocale")}
            <input
              value={schema.defaultLocale ?? ""}
              onChange={(event) => headless.setDefaultLocale(event.currentTarget.value)}
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
            <label>
              {translate("builder.completionMessage")}
              <input
                value={schema.translations?.[editingLocale]?.completionMessage ?? ""}
                onChange={(event) => updateFormTranslation("completionMessage", event.currentTarget.value)}
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
                        onChange={(event) =>
                          headless.setLocaleTranslation(
                            editingLocale,
                            { kind: "field", id: field.id },
                            "title",
                            event.currentTarget.value
                          )
                        }
                      />
                    </label>
                    <label>
                      {translate("builder.pageDescription")}
                      <input
                        value={field.translations?.[editingLocale]?.description ?? ""}
                        onChange={(event) =>
                          headless.setLocaleTranslation(
                            editingLocale,
                            { kind: "field", id: field.id },
                            "description",
                            event.currentTarget.value
                          )
                        }
                      />
                    </label>
                  </div>
                  {"options" in field
                    ? field.options.map((option, optionIndex) => (
                        <label key={option.id}>
                          {translate("builder.optionLabel", { index: optionIndex + 1 })} ({editingLocale})
                          <input
                            value={option.translations?.[editingLocale] ?? ""}
                            onChange={(event) =>
                              headless.setLocaleTranslation(
                                editingLocale,
                                { kind: "option", id: option.id },
                                "label",
                                event.currentTarget.value
                              )
                            }
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
                          event.currentTarget.value.trim().length === 0
                            ? undefined
                            : headless.updateOption(field.id, option.id, (item) => ({
                                ...item,
                                label: event.currentTarget.value
                              }))
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
                      headless.setDisplayCondition(
                        field.id,
                        selected === undefined
                          ? undefined
                          : conditionWithValue(
                              selected.id,
                              conditionOperators(selected)[0] ?? "not_empty",
                              defaultConditionValue(selected)
                            )
                      );
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
                        headless.setDisplayCondition(
                          field.id,
                          conditionWithValue(source.id, operator, defaultConditionValue(source))
                        );
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
                      onChange={(next) => headless.setDisplayCondition(field.id, next)}
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
