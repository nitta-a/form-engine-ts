import type { AuthoringPreview, AuthoringSuggestion } from "@form-engine-ts/core";
import { FormEngineI18nProviderScopeContext, useFormEngineI18n } from "@form-engine-ts/react";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

const fallbackProviderScope = createContext(false);

export interface MuiAuthoringSuggestionPreviewProps {
  readonly suggestion: AuthoringSuggestion;
  readonly preview: AuthoringPreview;
  readonly loading?: boolean;
  readonly error?: string;
  readonly onApply: (operationIds: readonly string[]) => void;
  readonly onReject: () => void;
  readonly selectedOperationIds?: readonly string[];
  readonly onSelectionChange?: (operationIds: readonly string[]) => void;
  readonly labels?: Partial<{
    readonly selectAll: string;
    readonly apply: string;
    readonly reject: string;
    readonly before: string;
    readonly after: string;
  }>;
}

export function MuiAuthoringSuggestionPreview({
  suggestion,
  preview,
  loading = false,
  error,
  onApply,
  onReject,
  selectedOperationIds: controlledSelected,
  onSelectionChange,
  labels
}: MuiAuthoringSuggestionPreviewProps) {
  const { translator } = useFormEngineI18n();
  const hasProvider = useContext(FormEngineI18nProviderScopeContext ?? fallbackProviderScope);
  const text = (key: string, fallback: string, override?: string) =>
    override ?? (hasProvider ? translator(key) : fallback);
  const operationLabel = (operation: AuthoringSuggestion["operations"][number]): string => {
    if (operation.type === "addField") return `${operation.type}: ${operation.field.type} — ${operation.field.title}`;
    if (operation.type === "updateField") return `${operation.type}: ${operation.patch.title ?? operation.fieldId}`;
    if (operation.type === "updateForm") return `${operation.type}: ${operation.patch.title ?? "form settings"}`;
    if (operation.type === "addOption") return `${operation.type}: ${operation.option.label}`;
    return `${operation.type}: ${operation.patch.label ?? operation.optionId}`;
  };
  const allIds = useMemo(
    () => suggestion.operations.map((operation) => operation.operationId),
    [suggestion.operations]
  );
  const [internalSelected, setInternalSelected] = useState<readonly string[]>(allIds);
  useEffect(() => setInternalSelected(allIds), [allIds]);
  const selected = controlledSelected ?? internalSelected;
  const setSelected = (next: readonly string[]) => {
    setInternalSelected(next);
    onSelectionChange?.(next);
  };
  const allSelected = selected.length === allIds.length;
  const toggle = (id: string) =>
    setSelected(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id]);
  const operationPreviews = preview.operationPreviews ?? [];
  const selectedPreviews = operationPreviews.filter((item) => selected.includes(item.operationId));
  const selectedValid = selectedPreviews.every((item) => item.valid);
  const previewText = (value: (typeof operationPreviews)[number]["before"]): string => {
    if (value === undefined) return "None";
    if (value.kind === "form") return value.title ?? value.description ?? value.completionMessage ?? "Form settings";
    if (value.kind === "field")
      return "field" in value && value.field !== undefined ? JSON.stringify(value.field) : "None";
    return "option" in value && value.option !== undefined ? JSON.stringify(value.option) : "None";
  };
  return (
    <Card component="section" aria-label="Authoring suggestion preview">
      <CardContent>
        <Stack spacing={1}>
          <Typography variant="h6">{suggestion.summary}</Typography>
          {suggestion.rationale === undefined ? null : (
            <Typography color="text.secondary">{suggestion.rationale}</Typography>
          )}
          {!preview.valid ? (
            <Typography color="error">{preview.issues.map((issue) => issue.message).join(" ")}</Typography>
          ) : null}
          {error === undefined ? null : <Typography color="error">{error}</Typography>}
          <FormControlLabel
            control={
              <Checkbox
                checked={allSelected}
                indeterminate={selected.length > 0 && !allSelected}
                onChange={() => setSelected(allSelected ? [] : allIds)}
              />
            }
            label={text("authoring.preview.selectAll", "Select all", labels?.selectAll)}
          />
          {suggestion.operations.map((operation) => (
            <Stack key={operation.operationId} spacing={0.25}>
              <FormControlLabel
                control={
                  <Checkbox
                    icon={<CheckBoxOutlineBlankIcon />}
                    checkedIcon={<CheckBoxIcon />}
                    checked={selected.includes(operation.operationId)}
                    onChange={() => toggle(operation.operationId)}
                  />
                }
                label={operationLabel(operation)}
              />
              {(() => {
                const item = operationPreviews.find((candidate) => candidate.operationId === operation.operationId);
                if (item === undefined) return null;
                return (
                  <Stack sx={{ pl: 4 }} spacing={0.25}>
                    <Typography variant="caption">
                      {text("authoring.preview.before", "Before", labels?.before)}: {previewText(item.before)}
                    </Typography>
                    <Typography variant="caption">
                      {text("authoring.preview.after", "After", labels?.after)}: {previewText(item.after)}
                    </Typography>
                    {!item.valid ? (
                      <Typography color="error">{item.issues.map((issue) => issue.message).join(" ")}</Typography>
                    ) : null}
                  </Stack>
                );
              })()}
            </Stack>
          ))}
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              disabled={loading || !preview.valid || !selectedValid || selected.length === 0}
              onClick={() => onApply(selected)}
            >
              {text("authoring.preview.apply", "Apply selected", labels?.apply)}
            </Button>
            <Button variant="text" disabled={loading} onClick={onReject}>
              {text("authoring.preview.reject", "Reject", labels?.reject)}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
