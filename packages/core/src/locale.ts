/**
 * Normalizes a locale string to its BCP 47 canonical form.
 *
 * Underscore-separated locale tags are accepted for compatibility with common
 * platform and user-input conventions. Invalid tags return null.
 */
export const normalizeLocale = (rawLocale: string): string | null => {
  if (!rawLocale || typeof rawLocale !== "string") return null;
  const trimmed = rawLocale.trim().replace(/_/gu, "-");
  if (trimmed.length === 0) return null;
  try {
    return Intl.getCanonicalLocales(trimmed)[0] ?? null;
  } catch {
    return null;
  }
};

export function canonicalLocaleOrRaw(rawLocale: string): string {
  return normalizeLocale(rawLocale) ?? rawLocale;
}
