import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";

export interface SurveyWorkflowTransition<TTransitionId = string> {
  readonly id: TTransitionId;
  readonly label: ReactNode;
}

export interface SurveyWorkflowTransitionRequest<TDomain, TTransitionId> {
  readonly domain: TDomain;
  readonly transition: TTransitionId;
  readonly workflowState?: SurveyWorkflowState<TTransitionId>;
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
  readonly completed?: boolean;
  readonly progressValue?: number;
  readonly tabIndex?: number;
  readonly expanded?: boolean;
}

export interface UseSurveyWorkflowOptions<TDomain, TTransitionId = string> {
  readonly domain: TDomain;
  readonly transitions: readonly SurveyWorkflowTransition<TTransitionId>[];
  readonly adapter: SurveyWorkflowAdapter<TDomain, TTransitionId>;
  /** A calculated state supplied by the host application. */
  readonly controlledState?: SurveyWorkflowState<TTransitionId>;
  /** Alias for controlledState, convenient when the host already calls this value state. */
  readonly state?: SurveyWorkflowState<TTransitionId>;
  readonly expanded?: boolean;
  readonly onToggle?: (expanded: boolean) => void;
  readonly progressValue?: number;
  readonly tabIndex?: number;
  readonly onTabChange?: (tabIndex: number) => void;
  readonly onStateChange?: (state: SurveyWorkflowState<TTransitionId>) => void;
  readonly onDomainChange?: (domain: TDomain) => void;
}

export interface UseSurveyWorkflowResult<TDomain, TTransitionId = string> {
  readonly domain: TDomain;
  readonly state: SurveyWorkflowState<TTransitionId>;
  readonly expanded: boolean;
  readonly progressValue?: number;
  readonly tabIndex?: number;
  readonly transition: (transition: TTransitionId) => Promise<boolean>;
  readonly toggle: () => void;
  readonly setTab: (tabIndex: number) => void;
}

export interface SurveyWorkflowPanelSlots<TDomain, TTransitionId = string> {
  readonly transition?: (props: {
    readonly transition: SurveyWorkflowTransition<TTransitionId>;
    readonly state: SurveyWorkflowState<TTransitionId>;
    readonly run: () => void;
  }) => ReactNode;
  readonly notifications?: (state: SurveyWorkflowState<TTransitionId>) => ReactNode;
  readonly status?: (state: SurveyWorkflowState<TTransitionId>) => ReactNode;
  readonly after?: (domain: TDomain) => ReactNode;
}

export interface SurveyWorkflowPanelProps<TDomain, TTransitionId = string>
  extends UseSurveyWorkflowOptions<TDomain, TTransitionId> {
  readonly render?: (result: UseSurveyWorkflowResult<TDomain, TTransitionId>) => ReactNode;
  readonly slots?: SurveyWorkflowPanelSlots<TDomain, TTransitionId>;
  readonly title?: string;
}

export interface SurveyWorkflowControlledProps<TState> {
  readonly state: TState;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly showToggle?: boolean;
  readonly progress?: { readonly value: number; readonly label?: ReactNode };
  readonly onNavigate?: (tab: number) => void;
  readonly steps?: readonly unknown[];
  readonly renderStep?: (step: unknown, state: TState) => ReactNode;
  readonly slots?: {
    readonly header?: (state: TState) => ReactNode;
    readonly toggle?: (props: { readonly expanded: boolean; readonly onToggle: () => void }) => ReactNode;
    readonly step?: (
      step: unknown,
      context: {
        readonly index: number;
        readonly total: number;
        readonly state: TState;
      }
    ) => ReactNode;
    readonly notifications?: (state: TState) => ReactNode;
  };
}

export interface UseSurveyWorkflowControlledResult<TState> {
  readonly state: TState;
  readonly expanded: boolean;
  readonly toggle: () => void;
  readonly navigate: (tab: number) => void;
}

function normalizeError(cause: unknown): Error {
  if (cause instanceof Error) return cause;
  if (typeof cause === "object" && cause !== null && "message" in cause && typeof cause.message === "string") {
    return new Error(cause.message);
  }
  return new Error(String(cause));
}

export function useSurveyWorkflowControlled<TState>(
  props: SurveyWorkflowControlledProps<TState>
): UseSurveyWorkflowControlledResult<TState> {
  const toggle = useCallback(() => props.onToggle(), [props.onToggle]);
  const navigate = useCallback((tab: number) => props.onNavigate?.(tab), [props.onNavigate]);
  return { state: props.state, expanded: props.expanded, toggle, navigate };
}

export function SurveyWorkflowControlled<TState>(props: SurveyWorkflowControlledProps<TState>): React.JSX.Element {
  const workflow = useSurveyWorkflowControlled(props);
  const showToggle = props.showToggle ?? true;
  return (
    <section className="fe-survey-workflow-controlled">
      {props.slots?.header?.(workflow.state)}
      {showToggle
        ? (props.slots?.toggle?.({ expanded: workflow.expanded, onToggle: workflow.toggle }) ?? (
            <button type="button" aria-expanded={workflow.expanded} onClick={workflow.toggle}>
              {workflow.expanded ? "Collapse" : "Expand"}
            </button>
          ))
        : null}
      {props.progress === undefined ? null : (
        <div role="progressbar" aria-valuenow={props.progress.value}>
          {props.progress.label ?? `${props.progress.value}%`}
        </div>
      )}
      {workflow.expanded ? (
        <div>
          {props.steps?.map((step, index) => (
            <div key={typeof step === "string" || typeof step === "number" ? step : JSON.stringify(step)}>
              {props.slots?.step?.(step, { index, total: props.steps?.length ?? 0, state: workflow.state }) ??
                props.renderStep?.(step, workflow.state)}
            </div>
          ))}
        </div>
      ) : null}
      {props.slots?.notifications?.(workflow.state)}
    </section>
  );
}

export function useSurveyWorkflow<TDomain, TTransitionId = string>({
  domain,
  transitions,
  adapter,
  controlledState,
  state: inputState,
  expanded: controlledExpanded,
  onToggle,
  progressValue: controlledProgressValue,
  tabIndex: controlledTabIndex,
  onTabChange,
  onStateChange,
  onDomainChange
}: UseSurveyWorkflowOptions<TDomain, TTransitionId>): UseSurveyWorkflowResult<TDomain, TTransitionId> {
  const domainRef = useRef(domain);
  domainRef.current = domain;
  const [internalState, setInternalState] = useState<SurveyWorkflowState<TTransitionId>>({ status: "idle" });
  const [internalExpanded, setInternalExpanded] = useState(false);
  const resolvedControlledState = controlledState ?? inputState;
  const expanded = controlledExpanded ?? resolvedControlledState?.expanded ?? internalExpanded;
  const state = useMemo<SurveyWorkflowState<TTransitionId>>(
    () => ({
      ...internalState,
      ...resolvedControlledState,
      expanded,
      ...(controlledProgressValue === undefined
        ? resolvedControlledState?.progressValue === undefined
          ? {}
          : { progressValue: resolvedControlledState.progressValue }
        : { progressValue: controlledProgressValue }),
      ...(controlledTabIndex === undefined
        ? resolvedControlledState?.tabIndex === undefined
          ? {}
          : { tabIndex: resolvedControlledState.tabIndex }
        : { tabIndex: controlledTabIndex })
    }),
    [controlledProgressValue, controlledTabIndex, expanded, internalState, resolvedControlledState]
  );
  const setState = useCallback(
    (next: SurveyWorkflowState<TTransitionId>) => {
      setInternalState(next);
      onStateChange?.(next);
    },
    [onStateChange]
  );

  const toggle = useCallback(() => {
    const nextExpanded = !expanded;
    if (controlledExpanded === undefined && resolvedControlledState?.expanded === undefined)
      setInternalExpanded(nextExpanded);
    onToggle?.(nextExpanded);
  }, [controlledExpanded, expanded, onToggle, resolvedControlledState?.expanded]);

  const setTab = useCallback(
    (nextTabIndex: number) => {
      if (controlledTabIndex === undefined && resolvedControlledState?.tabIndex === undefined) {
        setInternalState((current) => ({ ...current, tabIndex: nextTabIndex }));
      }
      onTabChange?.(nextTabIndex);
    },
    [controlledTabIndex, onTabChange, resolvedControlledState?.tabIndex]
  );

  const transition = useCallback(
    async (transitionId: TTransitionId): Promise<boolean> => {
      const knownTransition = transitions.some(({ id }) => id === transitionId);
      if (!knownTransition) {
        setState({
          ...state,
          status: "error",
          transition: transitionId,
          error: new Error("Unknown workflow transition.")
        });
        return false;
      }
      const controller = new AbortController();
      setState({ ...state, status: "loading", transition: transitionId });
      try {
        const nextDomain = await adapter.transition({
          domain: domainRef.current,
          transition: transitionId,
          workflowState: state,
          signal: controller.signal
        });
        if (nextDomain !== undefined) {
          domainRef.current = nextDomain;
          onDomainChange?.(nextDomain);
        }
        setState({ ...state, status: "success", transition: transitionId });
        return true;
      } catch (cause) {
        const error = normalizeError(cause);
        setState({ ...state, status: "error", transition: transitionId, error });
        return false;
      }
    },
    [adapter, onDomainChange, setState, state, transitions]
  );

  return {
    domain: domainRef.current,
    state,
    expanded,
    ...(state.progressValue === undefined ? {} : { progressValue: state.progressValue }),
    ...(state.tabIndex === undefined ? {} : { tabIndex: state.tabIndex }),
    transition,
    toggle,
    setTab
  };
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
      <button type="button" aria-expanded={workflow.expanded} onClick={workflow.toggle}>
        {workflow.expanded ? "Collapse" : "Expand"}
      </button>
      {slots?.status?.(workflow.state)}
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
