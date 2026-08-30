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
