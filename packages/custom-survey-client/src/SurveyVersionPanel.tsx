import { type ReactNode, useState } from "react";
import { SurveyQualityPanel } from "./SurveyQualityPanel";
import { SurveyVersionHistory } from "./SurveyVersionHistory";
import type { QualityCheckResult, QualityIssue, UseSurveyVersionOperationsResult } from "./types";

export interface SurveyVersionPanelRenderProps<TVersion = unknown> {
  readonly version: TVersion;
  readonly actions: UseSurveyVersionOperationsResult;
  readonly qualityIssues: readonly QualityIssue[];
  readonly publish: () => Promise<boolean | { readonly succeeded: boolean; readonly error?: Error }>;
}

export interface SurveyVersionPanelSlots<TVersion = unknown> {
  readonly qualityWarningDialog?: (props: {
    readonly issues: readonly QualityIssue[];
    readonly confirm: () => void;
    readonly cancel: () => void;
  }) => ReactNode;
  readonly visibilityDialog?: (props: {
    readonly status: "draft" | "published" | "archived";
    readonly confirm: () => void;
    readonly cancel: () => void;
  }) => ReactNode;
  readonly quality?: (result: QualityCheckResult | undefined) => ReactNode;
  readonly history?: (versions: readonly TVersion[]) => ReactNode;
  readonly notifications?: (actions: UseSurveyVersionOperationsResult) => ReactNode;
}

export interface SurveyVersionPanelProps<TVersion = unknown> {
  readonly version: TVersion;
  readonly actions: UseSurveyVersionOperationsResult;
  readonly slots?: SurveyVersionPanelSlots<TVersion>;
  readonly render?: (props: SurveyVersionPanelRenderProps<TVersion>) => ReactNode;
  readonly history?: readonly TVersion[];
  readonly getVersionKey?: (version: TVersion, index: number) => string | number;
  readonly getVersionLabel?: (version: TVersion, index: number) => ReactNode;
  readonly title?: string;
}

/** A transport- and UI-library-neutral version/quality surface with replaceable application slots. */
export function SurveyVersionPanel<TVersion>({
  version,
  actions,
  slots,
  render,
  history,
  getVersionKey,
  getVersionLabel,
  title = "Survey version"
}: SurveyVersionPanelProps<TVersion>): React.JSX.Element {
  const qualityIssues = actions.quality.result?.issues ?? [];
  const [requestedVisibility, setRequestedVisibility] = useState<"draft" | "published" | "archived" | undefined>();
  const [warningDismissed, setWarningDismissed] = useState(false);
  const publish = async () => actions.publish();
  const renderProps: SurveyVersionPanelRenderProps<TVersion> = { version, actions, qualityIssues, publish };
  if (render !== undefined) return <>{render(renderProps)}</>;

  const showWarningDialog = !warningDismissed && actions.operations.publish.status === "needs_confirmation";
  const requestPublish = () => {
    setWarningDismissed(false);
    void actions.publish();
  };
  const confirmPublish = () => {
    void actions.publish({ allowWarnings: true }).finally(() => setWarningDismissed(true));
  };
  const cancelPublish = () => setWarningDismissed(true);

  return (
    <section className="fe-survey-version-panel">
      <h2>{title}</h2>
      <div className="fe-survey-version-panel-actions">
        <button type="button" onClick={() => void actions.runQualityCheck()}>
          Run quality check
        </button>
        <button type="button" onClick={requestPublish} disabled={showWarningDialog}>
          Publish
        </button>
        <button type="button" onClick={() => void actions.cloneDraft()}>
          Clone draft
        </button>
        <button type="button" onClick={() => setRequestedVisibility("published")}>
          Set published
        </button>
        <button type="button" onClick={() => setRequestedVisibility("archived")}>
          Archive
        </button>
      </div>
      {slots?.quality?.(actions.quality.result) ?? (
        <SurveyQualityPanel
          {...(actions.quality.result === undefined ? {} : { result: actions.quality.result })}
          decisions={actions.qualityDecisions}
          onDecide={(issue, decision) => void actions.decideQualityIssue(issue, decision)}
        />
      )}
      {showWarningDialog
        ? (slots?.qualityWarningDialog?.({
            issues: qualityIssues,
            confirm: confirmPublish,
            cancel: cancelPublish
          }) ?? (
            <div role="alert">
              <p>Quality warnings must be confirmed before publishing.</p>
              <button type="button" onClick={confirmPublish}>
                Publish with warnings
              </button>
              <button type="button" onClick={cancelPublish}>
                Cancel
              </button>
            </div>
          ))
        : null}
      {actions.operations.publish.error === undefined ? null : (
        <div role="alert">{actions.operations.publish.error.message}</div>
      )}
      {requestedVisibility === undefined
        ? null
        : (slots?.visibilityDialog?.({
            status: requestedVisibility,
            confirm: () => {
              void actions.setVisibility(requestedVisibility).finally(() => setRequestedVisibility(undefined));
            },
            cancel: () => setRequestedVisibility(undefined)
          }) ?? (
            <div role="alert">
              <p>Change visibility to {requestedVisibility}?</p>
              <button
                type="button"
                onClick={() =>
                  void actions.setVisibility(requestedVisibility).finally(() => setRequestedVisibility(undefined))
                }
              >
                Confirm
              </button>
              <button type="button" onClick={() => setRequestedVisibility(undefined)}>
                Cancel
              </button>
            </div>
          ))}
      {history === undefined
        ? null
        : (slots?.history?.(history) ?? (
            <SurveyVersionHistory
              versions={history}
              {...(getVersionKey === undefined ? {} : { getVersionKey })}
              {...(getVersionLabel === undefined ? {} : { getVersionLabel })}
            />
          ))}
      {slots?.notifications?.(actions)}
    </section>
  );
}
