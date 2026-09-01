import { useCallback, useEffect, useRef, useState } from "react";

export interface SurveyMappingReorderResult<TMapping, TRevision = unknown> {
  /** The order committed by the server, rather than the optimistic client order. */
  readonly mappings: readonly TMapping[];
  /** Revision returned by the atomic commit. */
  readonly revision: TRevision;
}

export interface SurveyMappingMutationResult<TMapping, TRevision = unknown> {
  /** The complete server state after the mutation. */
  readonly mappings: readonly TMapping[];
  /** Revision returned by the mutation commit. */
  readonly revision: TRevision;
  /** Optional created mapping when the mutation was create. */
  readonly mapping?: TMapping;
}

export type SurveyMappingMutationResponse<TMapping, TRevision = unknown> =
  | TMapping
  | undefined
  | SurveyMappingMutationResult<TMapping, TRevision>;

export interface SurveyMappingRevisionConflict<TMapping, TRevision = unknown> {
  readonly code: "REVISION_CONFLICT";
  readonly expectedRevision: TRevision;
  readonly currentRevision: TRevision;
  readonly currentMappings: readonly TMapping[];
}

export class SurveyMappingRevisionConflictError<TMapping, TRevision = unknown>
  extends Error
  implements SurveyMappingRevisionConflict<TMapping, TRevision>
{
  readonly code = "REVISION_CONFLICT" as const;
  readonly expectedRevision: TRevision;
  readonly currentRevision: TRevision;
  readonly currentMappings: readonly TMapping[];

  constructor(conflict: Omit<SurveyMappingRevisionConflict<TMapping, TRevision>, "code">, message?: string) {
    super(message ?? "Survey mapping revision conflict.");
    this.name = "SurveyMappingRevisionConflictError";
    this.expectedRevision = conflict.expectedRevision;
    this.currentRevision = conflict.currentRevision;
    this.currentMappings = conflict.currentMappings;
  }
}

export function isSurveyMappingRevisionConflict<TMapping, TRevision = unknown>(
  value: unknown
): value is SurveyMappingRevisionConflict<TMapping, TRevision> {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    value.code === "REVISION_CONFLICT" &&
    "expectedRevision" in value &&
    "currentRevision" in value &&
    "currentMappings" in value &&
    Array.isArray(value.currentMappings)
  );
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
    readonly expectedRevision?: TRevision;
    readonly signal: AbortSignal;
  }) => Promise<TMapping>;
  readonly createWithRevision?: (request: {
    readonly domain: TDomain;
    readonly selection: TSelection;
    readonly expectedRevision?: TRevision;
    readonly signal: AbortSignal;
  }) => Promise<SurveyMappingMutationResult<TMapping, TRevision>>;
  readonly remove: (request: {
    readonly domain: TDomain;
    readonly mapping: TMapping;
    readonly expectedRevision?: TRevision;
    readonly signal: AbortSignal;
  }) => Promise<void>;
  readonly removeWithRevision?: (request: {
    readonly domain: TDomain;
    readonly mapping: TMapping;
    readonly expectedRevision?: TRevision;
    readonly signal: AbortSignal;
  }) => Promise<SurveyMappingMutationResult<TMapping, TRevision>>;
  readonly reorder?: (request: {
    readonly domain: TDomain;
    readonly mapping: TMapping;
    readonly displayOrder: number;
    readonly expectedRevision?: TRevision;
    readonly signal: AbortSignal;
  }) => Promise<void>;
  readonly reorderWithRevision?: (request: {
    readonly domain: TDomain;
    readonly mapping: TMapping;
    readonly displayOrder: number;
    readonly expectedRevision?: TRevision;
    readonly signal: AbortSignal;
  }) => Promise<SurveyMappingMutationResult<TMapping, TRevision>>;
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
  readonly listWithRevision?: (request: {
    readonly domain: TDomain;
    readonly signal: AbortSignal;
  }) => Promise<SurveyMappingReorderResult<TMapping, TRevision>>;
  readonly invalidate?: () => void | Promise<void>;
}

export type SurveyMappingAtomicCrudAdapter<
  TDomain,
  TMapping,
  TSelection,
  TRevision = unknown
> = SurveyMappingCrudAdapter<TDomain, TMapping, TSelection, TRevision>;

export type SurveyMappingCrudOperation = "idle" | "creating" | "removing" | "reordering" | "error";

export interface SurveyMappingCrudState<TMapping, TRevision = unknown> {
  readonly operation: SurveyMappingCrudOperation;
  readonly error?: Error;
  /** Present when the latest operation was rejected against a newer server revision. */
  readonly revisionConflict?: SurveyMappingRevisionConflict<TMapping, TRevision>;
  /** A conflict is safe to retry after the returned current mappings/revision are accepted. */
  readonly canRetry?: boolean;
}

export interface UseSurveyMappingCrudResult<TMapping, TSelection = unknown, TRevision = unknown> {
  readonly mappings: readonly TMapping[];
  readonly revision?: TRevision;
  readonly state: {
    readonly operation: SurveyMappingCrudOperation;
    readonly error?: Error;
    readonly revisionConflict?: SurveyMappingRevisionConflict<TMapping, TRevision>;
    readonly canRetry?: boolean;
  };
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
  if (isSurveyMappingRevisionConflict(cause)) {
    return new SurveyMappingRevisionConflictError(cause);
  }
  if (typeof cause === "object" && cause !== null && "message" in cause && typeof cause.message === "string") {
    return new Error(cause.message);
  }
  return new Error(String(cause));
}

function mutationResult<TMapping, TRevision>(
  value: unknown
): SurveyMappingMutationResult<TMapping, TRevision> | undefined {
  if (
    typeof value !== "object" ||
    value === null ||
    !("mappings" in value) ||
    !("revision" in value) ||
    !Array.isArray(value.mappings)
  ) {
    return undefined;
  }
  return value as SurveyMappingMutationResult<TMapping, TRevision>;
}

function isMappingResponse<TMapping, TRevision>(
  value: SurveyMappingMutationResponse<TMapping, TRevision>
): value is TMapping {
  return value !== undefined && mutationResult<TMapping, TRevision>(value) === undefined;
}

function isMappingArray<TMapping, TRevision>(
  value: readonly TMapping[] | SurveyMappingReorderResult<TMapping, TRevision>
): value is readonly TMapping[] {
  return Array.isArray(value);
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

  const updateRevision = useCallback(
    (nextRevision: TRevision | undefined) => {
      revisionRef.current = nextRevision;
      setRevision(nextRevision);
      if (nextRevision !== undefined) options.onRevisionChange?.(nextRevision);
    },
    [options.onRevisionChange]
  );

  const applyConflict = useCallback(
    (cause: unknown): boolean => {
      if (!isSurveyMappingRevisionConflict<TMapping, TRevision>(cause)) return false;
      setMappings(cause.currentMappings);
      updateRevision(cause.currentRevision);
      setState({
        operation: "error",
        error: normalizeError(cause),
        revisionConflict: cause,
        canRetry: true
      });
      return true;
    },
    [setMappings, updateRevision]
  );

  const create = useCallback(
    async (selection: unknown): Promise<boolean> => {
      setState({ operation: "creating" });
      try {
        const expectedRevision = revisionRef.current;
        const request = {
          domain: domainRef.current,
          // The public API accepts unknown so untyped selection widgets can be composed;
          // the generic adapter contract is the validation boundary for the host application.
          selection: selection as TSelection,
          ...(expectedRevision === undefined ? {} : { expectedRevision }),
          signal: new AbortController().signal
        };
        const response =
          options.adapter.createWithRevision === undefined
            ? await options.adapter.create(request)
            : await options.adapter.createWithRevision(request);
        const committed = mutationResult<TMapping, TRevision>(response);
        if (committed !== undefined) {
          setMappings(committed.mappings);
          updateRevision(committed.revision);
        } else if (response === undefined) {
          throw new TypeError("SurveyMappingCrudAdapter.create must return a mapping or a committed result.");
        } else if (isMappingResponse<TMapping, TRevision>(response)) {
          setMappings([...mappingsRef.current, response]);
        } else {
          throw new TypeError("SurveyMappingCrudAdapter.create returned an invalid mapping response.");
        }
        setState({ operation: "idle" });
        await options.adapter.invalidate?.();
        return true;
      } catch (cause) {
        if (applyConflict(cause)) return false;
        setState({ operation: "error", error: normalizeError(cause) });
        return false;
      }
    },
    [applyConflict, options.adapter, setMappings, updateRevision]
  );

  const remove = useCallback(
    async (mapping: TMapping): Promise<boolean> => {
      setState({ operation: "removing" });
      try {
        const expectedRevision = revisionRef.current;
        const request = {
          domain: domainRef.current,
          mapping,
          ...(expectedRevision === undefined ? {} : { expectedRevision }),
          signal: new AbortController().signal
        };
        const response =
          options.adapter.removeWithRevision === undefined
            ? await options.adapter.remove(request)
            : await options.adapter.removeWithRevision(request);
        const committed = mutationResult<TMapping, TRevision>(response);
        if (committed !== undefined) {
          setMappings(committed.mappings);
          updateRevision(committed.revision);
        } else {
          setMappings(mappingsRef.current.filter((candidate) => candidate !== mapping));
        }
        setState({ operation: "idle" });
        await options.adapter.invalidate?.();
        return true;
      } catch (cause) {
        if (applyConflict(cause)) return false;
        setState({ operation: "error", error: normalizeError(cause) });
        return false;
      }
    },
    [applyConflict, options.adapter, setMappings, updateRevision]
  );

  const reorder = useCallback(
    async (mapping: TMapping, displayOrder: number): Promise<boolean> => {
      const legacyReorder = options.adapter.reorder;
      const revisionReorder = options.adapter.reorderWithRevision;
      if (legacyReorder === undefined && revisionReorder === undefined) {
        setState({ operation: "error", error: new TypeError("SurveyMappingCrudAdapter requires reorder.") });
        return false;
      }
      setState({ operation: "reordering" });
      try {
        const expectedRevision = revisionRef.current;
        const request = {
          domain: domainRef.current,
          mapping,
          displayOrder,
          ...(expectedRevision === undefined ? {} : { expectedRevision }),
          signal: new AbortController().signal
        };
        let response: unknown;
        if (revisionReorder !== undefined) {
          response = await revisionReorder(request);
        } else if (legacyReorder !== undefined) {
          response = await legacyReorder(request);
        } else {
          throw new TypeError("SurveyMappingCrudAdapter requires reorder.");
        }
        const committed = mutationResult<TMapping, TRevision>(response);
        if (committed !== undefined) {
          setMappings(committed.mappings);
          updateRevision(committed.revision);
        } else {
          setMappings(moveMapping(mappingsRef.current, mapping, displayOrder));
        }
        setState({ operation: "idle" });
        await options.adapter.invalidate?.();
        return true;
      } catch (cause) {
        if (applyConflict(cause)) return false;
        setState({ operation: "error", error: normalizeError(cause) });
        return false;
      }
    },
    [applyConflict, options.adapter, setMappings, updateRevision]
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
        const conflict = new SurveyMappingRevisionConflictError<TMapping, TRevision>(
          {
            expectedRevision: request.expectedRevision,
            currentRevision: previousRevision,
            currentMappings: previousMappings
          },
          "SurveyMappingAtomicCrudAdapter rejected a stale expected revision."
        );
        applyConflict(conflict);
        const error = normalizeError(conflict);
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
        updateRevision(result.revision);
        setState({ operation: "idle" });
      } catch (cause) {
        if (applyConflict(cause)) throw normalizeError(cause);
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
          updateRevision(previousRevision);
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
    [applyConflict, options.adapter, setMappings, updateRevision]
  );

  const refresh = useCallback(async (): Promise<boolean> => {
    if (options.adapter.list === undefined && options.adapter.listWithRevision === undefined) return false;
    try {
      const request = { domain: domainRef.current, signal: new AbortController().signal };
      const response =
        options.adapter.listWithRevision === undefined
          ? await options.adapter.list?.(request)
          : await options.adapter.listWithRevision(request);
      const committed = mutationResult<TMapping, TRevision>(response);
      if (committed === undefined && response !== undefined && isMappingArray<TMapping, TRevision>(response)) {
        setMappings(response);
      } else if (committed !== undefined) {
        setMappings(committed.mappings);
        updateRevision(committed.revision);
      } else {
        throw new TypeError("SurveyMappingCrudAdapter.list returned an invalid response.");
      }
      return true;
    } catch (cause) {
      if (applyConflict(cause)) return false;
      setState({ operation: "error", error: normalizeError(cause) });
      return false;
    }
  }, [applyConflict, options.adapter.list, options.adapter.listWithRevision, setMappings, updateRevision]);

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
