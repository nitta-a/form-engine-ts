import type { FormSchema } from "@form-engine-ts/core";
import { FormBuilder, useFormBuilder } from "@form-engine-ts/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SurveyEditorOperationState, SurveyEditorProps, SurveyEditorRenderProps } from "./types";

function normalizeError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

function initialState(): SurveyEditorOperationState {
  return { status: "idle" };
}

export interface UseSurveyEditorOptions
  extends Omit<SurveyEditorProps, "render" | "slots" | "saveLabel" | "translateLabel"> {}

export interface UseSurveyEditorResult extends SurveyEditorRenderProps {
  readonly builder: ReturnType<typeof useFormBuilder>;
  readonly onChange: (schema: FormSchema) => void;
}

/** Combines the existing headless builder state with save and schema translation operations. */
export function useSurveyEditor({
  schema,
  adapter,
  onChange,
  locale: _locale,
  sourceLocale = schema.defaultLocale ?? "en",
  targetLocale = schema.supportedLocales?.find((locale) => locale !== sourceLocale) ?? sourceLocale,
  ...builderOptions
}: UseSurveyEditorOptions): UseSurveyEditorResult {
  const [draftSchema, setDraftSchema] = useState(schema);
  const [state, setState] = useState<SurveyEditorOperationState>(initialState);
  const translationController = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    setDraftSchema(schema);
  }, [schema]);

  const updateSchema = useCallback(
    (nextSchema: FormSchema) => {
      setDraftSchema(nextSchema);
      setState((current) => (current.status === "idle" ? current : initialState()));
      onChange?.(nextSchema);
    },
    [onChange]
  );

  const builder = useFormBuilder({
    schema: draftSchema,
    onChange: updateSchema,
    ...builderOptions
  });

  const save = useCallback(async (): Promise<boolean> => {
    setState({ status: "loading" });
    try {
      await adapter.save(draftSchema);
      setState({ status: "success" });
      return true;
    } catch (cause) {
      const error = normalizeError(cause);
      setState({ status: "error", error });
      return false;
    }
  }, [adapter, draftSchema]);

  const translate = useCallback(async (): Promise<boolean> => {
    translationController.current?.abort();
    const controller = new AbortController();
    translationController.current = controller;
    setState({ status: "loading" });
    try {
      const translatedSchema = await adapter.translate({
        schema: draftSchema,
        sourceLocale,
        targetLocale,
        signal: controller.signal
      });
      if (controller.signal.aborted) return false;
      updateSchema(translatedSchema);
      setState({ status: "success" });
      return true;
    } catch (cause) {
      if (controller.signal.aborted) return false;
      const error = normalizeError(cause);
      setState({ status: "error", error });
      return false;
    }
  }, [adapter, draftSchema, sourceLocale, targetLocale, updateSchema]);

  return { schema: draftSchema, sourceLocale, targetLocale, state, save, translate, builder, onChange: updateSchema };
}

function defaultToolbar(props: SurveyEditorRenderProps, saveLabel: string, translateLabel: string): React.JSX.Element {
  const { state, save, translate } = props;
  return (
    <div className="fe-survey-editor-toolbar">
      <button type="button" onClick={() => void save()} disabled={state.status === "loading"}>
        {state.status === "loading" ? "…" : saveLabel}
      </button>
      <button type="button" onClick={() => void translate()} disabled={state.status === "loading"}>
        {translateLabel}
      </button>
    </div>
  );
}

/** A ready-to-use survey editor with injectable persistence and translation operations. */
export function SurveyEditor(props: SurveyEditorProps): React.JSX.Element {
  const {
    adapter,
    onChange,
    locale,
    sourceLocale,
    targetLocale,
    render,
    slots,
    saveLabel = "Save",
    translateLabel = "Translate",
    ...builderOptions
  } = props;
  const editor = useSurveyEditor({
    ...builderOptions,
    adapter,
    ...(onChange === undefined ? {} : { onChange }),
    ...(locale === undefined ? {} : { locale }),
    ...(sourceLocale === undefined ? {} : { sourceLocale }),
    ...(targetLocale === undefined ? {} : { targetLocale })
  });
  const renderedProps: SurveyEditorRenderProps = {
    schema: editor.schema,
    sourceLocale: editor.sourceLocale,
    targetLocale: editor.targetLocale,
    state: editor.state,
    save: editor.save,
    translate: editor.translate
  };

  if (render !== undefined) return <>{render(renderedProps)}</>;

  return (
    <section className="fe-survey-editor">
      {slots?.toolbar?.(renderedProps) ?? defaultToolbar(renderedProps, saveLabel, translateLabel)}
      {slots?.status?.(editor.state)}
      {editor.state.error !== undefined ? <div role="alert">{editor.state.error.message}</div> : null}
      <FormBuilder
        {...builderOptions}
        schema={editor.schema}
        onChange={editor.onChange}
        {...(locale === undefined ? {} : { locale })}
      />
      {slots?.after?.(renderedProps)}
    </section>
  );
}
