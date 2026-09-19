import type { AuthoringOperationPreview, AuthoringPreview, AuthoringSuggestion } from "@form-engine-ts/core";
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
import { createContext, useContext } from "react";

const fallbackProviderScope = createContext(false);

export interface MuiAuthoringSuggestionPreviewProps {
  readonly suggestion: AuthoringSuggestion;
  readonly preview: AuthoringPreview;
  readonly loading?: boolean;
  readonly error?: string;
  readonly onApply: (operationIds: readonly string[]) => void;
  readonly onReject: () => void;
  readonly selectedOperationIds: readonly string[];
  readonly onSelectionChange: (operationIds: readonly string[]) => void;
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
  selectedOperationIds,
  onSelectionChange,
  labels
}: MuiAuthoringSuggestionPreviewProps) {
  const { translator } = useFormEngineI18n();
  const hasProvider = useContext(FormEngineI18nProviderScopeContext ?? fallbackProviderScope);
  const text = (key: string, fallback: string, override?: string) =>
    override ?? (hasProvider ? translator(key) : fallback);
  const operationLabel = (operation: AuthoringSuggestion["operations"][number]): string => {
    if (operation.type === "addField")
      return `${text("authoring.operation.addField", "Add question")}: ${operation.field.title}`;
    if (operation.type === "updateField")
      return `${text("authoring.operation.updateField", "Update question")}: ${operation.fieldId}`;
    if (operation.type === "updateForm") return text("authoring.operation.updateForm", "Update form settings");
    if (operation.type === "addOption")
      return `${text("authoring.operation.addOption", "Add option")}: ${operation.option.label}`;
    return `${text("authoring.operation.updateOption", "Update option")}: ${operation.optionId}`;
  };
  const operationPreviews = preview.operationPreviews;
  const validIds = operationPreviews.filter((item) => item.valid).map((item) => item.operationId);
  const selectedPreviews = operationPreviews.filter((item) => selectedOperationIds.includes(item.operationId));
  const selectedValid =
    selectedOperationIds.every((id) => validIds.includes(id)) && selectedPreviews.every((item) => item.valid);
  const allSelected = validIds.length > 0 && validIds.every((id) => selectedOperationIds.includes(id));
  const setSelected = (next: readonly string[]) => onSelectionChange(next);
  const toggle = (id: string) =>
    setSelected(
      selectedOperationIds.includes(id)
        ? selectedOperationIds.filter((value) => value !== id)
        : [...selectedOperationIds, id]
    );
  const formatValue = (value: unknown): string => {
    if (value === undefined) return "—";
    if (typeof value === "boolean") return value ? "Required" : "Optional";
    if (typeof value === "string" || typeof value === "number") return String(value);
    return "—";
  };
  const property = (value: AuthoringOperationPreview["before"], key: string): unknown => {
    if (value?.kind === "form") return Reflect.get(value, key);
    if (value?.kind === "field") return value.field === undefined ? undefined : Reflect.get(value.field, key);
    if (value?.kind === "option") return value.option === undefined ? undefined : Reflect.get(value.option, key);
    return undefined;
  };
  const propertyLabel = (key: string): string => {
    if (key === "title") return "Question";
    if (key === "description") return "Description";
    if (key === "required") return "Required";
    if (key === "label") return "Option";
    if (key === "completionMessage") return "Completion message";
    return key;
  };
  const previewRows = (item: AuthoringOperationPreview): readonly (readonly [string, string, string])[] => {
    const operation = item.operation;
    if (operation.type === "addField")
      return [
        ["Type", operation.field.type, operation.field.type],
        ["Question", "—", operation.field.title]
      ];
    if (operation.type === "addOption") return [["Option", "—", operation.option.label]];
    const patch = operation.patch;
    return Object.entries(patch).map(([key, value]) => [
      propertyLabel(key),
      formatValue(property(item.before, key)),
      formatValue(operation.type === "updateOption" ? value : property(item.after, key))
    ]);
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
                indeterminate={selectedOperationIds.length > 0 && !allSelected}
                onChange={() => setSelected(allSelected ? [] : validIds)}
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
                    checked={selectedOperationIds.includes(operation.operationId)}
                    disabled={!operationPreviews.find((item) => item.operationId === operation.operationId)?.valid}
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
                    {previewRows(item).map(([label, before, after]) => (
                      <Stack key={label} direction="row" spacing={1}>
                        <Typography variant="caption">{label}</Typography>
                        <Typography variant="caption">
                          {text("authoring.preview.before", "Before", labels?.before)}: {before}
                        </Typography>
                        <Typography variant="caption">
                          {text("authoring.preview.after", "After", labels?.after)}: {after}
                        </Typography>
                      </Stack>
                    ))}
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
              disabled={loading || !preview.valid || !selectedValid || selectedOperationIds.length === 0}
              onClick={() => onApply(selectedOperationIds)}
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
