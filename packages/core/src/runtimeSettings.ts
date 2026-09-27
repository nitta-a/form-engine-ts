import type { FormRuntimeSettings, FormSchema } from "./types";

export function assertValidFormRuntimeSettings(settings: FormRuntimeSettings): void {
  if (typeof settings !== "object" || settings === null || Array.isArray(settings)) {
    throw new TypeError("Runtime settings must be an object.");
  }
  if (typeof settings.formId !== "string" || settings.formId.trim().length === 0)
    throw new TypeError("formId must not be empty.");
  if (typeof settings.updatedAt !== "string" || !Number.isFinite(Date.parse(settings.updatedAt))) {
    throw new TypeError("updatedAt must be a valid date string.");
  }
  for (const key of ["openAt", "closeAt"] as const) {
    const value = settings[key];
    if (
      value !== undefined &&
      (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || value.trim().length === 0)
    ) {
      throw new TypeError(`${key} must be a valid date string.`);
    }
  }
  if (
    settings.openAt !== undefined &&
    settings.closeAt !== undefined &&
    Date.parse(settings.openAt) >= Date.parse(settings.closeAt)
  ) {
    throw new TypeError("closeAt must be later than openAt.");
  }
  if (
    settings.maxResponses !== undefined &&
    (!Number.isSafeInteger(settings.maxResponses) || settings.maxResponses < 1)
  ) {
    throw new TypeError("maxResponses must be a positive safe integer.");
  }
  for (const key of ["iconKey", "colorToken"] as const) {
    const value = settings[key];
    if (value !== undefined && value.trim().length === 0) throw new TypeError(`${key} must not be empty.`);
  }
  if (settings.metadata !== undefined) {
    if (typeof settings.metadata !== "object" || settings.metadata === null || Array.isArray(settings.metadata)) {
      throw new TypeError("metadata must be a JSON object.");
    }
    try {
      JSON.stringify(settings.metadata);
    } catch (cause) {
      throw new TypeError("metadata must be JSON serializable.", { cause });
    }
  }
}

/** One-time migration helper for the currently published schema; callers choose the published record. */
export function migrateFormRuntimeSettings(
  schema: FormSchema,
  updatedAt: string,
  appearance: Pick<FormRuntimeSettings, "iconKey" | "colorToken"> = {}
): FormRuntimeSettings {
  const legacySettings = schema.submissionSettings;
  const settings: FormRuntimeSettings = {
    formId: schema.id,
    updatedAt,
    ...(legacySettings?.openAt === undefined ? {} : { openAt: legacySettings.openAt }),
    ...(legacySettings?.closeAt === undefined ? {} : { closeAt: legacySettings.closeAt }),
    ...(legacySettings?.maxResponses === undefined ? {} : { maxResponses: legacySettings.maxResponses }),
    ...appearance
  };
  assertValidFormRuntimeSettings(settings);
  return settings;
}
