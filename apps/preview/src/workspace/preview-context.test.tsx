import { createSubmission, type FormSchema } from "@form-engine-ts/core";
import type { SubmitContext } from "@form-engine-ts/react";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { BuilderPreviewProvider, useBuilderPreview } from "../builder/BuilderPreviewContext";
import { RespondentPreviewProvider, useRespondentPreview } from "../respondent/RespondentPreviewContext";
import { PreviewWorkspaceProvider, usePreviewWorkspace } from "./PreviewWorkspaceContext";

function BuilderContextWrapper({ children }: { readonly children: ReactNode }) {
  return (
    <PreviewWorkspaceProvider>
      <BuilderPreviewProvider>{children}</BuilderPreviewProvider>
    </PreviewWorkspaceProvider>
  );
}

const firstSurvey: FormSchema = {
  id: "first-survey",
  version: 1,
  title: "First survey",
  defaultLocale: "en",
  fields: [{ id: "message", type: "textarea", title: "Feedback", required: false }]
};
const secondSurvey: FormSchema = { ...firstSurvey, id: "second-survey", title: "Second survey" };

function submitContext(schema: FormSchema): SubmitContext {
  return {
    attemptId: "test-attempt",
    formId: schema.id,
    formVersion: schema.version,
    locale: "en",
    submittedAt: "2026-01-01T10:00:00Z"
  };
}

describe("preview context hooks", () => {
  it("requires the workspace provider", () => {
    expect(() => renderHook(() => usePreviewWorkspace())).toThrow(
      "usePreviewWorkspace must be called inside a PreviewWorkspaceProvider."
    );
  });

  it("requires the builder provider", () => {
    expect(() => renderHook(() => useBuilderPreview())).toThrow(
      "useBuilderPreview must be called inside a BuilderPreviewProvider."
    );
  });

  it("requires the respondent provider", () => {
    expect(() => renderHook(() => useRespondentPreview())).toThrow(
      "useRespondentPreview must be called inside a RespondentPreviewProvider."
    );
  });

  it("exposes workspace state and updates shared settings", async () => {
    const { result } = renderHook(() => usePreviewWorkspace(), { wrapper: PreviewWorkspaceProvider });

    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() => expect(result.current.workspaceReady).toBe(true));
    expect(result.current.schema.id).toBe("customer-feedback");
    expect(result.current.storageKind).toBe("memory");

    act(() => {
      result.current.setLocale("ja");
      result.current.setStorageKind("local");
    });

    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() => expect(result.current.workspaceReady).toBe(true));
    expect(result.current.locale).toBe("ja");
    expect(result.current.storageKind).toBe("local");
  });

  it("shares builder settings through the builder provider", async () => {
    const { result } = renderHook(
      () => {
        const workspace = usePreviewWorkspace();
        const builder = useBuilderPreview();
        return { workspace, builder };
      },
      { wrapper: BuilderContextWrapper }
    );

    await waitFor(() => expect(result.current.workspace.workspaceReady).toBe(true));

    act(() => {
      result.current.builder.setBuilderReadOnly(true);
      result.current.builder.setPagesEnabled(false);
      result.current.builder.setLocalizationEnabled(false);
      result.current.builder.setConditionsEnabled(false);
      result.current.builder.setUseCustomBuilderUi(true);
    });

    expect(result.current.builder.builderReadOnly).toBe(true);
    expect(result.current.builder.pagesEnabled).toBe(false);
    expect(result.current.builder.localizationEnabled).toBe(false);
    expect(result.current.builder.conditionsEnabled).toBe(false);
    expect(result.current.builder.useCustomBuilderUi).toBe(true);
  });

  it("shares respondent demo settings through the respondent provider", () => {
    const { result } = renderHook(() => useRespondentPreview(), { wrapper: RespondentPreviewProvider });

    act(() => {
      result.current.setUseCustomSlots(true);
      result.current.setCancelNextSubmit(true);
      result.current.setSuccessRenderMode("replace");
      result.current.setChoiceFieldLayout("all-grouped");
      result.current.setUseMuiChoiceGroup(true);
      result.current.setLifecycleStatus("Submission cancelled");
    });

    expect(result.current.useCustomSlots).toBe(true);
    expect(result.current.cancelNextSubmit).toBe(true);
    expect(result.current.successRenderMode).toBe("replace");
    expect(result.current.choiceFieldLayout).toBe("all-grouped");
    expect(result.current.useMuiChoiceGroup).toBe(true);
    expect(result.current.lifecycleStatus).toBe("Submission cancelled");
  });
});

describe("selected survey response isolation", () => {
  it("opens only the selected survey's responses and preserves responses for other surveys", async () => {
    const { result } = renderHook(() => usePreviewWorkspace(), { wrapper: PreviewWorkspaceProvider });
    await waitFor(() => expect(result.current.workspaceReady).toBe(true));
    await act(async () => result.current.openSchema(firstSurvey));
    await act(async () => result.current.submit({ message: "First customer" }, submitContext(firstSurvey)));
    expect(result.current.submissions).toHaveLength(1);
    const storage = result.current.storage;
    await storage.saveSubmission(
      createSubmission(
        secondSurvey,
        { message: "Second customer" },
        {
          id: "second-response",
          locale: "en",
          submittedAt: "2026-01-02T10:00:00Z"
        }
      )
    );

    await act(async () => result.current.openSchema(secondSurvey));

    expect(result.current.schema.id).toBe(secondSurvey.id);
    expect(result.current.submissions.map((submission) => submission.id)).toEqual(["second-response"]);
    expect(result.current.analytics.submissionCount).toBe(1);
    expect(await storage.listSubmissions(firstSurvey.id, firstSurvey.version)).toHaveLength(1);
    await act(async () => result.current.openSchema(firstSurvey));
    expect(result.current.submissions[0]?.values.message).toBe("First customer");
  });

  it.each(["saveSchema", "listSubmissions"] as const)(
    "preserves the selected survey and propagates a %s failure",
    async (method) => {
      const { result } = renderHook(() => usePreviewWorkspace(), { wrapper: PreviewWorkspaceProvider });
      await waitFor(() => expect(result.current.workspaceReady).toBe(true));
      await act(async () => result.current.openSchema(firstSurvey));
      await act(async () => result.current.submit({ message: "Existing customer" }, submitContext(firstSurvey)));
      const previousSubmissions = result.current.submissions;
      const error = new Error("Selected survey could not be loaded");
      const failingMethod = vi.spyOn(result.current.storage, method).mockRejectedValueOnce(error);

      await act(async () => {
        await expect(result.current.openSchema(secondSurvey)).rejects.toBe(error);
      });

      expect(result.current.workspaceReady).toBe(true);
      expect(result.current.schema.id).toBe(firstSurvey.id);
      expect(result.current.submissions).toEqual(previousSubmissions);
      expect(result.current.loadError).toBe(error.message);
      await expect(result.current.submit({ message: "Should not save" }, submitContext(firstSurvey))).rejects.toThrow(
        "Check the form loading status."
      );
      failingMethod.mockRestore();
    }
  );

  it("reloads responses when changeSchema selects a new form version", async () => {
    const { result } = renderHook(() => usePreviewWorkspace(), { wrapper: PreviewWorkspaceProvider });
    await waitFor(() => expect(result.current.workspaceReady).toBe(true));
    await act(async () => result.current.openSchema(firstSurvey));
    await act(async () => result.current.submit({ message: "Version one" }, submitContext(firstSurvey)));
    const versionTwo = { ...firstSurvey, version: 2 };
    await result.current.storage.saveSubmission(
      createSubmission(
        versionTwo,
        { message: "Version two" },
        {
          id: "version-two-response",
          locale: "en",
          submittedAt: "2026-01-02T10:00:00Z"
        }
      )
    );

    act(() => result.current.changeSchema(versionTwo));
    await waitFor(() => expect(result.current.schema.version).toBe(2));

    expect(result.current.workspaceReady).toBe(true);
    expect(result.current.submissions.map((submission) => submission.id)).toEqual(["version-two-response"]);
    expect(result.current.analytics.submissionCount).toBe(1);
  });

  it("keeps a delayed old-form submission from replacing the newly selected survey's responses", async () => {
    const { result } = renderHook(() => usePreviewWorkspace(), { wrapper: PreviewWorkspaceProvider });
    await waitFor(() => expect(result.current.workspaceReady).toBe(true));
    await act(async () => result.current.openSchema(firstSurvey));
    const storage = result.current.storage;
    const originalSave = storage.saveSubmission.bind(storage);
    let releaseSave: () => void = () => undefined;
    const saveGate = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    const delayedSave = vi.spyOn(storage, "saveSubmission").mockImplementationOnce(async (submission) => {
      await saveGate;
      await originalSave(submission);
    });
    let pendingSubmission: Promise<void> | undefined;
    act(() => {
      pendingSubmission = result.current.submit({ message: "Delayed customer" }, submitContext(firstSurvey));
    });
    expect(delayedSave).toHaveBeenCalledOnce();
    await act(async () => result.current.openSchema(secondSurvey));

    await act(async () => {
      releaseSave();
      await pendingSubmission;
    });

    expect(result.current.schema.id).toBe(secondSurvey.id);
    expect(result.current.submissions).toEqual([]);
    expect(await storage.listSubmissions(firstSurvey.id, firstSurvey.version)).toHaveLength(1);
    delayedSave.mockRestore();
  });

  it("keeps the latest selection when an earlier survey response load finishes later", async () => {
    const { result } = renderHook(() => usePreviewWorkspace(), { wrapper: PreviewWorkspaceProvider });
    await waitFor(() => expect(result.current.workspaceReady).toBe(true));
    const storage = result.current.storage;
    const originalList = storage.listSubmissions.bind(storage);
    let releaseLoad: () => void = () => undefined;
    const loadGate = new Promise<void>((resolve) => {
      releaseLoad = resolve;
    });
    const delayedList = vi.spyOn(storage, "listSubmissions").mockImplementationOnce(async (formId, version) => {
      await loadGate;
      return originalList(formId, version);
    });
    let pendingOpening: Promise<void> | undefined;
    act(() => {
      pendingOpening = result.current.openSchema(firstSurvey);
    });
    await waitFor(() => expect(delayedList).toHaveBeenCalledOnce());

    await act(async () => result.current.openSchema(secondSurvey));
    await act(async () => {
      releaseLoad();
      await pendingOpening;
    });

    expect(result.current.schema.id).toBe(secondSurvey.id);
    expect(result.current.workspaceReady).toBe(true);
    expect(result.current.submissions).toEqual([]);
    expect(result.current.loadError).toBeNull();
    delayedList.mockRestore();
  });

  it("preserves the selected survey across storage changes and restores its saved responses", async () => {
    globalThis.localStorage.clear();
    const { result } = renderHook(() => usePreviewWorkspace(), { wrapper: PreviewWorkspaceProvider });
    await waitFor(() => expect(result.current.workspaceReady).toBe(true));
    await act(async () => result.current.openSchema(firstSurvey));
    await act(async () => result.current.submit({ message: "Memory customer" }, submitContext(firstSurvey)));

    act(() => result.current.setStorageKind("local"));
    await waitFor(() => expect(result.current.workspaceReady).toBe(true));
    expect(result.current.schema.id).toBe(firstSurvey.id);
    expect(result.current.submissions).toEqual([]);

    act(() => result.current.setStorageKind("memory"));
    await waitFor(() => expect(result.current.workspaceReady).toBe(true));
    expect(result.current.schema.id).toBe(firstSurvey.id);
    expect(result.current.submissions[0]?.values.message).toBe("Memory customer");
    globalThis.localStorage.clear();
  });

  it("ignores late telemetry from the previous survey after the selection changes", async () => {
    const { result } = renderHook(() => usePreviewWorkspace(), { wrapper: PreviewWorkspaceProvider });
    await waitFor(() => expect(result.current.workspaceReady).toBe(true));
    await act(async () => result.current.openSchema(firstSurvey));
    const viewedEvent = {
      eventId: "first-view",
      eventVersion: 1 as const,
      type: "form.viewed" as const,
      sessionId: "first-session",
      sequence: 1,
      formId: firstSurvey.id,
      formVersion: firstSurvey.version,
      occurredAt: "2026-01-01T10:00:00Z",
      elapsedMs: 0
    };
    act(() => result.current.telemetryAdapter.track(viewedEvent));
    await act(async () => result.current.openSchema(secondSurvey));

    act(() => {
      result.current.telemetryAdapter.track({
        ...viewedEvent,
        eventId: "late-first-exit",
        type: "form.exited",
        reason: "unmount",
        sequence: 2,
        elapsedMs: 1000
      });
      result.current.telemetryAdapter.track({
        ...viewedEvent,
        eventId: "second-view",
        sessionId: "second-session",
        formId: secondSurvey.id
      });
    });

    expect(result.current.interactionEvents.map((event) => event.eventId)).toEqual(["second-view"]);
    expect(result.current.interactionAnalytics.formId).toBe(secondSurvey.id);
    expect(result.current.interactionAnalytics.funnel.viewedCount).toBe(1);
  });
});
