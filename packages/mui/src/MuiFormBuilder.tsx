import {
  getContentModeDiagnostics,
  getContentModePolicy,
  getFormContentMode,
  validateFormSchema
} from "@form-engine-ts/core";
import {
  FormBuilder,
  type FormBuilderComponents,
  type FormBuilderProps,
  type FormBuilderSectionName,
  type FormBuilderSlots,
  FormEngineI18nProvider
} from "@form-engine-ts/react";
import { useEffect, useMemo } from "react";
import { muiBuilderComponents } from "./components";
import type {
  MuiContentModeOptions,
  MuiFormBuilderValidationIssue,
  MuiFormBuilderValidationState
} from "./contentModeTypes";
import { MuiFormBuilderContext, mergeMuiAdapterOptions } from "./context";
import { QuizFieldEditor, QuizOptionEditor } from "./QuizEditorSlots";
import { MuiContentModeSettingsSlot, muiBuilderSlots } from "./slots";
import {
  DEFAULT_MUI_SECTION_ORDER,
  MUI_LOCALIZATION_SECTION_ORDERS,
  type MuiAdapterOptions,
  type MuiBuilderSlotProps,
  type MuiFormEngineI18nOptions,
  type MuiLayoutOptions,
  type MuiLocalizationOptions,
  type MuiLocalizationSlotOptions,
  type MuiSubmissionSettingsOptions
} from "./types";

export type {
  MuiContentModeControls,
  MuiContentModeOptions,
  MuiFormBuilderValidationIssue,
  MuiFormBuilderValidationState
} from "./contentModeTypes";

export interface MuiFormBuilderProps
  extends Omit<FormBuilderProps, "components" | "disableDefaultStyles" | "slots" | "unstyled"> {
  readonly contentModeOptions?: MuiContentModeOptions;
  readonly muiOptions?: MuiAdapterOptions;
  readonly layoutOptions?: MuiLayoutOptions;
  readonly localizationOptions?: MuiLocalizationOptions;
  readonly localization?: MuiLocalizationSlotOptions;
  readonly submissionSettingsOptions?: MuiSubmissionSettingsOptions;
  readonly muiSlotProps?: MuiBuilderSlotProps;
  readonly components?: Partial<FormBuilderComponents>;
  readonly slots?: Partial<FormBuilderSlots>;
  readonly i18n?: MuiFormEngineI18nOptions;
}

export function MuiFormBuilder({
  muiOptions,
  contentModeOptions,
  layoutOptions,
  localizationOptions,
  localization,
  submissionSettingsOptions,
  muiSlotProps,
  components: customComponents,
  slots: customSlots,
  i18n,
  sectionOrder,
  policy,
  defaultFieldType,
  ...props
}: MuiFormBuilderProps) {
  const contextOptions = useMemo<MuiAdapterOptions>(
    () =>
      mergeMuiAdapterOptions(muiOptions, {
        ...(layoutOptions === undefined ? {} : { layoutOptions }),
        ...(localizationOptions === undefined ? {} : { localizationOptions }),
        ...(localization === undefined ? {} : { localization }),
        ...(muiSlotProps === undefined ? {} : { muiSlotProps })
      }),
    [layoutOptions, localization, localizationOptions, muiOptions, muiSlotProps]
  );
  const resolvedMuiOptions = useMemo(
    () =>
      mergeMuiAdapterOptions(contextOptions, {
        ...(i18n?.getLocaleLabel === undefined ? {} : { getLocaleLabel: i18n.getLocaleLabel }),
        ...(i18n?.getActionLabel === undefined ? {} : { getActionLabel: i18n.getActionLabel })
      }),
    [contextOptions, i18n?.getActionLabel, i18n?.getLocaleLabel]
  );
  const components = useMemo(() => ({ ...muiBuilderComponents, ...customComponents }), [customComponents]);
  const contentMode = getFormContentMode(props.schema.metadata);
  const resolvedPolicy = useMemo(
    () =>
      contentModeOptions?.applyPolicy === false || contentMode === "survey"
        ? policy
        : getContentModePolicy(contentMode, policy),
    [contentMode, contentModeOptions?.applyPolicy, policy]
  );
  const validationState = useMemo<MuiFormBuilderValidationState>(() => {
    const schemaResult = validateFormSchema(
      props.schema,
      resolvedPolicy === undefined ? {} : { policy: resolvedPolicy }
    );
    const schemaIssues: readonly MuiFormBuilderValidationIssue[] = schemaResult.issues.map((issue) => ({
      source: "schema",
      path: issue.path,
      code: issue.code,
      message: issue.message
    }));
    const contentIssues: readonly MuiFormBuilderValidationIssue[] = getContentModeDiagnostics(props.schema).map(
      (issue) => ({ source: "contentMode", path: issue.path, code: issue.code, message: issue.message })
    );
    const hasContentFieldCountIssue = contentIssues.some(
      (issue) => issue.code === "poll_field_count" || issue.code === "quiz_field_count"
    );
    const hasMatchingContentFieldTypeIssue = (path: string) => {
      const match = /^fields\[(\d+)]\.type$/.exec(path);
      if (match === null) return false;
      const fieldIndex = Number(match[1]);
      const fieldId = props.schema.fields[fieldIndex]?.id;
      return contentIssues.some((issue) => issue.code === "unsupported_field_type" && issue.path === fieldId);
    };
    const seen = new Set<string>();
    const issues = [...contentIssues, ...schemaIssues].filter((issue) => {
      if (issue.source === "schema" && issue.code === "max_fields_exceeded" && hasContentFieldCountIssue) return false;
      if (
        issue.source === "schema" &&
        issue.code === "disallowed_field_type" &&
        hasMatchingContentFieldTypeIssue(issue.path)
      )
        return false;
      const key = `${issue.path}\u0000${issue.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return { mode: contentMode, valid: issues.length === 0, issues };
  }, [contentMode, props.schema, resolvedPolicy]);
  useEffect(() => {
    contentModeOptions?.onValidationChange?.(validationState);
  }, [contentModeOptions?.onValidationChange, validationState]);
  const contextValue = useMemo(
    () => ({
      options: resolvedMuiOptions,
      ...(contentModeOptions === undefined ? {} : { contentModeOptions }),
      validationState
    }),
    [resolvedMuiOptions, contentModeOptions, validationState]
  );
  const slots = useMemo(() => {
    const automaticQuizSlots: Partial<FormBuilderSlots> =
      contentMode !== "quiz"
        ? {}
        : {
            ...(customSlots?.fieldEditorAfter === undefined ? { fieldEditorAfter: QuizFieldEditor } : {}),
            ...(customSlots?.optionEditorAfter === undefined ? { optionEditorAfter: QuizOptionEditor } : {})
          };
    return {
      ...muiBuilderSlots,
      basicSettingsAfter: MuiContentModeSettingsSlot,
      ...automaticQuizSlots,
      ...customSlots
    };
  }, [contentMode, customSlots]);
  const placement = contextOptions.localizationOptions?.placement;
  const baseSectionOrder =
    sectionOrder ??
    (placement === undefined ? contextOptions.layoutOptions?.sectionOrder : MUI_LOCALIZATION_SECTION_ORDERS[placement]);
  const resolvedSectionOrder: readonly FormBuilderSectionName[] | undefined = (():
    | readonly FormBuilderSectionName[]
    | undefined => {
    if (submissionSettingsOptions?.enabled !== true) return baseSectionOrder;
    const order: FormBuilderSectionName[] = [
      ...((baseSectionOrder ?? DEFAULT_MUI_SECTION_ORDER) as readonly FormBuilderSectionName[])
    ].filter((name) => name !== "submissionSettings");
    const settingsPlacement = submissionSettingsOptions.placement ?? "bottom";
    const target =
      settingsPlacement === "beforeQuestions"
        ? "questions"
        : settingsPlacement === "afterQuestions"
          ? "addQuestion"
          : undefined;
    if (target === undefined) return [...order, "submissionSettings"];
    const index = order.indexOf(target);
    order.splice(
      index < 0 ? order.length : index + (settingsPlacement === "afterQuestions" ? 1 : 0),
      0,
      "submissionSettings"
    );
    return order;
  })();
  const content = (
    <MuiFormBuilderContext.Provider value={contextValue}>
      <FormBuilder
        {...props}
        {...(resolvedPolicy === undefined ? {} : { policy: resolvedPolicy })}
        {...(defaultFieldType === undefined
          ? contentMode === "survey"
            ? {}
            : { defaultFieldType: "radio" as const }
          : { defaultFieldType })}
        components={components}
        disableDefaultStyles
        slots={slots}
        {...(resolvedSectionOrder === undefined ? {} : { sectionOrder: resolvedSectionOrder })}
        {...(submissionSettingsOptions === undefined ? {} : { submissionSettingsOptions })}
      />
    </MuiFormBuilderContext.Provider>
  );
  if (i18n === undefined) return content;
  return (
    <FormEngineI18nProvider
      {...(i18n.locale === undefined ? {} : { locale: i18n.locale })}
      {...(i18n.fallbackLocale === undefined ? {} : { fallbackLocale: i18n.fallbackLocale })}
      {...(i18n.messages === undefined ? {} : { messages: i18n.messages })}
      {...(i18n.customCatalogs === undefined ? {} : { customCatalogs: i18n.customCatalogs })}
      {...(i18n.onMissingKey === undefined ? {} : { onMissingKey: i18n.onMissingKey })}
      {...(i18n.strict === undefined ? {} : { strict: i18n.strict })}
      {...(i18n.translator === undefined ? {} : { translator: i18n.translator })}
    >
      {content}
    </FormEngineI18nProvider>
  );
}
