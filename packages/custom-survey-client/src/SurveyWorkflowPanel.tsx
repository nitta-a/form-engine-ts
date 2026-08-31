import { type ReactNode, useCallback, useRef, useState } from "react";

export interface SurveyWorkflowTransition<TTransitionId = string> {
  readonly id: TTransitionId;
  readonly label: ReactNode;
}

export interface SurveyWorkflowTransitionRequest<TDomain, TTransitionId> {
  readonly domain: TDomain;
  readonly transition: TTransitionId;
  readonly signal: AbortSignal;
}

export interface SurveyWorkflowAdapter<TDomain, TTransitionId = string> {
  readonly transition: (
    request: SurveyWorkflowTransitionRequest<TDomain, TTransitionId>
  ) => Promise<TDomain | undefined>;
}

export type SurveyWorkflowStatus = "idle" | "loading" | "success" | "error";

export interface SurveyWorkflowState<TTransitionId = string> {
  readonly status: SurveyWorkflowStatus;
  readonly transition?: TTransitionId;
  readonly error?: Error;
}

export interface UseSurveyWorkflowOptions<TDomain, TTransitionId = string> {
  readonly domain: TDomain;
  readonly transitions: readonly SurveyWorkflowTransition<TTransitionId>[];
  readonly adapter: SurveyWorkflowAdapter<TDomain, TTransitionId>;
  readonly onDomainChange?: (domain: TDomain) => void;
}

export interface UseSurveyWorkflowResult<TDomain, TTransitionId = string> {
  readonly domain: TDomain;
  readonly state: SurveyWorkflowState<TTransitionId>;
  readonly transition: (transition: TTransitionId) => Promise<boolean>;
}

export interface SurveyWorkflowPanelSlots<TDomain, TTransitionId = string> {
  readonly transition?: (props: {
    readonly transition: SurveyWorkflowTransition<TTransitionId>;
    readonly state: SurveyWorkflowState<TTransitionId>;
    readonly run: () => void;
  }) => ReactNode;
  readonly notifications?: (state: SurveyWorkflowState<TTransitionId>) => ReactNode;
  readonly after?: (domain: TDomain) => ReactNode;
}

export interface SurveyWorkflowPanelProps<TDomain, TTransitionId = string>
  extends UseSurveyWorkflowOptions<TDomain, TTransitionId> {
  readonly render?: (result: UseSurveyWorkflowResult<TDomain, TTransitionId>) => ReactNode;
  readonly slots?: SurveyWorkflowPanelSlots<TDomain, TTransitionId>;
  readonly title?: string;
}

function normalizeError(cause: unknown): Error {
  if (cause instanceof Error) return cause;
  if (typeof cause === "object" && cause !== null && "message" in cause && typeof cause.message === "string") {
    return new Error(cause.message);
  }
  return new Error(String(cause));
}

export function useSurveyWorkflow<TDomain, TTransitionId = string>({
  domain,
  transitions,
  adapter,
  onDomainChange
}: UseSurveyWorkflowOptions<TDomain, TTransitionId>): UseSurveyWorkflowResult<TDomain, TTransitionId> {
  const domainRef = useRef(domain);
  domainRef.current = domain;
  const [state, setState] = useState<SurveyWorkflowState<TTransitionId>>({ status: "idle" });

  const transition = useCallback(
    async (transitionId: TTransitionId): Promise<boolean> => {
      const knownTransition = transitions.some(({ id }) => id === transitionId);
      if (!knownTransition) {
        setState({ status: "error", transition: transitionId, error: new Error("Unknown workflow transition.") });
        return false;
      }
      const controller = new AbortController();
      setState({ status: "loading", transition: transitionId });
      try {
        const nextDomain = await adapter.transition({
          domain: domainRef.current,
          transition: transitionId,
          signal: controller.signal
        });
        if (nextDomain !== undefined) {
          domainRef.current = nextDomain;
          onDomainChange?.(nextDomain);
        }
        setState({ status: "success", transition: transitionId });
        return true;
      } catch (cause) {
        const error = normalizeError(cause);
        setState({ status: "error", transition: transitionId, error });
        return false;
      }
    },
    [adapter, onDomainChange, transitions]
  );

  return { domain: domainRef.current, state, transition };
}

/** Generic workflow controls with application-owned transition labels and transport. */
export function SurveyWorkflowPanel<TDomain, TTransitionId = string>({
  render,
  slots,
  title = "Workflow",
  ...options
}: SurveyWorkflowPanelProps<TDomain, TTransitionId>): React.JSX.Element {
  const workflow = useSurveyWorkflow(options);
  if (render !== undefined) return <>{render(workflow)}</>;
  return (
    <section className="fe-survey-workflow-panel">
      <h2>{title}</h2>
      <div>
        {options.transitions.map((transitionOption) => {
          const run = () => void workflow.transition(transitionOption.id);
          return (
            <span key={String(transitionOption.id)}>
              {slots?.transition?.({ transition: transitionOption, state: workflow.state, run }) ?? (
                <button type="button" onClick={run} disabled={workflow.state.status === "loading"}>
                  {transitionOption.label}
                </button>
              )}
            </span>
          );
        })}
      </div>
      {workflow.state.error === undefined ? null : <div role="alert">{workflow.state.error.message}</div>}
      {slots?.notifications?.(workflow.state)}
      {slots?.after?.(workflow.domain)}
    </section>
  );
}
