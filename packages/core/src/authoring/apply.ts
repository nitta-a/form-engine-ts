import { validateFormSchema } from "../schema";
import type { FieldOption, FormField, FormSchema } from "../types";
import { computeAuthoringSchemaHash } from "./hash";
import type {
  AuthoringApplyOptions,
  AuthoringApplyResult,
  AuthoringFieldInput,
  AuthoringOperation,
  AuthoringOptionInput,
  AuthoringSuggestion
} from "./types";
import { validateAuthoringSuggestion } from "./validate";

function defaultIdFactory(kind: "field" | "option", existing: ReadonlySet<string>): string {
  let index = 1;
  let id = `${kind}-${index}`;
  while (existing.has(id)) id = `${kind}-${++index}`;
  return id;
}

const FIELD_KEYS = [
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
  "maxSelections"
] as const;
const FIELD_PATCH_KEYS = FIELD_KEYS.filter((key) => key !== "type" && key !== "translationKey") as readonly string[];
const OPTION_KEYS = ["label", "textInput", "pinned"] as const;
const FORM_PATCH_KEYS = ["title", "description", "completionMessage", "submitLabelKey"] as const;

function pick<T extends object>(value: T, keys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(
    keys.filter((key) => Object.hasOwn(value, key)).map((key) => [key, (value as Record<string, unknown>)[key]])
  );
}

function makeOption(input: AuthoringOptionInput, id: string): FieldOption {
  return { ...pick(input, OPTION_KEYS), id } as FieldOption;
}

function makeField(
  input: AuthoringFieldInput,
  id: string,
  optionIds: ReadonlySet<string>,
  idFactory: AuthoringApplyOptions["idFactory"]
): FormField {
  const options = input.options;
  const required = input.required ?? false;
  const common = { ...pick(input, FIELD_KEYS), id, required } as FormField;
  if (options === undefined || !["select", "radio", "multi-select"].includes(input.type)) return common;
  const nextOptions: FieldOption[] = [];
  const used = new Set(optionIds);
  for (const option of options) {
    const optionId = idFactory?.("option", used) ?? defaultIdFactory("option", used);
    if (!optionId.trim() || used.has(optionId)) throw new Error("Invalid option id");
    used.add(optionId);
    nextOptions.push(makeOption(option, optionId));
  }
  return { ...common, options: nextOptions } as FormField;
}

function applyOperation(schema: FormSchema, operation: AuthoringOperation, options: AuthoringApplyOptions): FormSchema {
  const idFactory = options.idFactory ?? defaultIdFactory;
  if (operation.type === "updateForm") return { ...schema, ...pick(operation.patch, FORM_PATCH_KEYS) };
  if (operation.type === "updateField") {
    return {
      ...schema,
      fields: schema.fields.map((field) =>
        field.id === operation.fieldId ? ({ ...field, ...pick(operation.patch, FIELD_PATCH_KEYS) } as FormField) : field
      )
    };
  }
  if (operation.type === "updateOption") {
    return {
      ...schema,
      fields: schema.fields.map((field) =>
        field.id === operation.fieldId && "options" in field
          ? ({
              ...field,
              options: field.options.map((option) =>
                option.id === operation.optionId ? { ...option, ...pick(operation.patch, OPTION_KEYS) } : option
              )
            } as FormField)
          : field
      )
    };
  }
  if (operation.type === "addOption") {
    const ids = new Set(
      schema.fields.flatMap((field) => ("options" in field ? field.options.map((option) => option.id) : []))
    );
    const id = idFactory("option", ids);
    if (!id.trim() || ids.has(id)) throw new Error("Invalid option id");
    const option = makeOption(operation.option, id);
    return {
      ...schema,
      fields: schema.fields.map((field) =>
        field.id === operation.fieldId && "options" in field
          ? ({ ...field, options: [...field.options, option] } as FormField)
          : field
      )
    };
  }
  const ids = new Set(schema.fields.map((field) => field.id));
  const id = idFactory("field", ids);
  if (!id.trim() || ids.has(id)) throw new Error("Invalid field id");
  const optionIds = new Set(
    schema.fields.flatMap((field) => ("options" in field ? field.options.map((option) => option.id) : []))
  );
  const field = makeField(operation.field, id, optionIds, options.idFactory);
  const pages = schema.pages?.map((page, index, allPages) =>
    page.id === operation.pageId || (operation.pageId === undefined && index === allPages.length - 1)
      ? { ...page, questionIds: [...page.questionIds, id] }
      : page
  );
  return { ...schema, fields: [...schema.fields, field], ...(pages === undefined ? {} : { pages }) };
}

export function applyAuthoringSuggestion(
  schema: FormSchema,
  suggestion: AuthoringSuggestion,
  selectedOperationIds?: readonly string[],
  options: AuthoringApplyOptions = {}
): AuthoringApplyResult {
  const currentHash = computeAuthoringSchemaHash(schema);
  if (suggestion.baseSchemaHash !== currentHash)
    return {
      success: false,
      error: {
        code: "stale_schema",
        issues: [{ code: "stale_schema", message: "The schema changed after this suggestion was generated." }]
      }
    };
  const selected =
    selectedOperationIds === undefined
      ? suggestion.operations
      : suggestion.operations.filter((operation) => selectedOperationIds.includes(operation.operationId));
  const validation = validateAuthoringSuggestion({ ...suggestion, operations: selected }, schema, options.policy);
  if (!validation.valid) return { success: false, error: { code: "validation_failed", issues: validation.issues } };
  try {
    let next = schema;
    for (const operation of selected) next = applyOperation(next, operation, options);
    const result = validateFormSchema(next, options.policy === undefined ? {} : { policy: options.policy });
    if (!result.valid)
      return {
        success: false,
        error: {
          code: "apply_failed",
          issues: result.issues.map((issue) => ({ code: "schema_invalid", path: issue.path, message: issue.message }))
        }
      };
    return { success: true, schema: next, appliedOperationIds: selected.map((operation) => operation.operationId) };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "apply_failed",
        issues: [
          { code: "schema_invalid", message: error instanceof Error ? error.message : "Unable to apply suggestion." }
        ]
      }
    };
  }
}
