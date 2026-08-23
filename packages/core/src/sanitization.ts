import type { FormField, FormSchema } from "./types";

export type SchemaStructureIssueType =
  | "dangling_condition_reference"
  | "duplicate_question_id"
  | "duplicate_choice_id"
  | "self_condition_reference"
  | "cyclic_condition_reference";

export interface SchemaStructureIssue {
  readonly type: SchemaStructureIssueType;
  readonly questionId: string;
  readonly choiceId?: string;
  readonly message: string;
}

function cyclicQuestionIds(fields: readonly FormField[]): ReadonlySet<string> {
  const firstById = new Map<string, FormField>();
  for (const field of fields) {
    if (!firstById.has(field.id)) firstById.set(field.id, field);
  }
  const cyclic = new Set<string>();
  const resolved = new Set<string>();

  for (const startId of firstById.keys()) {
    if (resolved.has(startId)) continue;
    const path: string[] = [];
    const pathIndex = new Map<string, number>();
    let currentId: string | undefined = startId;
    while (currentId !== undefined && firstById.has(currentId) && !resolved.has(currentId)) {
      const existingIndex = pathIndex.get(currentId);
      if (existingIndex !== undefined) {
        for (const id of path.slice(existingIndex)) cyclic.add(id);
        break;
      }
      pathIndex.set(currentId, path.length);
      path.push(currentId);
      const field = firstById.get(currentId);
      const sourceId = field?.displayCondition?.questionId;
      currentId = sourceId === currentId ? undefined : sourceId;
    }
    for (const id of path) resolved.add(id);
  }
  return cyclic;
}

export function validateSchemaStructure(schema: FormSchema): SchemaStructureIssue[] {
  const issues: SchemaStructureIssue[] = [];
  const questionIds = new Set<string>();

  for (const field of schema.fields) {
    if (questionIds.has(field.id)) {
      issues.push({
        type: "duplicate_question_id",
        questionId: field.id,
        message: `Question ID "${field.id}" is duplicated.`
      });
    } else {
      questionIds.add(field.id);
    }
    if (!("options" in field) || !Array.isArray(field.options)) continue;
    const choiceIds = new Set<string>();
    for (const option of field.options) {
      if (choiceIds.has(option.value)) {
        issues.push({
          type: "duplicate_choice_id",
          questionId: field.id,
          choiceId: option.value,
          message: `Choice ID "${option.value}" is duplicated in question "${field.id}".`
        });
      } else {
        choiceIds.add(option.value);
      }
    }
  }

  for (const field of schema.fields) {
    const sourceId = field.displayCondition?.questionId;
    if (sourceId === undefined) continue;
    if (sourceId === field.id) {
      issues.push({
        type: "self_condition_reference",
        questionId: field.id,
        message: `Question "${field.id}" cannot depend on itself.`
      });
    } else if (!questionIds.has(sourceId)) {
      issues.push({
        type: "dangling_condition_reference",
        questionId: field.id,
        message: `Question "${field.id}" references missing question "${sourceId}".`
      });
    }
  }

  const cyclic = cyclicQuestionIds(schema.fields);
  for (const field of schema.fields) {
    if (!cyclic.has(field.id)) continue;
    issues.push({
      type: "cyclic_condition_reference",
      questionId: field.id,
      message: `Question "${field.id}" participates in a display-condition cycle.`
    });
  }
  return issues;
}

export function sanitizeSchema(schema: FormSchema): FormSchema {
  const existingQuestionIds = new Set(schema.fields.map((field) => field.id));
  const cyclic = cyclicQuestionIds(schema.fields);
  return {
    ...schema,
    fields: schema.fields.map((field) => {
      const sourceId = field.displayCondition?.questionId;
      if (
        sourceId === undefined ||
        (existingQuestionIds.has(sourceId) && sourceId !== field.id && !cyclic.has(field.id))
      ) {
        return field;
      }
      const { displayCondition: _displayCondition, ...sanitized } = field;
      return sanitized as FormField;
    })
  };
}
