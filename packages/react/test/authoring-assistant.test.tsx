import {
  type AuthoringAssistantAdapter,
  computeAuthoringSchemaHash,
  createInitialSchemaByMode,
  type FormSchema
} from "@form-engine-ts/core";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAuthoringAssistant } from "../src/hooks/useAuthoringAssistant";

const schema: FormSchema = {
  ...createInitialSchemaByMode("survey", { id: "hook-form", title: "Survey", locale: "en" }),
  fields: [{ id: "q1", type: "text", title: "Question", required: false }]
};

describe("useAuthoringAssistant", () => {
  it("moves from generating to ready and applies selected operations", async () => {
    const adapter: AuthoringAssistantAdapter = {
      generate: async (request) => ({
        id: "s1",
        summary: "Rename form",
        baseSchemaHash: computeAuthoringSchemaHash(request.schema as FormSchema),
        operations: [{ operationId: "form", type: "updateForm", patch: { title: "Updated" } }]
      })
    };
    const onChange = vi.fn();
    const { result } = renderHook(() => useAuthoringAssistant({ schema, adapter, onChange }));
    let promise: Promise<unknown> | undefined;
    act(() => {
      promise = result.current.suggest({ intent: "improve_text" });
    });
    await act(async () => {
      await promise;
    });
    expect(result.current.status).toBe("ready");
    act(() => {
      result.current.clearSelection();
    });
    expect(result.current.preview?.valid).toBe(true);
    expect(result.current.preview?.operations).toHaveLength(0);
    act(() => {
      result.current.apply(["form"]);
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ title: "Updated" }));
    expect(result.current.status).toBe("idle");
  });

  it("distinguishes provider failure and cancellation", async () => {
    const rejectAdapter: AuthoringAssistantAdapter = {
      generate: async () => {
        throw new Error("offline");
      }
    };
    const { result } = renderHook(() => useAuthoringAssistant({ schema, adapter: rejectAdapter, onChange: vi.fn() }));
    await act(async () => {
      await result.current.suggest({ intent: "generate_form" });
    });
    expect(result.current.error?.code).toBe("provider_failure");
    let resolve: (() => void) | undefined;
    const pending: AuthoringAssistantAdapter = {
      generate: () =>
        new Promise((_, reject) => {
          resolve = () => reject(new DOMException("cancel", "AbortError"));
        })
    };
    const pendingHook = renderHook(() => useAuthoringAssistant({ schema, adapter: pending, onChange: vi.fn() }));
    act(() => {
      void pendingHook.result.current.suggest({ intent: "generate_form" });
      pendingHook.result.current.cancel();
    });
    resolve?.();
    await waitFor(() => expect(pendingHook.result.current.status).toBe("idle"));
    await waitFor(() => expect(pendingHook.result.current.error?.code).toBe("cancelled"));
  });

  it("rejects malformed and policy-invalid provider responses", async () => {
    const invalidResponse: AuthoringAssistantAdapter = {
      generate: async () => ({ operations: [] }) as never
    };
    const invalidHook = renderHook(() =>
      useAuthoringAssistant({ schema, adapter: invalidResponse, onChange: vi.fn() })
    );
    await act(async () => {
      await invalidHook.result.current.suggest({ intent: "generate_form" });
    });
    expect(invalidHook.result.current.error?.code).toBe("invalid_response");

    const policyInvalid: AuthoringAssistantAdapter = {
      generate: async (request) => ({
        id: "invalid-policy",
        summary: "Too many fields",
        baseSchemaHash: computeAuthoringSchemaHash(request.schema as FormSchema),
        operations: [{ operationId: "bad-type", type: "addField", field: { type: "rating", title: "Not allowed" } }]
      })
    };
    const policyHook = renderHook(() =>
      useAuthoringAssistant({
        schema,
        adapter: policyInvalid,
        policy: { allowedFieldTypes: ["text"] },
        onChange: vi.fn()
      })
    );
    await act(async () => {
      await policyHook.result.current.suggest({ intent: "generate_form" });
    });
    expect(policyHook.result.current.error?.code).toBe("validation_failure");
  });

  it("rejects applying a suggestion after the schema changes", async () => {
    const adapter: AuthoringAssistantAdapter = {
      generate: async (request) => ({
        id: "stale",
        summary: "Rename form",
        baseSchemaHash: computeAuthoringSchemaHash(request.schema as FormSchema),
        operations: [{ operationId: "form", type: "updateForm", patch: { title: "Updated" } }]
      })
    };
    const onChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ currentSchema }: { readonly currentSchema: FormSchema }) =>
        useAuthoringAssistant({ schema: currentSchema, adapter, onChange }),
      { initialProps: { currentSchema: schema } }
    );
    await act(async () => {
      await result.current.suggest({ intent: "improve_text" });
    });
    rerender({ currentSchema: { ...schema, title: "Changed elsewhere" } });
    await waitFor(() => expect(result.current.isStale).toBe(true));
    expect(result.current.preview?.issues[0]?.code).toBe("stale_schema");
    let applied: ReturnType<typeof result.current.apply>;
    act(() => {
      applied = result.current.apply();
    });
    expect(applied).toMatchObject({ success: false, error: { code: "stale_schema" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("aborts provider work when unmounted", async () => {
    let signal: AbortSignal | undefined;
    const adapter: AuthoringAssistantAdapter = {
      generate: (_request, nextSignal) => {
        signal = nextSignal;
        return new Promise<never>(() => undefined);
      }
    };
    const pendingHook = renderHook(() => useAuthoringAssistant({ schema, adapter, onChange: vi.fn() }));
    act(() => {
      void pendingHook.result.current.suggest({ intent: "generate_form" });
    });
    pendingHook.unmount();
    expect(signal?.aborted).toBe(true);
  });
});
