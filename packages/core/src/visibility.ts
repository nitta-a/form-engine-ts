import type { FormField, FormSchema, FormValues } from "./types";

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
  const condition = question.displayCondition;
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

export function calculateFieldVisibility(
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
  return Object.freeze(Object.fromEntries(resolved));
}

export function selectVisibleAnswers(schema: FormSchema, currentAnswers: FormValues): FormValues {
  const visibility = calculateFieldVisibility(schema, currentAnswers);
  return Object.fromEntries(
    schema.fields
      .filter((field) => visibility[field.id] === true && Object.hasOwn(currentAnswers, field.id))
      .map((field) => [field.id, currentAnswers[field.id]])
  );
}
