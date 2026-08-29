# form-engine-ts

## English

A schema-driven, pluggable survey engine for TypeScript and React. Form definitions, runtime validation, submissions, and analytics live in a framework-independent core; translation and storage are injected through small adapter interfaces.

### What's included

| Area | Package | Purpose |
| --- | --- | --- |
| Core | `@form-engine-ts/core` | Schema, visibility, validation, submissions, analytics, CSV, and shared adapter types |
| React renderer / builder | `@form-engine-ts/react` | SSR-safe provider, conditional renderer, accessible visual builder, hooks, overrides, and base styles |
| Storage adapter | `@form-engine-ts/storage-memory` | Process-local form/submission storage with defensive copying and duplicate protection |
| Storage adapter | `@form-engine-ts/storage-localstorage` | Prefix-isolated browser persistence with injectable storage for tests and SSR callers |
| Storage adapter | `@form-engine-ts/storage-mongodb` | MongoDB Native Driver implementation of the complete form storage contract |
| Storage adapter | `@form-engine-ts/storage-postgres` | PostgreSQL storage through an injected node-postgres-compatible query client |
| Storage adapter | `@form-engine-ts/storage-sqlite` | Driver-neutral SQLite storage through synchronous or asynchronous executors |
| Storage adapter | `@form-engine-ts/storage-d1` | Cloudflare D1 storage using prepared statements and transactional batches |
| Storage adapter | `@form-engine-ts/storage-azure-table` | Azure Table Storage through an injected `@azure/data-tables`-compatible client |
| Translator adapter | `@form-engine-ts/translator-mock` | English/Japanese synchronous catalogs plus deterministic async batch translation for demos |
| Translator adapter | `@form-engine-ts/translator-azure` | Server-side Azure AI Translator REST API v3.0 integration with optional regional routing |
| Translator adapter | `@form-engine-ts/translator-deepl` | Server-side DeepL Free/Pro text translation using injectable `fetch` |
| Translator adapter | `@form-engine-ts/translator-google` | Google Cloud Translation Basic v2 using API Key or Bearer authentication |
| Translator adapter | `@form-engine-ts/translator-google-v3` | Google Cloud Translation Advanced v3 with glossaries, labels, chunking, and retry |
| Translator adapter | `@form-engine-ts/translator-i18next` | Official i18next adapter for synchronous UI translation lookups |
| Translator utility | `@form-engine-ts/translator-cache` | Storage-neutral TTL cache wrapper for asynchronous translation adapters |
| Privacy utility | `@form-engine-ts/privacy` | Standard and extensible sensitive-data detection for text answers |
| Zod validator | `@form-engine-ts/zod` | `FormSchema` to Zod 4 answer-validator generation with Core-compatible issues |
| Demo app | `@form-engine-ts/preview` | Private Vite sandbox for building, responding, switching storage, analytics, and CSV export |

The library packages build as public dual ESM/CommonJS packages with declarations and explicit `exports`. The publish workflow expects an `NPM_TOKEN` repository secret, publishes all `packages/*` libraries to npm, and creates a GitHub Release for tags in the `vX.Y.Z` format after verifying that every package has the matching version.

### Requirements and commands

- Node.js 22.22.2 or newer
- pnpm 11

```bash
pnpm install
pnpm dev
```

The preview is served by Vite. Repository-wide acceptance commands are:

```bash
pnpm build
pnpm check
pnpm typecheck
pnpm lint
pnpm test
```

`pnpm lint` uses Biome to verify formatting, recommended lint rules, and import organization.

### Current release

The latest release is **v6.2.0** (2026-08-29). All public packages are currently published at version `6.2.0`.
This release adds cancellation, progress reporting, and partial-failure handling for asynchronous translation, including batch progress, retry, and cancellation controls in the React and MUI workspaces. It builds on v6.1.0's side-by-side translation comparison workspace, strict locale-required submission contracts, and missing-translation diagnostics.
See [RELEASE_NOTES.md](RELEASE_NOTES.md) for the complete history and the
[GitHub release](https://github.com/nitta-a/form-engine-ts/releases/tag/v6.2.0).

### Authoring and respondent experience

Optional `pages` turn a schema into a validated wizard with conditional page skipping and accessible progress. The React
renderer can debounce versioned drafts to `localStorage` with `autoSaveKey`. Authoring-time translations are stored in the
schema, populated in batches through `populateSchemaTranslations`, and applied synchronously by `resolveLocalizedSchema`.
The builder exposes page membership and locale override controls. Core also provides `calculateCrossTabulation` for
two-choice pivot analysis and `dispatchWebhook` for timeout-aware, optionally HMAC-signed form events. Zod validators accept
an optional `{ pageIndex }` for step-scoped validation.

### Define and render a form

```bash
pnpm add @form-engine-ts/core @form-engine-ts/react @form-engine-ts/translator-mock react react-dom
```

```tsx
import type { FormSchema } from "@form-engine-ts/core";
import { FormProvider, FormRenderer } from "@form-engine-ts/react";
import "@form-engine-ts/react/styles.css";
import { mockTranslator } from "@form-engine-ts/translator-mock";

const schema = {
  id: "contact",
  version: 1,
  title: "Contact us",
  description: "Tell us how we can help.",
  submitLabelKey: "contact.submit",
  fields: [
    {
      id: "q_0192ab34",
      type: "text",
      title: "Your name",
      translationKey: "contact.name",
      required: true,
      minLength: 2
    },
    {
      id: "q_12ab34cd",
      type: "select",
      title: "How can we help?",
      translationKey: "contact.topic",
      required: true,
      options: [
        { id: "opt_23bc45de", label: "Support" },
        { id: "opt_34cd56ef", label: "Sales" }
      ]
    },
    {
      id: "q_45de67f0",
      type: "rating",
      title: "How satisfied are you?",
      required: false,
      min: 1,
      max: 5
    },
    {
      id: "q_56ef7801",
      type: "textarea",
      title: "Describe the problem",
      required: false,
      displayCondition: {
        questionId: "q_12ab34cd",
        operator: "equals",
        value: "opt_23bc45de"
      }
    }
  ]
} as const satisfies FormSchema;

export function ContactForm() {
  return (
    <FormProvider
      schema={schema}
      locale="en"
      translator={mockTranslator}
      onSubmit={async (values) => console.log(values)}
      resetOnSuccess
    >
      <FormRenderer successMessageKey="contact.success" />
    </FormProvider>
  );
}
```

`FormProvider` validates the schema at runtime. Conditions update as answers change, hidden controls and errors leave the DOM, and retained hidden values are removed from the submitted values. Changing the controlled `locale` prop does not clear answers. `useForm` exposes the complete form state and actions, while `useField(id)` provides one field's definition, value, error, and setter. `FormRenderer.components` can replace any default field renderer. `FormBuilder` generates hidden `q_…` and `opt_…` IDs, edits natural-language titles and labels, and permits display conditions to reference prior questions only.

This schema format is intentionally breaking: legacy `titleKey`, `labelKey`, and option `value` properties are not accepted. Every question must explicitly set `required`.

Use `validateSchemaStructure(schema)` for focused duplicate/dangling/self/cycle diagnostics and `sanitizeSchema(schema)` to return a new schema without unsafe condition references. Sanitization never guesses how duplicate question or choice IDs should be renamed, so duplicates are reported but preserved.

### Adapter contracts

Natural-language schema copy is rendered directly. Synchronous translations remain available for validation, submit/status messages, placeholders, and builder UI so rendering does not depend on effects:

```ts
interface TranslationAdapter {
  translate(
    key: string,
    locale: string,
    params?: Readonly<Record<string, string | number>>
  ): string;
}
```

Network translation uses a separate asynchronous contract so React rendering remains synchronous:

```ts
interface AsyncTranslationAdapter {
  translateText(text: string, targetLocale: string, sourceLocale?: string): Promise<string>;
  translateBatch(
    texts: readonly string[],
    targetLocale: string,
    sourceLocale?: string
  ): Promise<readonly string[]>;
}

const deepl = createDeeplTranslator({
  apiKey: process.env.DEEPL_API_KEY,
  apiType: "pro"
});
const japanese = await deepl.translateText("Thank you", "JA", "EN");
const translatedSchema = await resolveFormTranslation(schema, deepl, "JA", "EN");
```

`resolveFormTranslation` translates form/question titles and descriptions plus option labels in one ordered batch while preserving every internal ID, condition, validation rule, and optional question `translationKey`.

DeepL credentials must remain on a trusted server. The adapter uses POST JSON with the authorization header, supports an injected `fetchFn`, and reports HTTP/API errors without automatic retries.

Google Cloud Translation Basic v2 supports exactly one authentication strategy per adapter. API Key credentials are sent as the `key` query parameter; OAuth2 or Service Account callers inject a fresh Bearer token provider:

```ts
const googleWithApiKey = createGoogleTranslator({
  apiKey: process.env.GOOGLE_TRANSLATE_API_KEY
});

const googleWithBearer = createGoogleTranslator({
  getAccessToken: async () => credentials.getAccessToken()
});

const german = await googleWithBearer.translateBatch(["Hello", "Goodbye"], "de", "en");
```

Google credentials must also remain on a trusted server. The adapter sends plain-text translation requests, decodes HTML entities in returned text, accepts up to 128 texts per request, and reports HTTP/API errors without automatic retries. Token creation, refresh, ADC, and Service Account signing remain the caller's responsibility.

Azure AI Translator uses subscription-key authentication and optionally sends the resource region for regional or multi-service resources. `endpoint` is the complete Translate operation URL, so custom-domain callers include `/translator/text/v3.0/translate`:

```ts
const azure = createAzureTranslator({
  apiKey: process.env.AZURE_TRANSLATOR_KEY,
  region: "japaneast",
  endpoint: "https://example.cognitiveservices.azure.com/translator/text/v3.0/translate"
});

const french = await azure.translateBatch(["Hello", "Goodbye"], "fr", "en");
```

Keep Azure credentials on a trusted server. The adapter preserves custom endpoint query parameters, enforces the current 1,000-item and 50,000-character request limits, accepts an injected `fetchFn`, redacts the subscription key from API errors, and does not retry failed requests automatically.

Storage is asynchronous so the same form can later use a database or HTTP-backed implementation:

```ts
interface SubmissionQueryOptions {
  readonly since?: string;
  readonly until?: string;
}

interface StorageAdapter {
  saveSubmission(submission: FormSubmission): Promise<void>;
  listSubmissions(
    formId: string,
    formVersion?: number,
    options?: SubmissionQueryOptions
  ): Promise<readonly FormSubmission[]>;
  clearResponses?(formId: string): Promise<void>;
  clear(): Promise<void>;
}

interface FormStorageAdapter extends StorageAdapter {
  saveSchema(schema: FormSchema): Promise<void>;
  getSchema(formId: string, formVersion: number): Promise<FormSchema | null>;
  listSchemas(): Promise<readonly FormSchema[]>;
  deleteSchema(formId: string, formVersion: number): Promise<void>;
  deleteSubmission(submissionId: string): Promise<void>;
}
```

Create a validated immutable submission, save it, then aggregate matching responses:

```ts
const submission = createSubmission(schema, values, {
  id: crypto.randomUUID(),
  locale: "en",
  submittedAt: new Date().toISOString()
});

await storage.saveSubmission(submission);
const responses = await storage.listSubmissions(schema.id, schema.version, {
  since: "2026-01-01T00:00:00.000Z",
  until: "2026-01-31T23:59:59.999Z"
});
const analytics = aggregateResponses(schema, responses);
```

`since` and `until` are inclusive ISO 8601 boundaries. They can be combined with a form version, and every adapter returns results by `submittedAt`, then submission ID. Use `createMemoryStorageAdapter()`, `createLocalStorageAdapter()`, and the database factories to create storage adapters. Duplicate submission IDs are rejected globally within an adapter. `clearResponses(formId)` removes every response version for that form while retaining schemas and other forms; `clear()` resets only the adapter's configured data. Aggregation and CSV export reject a different form ID/version; values removed from or incompatible with the current schema are treated as unanswered.

MongoDB callers create and own the connection, then inject its `Db` object. Call `createIndexes()` to create named form/timestamp and locale indexes. Documents remain scoped to the configured collections; `clear()` deletes their documents without dropping collections or indexes.

```ts
const storage = createMongoDbStorage({
  db: mongoClient.db("forms"),
  schemasCollectionName: "form_schemas",
  responsesCollectionName: "form_responses"
});
await storage.createIndexes();
```

Postgres accepts a `Pool`, `Client`, or compatible query wrapper. SQLite accepts a thin synchronous or asynchronous `run/get/all` executor, allowing applications to adapt `better-sqlite3`, `bun:sqlite`, libSQL, or another driver without adding one as a library dependency. D1 accepts the Worker API's structural `prepare/bind/first/all/run/batch` surface. All SQL adapters default `autoMigrate` to `false`; enabling it lazily creates the current tables and indexes once, while production connection, transaction, and migration lifecycles remain application responsibilities.

```ts
const postgresStorage = createPostgresStorage({ client: pool, autoMigrate: true });
const sqliteStorage = createSqliteStorage({ db: sqliteExecutor });
const d1Storage = createD1Storage({ db: env.DB });
```

Generate a Zod 4 validator without duplicating the Core validation rules:

```ts
const answerSchema = createZodFormSchema(schema);
const result = answerSchema.safeParse(candidateAnswers);
```

Zod failures use the field ID as their path and expose the Core validation code, translation message key, and interpolation values in custom issue parameters. Hidden answers are ignored during validation but are not transformed out of successful parse results.

### Analytics semantics

- Percentages use all valid submissions as the denominator.
- Multi-select percentages describe the share of submissions choosing each option and may total more than 100%.
- Text and textarea analytics expose only answered/unanswered counts; free-text content is never copied into aggregates.
- Number fields expose answered/unanswered counts plus minimum, maximum, and average.
- Rating fields default to integer values from 1 through 5 and share numeric analytics.
- Select, radio, multi-select, and checkbox fields expose counts and percentages.
- `calculateChoiceDistribution` and `calculateNumericSummary` support focused dashboards. An empty numeric summary uses `null` for average/min/max and `0` for total.
- `exportResponsesToCsv` returns UTF-8 BOM-prefixed RFC 4180 CSV by default; pass `{ withBom: false }` to omit the BOM. Rows use CRLF and the columns are exactly `submissionId`, `submittedAt`, `locale`, then the schema-order field columns; arrays are JSON-encoded.
- `escapeCsvCell` neutralizes formula-like strings by default and quotes commas, double quotes, CR, and LF while doubling embedded quotes.

### SSR and MVP boundaries

The published libraries do not read DOM or browser-only globals during rendering. The default renderer uses its submitted form element only from event handling to focus the first invalid control. LocalStorage is resolved when `createLocalStorageAdapter()` is called, never on import; pass a `StorageLike` implementation outside a browser. Builder UUIDs are generated only from user-event handlers; the Vite preview owns timestamp, Blob, and download behavior.

The library remains intentionally driver-neutral: callers own database connections, production migrations, credentials,
and cache storage. Builder ordering uses accessible up/down controls, and the memory adapter resets whenever its JavaScript
process or browser page is reloaded.

## 日本語

TypeScriptとReact向けの、スキーマ駆動・プラグイン可能なアンケートエンジンです。フォーム定義、実行時バリデーション、回答の保存、分析機能はフレームワーク非依存のコアに集約し、翻訳とストレージは小さなアダプターインターフェースを通じて注入できます。

### 含まれるもの

| 分類 | パッケージ | 用途 |
| --- | --- | --- |
| Core | `@form-engine-ts/core` | JSON互換型とスキーマ・表示条件・検証・回答・集計・CSVの純粋関数 |
| React Renderer / Builder | `@form-engine-ts/react` | SSR対応Provider、条件付きRenderer、アクセシブルなBuilder、フック、標準CSS |
| Storage Adapter | `@form-engine-ts/storage-memory` | フォームと回答を防御的コピーで保持するプロセス内ストレージ |
| Storage Adapter | `@form-engine-ts/storage-localstorage` | prefix分離とstorage注入に対応するブラウザ永続化 |
| Storage Adapter | `@form-engine-ts/storage-mongodb` | MongoDB Native Driver向けの完全なフォームストレージ |
| Storage Adapter | `@form-engine-ts/storage-postgres` | node-postgres互換query clientを注入するPostgreSQLストレージ |
| Storage Adapter | `@form-engine-ts/storage-sqlite` | 同期・非同期executorに対応するdriver非依存SQLiteストレージ |
| Storage Adapter | `@form-engine-ts/storage-d1` | prepared statementとtransactional batchを使うCloudflare D1ストレージ |
| Storage Adapter | `@form-engine-ts/storage-azure-table` | `@azure/data-tables`互換clientを注入するAzure Table Storage |
| Translator Adapter | `@form-engine-ts/translator-mock` | 英語・日本語の同期カタログとデモ用の決定的な非同期バッチ翻訳 |
| Translator Adapter | `@form-engine-ts/translator-azure` | region指定に対応するAzure AI Translator REST API v3.0連携 |
| Translator Adapter | `@form-engine-ts/translator-deepl` | 注入可能な`fetch`でDeepL Free/Proを利用する非同期翻訳 |
| Translator Adapter | `@form-engine-ts/translator-google` | API KeyまたはBearer認証に対応するGoogle Cloud Translation Basic v2連携 |
| Translator Adapter | `@form-engine-ts/translator-google-v3` | 用語集・label・分割送信・retry対応のGoogle Cloud Translation Advanced v3連携 |
| Translator Adapter | `@form-engine-ts/translator-i18next` | i18nextを利用する公式同期UI翻訳アダプター |
| Translator Utility | `@form-engine-ts/translator-cache` | 非同期翻訳adapter向けのstorage非依存TTL cache wrapper |
| Privacy Utility | `@form-engine-ts/privacy` | テキスト回答向けの標準・拡張可能な機密データ検出 |
| Zod Validator | `@form-engine-ts/zod` | Core互換issueを返す`FormSchema`からZod 4検証器への変換 |
| デモアプリ | `@form-engine-ts/preview` | Builder・回答・集計/CSVの3タブを備えた非公開Viteサンドボックス |

ライブラリパッケージは、宣言ファイルと明示的な`exports`を含む公開用のESM/CommonJS両対応パッケージとしてビルドされます。公開workflowはリポジトリシークレット`NPM_TOKEN`を使い、`packages/*`のライブラリをnpmへ公開し、全パッケージのバージョンが一致する`vX.Y.Z`タグに対してGitHub Releaseを作成します。

### 必要な環境とコマンド

- Node.js 22.22.2以上
- pnpm 11

```bash
pnpm install
pnpm dev
```

プレビューはViteで起動します。リポジトリ全体の受け入れ確認には、次のコマンドを使用します。

```bash
pnpm build
pnpm check
pnpm typecheck
pnpm lint
pnpm test
```

`pnpm lint`では、Biomeによりフォーマット、推奨リントルール、インポート順を検証します。

### 最新リリース

最新版は **v6.2.0**（2026-08-29）です。公開パッケージはすべてバージョン `6.2.0` で公開されています。
本リリースでは、非同期翻訳のキャンセル、進捗報告、部分的な失敗処理に加え、React／MUIワークスペースの一括翻訳に進捗・再試行・キャンセル操作を追加しました。v6.1.0の左右比較型翻訳ワークスペース、locale必須のstrict Submission契約、翻訳キー不足の診断も引き継いでいます。
全更新履歴は[RELEASE_NOTES.md](RELEASE_NOTES.md) と
[GitHub Release](https://github.com/nitta-a/form-engine-ts/releases/tag/v6.2.0) を参照してください。

### 編集・回答体験

任意の`pages`を定義すると、条件付きページの自動スキップ、ページ検証、アクセシブルな進捗表示を備えた
ウィザードになります。React Rendererは`autoSaveKey`によりversion付き下書きを500ms debounceで`localStorage`へ
保存・復元できます。編集時翻訳はスキーマへ保持され、`populateSchemaTranslations`で一括生成し、
`resolveLocalizedSchema`でAPI通信なしに同期解決します。Builderはページ所属と各言語の手動訳文を編集できます。
Coreには2つの単一選択質問を集計する`calculateCrossTabulation`と、timeout・任意HMAC署名対応の
`dispatchWebhook`も追加され、Zodは任意の`{ pageIndex }`によるページ単位検証に対応します。

### フォームの定義とレンダリング

```bash
pnpm add @form-engine-ts/core @form-engine-ts/react @form-engine-ts/translator-mock react react-dom
```

```tsx
import type { FormSchema } from "@form-engine-ts/core";
import { FormProvider, FormRenderer } from "@form-engine-ts/react";
import "@form-engine-ts/react/styles.css";
import { mockTranslator } from "@form-engine-ts/translator-mock";

const schema = {
  id: "contact",
  version: 1,
  title: "お問い合わせ",
  description: "ご用件を入力してください。",
  submitLabelKey: "contact.submit",
  fields: [
    {
      id: "q_a1b2c3d4",
      type: "text",
      title: "お名前",
      translationKey: "contact.name",
      required: true,
      minLength: 2
    },
    {
      id: "q_e5f6a7b8",
      type: "select",
      title: "お問い合わせの種類",
      translationKey: "contact.topic",
      required: false,
      options: [
        { id: "opt_11223344", label: "サポート" },
        { id: "opt_55667788", label: "営業へのご相談" }
      ]
    }
  ]
} as const satisfies FormSchema;

export function ContactForm() {
  return (
    <FormProvider
      schema={schema}
      locale="ja"
      translator={mockTranslator}
      onSubmit={async (values) => console.log(values)}
      resetOnSuccess
    >
      <FormRenderer successMessageKey="contact.success" />
    </FormProvider>
  );
}
```

`FormProvider`はスキーマを実行時に検証します。表示条件は回答変更時に再計算され、非表示のコントロールとエラーはDOMから除外されます。回答値は再表示に備えてUI内に保持されますが、送信値からは除外されます。`FormBuilder`は同じ`FormSchema`を編集する制御コンポーネントで、質問・選択肢の一意なIDをユーザー操作時に自動生成して画面から隠し、先行質問だけを参照する表示条件を保証します。

この形式は破壊的変更です。旧`titleKey`、`descriptionKey`、`helpTextKey`、選択肢の`value`／`labelKey`は読み込まれません。保存済みスキーマは、自然文の`title`／`description`／`label`と内部キーの`id`へ移行してください。

`validateSchemaStructure(schema)`は重複・dangling・自己参照・循環参照を診断します。`sanitizeSchema(schema)`は危険な条件参照を除去した新しいスキーマを返します。重複IDの安全な改名方法は推測できないため、重複質問・選択肢は診断されますが自動削除されません。

### アダプターの契約

スキーマ内の自然文はそのまま表示します。同期翻訳は検証、送信・状態メッセージ、プレースホルダー、Builder UIで引き続き使用するため、レンダリングがエフェクトに依存しません。

```ts
interface TranslationAdapter {
  translate(
    key: string,
    locale: string,
    params?: Readonly<Record<string, string | number>>
  ): string;
}
```

ネットワーク翻訳には別の非同期契約を使用し、Reactの同期レンダリングを維持します。

```ts
interface AsyncTranslationAdapter {
  translateText(text: string, targetLocale: string, sourceLocale?: string): Promise<string>;
  translateBatch(
    texts: readonly string[],
    targetLocale: string,
    sourceLocale?: string
  ): Promise<readonly string[]>;
}

const deepl = createDeeplTranslator({
  apiKey: process.env.DEEPL_API_KEY,
  apiType: "pro"
});
const japanese = await deepl.translateText("Thank you", "JA", "EN");
const translatedSchema = await resolveFormTranslation(schema, deepl, "JA", "EN");
```

`resolveFormTranslation`はフォーム・質問のタイトルと説明、選択肢ラベルを順序どおり1回のバッチで翻訳し、内部ID、表示条件、検証設定、質問の任意`translationKey`を保持します。

DeepLの認証情報は信頼できるサーバーだけで扱ってください。このアダプターは認証ヘッダー付きPOST JSON、`fetchFn`注入、HTTP/APIエラー通知に対応し、自動再試行は行いません。

Google Cloud Translation Basic v2では、アダプターごとにAPI KeyまたはBearer token providerのどちらか一方だけを使用します。API Keyは`key` query parameterへ設定し、OAuth2／Service Account利用者は更新可能なBearer token providerを注入します。

```ts
const googleWithApiKey = createGoogleTranslator({
  apiKey: process.env.GOOGLE_TRANSLATE_API_KEY
});

const googleWithBearer = createGoogleTranslator({
  getAccessToken: async () => credentials.getAccessToken()
});

const german = await googleWithBearer.translateBatch(["Hello", "Goodbye"], "de", "en");
```

Googleの認証情報も信頼できるサーバーだけで扱ってください。このアダプターはplain text翻訳、返却テキストのHTML entityデコード、1リクエスト最大128テキスト、HTTP/APIエラー通知に対応し、自動再試行は行いません。token生成・更新、ADC、Service Account署名は呼び出し側の責務です。

Azure AI Translatorはsubscription key認証を使用し、regionalまたはmulti-service resourceでは任意のregionを送信できます。`endpoint`には完全なTranslate操作URLを指定するため、custom domain利用時は`/translator/text/v3.0/translate`まで含めます。

```ts
const azure = createAzureTranslator({
  apiKey: process.env.AZURE_TRANSLATOR_KEY,
  region: "japaneast",
  endpoint: "https://example.cognitiveservices.azure.com/translator/text/v3.0/translate"
});

const french = await azure.translateBatch(["Hello", "Goodbye"], "fr", "en");
```

Azureの認証情報も信頼できるサーバーだけで扱ってください。このアダプターはcustom endpointのquery parameterを保持し、現行の1,000要素・50,000文字のリクエスト上限を通信前に検証します。`fetchFn`注入とAPIエラー内のsubscription key秘匿に対応し、自動再試行は行いません。

ストレージは非同期処理です。そのため、同じフォームを後からデータベースやHTTPベースの実装に切り替えられます。

```ts
interface SubmissionQueryOptions {
  readonly since?: string;
  readonly until?: string;
}

interface StorageAdapter {
  saveSubmission(submission: FormSubmission): Promise<void>;
  listSubmissions(
    formId: string,
    formVersion?: number,
    options?: SubmissionQueryOptions
  ): Promise<readonly FormSubmission[]>;
  clearResponses?(formId: string): Promise<void>;
  clear(): Promise<void>;
}
```

検証済みでイミュータブルな回答を作成して保存し、一致する回答を集計します。

```ts
const submission = createSubmission(schema, values, {
  id: crypto.randomUUID(),
  locale: "en",
  submittedAt: new Date().toISOString()
});

await storage.saveSubmission(submission);
const responses = await storage.listSubmissions(schema.id, schema.version, {
  since: "2026-01-01T00:00:00.000Z",
  until: "2026-01-31T23:59:59.999Z"
});
const analytics = aggregateResponses(schema, responses);
```

`since`と`until`は包含境界となるISO 8601文字列です。form versionと併用でき、すべてのアダプターが`submittedAt`、同値時はsubmission ID順で返します。`createMemoryStorageAdapter()`、`createLocalStorageAdapter()`、各データベースのファクトリでストレージを生成します。重複submission IDはアダプター内でグローバルに拒否されます。`clearResponses(formId)`は指定フォームの全version回答だけを削除し、スキーマと他フォームを保持します。`clear()`は設定されたアダプターデータだけを初期化します。PreviewではRespondent/Analytics両タブから確認付きで回答をクリアできます。

MongoDB接続は呼び出し側が所有し、`Db`をファクトリへ注入します。`createIndexes()`は名前付きのform/timestamp複合indexとlocale indexを作成します。`clear()`は設定されたコレクション内のドキュメントだけを削除し、コレクションとindexは保持します。

```ts
const storage = createMongoDbStorage({
  db: mongoClient.db("forms"),
  schemasCollectionName: "form_schemas",
  responsesCollectionName: "form_responses"
});
await storage.createIndexes();
```

Postgresは`Pool`、`Client`、互換query wrapperを受け取ります。SQLiteは同期または非同期の`run/get/all` executorを受け取るため、`better-sqlite3`、`bun:sqlite`、libSQLなどをライブラリのruntime依存にせず薄くラップできます。D1はWorker APIの構造的な`prepare/bind/first/all/run/batch`を利用します。全SQLアダプターの`autoMigrate`既定値は`false`です。有効時は現在のテーブルとindexを最初の操作前に一度だけ遅延作成しますが、本番の接続、transaction、migration lifecycleはアプリケーション側が管理します。

```ts
const postgresStorage = createPostgresStorage({ client: pool, autoMigrate: true });
const sqliteStorage = createSqliteStorage({ db: sqliteExecutor });
const d1Storage = createD1Storage({ db: env.DB });
```

Coreの検証規則を重複実装せず、Zod 4の回答検証器を生成できます。

```ts
const answerSchema = createZodFormSchema(schema);
const result = answerSchema.safeParse(candidateAnswers);
```

Zod issueはfield IDをpathとし、Coreの検証code、翻訳message key、補間値をcustom paramsに保持します。非表示回答は検証対象外ですが、成功したparse結果からは削除されません。

### 分析の仕様

- パーセンテージの分母には、すべての有効な回答を使用します。
- 複数選択のパーセンテージは、各選択肢を選んだ回答の割合を示すため、合計が100%を超える場合があります。
- textとtextareaの分析では回答済み・未回答の件数のみを公開し、自由記述の内容を集計結果へコピーしません。
- numberフィールドでは回答済み・未回答の件数に加え、最小値、最大値、平均値を公開します。
- ratingは既定で1～5の整数を扱い、numberと同じ数値集計を行います。
- select、radio、multi-select、checkboxフィールドでは件数とパーセンテージを公開します。
- `exportResponsesToCsv`はデフォルトで数式形式の文字列を無害化し、UTF-8 BOM付きのRFC 4180 CSVを返します。列は正確に`submissionId`、`submittedAt`、`locale`、続いてスキーマ順の設問列です。BOMを省く場合は`{ withBom: false }`、無害化を無効にする場合は`{ neutralizeFormulas: false }`を渡します。
- `escapeCsvCell`も同じ数式対策とRFC 4180の引用・内部引用符二重化を行う公開純粋関数です。

### SSRとMVPの範囲

公開ライブラリはレンダリング中にDOMやブラウザ専用グローバルへアクセスしません。LocalStorageはファクトリ呼び出し時にだけ解決され、SSRでは`StorageLike`を注入できます。BuilderのUUIDはユーザー操作イベント内だけで生成し、現在時刻、Blob、CSVダウンロードはPreviewのイベント処理に限定しています。

ライブラリはdriver非依存を維持しているため、データベース接続、production migration、credential、cache storageの
管理は呼び出し側が担当します。Builderの並び替えにはアクセシブルな上下ボタンを使用し、memory adapterは
JavaScript processまたはbrowser pageの再読み込み時にリセットされます。
