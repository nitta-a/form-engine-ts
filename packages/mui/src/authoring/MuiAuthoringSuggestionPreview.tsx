import type { AuthoringPreview, AuthoringSuggestion } from "@form-engine-ts/core";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useState } from "react";

export interface MuiAuthoringSuggestionPreviewProps {
  readonly suggestion: AuthoringSuggestion;
  readonly preview: AuthoringPreview;
  readonly loading?: boolean;
  readonly error?: string;
  readonly onApply: (operationIds: readonly string[]) => void;
  readonly onReject: () => void;
}

export function MuiAuthoringSuggestionPreview({
  suggestion,
  preview,
  loading = false,
  error,
  onApply,
  onReject
}: MuiAuthoringSuggestionPreviewProps) {
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
  const [selected, setSelected] = useState<readonly string[]>(allIds);
  useEffect(() => setSelected(allIds), [allIds]);
  const allSelected = selected.length === allIds.length;
  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
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
            label="Select all"
          />
          {suggestion.operations.map((operation) => (
            <FormControlLabel
              key={operation.operationId}
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
          ))}
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              disabled={loading || !preview.valid || selected.length === 0}
              onClick={() => onApply(selected)}
            >
              Apply selected
            </Button>
            <Button variant="text" disabled={loading} onClick={onReject}>
              Reject
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
