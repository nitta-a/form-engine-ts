import { act, renderHook } from "@testing-library/react";
import { useSurveyMappingCrud } from "../src";

interface Mapping {
  readonly id: string;
}

describe("useSurveyMappingCrud conflict recovery", () => {
  it("updates state, notifies the consumer, and retries a failed create", async () => {
    const latest: Mapping = { id: "latest" };
    const onConflict = vi.fn();
    const createWithRevision = vi
      .fn()
      .mockRejectedValueOnce({
        code: "REVISION_CONFLICT",
        expectedRevision: "r1",
        currentRevision: "r2",
        currentMappings: [latest]
      })
      .mockResolvedValueOnce({ mappings: [{ id: "created" }], revision: "r3" });
    const { result } = renderHook(() =>
      useSurveyMappingCrud({
        domain: { id: "survey" },
        mappings: [],
        revision: "r1",
        adapter: {
          create: vi.fn().mockResolvedValue({ id: "created" }),
          createWithRevision,
          remove: vi.fn(),
          reorderMany: vi.fn()
        },
        onConflict
      })
    );

    await act(async () => expect(await result.current.create({ fieldId: "q" })).toBe(false));
    expect(result.current.mappings).toEqual([latest]);
    expect(result.current.revision).toBe("r2");
    expect(onConflict).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRevision: "r1", currentRevision: "r2", currentMappings: [latest] })
    );

    await act(async () => expect(await result.current.retry()).toBe(true));
    expect(createWithRevision).toHaveBeenLastCalledWith(expect.objectContaining({ expectedRevision: "r2" }));
    expect(result.current.mappings).toEqual([{ id: "created" }]);
    expect(result.current.revision).toBe("r3");
  });

  it("uses the same conflict contract for remove and reload", async () => {
    const first = { id: "first" };
    const current = { id: "current" };
    const onConflict = vi.fn();
    const removeWithRevision = vi.fn().mockRejectedValue({
      code: "REVISION_CONFLICT",
      expectedRevision: "r1",
      currentRevision: "r2",
      currentMappings: [current]
    });
    const listWithRevision = vi.fn().mockResolvedValue({ mappings: [first], revision: "r4" });
    const { result } = renderHook(() =>
      useSurveyMappingCrud({
        domain: { id: "survey" },
        mappings: [first],
        revision: "r1",
        adapter: {
          create: vi.fn(),
          remove: vi.fn(),
          removeWithRevision,
          reorderMany: vi.fn(),
          listWithRevision
        },
        onConflict
      })
    );

    await act(async () => expect(await result.current.remove(first)).toBe(false));
    expect(result.current.state.revisionConflict).toEqual(
      expect.objectContaining({ currentRevision: "r2", currentMappings: [current] })
    );
    expect(onConflict).toHaveBeenCalledTimes(1);
    await act(async () => expect(await result.current.reload()).toBe(true));
    expect(result.current.mappings).toEqual([first]);
    expect(result.current.revision).toBe("r4");
  });

  it("applies a reorderMany conflict before rejecting the atomic operation", async () => {
    const current = { id: "current" };
    const onConflict = vi.fn();
    const reorderMany = vi.fn().mockRejectedValue({
      code: "REVISION_CONFLICT",
      expectedRevision: "r1",
      currentRevision: "r2",
      currentMappings: [current]
    });
    const { result } = renderHook(() =>
      useSurveyMappingCrud({
        domain: { id: "survey" },
        mappings: [],
        revision: "r1",
        adapter: { create: vi.fn(), remove: vi.fn(), reorderMany },
        onConflict
      })
    );

    await act(async () => {
      await expect(
        result.current.reorderMany({
          mappings: [],
          selection: { groupId: "group" },
          signal: new AbortController().signal
        })
      ).rejects.toThrow("Survey mapping revision conflict");
    });
    expect(result.current.mappings).toEqual([current]);
    expect(result.current.revision).toBe("r2");
    expect(onConflict).toHaveBeenCalledWith(expect.objectContaining({ currentMappings: [current] }));
  });
});
