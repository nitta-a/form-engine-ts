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
      "placeholderKey" in field && field.placeholderKey !== undefined ? { placeholderKey: field.placeholderKey } : {};
    const validationProperties =
      field.type === "text" || field.type === "textarea"
        ? {
            ...(field.minLength === undefined ? {} : { minLength: field.minLength }),
            ...(field.maxLength === undefined ? {} : { maxLength: field.maxLength }),
            ...(field.pattern === undefined ? {} : { pattern: field.pattern })
          }
        : {};
    return { ...common, ...textProperties, ...validationProperties, type: nextType };
  }
  if (nextType === "date" || nextType === "time" || nextType === "email" || nextType === "tel" || nextType === "url") {
    const textProperties =
      "placeholderKey" in field && field.placeholderKey !== undefined ? { placeholderKey: field.placeholderKey } : {};
    if (nextType === "date") {
      const dateProperties =
        field.type === "date"
          ? {
              ...(field.minDate === undefined ? {} : { minDate: field.minDate }),
              ...(field.maxDate === undefined ? {} : { maxDate: field.maxDate })
            }
          : {};
      return { ...common, ...textProperties, ...dateProperties, type: nextType };
    }
    if (nextType === "time") {
      const timeProperties =
        field.type === "time"
          ? {
              ...(field.minTime === undefined ? {} : { minTime: field.minTime }),
              ...(field.maxTime === undefined ? {} : { maxTime: field.maxTime })
            }
          : {};
      return { ...common, ...textProperties, ...timeProperties, type: nextType };
    }
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
  const shuffleOptions = "shuffleOptions" in field && field.shuffleOptions === true ? { shuffleOptions: true } : {};
  if (nextType === "multi-select") {
    const multiSelectOptions = options.map((option) => {
      if (option.textInput !== true) return option;
      const { textInput: _removed, ...remaining } = option;
      return remaining;
    });
    const selectionProperties =
      field.type === "multi-select"
        ? {
            ...(field.minSelections === undefined ? {} : { minSelections: field.minSelections }),
            ...(field.maxSelections === undefined ? {} : { maxSelections: field.maxSelections })
          }
        : {};
    return { ...common, ...selectionProperties, ...shuffleOptions, type: nextType, options: multiSelectOptions };
  }
  const selectOptions =
    nextType === "select"
      ? options.map((option) => {
          if (option.textInput !== true) return option;
          const { textInput: _removed, ...remaining } = option;
          return remaining;
        })
      : options;
  return { ...common, ...shuffleOptions, type: nextType, options: selectOptions };
}
