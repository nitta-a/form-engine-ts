import type {
  DisplayCondition,
  DisplayConditionGroup,
  FieldDisplayCondition,
  FormField,
  FormSchema,
  FormValues
} from "./types";

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "number") return !Number.isFinite(value);
  return false;
}

function normalizeString(value: string): string {
  return value.trim().normalize("NFKC").toLowerCase();
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (typeof left === "string" && typeof right === "string") return normalizeString(left) === normalizeString(right);
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => valuesEqual(item, right[index]));
  }
  return left === right;
}

function evaluateFieldCondition(
  condition: DisplayCondition | FieldDisplayCondition,
  currentAnswers: Readonly<Record<string, unknown>>
): boolean {
  const sourceId = "fieldId" in condition ? condition.fieldId : condition.questionId;
  const answer = currentAnswers[sourceId];
  if (isEmpty(answer) && ["equals", "not_equals", "contains"].includes(condition.operator)) return false;
  if (condition.operator === "is_empty") return isEmpty(answer);
  if (condition.operator === "is_not_empty" || condition.operator === "not_empty") return !isEmpty(answer);
  if (condition.operator === "contains" || condition.operator === "not_contains") {
    const contains =
      typeof answer === "string" && typeof condition.value === "string"
        ? normalizeString(answer).includes(normalizeString(condition.value))
        : Array.isArray(answer) && answer.some((item) => valuesEqual(item, condition.value));
    return condition.operator === "not_contains" ? !contains : contains;
  }
  if (condition.value === undefined) return false;
  if (condition.operator === "equals") return valuesEqual(answer, condition.value);
  if (condition.operator === "not_equals") return !valuesEqual(answer, condition.value);
  if (condition.operator === "greater_than")
    return typeof answer === "number" && typeof condition.value === "number" && answer > condition.value;
  if (condition.operator === "less_than")
    return typeof answer === "number" && typeof condition.value === "number" && answer < condition.value;
  return false;
}

export function isDisplayConditionGroupSatisfied(
  group: DisplayConditionGroup,
  currentAnswers: Readonly<Record<string, unknown>>
): boolean {
  const results = group.conditions.map((condition) =>
    "logic" in condition
      ? isDisplayConditionGroupSatisfied(condition, currentAnswers)
      : evaluateFieldCondition(condition, currentAnswers)
  );
  return group.logic === "all" ? results.every(Boolean) : results.some(Boolean);
}

export function isQuestionVisible(question: FormField, currentAnswers: Readonly<Record<string, unknown>>): boolean {
  if (question.displayRule !== undefined) {
    const satisfied = isDisplayConditionGroupSatisfied(question.displayRule.condition, currentAnswers);
    return question.displayRule.action === "hide" ? !satisfied : satisfied;
  }
  return isDisplayConditionSatisfied(question.displayCondition, currentAnswers);
}

export function isDisplayConditionSatisfied(
  condition: DisplayCondition | undefined,
  currentAnswers: Readonly<Record<string, unknown>>
): boolean;
export function isDisplayConditionSatisfied(
  condition: DisplayCondition | FieldDisplayCondition | DisplayConditionGroup | undefined,
  currentAnswers: Readonly<Record<string, unknown>>
): boolean {
  if (condition === undefined) return true;
  if ("logic" in condition) return isDisplayConditionGroupSatisfied(condition, currentAnswers);
  return evaluateFieldCondition(condition, currentAnswers);
}

function conditionSourceIds(
  condition: DisplayCondition | { readonly condition: DisplayConditionGroup } | undefined
): readonly string[] {
  if (condition === undefined) return [];
  if ("questionId" in condition) return [condition.questionId];
  const ids: string[] = [];
  const visit = (group: DisplayConditionGroup): void => {
    for (const item of group.conditions) {
      if ("logic" in item) visit(item);
      else ids.push(item.fieldId);
    }
  };
  visit(condition.condition);
  return ids;
}

function calculateBaseFieldVisibility(
  schema: FormSchema,
  currentAnswers: Readonly<Record<string, unknown>>
): Readonly<Record<string, boolean>> {
  const fields = new Map(schema.fields.map((field) => [field.id, field]));
  const resolved = new Map<string, boolean>();
  const resolving = new Set<string>();
  const resolve = (field: FormField): boolean => {
    const existing = resolved.get(field.id);
    if (existing !== undefined) return existing;
    if (resolving.has(field.id)) return false;
    resolving.add(field.id);
    const sources =
      field.displayRule === undefined
        ? conditionSourceIds(field.displayCondition)
        : conditionSourceIds(field.displayRule);
    const sourcesVisible = sources.every((sourceId) => {
      const source = fields.get(sourceId);
      return source !== undefined && source.id !== field.id && resolve(source);
    });
    const visible = sourcesVisible && isQuestionVisible(field, currentAnswers);
    resolving.delete(field.id);
    resolved.set(field.id, visible);
    return visible;
  };
  for (const field of schema.fields) resolve(field);
  return Object.fromEntries(resolved);
}

export function calculatePageVisibility(
  schema: FormSchema,
  currentAnswers: Readonly<Record<string, unknown>>
): Readonly<Record<string, boolean>> {
  if (schema.pages === undefined || schema.pages.length === 0) return {};
  const baseFieldVisibility = calculateBaseFieldVisibility(schema, currentAnswers);
  const pageByQuestion = new Map(schema.pages.flatMap((page) => page.questionIds.map((id) => [id, page.id] as const)));
  const pageVisibility: Record<string, boolean> = {};
  for (const page of schema.pages) {
    const sourceId = page.displayCondition?.questionId;
    const sourcePageId = sourceId === undefined ? undefined : pageByQuestion.get(sourceId);
    const sourceVisible =
      sourceId === undefined ||
      (baseFieldVisibility[sourceId] === true && sourcePageId !== undefined && pageVisibility[sourcePageId] === true);
    pageVisibility[page.id] = sourceVisible && isDisplayConditionSatisfied(page.displayCondition, currentAnswers);
  }
  return Object.freeze(pageVisibility);
}

export function calculateFieldVisibility(
  schema: FormSchema,
  currentAnswers: Readonly<Record<string, unknown>>
): Readonly<Record<string, boolean>> {
  const baseVisibility = calculateBaseFieldVisibility(schema, currentAnswers);
  if (schema.pages === undefined || schema.pages.length === 0) return Object.freeze(baseVisibility);
  const pageVisibility = calculatePageVisibility(schema, currentAnswers);
  const pageByQuestion = new Map(schema.pages.flatMap((page) => page.questionIds.map((id) => [id, page.id] as const)));
  return Object.freeze(
    Object.fromEntries(
      schema.fields.map((field) => {
        const pageId = pageByQuestion.get(field.id);
        return [field.id, baseVisibility[field.id] === true && pageId !== undefined && pageVisibility[pageId] === true];
      })
    )
  );
}

export function selectVisibleAnswers(schema: FormSchema, currentAnswers: FormValues): FormValues {
  const visibility = calculateFieldVisibility(schema, currentAnswers);
  return Object.fromEntries(
    schema.fields
      .filter((field) => visibility[field.id] === true && Object.hasOwn(currentAnswers, field.id))
      .map((field) => [field.id, currentAnswers[field.id]])
  );
}
