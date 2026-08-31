import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFreeTextAnswerTranslation } from "./freeText";
import { toFreeTextAnswerItems } from "./freeTextNormalization";
import { toSurveyResponseSummary } from "./responseSummary";
import { type UseSurveyEditorResult, useSurveyEditor } from "./SurveyEditor";
import type {
  FreeTextAnswerDomainAdapter,
  FreeTextAnswerItem,
  SurveySchemaDomainAdapter,
  SurveySummaryInput,
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

export function toSurveyResponseSummaryFromDomain<TDomain>(
  summary: SurveySummaryInput,
  version: TDomain,
  adapter: SurveySchemaDomainAdapter<TDomain>,
  sourceLanguage: string
) {
  return toSurveyResponseSummary(summary, adapter.toFormSchema(version), sourceLanguage);
}

/** Keeps the application domain record as the source of truth while the builder edits a mapped schema. */
export function useSurveyEditorDomain<TDomain>(
  options: UseSurveyEditorDomainOptions<TDomain>
): UseSurveyEditorResult & { readonly domain: TDomain } {
  const { domain, domainAdapter, adapter, onDomainChange, ...editorOptions } = options;
  const domainRef = useRef(domain);
  domainRef.current = domain;
  const schema = useMemo(() => domainAdapter.toFormSchema(domain), [domain, domainAdapter]);

  useEffect(() => {
    domainRef.current = domain;
  }, [domain]);

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
        return domainAdapter.toFormSchema(translatedDomain);
      },
      updateSurveyDraft: async (schema) => {
        const nextDomain = domainAdapter.fromFormSchema(schema, domainRef.current);
        domainRef.current = nextDomain;
        onDomainChange?.(nextDomain);
        await adapter.updateSurveyDraft(nextDomain);
      }
    },
    onChange: (nextSchema) => {
      const nextDomain = domainAdapter.fromFormSchema(nextSchema, domainRef.current);
      domainRef.current = nextDomain;
      onDomainChange?.(nextDomain);
    }
  });

  return { ...editor, domain: domainRef.current };
}
