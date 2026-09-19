import { getFormContentMode } from "../contentMode";
import type { FormPolicy, FormSchema, JsonValue } from "../types";
import { computeAuthoringSchemaHash } from "./hash";
import type { AuthoringRequest } from "./types";

export interface BuildAuthoringContextOptions {
  readonly schema: FormSchema;
  readonly request: AuthoringRequest;
  readonly policy?: FormPolicy;
}

export interface AuthoringContext extends Readonly<Record<string, JsonValue>> {
  readonly fields: readonly JsonValue[];
}

function fieldContext(field: FormSchema["fields"][number]): JsonValue {
  return {
    id: field.id,
    type: field.type,
    title: field.title,
    ...(field.description === undefined ? {} : { description: field.description }),
    required: field.required,
    ...("options" in field ? { options: field.options.map((option) => ({ id: option.id, label: option.label })) } : {})
  };
}

function policyContext(policy: FormPolicy | undefined): JsonValue | undefined {
  if (policy === undefined) return undefined;
  const contentMode = policy.contentMode;
  return {
    ...(contentMode?.minFields === undefined ? {} : { minFields: contentMode.minFields }),
    ...(contentMode?.maxFields === undefined ? {} : { maxFields: contentMode.maxFields }),
    ...(contentMode?.minOptionsPerField === undefined ? {} : { minOptionsPerField: contentMode.minOptionsPerField }),
    ...(contentMode?.maxOptionsPerField === undefined ? {} : { maxOptionsPerField: contentMode.maxOptionsPerField }),
    ...(policy.allowedFieldTypes === undefined ? {} : { allowedFieldTypes: policy.allowedFieldTypes }),
    ...(policy.maxFields === undefined ? {} : { maxFields: policy.maxFields }),
    ...(policy.maxOptionsPerField === undefined ? {} : { maxOptionsPerField: policy.maxOptionsPerField }),
    ...(policy.requiredLocales === undefined ? {} : { requiredLocales: policy.requiredLocales }),
    ...(policy.allowedLocales === undefined ? {} : { allowedLocales: policy.allowedLocales }),
    ...(policy.maxLocales === undefined ? {} : { maxLocales: policy.maxLocales }),
    ...(policy.maxTextLength === undefined ? {} : { maxTextLength: policy.maxTextLength }),
    ...(policy.maxSchemaBytes === undefined ? {} : { maxSchemaBytes: policy.maxSchemaBytes })
  };
}

export function buildAuthoringContext({ schema, request, policy }: BuildAuthoringContextOptions): AuthoringContext {
  const targetFieldId =
    request.target?.kind === "field" || request.target?.kind === "option" ? request.target.fieldId : undefined;
  const targetIndex =
    targetFieldId === undefined ? undefined : schema.fields.findIndex((field) => field.id === targetFieldId);
  const fields =
    targetIndex === undefined || targetIndex < 0
      ? schema.fields
      : schema.fields.slice(Math.max(0, targetIndex - 1), Math.min(schema.fields.length, targetIndex + 2));
  const resolvedPolicy = policyContext(policy);
  return {
    intent: request.intent,
    schemaHash: computeAuthoringSchemaHash(schema),
    form: {
      id: schema.id,
      title: schema.title,
      ...(schema.description === undefined ? {} : { description: schema.description }),
      fieldCount: schema.fields.length,
      ...(schema.defaultLocale === undefined ? {} : { defaultLocale: schema.defaultLocale }),
      ...(schema.supportedLocales === undefined ? {} : { supportedLocales: schema.supportedLocales }),
      contentMode: getFormContentMode(schema.metadata)
    },
    fields: fields.map(fieldContext),
    ...(resolvedPolicy === undefined ? {} : { policy: resolvedPolicy }),
    ...(request.target === undefined ? {} : { target: request.target }),
    ...(request.context === undefined ? {} : { requestContext: request.context })
  };
}
