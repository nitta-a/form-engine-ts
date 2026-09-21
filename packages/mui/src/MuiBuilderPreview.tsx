import type { FormPolicy, FormSchema, FormValues, TranslationAdapter } from "@form-engine-ts/core";
import type { SubmissionAttemptStore } from "@form-engine-ts/react";
import { MuiContentRenderer, type MuiContentRendererProps } from "./MuiContentRenderer";

export type MuiBuilderPreviewProps = Omit<
  MuiContentRendererProps,
  | "schema"
  | "onSubmit"
  | "autoSaveKey"
  | "receiptStore"
  | "attemptStore"
  | "onDraftSave"
  | "draftResume"
  | "controller"
  | "submissionController"
  | "submissionMetadata"
  | "submissionIdentity"
  | "submissionScope"
  | "onReceiptError"
  | "telemetry"
  | "submissionGuards"
  | "beforeSubmit"
  | "challengeToken"
  | "clientKey"
> & {
  readonly schema: FormSchema;
  readonly locale?: string;
  readonly translator?: TranslationAdapter;
  readonly policy?: FormPolicy;
  readonly initialValues?: FormValues;
  readonly resetOnSuccess?: boolean;
};

const previewSubmit = async () => undefined;
const previewAttemptStore: SubmissionAttemptStore = {
  getOrCreate: async (formId, formVersion) => ({
    attemptId: `preview-${formId}-${formVersion}`,
    formId,
    formVersion,
    createdAt: "1970-01-01T00:00:00.000Z"
  }),
  get: async () => null,
  clear: async () => undefined
};

export function MuiBuilderPreview({ schema, resetOnSuccess = false, ...props }: MuiBuilderPreviewProps) {
  return (
    <div data-mui-slot="builder-preview">
      <MuiContentRenderer
        {...props}
        schema={schema}
        attemptStore={previewAttemptStore}
        optionOrderSeed="preview"
        onSubmit={previewSubmit}
        resetOnSuccess={resetOnSuccess}
      />
    </div>
  );
}
