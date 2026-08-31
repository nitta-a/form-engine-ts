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
- `translateFreeTextAnswers` and `createFreeTextTranslationController` translate arbitrary answer arrays without selection state and return completion status, counts, findings, and per-answer results. `useFreeTextAnswerTranslation` also exposes the same direct `translate` method; `hasPiiCandidate` and `getFreeTextAnswerFindings` cover application-owned PII dialogs.
- `useSurveyVersionActions` manages quality checks, issue Accept/Reject, publish with warning confirmation, draft clone/delete, visibility changes, and async state. `SurveyVersionActionAdapter` is composable: each operation is optional, `composeSurveyVersionActions` combines independently implemented actions, and `useSurveyVersionDomainActions` accepts generic version/state records without schema conversion. The older `SurveyVersionActionsAdapter` and `useSurveyVersionOperations` names remain available.
- `SurveyResponseSummary` and `toSurveyResponseSummary` accept a `FormSchema` or `FormVersionRecord` directly and resolve question and option labels for `sourceLanguage`.

Use `createSurveyTranslationAdapter` and `createSurveyTranslator` to adapt application translation functions without an unsafe cast. `SurveyProvider` is an alias of `SurveyUiProvider`; when no local i18n props are passed it composes with the surrounding Form Engine provider instead of replacing it. `@form-engine-ts/custom-survey-client` is publishable with ESM, CommonJS, and declaration outputs; React and Form Engine packages are peer dependencies.

## v7.3 migration guide

This package has two layers. Controllers and hooks are transport-neutral: they cover
survey editor persistence, response translation, quality checks, version lifecycle,
response summaries, and free-text normalization. The package UI is intentionally
small and slot-based: `SurveyEditor`, `SurveyQualityPanel`, `SurveyVersionHistory`,
`SurveyWorkflowPanel`, `SurveyMappingPanel`, `SurveyResponseSummary`,
`SurveyFreeTextTable`, and `SurveyVersionPanel` provide accessible defaults that can
be replaced with `render` or `slots`.

The application remains responsible for tRPC procedures, authentication, React Query
cache invalidation, domain-specific warning copy, and dialogs. Inject those concerns
through adapters and slots:

```tsx
const actions = useSurveyVersionDomainActions({ version, state, adapter });

<SurveyVersionPanel
  version={version}
  actions={actions}
  slots={{
    qualityWarningDialog: ({ issues, confirm, cancel }) => (
      <MakerWarningDialog issues={issues} onConfirm={confirm} onCancel={cancel} />
    ),
    notifications: (current) => <MakerNotifications actions={current} />
  }}
/>;
```

Use `composeSurveyVersionActions(qualityAdapter, publishAdapter, lifecycleAdapter,
visibilityAdapter)` to keep each operation independently implemented. Every action is
optional; an unused `decideQualityIssue` or quality adapter does not need a dummy
implementation.

Domain records can be mapped once and reused by package features:

```tsx
const schemaAdapter = createSurveySchemaDomainAdapter((surveyVersion) => toFormSchema(surveyVersion));
const editor = useSurveyEditorDomain({
  domain: surveyVersion,
  domainAdapter: { ...schemaAdapter, fromFormSchema },
  adapter: { translateSurveyPreview, updateSurveyDraft }
});
const summary = toSurveyResponseSummaryFromDomain(analytics, surveyVersion, schemaAdapter, "ja");
const translations = useFreeTextDomainAnswerTranslation({
  items: answers,
  domainAdapter: { toFreeTextAnswerItem: toTranslationItem },
  adapter: translationAdapter,
  targetLanguage: "ja"
});

const result = await translations.translate(answers, {
  onPiiConfirmation: (findings) => openPiiDialog(findings)
});
```

For direct answer translation, v7.3 updates the hook's item state as well as returning
the outcome. PII confirmation can be application-owned without a second Map:

```tsx
const result = await translations.translate(answers, {
  onPiiConfirmation: (findings) => openPiiDialog(findings)
});
```

`publishResult()` (and the corresponding `decideQualityIssueResult`, `cloneDraftResult`,
`deleteDraftResult`, and `setVisibilityResult` methods) return `{ succeeded, error }`;
the default boolean methods remain available for v7.2 callers.
`quality.result` contains the original quality-check payload for custom quality UI.

### v7.1 to v7.2 to v7.3

- v7.1 callers can keep the legacy `translate`/`save`, `qualityCheck`/`duplicate`,
  `delete`/`setStatus` names.
- v7.2 introduced `translateFreeTextAnswers`, `useSurveyVersionDomainActions`,
  `composeSurveyVersionActions`, and `SurveyProvider`.
- v7.3 adds direct translation state updates, PII callbacks, structured action results,
  domain adapters for editor/summary/free text, and the slot-based `SurveyVersionPanel`.

Provider usage is unified through `SurveyProvider` (or `SurveyUiProvider`). It accepts
`common`/`customSurvey`-style namespace names and a real application i18next instance
directly through the generic `i18n` prop; the package validates the `t` function at
runtime and does not add an i18next dependency. Headless use with no provider remains
supported.

Before v7.3, an application had to map Domain answers before calling the controller:

```tsx
await controller.translate(answers.map(toFreeTextAnswerItem));
```

In v7.3, use the Domain hook and pass the application records directly:

```tsx
const translation = useFreeTextDomainAnswerTranslation({
  items: answers,
  domainAdapter: { toFreeTextAnswerItem },
  adapter: translationAdapter,
  targetLanguage: "ja"
});
await translation.translate(answers);
```

### Adapter integration boundaries

The adapters are deliberately shaped like ordinary async functions, so tRPC and
React Query can be used without a package dependency:

```tsx
const publish = trpc.survey.publish.useMutation({
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["survey", version.id] })
});
const actions = useSurveyVersionDomainActions({
  version,
  adapter: { publish: ({ version, allowWarnings }) => publish.mutateAsync({ version, allowWarnings }) }
});
```

MUI remains an application choice. Pass a MUI dialog through
`qualityWarningDialog` or `visibilityDialog`; the package supplies the findings,
status, and callbacks but does not own the dialog or warning copy.
