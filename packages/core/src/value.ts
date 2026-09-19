import type { FormValue, RadioTextAnswer } from "./types";

export function isRadioTextAnswer(value: unknown): value is RadioTextAnswer {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "optionId" in value &&
    typeof value.optionId === "string" &&
    value.optionId.length > 0 &&
    "text" in value &&
    typeof value.text === "string"
  );
}

export function isFormValue(value: unknown): value is FormValue {
  return (
    value === undefined ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    (Array.isArray(value) && value.every((item) => typeof item === "string")) ||
    isRadioTextAnswer(value)
  );
}

export function selectedOptionId(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  return isRadioTextAnswer(value) ? value.optionId : undefined;
}
