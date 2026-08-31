import type { QuestionAggregate } from "@form-engine-ts/core";
import { toSurveyResponseSummary } from "../responseSummary";
import type {
  SurveyResponseSummaryData,
  SurveyResponseSummaryMapperAdapter,
  SurveySchemaDomainAdapter,
  SurveySummaryInput
} from "../types";

export interface SurveyResponseSummaryMappingRequest<TDomain, TDomainSummary = SurveySummaryInput> {
  readonly domain: TDomain;
  readonly summary: TDomainSummary;
  readonly sourceLanguage: string;
}

export function isSurveySummaryInput(value: unknown): value is SurveySummaryInput {
  if (typeof value !== "object" || value === null || !("questions" in value)) return false;
  return (
    Array.isArray(value.questions) &&
    value.questions.every((question): question is QuestionAggregate => {
      return typeof question === "object" && question !== null && "fieldId" in question && "kind" in question;
    })
  );
}

/** Maps an application-owned summary once, while retaining the original domain aggregate in customData. */
export function mapSurveyResponseSummary<TDomain, TDomainSummary = SurveySummaryInput>(
  request: SurveyResponseSummaryMappingRequest<TDomain, TDomainSummary>,
  adapter: SurveyResponseSummaryMapperAdapter<TDomain, TDomainSummary>
): SurveyResponseSummaryData<TDomainSummary> {
  const mappedValue =
    adapter.toSurveySummary?.({
      domain: request.domain,
      summary: request.summary,
      sourceLanguage: request.sourceLanguage
    }) ?? request.summary;
  if (!isSurveySummaryInput(mappedValue)) {
    throw new TypeError("SurveyResponseSummaryDomainAdapter requires toSurveySummary for custom summary records.");
  }
  const data = toSurveyResponseSummary(mappedValue, adapter.toFormSchema(request.domain), request.sourceLanguage);
  const languages = adapter.mapLanguages?.({ domain: request.domain, summary: request.summary });
  const skipReasons = adapter.mapSkipReasons?.({ domain: request.domain, summary: request.summary });
  return {
    ...data,
    customData: request.summary,
    ...(languages === undefined ? {} : { languages }),
    ...(skipReasons === undefined ? {} : { skipReasons }),
    questions: data.questions.map((question) => {
      const resolvedLabel = adapter.resolveLabel?.({
        domain: request.domain,
        fieldId: question.fieldId,
        sourceLanguage: request.sourceLanguage
      });
      const definition = adapter.getQuestionDefinition?.({ domain: request.domain, fieldId: question.fieldId });
      const options = question.options?.map((option) => {
        const optionDefinition = adapter.getOptionDefinition?.({
          domain: request.domain,
          fieldId: question.fieldId,
          optionId: option.id
        });
        return optionDefinition === undefined ? undefined : ([option.id, optionDefinition] as const);
      });
      const optionDefinitions = Object.fromEntries(options?.filter((entry) => entry !== undefined) ?? []);
      return {
        ...question,
        ...(resolvedLabel === undefined ? {} : { label: resolvedLabel }),
        ...(definition === undefined ? {} : { definition }),
        ...(Object.keys(optionDefinitions).length === 0 ? {} : { optionDefinitions })
      };
    })
  };
}

/** Backward-compatible mapper for the v7.3 domain summary contract. */
export function toSurveyResponseSummaryFromDomain<TDomain>(
  summary: SurveySummaryInput,
  version: TDomain,
  adapter: SurveySchemaDomainAdapter<TDomain>,
  sourceLanguage: string
): SurveyResponseSummaryData {
  return toSurveyResponseSummary(summary, adapter.toFormSchema(version), sourceLanguage);
}
