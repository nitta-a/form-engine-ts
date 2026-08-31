import type { JsonValue } from "@form-engine-ts/core";
import type { QualityIssue } from "../types";

export interface SurveyQualityIssueRecord {
  readonly issueId: string;
  readonly message: string;
  readonly path?: string;
  readonly severity?: string;
  readonly category?: string;
  readonly language?: string;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

function mapSeverity(severity: string | undefined): QualityIssue["severity"] {
  if (severity === undefined) return undefined;
  return severity.toLowerCase() === "error" || severity.toLowerCase() === "critical" ? "error" : "warning";
}

/** Converts a domain quality DTO into the package QualityIssue contract. */
export function mapSurveyQualityIssue(issue: SurveyQualityIssueRecord): QualityIssue {
  const severity = mapSeverity(issue.severity);
  const metadata = {
    ...issue.metadata,
    ...(issue.category === undefined ? {} : { category: issue.category }),
    ...(issue.language === undefined ? {} : { language: issue.language })
  };
  return {
    code: issue.issueId,
    message: issue.message,
    ...(issue.path === undefined ? {} : { path: issue.path }),
    ...(severity === undefined ? {} : { severity }),
    ...(Object.keys(metadata).length === 0 ? {} : { metadata })
  };
}

export function mapSurveyQualityIssues(issues: readonly SurveyQualityIssueRecord[]): readonly QualityIssue[] {
  return issues.map(mapSurveyQualityIssue);
}

/** Readable alias for callers that use "to" naming for domain mappers. */
export const toSurveyQualityIssue = mapSurveyQualityIssue;
