import type { ContentModeIssueCode, FormContentMode } from "@form-engine-ts/core";
import type { FieldPropertyControlMode } from "@form-engine-ts/react";
import type { ReactNode } from "react";

export interface MuiContentModeControls {
  readonly mode?: FieldPropertyControlMode;
  readonly resultVisibility?: FieldPropertyControlMode;
  readonly strictOneVotePerUser?: FieldPropertyControlMode;
  readonly showExplanation?: FieldPropertyControlMode;
  readonly passingScore?: FieldPropertyControlMode;
  readonly correctAnswer?: FieldPropertyControlMode;
  readonly explanation?: FieldPropertyControlMode;
  readonly points?: FieldPropertyControlMode;
}

export interface MuiFormBuilderValidationIssue {
  readonly source: "schema" | "contentMode";
  readonly path: string;
  readonly code: string | ContentModeIssueCode;
  readonly message: string;
}

export interface MuiFormBuilderValidationState {
  readonly mode: FormContentMode;
  readonly valid: boolean;
  readonly issues: readonly MuiFormBuilderValidationIssue[];
}

export interface MuiContentModeOptions {
  readonly showSelector?: boolean;
  readonly applyPolicy?: boolean;
  readonly validation?: "summary" | "hidden";
  readonly controls?: MuiContentModeControls;
  readonly onValidationChange?: (state: MuiFormBuilderValidationState) => void;
  readonly renderValidationSummary?: (state: MuiFormBuilderValidationState) => ReactNode;
}
