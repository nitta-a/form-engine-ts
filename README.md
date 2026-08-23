# form-engine-ts

## English

A schema-driven, pluggable survey engine for TypeScript and React. Form definitions, runtime validation, submissions, and analytics live in a framework-independent core; translation and storage are injected through small adapter interfaces.

### What's included

| Workspace | Purpose |
| --- | --- |
| `@form-engine/core` | Pure schema, visibility, validation, submission, analytics, and CSV functions plus JSON-friendly types |
| `@form-engine/react` | SSR-safe `FormProvider`, conditional renderer, accessible visual builder, hooks, overrides, and base styles |
| `@form-engine/storage-memory` | Process-local form/submission storage factory with defensive copying and duplicate protection |
| `@form-engine/storage-localstorage` | Prefix-isolated browser persistence factory with injectable storage for tests and SSR callers |
| `@form-engine/translator-mock` | English/Japanese synchronous translation adapter with interpolation and fallback |
| `@form-engine/translator-deepl` | Server-side asynchronous DeepL Free/Pro text translation using injectable `fetch` |
| `@form-engine/translator-google` | Server-side Google Cloud Translation Basic v2 adapter with API Key or Bearer authentication |
| `@form-engine/storage-mongodb` | MongoDB Native Driver storage factory implementing the complete form storage contract |
| `@form-engine/zod` | Pure `FormSchema` to Zod 3 answer-validator generation with Core-compatible issues |
| `@form-engine/preview` | Three-tab Vite sandbox for building, responding, switching storage, analytics, and CSV export |

The library packages build as public ESM packages with declarations and explicit `exports`. The publish workflow expects an `NPM_TOKEN` repository secret, publishes all `packages/*` libraries to npm, and creates a GitHub Release for tags in the `vX.Y.Z` format after verifying that every package has the matching version.

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

### Define and render a form

```tsx
import type { FormSchema } from "@form-engine/core";
import { FormProvider, FormRenderer } from "@form-engine/react";
import "@form-engine/react/styles.css";

const schema = {
  id: "contact",
  version: 1,
  titleKey: "contact.title",
  submitLabelKey: "contact.submit",
  fields: [
    {
      id: "name",
      type: "text",
      labelKey: "contact.name",
      required: true,
      minLength: 2
    },
    {
      id: "topic",
      type: "select",
      labelKey: "contact.topic",
      options: [
        { value: "support", labelKey: "topic.support" },
        { value: "sales", labelKey: "topic.sales" }
      ]
    },
    {
      id: "score",
      type: "rating",
      labelKey: "contact.score",
      min: 1,
      max: 5
    },
    {
      id: "supportDetails",
      type: "textarea",
      labelKey: "contact.supportDetails",
      displayCondition: {
        questionId: "topic",
        operator: "equals",
        value: "support"
      }
    }
  ]
} as const satisfies FormSchema;

export function ContactForm() {
  return (
    <FormProvider
      schema={schema}
      locale="en"
      translator={translator}
      onSubmit={async (values) => save(values)}
      resetOnSuccess
    >
      <FormRenderer successMessageKey="contact.success" />
    </FormProvider>
  );
}
```

`FormProvider` validates the schema at runtime. Conditions update as answers change, hidden controls and errors leave the DOM, and retained hidden values are removed from the submitted values. Changing the controlled `locale` prop does not clear answers. `useForm` exposes the complete form state and actions, while `useField(id)` provides one field's definition, value, error, and setter. `FormRenderer.components` can replace any default field renderer. `FormBuilder` is a controlled component that edits the same `FormSchema` data. It commits non-empty, unique question IDs and permits display conditions to reference prior questions only.

Use `validateSchemaStructure(schema)` for focused duplicate/dangling/self/cycle diagnostics and `sanitizeSchema(schema)` to return a new schema without unsafe condition references. Sanitization never guesses how duplicate question or choice IDs should be renamed, so duplicates are reported but preserved.

### Adapter contracts

Translations are synchronous so rendering does not depend on effects:

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
```

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

Storage is asynchronous so the same form can later use a database or HTTP-backed implementation:

```ts
interface StorageAdapter {
  saveSubmission(submission: FormSubmission): Promise<void>;
  listSubmissions(formId: string, formVersion?: number): Promise<readonly FormSubmission[]>;
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
const responses = await storage.listSubmissions(schema.id, schema.version);
const analytics = aggregateResponses(schema, responses);
```

Use `createMemoryStorageAdapter()`, `createLocalStorageAdapter()`, and `createMockTranslationAdapter()` to create adapters. Adapter classes are no longer exported. Duplicate submission IDs are rejected globally within an adapter. `clearResponses(formId)` removes every response version for that form while retaining schemas and other forms; `clear()` resets the entire adapter. Aggregation and CSV export reject a different form ID/version; values removed from or incompatible with the current schema are treated as unanswered.

MongoDB callers create and own the connection, then inject its `Db` object. Documents remain scoped to the configured collections; `clear()` deletes their documents without dropping collections or indexes.

```ts
const storage = createMongoDbStorage({
  db: mongoClient.db("forms"),
  schemasCollectionName: "form_schemas",
  responsesCollectionName: "form_responses"
});
```

Generate a Zod 3 validator without duplicating the Core validation rules:

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
- `exportResponsesToCsv` returns UTF-8 BOM-prefixed RFC 4180 CSV with CRLF rows, metadata columns, schema-order field columns, and JSON-encoded arrays.
- `escapeCsvCell` is exported for custom CSV producers and quotes commas, double quotes, CR, and LF while doubling embedded quotes.

### SSR and MVP boundaries

The published libraries do not read DOM or browser-only globals during rendering. The default renderer uses its submitted form element only from event handling to focus the first invalid control. LocalStorage is resolved when `createLocalStorageAdapter()` is called, never on import; pass a `StorageLike` implementation outside a browser. The Vite preview owns browser-only UUID, timestamp, Blob, and download behavior.

This phase still excludes drag-and-drop ordering, date/email controls, multiple simultaneous conditions, a publish/version workflow, behavioral telemetry, editable responses, network translator retry/caching, MongoDB migrations/transactions, and Zod answer transforms. Builder ordering uses accessible up/down controls. The memory adapter resets whenever its JavaScript process or browser page is reloaded.

## 日本語

TypeScriptとReact向けの、スキーマ駆動・プラグイン可能なアンケートエンジンです。フォーム定義、実行時バリデーション、回答の保存、分析機能はフレームワーク非依存のコアに集約し、翻訳とストレージは小さなアダプターインターフェースを通じて注入できます。

### 含まれるもの

| ワークスペース | 目的 |
| --- | --- |
| `@form-engine/core` | JSON互換型と、スキーマ・表示条件・検証・回答・集計・CSVの純粋関数 |
| `@form-engine/react` | SSR対応のProvider、条件付きレンダラー、アクセシブルなビルダー、フック、標準CSS |
| `@form-engine/storage-memory` | フォームと回答を防御的コピーで保持するプロセス内ストレージファクトリ |
| `@form-engine/storage-localstorage` | prefix分離とテスト用storage注入に対応するブラウザ永続化ファクトリ |
| `@form-engine/translator-mock` | 補間とフォールバックに対応した、英語・日本語の同期翻訳アダプター |
| `@form-engine/translator-deepl` | 注入可能な`fetch`でDeepL Free/Proを利用するサーバー向け非同期翻訳 |
| `@form-engine/translator-google` | API KeyまたはBearer認証に対応するGoogle Cloud Translation Basic v2アダプター |
| `@form-engine/storage-mongodb` | MongoDB Native Driver向けの完全なフォームストレージファクトリ |
| `@form-engine/zod` | Core互換issueを返す、`FormSchema`からZod 3検証器への純粋な変換 |
| `@form-engine/preview` | Builder・回答・集計/CSVの3タブを備えたViteサンドボックス |

ライブラリパッケージは、宣言ファイルと明示的な`exports`を含む公開用のESMパッケージとしてビルドされます。公開workflowはリポジトリシークレット`NPM_TOKEN`を使い、`packages/*`のライブラリをnpmへ公開し、全パッケージのバージョンが一致する`vX.Y.Z`タグに対してGitHub Releaseを作成します。

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

### フォームの定義とレンダリング

```tsx
import type { FormSchema } from "@form-engine/core";
import { FormProvider, FormRenderer } from "@form-engine/react";
import "@form-engine/react/styles.css";

const schema = {
  id: "contact",
  version: 1,
  titleKey: "contact.title",
  submitLabelKey: "contact.submit",
  fields: [
    {
      id: "name",
      type: "text",
      labelKey: "contact.name",
      required: true,
      minLength: 2
    },
    {
      id: "topic",
      type: "select",
      labelKey: "contact.topic",
      options: [
        { value: "support", labelKey: "topic.support" },
        { value: "sales", labelKey: "topic.sales" }
      ]
    }
  ]
} as const satisfies FormSchema;

export function ContactForm() {
  return (
    <FormProvider
      schema={schema}
      locale="en"
      translator={translator}
      onSubmit={async (values) => save(values)}
      resetOnSuccess
    >
      <FormRenderer successMessageKey="contact.success" />
    </FormProvider>
  );
}
```

`FormProvider`はスキーマを実行時に検証します。表示条件は回答変更時に再計算され、非表示のコントロールとエラーはDOMから除外されます。回答値は再表示に備えてUI内に保持されますが、送信値からは除外されます。`FormBuilder`は同じ`FormSchema`を編集する制御コンポーネントで、空でない一意な質問IDと、先行質問だけを参照する表示条件を保証します。

`validateSchemaStructure(schema)`は重複・dangling・自己参照・循環参照を診断します。`sanitizeSchema(schema)`は危険な条件参照を除去した新しいスキーマを返します。重複IDの安全な改名方法は推測できないため、重複質問・選択肢は診断されますが自動削除されません。

### アダプターの契約

翻訳は同期処理です。そのため、レンダリングがエフェクトに依存しません。

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
```

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

ストレージは非同期処理です。そのため、同じフォームを後からデータベースやHTTPベースの実装に切り替えられます。

```ts
interface StorageAdapter {
  saveSubmission(submission: FormSubmission): Promise<void>;
  listSubmissions(formId: string, formVersion?: number): Promise<readonly FormSubmission[]>;
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
const responses = await storage.listSubmissions(schema.id, schema.version);
const analytics = aggregateResponses(schema, responses);
```

`createMemoryStorageAdapter()`、`createLocalStorageAdapter()`、`createMockTranslationAdapter()`でアダプターを生成します。従来のクラスexportは廃止されました。`clearResponses(formId)`は指定フォームの全version回答だけを削除し、スキーマと他フォームを保持します。`clear()`はアダプター全体を初期化します。PreviewではRespondent/Analytics両タブから確認付きで回答をクリアできます。

MongoDB接続は呼び出し側が所有し、`Db`をファクトリへ注入します。`clear()`は設定されたコレクション内のドキュメントだけを削除し、コレクションとindexは保持します。

```ts
const storage = createMongoDbStorage({
  db: mongoClient.db("forms"),
  schemasCollectionName: "form_schemas",
  responsesCollectionName: "form_responses"
});
```

Coreの検証規則を重複実装せず、Zod 3の回答検証器を生成できます。

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
- CSVはUTF-8 BOM、CRLF、RFC 4180形式で、配列値をJSON文字列として出力します。
- `escapeCsvCell`はカンマ、引用符、CR、LFを含むセルを引用し、内部引用符を二重化する公開純粋関数です。

### SSRとMVPの範囲

公開ライブラリはレンダリング中にDOMやブラウザ専用グローバルへアクセスしません。LocalStorageはファクトリ呼び出し時にだけ解決され、SSRでは`StorageLike`を注入できます。UUID、現在時刻、Blob、CSVダウンロードはPreviewのイベント処理に限定しています。

複数条件、ドラッグ&ドロップ、date/email、公開・版管理ワークフロー、行動テレメトリー、回答編集、ネットワーク翻訳の再試行・キャッシュ、MongoDB migration・transaction、Zodによる回答変換は対象外です。並び替えには上下ボタンを使用します。メモリアダプターはページ再読み込み時にリセットされます。
