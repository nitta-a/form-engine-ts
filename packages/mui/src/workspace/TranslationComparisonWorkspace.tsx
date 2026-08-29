import type {
  AsyncTranslationAdapter,
  FormSchema,
  TranslationAdapter,
  TranslationReport,
  TranslationStatus
} from "@form-engine-ts/core";
import {
  FormEngineI18nProvider,
  type TranslationComparisonHeaderProps,
  type TranslationComparisonItem,
  type TranslationComparisonItemRowProps,
  type UseTranslationComparisonOptions,
  useFormEngineI18n,
  useTranslationComparison
} from "@form-engine-ts/react";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import { Box, Button, Chip, IconButton, LinearProgress, Paper, TextField, Typography } from "@mui/material";
import type { ReactNode } from "react";
import type { MuiFormEngineI18nOptions } from "../types";

export interface TranslationComparisonWorkspaceProps {
  readonly schema: FormSchema;
  readonly sourceLocale?: string;
  readonly targetLocale: string;
  readonly readOnly?: boolean;
  readonly translationAdapter?: TranslationAdapter | AsyncTranslationAdapter;
  readonly signal?: AbortSignal;
  readonly onChange?: (nextSchema: FormSchema) => void;
  readonly onTranslationChange?: UseTranslationComparisonOptions["onTranslationChange"];
  readonly onTranslationReport?: (report: TranslationReport) => void;
  readonly onTranslationError?: UseTranslationComparisonOptions["onTranslationError"];
  readonly i18n?: MuiFormEngineI18nOptions;
  readonly slots?: {
    readonly renderHeader?: (props: TranslationComparisonHeaderProps) => ReactNode;
    readonly renderItemRow?: (props: TranslationComparisonItemRowProps) => ReactNode;
    readonly renderStatusBadge?: (props: { readonly status: TranslationStatus }) => ReactNode;
  };
}

const statusKey: Record<TranslationStatus, string> = {
  missing: "workspace.status.missing",
  translated: "workspace.status.translated",
  stale: "workspace.status.stale",
  manual: "workspace.status.manual",
  "manual-stale": "workspace.status.manualStale"
};

const propertyKey: Record<TranslationComparisonItem["targetProperty"], string> = {
  title: "workspace.comparison.property.title",
  description: "workspace.comparison.property.description",
  label: "workspace.comparison.property.label",
  completionMessage: "workspace.comparison.property.completionMessage"
};

function statusColor(status: TranslationStatus): "default" | "success" | "warning" {
  if (status === "translated" || status === "manual") return "success";
  if (status === "stale" || status === "manual-stale") return "warning";
  return "default";
}

function fieldContext(
  schema: FormSchema,
  item: TranslationComparisonItem
): {
  readonly questionIndex?: number;
  readonly fieldType?: string;
  readonly optionIndex?: number;
} {
  if (item.targetKind !== "field" && item.targetKind !== "option") return {};
  const parentId = /^fields\.([^.]+)\./u.exec(item.path)?.[1];
  const fieldIndex = schema.fields.findIndex((field) => field.id === parentId);
  const field = fieldIndex < 0 ? undefined : schema.fields[fieldIndex];
  if (field === undefined) return {};
  if (item.targetKind === "field") return { questionIndex: fieldIndex, fieldType: field.type };
  const optionIndex = "options" in field ? field.options.findIndex((option) => option.id === item.id) : -1;
  return {
    questionIndex: fieldIndex,
    fieldType: field.type,
    ...(optionIndex < 0 ? {} : { optionIndex })
  };
}

function ComparisonContent({
  schema,
  sourceLocale,
  targetLocale,
  readOnly = false,
  translationAdapter,
  onChange,
  onTranslationChange,
  onTranslationReport,
  onTranslationError,
  signal,
  slots
}: TranslationComparisonWorkspaceProps) {
  const { translator } = useFormEngineI18n();
  const translate = (key: string, params: Record<string, unknown> = {}) => translator(key, params);
  const comparison = useTranslationComparison({
    schema,
    targetLocale,
    ...(sourceLocale === undefined ? {} : { sourceLocale }),
    ...(translationAdapter === undefined ? {} : { translationAdapter }),
    ...(signal === undefined ? {} : { signal }),
    readOnly,
    ...(onChange === undefined ? {} : { onChange }),
    ...(onTranslationChange === undefined ? {} : { onTranslationChange }),
    ...(onTranslationReport === undefined ? {} : { onTranslationReport }),
    ...(onTranslationError === undefined ? {} : { onTranslationError })
  });
  const headerProps: TranslationComparisonHeaderProps = {
    sourceLocale: comparison.sourceLocale,
    targetLocale: comparison.targetLocale,
    summary: comparison.summary,
    onTranslateAll: () => void comparison.translateAll(),
    isTranslating: comparison.isTranslating,
    readOnly,
    ...(comparison.report === undefined ? {} : { report: comparison.report }),
    ...(comparison.progress === undefined ? {} : { progress: comparison.progress }),
    onCancel: comparison.cancelTranslation
  };
  const sourceHeader = translate("workspace.comparison.sourceHeader", { locale: comparison.sourceLocale });
  const targetHeader = translate("workspace.comparison.targetHeader", { locale: comparison.targetLocale });

  return (
    <Box data-testid="translation-comparison-workspace">
      {slots?.renderHeader?.(headerProps) ?? (
        <Box sx={{ display: "grid", gap: 1, mb: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, alignItems: "center" }}>
            <Typography variant="h6">{translate("workspace.comparison.title")}</Typography>
            <Button
              variant="contained"
              onClick={headerProps.onTranslateAll}
              disabled={readOnly || comparison.isTranslating || comparison.items.length === 0}
            >
              {translate("workspace.header.translateAll")}
            </Button>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {comparison.progress === undefined
              ? translate("workspace.header.progress", {
                  translated: comparison.summary.translated,
                  total: comparison.summary.total,
                  percent:
                    comparison.summary.total === 0
                      ? 100
                      : Math.round((comparison.summary.translated / comparison.summary.total) * 100)
                })
              : translate("workspace.header.batchProgress", {
                  completed: comparison.progress.completed,
                  total: comparison.progress.total,
                  succeeded: comparison.progress.succeeded,
                  failed: comparison.progress.failed,
                  percent: comparison.progress.percentage
                })}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={
              comparison.progress?.percentage ??
              (comparison.summary.total === 0 ? 100 : (comparison.summary.translated / comparison.summary.total) * 100)
            }
            aria-label={translate("workspace.header.progress", {
              translated: comparison.summary.translated,
              total: comparison.summary.total,
              percent:
                comparison.summary.total === 0
                  ? 100
                  : Math.round((comparison.summary.translated / comparison.summary.total) * 100)
            })}
          />
          {comparison.isTranslating ? (
            <Button size="small" onClick={headerProps.onCancel}>
              {translate("workspace.header.cancel")}
            </Button>
          ) : null}
          {comparison.error?.type === "partial_failure" ? (
            <Typography color="error" role="alert">
              {translate("workspace.errors.partialFailure", {
                succeeded: comparison.error.succeeded,
                failed: comparison.error.failed
              })}
            </Typography>
          ) : comparison.error?.type === "cancelled" ? (
            <Typography color="error" role="alert">
              {translate("workspace.errors.cancelled")}
            </Typography>
          ) : comparison.error !== undefined ? (
            <Box role="alert" sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Typography color="error">{translate("workspace.errors.translationFailed")}</Typography>
              <Button size="small" onClick={headerProps.onTranslateAll}>
                {translate("workspace.header.retry")}
              </Button>
            </Box>
          ) : null}
        </Box>
      )}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 1.5,
          mb: 1,
          px: 1
        }}
      >
        <Typography variant="subtitle2" color="text.secondary">
          {sourceHeader}
        </Typography>
        <Typography variant="subtitle2" color="text.secondary">
          {targetHeader}
        </Typography>
      </Box>
      <Box sx={{ display: "grid", gap: 1.5 }}>
        {comparison.items.map((item) => {
          const context = fieldContext(schema, item);
          const rowProps: TranslationComparisonItemRowProps = {
            item,
            ...context,
            sourceLocaleLabel: sourceHeader,
            targetLocaleLabel: targetHeader,
            readOnly,
            onChange: (text) => comparison.updateTranslation(item.path, text),
            onTranslate: () => comparison.translateSingle(item.path)
          };
          return (
            <Box
              key={item.id}
              data-testid={`translation-comparison-row-${item.id.replace(/[^a-zA-Z0-9_-]/gu, "-")}`}
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                gap: 1.5,
                borderBottom: 1,
                borderColor: "divider",
                pb: 1.5
              }}
            >
              {slots?.renderItemRow?.(rowProps) ?? (
                <>
                  <Box aria-readonly="true">
                    <Typography variant="caption" color="text.secondary">
                      {item.nodeTitle === undefined
                        ? translate(propertyKey[item.targetProperty])
                        : `${item.nodeTitle} (${translate(propertyKey[item.targetProperty])})`}
                    </Typography>
                    <Paper
                      variant="outlined"
                      sx={{
                        bgcolor: "action.hover",
                        minHeight: 56,
                        p: 1.5,
                        mt: 0.5,
                        ...(item.status === "stale" || item.status === "manual-stale"
                          ? { borderColor: "warning.main", borderWidth: 2 }
                          : {})
                      }}
                    >
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }} aria-label={sourceHeader}>
                        {item.sourceText || translate("workspace.comparison.emptySource")}
                      </Typography>
                    </Paper>
                  </Box>
                  <Box>
                    <Box
                      sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}
                      role="status"
                      aria-live="polite"
                    >
                      {slots?.renderStatusBadge?.({ status: item.status }) ?? (
                        <Chip size="small" color={statusColor(item.status)} label={translate(statusKey[item.status])} />
                      )}
                      {item.translatable ? (
                        <IconButton
                          size="small"
                          aria-label={translate("workspace.slot.translateSingle")}
                          title={translate("workspace.slot.translateSingle")}
                          onClick={rowProps.onTranslate}
                          disabled={readOnly || comparison.isTranslating}
                        >
                          <AutoFixHighIcon fontSize="small" />
                        </IconButton>
                      ) : null}
                    </Box>
                    <TextField
                      fullWidth
                      multiline
                      minRows={2}
                      label={`${targetHeader} · ${item.nodeTitle ?? translate(propertyKey[item.targetProperty])}`}
                      value={item.translatedText}
                      onChange={(event) => rowProps.onChange(event.target.value)}
                      disabled={readOnly}
                      inputProps={{
                        "aria-label": `${targetHeader} · ${
                          item.nodeTitle ?? translate(propertyKey[item.targetProperty])
                        }`
                      }}
                      placeholder={item.status === "missing" ? targetHeader : undefined}
                      sx={
                        item.status === "stale" || item.status === "manual-stale"
                          ? { "& .MuiOutlinedInput-notchedOutline": { borderColor: "warning.main" } }
                          : undefined
                      }
                    />
                    {item.status === "stale" || item.status === "manual-stale" ? (
                      <Typography color="warning.main" variant="caption" role="status" aria-live="polite">
                        {translate("workspace.comparison.staleWarning")}
                      </Typography>
                    ) : null}
                  </Box>
                </>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export function TranslationComparisonWorkspace(props: TranslationComparisonWorkspaceProps) {
  const { i18n } = props;
  if (i18n === undefined) return <ComparisonContent {...props} />;
  return (
    <FormEngineI18nProvider
      {...(i18n.locale === undefined ? {} : { locale: i18n.locale })}
      {...(i18n.fallbackLocale === undefined ? {} : { fallbackLocale: i18n.fallbackLocale })}
      {...(i18n.messages === undefined ? {} : { messages: i18n.messages })}
      {...(i18n.onMissingKey === undefined ? {} : { onMissingKey: i18n.onMissingKey })}
      {...(i18n.strict === undefined ? {} : { strict: i18n.strict })}
      {...(i18n.translator === undefined ? {} : { translator: i18n.translator })}
    >
      <ComparisonContent {...props} />
    </FormEngineI18nProvider>
  );
}
