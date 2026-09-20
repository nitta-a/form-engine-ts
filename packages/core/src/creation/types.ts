import type { AuthoringRequest, AuthoringSuggestion } from "../authoring/types";
import type { FormContentMode } from "../contentMode";
import type { FormPolicy, JsonValue } from "../types";

export interface SurveyCreationBrief {
  readonly purpose?: string;
  readonly audience?: string;
  readonly goals?: readonly string[];
  readonly constraints?: {
    readonly targetQuestionCount?: number;
    readonly targetDurationMinutes?: number;
    readonly anonymous?: boolean;
    readonly tone?: "formal" | "neutral" | "casual";
  };
  readonly locale?: string;
  readonly contentMode?: FormContentMode;
  readonly notes?: readonly string[];
}

export type CreationBriefField = "purpose" | "audience" | "goals" | "constraints" | "locale" | "contentMode";

export interface CreationQuickReply {
  readonly id: string;
  readonly label: string;
  readonly value: string;
}

export interface CreationMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

export interface CreationAssistantRequest {
  readonly latestMessage: string;
  readonly brief: SurveyCreationBrief;
  readonly messages?: readonly CreationMessage[];
  readonly policy?: FormPolicy;
  readonly locale?: string;
  readonly contentMode?: FormContentMode;
  readonly appConstraints?: Readonly<Record<string, JsonValue>>;
}

export interface CreationClarificationResponse {
  readonly type: "clarification";
  readonly message: string;
  readonly brief: SurveyCreationBrief;
  readonly missing: readonly CreationBriefField[];
  readonly suggestions?: readonly CreationQuickReply[];
}

export interface CreationReadyResponse {
  readonly type: "ready";
  readonly message: string;
  readonly brief: SurveyCreationBrief;
}

export type CreationAssistantResponse = CreationClarificationResponse | CreationReadyResponse;

export interface CreationAssistantAdapter {
  respond: (request: CreationAssistantRequest, signal?: AbortSignal) => Promise<unknown>;
}

export interface CreationBriefReadiness {
  readonly ready: boolean;
  readonly missing: readonly CreationBriefField[];
}

export interface CreationAuthoringRequestOptions {
  readonly brief: SurveyCreationBrief;
  readonly prompt?: string;
  readonly target?: AuthoringRequest["target"];
}

export type CreationDraftResult =
  | { readonly success: true; readonly suggestion: AuthoringSuggestion }
  | { readonly success: false; readonly error: unknown };
