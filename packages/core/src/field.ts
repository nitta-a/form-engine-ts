import type { FieldOption, FormField, QuestionType } from "./types";

const DEFAULT_OPTION: FieldOption = { id: "option-1", label: "Option 1" };

/**
 * Changes only the type-specific shape of a field. Authoring content and extension
 * data are deliberately retained so UI adapters cannot accidentally discard them.
 */
export function transformFieldType(field: FormField, nextType: QuestionType): FormField {
  const common = {
    id: field.id,
    title: field.title,
    required: field.required,
    ...(field.description === undefined ? {} : { description: field.description }),
    ...(field.translationKey === undefined ? {} : { translationKey: field.translationKey }),
    ...(field.messages === undefined ? {} : { messages: field.messages }),
    ...(field.displayCondition === undefined ? {} : { displayCondition: field.displayCondition }),
    ...(field.translations === undefined ? {} : { translations: field.translations }),
    ...(field.metadata === undefined ? {} : { metadata: field.metadata }),
    ...(field.translationMetadata === undefined ? {} : { translationMetadata: field.translationMetadata })
  };

  if (nextType === "text" || nextType === "textarea") {
    const textProperties =
      field.type === "text" || field.type === "textarea"
        ? {
            ...(field.placeholderKey === undefined ? {} : { placeholderKey: field.placeholderKey }),
            ...(field.minLength === undefined ? {} : { minLength: field.minLength }),
            ...(field.maxLength === undefined ? {} : { maxLength: field.maxLength }),
            ...(field.pattern === undefined ? {} : { pattern: field.pattern })
          }
        : {};
    return { ...common, ...textProperties, type: nextType };
  }
  if (nextType === "number") {
    const numberProperties =
      field.type === "number"
        ? {
            ...(field.placeholderKey === undefined ? {} : { placeholderKey: field.placeholderKey }),
            ...(field.min === undefined ? {} : { min: field.min }),
            ...(field.max === undefined ? {} : { max: field.max }),
            ...(field.step === undefined ? {} : { step: field.step })
          }
        : {};
    return { ...common, ...numberProperties, type: nextType };
  }
  if (nextType === "rating") {
    const ratingProperties =
      field.type === "rating"
        ? {
            ...(field.min === undefined ? {} : { min: field.min }),
            ...(field.max === undefined ? {} : { max: field.max })
          }
        : { min: 1, max: 5 };
    return { ...common, ...ratingProperties, type: nextType };
  }
  if (nextType === "checkbox") return { ...common, type: nextType };

  const options = "options" in field && field.options.length > 0 ? field.options : [DEFAULT_OPTION];
  if (nextType === "multi-select") {
    const selectionProperties =
      field.type === "multi-select"
        ? {
            ...(field.minSelections === undefined ? {} : { minSelections: field.minSelections }),
            ...(field.maxSelections === undefined ? {} : { maxSelections: field.maxSelections })
          }
        : {};
    return { ...common, ...selectionProperties, type: nextType, options };
  }
  return { ...common, type: nextType, options };
}
