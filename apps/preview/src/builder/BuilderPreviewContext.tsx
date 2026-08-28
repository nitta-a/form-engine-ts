import { populateSchemaTranslations } from "@form-engine-ts/core";
import { mockAsyncTranslator } from "@form-engine-ts/translator-mock";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { usePreviewWorkspace } from "../workspace/PreviewWorkspaceContext";

export type TranslationOverwrite = "missing-only" | "all";

export interface BuilderPreviewContextValue {
  readonly translationOverwrite: TranslationOverwrite;
  readonly translationReport: string | null;
  readonly builderActionStatus: string | null;
  readonly builderReadOnly: boolean;
  readonly pagesEnabled: boolean;
  readonly localizationEnabled: boolean;
  readonly conditionsEnabled: boolean;
  readonly useCustomBuilderUi: boolean;
  readonly setTranslationOverwrite: (value: TranslationOverwrite) => void;
  readonly setBuilderReadOnly: (value: boolean) => void;
  readonly setPagesEnabled: (value: boolean) => void;
  readonly setLocalizationEnabled: (value: boolean) => void;
  readonly setConditionsEnabled: (value: boolean) => void;
  readonly setUseCustomBuilderUi: (value: boolean) => void;
  readonly setTranslationReport: (message: string) => void;
  readonly setBuilderActionStatus: (message: string) => void;
  readonly runTranslationPolicy: () => Promise<void>;
}

const BuilderPreviewContext = createContext<BuilderPreviewContextValue | null>(null);

export function BuilderPreviewProvider({ children }: { readonly children: ReactNode }) {
  const { schema, locale, workspaceReady, changeSchema } = usePreviewWorkspace();
  const [translationOverwrite, setTranslationOverwrite] = useState<TranslationOverwrite>("missing-only");
  const [translationReport, setTranslationReport] = useState<string | null>(null);
  const [builderActionStatus, setBuilderActionStatus] = useState<string | null>(null);
  const [builderReadOnly, setBuilderReadOnly] = useState(false);
  const [pagesEnabled, setPagesEnabled] = useState(true);
  const [localizationEnabled, setLocalizationEnabled] = useState(true);
  const [conditionsEnabled, setConditionsEnabled] = useState(true);
  const [useCustomBuilderUi, setUseCustomBuilderUi] = useState(false);

  const runTranslationPolicy = useCallback(async () => {
    if (!workspaceReady) return;
    const targetLocale =
      locale === schema.defaultLocale
        ? (schema.supportedLocales?.find((candidate) => candidate !== schema.defaultLocale) ?? "en")
        : locale;
    const result = await populateSchemaTranslations(schema, [targetLocale], mockAsyncTranslator, {
      overwrite: translationOverwrite,
      createMetadata: (slot) => ({ source: "preview-mock", property: slot.property })
    });
    changeSchema(result.schema);
    setTranslationReport(
      `${result.report.updatedSlots.length} updated / ${result.report.skippedSlots.length} skipped (${translationOverwrite})`
    );
  }, [changeSchema, locale, schema, translationOverwrite, workspaceReady]);

  const contextValue = useMemo<BuilderPreviewContextValue>(
    () => ({
      translationOverwrite,
      translationReport,
      builderActionStatus,
      builderReadOnly,
      pagesEnabled,
      localizationEnabled,
      conditionsEnabled,
      useCustomBuilderUi,
      setTranslationOverwrite,
      setBuilderReadOnly,
      setPagesEnabled,
      setLocalizationEnabled,
      setConditionsEnabled,
      setUseCustomBuilderUi,
      setTranslationReport,
      setBuilderActionStatus,
      runTranslationPolicy
    }),
    [
      builderActionStatus,
      builderReadOnly,
      conditionsEnabled,
      localizationEnabled,
      pagesEnabled,
      runTranslationPolicy,
      translationOverwrite,
      translationReport,
      useCustomBuilderUi
    ]
  );

  return <BuilderPreviewContext.Provider value={contextValue}>{children}</BuilderPreviewContext.Provider>;
}

export function useBuilderPreview(): BuilderPreviewContextValue {
  const context = useContext(BuilderPreviewContext);
  if (context === null) throw new Error("useBuilderPreview must be called inside a BuilderPreviewProvider.");
  return context;
}
