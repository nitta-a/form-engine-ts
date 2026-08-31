import type { ReactNode } from "react";
import type { QualityCheckResult, QualityIssue, QualityIssueDecision } from "./types";

export interface SurveyQualityPanelProps {
  readonly result?: QualityCheckResult;
  readonly decisions?: Readonly<Record<string, QualityIssueDecision>>;
  readonly onDecide?: (issue: QualityIssue, decision: QualityIssueDecision) => void;
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
  }) => ReactNode;
}

export function surveyQualityIssueKey(issue: QualityIssue): string {
  return `${issue.code}:${issue.path ?? ""}`;
}

function defaultIssue(
  issue: QualityIssue,
  decision: QualityIssueDecision | undefined,
  onDecide: SurveyQualityPanelProps["onDecide"]
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
            Accept
          </button>
          <button type="button" onClick={reject}>
            Reject
          </button>
        </span>
      )}
    </div>
  );
}

/** UI-library-neutral quality result and issue-decision surface. */
export function SurveyQualityPanel({
  result,
  decisions = {},
  onDecide,
  render,
  slots
}: SurveyQualityPanelProps): React.JSX.Element {
  if (render !== undefined) return <>{render(result)}</>;
  if (result === undefined) return <>{slots?.empty?.() ?? <p>No quality check has been run.</p>}</>;
  if (result.issues.length === 0) return <>{slots?.empty?.() ?? <p>Quality check passed.</p>}</>;
  return (
    <ul>
      {result.issues.map((issue) => {
        const decision = decisions[surveyQualityIssueKey(issue)];
        const accept = () => onDecide?.(issue, "accept");
        const reject = () => onDecide?.(issue, "reject");
        return (
          <li key={surveyQualityIssueKey(issue)}>
            {decision === undefined
              ? (slots?.issue?.({ issue, accept, reject }) ?? defaultIssue(issue, decision, onDecide))
              : (slots?.issue?.({ issue, decision, accept, reject }) ?? defaultIssue(issue, decision, onDecide))}
          </li>
        );
      })}
    </ul>
  );
}
