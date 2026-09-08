import {
  type SurveyResponseSummaryDomainInputProps,
  useSurveyResponseSummaryDomain
} from "@form-engine-ts/custom-survey-client";
import {
  MuiSurveyResponseSummary,
  type MuiSurveyResponseSummarySlotProps,
  type MuiSurveyResponseSummarySlots
} from "./MuiSurveyResponseSummary";

export interface MuiSurveyResponseSummaryDomainProps<TSummary, TVersion>
  extends Omit<SurveyResponseSummaryDomainInputProps<TSummary, TVersion>, "slots" | "variant"> {
  readonly slots?: MuiSurveyResponseSummarySlots<unknown>;
  readonly slotProps?: MuiSurveyResponseSummarySlotProps;
}

export function MuiSurveyResponseSummaryDomain<TSummary, TVersion>(
  props: MuiSurveyResponseSummaryDomainProps<TSummary, TVersion>
): React.JSX.Element {
  const { slots, slotProps, ...domainOptions } = props;
  const controller = useSurveyResponseSummaryDomain(domainOptions);
  return (
    <MuiSurveyResponseSummary
      data={controller.data}
      languageOptions={controller.languageOptions}
      selectedLanguage={controller.selectedLanguage}
      onLanguageChange={controller.setLanguage}
      summaryState={props.summaryState ?? controller.summaryState}
      {...(props.labels === undefined ? {} : { labels: props.labels })}
      {...(props.locale === undefined ? {} : { locale: props.locale })}
      {...(slots === undefined ? {} : { slots })}
      {...(slotProps === undefined ? {} : { slotProps })}
      {...(props.className === undefined ? {} : { className: props.className })}
    />
  );
}
