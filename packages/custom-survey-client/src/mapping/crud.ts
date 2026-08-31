import { useCallback, useEffect, useRef, useState } from "react";

export interface SurveyMappingReorderResult<TMapping, TRevision = unknown> {
  /** The order committed by the server, rather than the optimistic client order. */
  readonly mappings: readonly TMapping[];
  /** Revision returned by the atomic commit. */
  readonly revision: TRevision;
}

export interface SurveyMappingAtomicReorderRequest<TDomain, TMapping, TSelection, TRevision = unknown> {
  readonly domain: TDomain;
  readonly mappings: readonly TMapping[];
  readonly selection: TSelection;
  readonly expectedRevision?: TRevision;
  readonly signal: AbortSignal;
}

export interface SurveyMappingCrudAdapter<TDomain, TMapping, TSelection, TRevision = unknown> {
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
  readonly reorder?: (request: {
    readonly domain: TDomain;
    readonly mapping: TMapping;
    readonly displayOrder: number;
    readonly signal: AbortSignal;
  }) => Promise<void>;
  /** Persists and returns the complete order in one atomic request. */
  readonly reorderMany: (
    request: SurveyMappingAtomicReorderRequest<TDomain, TMapping, TSelection, TRevision>
  ) => Promise<SurveyMappingReorderResult<TMapping, TRevision>>;
  /** Optional alias for reorderMany for hosts that use "all" terminology. */
  readonly reorderAll?: (
    request: SurveyMappingAtomicReorderRequest<TDomain, TMapping, TSelection, TRevision>
  ) => Promise<SurveyMappingReorderResult<TMapping, TRevision>>;
  /** Optional alias for adapters that name the bulk operation after the resource. */
  readonly reorderMappings?: (
    request: SurveyMappingAtomicReorderRequest<TDomain, TMapping, TSelection, TRevision>
  ) => Promise<SurveyMappingReorderResult<TMapping, TRevision>>;
  /** Compensates a committed request when local result validation or a later callback fails. */
  readonly rollbackReorder?: (request: {
    readonly domain: TDomain;
    readonly mappings: readonly TMapping[];
    readonly revision?: TRevision;
    readonly selection: TSelection;
    readonly cause: unknown;
    readonly signal: AbortSignal;
  }) => Promise<void>;
  readonly list?: (request: { readonly domain: TDomain; readonly signal: AbortSignal }) => Promise<readonly TMapping[]>;
  readonly invalidate?: () => void | Promise<void>;
}

export type SurveyMappingAtomicCrudAdapter<
  TDomain,
  TMapping,
  TSelection,
  TRevision = unknown
> = SurveyMappingCrudAdapter<TDomain, TMapping, TSelection, TRevision>;

export type SurveyMappingCrudOperation = "idle" | "creating" | "removing" | "reordering" | "error";

export interface UseSurveyMappingCrudResult<TMapping, TSelection = unknown, TRevision = unknown> {
  readonly mappings: readonly TMapping[];
  readonly revision?: TRevision;
  readonly state: { readonly operation: SurveyMappingCrudOperation; readonly error?: Error };
  readonly create: (selection: unknown) => Promise<boolean>;
  readonly remove: (mapping: TMapping) => Promise<boolean>;
  readonly reorder: (mapping: TMapping, displayOrder: number) => Promise<boolean>;
  readonly reorderMany: (
    request: Omit<SurveyMappingAtomicReorderRequest<unknown, TMapping, TSelection, TRevision>, "domain">
  ) => Promise<SurveyMappingReorderResult<TMapping, TRevision>>;
  readonly reorderAll?: (
    request: Omit<SurveyMappingAtomicReorderRequest<unknown, TMapping, TSelection, TRevision>, "domain">
  ) => Promise<SurveyMappingReorderResult<TMapping, TRevision>>;
  readonly reorderMappings?: (
    request: Omit<SurveyMappingAtomicReorderRequest<unknown, TMapping, TSelection, TRevision>, "domain">
  ) => Promise<SurveyMappingReorderResult<TMapping, TRevision>>;
  readonly refresh: () => Promise<boolean>;
}

export interface UseSurveyMappingCrudOptions<TDomain, TMapping, TSelection, TRevision = unknown> {
  readonly domain: TDomain;
  readonly mappings: readonly TMapping[];
  readonly adapter: SurveyMappingCrudAdapter<TDomain, TMapping, TSelection, TRevision>;
  readonly revision?: TRevision;
  readonly onRevisionChange?: (revision: TRevision) => void;
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

function assertAtomicResult<TMapping, TRevision>(value: unknown): SurveyMappingReorderResult<TMapping, TRevision> {
  if (
    typeof value !== "object" ||
    value === null ||
    !("mappings" in value) ||
    !("revision" in value) ||
    value.revision === undefined
  ) {
    throw new TypeError("SurveyMappingAtomicCrudAdapter must return mappings and revision.");
  }
  const mappings = value.mappings;
  if (!Array.isArray(mappings))
    throw new TypeError("SurveyMappingAtomicCrudAdapter returned an invalid mappings array.");
  return value as SurveyMappingReorderResult<TMapping, TRevision>;
}

export function useSurveyMappingCrud<TDomain, TMapping, TSelection = unknown, TRevision = unknown>(
  options: UseSurveyMappingCrudOptions<TDomain, TMapping, TSelection, TRevision>
): UseSurveyMappingCrudResult<TMapping, TSelection, TRevision> {
  const [mappings, setMappingsState] = useState<readonly TMapping[]>(options.mappings);
  const [state, setState] = useState<UseSurveyMappingCrudResult<TMapping, TSelection, TRevision>["state"]>({
    operation: "idle"
  });
  const [revision, setRevision] = useState<TRevision | undefined>(options.revision);
  const revisionRef = useRef<TRevision | undefined>(options.revision);
  const domainRef = useRef(options.domain);
  const inputMappingsRef = useRef(options.mappings);
  const mappingsRef = useRef<readonly TMapping[]>(options.mappings);
  domainRef.current = options.domain;
  mappingsRef.current = mappings;
  revisionRef.current = revision;

  useEffect(() => {
    if (sameMappings(inputMappingsRef.current, options.mappings)) return;
    inputMappingsRef.current = options.mappings;
    setMappingsState(options.mappings);
  }, [options.mappings]);

  const setMappings = useCallback(
    (next: readonly TMapping[]) => {
      mappingsRef.current = next;
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
      if (options.adapter.reorder === undefined) {
        setState({ operation: "error", error: new TypeError("SurveyMappingCrudAdapter requires reorder.") });
        return false;
      }
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

  const reorderMany = useCallback(
    async (
      request: Omit<SurveyMappingAtomicReorderRequest<unknown, TMapping, TSelection, TRevision>, "domain">
    ): Promise<SurveyMappingReorderResult<TMapping, TRevision>> => {
      const previousMappings = mappingsRef.current;
      const previousRevision = revisionRef.current;
      if (
        request.expectedRevision !== undefined &&
        previousRevision !== undefined &&
        !Object.is(request.expectedRevision, previousRevision)
      ) {
        const error = new Error("SurveyMappingAtomicCrudAdapter rejected a stale expected revision.");
        setState({ operation: "error", error });
        throw error;
      }
      const expectedRevision = request.expectedRevision ?? previousRevision;
      setState({ operation: "reordering" });
      let result: SurveyMappingReorderResult<TMapping, TRevision>;
      try {
        const committed = await options.adapter.reorderMany({
          domain: domainRef.current,
          mappings: request.mappings,
          selection: request.selection,
          ...(expectedRevision === undefined ? {} : { expectedRevision }),
          signal: request.signal
        });
        result = assertAtomicResult<TMapping, TRevision>(committed);
        setMappings(result.mappings);
        setRevision(result.revision);
        revisionRef.current = result.revision;
        options.onRevisionChange?.(result.revision);
        setState({ operation: "idle" });
      } catch (cause) {
        try {
          await options.adapter.rollbackReorder?.({
            domain: domainRef.current,
            mappings: previousMappings,
            ...(revisionRef.current === undefined ? {} : { revision: revisionRef.current }),
            selection: request.selection,
            cause,
            signal: request.signal
          });
        } catch {
          // Keep the original commit/revision error as the operation result.
        } finally {
          setMappings(previousMappings);
          setRevision(previousRevision);
          revisionRef.current = previousRevision;
          setState({ operation: "error", error: normalizeError(cause) });
        }
        throw normalizeError(cause);
      }
      try {
        await options.adapter.invalidate?.();
      } catch (cause) {
        setState({ operation: "error", error: normalizeError(cause) });
        throw normalizeError(cause);
      }
      return result;
    },
    [options.adapter, options.onRevisionChange, setMappings]
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

  return {
    mappings,
    ...(revision === undefined ? {} : { revision }),
    state,
    create,
    remove,
    reorder,
    reorderMany,
    ...(options.adapter.reorderAll === undefined
      ? {}
      : {
          reorderAll: (
            request: Omit<SurveyMappingAtomicReorderRequest<unknown, TMapping, TSelection, TRevision>, "domain">
          ) => reorderMany({ ...request })
        }),
    ...(options.adapter.reorderMappings === undefined
      ? {}
      : {
          reorderMappings: (
            request: Omit<SurveyMappingAtomicReorderRequest<unknown, TMapping, TSelection, TRevision>, "domain">
          ) => reorderMany({ ...request })
        }),
    refresh
  };
}
