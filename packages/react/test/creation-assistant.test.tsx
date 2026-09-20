import {
  type AuthoringAssistantAdapter,
  type CreationAssistantAdapter,
  computeAuthoringSchemaHash,
  createInitialSchemaByMode,
  type FormSchema
} from "@form-engine-ts/core";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFormCreationAssistant } from "../src/hooks/useFormCreationAssistant";

const schema: FormSchema = createInitialSchemaByMode("survey", { id: "creation", title: "Draft", locale: "en" });

describe("useFormCreationAssistant", () => {
  it("collects a brief, generates through authoring, and completes with the applied schema", async () => {
    const creationAdapter: CreationAssistantAdapter = {
      respond: async ({ latestMessage, brief }) =>
        brief.purpose === undefined
          ? { type: "clarification", message: "Audience?", brief: { purpose: latestMessage }, missing: ["audience"] }
          : { type: "ready", message: "Ready", brief: { ...brief, audience: latestMessage } }
    };
    const authoringAdapter: AuthoringAssistantAdapter = {
      generate: async (request) => ({
        id: "draft",
        summary: "Generated draft",
        baseSchemaHash: typeof request.context?.schemaHash === "string" ? request.context.schemaHash : "",
        operations: [{ operationId: "question", type: "addField", field: { type: "text", title: "Comment" } }]
      })
    };
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useFormCreationAssistant({ creationAdapter, authoringAdapter, initialSchema: schema, onComplete })
    );
    await act(async () => {
      await result.current.sendMessage("Learn about onboarding");
    });
    await act(async () => {
      await result.current.sendMessage("New employees");
    });
    expect(result.current.status).toBe("ready");
    expect(result.current.brief).toMatchObject({ purpose: "Learn about onboarding", audience: "New employees" });
    await act(async () => {
      await result.current.generateDraft();
    });
    expect(result.current.status).toBe("reviewing");
    expect(result.current.preview?.valid).toBe(true);
    act(() => {
      result.current.applySuggestion();
    });
    expect(result.current.status).toBe("completed");
    expect(result.current.schema.fields).toHaveLength(1);
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ fields: expect.any(Array) }));
  });

  it("keeps the conversation on invalid provider responses and can reset", async () => {
    const creationAdapter: CreationAssistantAdapter = { respond: async () => ({ type: "ready" }) as never };
    const authoringAdapter: AuthoringAssistantAdapter = {
      generate: async () => ({
        id: "draft",
        summary: "Draft",
        baseSchemaHash: computeAuthoringSchemaHash(schema),
        operations: []
      })
    };
    const { result } = renderHook(() =>
      useFormCreationAssistant({ creationAdapter, authoringAdapter, initialSchema: schema })
    );
    await act(async () => {
      await result.current.sendMessage("Purpose");
    });
    expect(result.current.status).toBe("error");
    expect(result.current.messages[0]?.content).toBe("Purpose");
    act(() => result.current.reset());
    expect(result.current.status).toBe("idle");
    expect(result.current.messages).toEqual([]);
  });

  it("classifies network failures and retries without losing the conversation", async () => {
    let attempts = 0;
    const creationAdapter: CreationAssistantAdapter = {
      respond: async ({ latestMessage }) => {
        attempts += 1;
        if (attempts === 1) throw new TypeError("fetch failed");
        return { type: "ready", message: "Ready", brief: { purpose: latestMessage, audience: "Users" } };
      }
    };
    const authoringAdapter: AuthoringAssistantAdapter = {
      generate: async () => {
        throw new Error("not used");
      }
    };
    const { result } = renderHook(() =>
      useFormCreationAssistant({ creationAdapter, authoringAdapter, initialSchema: schema })
    );
    await act(async () => {
      await result.current.sendMessage("Learn more");
    });
    expect(result.current.error?.code).toBe("network_error");
    await act(async () => {
      await result.current.retry();
    });
    expect(attempts).toBe(2);
    expect(result.current.status).toBe("ready");
    expect(result.current.messages.filter((message) => message.role === "user")).toHaveLength(2);
    expect(result.current.brief).toMatchObject({ purpose: "Learn more", audience: "Users" });
  });

  it("surfaces a stale authoring response without applying it", async () => {
    const creationAdapter: CreationAssistantAdapter = {
      respond: async () => ({ type: "ready", message: "Ready", brief: { purpose: "Learn", audience: "Users" } })
    };
    const authoringAdapter: AuthoringAssistantAdapter = {
      generate: async () => ({
        id: "stale",
        summary: "Stale draft",
        baseSchemaHash: computeAuthoringSchemaHash({ ...schema, title: "Changed elsewhere" }),
        operations: []
      })
    };
    const { result } = renderHook(() =>
      useFormCreationAssistant({ creationAdapter, authoringAdapter, initialSchema: schema })
    );
    await act(async () => {
      await result.current.sendMessage("Learn more");
    });
    await act(async () => {
      await result.current.generateDraft();
    });
    expect(result.current.error?.code).toBe("stale_schema");
    expect(result.current.schema).toEqual(schema);
  });

  it("aborts an in-flight conversation without showing an error", async () => {
    const creationAdapter: CreationAssistantAdapter = {
      respond: async (_, signal) =>
        await new Promise<never>((_, reject) => {
          signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
        })
    };
    const authoringAdapter: AuthoringAssistantAdapter = {
      generate: async () => {
        throw new Error("not used");
      }
    };
    const { result } = renderHook(() =>
      useFormCreationAssistant({ creationAdapter, authoringAdapter, initialSchema: schema })
    );
    let pending: Promise<unknown> | undefined;
    act(() => {
      pending = result.current.sendMessage("Learn more");
    });
    act(() => result.current.cancel());
    await act(async () => {
      await pending;
    });
    expect(result.current.status).toBe("collecting");
    expect(result.current.error).toBeUndefined();
  });
});
