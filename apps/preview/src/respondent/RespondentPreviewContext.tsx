import type { FormSuccessRenderMode } from "@form-engine-ts/react";
import { createContext, type ReactNode, useContext, useMemo, useState } from "react";

export type ChoiceFieldLayout = "default" | "radio-grouped" | "all-grouped";

export interface RespondentPreviewContextValue {
  readonly useCustomSlots: boolean;
  readonly cancelNextSubmit: boolean;
  readonly successRenderMode: FormSuccessRenderMode;
  readonly choiceFieldLayout: ChoiceFieldLayout;
  readonly useMuiChoiceGroup: boolean;
  readonly lifecycleStatus: string | null;
  readonly setUseCustomSlots: (value: boolean) => void;
  readonly setCancelNextSubmit: (value: boolean) => void;
  readonly setSuccessRenderMode: (value: FormSuccessRenderMode) => void;
  readonly setChoiceFieldLayout: (value: ChoiceFieldLayout) => void;
  readonly setUseMuiChoiceGroup: (value: boolean) => void;
  readonly setLifecycleStatus: (value: string) => void;
}

const RespondentPreviewContext = createContext<RespondentPreviewContextValue | null>(null);

export function RespondentPreviewProvider({ children }: { readonly children: ReactNode }) {
  const [useCustomSlots, setUseCustomSlots] = useState(false);
  const [cancelNextSubmit, setCancelNextSubmit] = useState(false);
  const [successRenderMode, setSuccessRenderMode] = useState<FormSuccessRenderMode>("append");
  const [choiceFieldLayout, setChoiceFieldLayout] = useState<ChoiceFieldLayout>("default");
  const [useMuiChoiceGroup, setUseMuiChoiceGroup] = useState(false);
  const [lifecycleStatus, setLifecycleStatus] = useState<string | null>(null);

  const contextValue = useMemo<RespondentPreviewContextValue>(
    () => ({
      useCustomSlots,
      cancelNextSubmit,
      successRenderMode,
      choiceFieldLayout,
      useMuiChoiceGroup,
      lifecycleStatus,
      setUseCustomSlots,
      setCancelNextSubmit,
      setSuccessRenderMode,
      setChoiceFieldLayout,
      setUseMuiChoiceGroup,
      setLifecycleStatus
    }),
    [cancelNextSubmit, choiceFieldLayout, lifecycleStatus, successRenderMode, useCustomSlots, useMuiChoiceGroup]
  );

  return <RespondentPreviewContext.Provider value={contextValue}>{children}</RespondentPreviewContext.Provider>;
}

export function useRespondentPreview(): RespondentPreviewContextValue {
  const context = useContext(RespondentPreviewContext);
  if (context === null) throw new Error("useRespondentPreview must be called inside a RespondentPreviewProvider.");
  return context;
}
