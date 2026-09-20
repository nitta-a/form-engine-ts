import type { CreationBriefField, CreationBriefReadiness, SurveyCreationBrief } from "./types";

function hasText(value: string | undefined): boolean {
  return value !== undefined && value.trim().length > 0;
}

export function mergeSurveyCreationBrief(
  current: SurveyCreationBrief,
  update: SurveyCreationBrief
): SurveyCreationBrief {
  return {
    ...current,
    ...update,
    ...(update.constraints === undefined ? {} : { constraints: { ...current.constraints, ...update.constraints } }),
    ...(update.goals === undefined ? {} : { goals: [...update.goals] }),
    ...(update.notes === undefined ? {} : { notes: [...update.notes] })
  };
}

export function evaluateCreationBriefReadiness(brief: SurveyCreationBrief): CreationBriefReadiness {
  const missing: CreationBriefField[] = [];
  if (!hasText(brief.purpose)) missing.push("purpose");
  if (!hasText(brief.audience) && (brief.goals === undefined || brief.goals.every((goal) => !hasText(goal)))) {
    missing.push("audience", "goals");
  }
  return { ready: missing.length === 0, missing };
}

export function canGenerateCreationDraft(
  brief: SurveyCreationBrief,
  clarificationTurns: number,
  maxClarificationTurns = 3
): boolean {
  return evaluateCreationBriefReadiness(brief).ready || clarificationTurns >= maxClarificationTurns;
}
