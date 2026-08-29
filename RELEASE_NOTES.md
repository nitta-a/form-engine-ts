# Release notes

This file is the historical record of user-visible changes. The README focuses on the
current release and usage information.

## Latest release

### v5.0.1 — 2026-08-29

- Fixed npm Sigstore provenance validation by including the canonical GitHub repository metadata in every published package, including `@form-engine-ts/storage`.
- Added release validation that rejects packages with missing or mismatched repository metadata before publication.
- Aligned all public packages to version 5.0.1.

See the [GitHub release for v5.0.1](https://github.com/nitta-a/form-engine-ts/releases/tag/v5.0.1).

### v5.0.0 — 2026-08-29

- Major release: typed submission and validation APIs, cursor pagination, transition commits, PII metadata normalization, and the shared `@form-engine-ts/storage` package are now available together.
- Added typed English/Japanese i18n catalogs, fallback translation, and independent `FormEngineI18nProvider` UI/content locale support across React and MUI.
- Translation workspace mutations now return structured results with typed failure details; consumers should handle the new result shapes and `TranslationWorkspaceError` values.
- Preserved the legacy `BuilderTranslationKey` pattern alias while adding the strict known-key catalog types.
- Aligned all public packages to version 5.0.0.

See the [GitHub release for v5.0.0](https://github.com/nitta-a/form-engine-ts/releases/tag/v5.0.0).

### v4.9.0 — 2026-08-29

- Added typed submission metadata and the object-input `createSubmission` overload with generated IDs, answer snapshots, and schema revisions.
- Added `validateSubmission` with injectable privacy detection and serializable field/form error results.
- Added cursor payload contracts, filter-aware pagination helpers, async page iteration, and the new `@form-engine-ts/storage` package.
- Added typed version-transition contexts and `commitVersionTransition`, plus PII finding normalization for persisted metadata.
- Expanded storage adapter contracts with metadata filters, date ranges, and multi-field text-answer paging.
- Added typed translation keys, official Japanese/English catalogs, safe fallback translation, and the public `FormEngineTranslator` API.
- Added `FormEngineI18nProvider` for independent UI and schema/content locales across the React and MUI integrations.
- Translation workspace mutations now return discriminated structured results for validation, read-only, adapter, and translation failures.
- Aligned all public packages to version 4.9.0.

See the [GitHub release for v4.9.0](https://github.com/nitta-a/form-engine-ts/releases/tag/v4.9.0).

### v4.8.0 — 2026-08-29

- Added `normalizeLocale` for canonical BCP 47 locale normalization, including underscore-separated compatibility input and invalid-tag rejection.
- Applied locale normalization consistently to schema validation, policies, sanitization, translation slot lookup, and React translation workspace updates.
- Canonicalized locale-keyed content during sanitization and prevented equivalent locale spellings from bypassing duplicate, allowed-locale, or required-locale checks.
- Aligned all public packages to version 4.8.0.

See the [GitHub release for v4.8.0](https://github.com/nitta-a/form-engine-ts/releases/tag/v4.8.0).

### v4.7.0 — 2026-08-29

- Added `TranslationMigrationContext` to custom translation metadata migrators, including locale, JSON path, property, node kind, and node identifiers.
- Added an extensible locale-validation pipeline with BCP 47 and duplicate checks before custom validation callbacks.
- Expanded custom locale validators to receive the default locale, current locales, and active `FormPolicy`, with boolean, message, and structured results supported.
- Aligned all public packages to version 4.7.0.

See the [GitHub release for v4.7.0](https://github.com/nitta-a/form-engine-ts/releases/tag/v4.7.0).

### v4.6.0 — 2026-08-29

- Added legacy translation metadata detection, migration to canonical metadata, and customizable metadata normalization.
- Added `removeLocaleFromSchema` to remove a locale registration together with all localized values and metadata.
- Added translation workspace locale validation through `FormPolicy` or a custom validator, with structured add-locale results.
- Added the `PopulateTranslationsOptions` compatibility alias and safeguards for custom manual-translation policies.
- Aligned all public packages to version 4.6.0.

See the [GitHub release for v4.6.0](https://github.com/nitta-a/form-engine-ts/releases/tag/v4.6.0).

### v4.5.0 — 2026-08-28

- Added nested `all`/`any` display rules with show/hide actions, expanded condition operators, and cycle details in schema issues.
- Added schema-driven submission confirmation settings and builder controls for configuring the confirmation presentation.
- Added translation slot collection, source-text hashing, stale/manual status tracking, protected batch population, and the React/MUI translation workspace.
- Added focused single-field editing and selection controls to the React and MUI builders.
- Aligned all public packages to version 4.5.0.

See the [GitHub release for v4.5.0](https://github.com/nitta-a/form-engine-ts/releases/tag/v4.5.0).

### v4.4.0 — 2026-08-27

- Added per-question-type choice-field layouts for radio, checkbox, multi-select, and select questions.
- Added customizable grouped-choice rendering slots, CSS custom properties, and the MUI `MuiChoiceGroupSlot` adapter.
- Added preview demonstrations and regression coverage for grouped layouts and MUI theme integration.
- Aligned all public packages to version 4.4.0.

See the [GitHub release for v4.4.0](https://github.com/nitta-a/form-engine-ts/releases/tag/v4.4.0).

### v4.3.2 — 2026-08-27

- Added the React Renderer `appearance.choiceField` preset for grouped radio and checkbox fieldsets with accessible legends, validation state, and keyboard interaction.
- Retained flat choice rendering by default and added the deprecated `groupedChoiceFields` compatibility alias.
- Aligned all public packages to version 4.3.2.

See the [GitHub release for v4.3.2](https://github.com/nitta-a/form-engine-ts/releases/tag/v4.3.2).

### v4.3.1 — 2026-08-27

- Made the React confirmation summary slot's `visibleItems` field optional for SemVer-compatible adoption.
- The Renderer continues to provide formatted visible answer items at runtime.
- Aligned all public packages to version 4.3.1.

See the [GitHub release for v4.3.1](https://github.com/nitta-a/form-engine-ts/releases/tag/v4.3.1).

### v4.3.0 — 2026-08-27

- Added a generic pre-submission answer confirmation flow to the React Renderer, independent of submission guards.
- Added standard inline, replacement, and dialog confirmation presentations with formatted visible answer summaries.
- Added `SubmissionConfirmationOptions` and `visibleItems` to the public React confirmation API.
- Aligned all public packages to version 4.3.0.

See the [GitHub release for v4.3.0](https://github.com/nitta-a/form-engine-ts/releases/tag/v4.3.0).

### v4.2.0 — 2026-08-27

- Added field constraint policies for field defaults, fixed values, and bounded rating, text, and choice properties.
- Added `keyPrefix` and fallback locale support to the official i18next adapter.
- Added grouped MongoDB collection names and custom index definitions while retaining the legacy collection options.
- Added the v3 to v4 migration guides and aligned all public packages to version 4.2.0.

See the [GitHub release for v4.2.0](https://github.com/nitta-a/form-engine-ts/releases/tag/v4.2.0).

### v4.1.0 — 2026-08-27

- FieldEditor property controls can now independently be editable, read-only, or hidden, including type-specific limits and bounds.
- Field-type Select options can be transformed and sorted through the public builder API.
- Added the official i18next translation adapter package.
- All public packages were aligned to version 4.1.0.

See the [GitHub release for v4.1.0](https://github.com/nitta-a/form-engine-ts/releases/tag/v4.1.0).

### v4.0.0 — 2026-08-27

- This major release includes the translation fallback, typed Select, expanded field-type slot, and grouped MUI Select APIs introduced in v3.3.0.
- The public API reports now intentionally record the breaking type changes under the v4.0.0 release.
- All public packages were aligned to version 4.0.0.

See the [GitHub release for v4.0.0](https://github.com/nitta-a/form-engine-ts/releases/tag/v4.0.0).

### v3.3.0 — 2026-08-27

- Translation adapters can report unresolved keys with `undefined` or `null`; the React builder now resolves canonical keys, legacy aliases, and default catalog values consistently.
- React Select props preserve typed string values through `SelectComponentProps<T>` and `BuilderSelectProps<T>`.
- The MUI field-type slot receives resolved control attributes, options, icons, descriptions, and category groups; grouped Select menus render accessible subheaders.
- All public packages were aligned to version 3.3.0.

See the [GitHub release for v3.3.0](https://github.com/nitta-a/form-engine-ts/releases/tag/v3.3.0).

### v3.2.0 — 2026-08-27

- `BuilderSelectOption<T>` now supports typed string values while retaining rich icons, descriptions, disabled states, categories, and metadata.
- Select component props accept both string options and rich option objects, with custom option/value renderers preserved across adapters.
- MUI control-level slot props retain injected accessibility attributes while preserving the existing layout slot API.
- All public packages were aligned to version 3.2.0.

See the [GitHub release for v3.2.0](https://github.com/nitta-a/form-engine-ts/releases/tag/v3.2.0).

### v3.1.0 — 2026-08-27

- React Select primitives now support rich option metadata, descriptions, disabled states, and custom option/value rendering.
- The MUI Builder adds rich field-type options with icons and descriptions, granular `fieldTypeSelect` and `fieldEditorHeader` slots, and custom field-type icons.
- MUI controls accept control-level `muiSlotProps` for text fields, selects, checkboxes, buttons, and icon buttons.
- Core field-type definitions and canonical builder translation keys are now exported for consistent integrations.
- Preview coverage, package documentation, and public API reports were updated for the new builder customization surfaces.

See the [GitHub release for v3.1.0](https://github.com/nitta-a/form-engine-ts/releases/tag/v3.1.0).

### v2.9.6 — 2026-08-26

- React Renderer now supports server-side validation errors through `FormSubmissionError`, including field-level error mapping and navigation to the affected page.
- Submission completion can render submitted values and response data through the completion and submitted-values slots, with configurable handling for hidden fields.
- Submission confirmation supports inline, dialog, and replacement modes with keyboard focus management and Escape-to-cancel behavior.
- The MUI Builder localization editor adds configured-locale summaries, an empty state, an `always` expanded mode, customizable empty-state text, and improved responsive layout.
- The preview app demonstrates server validation errors, submitted-value summaries, and confirmation behavior.

See the [GitHub release for v2.9.6](https://github.com/nitta-a/form-engine-ts/releases/tag/v2.9.6).

## English history

### v1.1.1 security, v2 extensibility, and v2.9 resilience APIs

CSV export neutralizes formula-like string cells after leading whitespace by default; pass
`{ neutralizeFormulas: false }` only for trusted data. The v2 APIs add JSON-only `metadata`/`translationMetadata` to every
schema node and submission, localized `completionMessage`, translation overwrite policies and reports, the policy-aware
`useFormBuilder` headless API, cancellable `beforeSubmit`, and replaceable renderer UI slots. All storage adapters preserve
extension metadata. `@form-engine-ts/zod` now uses Zod 4 as a peer dependency.

v2.1 moves `FormPolicy` and policy-aware `validateFormSchema` into Core so server and React validation return the same
issues. `transformFieldType` protects authoring translations and extension data during type changes. The headless builder
now owns all field/option/page/text/condition mutations, supports factory injection and typed ID failures, and the visual
builder exposes completion-message editing plus translation options/reports. Translation slots separate node metadata
from existing per-locale metadata, while Renderer adds page-header and submit-error slots.

The v2.1.1 patch adds Visual Builder `defaultFieldType`, typed `onActionError` notifications, and manual-translation
metadata creation. Its automatic translation default is now consistently `missing-only`, and field creation is disabled
when policy permits no type or the field limit is reached.

v2.2 adds `readOnly` and per-surface `features` controls to Visual Builder. `FormPolicy.allowedLocales` and `maxLocales`
now constrain schema validation and the headless/visual locale actions; allowed locale additions are presented as an
unregistered-locale selector. Page updates and locale mutations use the same typed `onActionError` pipeline as every
other visual action.

The Visual Builder also exposes orthogonal `components` and `slots` extension layers for design-system integration.
Primitive controls can be adapted to MUI/Tailwind components while domain surfaces—including only the automatic
translation actions—can be replaced independently. Core locale collection now scans translation and translation-metadata
keys on every schema node, closing unregistered, disallowed, and maximum-locale policy gaps.

v2.4 adds pure form-version transitions with optimistic revisions, mergeable incremental response analytics,
`AsyncIterable` CSV streaming with custom columns, MUI-oriented Builder input props, translation slot status, and a Zod
normalization codec. v2.5 adds stable keyset pagination to Memory, MongoDB, and PostgreSQL storage and introduces
`@form-engine-ts/translator-google-v3` for Translation Advanced glossaries, labels, automatic chunking, and exponential
retry on HTTP 429/5xx responses.

The v2.5.1 release hardens version transitions with typed validation/CAS failures, makes lenient incremental analytics
report skipped responses, and adds response-aware CSV columns plus Web/Node writable-stream piping. Paged storage can apply
metadata filters and predicates before sizing, including the new Azure Table adapter. Google Translation Advanced batches
by both item count and UTF-8 byte size and retries transient network/HTTP failures with `Retry-After`-aware full jitter.

v2.6 makes publish plans fully persistence-ready and asynchronous, preserving the actual archived record and adding
revision-based atomic commits to MongoDB. Azure Table paging now uses one native bounded page request with opaque service
continuation tokens, injectable entity codecs, separate schema/submission clients, and scalar metadata-to-OData filters.
Google Translation Advanced reports per-batch metrics, CSV custom columns may resolve asynchronously, and the new
`@form-engine-ts/translator-cache` provides deterministic TTL caching without coupling Core to a cache vendor.

v2.7 adds auditable clone/delete version-transition plans, typed atomic storage commits, a composable submission-filter
AST, and text-answer paging. MongoDB persists complete version state and audit events; Azure Table accepts arbitrary
entity layouts through a codec and per-form client resolver while bounding native-page scans. React can run ordered
privacy guards before submission, request explicit confirmation, persist SSR-safe submission receipts, and enforce native
text constraints. The new `@form-engine-ts/privacy` package detects common sensitive-data patterns without coupling Core
to a privacy implementation. Translation caching now provides bounded LRU/TTL memory storage and adapter-isolated keys,
while Google v3 skips blank API inputs and reports cache statistics. Release CI verifies public declaration snapshots and
waits up to three minutes for npm availability before producing package-specific release notes.

v2.8 guarantees that publishing an existing form version requires the complete current Published record and enforces one
Draft and one Published record per form in MongoDB while retaining multiple Archived records. Azure Table adds bounded,
item-level text-answer paging with cursors that resume inside an entity. React Builder edits source form text directly;
Renderer confirmation slots receive schema and visible answers, `onSubmit` response IDs flow into receipts, and batch
receipt hooks support dashboard views. Privacy detection recognizes `www.` URLs and merges overlapping findings. The
translation cache adds variant/custom keys and cumulative hit, miss, eviction, and size reporting.

v2.9 makes receipt persistence best-effort and adds SSR-safe submission attempts so network retries reuse a reserved ID.
Core provides abortable, cycle-safe page iteration and stricter Published-record guards. Azure text-answer cursors are
bound to their exact query by a SHA-256 fingerprint; MongoDB version commits fail fast when transactions are unavailable;
translation caches can bypass backend failures or propagate them by policy. Release CI now blocks incompatible public API
changes without a major release, publishes npm provenance, and generates API migration notes.

## 日本語の履歴

### v5.0.0 — 2026-08-29

- メジャーリリースです。型付きSubmission／検証API、カーソルページング、遷移コミット、PIIメタデータ正規化、共通`@form-engine-ts/storage`パッケージを統合しました。
- 型付き日本語／英語i18nカタログ、フォールバック翻訳、React／MUIでUIロケールとコンテンツロケールを分離する`FormEngineI18nProvider`を追加しました。
- 翻訳ワークスペースの変更処理が型付きのエラー詳細を含む構造化結果を返すようになりました。新しい結果型と`TranslationWorkspaceError`への対応が必要です。
- 既存の`BuilderTranslationKey`パターンaliasを維持しつつ、既知のキーを厳密に表すカタログ型を追加しました。
- 公開パッケージのバージョンを5.0.0に統一しました。

[v5.0.0のGitHub Release](https://github.com/nitta-a/form-engine-ts/releases/tag/v5.0.0)も参照してください。

### v4.9.0 — 2026-08-29

- 型付きSubmissionメタデータ、生成ID・回答スナップショット・スキーマリビジョンに対応したオブジェクト入力形式の`createSubmission`オーバーロードを追加しました。
- 注入可能なプライバシー検出と、シリアライズ可能なフィールド／フォームエラー結果を備えた`validateSubmission`を追加しました。
- カーソルペイロード契約、フィルター対応ページング、非同期ページ反復、新しい`@form-engine-ts/storage`パッケージを追加しました。
- 型付きバージョン遷移コンテキストと`commitVersionTransition`、保存用PII検出結果の正規化を追加しました。
- ストレージアダプターにメタデータフィルター、日付範囲、複数フィールドのテキスト回答ページングを追加しました。
- 型付き翻訳キー、公式の日本語／英語カタログ、安全なフォールバック翻訳、および公開`FormEngineTranslator` APIを追加しました。
- React／MUI連携に`FormEngineI18nProvider`を追加し、UIロケールとスキーマ／コンテンツロケールを分離できるようにしました。
- 翻訳ワークスペースの変更処理が、検証・読み取り専用・アダプター・翻訳エラーを判別可能な構造化結果として返るようになりました。
- 公開パッケージのバージョンを4.9.0に統一しました。

[v4.9.0のGitHub Release](https://github.com/nitta-a/form-engine-ts/releases/tag/v4.9.0)も参照してください。

### v4.8.0 — 2026-08-29

- アンダースコア区切りの互換入力にも対応し、不正なタグを拒否するBCP 47正規化関数`normalizeLocale`を追加しました。
- スキーマ検証、ポリシー、サニタイズ、翻訳スロット検索、React翻訳ワークスペースの更新でロケール正規化を統一しました。
- 同じロケールの異なる表記が、重複・許可ロケール・必須ロケールの検証を回避できないようにし、サニタイズ時にロケールキー付きコンテンツを正規化しました。
- 公開パッケージのバージョンを4.8.0に統一しました。

[v4.8.0のGitHub Release](https://github.com/nitta-a/form-engine-ts/releases/tag/v4.8.0)も参照してください。

### v4.7.0 — 2026-08-29

- カスタム翻訳メタデータ移行関数に、ロケール、JSONパス、プロパティ、ノード種別、ノード識別子を含む`TranslationMigrationContext`を追加しました。
- BCP 47形式と重複をカスタム検証関数より先に確認する、拡張可能なロケール検証パイプラインを追加しました。
- カスタムロケール検証関数がデフォルトロケール、現在のロケール一覧、適用中の`FormPolicy`を受け取り、真偽値・メッセージ・構造化結果を返せるようにしました。
- 公開パッケージのバージョンを4.7.0に統一しました。

[v4.7.0のGitHub Release](https://github.com/nitta-a/form-engine-ts/releases/tag/v4.7.0)も参照してください。

### v4.6.0 — 2026-08-29

- 旧形式の翻訳メタデータを判定し、標準形式へ移行できる機能と、メタデータ正規化のカスタマイズを追加しました。
- ロケール登録と、そのローカライズ済み値・メタデータをまとめて削除する`removeLocaleFromSchema`を追加しました。
- `FormPolicy`またはカスタム検証関数による翻訳ワークスペースのロケール検証と、構造化された追加結果を追加しました。
- `PopulateTranslationsOptions`互換aliasと、カスタム手動翻訳判定を保護する仕組みを追加しました。
- 公開パッケージのバージョンを4.6.0に統一しました。

[v4.6.0のGitHub Release](https://github.com/nitta-a/form-engine-ts/releases/tag/v4.6.0)も参照してください。

### v4.5.0 — 2026-08-28

- `all`／`any`でネストできる表示ルール、show／hideアクション、拡張された条件演算子、循環参照の詳細情報を追加しました。
- スキーマから送信確認を設定できるようにし、確認表示方法をBuilderから編集できるようにしました。
- 翻訳スロット収集、原文ハッシュ、stale／手動翻訳ステータス、手動翻訳を保護する一括生成、React／MUI翻訳ワークスペースを追加しました。
- React／MUI Builderに、設問を選択して1件ずつ編集するモードと選択状態の制御を追加しました。
- 公開パッケージのバージョンを4.5.0に統一しました。

[v4.5.0のGitHub Release](https://github.com/nitta-a/form-engine-ts/releases/tag/v4.5.0)も参照してください。

### v4.4.0 — 2026-08-27

- radio・checkbox・multi-select・select設問ごとに選択肢レイアウトを設定できるようにしました。
- Grouped UIの差し替えスロット、CSSカスタムプロパティ、MUI用`MuiChoiceGroupSlot`アダプターを追加しました。
- GroupedレイアウトとMUIテーマ連携のプレビューおよび回帰テストを追加しました。
- 公開パッケージのバージョンを4.4.0に統一しました。

[v4.4.0のGitHub Release](https://github.com/nitta-a/form-engine-ts/releases/tag/v4.4.0)も参照してください。

### v4.3.2 — 2026-08-27

- React Rendererに、アクセシブルなlegend、検証状態、キーボード操作に対応したradio・checkboxのグループ表示プリセットを追加しました。
- 既定では従来のフラット表示を維持し、非推奨の`groupedChoiceFields`互換aliasも提供します。
- 公開パッケージのバージョンを4.3.2に統一しました。

[v4.3.2のGitHub Release](https://github.com/nitta-a/form-engine-ts/releases/tag/v4.3.2)も参照してください。

### v4.1.0 — 2026-08-27

- FieldEditorの設問プロパティを、タイプ別の制限・境界値を含めて編集可、読み取り専用、非表示から個別に制御できるようになりました。
- 公開Builder APIでフィールド種別Selectの選択肢を変換・並び替えできるようになりました。
- i18next公式翻訳アダプターパッケージを追加しました。
- 公開パッケージのバージョンを4.1.0に統一しました。

[v4.1.0のGitHub Release](https://github.com/nitta-a/form-engine-ts/releases/tag/v4.1.0)も参照してください。

### v4.0.0 — 2026-08-27

- v3.3.0で導入した翻訳Fallback、型付きSelect、拡充されたフィールド型slot、グループ対応MUI Select APIをメジャーリリースとして提供します。
- 公開APIレポートに今回の破壊的な型変更をv4.0.0の変更として記録しました。
- 公開パッケージのバージョンを4.0.0に統一しました。

[v4.0.0のGitHub Release](https://github.com/nitta-a/form-engine-ts/releases/tag/v4.0.0)も参照してください。

### v3.3.0 — 2026-08-27

- 翻訳adapterが未解決キーに`undefined`または`null`を返せるようになり、React Builderが正規キー、旧Alias、デフォルト辞書を一貫して解決するようになりました。
- React Selectの`SelectComponentProps<T>`と`BuilderSelectProps<T>`が文字列値の型を保持するようになりました。
- MUIのフィールド型slotに解決済みの属性、選択肢、アイコン、説明、カテゴリが渡され、Selectメニューにアクセシブルなグループ見出しを表示します。
- 公開パッケージのバージョンを3.3.0に統一しました。

[v3.3.0のGitHub Release](https://github.com/nitta-a/form-engine-ts/releases/tag/v3.3.0)も参照してください。

### v3.2.0 — 2026-08-27

- `BuilderSelectOption<T>`が文字列値の型パラメータに対応し、リッチなアイコン、説明、無効状態、種別、メタデータを維持できるようになりました。
- Selectのpropsが文字列選択肢とリッチな選択肢オブジェクトの両方を受け付け、各adapterでカスタム描画を利用できます。
- MUIのコントロール単位slot propsでアクセシビリティ属性を保持し、既存のレイアウトslot APIとの互換性を維持しました。
- 公開パッケージのバージョンを3.2.0に統一しました。

[v3.2.0のGitHub Release](https://github.com/nitta-a/form-engine-ts/releases/tag/v3.2.0)も参照してください。

### v3.1.0 — 2026-08-27

- React Selectの基本コンポーネントが、説明・無効状態・追加メタデータ・選択肢と選択値のカスタム描画に対応しました。
- MUI Builderのフィールド型選択肢にアイコンと説明を追加し、`fieldTypeSelect`・`fieldEditorHeader`の個別slotと、フィールド型アイコンの差し替えを公開しました。
- MUIのテキストフィールド、Select、Checkbox、Button、IconButtonに、コントロール単位の`muiSlotProps`を指定できるようにしました。
- Coreからフィールド型定義と正規化されたBuilder翻訳キーを公開し、各種インテグレーションで一貫して利用できるようにしました。
- 新しいBuilderカスタマイズ面に合わせて、Preview、パッケージドキュメント、公開APIレポートを更新しました。

[v3.1.0のGitHub Release](https://github.com/nitta-a/form-engine-ts/releases/tag/v3.1.0)も参照してください。

### v2.9.6 — 2026-08-26

- React Rendererが`FormSubmissionError`によるサーバー側バリデーションエラーに対応し、設問単位のエラー表示と該当ページへの移動を行えるようになりました。
- 送信完了時に、completion slotとsubmitted-values slotから送信値・response情報を表示できるようになりました。非表示設問を含めるかも設定できます。
- 送信確認はinline、dialog、replaceの3モードに対応し、キーボードフォーカス管理とEscapeによるキャンセルを備えました。
- MUI Builderの言語設定編集に、設定済み言語のsummary、空状態、`always`展開モード、空状態メッセージのカスタマイズ、レスポンシブレイアウトを追加しました。
- Previewでサーバー検証エラー、送信値summary、送信確認の動作を確認できるようにしました。

[v2.9.6のGitHub Release](https://github.com/nitta-a/form-engine-ts/releases/tag/v2.9.6)も参照してください。

### v1.1.1セキュリティ対応、v2拡張、v2.9耐障害性API

CSV出力は先頭空白類の後が`=`, `+`, `-`, `@`で始まる文字列をデフォルトで無害化します。信頼済みデータでは
`{ neutralizeFormulas: false }`で無効化できます。v2 APIでは全スキーマノードと回答にJSON限定の
`metadata`/`translationMetadata`、多言語`completionMessage`、翻訳上書きポリシーとレポート、ポリシー対応の
Headless `useFormBuilder`、キャンセル可能な`beforeSubmit`、完全置換可能なRenderer UI Slotを追加しました。
全ストレージアダプターが拡張metadataを保持し、`@form-engine-ts/zod`はZod 4をpeer dependencyとして利用します。

v2.1では`FormPolicy`とポリシー対応`validateFormSchema`をCoreへ移し、サーバーとReactで同一issueを返します。
`transformFieldType`は形式変更時の原文・翻訳・拡張データを保全します。Headless Builderへfield/option/page/文言/条件の
全更新を集約し、factory注入と型付きID失敗を追加しました。Visual Builderは完了メッセージと翻訳設定・レポートを公開し、
翻訳slotはnode metadataと既存言語別metadataを分離します。Rendererにはpage headerとsubmit error slotを追加しました。

v2.1.1パッチではVisual Builderに`defaultFieldType`、型付き`onActionError`通知、手動翻訳metadata生成を追加しました。
自動翻訳の既定値を`missing-only`へ統一し、ポリシー上追加可能な型がない場合や設問上限到達時は追加を無効化します。

v2.2ではVisual Builderに`readOnly`と表示領域別の`features`制御を追加しました。`FormPolicy.allowedLocales`と
`maxLocales`はスキーマ検証およびHeadless/Visual Builderの言語操作に適用され、許可ロケールは未登録候補から選択できます。
ページ更新と言語操作も他のVisual actionと同じ型付き`onActionError`パイプラインを通ります。

Visual Builderはデザインシステム統合向けに、直交する`components`と`slots`の拡張層も公開します。MUI/Tailwind等へ
プリミティブ部品を差し替えつつ、自動翻訳actionだけを含むdomain領域を独立して置換できます。Coreのロケール収集は
全スキーマノードの翻訳・翻訳metadataキーを走査し、未登録・非許可・上限超過の抜け道を防ぎます。

v2.4では楽観revision付きの純粋なフォーム版遷移、結合可能な増分回答集計、カスタム列対応の
`AsyncIterable` CSVストリーム、MUI向けBuilder入力props、翻訳slot状態、Zod正規化codecを追加しました。
v2.5ではMemory・MongoDB・PostgreSQL Storageへ安定したkeyset paginationを追加し、Translation Advancedの
用語集・label・自動chunk分割・HTTP 429/5xx指数backoff retryに対応する`@form-engine-ts/translator-google-v3`を
新設しました。

v2.5.1では、version遷移に型付きvalidation/CAS失敗を追加し、lenient増分集計がスキップした回答をレポート
できるようにしました。CSVのカスタム列は回答・版・スキーマcontextを受け取り、Web/Node writable streamへ
backpressure対応で直接出力できます。ページングはページサイズ確定前のmetadata/predicate filterに対応し、Azure
Tableアダプターも追加しました。Google Translation Advancedは件数とUTF-8 byte数の両方でbatchを分割し、
`Retry-After`を尊重するfull jitter付きで一時的なnetwork/HTTPエラーをretryします。

v2.6ではpublish planを非同期かつそのまま永続化できる完全なrecord構成にし、実際の旧公開recordを保全して
MongoDBへrevisionベースのatomic commitを追加しました。Azure Tableはserviceのopaque continuation tokenを使い、
1 requestにつきnative pageを1件だけ取得します。entity codec注入、schema/submission client分離、scalar metadataの
OData変換にも対応しました。Google Translation Advancedのbatch report、非同期CSVカスタム列、およびvendor非依存の
TTL cache utility `@form-engine-ts/translator-cache`も追加しています。

v2.7ではclone/deleteの監査可能なversion遷移plan、型付きatomic storage commit、合成可能な回答filter AST、
text回答paginationを追加しました。MongoDBは完全なversion stateと監査eventを永続化し、Azure Tableはcodecと
form単位client resolverにより任意entity layoutへ対応しつつnative page scanを上限付きにします。Reactは送信前に
順序付きprivacy guardを実行し、明示確認、SSR-safeな送信receipt、native text制約を利用できます。新しい
`@form-engine-ts/privacy`はCoreを特定実装へ結合せず、標準的な機密データpatternを検出します。翻訳cacheには
上限付きLRU/TTL memory storageとadapter分離keyを追加し、Google v3は空文字をAPI送信せずcache統計をreportします。
Release CIは公開宣言snapshotを検証し、npm反映を最大3分待ってpackage別release noteを生成します。

v2.8では既存フォームの公開時に完全な現Published recordを必須化し、MongoDBでフォームごとにDraft/Publishedを
各1件へ制約しつつ複数Archived recordを保持します。Azure Tableはentity内の途中から再開できるcursorを備えた、
item単位のbounded自由記述pagingに対応しました。React Builderはフォーム原文を直接編集でき、Rendererの確認slotへ
schemaと表示中回答を渡し、`onSubmit`の回答IDをreceiptへ保存し、batch receipt hookで一覧取得できます。Privacyは
`www.` URLと重複finding集約に対応し、翻訳cacheはvariant/custom keyおよびhit/miss/eviction/size統計を公開します。

v2.9ではreceipt保存をbest-effort化し、SSR-safeなsubmission attemptにより通信失敗後も予約済みIDで再送できます。
Coreはabort・cursor循環・空page・件数上限に対応するpage iteratorとPublished recordの厳密検証を追加しました。
Azureの自由記述cursorはSHA-256検索指紋でqueryへ固定され、MongoDBのversion commitはtransaction非対応時に部分更新せず
fail-fastします。翻訳cacheはbackend障害をbypassまたはthrowするpolicyを選択できます。Release CIはmajor releaseを
伴わない破壊的public API変更を拒否し、npm provenanceとAPI migration noteを生成します。
