import type {
  DisplayConditionGroup,
  ExtensibleNode,
  FieldOption,
  FormField,
  FormPage,
  FormPolicy,
  FormSchema
} from "./types";

export interface SanitizeSchemaOptions {
  readonly policy?: FormPolicy;
}

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
  readonly cycle?: readonly string[];
}

function displayRuleSourceIds(field: FormField): readonly string[] {
  if (field.displayRule === undefined)
    return field.displayCondition?.questionId === undefined ? [] : [field.displayCondition.questionId];
  const ids: string[] = [];
  const visit = (group: DisplayConditionGroup): void => {
    for (const condition of group.conditions) {
      if ("logic" in condition) visit(condition);
      else ids.push(condition.fieldId);
    }
  };
  visit(field.displayRule.condition);
  return ids;
}

function registeredEntries<T>(
  value: Readonly<Record<string, T>> | undefined,
  registeredLocales: ReadonlySet<string>
): Readonly<Record<string, T>> | undefined {
  if (value === undefined) return undefined;
  const entries = Object.entries(value).filter(([locale]) => registeredLocales.has(locale));
  return entries.length === 0 ? undefined : Object.fromEntries(entries);
}

function sanitizeNodeLocales<T extends ExtensibleNode>(node: T, registeredLocales: ReadonlySet<string>): T {
  const { translationMetadata: _translationMetadata, ...base } = node;
  const translationMetadata = registeredEntries(node.translationMetadata, registeredLocales);
  return {
    ...base,
    ...(translationMetadata === undefined ? {} : { translationMetadata })
  } as T;
}

function sanitizeOptionLocales(option: FieldOption, registeredLocales: ReadonlySet<string>): FieldOption {
  const { translations: _translations, ...base } = sanitizeNodeLocales(option, registeredLocales);
  const translations = registeredEntries(option.translations, registeredLocales);
  return { ...base, ...(translations === undefined ? {} : { translations }) };
}

function sanitizeFieldLocales(field: FormField, registeredLocales: ReadonlySet<string>): FormField {
  const localizedNode = sanitizeNodeLocales(field, registeredLocales);
  const { translations: _translations, ...base } = localizedNode;
  const translations = registeredEntries(field.translations, registeredLocales);
  const localized = {
    ...base,
    ...(translations === undefined ? {} : { translations })
  };
  if (!("options" in localizedNode)) return localized;
  const { translations: _choiceTranslations, ...choiceBase } = localizedNode;
  return {
    ...choiceBase,
    ...(translations === undefined ? {} : { translations }),
    options: localizedNode.options.map((option) => sanitizeOptionLocales(option, registeredLocales))
  };
}

function sanitizePageLocales(page: FormPage, registeredLocales: ReadonlySet<string>): FormPage {
  const localizedNode = sanitizeNodeLocales(page, registeredLocales);
  const { translations: _translations, ...base } = localizedNode;
  const translations = registeredEntries(page.translations, registeredLocales);
  return { ...base, ...(translations === undefined ? {} : { translations }) };
}

function sanitizeFieldConstraints(field: FormField, policy: FormPolicy | undefined): FormField {
  const constraint = policy?.fieldConstraints?.[field.type];
  if (constraint === undefined) return field;
  const required = constraint.fixedRequired ?? field.required;
  if (field.type === "rating") {
    const ratingConstraint = "fixedMin" in constraint || "fixedMax" in constraint ? constraint : undefined;
    const min =
      ratingConstraint !== undefined && "fixedMin" in ratingConstraint ? ratingConstraint.fixedMin : field.min;
    const max =
      ratingConstraint !== undefined && "fixedMax" in ratingConstraint ? ratingConstraint.fixedMax : field.max;
    return {
      ...field,
      required,
      ...(min === undefined ? {} : { min }),
      ...(max === undefined ? {} : { max })
    };
  }
  if ((field.type === "text" || field.type === "textarea") && "maxMaxLength" in constraint) {
    const maxLength =
      field.maxLength === undefined || constraint.maxMaxLength === undefined
        ? field.maxLength
        : Math.min(field.maxLength, constraint.maxMaxLength);
    return { ...field, required, ...(maxLength === undefined ? {} : { maxLength }) };
  }
  return { ...field, required };
}

function cyclicQuestionIds(fields: readonly FormField[]): ReadonlySet<string> {
  const firstById = new Map<string, FormField>();
  for (const field of fields) {
    if (!firstById.has(field.id)) firstById.set(field.id, field);
  }
  const cyclic = new Set<string>();
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const path: string[] = [];
  const visit = (id: string): void => {
    if (visiting.has(id)) {
      const start = path.indexOf(id);
      for (const member of path.slice(start < 0 ? 0 : start)) cyclic.add(member);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    path.push(id);
    const field = firstById.get(id);
    if (field === undefined) return;
    for (const sourceId of displayRuleSourceIds(field)) {
      if (sourceId !== id && firstById.has(sourceId)) visit(sourceId);
    }
    path.pop();
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of firstById.keys()) visit(id);
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
      if (choiceIds.has(option.id)) {
        issues.push({
          type: "duplicate_choice_id",
          questionId: field.id,
          choiceId: option.id,
          message: `Choice ID "${option.id}" is duplicated in question "${field.id}".`
        });
      } else {
        choiceIds.add(option.id);
      }
    }
  }

  for (const field of schema.fields) {
    for (const sourceId of displayRuleSourceIds(field)) {
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
  }

  const cyclic = cyclicQuestionIds(schema.fields);
  for (const field of schema.fields) {
    if (!cyclic.has(field.id)) continue;
    issues.push({
      type: "cyclic_condition_reference",
      questionId: field.id,
      cycle: [
        field.id,
        ...displayRuleSourceIds(field)
          .filter((sourceId) => cyclic.has(sourceId))
          .slice(0, 1),
        field.id
      ],
      message: `Question "${field.id}" participates in a display-condition cycle.`
    });
  }
  return issues;
}

export function sanitizeSchema(schema: FormSchema, options: SanitizeSchemaOptions = {}): FormSchema {
  const existingQuestionIds = new Set(schema.fields.map((field) => field.id));
  const registeredLocales = new Set([
    ...(schema.defaultLocale === undefined ? [] : [schema.defaultLocale]),
    ...(schema.supportedLocales ?? [])
  ]);
  const cyclic = cyclicQuestionIds(schema.fields);
  const sanitizedFields = schema.fields.map((sourceField) => {
    const field = sanitizeFieldConstraints(sanitizeFieldLocales(sourceField, registeredLocales), options.policy);
    let sanitized = field;
    const ruleSources = displayRuleSourceIds(field);
    if (
      field.displayRule !== undefined &&
      (cyclic.has(field.id) ||
        ruleSources.some((sourceId) => sourceId === field.id || !existingQuestionIds.has(sourceId)))
    ) {
      const { displayRule: _displayRule, ...withoutRule } = sanitized;
      sanitized = withoutRule as FormField;
    }
    const sourceId = sanitized.displayCondition?.questionId;
    if (
      sourceId !== undefined &&
      (!existingQuestionIds.has(sourceId) || sourceId === sanitized.id || cyclic.has(sanitized.id))
    ) {
      const { displayCondition: _displayCondition, ...withoutCondition } = sanitized;
      return withoutCondition as FormField;
    }
    return sanitized;
  });
  const localizedSchema = sanitizeNodeLocales(schema, registeredLocales);
  const { translations: _translations, ...schemaWithoutLocaleContent } = localizedSchema;
  const translations = registeredEntries(schema.translations, registeredLocales);
  const base: FormSchema = {
    ...schemaWithoutLocaleContent,
    ...(translations === undefined ? {} : { translations }),
    fields: sanitizedFields
  };
  if (schema.pages === undefined) return base;

  const assigned = new Set<string>();
  const pages: FormPage[] = schema.pages
    .map((sourcePage) => ({
      ...sanitizePageLocales(sourcePage, registeredLocales),
      questionIds: sourcePage.questionIds.filter((id) => {
        if (!existingQuestionIds.has(id) || assigned.has(id)) return false;
        assigned.add(id);
        return true;
      })
    }))
    .filter((page) => page.questionIds.length > 0);
  if (pages.length === 0) {
    const { pages: _pages, ...singlePage } = base;
    return singlePage;
  }
  const unassigned = schema.fields.map((field) => field.id).filter((id) => !assigned.has(id));
  const completePages = pages.map(
    (page, index): FormPage =>
      index === pages.length - 1 ? { ...page, questionIds: [...page.questionIds, ...unassigned] } : page
  );
  const pageIndexByQuestion = new Map(
    completePages.flatMap((page, pageIndex) => page.questionIds.map((id) => [id, pageIndex] as const))
  );
  const safePages = completePages.map((page, pageIndex): FormPage => {
    const sourceIndex =
      page.displayCondition === undefined ? undefined : pageIndexByQuestion.get(page.displayCondition.questionId);
    if (page.displayCondition === undefined || (sourceIndex !== undefined && sourceIndex < pageIndex)) return page;
    const { displayCondition: _displayCondition, ...safePage } = page;
    return safePage;
  });
  return { ...base, pages: safePages };
}
