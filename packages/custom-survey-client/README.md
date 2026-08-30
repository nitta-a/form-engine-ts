# @form-engine-ts/custom-survey-client

React composite APIs for survey applications. The package composes the existing Form Engine builder and translation primitives while keeping persistence, translation services, authentication, and state libraries injectable.

```tsx
<SurveyUiProvider locale="ja" translationAdapter={uiTranslations}>
  <SurveyEditor schema={schema} adapter={editorAdapter} onChange={setSchema} />
  <SurveyResponseSummary summary={summary} version={version} sourceLanguage="ja" />
</SurveyUiProvider>
```

`SurveyEditorAdapter`, `FreeTextTranslationAdapter`, and `SurveyVersionAdapter` are transport-neutral contracts. Use the corresponding hooks when an application needs its own UI, or use the composite components and their slot/render props for the default headless UI.
