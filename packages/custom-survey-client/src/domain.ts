import type { FormSchema, QuestionType } from "@form-engine-ts/core";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFreeTextAnswerTranslation } from "./freeText";
import { toFreeTextAnswerItems } from "./freeTextNormalization";
import { type UseSurveyEditorDomainResult, type UseSurveyEditorResult, useSurveyEditor } from "./SurveyEditor";
import type {
  FreeTextAnswerDomainAdapter,
  FreeTextAnswerItem,
  SurveySchemaDomainAdapter,
  UseFreeTextDomainAnswerTranslationOptions,
  UseFreeTextDomainAnswerTranslationResult,
  UseSurveyEditorDomainOptions
} from "./types";

export function createSurveySchemaDomainAdapter<TDomain>(
  toFormSchema: SurveySchemaDomainAdapter<TDomain>["toFormSchema"]
): SurveySchemaDomainAdapter<TDomain> {
  return { toFormSchema };
}

export function toFreeTextAnswerItemsFromDomain<TDomain>(
  items: readonly TDomain[],
  adapter: FreeTextAnswerDomainAdapter<TDomain>
): readonly FreeTextAnswerItem[] {
  return toFreeTextAnswerItems(items.map(adapter.toFreeTextAnswerItem));
}

export function useFreeTextDomainAnswerTranslation<TDomain>(
  options: UseFreeTextDomainAnswerTranslationOptions<TDomain>
): UseFreeTextDomainAnswerTranslationResult<TDomain> {
  const { items, domainAdapter, ...translationOptions } = options;
  const translation = useFreeTextAnswerTranslation({
    ...translationOptions,
    items: toFreeTextAnswerItemsFromDomain(items, domainAdapter)
  });
  const translate = useCallback(
    (domainItems: readonly TDomain[], directOptions?: Parameters<typeof translation.translate>[1]) =>
      translation.translate(toFreeTextAnswerItemsFromDomain(domainItems, domainAdapter), directOptions),
    [domainAdapter, translation.translate]
  );
  return { ...translation, translate };
}

/** Keeps the application domain record as the source of truth while the builder edits a mapped schema. */
export function useSurveyEditorDomain<TDomain>(
  options: UseSurveyEditorDomainOptions<TDomain>
): UseSurveyEditorResult & { readonly domain: TDomain };
export function useSurveyEditorDomain<TDomain>(
  options: UseSurveyEditorDomainOptions<TDomain>
): UseSurveyEditorDomainResult<TDomain>;
export function useSurveyEditorDomain<TDomain>(
  options: UseSurveyEditorDomainOptions<TDomain>
): UseSurveyEditorDomainResult<TDomain> {
  const { domain, domainAdapter, adapter, questionAdapter, onDomainChange, slots, domainMetadata, ...editorOptions } =
    options;
  const domainRef = useRef(domain);
  domainRef.current = domain;
  const schema = useMemo(() => domainAdapter.toFormSchema(domain), [domain, domainAdapter]);
  const schemaRef = useRef(schema);
  const previousDomain = useRef(domain);
  if (previousDomain.current !== domain) {
    previousDomain.current = domain;
    schemaRef.current = schema;
  }

  useEffect(() => {
    domainRef.current = domain;
  }, [domain]);

  const onSchemaChange = useCallback(
    (nextSchema: FormSchema) => {
      schemaRef.current = nextSchema;
      const nextDomain = domainAdapter.fromFormSchema(nextSchema, domainRef.current);
      domainRef.current = nextDomain;
      onDomainChange?.(nextDomain);
    },
    [domainAdapter, onDomainChange]
  );

  const editor = useSurveyEditor({
    ...editorOptions,
    schema,
    adapter: {
      translateSurveyPreview: async (request) => {
        const translatedDomain = await adapter.translateSurveyPreview({
          ...request,
          domain: domainRef.current
        });
        domainRef.current = translatedDomain;
        onDomainChange?.(translatedDomain);
        const translatedSchema = domainAdapter.toFormSchema(translatedDomain);
        schemaRef.current = translatedSchema;
        return translatedSchema;
      },
      updateSurveyDraft: async (schema) => {
        const nextDomain = domainAdapter.fromFormSchema(schema, domainRef.current);
        domainRef.current = nextDomain;
        onDomainChange?.(nextDomain);
        let persistedDomain: TDomain | undefined;
        if (adapter.updateSurveyDraftResult === undefined) {
          await adapter.updateSurveyDraft(nextDomain);
        } else {
          persistedDomain = await adapter.updateSurveyDraftResult(nextDomain);
        }
        if (persistedDomain !== undefined) {
          domainRef.current = persistedDomain;
          onDomainChange?.(persistedDomain);
        }
      }
    },
    onChange: onSchemaChange
  });

  const addQuestion = useCallback(
    async (type: QuestionType, pageId?: string): Promise<boolean> => {
      const result = editor.builder.addField(type, pageId);
      if (!result.success) return false;
      const nextSchema = schemaRef.current;
      const previousIds = new Set(editor.schema.fields.map((field) => field.id));
      const question = nextSchema.fields.find((field) => !previousIds.has(field.id));
      if (questionAdapter?.addQuestion === undefined || question === undefined) return true;
      try {
        const controller = new AbortController();
        const nextDomain = await questionAdapter.addQuestion({
          domain: domainRef.current,
          schema: nextSchema,
          question,
          index: nextSchema.fields.indexOf(question),
          signal: controller.signal
        });
        if (nextDomain !== undefined) {
          domainRef.current = nextDomain;
          onDomainChange?.(nextDomain);
        }
        return true;
      } catch {
        return false;
      }
    },
    [editor.builder, editor.schema, onDomainChange, questionAdapter]
  );

  const reorderQuestions = useCallback(
    async (fieldId: string, targetIndex: number): Promise<boolean> => {
      const result = editor.builder.moveField(fieldId, targetIndex);
      if (!result.success) return false;
      if (questionAdapter?.reorderQuestions === undefined) return true;
      try {
        const controller = new AbortController();
        const nextSchema = schemaRef.current;
        const nextDomain = await questionAdapter.reorderQuestions({
          domain: domainRef.current,
          schema: nextSchema,
          fieldIds: nextSchema.fields.map((field) => field.id),
          signal: controller.signal
        });
        if (nextDomain !== undefined) {
          domainRef.current = nextDomain;
          onDomainChange?.(nextDomain);
        }
        return true;
      } catch {
        return false;
      }
    },
    [editor.builder, onDomainChange, questionAdapter]
  );

  const removeQuestion = useCallback(
    async (fieldId: string): Promise<boolean> => {
      const previousSchema = schemaRef.current;
      const questionIndex = previousSchema.fields.findIndex((field) => field.id === fieldId);
      const question = previousSchema.fields[questionIndex];
      const result = editor.builder.removeField(fieldId);
      if (!result.success) return false;
      if (questionAdapter?.removeQuestion === undefined || question === undefined) return true;
      try {
        const nextDomain = await questionAdapter.removeQuestion({
          domain: domainRef.current,
          schema: schemaRef.current,
          question,
          index: questionIndex,
          signal: new AbortController().signal
        });
        if (nextDomain !== undefined) {
          domainRef.current = nextDomain;
          onDomainChange?.(nextDomain);
        }
        return true;
      } catch {
        return false;
      }
    },
    [editor.builder, onDomainChange, questionAdapter]
  );

  return {
    ...editor,
    domain: domainRef.current,
    addQuestion,
    removeQuestion,
    reorderQuestions,
    ...(slots === undefined ? {} : { slots }),
    ...(domainMetadata === undefined ? {} : { domainMetadata })
  };
}
