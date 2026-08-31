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
  readonly signal: AbortSignal;
}

export interface SurveyMappingAdapter<TDomain> {
  readonly saveMappings: (request: SurveyMappingSaveRequest<TDomain>) => Promise<TDomain | undefined>;
}

export type SurveyMappingStatus = "idle" | "saving" | "saved" | "error";

export interface SurveyMappingState {
  readonly status: SurveyMappingStatus;
  readonly error?: Error;
}

export interface UseSurveyMappingOptions<TDomain> {
  readonly domain: TDomain;
  readonly mappings: readonly SurveyMappingEntry[];
  readonly adapter: SurveyMappingAdapter<TDomain>;
  readonly onDomainChange?: (domain: TDomain) => void;
}

export interface UseSurveyMappingResult<TDomain> {
  readonly domain: TDomain;
  readonly mappings: readonly SurveyMappingEntry[];
  readonly state: SurveyMappingState;
  readonly setMappings: (mappings: readonly SurveyMappingEntry[]) => void;
  readonly save: () => Promise<boolean>;
}

export interface SurveyMappingPanelSlots {
  readonly mapping?: (mapping: SurveyMappingEntry, index: number) => ReactNode;
  readonly notifications?: (state: SurveyMappingState) => ReactNode;
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

export function useSurveyMapping<TDomain>({
  domain,
  mappings: inputMappings,
  adapter,
  onDomainChange
}: UseSurveyMappingOptions<TDomain>): UseSurveyMappingResult<TDomain> {
  const domainRef = useRef(domain);
  domainRef.current = domain;
  const [mappings, setMappings] = useState<readonly SurveyMappingEntry[]>(inputMappings);
  const [state, setState] = useState<SurveyMappingState>({ status: "idle" });

  useEffect(() => {
    domainRef.current = domain;
    setMappings(inputMappings);
  }, [domain, inputMappings]);

  const save = useCallback(async (): Promise<boolean> => {
    const controller = new AbortController();
    setState({ status: "saving" });
    try {
      const nextDomain = await adapter.saveMappings({
        domain: domainRef.current,
        mappings,
        signal: controller.signal
      });
      if (nextDomain !== undefined) {
        domainRef.current = nextDomain;
        onDomainChange?.(nextDomain);
      }
      setState({ status: "saved" });
      return true;
    } catch (cause) {
      const error = normalizeError(cause);
      setState({ status: "error", error });
      return false;
    }
  }, [adapter, mappings, onDomainChange]);

  return { domain: domainRef.current, mappings, state, setMappings, save };
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
