import { useCallback, useEffect, useRef, useState } from "react";

export interface SurveyMappingCrudAdapter<TDomain, TMapping, TSelection> {
  readonly create: (request: {
    readonly domain: TDomain;
    readonly selection: TSelection;
    readonly signal: AbortSignal;
  }) => Promise<TMapping>;
  readonly remove: (request: {
    readonly domain: TDomain;
    readonly mapping: TMapping;
    readonly signal: AbortSignal;
  }) => Promise<void>;
  readonly reorder: (request: {
    readonly domain: TDomain;
    readonly mapping: TMapping;
    readonly displayOrder: number;
    readonly signal: AbortSignal;
  }) => Promise<void>;
  readonly list?: (request: { readonly domain: TDomain; readonly signal: AbortSignal }) => Promise<readonly TMapping[]>;
  readonly invalidate?: () => void | Promise<void>;
}

export type SurveyMappingCrudOperation = "idle" | "creating" | "removing" | "reordering" | "error";

export interface UseSurveyMappingCrudResult<TMapping> {
  readonly mappings: readonly TMapping[];
  readonly state: { readonly operation: SurveyMappingCrudOperation; readonly error?: Error };
  readonly create: (selection: unknown) => Promise<boolean>;
  readonly remove: (mapping: TMapping) => Promise<boolean>;
  readonly reorder: (mapping: TMapping, displayOrder: number) => Promise<boolean>;
  readonly refresh: () => Promise<boolean>;
}

export interface UseSurveyMappingCrudOptions<TDomain, TMapping, TSelection> {
  readonly domain: TDomain;
  readonly mappings: readonly TMapping[];
  readonly adapter: SurveyMappingCrudAdapter<TDomain, TMapping, TSelection>;
  readonly onMappingsChange?: (mappings: readonly TMapping[]) => void;
  readonly onDomainChange?: (domain: TDomain) => void;
}

function normalizeError(cause: unknown): Error {
  if (cause instanceof Error) return cause;
  if (typeof cause === "object" && cause !== null && "message" in cause && typeof cause.message === "string") {
    return new Error(cause.message);
  }
  return new Error(String(cause));
}

function moveMapping<TMapping>(
  mappings: readonly TMapping[],
  mapping: TMapping,
  displayOrder: number
): readonly TMapping[] {
  const sourceIndex = mappings.indexOf(mapping);
  if (sourceIndex < 0) return mappings;
  const next = [...mappings];
  const [moved] = next.splice(sourceIndex, 1);
  if (moved === undefined) return mappings;
  const targetIndex = Math.max(0, Math.min(displayOrder, next.length));
  next.splice(targetIndex, 0, moved);
  return next;
}

function sameMappings<TMapping>(left: readonly TMapping[], right: readonly TMapping[]): boolean {
  return left.length === right.length && left.every((mapping, index) => mapping === right[index]);
}

export function useSurveyMappingCrud<TDomain, TMapping, TSelection = unknown>(
  options: UseSurveyMappingCrudOptions<TDomain, TMapping, TSelection>
): UseSurveyMappingCrudResult<TMapping> {
  const [mappings, setMappingsState] = useState<readonly TMapping[]>(options.mappings);
  const [state, setState] = useState<UseSurveyMappingCrudResult<TMapping>["state"]>({ operation: "idle" });
  const domainRef = useRef(options.domain);
  const inputMappingsRef = useRef(options.mappings);
  domainRef.current = options.domain;

  useEffect(() => {
    if (sameMappings(inputMappingsRef.current, options.mappings)) return;
    inputMappingsRef.current = options.mappings;
    setMappingsState(options.mappings);
  }, [options.mappings]);

  const setMappings = useCallback(
    (next: readonly TMapping[]) => {
      setMappingsState(next);
      options.onMappingsChange?.(next);
    },
    [options.onMappingsChange]
  );

  const create = useCallback(
    async (selection: unknown): Promise<boolean> => {
      setState({ operation: "creating" });
      try {
        const mapping = await options.adapter.create({
          domain: domainRef.current,
          // The public API accepts unknown so untyped selection widgets can be composed;
          // the generic adapter contract is the validation boundary for the host application.
          selection: selection as TSelection,
          signal: new AbortController().signal
        });
        setMappings([...mappings, mapping]);
        setState({ operation: "idle" });
        await options.adapter.invalidate?.();
        return true;
      } catch (cause) {
        setState({ operation: "error", error: normalizeError(cause) });
        return false;
      }
    },
    [mappings, options.adapter, setMappings]
  );

  const remove = useCallback(
    async (mapping: TMapping): Promise<boolean> => {
      setState({ operation: "removing" });
      try {
        await options.adapter.remove({ domain: domainRef.current, mapping, signal: new AbortController().signal });
        setMappings(mappings.filter((candidate) => candidate !== mapping));
        setState({ operation: "idle" });
        await options.adapter.invalidate?.();
        return true;
      } catch (cause) {
        setState({ operation: "error", error: normalizeError(cause) });
        return false;
      }
    },
    [mappings, options.adapter, setMappings]
  );

  const reorder = useCallback(
    async (mapping: TMapping, displayOrder: number): Promise<boolean> => {
      setState({ operation: "reordering" });
      try {
        await options.adapter.reorder({
          domain: domainRef.current,
          mapping,
          displayOrder,
          signal: new AbortController().signal
        });
        setMappings(moveMapping(mappings, mapping, displayOrder));
        setState({ operation: "idle" });
        await options.adapter.invalidate?.();
        return true;
      } catch (cause) {
        setState({ operation: "error", error: normalizeError(cause) });
        return false;
      }
    },
    [mappings, options.adapter, setMappings]
  );

  const refresh = useCallback(async (): Promise<boolean> => {
    if (options.adapter.list === undefined) return false;
    try {
      const next = await options.adapter.list({ domain: domainRef.current, signal: new AbortController().signal });
      setMappings(next);
      return true;
    } catch (cause) {
      setState({ operation: "error", error: normalizeError(cause) });
      return false;
    }
  }, [options.adapter.list, setMappings]);

  return { mappings, state, create, remove, reorder, refresh };
}
