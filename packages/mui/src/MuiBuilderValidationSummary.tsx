import type { FormSchema } from "@form-engine-ts/core";
import { FormEngineI18nContext, FormEngineI18nProviderScopeContext } from "@form-engine-ts/react";
import { Alert, AlertTitle, Button, List, ListItem, ListItemText, Stack } from "@mui/material";
import { useContext } from "react";
import type { MuiFormBuilderValidationIssue, MuiFormBuilderValidationState } from "./contentModeTypes";

export interface MuiBuilderValidationTarget {
  readonly fieldId?: string;
  readonly pageId?: string;
}

export interface MuiBuilderValidationSummaryProps {
  readonly schema: FormSchema;
  readonly validationState: MuiFormBuilderValidationState;
  readonly onFieldSelect?: (fieldId: string) => void;
  readonly onPageSelect?: (pageId: string) => void;
  readonly onIssueSelect?: (issue: MuiFormBuilderValidationIssue, target: MuiBuilderValidationTarget) => void;
  readonly title?: string;
  readonly actionLabel?: string;
}

function issueTarget(schema: FormSchema, path: string): MuiBuilderValidationTarget {
  const targetForField = (fieldId: string): MuiBuilderValidationTarget => {
    const pageId = schema.pages?.find((page) => page.questionIds.includes(fieldId))?.id;
    return pageId === undefined ? { fieldId } : { fieldId, pageId };
  };
  const fieldIndex = /^fields\[(\d+)]/.exec(path)?.[1];
  if (fieldIndex !== undefined) {
    const field = schema.fields[Number(fieldIndex)];
    if (field !== undefined) return targetForField(field.id);
  }
  const field = schema.fields.find((candidate) => candidate.id === path || path.startsWith(`${candidate.id}.`));
  if (field !== undefined) return targetForField(field.id);

  const pageIndex = /^pages\[(\d+)]/.exec(path)?.[1];
  if (pageIndex !== undefined) {
    const page = schema.pages?.[Number(pageIndex)];
    if (page !== undefined) return { pageId: page.id };
  }
  const page = schema.pages?.find((candidate) => candidate.id === path || path.startsWith(`${candidate.id}.`));
  return page === undefined ? {} : { pageId: page.id };
}

export function MuiBuilderValidationSummary({
  schema,
  validationState,
  onFieldSelect,
  onPageSelect,
  onIssueSelect,
  title,
  actionLabel
}: MuiBuilderValidationSummaryProps) {
  const i18n = useContext(FormEngineI18nContext);
  const hasI18nProvider = useContext(FormEngineI18nProviderScopeContext);
  const translated = (key: string, fallback: string) => {
    if (!hasI18nProvider) return fallback;
    const value = i18n.translator(key);
    return value === key ? fallback : value;
  };
  const resolvedTitle = title ?? translated("builder.validationProblems", "Problems to fix");
  const resolvedActionLabel = actionLabel ?? translated("builder.fixIssue", "Fix");
  if (validationState.valid) return null;
  return (
    <Alert severity="warning" role="alert" data-mui-slot="builder-validation-summary">
      <AlertTitle>{resolvedTitle}</AlertTitle>
      <List dense>
        {validationState.issues.map((issue) => {
          const target = issueTarget(schema, issue.path);
          const field =
            target.fieldId === undefined ? undefined : schema.fields.find((item) => item.id === target.fieldId);
          const page =
            target.pageId === undefined ? undefined : schema.pages?.find((item) => item.id === target.pageId);
          const targetLabel = field?.title ?? page?.title;
          const canSelect = target.fieldId !== undefined || target.pageId !== undefined;
          return (
            <ListItem key={`${issue.source}-${issue.path}-${issue.code}`}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} width="100%">
                <ListItemText
                  primary={targetLabel === undefined ? issue.path : targetLabel}
                  secondary={issue.message}
                />
                {canSelect ? (
                  <Button
                    size="small"
                    onClick={() => {
                      if (target.fieldId !== undefined) onFieldSelect?.(target.fieldId);
                      if (target.pageId !== undefined) onPageSelect?.(target.pageId);
                      onIssueSelect?.(issue, target);
                    }}
                  >
                    {resolvedActionLabel}
                  </Button>
                ) : null}
              </Stack>
            </ListItem>
          );
        })}
      </List>
    </Alert>
  );
}
