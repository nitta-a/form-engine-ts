import type { ReactNode } from "react";
import { useSurveyTranslation } from "./provider";
import type { QualityCheckResult, QualityIssue, QualityIssueDecision } from "./types";

export interface SurveyQualityPanelProps {
  readonly result?: QualityCheckResult;
  readonly decisions?: Readonly<Record<string, QualityIssueDecision>>;
  readonly onDecide?: (issue: QualityIssue, decision: QualityIssueDecision) => void;
  readonly onRequestAiFix?: (issue: QualityIssue) => void;
  readonly render?: (result: QualityCheckResult | undefined) => ReactNode;
  readonly slots?: SurveyQualityPanelSlots;
}

export interface SurveyQualityPanelSlots {
  readonly empty?: () => ReactNode;
  readonly issue?: (props: {
    readonly issue: QualityIssue;
    readonly decision?: QualityIssueDecision;
    readonly accept: () => void;
    readonly reject: () => void;
    readonly requestAiFix: () => void;
  }) => ReactNode;
}

export function surveyQualityIssueKey(issue: QualityIssue): string {
  return `${issue.code}:${issue.path ?? ""}`;
}

function defaultIssue(
  issue: QualityIssue,
  decision: QualityIssueDecision | undefined,
  onDecide: SurveyQualityPanelProps["onDecide"],
  onRequestAiFix: SurveyQualityPanelProps["onRequestAiFix"],
  text: (key: string, fallback: string) => string
): React.JSX.Element {
  const accept = () => onDecide?.(issue, "accept");
  const reject = () => onDecide?.(issue, "reject");
  return (
    <div>
      <span>{issue.message}</span>
      {issue.severity === undefined ? null : <span> ({issue.severity})</span>}
      {decision === undefined ? null : <span> [{decision}]</span>}
      {onDecide === undefined ? null : (
        <span>
          <button type="button" onClick={accept}>
            {text("quality.accept", "Accept")}
          </button>
          <button type="button" onClick={reject}>
            {text("quality.reject", "Reject")}
          </button>
        </span>
      )}
      {onRequestAiFix === undefined ? null : (
        <button type="button" onClick={() => onRequestAiFix(issue)}>
          {text("quality.fixWithAi", "Fix with AI")}
        </button>
      )}
    </div>
  );
}

/** UI-library-neutral quality result and issue-decision surface. */
export function SurveyQualityPanel({
  result,
  decisions = {},
  onDecide,
  onRequestAiFix,
  render,
  slots
}: SurveyQualityPanelProps): React.JSX.Element {
  const translation = useSurveyTranslation();
  const text = (key: string, fallback: string): string => {
    const translated = translation.customSurvey(key);
    return translated === key || translated === `customSurvey:${key}` ? fallback : translated;
  };
  if (render !== undefined) return <>{render(result)}</>;
  if (result === undefined)
    return <>{slots?.empty?.() ?? <p>{text("quality.notRun", "No quality check has been run.")}</p>}</>;
  if (result.issues.length === 0)
    return <>{slots?.empty?.() ?? <p>{text("quality.passed", "Quality check passed.")}</p>}</>;
  return (
    <ul>
      {result.issues.map((issue) => {
        const decision = decisions[surveyQualityIssueKey(issue)];
        const accept = () => onDecide?.(issue, "accept");
        const reject = () => onDecide?.(issue, "reject");
        const requestAiFix = () => onRequestAiFix?.(issue);
        return (
          <li key={surveyQualityIssueKey(issue)}>
            {decision === undefined
              ? (slots?.issue?.({ issue, accept, reject, requestAiFix }) ??
                defaultIssue(issue, decision, onDecide, onRequestAiFix, text))
              : (slots?.issue?.({ issue, decision, accept, reject, requestAiFix }) ??
                defaultIssue(issue, decision, onDecide, onRequestAiFix, text))}
          </li>
        );
      })}
    </ul>
  );
}
