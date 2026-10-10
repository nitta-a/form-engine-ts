import { type FormSchema, validateFormSchema } from "@form-engine-ts/core";
import { useId, useState } from "react";
import { previewCreationPolicy } from "./previewPolicy";

interface SurveySchemaToolsProps {
  readonly schema: FormSchema;
  readonly locale: string;
  readonly disabled?: boolean;
  readonly onChange: (schema: FormSchema) => void | Promise<void>;
}

export function SurveySchemaTools({ schema, locale, disabled = false, onChange }: SurveySchemaToolsProps) {
  const japanese = locale.startsWith("ja");
  const inputId = useId();
  const [input, setInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<{ readonly error: boolean; readonly message: string } | null>(null);

  const downloadSchema = () => {
    const json = JSON.stringify(schema, null, 2);
    const url = URL.createObjectURL(new Blob([`${json}\n`], { type: "application/json;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${schema.id}-v${schema.version}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importSchema = async () => {
    let value: unknown;
    try {
      value = JSON.parse(input);
    } catch {
      setStatus({ error: true, message: japanese ? "JSONの形式を確認してください。" : "Enter valid JSON." });
      return;
    }
    const result = validateFormSchema(value, { policy: previewCreationPolicy });
    if (!result.valid) {
      const detail = result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n");
      const message = japanese ? "アンケートを読み込めません。" : "The questionnaire could not be imported.";
      setStatus({ error: true, message: `${message}\n${detail}` });
      return;
    }
    setImporting(true);
    try {
      await onChange(result.value);
      setInput("");
      setStatus({ error: false, message: japanese ? "アンケートを読み込みました。" : "Questionnaire imported." });
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      const message = japanese ? "アンケートを保存できませんでした。" : "The questionnaire could not be saved.";
      setStatus({ error: true, message: `${message} ${detail}` });
    } finally {
      setImporting(false);
    }
  };

  return (
    <section
      className="survey-schema-tools json-card"
      aria-label={japanese ? "アンケートのバックアップ" : "Questionnaire backup"}
    >
      <h3>{japanese ? "アンケートのバックアップ" : "Questionnaire backup"}</h3>
      <p>
        {japanese
          ? "質問・分岐・翻訳をまとめて保存できます。"
          : "Save questions, conditions, and translations together."}
      </p>
      <button className="secondary-action" type="button" onClick={downloadSchema}>
        {japanese ? "アンケートをJSONで保存" : "Download questionnaire JSON"}
      </button>
      <details className="workspace-details">
        <summary>{japanese ? "現在のJSONを確認" : "Inspect questionnaire JSON"}</summary>
        <pre>
          <code>{JSON.stringify(schema, null, 2)}</code>
        </pre>
      </details>
      <details className="workspace-details">
        <summary>{japanese ? "JSONからアンケートを読み込む" : "Import questionnaire JSON"}</summary>
        <p>
          {japanese
            ? "現在のアンケートを置き換えます。先にJSONを保存しておくと元に戻せます。"
            : "This replaces the current questionnaire. Download its JSON first to keep a backup."}
        </p>
        <label htmlFor={inputId}>{japanese ? "アンケートのJSON" : "Questionnaire JSON"}</label>
        <textarea
          id={inputId}
          className="survey-schema-input"
          rows={8}
          value={input}
          disabled={disabled || importing}
          spellCheck={false}
          onChange={(event) => {
            setInput(event.currentTarget.value);
            setStatus(null);
          }}
        />
        <button
          className="secondary-action"
          type="button"
          disabled={disabled || importing || input.trim().length === 0}
          onClick={() => void importSchema()}
        >
          {japanese ? "検証して置き換える" : "Validate and replace questionnaire"}
        </button>
      </details>
      {status === null ? null : (
        <p className="survey-schema-status" role={status.error ? "alert" : "status"}>
          {status.message}
        </p>
      )}
    </section>
  );
}
