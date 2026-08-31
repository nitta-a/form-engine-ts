import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

export interface SurveyMappingEntry {
  readonly id: string;
  readonly sourceFieldId: string;
  readonly targetFieldId: string;
  readonly label?: ReactNode;
}

export interface SurveyMappingSaveRequest<TDomain> {
  readonly domain: TDomain;
  readonly mappings: readonly SurveyMappingEntry[];
  readonly selection?: SurveyMappingSelection;
  readonly signal: AbortSignal;
}

export interface SurveyMappingAddRequest<TDomain> {
  readonly domain: TDomain;
  readonly mapping: SurveyMappingEntry;
  readonly selection: SurveyMappingSelection;
  readonly signal: AbortSignal;
}

export interface SurveyMappingRemoveRequest<TDomain> {
  readonly domain: TDomain;
  readonly mappingId: string;
  readonly selection: SurveyMappingSelection;
  readonly signal: AbortSignal;
}

export interface SurveyMappingReorderRequest<TDomain> {
  readonly domain: TDomain;
  readonly mappings: readonly SurveyMappingEntry[];
  readonly selection: SurveyMappingSelection;
  readonly signal: AbortSignal;
}

export interface SurveyMappingListRequest<TDomain> {
  readonly domain: TDomain;
  readonly selection: SurveyMappingSelection;
  readonly signal: AbortSignal;
}

export interface SurveyMappingAdapter<TDomain> {
  readonly listMappings?: (request: SurveyMappingListRequest<TDomain>) => Promise<readonly SurveyMappingEntry[]>;
  readonly addMapping?: (request: SurveyMappingAddRequest<TDomain>) => Promise<TDomain | undefined>;
  readonly removeMapping?: (request: SurveyMappingRemoveRequest<TDomain>) => Promise<TDomain | undefined>;
  readonly reorderMappings?: (request: SurveyMappingReorderRequest<TDomain>) => Promise<TDomain | undefined>;
  readonly saveMappings?: (request: SurveyMappingSaveRequest<TDomain>) => Promise<TDomain | undefined>;
}

export type SurveyMappingStatus = "idle" | "saving" | "saved" | "error";

export interface SurveyMappingState {
  readonly status: SurveyMappingStatus;
  readonly operation?: "list" | "add" | "remove" | "reorder" | "save";
  readonly error?: Error;
}

export interface SurveyMappingSelection {
  readonly deckId?: string;
  readonly groupId?: string;
}

export interface UseSurveyMappingOptions<TDomain> {
  readonly domain: TDomain;
  readonly mappings: readonly SurveyMappingEntry[];
  readonly adapter: SurveyMappingAdapter<TDomain>;
  readonly selection?: SurveyMappingSelection;
  readonly onSelectionChange?: (selection: SurveyMappingSelection) => void;
  readonly onDomainChange?: (domain: TDomain) => void;
}

export interface UseSurveyMappingResult<TDomain> {
  readonly domain: TDomain;
  readonly mappings: readonly SurveyMappingEntry[];
  readonly state: SurveyMappingState;
  readonly isLoading: boolean;
  readonly setMappings: (mappings: readonly SurveyMappingEntry[]) => void;
  readonly selection: SurveyMappingSelection;
  readonly setSelection: (selection: SurveyMappingSelection) => void;
  readonly refresh: () => Promise<boolean>;
  readonly add: (mapping: SurveyMappingEntry) => Promise<boolean>;
  readonly remove: (mappingId: string) => Promise<boolean>;
  readonly reorder: (mappings: readonly SurveyMappingEntry[]) => Promise<boolean>;
  readonly save: () => Promise<boolean>;
}

export interface SurveyMappingPanelSlots {
  readonly mapping?: (mapping: SurveyMappingEntry, index: number) => ReactNode;
  readonly notifications?: (state: SurveyMappingState) => ReactNode;
  readonly selection?: (selection: SurveyMappingSelection) => ReactNode;
}

export interface SurveyMappingPanelProps<TDomain> extends UseSurveyMappingOptions<TDomain> {
  readonly render?: (result: UseSurveyMappingResult<TDomain>) => ReactNode;
  readonly slots?: SurveyMappingPanelSlots;
  readonly title?: string;
}

function normalizeError(cause: unknown): Error {
  if (cause instanceof Error) return cause;
  if (typeof cause === "object" && cause !== null && "message" in cause && typeof cause.message === "string") {
    return new Error(cause.message);
  }
  return new Error(String(cause));
}

function missingOperation(operation: SurveyMappingState["operation"]): Error {
  const method = operation === "add" ? "addMapping" : operation === "remove" ? "removeMapping" : `${operation}Mappings`;
  return new TypeError(`SurveyMappingAdapter requires ${method}.`);
}

export function useSurveyMapping<TDomain>({
  domain,
  mappings: inputMappings,
  adapter,
  selection: inputSelection,
  onSelectionChange,
  onDomainChange
}: UseSurveyMappingOptions<TDomain>): UseSurveyMappingResult<TDomain> {
  const domainRef = useRef(domain);
  domainRef.current = domain;
  const [mappings, setMappings] = useState<readonly SurveyMappingEntry[]>(inputMappings);
  const [state, setState] = useState<SurveyMappingState>({ status: "idle" });
  const [selection, setSelectionState] = useState<SurveyMappingSelection>(inputSelection ?? {});

  useEffect(() => {
    domainRef.current = domain;
    setMappings(inputMappings);
    setSelectionState(inputSelection ?? {});
  }, [domain, inputMappings, inputSelection]);

  const setSelection = useCallback(
    (nextSelection: SurveyMappingSelection) => {
      setSelectionState(nextSelection);
      onSelectionChange?.(nextSelection);
    },
    [onSelectionChange]
  );

  const applyDomain = useCallback(
    (nextDomain: TDomain | undefined) => {
      if (nextDomain !== undefined) {
        domainRef.current = nextDomain;
        onDomainChange?.(nextDomain);
      }
    },
    [onDomainChange]
  );

  const refresh = useCallback(async (): Promise<boolean> => {
    if (adapter.listMappings === undefined) {
      setState({ status: "error", operation: "list", error: missingOperation("list") });
      return false;
    }
    setState({ status: "saving", operation: "list" });
    try {
      const nextMappings = await adapter.listMappings({
        domain: domainRef.current,
        selection,
        signal: new AbortController().signal
      });
      setMappings(nextMappings);
      setState({ status: "saved", operation: "list" });
      return true;
    } catch (cause) {
      const error = normalizeError(cause);
      setState({ status: "error", operation: "list", error });
      return false;
    }
  }, [adapter.listMappings, selection]);

  const add = useCallback(
    async (mapping: SurveyMappingEntry): Promise<boolean> => {
      if (adapter.addMapping === undefined) {
        setState({ status: "error", operation: "add", error: missingOperation("add") });
        return false;
      }
      setState({ status: "saving", operation: "add" });
      try {
        const nextDomain = await adapter.addMapping({
          domain: domainRef.current,
          mapping,
          selection,
          signal: new AbortController().signal
        });
        setMappings((current) => [...current, mapping]);
        applyDomain(nextDomain);
        setState({ status: "saved", operation: "add" });
        return true;
      } catch (cause) {
        const error = normalizeError(cause);
        setState({ status: "error", operation: "add", error });
        return false;
      }
    },
    [adapter.addMapping, applyDomain, selection]
  );

  const remove = useCallback(
    async (mappingId: string): Promise<boolean> => {
      if (adapter.removeMapping === undefined) {
        setState({ status: "error", operation: "remove", error: missingOperation("remove") });
        return false;
      }
      setState({ status: "saving", operation: "remove" });
      try {
        const nextDomain = await adapter.removeMapping({
          domain: domainRef.current,
          mappingId,
          selection,
          signal: new AbortController().signal
        });
        setMappings((current) => current.filter((mapping) => mapping.id !== mappingId));
        applyDomain(nextDomain);
        setState({ status: "saved", operation: "remove" });
        return true;
      } catch (cause) {
        const error = normalizeError(cause);
        setState({ status: "error", operation: "remove", error });
        return false;
      }
    },
    [adapter.removeMapping, applyDomain, selection]
  );

  const reorder = useCallback(
    async (nextMappings: readonly SurveyMappingEntry[]): Promise<boolean> => {
      if (adapter.reorderMappings === undefined) {
        setState({ status: "error", operation: "reorder", error: missingOperation("reorder") });
        return false;
      }
      setState({ status: "saving", operation: "reorder" });
      try {
        const nextDomain = await adapter.reorderMappings({
          domain: domainRef.current,
          mappings: nextMappings,
          selection,
          signal: new AbortController().signal
        });
        setMappings(nextMappings);
        applyDomain(nextDomain);
        setState({ status: "saved", operation: "reorder" });
        return true;
      } catch (cause) {
        const error = normalizeError(cause);
        setState({ status: "error", operation: "reorder", error });
        return false;
      }
    },
    [adapter.reorderMappings, applyDomain, selection]
  );

  const save = useCallback(async (): Promise<boolean> => {
    if (adapter.saveMappings === undefined) {
      setState({ status: "error", operation: "save", error: missingOperation("save") });
      return false;
    }
    const controller = new AbortController();
    setState({ status: "saving", operation: "save" });
    try {
      const nextDomain = await adapter.saveMappings({
        domain: domainRef.current,
        mappings,
        selection,
        signal: controller.signal
      });
      if (nextDomain !== undefined) {
        applyDomain(nextDomain);
      }
      setState({ status: "saved", operation: "save" });
      return true;
    } catch (cause) {
      const error = normalizeError(cause);
      setState({ status: "error", operation: "save", error });
      return false;
    }
  }, [adapter.saveMappings, applyDomain, mappings, selection]);

  return {
    domain: domainRef.current,
    mappings,
    state,
    isLoading: state.status === "saving",
    setMappings,
    selection,
    setSelection,
    refresh,
    add,
    remove,
    reorder,
    save
  };
}

/** Generic mapping editor surface with application-owned mapping persistence. */
export function SurveyMappingPanel<TDomain>({
  render,
  slots,
  title = "Mapping",
  ...options
}: SurveyMappingPanelProps<TDomain>): React.JSX.Element {
  const mapping = useSurveyMapping(options);
  if (render !== undefined) return <>{render(mapping)}</>;
  return (
    <section className="fe-survey-mapping-panel">
      <h2>{title}</h2>
      {slots?.selection?.(mapping.selection)}
      <ul>
        {mapping.mappings.map((entry, index) => (
          <li key={entry.id}>
            {slots?.mapping?.(entry, index) ?? (
              <span>
                {entry.label ?? entry.id}: {entry.sourceFieldId} → {entry.targetFieldId}
              </span>
            )}
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => void mapping.save()} disabled={mapping.state.status === "saving"}>
        Save mappings
      </button>
      {mapping.state.error === undefined ? null : <div role="alert">{mapping.state.error.message}</div>}
      {slots?.notifications?.(mapping.state)}
    </section>
  );
}
