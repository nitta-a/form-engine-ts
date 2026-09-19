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
  const formatValue = (value: unknown, key: string): string => {
    if (value === undefined) return text("authoring.preview.value.none", "—");
    if (typeof value === "boolean") {
      const translationKey =
        key === "required"
          ? value
            ? "authoring.preview.value.required"
            : "authoring.preview.value.optional"
          : value
            ? "authoring.preview.value.enabled"
            : "authoring.preview.value.disabled";
      const fallback = key === "required" ? (value ? "Required" : "Optional") : value ? "Enabled" : "Disabled";
      return text(translationKey, fallback);
    }
    if (key === "type" && typeof value === "string") return text(`builder.fieldType.${value}`, value);
    if (typeof value === "string" || typeof value === "number") return String(value);
    return text("authoring.preview.value.none", "—");
  };
  const property = (value: AuthoringOperationPreview["before"], key: string): unknown => {
    if (value?.kind === "form") return Reflect.get(value, key);
    if (value?.kind === "field") return value.field === undefined ? undefined : Reflect.get(value.field, key);
    if (value?.kind === "option") return value.option === undefined ? undefined : Reflect.get(value.option, key);
    return undefined;
  };
  const propertyLabel = (key: string): string => {
    const translations: Readonly<Record<string, readonly [string, string]>> = {
      type: ["authoring.preview.property.type", "Type"],
      title: ["authoring.preview.property.title", "Question"],
      description: ["authoring.preview.property.description", "Description"],
      required: ["authoring.preview.property.required", "Required"],
      label: ["authoring.preview.property.option", "Option"],
      completionMessage: ["authoring.preview.property.completionMessage", "Completion message"],
      submitLabelKey: ["authoring.preview.property.submitLabel", "Submit label"],
      minLength: ["builder.minimumLength", "Minimum length"],
      maxLength: ["builder.maximumLength", "Maximum length"],
      shuffleOptions: ["builder.shuffleOptions", "Shuffle options"],
      minSelections: ["validation.minSelections", "Minimum selections"],
      maxSelections: ["validation.maxSelections", "Maximum selections"]
    };
    const [translationKey, fallback] = translations[key] ?? [key, key];
    return text(translationKey, fallback);
  };
  const previewRows = (item: AuthoringOperationPreview): readonly (readonly [string, string, string])[] => {
    const operation = item.operation;
    if (operation.type === "addField") {
      const rows: Array<readonly [string, unknown]> = [
        ["type", operation.field.type],
        ["title", operation.field.title]
      ];
      if (operation.field.description !== undefined) rows.push(["description", operation.field.description]);
      if (operation.field.required !== undefined) rows.push(["required", operation.field.required]);
      for (const option of operation.field.options ?? []) rows.push(["label", option.label]);
      return rows.map(([key, value]) => [key, formatValue(undefined, key), formatValue(value, key)]);
    }
    if (operation.type === "addOption")
      return [["label", formatValue(undefined, "label"), formatValue(operation.option.label, "label")]];
    const patch = operation.patch;
    return Object.entries(patch).map(([key, value]) => [
      key,
      formatValue(property(item.before, key), key),
      formatValue(operation.type === "updateOption" ? value : property(item.after, key), key)
    ]);
  };
  return (
    <Card component="section" aria-label={text("authoring.preview.label", "Authoring suggestion preview")}>
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
                      <Stack key={`${label}\u0000${before}\u0000${after}`} direction="row" spacing={1}>
                        <Typography variant="caption">{propertyLabel(label)}</Typography>
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
