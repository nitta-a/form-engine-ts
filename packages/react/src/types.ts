import type { FormField, FormPage, ValidationError } from "@form-engine-ts/core";
import type { ReactNode } from "react";

export type SubmitResult =
  | { readonly status: "invalid"; readonly issues: readonly ValidationError[] }
  | { readonly status: "cancelled" }
  | { readonly status: "success" }
  | { readonly status: "error"; readonly error: Error };

export interface FormRendererSlots {
  readonly renderHeader?: (props: { readonly title: string; readonly description?: string }) => ReactNode;
  readonly renderPageHeader?: (props: {
    readonly page: FormPage;
    readonly pageIndex: number;
    readonly totalPages: number;
  }) => ReactNode;
  readonly renderField?: (props: {
    readonly question: FormField;
    readonly value: unknown;
    readonly onChange: (value: unknown) => void;
    readonly error?: ValidationError;
  }) => ReactNode;
  readonly renderNavigation?: (props: {
    readonly currentPage: number;
    readonly totalPages: number;
    readonly canPrev: boolean;
    readonly canNext: boolean;
    readonly onPrev: () => void;
    readonly onNext: () => void;
  }) => ReactNode;
  readonly renderSubmitButton?: (props: { readonly isSubmitting: boolean; readonly onSubmit: () => void }) => ReactNode;
  readonly renderValidationSummary?: (props: { readonly issues: readonly ValidationError[] }) => ReactNode;
  readonly renderCompletion?: (props: { readonly message: string }) => ReactNode;
  readonly renderSubmitError?: (props: { readonly error: Error; readonly onRetry?: () => void }) => ReactNode;
}

export type BeforeSubmit = (
  values: Readonly<Record<string, unknown>>
) => "continue" | "cancel" | Promise<"continue" | "cancel">;
