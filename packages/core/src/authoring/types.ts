import type { FieldOption, FormField, FormPolicy, FormSchema, JsonValue, QuestionType } from "../types";

export type AuthoringIntent = "generate_form" | "add_questions" | "improve_text" | "generate_options" | "rewrite_field";

export type AuthoringTarget =
  | { readonly kind: "form" }
  | { readonly kind: "field"; readonly fieldId: string }
  | { readonly kind: "option"; readonly fieldId: string; readonly optionId: string };

export interface AuthoringRequest {
  readonly intent: AuthoringIntent;
  readonly prompt?: string;
  readonly target?: AuthoringTarget;
  readonly context?: Readonly<Record<string, JsonValue>>;
  /** Providers may use the schema supplied by the controller as grounding context. */
  readonly schema?: FormSchema;
}

export interface AuthoringAssistantAdapter {
  generate?: (request: AuthoringRequest, signal?: AbortSignal) => Promise<AuthoringSuggestion>;
  /** Compatibility alias for adapters that prefer an explicit method name. */
  generateSuggestion?: (request: AuthoringRequest, signal?: AbortSignal) => Promise<AuthoringSuggestion>;
}

export interface AuthoringOptionInput {
  readonly label: string;
  readonly textInput?: boolean;
  readonly pinned?: boolean;
}

/** A field proposed by AI. IDs are deliberately absent and are assigned on apply. */
export interface AuthoringFieldInput {
  readonly type: QuestionType;
  readonly title: string;
  readonly description?: string;
  readonly required?: boolean;
  readonly translationKey?: string;
  readonly messages?: FormField["messages"];
  readonly placeholderKey?: string;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly minDate?: string;
  readonly maxDate?: string;
  readonly minTime?: string;
  readonly maxTime?: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly shuffleOptions?: boolean;
  readonly minSelections?: number;
  readonly maxSelections?: number;
  readonly options?: readonly AuthoringOptionInput[];
}

export interface AddFieldOperation {
  readonly operationId: string;
  readonly type: "addField";
  readonly field: AuthoringFieldInput;
  readonly pageId?: string;
}

export type AuthoringFieldPatch = Readonly<{
  readonly title?: string;
  readonly description?: string;
  readonly required?: boolean;
  readonly placeholderKey?: string;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly minDate?: string;
  readonly maxDate?: string;
  readonly minTime?: string;
  readonly maxTime?: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly shuffleOptions?: boolean;
  readonly minSelections?: number;
  readonly maxSelections?: number;
  readonly messages?: FormField["messages"];
}>;

export interface UpdateFieldOperation {
  readonly operationId: string;
  readonly type: "updateField";
  readonly fieldId: string;
  readonly patch: AuthoringFieldPatch;
}

export interface UpdateFormOperation {
  readonly operationId: string;
  readonly type: "updateForm";
  readonly patch: Readonly<Partial<Pick<FormSchema, "title" | "description" | "completionMessage" | "submitLabelKey">>>;
}

export interface AddOptionOperation {
  readonly operationId: string;
  readonly type: "addOption";
  readonly fieldId: string;
  readonly option: AuthoringOptionInput;
}

export interface UpdateOptionOperation {
  readonly operationId: string;
  readonly type: "updateOption";
  readonly fieldId: string;
  readonly optionId: string;
  readonly patch: Readonly<Partial<Pick<FieldOption, "label" | "textInput" | "pinned">>>;
}

export type AuthoringOperation =
  | AddFieldOperation
  | UpdateFieldOperation
  | UpdateFormOperation
  | AddOptionOperation
  | UpdateOptionOperation;

export interface AuthoringSuggestion {
  readonly id: string;
  readonly summary: string;
  readonly operations: readonly AuthoringOperation[];
  readonly rationale?: string;
  readonly baseSchemaHash: string;
}

export type AuthoringValidationCode =
  | "invalid_suggestion"
  | "duplicate_operation_id"
  | "unsupported_operation"
  | "stale_schema"
  | "field_not_found"
  | "option_not_found"
  | "page_not_found"
  | "disallowed_field_type"
  | "max_fields_exceeded"
  | "max_options_exceeded"
  | "max_text_length_exceeded"
  | "schema_invalid"
  | "policy_violation";

export interface AuthoringValidationIssue {
  readonly code: AuthoringValidationCode;
  readonly operationId?: string;
  readonly path?: string;
  readonly message: string;
}

export interface AuthoringValidationResult {
  readonly valid: boolean;
  readonly issues: readonly AuthoringValidationIssue[];
}

export interface AuthoringPreview {
  readonly valid: boolean;
  readonly baseSchemaHash: string;
  readonly schema: FormSchema;
  readonly operations: readonly AuthoringOperation[];
  readonly issues: readonly AuthoringValidationIssue[];
}

export type AuthoringApplyError =
  | { readonly code: "stale_schema"; readonly issues: readonly AuthoringValidationIssue[] }
  | { readonly code: "validation_failed"; readonly issues: readonly AuthoringValidationIssue[] }
  | { readonly code: "apply_failed"; readonly issues: readonly AuthoringValidationIssue[] };

export type AuthoringApplyResult =
  | { readonly success: true; readonly schema: FormSchema; readonly appliedOperationIds: readonly string[] }
  | { readonly success: false; readonly error: AuthoringApplyError };

export interface AuthoringApplyOptions {
  readonly policy?: FormPolicy;
  readonly idFactory?: (kind: "field" | "option", existingIds: ReadonlySet<string>) => string;
}
