import type { FormPolicy, FormSchema, FormValues, TranslationAdapter } from "@form-engine-ts/core";
import type { FormSubmitHandler } from "@form-engine-ts/react";
import { MuiContentRenderer, type MuiContentRendererProps } from "./MuiContentRenderer";

export type MuiBuilderPreviewProps = Omit<MuiContentRendererProps, "schema" | "onSubmit" | "autoSaveKey"> & {
  readonly schema: FormSchema;
  readonly locale?: string;
  readonly translator?: TranslationAdapter;
  readonly policy?: FormPolicy;
  readonly initialValues?: FormValues;
  readonly onSubmit?: FormSubmitHandler;
  readonly resetOnSuccess?: boolean;
};

const previewSubmit: FormSubmitHandler = async () => undefined;

export function MuiBuilderPreview({
  schema,
  onSubmit = previewSubmit,
  resetOnSuccess = false,
  ...props
}: MuiBuilderPreviewProps) {
  return (
    <div data-mui-slot="builder-preview">
      <MuiContentRenderer {...props} schema={schema} onSubmit={onSubmit} resetOnSuccess={resetOnSuccess} />
    </div>
  );
}
