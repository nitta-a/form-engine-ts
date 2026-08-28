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

    await waitFor(() => expect(result.current.workspaceReady).toBe(true));
    expect(result.current.schema.id).toBe("customer-feedback");
    expect(result.current.storageKind).toBe("memory");

    act(() => {
      result.current.setLocale("ja");
      result.current.setStorageKind("local");
    });

    expect(result.current.locale).toBe("ja");
    expect(result.current.storageKind).toBe("local");
  });

  it("shares builder settings through the builder provider", () => {
    const { result } = renderHook(() => useBuilderPreview(), { wrapper: BuilderContextWrapper });

    act(() => {
      result.current.setBuilderReadOnly(true);
      result.current.setPagesEnabled(false);
      result.current.setLocalizationEnabled(false);
      result.current.setConditionsEnabled(false);
      result.current.setUseCustomBuilderUi(true);
    });

    expect(result.current.builderReadOnly).toBe(true);
    expect(result.current.pagesEnabled).toBe(false);
    expect(result.current.localizationEnabled).toBe(false);
    expect(result.current.conditionsEnabled).toBe(false);
    expect(result.current.useCustomBuilderUi).toBe(true);
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
