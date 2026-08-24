import type { FormField, FormPage, JsonValue, ValidationError } from "@form-engine-ts/core";
import type { ReactNode } from "react";

export interface BuilderActionContext {
  readonly action:
    | "addField"
    | "removeField"
    | "moveField"
    | "changeFieldType"
    | "updateField"
    | "addOption"
    | "removeOption"
    | "moveOption"
    | "updateOption"
    | "addPage"
    | "removePage"
    | "movePage"
    | "assignFieldToPage"
    | "setDisplayCondition"
    | "setSourceText"
    | "setLocaleTranslation";
  readonly targetId?: string;
  readonly params?: Record<string, unknown>;
}

export interface ManualTranslationContext {
  readonly locale: string;
  readonly kind: "form" | "page" | "field" | "option";
  readonly nodeId: string;
  readonly property: "title" | "description" | "label" | "completionMessage";
  readonly sourceText: string;
  readonly translatedText: string;
  readonly existingTranslationMetadata?: Readonly<Record<string, JsonValue>>;
}

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
