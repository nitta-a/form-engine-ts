import type { TranslationAdapter } from "@form-engine-ts/core";
import { TranslationComparisonWorkspace } from "@form-engine-ts/mui";
import { usePreviewWorkspace } from "../workspace/PreviewWorkspaceContext";

const previewTranslationAdapter: TranslationAdapter = {
  translate(text, locale) {
    return `[${locale}] ${text}`;
  }
};

export function TranslationComparisonPanel() {
  const { schema, locale, changeSchema } = usePreviewWorkspace();
  const targetLocale = schema.defaultLocale === "en" ? "ja" : "en";
  return (
    <section className="workspace-card">
      <h2>{locale === "ja" ? "左右比較翻訳ワークスペース" : "Translation comparison workspace"}</h2>
      <TranslationComparisonWorkspace
        schema={schema}
        targetLocale={targetLocale}
        translationAdapter={previewTranslationAdapter}
        onChange={changeSchema}
        i18n={{ locale }}
      />
    </section>
  );
}
