import type { DisplayCondition, FormField, FormSchema, FormValues } from "./types";

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
  return typeof left === "string" && typeof right === "string"
    ? normalizeString(left) === normalizeString(right)
    : left === right;
}

export function isQuestionVisible(question: FormField, currentAnswers: Readonly<Record<string, unknown>>): boolean {
  return isDisplayConditionSatisfied(question.displayCondition, currentAnswers);
}

export function isDisplayConditionSatisfied(
  condition: DisplayCondition | undefined,
  currentAnswers: Readonly<Record<string, unknown>>
): boolean {
  if (condition === undefined) return true;
  const answer = currentAnswers[condition.questionId];
  if (isEmpty(answer)) return false;

  if (condition.operator === "not_empty") return true;
  if (condition.value === undefined) return false;
  if (condition.operator === "equals") return valuesEqual(answer, condition.value);
  if (condition.operator === "not_equals") return !valuesEqual(answer, condition.value);
  if (typeof answer === "string" && typeof condition.value === "string") {
    return normalizeString(answer).includes(normalizeString(condition.value));
  }
  return Array.isArray(answer) && answer.some((item) => valuesEqual(item, condition.value));
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
    const sourceId = field.displayCondition?.questionId;
    const source = sourceId === undefined ? undefined : fields.get(sourceId);
    const sourceVisible = source === undefined ? sourceId === undefined : resolve(source);
    const visible = sourceVisible && isQuestionVisible(field, currentAnswers);
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
