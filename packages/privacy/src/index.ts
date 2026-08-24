import type { FormSchema } from "@form-engine-ts/core";

export interface SensitiveDataFinding {
  readonly fieldId: string;
  readonly type: "email" | "phone" | "url" | "postal_code" | string;
  readonly start?: number;
  readonly end?: number;
  readonly matchedText?: string;
}

export interface SensitiveDataDetectorRule {
  readonly type: string;
  readonly pattern: RegExp;
  readonly enabled?: boolean;
}

export interface PrivacyDetectorConfig {
  readonly rules?: readonly SensitiveDataDetectorRule[];
  readonly customDetectors?: readonly ((fieldId: string, text: string) => readonly SensitiveDataFinding[])[];
}

export interface SensitiveDataDetector {
  detect(schema: FormSchema, values: Record<string, unknown>): readonly SensitiveDataFinding[];
}

const STANDARD_RULES: readonly SensitiveDataDetectorRule[] = [
  { type: "email", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu },
  { type: "url", pattern: /\b(?:https?:\/\/|www\.)[^\s<>"']*[A-Z0-9/#]/giu },
  { type: "phone", pattern: /(?:\+?\d[\d\s().-]{6,}\d)/gu },
  { type: "postal_code", pattern: /(?:〒\s*)?\b\d{3}-?\d{4}\b/gu }
];

function configuredRules(config: PrivacyDetectorConfig): readonly SensitiveDataDetectorRule[] {
  const rules = new Map(STANDARD_RULES.map((rule) => [rule.type, rule]));
  for (const rule of config.rules ?? []) {
    if (rule.type.trim().length === 0) throw new TypeError("Privacy detector rule type must not be empty.");
    if (!(rule.pattern instanceof RegExp)) throw new TypeError(`Privacy detector rule ${rule.type} requires a RegExp.`);
    if (rule.enabled === false) rules.delete(rule.type);
    else rules.set(rule.type, rule);
  }
  return [...rules.values()];
}

function detectRule(fieldId: string, text: string, rule: SensitiveDataDetectorRule): SensitiveDataFinding[] {
  const flags = rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`;
  const pattern = new RegExp(rule.pattern.source, flags);
  const findings: SensitiveDataFinding[] = [];
  for (const match of text.matchAll(pattern)) {
    const matchedText = match[0];
    if (matchedText.length === 0 || match.index === undefined) continue;
    if (rule.type === "phone" && matchedText.replaceAll(/\D/gu, "").length < 8) continue;
    findings.push({
      fieldId,
      type: rule.type,
      start: match.index,
      end: match.index + matchedText.length,
      matchedText
    });
  }
  return findings;
}

function findingsOverlap(left: SensitiveDataFinding, right: SensitiveDataFinding): boolean {
  if (left.fieldId !== right.fieldId || left.type !== right.type) return false;
  if (left.start === undefined || left.end === undefined || right.start === undefined || right.end === undefined) {
    return left.matchedText !== undefined && left.matchedText === right.matchedText;
  }
  return left.start < right.end && right.start < left.end;
}

function deduplicateFindings(
  findings: readonly SensitiveDataFinding[],
  values: Record<string, unknown>
): SensitiveDataFinding[] {
  const deduplicated: SensitiveDataFinding[] = [];
  for (const finding of findings) {
    const overlappingIndexes = deduplicated.flatMap((candidate, index) =>
      findingsOverlap(candidate, finding) ? [index] : []
    );
    if (overlappingIndexes.length === 0) {
      deduplicated.push(finding);
      continue;
    }
    const overlapping = overlappingIndexes.map((index) => deduplicated[index]).filter((value) => value !== undefined);
    const starts = [finding, ...overlapping].flatMap((value) => (value.start === undefined ? [] : [value.start]));
    const ends = [finding, ...overlapping].flatMap((value) => (value.end === undefined ? [] : [value.end]));
    const start = starts.length === 0 ? undefined : Math.min(...starts);
    const end = ends.length === 0 ? undefined : Math.max(...ends);
    const text = values[finding.fieldId];
    const merged: SensitiveDataFinding = {
      fieldId: finding.fieldId,
      type: finding.type,
      ...(start === undefined ? {} : { start }),
      ...(end === undefined ? {} : { end }),
      ...(start !== undefined && end !== undefined && typeof text === "string"
        ? { matchedText: text.slice(start, end) }
        : finding.matchedText === undefined
          ? {}
          : { matchedText: finding.matchedText })
    };
    const insertionIndex = overlappingIndexes[0] ?? deduplicated.length;
    for (const index of [...overlappingIndexes].sort((left, right) => right - left)) deduplicated.splice(index, 1);
    deduplicated.splice(insertionIndex, 0, merged);
  }
  return deduplicated;
}

export function createStandardPrivacyDetector(config: PrivacyDetectorConfig = {}): SensitiveDataDetector {
  const rules = configuredRules(config);
  const customDetectors = [...(config.customDetectors ?? [])];
  if (customDetectors.some((detector) => typeof detector !== "function")) {
    throw new TypeError("customDetectors must contain only functions.");
  }
  return {
    detect(schema, values) {
      const findings: SensitiveDataFinding[] = [];
      for (const field of schema.fields) {
        if (field.type !== "text" && field.type !== "textarea") continue;
        const value = values[field.id];
        if (typeof value !== "string" || value.length === 0) continue;
        for (const rule of rules) findings.push(...detectRule(field.id, value, rule));
        for (const detector of customDetectors) findings.push(...detector(field.id, value));
      }
      return deduplicateFindings(findings, values);
    }
  };
}
