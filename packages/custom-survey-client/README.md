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
- `SurveyResponseSummary` and `toSurveyResponseSummary` accept a `FormSchema` or `FormVersionRecord` directly and resolve question and option labels for `sourceLanguage`. `SurveyResponseSummaryCustomDomain` and `mapSurveyResponseSummary` retain application-owned aggregates, language tabs, skip reasons, definitions, and labels for custom render slots.

Use `createSurveyTranslationAdapter` and `createSurveyTranslator` to adapt application translation functions without an unsafe cast. `SurveyProvider` is the unified provider for Form Engine and survey translations; it accepts a typed `translation` scope, a structural i18next-compatible `i18n` instance, or a transport-neutral translation adapter. When no local i18n props are passed it composes with the surrounding Form Engine provider instead of replacing it. `@form-engine-ts/custom-survey-client` is publishable with ESM, CommonJS, and declaration outputs; React and Form Engine packages are peer dependencies.

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

`publishResult`/`decideQualityIssueResult`/`cloneDraftResult`/`deleteDraftResult`/
`setVisibilityResult` adapter methods return structured `{ succeeded, error, response,
metadata }` data without changing the old void-returning action methods. The matching
controller methods return `{ succeeded, error }` and preserve any adapter response;
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
directly through the generic `i18n` prop. Use `commonNamespace` and
`customSurveyNamespace` when those are the application's namespace names; the package validates the `t` function at
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

### v7.3 to v7.4 migration guide

v7.4 adds the P0 domain-first surfaces. Migrate feature by feature: keep the
Maker adapter for tRPC, authentication, aggregation, and business rules, and
remove the local DTO mapper, controller state, and generic panel once the
corresponding package hook is adopted. The old v7.3 names remain available while
the migration is staged.

| Local implementation | v7.4 replacement | Keep in Maker |
| --- | --- | --- |
| `client/editor.tsx`, schema conversion, generic builder state | `useSurveyEditorDomain` and `SurveyEditorDomainAdapter` | Domain adapter, validation policy, tRPC/auth |
| Response summary mapper and language-tab state | `useSurveyResponseSummaryDomain` / `SurveyResponseSummaryDomain` | Aggregation query and custom render slots |
| `qualityIssuesRef`, raw quality DTO conversion | `useSurveyVersionDomainActions` and `SurveyVersionQualityResult` | Quality procedure, policy, dialog copy |
| `surveyWorkflow.ts` display wrapper | `SurveyWorkflowControlled` / `useSurveyWorkflowControlled` | Workflow calculation and tab routing |
| Mapping CRUD state and reload handling | `useSurveyMappingCrud` / `SurveyMappingCrudAdapter` | Deck/group selection semantics and auth |
| Local `SurveyUiProvider` translation wrapper | `SurveyProvider`, `SurveyTranslationScope` | Resource loading and locale selection |

The package root exports these types and controllers; feature-folder paths are
implementation details. MUI dialogs and application notifications remain slots,
and tRPC calls remain ordinary adapter functions.

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

## v7.4 migration and deletion map

v7.4 completes the generic boundary needed by a Maker application. The package
owns the controller state and default UI; the application supplies only domain
mapping, transport, authentication, business rules, and screen-specific dialogs.

| Feature | v7.2 / v7.3 | v7.4 surface | Maker code that can be deleted | Responsibility that remains in Maker |
| --- | --- | --- | --- | --- |
| Editor | Schema-first editor and v7.3 domain helper | `useSurveyEditorDomain`, `SurveyEditorDomainAdapter`, question adapter, settings slots | FormSchema conversion hooks, save/preview controller, generic question reorder/add state | Domain `toFormSchema`/`fromFormSchema`, tRPC/auth, business validation policy |
| Response summary | `toSurveyResponseSummary` for Form Analytics | `useSurveyResponseSummaryDomain` / `SurveyResponseSummaryDomain` with language aggregates, skip reasons, question/choice definitions, label resolution, and render slots | FormSchema conversion, summary mapper, language-tab state, generic summary view state | Maker aggregation query and domain-specific aggregate calculation |
| Quality / Version | Separate quality panel and version actions | `useSurveyQualityController`, original `response`/`rawResponse`, `runId`, `checkedRevision`, unified accept/reject, action effects | `qualityIssuesRef`, generic quality result conversion, cache/notification plumbing | Quality provider procedure, auth, warning/dialog copy, quality policy |
| Workflow | Uncontrolled transition list | `SurveyWorkflowControlled` / `useSurveyWorkflowControlled` with generic `state`, `expanded`/`onToggle`, progress, navigation, and slots | Workflow panel state, progress calculation wiring, tab transition plumbing | Calculation of domain completion/progress and application tab routing |
| Mapping | Save-only mapping adapter | `SurveyMappingCrudAdapter` / `useSurveyMappingCrud` with individual create/remove/reorder, list refresh, selection payload, operation state, and invalidation | Mapping CRUD state, reload/error/loading handling | Deck/group query semantics, auth, domain mapping rules |
| Provider | `SurveyUiProvider` and i18next-shaped `i18n` | One provider for Form Engine plus `common`/`customSurvey` namespaces | Local provider and translation-function wrapper | Resource loading and application locale selection |

Domain-first editor usage:

```tsx
const editor = useSurveyEditorDomain({
  domain: surveyVersion,
  domainAdapter: { toFormSchema, fromFormSchema },
  adapter: { translateSurveyPreview, updateSurveyDraft },
  questionAdapter: { addQuestion, reorderQuestions },
  onDomainChange: setSurveyVersion
});
```

The domain-first editor keeps the Maker version record as the source of truth.
`questionAdapter` handles domain-specific add/remove/reorder rules and `slots`
replace card, submission, toolbar, and notification UI:

```tsx
const editor = useSurveyEditorDomain({
  domain: surveyVersion,
  domainAdapter: { toFormSchema, fromFormSchema },
  adapter: { translateSurveyPreview, updateSurveyDraft },
  questionAdapter: { addQuestion, removeQuestion, reorderQuestions },
  slots: { cardAppearance: renderCardSettings, submissionSettings: renderResponseSettings },
  onDomainChange: setSurveyVersion
});
```

For application-owned response aggregates, no intermediate Maker mapper is
required:

```tsx
const summary = useSurveyResponseSummaryDomain({
  summary: makerSummary,
  version: surveyVersion,
  domainAdapter: { toSummaryInput, toFormSchema, sourceLanguage, mapLanguages, mapSkipReasons },
  selectedLanguage,
  onLanguageChange: setSelectedLanguage,
  slots: { question: renderQuestion, skipReasons: renderSkipReasons }
});
```

Quality adapters return the provider payload instead of forcing the application
to reconstruct it:

```tsx
const quality = useSurveyQualityController({
  version,
  adapter: {
    run: ({ version, signal }) => trpc.qualityCheck({ version, signal }),
    decide: ({ issue, decision, result }) => trpc.decideQuality({ issue, decision, result }),
    invalidate: () => queryClient.invalidateQueries({ queryKey: ["survey", version.id] })
  }
});
```

The v7.2 names remain available for migration. New code should use the
domain/controller names and root exports; feature folders (`editor/*`,
`response/*`, `quality/*`, `workflow/*`, `mapping/*`, and `shared/*`) are
implementation boundaries, not application-owned deep-import contracts.

Deprecated compatibility names are `useSurveyEditor`, `translate`/`save`,
`qualityCheck`, `duplicate`, `delete`, and `setStatus`. They remain available
for v7.2/v7.3 migration and should not be used in new Maker code.
