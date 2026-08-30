# @form-engine-ts/custom-survey-client

React composite APIs for survey applications. The package composes the existing Form Engine builder and translation primitives while keeping persistence, translation services, authentication, and state libraries injectable.

```tsx
<SurveyUiProvider locale="ja" translationAdapter={uiTranslations}>
  <SurveyEditor schema={schema} adapter={editorAdapter} onChange={setSchema} />
  <SurveyResponseSummary summary={summary} version={version} sourceLanguage="ja" />
</SurveyUiProvider>
```

The package has no dependency on Maker authentication, tRPC, Jotai, or URL state. Network and persistence concerns are injected through transport-neutral adapters:

- `SurveyEditor` accepts `translateSurveyPreview` and `updateSurveyDraft`, and exposes `useSurveyEditorController`. Notifications, card settings, and submission settings can be supplied through slots or the `render` prop.
- `SurveyFreeTextTable` / `useFreeTextAnswerTranslation` normalize text-answer pages or `FormResponse` records, group by source locale, batch requests, track selection/status, and gate PII-bearing translations behind confirmation.
- `useSurveyVersionActions` manages quality checks, issue Accept/Reject, publish with warning confirmation, draft clone/delete, visibility changes, and async state. The older `useSurveyVersionOperations` names remain available.
- `SurveyResponseSummary` and `toSurveyResponseSummary` accept a `FormSchema` or `FormVersionRecord` directly and resolve question and option labels for `sourceLanguage`.

Use `createSurveyTranslationAdapter` to adapt an application translation function without an unsafe cast. `SurveyProvider` is an alias of `SurveyUiProvider` for wrapping all survey components once. `@form-engine-ts/custom-survey-client` is publishable with ESM, CommonJS, and declaration outputs; React and Form Engine packages are peer dependencies.
