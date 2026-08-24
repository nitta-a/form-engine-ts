import {
  type AsyncTranslationAdapter,
  type ConditionOperator,
  type ConditionValue,
  type DisplayCondition,
  type FieldType,
  type FormField,
  type FormPolicy,
  type FormSchema,
  type JsonValue,
  type PopulateTranslationOptions,
  populateSchemaTranslations,
  type QuestionType,
  type TranslationAdapter,
  type TranslationReport
} from "@form-engine-ts/core";
import { useState } from "react";
import {
  type BuilderActionError,
  type BuilderActionResult,
  type BuilderFactories,
  type BuilderTextTarget,
  useFormBuilder
} from "./hooks/useFormBuilder";
import type { BuilderActionContext, ManualTranslationContext } from "./types";

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

export function resolveInitialFieldType(
  defaultType?: QuestionType,
  allowedTypes?: readonly QuestionType[]
): QuestionType | null {
  if (defaultType !== undefined && (allowedTypes === undefined || allowedTypes.includes(defaultType))) {
    return defaultType;
  }
  if (allowedTypes !== undefined && allowedTypes.length > 0) return allowedTypes[0] ?? null;
  if (allowedTypes === undefined || allowedTypes.includes("text")) return "text";
  return null;
}

export interface FormBuilderFeatures {
  readonly pages?: boolean;
  readonly localization?: boolean;
  readonly conditions?: boolean;
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
  readonly className?: string;
  readonly defaultFieldType?: QuestionType;
  readonly onActionError?: (error: BuilderActionError, context: BuilderActionContext) => void;
  readonly createManualTranslationMetadata?: (
    context: ManualTranslationContext
  ) => Readonly<Record<string, JsonValue>> | undefined;
  readonly readOnly?: boolean;
  readonly features?: FormBuilderFeatures;
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
  factories,
  className = "",
  defaultFieldType,
  onActionError,
  createManualTranslationMetadata,
  readOnly = false,
  features
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
  const pagesEnabled = features?.pages ?? true;
  const localizationEnabled = features?.localization ?? true;
  const conditionsEnabled = features?.conditions ?? true;
  const executeAction = (run: () => BuilderActionResult, context: BuilderActionContext): BuilderActionResult => {
    if (readOnly) return { success: true };
    const result = run();
    if (!result.success) onActionError?.(result.error, context);
    return result;
  };
  const updateField = (fieldId: string, updater: (field: FormField) => FormField, params?: Record<string, unknown>) =>
    executeAction(() => headless.updateField(fieldId, updater), {
      action: "updateField",
      targetId: fieldId,
      ...(params === undefined ? {} : { params })
    });
  const changeType = (fieldId: string, type: FieldType) =>
    executeAction(() => headless.changeFieldType(fieldId, type), {
      action: "changeFieldType",
      targetId: fieldId,
      params: { type }
    });
  const removeField = (fieldId: string) =>
    executeAction(() => headless.removeField(fieldId), { action: "removeField", targetId: fieldId });
  const initialFieldType = resolveInitialFieldType(defaultFieldType, policy?.allowedFieldTypes);
  const maxFieldsReached = policy?.maxFields !== undefined && schema.fields.length >= policy.maxFields;

  const moveField = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    const field = schema.fields[index];
    if (field !== undefined) {
      executeAction(() => headless.moveField(field.id, target), {
        action: "moveField",
        targetId: field.id,
        params: { targetIndex: target }
      });
    }
  };

  const addField = () => {
    if (initialFieldType === null) return;
    executeAction(() => headless.addField(initialFieldType), { action: "addField" });
  };

  const enablePages = () => {
    if (schema.pages === undefined) executeAction(() => headless.addPage(), { action: "addPage" });
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
    executeAction(() => headless.addPage(questionId), {
      action: "addPage",
      targetId: questionId,
      params: { questionId }
    });
    setNewPageQuestionId("");
  };

  const removePage = (pageIndex: number) => {
    const page = schema.pages?.[pageIndex];
    if (page !== undefined)
      executeAction(() => headless.removePage(page.id), { action: "removePage", targetId: page.id });
  };

  const movePage = (pageIndex: number, offset: -1 | 1) => {
    const target = pageIndex + offset;
    const page = schema.pages?.[pageIndex];
    if (page !== undefined) {
      executeAction(() => headless.movePage(page.id, target), {
        action: "movePage",
        targetId: page.id,
        params: { targetIndex: target }
      });
    }
  };

  const updatePage = (
    pageId: string,
    update: (page: NonNullable<FormSchema["pages"]>[number]) => NonNullable<FormSchema["pages"]>[number]
  ) => {
    executeAction(() => headless.updatePage(pageId, update), {
      action: "updatePage",
      targetId: pageId
    });
  };

  const assignFieldToPage = (fieldId: string, pageId: string) => {
    executeAction(() => headless.assignFieldToPage(fieldId, pageId), {
      action: "assignFieldToPage",
      targetId: fieldId,
      params: { pageId }
    });
  };

  const addLocale = () => {
    if (readOnly) return;
    const normalized = newLocale.trim();
    if (normalized.length === 0) return;
    const result = executeAction(() => headless.addLocale(normalized), {
      action: "addLocale",
      params: { locale: normalized }
    });
    if (!result.success) return;
    setEditingLocale(normalized);
    setNewLocale("");
  };

  const setDefaultLocale = (locale: string) =>
    executeAction(() => headless.setDefaultLocale(locale), {
      action: "setDefaultLocale",
      params: { locale }
    });

  const translateAll = async () => {
    if (readOnly || translationAdapter === undefined || editingLocale.length === 0) return;
    setIsTranslating(true);
    setTranslationError(null);
    try {
      const populated = await populateSchemaTranslations(schema, [editingLocale], translationAdapter, {
        overwrite: "missing-only",
        ...translationOptions
      });
      onChange(populated.schema);
      onTranslationReport?.(populated.report);
    } catch (cause) {
      setTranslationError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setIsTranslating(false);
    }
  };

  const updateManualTranslation = (context: ManualTranslationContext) => {
    if (readOnly) return;
    const metadata = createManualTranslationMetadata?.(context);
    const target =
      context.kind === "form" ? ({ kind: "form" } as const) : ({ kind: context.kind, id: context.nodeId } as const);
    executeAction(
      () =>
        headless.setLocaleTranslation(
          context.locale,
          target,
          context.property,
          context.translatedText,
          metadata === undefined ? undefined : { metadata }
        ),
      {
        action: "setLocaleTranslation",
        targetId: context.nodeId,
        params: { locale: context.locale, kind: context.kind, property: context.property }
      }
    );
  };

  const updateFormTranslation = (property: "title" | "description" | "completionMessage", translatedText: string) => {
    if (editingLocale.length === 0) return;
    updateManualTranslation({
      locale: editingLocale,
      kind: "form",
      nodeId: schema.id,
      property,
      sourceText: schema[property] ?? "",
      translatedText,
      ...(schema.translationMetadata?.[editingLocale]?.[property] === undefined
        ? {}
        : { existingTranslationMetadata: schema.translationMetadata[editingLocale]?.[property] })
    });
  };

  const setSourceText = (target: BuilderTextTarget, property: string, text: string) =>
    executeAction(() => headless.setSourceText(target, property, text), {
      action: "setSourceText",
      ...(target.id === undefined ? {} : { targetId: target.id }),
      params: { kind: target.kind, property }
    });
  const updateOption = (fieldId: string, optionId: string, label: string) =>
    executeAction(() => headless.updateOption(fieldId, optionId, (option) => ({ ...option, label })), {
      action: "updateOption",
      targetId: optionId,
      params: { fieldId }
    });
  const addOption = (fieldId: string) =>
    executeAction(() => headless.addOption(fieldId), { action: "addOption", targetId: fieldId });
  const removeOption = (fieldId: string, optionId: string) =>
    executeAction(() => headless.removeOption(fieldId, optionId), {
      action: "removeOption",
      targetId: optionId,
      params: { fieldId }
    });
  const moveOption = (fieldId: string, optionId: string, targetIndex: number) =>
    executeAction(() => headless.moveOption(fieldId, optionId, targetIndex), {
      action: "moveOption",
      targetId: optionId,
      params: { fieldId, targetIndex }
    });
  const setDisplayCondition = (fieldId: string, condition?: DisplayCondition) =>
    executeAction(() => headless.setDisplayCondition(fieldId, condition), {
      action: "setDisplayCondition",
      targetId: fieldId,
      ...(condition === undefined ? {} : { params: { condition } })
    });
  const registeredLocales = new Set([
    ...(schema.defaultLocale === undefined ? [] : [schema.defaultLocale]),
    ...(schema.supportedLocales ?? [])
  ]);
  const availableAllowedLocales = policy?.allowedLocales?.filter((candidate) => !registeredLocales.has(candidate));
  const localeLimitReached = policy?.maxLocales !== undefined && registeredLocales.size >= policy.maxLocales;

  return (
    <section
      className={`form-engine-builder ${className}`.trim()}
      aria-label={translate("builder.formBuilder")}
      onClickCapture={(event) => {
        if (readOnly) return;
        if (!(event.target instanceof HTMLElement)) return;
        const actionTarget = event.target.closest<HTMLElement>("[data-builder-action]");
        if (actionTarget?.dataset.builderAction === "addField" && maxFieldsReached && initialFieldType !== null)
          addField();
        if (actionTarget?.dataset.builderAction === "addLocale" && localeLimitReached && newLocale.trim().length > 0)
          addLocale();
        if (actionTarget?.dataset.builderAction !== "addOption") return;
        const fieldId = actionTarget.dataset.targetId;
        const field = schema.fields.find((candidate) => candidate.id === fieldId);
        if (
          fieldId !== undefined &&
          field !== undefined &&
          "options" in field &&
          policy?.maxOptionsPerField !== undefined &&
          field.options.length >= policy.maxOptionsPerField
        ) {
          addOption(fieldId);
        }
      }}
    >
      <fieldset className="form-engine-builder__controls" disabled={readOnly}>
        {pagesEnabled ? (
          <section className="form-engine-builder__pages" aria-labelledby="builder-pages-heading">
            <h2 id="builder-pages-heading">{translate("builder.pages")}</h2>
            {schema.pages === undefined ? (
              <button type="button" onClick={enablePages}>
                {translate("builder.enablePages")}
              </button>
            ) : (
              <>
                {schema.pages.map((page, pageIndex) => {
                  const priorQuestionIds = new Set(
                    schema.pages?.slice(0, pageIndex).flatMap((item) => item.questionIds)
                  );
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
                      {!localizationEnabled || editingLocale.length === 0 ? null : (
                        <div className="form-engine-builder__translation-editor">
                          <strong>{editingLocale}</strong>
                          <div className="form-engine-builder__grid">
                            <label>
                              {translate("builder.pageTitle")}
                              <input
                                value={page.translations?.[editingLocale]?.title ?? ""}
                                onChange={(event) =>
                                  updateManualTranslation({
                                    locale: editingLocale,
                                    kind: "page",
                                    nodeId: page.id,
                                    property: "title",
                                    sourceText: page.title ?? "",
                                    translatedText: event.currentTarget.value,
                                    ...(page.translationMetadata?.[editingLocale]?.title === undefined
                                      ? {}
                                      : {
                                          existingTranslationMetadata: page.translationMetadata[editingLocale]?.title
                                        })
                                  })
                                }
                              />
                            </label>
                            <label>
                              {translate("builder.pageDescription")}
                              <input
                                value={page.translations?.[editingLocale]?.description ?? ""}
                                onChange={(event) =>
                                  updateManualTranslation({
                                    locale: editingLocale,
                                    kind: "page",
                                    nodeId: page.id,
                                    property: "description",
                                    sourceText: page.description ?? "",
                                    translatedText: event.currentTarget.value,
                                    ...(page.translationMetadata?.[editingLocale]?.description === undefined
                                      ? {}
                                      : {
                                          existingTranslationMetadata:
                                            page.translationMetadata[editingLocale]?.description
                                        })
                                  })
                                }
                              />
                            </label>
                          </div>
                        </div>
                      )}
                      {conditionsEnabled ? (
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
                                    displayCondition: conditionWithValue(
                                      source.id,
                                      operator,
                                      defaultConditionValue(source)
                                    )
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
                      ) : null}
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
        ) : null}

        {localizationEnabled ? (
          <section className="form-engine-builder__localization" aria-labelledby="builder-localization-heading">
            <h2 id="builder-localization-heading">{translate("builder.localization")}</h2>
            <label>
              {translate("builder.completionMessage")}
              <input
                value={schema.completionMessage ?? ""}
                onChange={(event) => setSourceText({ kind: "form" }, "completionMessage", event.currentTarget.value)}
              />
            </label>
            <div className="form-engine-builder__grid">
              <label>
                {translate("builder.defaultLocale")}
                <input
                  value={schema.defaultLocale ?? ""}
                  onChange={(event) => setDefaultLocale(event.currentTarget.value)}
                />
              </label>
              <label htmlFor="builder-new-locale">
                {translate("builder.addLocale")}
                {availableAllowedLocales === undefined ? (
                  <input
                    id="builder-new-locale"
                    value={newLocale}
                    onChange={(event) => setNewLocale(event.currentTarget.value)}
                  />
                ) : (
                  <select
                    id="builder-new-locale"
                    value={newLocale}
                    onChange={(event) => setNewLocale(event.currentTarget.value)}
                  >
                    <option value="">—</option>
                    {availableAllowedLocales.map((candidate) => (
                      <option key={candidate} value={candidate}>
                        {candidate}
                      </option>
                    ))}
                  </select>
                )}
              </label>
              <button
                type="button"
                data-builder-action="addLocale"
                disabled={newLocale.trim().length === 0 || localeLimitReached}
                onClick={addLocale}
              >
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
        ) : null}

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
                          title:
                            event.currentTarget.value.trim().length === 0 ? current.title : event.currentTarget.value
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

                {!pagesEnabled || schema.pages === undefined ? null : (
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

                {!localizationEnabled || editingLocale.length === 0 ? null : (
                  <div className="form-engine-builder__translation-editor">
                    <strong>{editingLocale}</strong>
                    <div className="form-engine-builder__grid">
                      <label>
                        {translate("builder.questionTitle")}
                        <input
                          value={field.translations?.[editingLocale]?.title ?? ""}
                          onChange={(event) =>
                            updateManualTranslation({
                              locale: editingLocale,
                              kind: "field",
                              nodeId: field.id,
                              property: "title",
                              sourceText: field.title,
                              translatedText: event.currentTarget.value,
                              ...(field.translationMetadata?.[editingLocale]?.title === undefined
                                ? {}
                                : {
                                    existingTranslationMetadata: field.translationMetadata[editingLocale]?.title
                                  })
                            })
                          }
                        />
                      </label>
                      <label>
                        {translate("builder.pageDescription")}
                        <input
                          value={field.translations?.[editingLocale]?.description ?? ""}
                          onChange={(event) =>
                            updateManualTranslation({
                              locale: editingLocale,
                              kind: "field",
                              nodeId: field.id,
                              property: "description",
                              sourceText: field.description ?? "",
                              translatedText: event.currentTarget.value,
                              ...(field.translationMetadata?.[editingLocale]?.description === undefined
                                ? {}
                                : {
                                    existingTranslationMetadata: field.translationMetadata[editingLocale]?.description
                                  })
                            })
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
                                updateManualTranslation({
                                  locale: editingLocale,
                                  kind: "option",
                                  nodeId: option.id,
                                  property: "label",
                                  sourceText: option.label,
                                  translatedText: event.currentTarget.value,
                                  ...(option.translationMetadata?.[editingLocale]?.label === undefined
                                    ? {}
                                    : {
                                        existingTranslationMetadata: option.translationMetadata[editingLocale]?.label
                                      })
                                })
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
                              : updateOption(field.id, option.id, event.currentTarget.value)
                          }
                        />
                        <button
                          type="button"
                          disabled={optionIndex === 0}
                          aria-label={translate("builder.moveUp", { title: option.label })}
                          onClick={() => moveOption(field.id, option.id, optionIndex - 1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={optionIndex === field.options.length - 1}
                          aria-label={translate("builder.moveDown", { title: option.label })}
                          onClick={() => moveOption(field.id, option.id, optionIndex + 1)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          disabled={field.options.length === 1}
                          onClick={() => removeOption(field.id, option.id)}
                        >
                          {translate("builder.remove")}
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      data-builder-action="addOption"
                      data-target-id={field.id}
                      disabled={
                        policy?.maxOptionsPerField !== undefined && field.options.length >= policy.maxOptionsPerField
                      }
                      onClick={() => addOption(field.id)}
                    >
                      {translate("builder.addOption")}
                    </button>
                  </div>
                ) : null}

                {conditionsEnabled ? (
                  <div className="form-engine-builder__condition">
                    <label>
                      {translate("builder.displayCondition")}
                      <select
                        value={condition?.questionId ?? ""}
                        onChange={(event) => {
                          const selected = schema.fields.find((item) => item.id === event.currentTarget.value);
                          setDisplayCondition(
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
                            setDisplayCondition(
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
                          onChange={(next) => setDisplayCondition(field.id, next)}
                          translate={translate}
                        />
                      </>
                    ) : null}
                  </div>
                ) : null}
              </fieldset>
            );
          })}
        </div>
        <button
          className="form-engine-builder__add"
          type="button"
          data-builder-action="addField"
          disabled={initialFieldType === null || maxFieldsReached}
          onClick={addField}
        >
          {translate("builder.addQuestion")}
        </button>
      </fieldset>
    </section>
  );
}
