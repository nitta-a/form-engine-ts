import type { FormPolicy, FormSchema } from "../types";
import { applyAuthoringSuggestion } from "./apply";
import { computeAuthoringSchemaHash } from "./hash";
import type {
  AuthoringOperation,
  AuthoringOperationPreview,
  AuthoringPreview,
  AuthoringPreviewOptions,
  AuthoringPreviewValue,
  AuthoringSuggestion,
  AuthoringValidationIssue,
  AuthoringValidationResult
} from "./types";

const choiceTypes = new Set(["select", "radio", "multi-select"]);
const textKeys = new Set(["title", "description", "label"]);
const operationTypes = new Set(["addField", "updateField", "updateForm", "addOption", "updateOption"]);
const operationKeys = {
  addField: new Set(["operationId", "type", "field", "pageId"]),
  updateField: new Set(["operationId", "type", "fieldId", "patch"]),
  updateForm: new Set(["operationId", "type", "patch"]),
  addOption: new Set(["operationId", "type", "fieldId", "option"]),
  updateOption: new Set(["operationId", "type", "fieldId", "optionId", "patch"])
} as const;
const fieldKeys = new Set([
  "type",
  "title",
  "description",
  "required",
  "translationKey",
  "messages",
  "placeholderKey",
  "minLength",
  "maxLength",
  "pattern",
  "minDate",
  "maxDate",
  "minTime",
  "maxTime",
  "min",
  "max",
  "step",
  "shuffleOptions",
  "minSelections",
  "maxSelections",
  "options"
]);
const fieldPatchKeys = new Set(
  [...fieldKeys].filter((key) => key !== "type" && key !== "translationKey" && key !== "options")
);
const optionKeys = new Set(["label", "textInput", "pinned"]);
const formPatchKeys = new Set(["title", "description", "completionMessage", "submitLabelKey"]);

function issue(
  code: AuthoringValidationIssue["code"],
  message: string,
  operationId?: string,
  path?: string
): AuthoringValidationIssue {
  return {
    code,
    message,
    ...(operationId === undefined ? {} : { operationId }),
    ...(path === undefined ? {} : { path })
  };
}

function textIssues(
  value: unknown,
  policy: FormPolicy | undefined,
  operationId: string,
  path: string
): AuthoringValidationIssue[] {
  return policy?.maxTextLength !== undefined && typeof value === "string" && value.length > policy.maxTextLength
    ? [
        issue(
          "max_text_length_exceeded",
          `Text exceeds the maximum length of ${policy.maxTextLength}.`,
          operationId,
          path
        )
      ]
    : [];
}

function unknownKeys(
  value: unknown,
  allowed: ReadonlySet<string>,
  operationId: string,
  path: string
): AuthoringValidationIssue[] {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return [issue("invalid_suggestion", "The proposed value must be an object.", operationId, path)];
  return Object.keys(value)
    .filter((key) => !allowed.has(key))
    .map((key) => issue("unsupported_operation", `Property ${key} is not allowed.`, operationId, `${path}.${key}`));
}

function operationIssues(
  schema: FormSchema,
  operation: AuthoringOperation,
  policy?: FormPolicy
): AuthoringValidationIssue[] {
  const issues: AuthoringValidationIssue[] = [];
  if (operation.type === "addField") {
    issues.push(...unknownKeys(operation.field, fieldKeys, operation.operationId, "field"));
    for (const [index, option] of (operation.field.options ?? []).entries())
      issues.push(...unknownKeys(option, optionKeys, operation.operationId, `field.options[${index}]`));
    if (policy?.allowedFieldTypes !== undefined && !policy.allowedFieldTypes.includes(operation.field.type))
      issues.push(
        issue(
          "disallowed_field_type",
          `Field type ${operation.field.type} is not allowed.`,
          operation.operationId,
          "field.type"
        )
      );
    for (const property of ["title", "description"] as const)
      issues.push(...textIssues(operation.field[property], policy, operation.operationId, `field.${property}`));
    if (policy?.maxFields !== undefined && schema.fields.length >= policy.maxFields)
      issues.push(
        issue("max_fields_exceeded", `The form allows at most ${policy.maxFields} fields.`, operation.operationId)
      );
    if (operation.pageId !== undefined && !schema.pages?.some((page) => page.id === operation.pageId))
      issues.push(issue("page_not_found", `Page ${operation.pageId} was not found.`, operation.operationId));
    if (choiceTypes.has(operation.field.type)) {
      const count = operation.field.options?.length ?? 0;
      if (policy?.maxOptionsPerField !== undefined && count > policy.maxOptionsPerField)
        issues.push(
          issue(
            "max_options_exceeded",
            `The field allows at most ${policy.maxOptionsPerField} options.`,
            operation.operationId,
            "field.options"
          )
        );
      for (const [index, option] of (operation.field.options ?? []).entries())
        issues.push(...textIssues(option.label, policy, operation.operationId, `field.options[${index}].label`));
    }
    const constraint = policy?.fieldConstraints?.[operation.field.type];
    if (constraint?.fixedRequired !== undefined && (operation.field.required ?? false) !== constraint.fixedRequired)
      issues.push(
        issue(
          "policy_violation",
          "The field required state is fixed by policy.",
          operation.operationId,
          "field.required"
        )
      );
    if (
      (operation.field.type === "text" || operation.field.type === "textarea") &&
      constraint !== undefined &&
      "maxMaxLength" in constraint &&
      constraint.maxMaxLength !== undefined &&
      operation.field.maxLength !== undefined &&
      operation.field.maxLength > constraint.maxMaxLength
    )
      issues.push(
        issue("policy_violation", "The text length exceeds the field policy.", operation.operationId, "field.maxLength")
      );
    if (
      choiceTypes.has(operation.field.type) &&
      constraint !== undefined &&
      "minOptions" in constraint &&
      constraint.minOptions !== undefined &&
      (operation.field.options?.length ?? 0) < constraint.minOptions
    )
      issues.push(
        issue(
          "policy_violation",
          "The field does not contain enough options for the field policy.",
          operation.operationId,
          "field.options"
        )
      );
    if (
      choiceTypes.has(operation.field.type) &&
      constraint !== undefined &&
      "maxOptions" in constraint &&
      constraint.maxOptions !== undefined &&
      (operation.field.options?.length ?? 0) > constraint.maxOptions
    )
      issues.push(
        issue(
          "policy_violation",
          "The field contains too many options for the field policy.",
          operation.operationId,
          "field.options"
        )
      );
  } else if (operation.type === "updateField") {
    issues.push(...unknownKeys(operation.patch, fieldPatchKeys, operation.operationId, "patch"));
    const field = schema.fields.find((candidate) => candidate.id === operation.fieldId);
    if (field === undefined)
      issues.push(
        issue("field_not_found", `Field ${operation.fieldId} was not found.`, operation.operationId, "fieldId")
      );
    for (const [key, value] of Object.entries(operation.patch))
      if (textKeys.has(key)) issues.push(...textIssues(value, policy, operation.operationId, `patch.${key}`));
    const constraint = field === undefined ? undefined : policy?.fieldConstraints?.[field.type];
    if (
      constraint?.fixedRequired !== undefined &&
      operation.patch.required !== undefined &&
      operation.patch.required !== constraint.fixedRequired
    )
      issues.push(
        issue(
          "policy_violation",
          "The field required state is fixed by policy.",
          operation.operationId,
          "patch.required"
        )
      );
  } else if (operation.type === "updateForm") {
    issues.push(...unknownKeys(operation.patch, formPatchKeys, operation.operationId, "patch"));
    for (const [key, value] of Object.entries(operation.patch))
      if (textKeys.has(key) || key === "completionMessage")
        issues.push(...textIssues(value, policy, operation.operationId, `patch.${key}`));
  } else {
    if (operation.type === "addOption")
      issues.push(...unknownKeys(operation.option, optionKeys, operation.operationId, "option"));
    else issues.push(...unknownKeys(operation.patch, optionKeys, operation.operationId, "patch"));
    const field = schema.fields.find((candidate) => candidate.id === operation.fieldId);
    if (field === undefined)
      issues.push(
        issue("field_not_found", `Field ${operation.fieldId} was not found.`, operation.operationId, "fieldId")
      );
    else if (!("options" in field))
      issues.push(
        issue("policy_violation", `Field ${operation.fieldId} does not support options.`, operation.operationId)
      );
    if (
      operation.type === "updateOption" &&
      field !== undefined &&
      "options" in field &&
      !field.options.some((option) => option.id === operation.optionId)
    )
      issues.push(
        issue("option_not_found", `Option ${operation.optionId} was not found.`, operation.operationId, "optionId")
      );
    if (
      operation.type === "addOption" &&
      policy?.maxOptionsPerField !== undefined &&
      field !== undefined &&
      "options" in field &&
      field.options.length >= policy.maxOptionsPerField
    )
      issues.push(
        issue(
          "max_options_exceeded",
          `The field allows at most ${policy.maxOptionsPerField} options.`,
          operation.operationId
        )
      );
    const label = operation.type === "addOption" ? operation.option.label : operation.patch.label;
    issues.push(...textIssues(label, policy, operation.operationId, "option.label"));
  }
  return issues;
}

export function validateAuthoringSuggestion(
  suggestion: AuthoringSuggestion,
  schema: FormSchema,
  policy?: FormPolicy
): AuthoringValidationResult {
  const issues: AuthoringValidationIssue[] = [];
  if (suggestion === null || typeof suggestion !== "object" || !Array.isArray(suggestion.operations))
    return { valid: false, issues: [issue("invalid_suggestion", "The suggestion response is not valid.")] };
  if (typeof suggestion.id !== "string" || suggestion.id.trim().length === 0)
    issues.push(issue("invalid_suggestion", "The suggestion must have a non-empty id."));
  if (typeof suggestion.summary !== "string")
    issues.push(issue("invalid_suggestion", "The suggestion must have a summary."));
  if (typeof suggestion.baseSchemaHash !== "string")
    issues.push(issue("invalid_suggestion", "The suggestion must have a schema hash."));
  else if (suggestion.baseSchemaHash !== computeAuthoringSchemaHash(schema))
    issues.push(issue("stale_schema", "The schema changed after this suggestion was generated."));
  const ids = new Set<string>();
  let fieldCount = schema.fields.length;
  const optionCounts = new Map(
    schema.fields.filter((field) => "options" in field).map((field) => [field.id, field.options.length])
  );
  for (const operation of suggestion.operations) {
    if (operation === null || typeof operation !== "object") {
      issues.push(issue("invalid_suggestion", "An operation must be an object."));
      continue;
    }
    if (typeof operation.operationId !== "string" || operation.operationId.trim().length === 0) {
      issues.push(issue("invalid_suggestion", "Every operation must have a non-empty operationId."));
      continue;
    }
    if (!operationTypes.has(operation.type)) {
      issues.push(
        issue("unsupported_operation", `Operation ${String(operation.type)} is not supported.`, operation.operationId)
      );
      continue;
    }
    const operationType = operation.type as keyof typeof operationKeys;
    issues.push(...unknownKeys(operation, operationKeys[operationType], operation.operationId, "operation"));
    if (operation.type === "addField" && (operation.field === null || typeof operation.field !== "object")) {
      issues.push(issue("invalid_suggestion", "addField requires a field object.", operation.operationId, "field"));
      continue;
    }
    if (
      operation.type === "addField" &&
      operation.field.options !== undefined &&
      !Array.isArray(operation.field.options)
    ) {
      issues.push(
        issue("invalid_suggestion", "addField options must be an array.", operation.operationId, "field.options")
      );
      continue;
    }
    if (
      (operation.type === "addOption" && (operation.option === null || typeof operation.option !== "object")) ||
      (operation.type === "updateField" && (operation.patch === null || typeof operation.patch !== "object")) ||
      (operation.type === "updateForm" && (operation.patch === null || typeof operation.patch !== "object")) ||
      (operation.type === "updateOption" && (operation.patch === null || typeof operation.patch !== "object"))
    ) {
      issues.push(
        issue("invalid_suggestion", `${operation.type} requires a patch or option object.`, operation.operationId)
      );
      continue;
    }
    if (ids.has(operation.operationId))
      issues.push(
        issue("duplicate_operation_id", `Duplicate operation ID ${operation.operationId}.`, operation.operationId)
      );
    ids.add(operation.operationId);
    issues.push(...operationIssues(schema, operation, policy));
    if (operation.type === "addField") {
      fieldCount += 1;
      if (policy?.maxFields !== undefined && fieldCount > policy.maxFields)
        issues.push(
          issue("max_fields_exceeded", `The form allows at most ${policy.maxFields} fields.`, operation.operationId)
        );
    }
    if (operation.type === "addOption") {
      const nextCount = (optionCounts.get(operation.fieldId) ?? 0) + 1;
      optionCounts.set(operation.fieldId, nextCount);
      if (policy?.maxOptionsPerField !== undefined && nextCount > policy.maxOptionsPerField)
        issues.push(
          issue(
            "max_options_exceeded",
            `The field allows at most ${policy.maxOptionsPerField} options.`,
            operation.operationId
          )
        );
    }
  }
  if (issues.some((item) => item.code === "stale_schema")) return { valid: false, issues };
  return { valid: issues.length === 0, issues };
}

export function previewAuthoringSuggestion(
  schema: FormSchema,
  suggestion: AuthoringSuggestion,
  options: AuthoringPreviewOptions = {}
): AuthoringPreview {
  const { operationIds: selectedOperationIds, policy: resolvedPolicy, idFactory } = options;
  const selected =
    selectedOperationIds === undefined
      ? suggestion.operations
      : suggestion.operations.filter((operation) => selectedOperationIds.includes(operation.operationId));
  const selectedSuggestion = { ...suggestion, operations: selected };
  const validation = validateAuthoringSuggestion(selectedSuggestion, schema, resolvedPolicy);
  const applied = validation.valid
    ? applyAuthoringSuggestion(schema, selectedSuggestion, undefined, {
        ...(resolvedPolicy === undefined ? {} : { policy: resolvedPolicy }),
        ...(idFactory === undefined ? {} : { idFactory })
      })
    : undefined;
  const issues = applied !== undefined && !applied.success ? applied.error.issues : validation.issues;
  const operationPreviews = suggestion.operations.map((operation) => {
    const isSelected = selected.some((candidate) => candidate.operationId === operation.operationId);
    const operationValidation = isSelected
      ? validation
      : validateAuthoringSuggestion({ ...suggestion, operations: [operation] }, schema, resolvedPolicy);
    const operationIssues = operationValidation.issues.filter((item) => item.operationId === operation.operationId);
    const commonIssues = operationValidation.issues.filter((item) => item.operationId === undefined);
    const preview = operationPreview(schema, operation);
    return {
      operationId: operation.operationId,
      operation,
      valid: operationIssues.length === 0 && commonIssues.length === 0,
      ...(preview.before === undefined ? {} : { before: preview.before }),
      ...(preview.after === undefined ? {} : { after: preview.after }),
      issues: [...commonIssues, ...operationIssues]
    } satisfies AuthoringOperationPreview;
  });
  return {
    valid: validation.valid && (applied === undefined || applied.success),
    baseSchemaHash: suggestion.baseSchemaHash,
    schema: applied?.success ? applied.schema : schema,
    operations: selected,
    operationPreviews,
    issues
  };
}

function operationPreview(
  schema: FormSchema,
  operation: AuthoringOperation
): { readonly before?: AuthoringPreviewValue; readonly after?: AuthoringPreviewValue } {
  if (operation.type === "addField") return { after: { kind: "field", field: operation.field } };
  if (operation.type === "updateForm") {
    const before = { kind: "form", ...schema } satisfies AuthoringPreviewValue;
    return { before, after: { kind: "form", ...schema, ...operation.patch } };
  }
  const field = schema.fields.find((candidate) => candidate.id === operation.fieldId);
  if (operation.type === "addOption") return { after: { kind: "option", option: operation.option } };
  if (field === undefined) return {};
  if (operation.type === "updateField")
    return {
      before: { kind: "field", field },
      after: { kind: "field", field: { ...field, ...operation.patch } as typeof field }
    };
  if (!("options" in field)) return {};
  const option = field.options.find((candidate) => candidate.id === operation.optionId);
  return {
    ...(option === undefined ? {} : { before: { kind: "option", option } }),
    ...(option === undefined ? {} : { after: { kind: "option", option: { ...option, ...operation.patch } } })
  };
}
