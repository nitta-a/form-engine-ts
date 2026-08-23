# form-engine-ts

## English

A schema-driven, pluggable survey engine for TypeScript and React. Form definitions, runtime validation, submissions, and analytics live in a framework-independent core; translation and storage are injected through small adapter interfaces.

### What's included

| Workspace | Purpose |
| --- | --- |
| `@form-engine/core` | Form schema types, runtime schema/answer validation, immutable submissions, adapter interfaces, and aggregate analytics |
| `@form-engine/react` | SSR-safe `FormProvider`, accessible renderer, hooks, component overrides, and optional base styles |
| `@form-engine/storage-memory` | Process-local async storage adapter with defensive copying and duplicate protection |
| `@form-engine/translator-mock` | English/Japanese synchronous translation adapter with interpolation and fallback |
| `@form-engine/preview` | Vite application demonstrating every field, locale switching, submission, reset, and analytics |

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

`FormProvider` validates the schema at runtime. Answers are validated on submit; fields with existing errors are revalidated as the user changes them. Changing the controlled `locale` prop does not clear answers. `useForm` exposes the complete form state and actions, while `useField(id)` provides one field's definition, value, error, and setter. `FormRenderer.components` can replace any default field renderer.

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

Storage is asynchronous so the same form can later use a database or HTTP-backed implementation:

```ts
interface StorageAdapter {
  saveSubmission(submission: FormSubmission): Promise<void>;
  listSubmissions(formId: string, formVersion?: number): Promise<readonly FormSubmission[]>;
  clear(): Promise<void>;
}
```

Create a validated immutable submission, save it, then aggregate matching responses:

```ts
const submission = createSubmission(schema, values, {
  id: crypto.randomUUID(),
  locale: "en"
});

await storage.saveSubmission(submission);
const responses = await storage.listSubmissions(schema.id, schema.version);
const analytics = aggregateResponses(schema, responses);
```

Duplicate submission IDs are rejected. Aggregation rejects responses with a different form ID/version or invalid answers.

### Analytics semantics

- Percentages use all valid submissions as the denominator.
- Multi-select percentages describe the share of submissions choosing each option and may total more than 100%.
- Text and textarea analytics expose only answered/unanswered counts; free-text content is never copied into aggregates.
- Number fields expose answered/unanswered counts plus minimum, maximum, and average.
- Select, radio, multi-select, and checkbox fields expose counts and percentages.

### SSR and MVP boundaries

The published libraries do not read DOM or browser-only globals during rendering. The default renderer uses the DOM only from submit-event handling to focus the first invalid control. The Vite preview and its `crypto.randomUUID()` submission IDs are browser-only.

This MVP intentionally excludes a visual form builder, conditional fields, date/email/rating controls, behavioral telemetry, editable submissions, remote persistence, and network translation loading. The memory adapter resets whenever its JavaScript process or browser page is reloaded.

## 日本語

TypeScriptとReact向けの、スキーマ駆動・プラグイン可能なアンケートエンジンです。フォーム定義、実行時バリデーション、回答の保存、分析機能はフレームワーク非依存のコアに集約し、翻訳とストレージは小さなアダプターインターフェースを通じて注入できます。

### 含まれるもの

| ワークスペース | 目的 |
| --- | --- |
| `@form-engine/core` | フォームスキーマ型、実行時のスキーマ・回答バリデーション、イミュータブルな回答、アダプターインターフェース、集計分析 |
| `@form-engine/react` | SSR対応の`FormProvider`、アクセシブルなレンダラー、フック、コンポーネントの差し替え、任意の基本スタイル |
| `@form-engine/storage-memory` | 防御的コピーと重複防止機能を備えた、プロセス内で動作する非同期ストレージアダプター |
| `@form-engine/translator-mock` | 補間とフォールバックに対応した、英語・日本語の同期翻訳アダプター |
| `@form-engine/preview` | 全フィールド、ロケール切り替え、回答送信、リセット、分析を確認できるViteアプリ |

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

`FormProvider`はスキーマを実行時に検証します。回答は送信時に検証され、既存のエラーがあるフィールドはユーザーの変更時に再検証されます。制御された`locale`プロパティを変更しても回答は消去されません。`useForm`からフォーム全体の状態とアクションを取得でき、`useField(id)`から各フィールドの定義、値、エラー、セッターを取得できます。`FormRenderer.components`を使うと、任意の標準フィールドレンダラーを置き換えられます。

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

ストレージは非同期処理です。そのため、同じフォームを後からデータベースやHTTPベースの実装に切り替えられます。

```ts
interface StorageAdapter {
  saveSubmission(submission: FormSubmission): Promise<void>;
  listSubmissions(formId: string, formVersion?: number): Promise<readonly FormSubmission[]>;
  clear(): Promise<void>;
}
```

検証済みでイミュータブルな回答を作成して保存し、一致する回答を集計します。

```ts
const submission = createSubmission(schema, values, {
  id: crypto.randomUUID(),
  locale: "en"
});

await storage.saveSubmission(submission);
const responses = await storage.listSubmissions(schema.id, schema.version);
const analytics = aggregateResponses(schema, responses);
```

重複する回答IDは拒否されます。フォームIDまたはバージョンが異なる回答や、無効な回答を含む集計も拒否されます。

### 分析の仕様

- パーセンテージの分母には、すべての有効な回答を使用します。
- 複数選択のパーセンテージは、各選択肢を選んだ回答の割合を示すため、合計が100%を超える場合があります。
- textとtextareaの分析では回答済み・未回答の件数のみを公開し、自由記述の内容を集計結果へコピーしません。
- numberフィールドでは回答済み・未回答の件数に加え、最小値、最大値、平均値を公開します。
- select、radio、multi-select、checkboxフィールドでは件数とパーセンテージを公開します。

### SSRとMVPの範囲

公開ライブラリは、レンダリング中にDOMやブラウザ専用のグローバルへアクセスしません。標準レンダラーがDOMを使用するのは、送信イベントの処理中に最初の無効なコントロールへフォーカスを移す場合だけです。Viteプレビューと、`crypto.randomUUID()`を使った回答IDの生成はブラウザ専用です。

このMVPには、ビジュアルフォームビルダー、条件付きフィールド、date/email/ratingコントロール、行動テレメトリー、回答の編集、リモート永続化、ネットワーク経由の翻訳読み込みは含まれません。メモリアダプターは、JavaScriptプロセスまたはブラウザページを再読み込みするとリセットされます。
