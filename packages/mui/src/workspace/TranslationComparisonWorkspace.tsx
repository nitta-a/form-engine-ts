import type {
  AsyncTranslationAdapter,
  FormPolicy,
  FormSchema,
  LocaleOption,
  TranslationAdapter,
  TranslationReport,
  TranslationStatus
} from "@form-engine-ts/core";
import { normalizeLocale } from "@form-engine-ts/core";
import {
  type ConfirmRemoveLocaleSlotProps,
  FormEngineI18nProvider,
  type TranslationComparisonHeaderProps,
  type TranslationComparisonItem,
  type TranslationComparisonItemRowProps,
  type UseTranslationComparisonOptions,
  useFormEngineI18n,
  useTranslationComparison
} from "@form-engine-ts/react";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  TextField,
  Typography
} from "@mui/material";
import type { ReactNode } from "react";
import { useState } from "react";
import type { MuiFormEngineI18nOptions } from "../types";

export interface TranslationComparisonWorkspaceProps {
  readonly schema: FormSchema;
  readonly sourceLocale?: string;
  readonly targetLocale?: string;
  readonly availableLocales?: readonly (string | LocaleOption)[];
  readonly policy?: FormPolicy;
  readonly readOnly?: boolean;
  readonly translationAdapter?: TranslationAdapter | AsyncTranslationAdapter;
  readonly signal?: AbortSignal;
  readonly onChange?: (nextSchema: FormSchema) => void;
  readonly onTranslationChange?: UseTranslationComparisonOptions["onTranslationChange"];
  readonly onTranslationReport?: (report: TranslationReport) => void;
  readonly onTranslationError?: UseTranslationComparisonOptions["onTranslationError"];
  readonly onLocaleAdded?: (locale: string) => void;
  readonly onLocaleRemoved?: (locale: string) => void;
  readonly onLocaleChange?: (locale: string) => void;
  readonly beforeRemoveLocale?: UseTranslationComparisonOptions["beforeRemoveLocale"];
  readonly onTranslationStart?: UseTranslationComparisonOptions["onTranslationStart"];
  readonly onTranslationSuccess?: UseTranslationComparisonOptions["onTranslationSuccess"];
  readonly validateLocale?: UseTranslationComparisonOptions["validateLocale"];
  readonly createTranslationMetadata?: UseTranslationComparisonOptions["createTranslationMetadata"];
  readonly showInternalPath?: boolean;
  readonly i18n?: MuiFormEngineI18nOptions;
  readonly slots?: {
    readonly renderHeader?: (props: TranslationComparisonHeaderProps) => ReactNode;
    readonly renderItemRow?: (props: TranslationComparisonItemRowProps) => ReactNode;
    readonly renderStatusBadge?: (props: { readonly status: TranslationStatus }) => ReactNode;
    readonly confirmRemoveLocale?: (props: ConfirmRemoveLocaleSlotProps) => ReactNode;
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

const nodeKindKey: Record<TranslationComparisonItem["targetKind"], string> = {
  form: "workspace.comparison.nodeKind.form",
  page: "workspace.comparison.nodeKind.page",
  field: "workspace.comparison.nodeKind.field",
  option: "workspace.comparison.nodeKind.option"
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
  const optionId = /^fields\.[^.]+\.options\.([^.]+)\./u.exec(item.path)?.[1];
  const optionIndex = "options" in field ? field.options.findIndex((option) => option.id === optionId) : -1;
  return {
    questionIndex: fieldIndex,
    fieldType: field.type,
    ...(optionIndex < 0 ? {} : { optionIndex })
  };
}

function DefaultLocaleRemovalDialog({
  localeLabel,
  translatedSlotsCount,
  isOpen,
  onConfirm,
  onCancel,
  translate
}: ConfirmRemoveLocaleSlotProps & {
  readonly translate: (key: string, params?: Record<string, unknown>) => string;
}) {
  return (
    <Dialog open={isOpen} onClose={onCancel} aria-labelledby="translation-remove-locale-title">
      <DialogTitle id="translation-remove-locale-title">{translate("workspace.confirm.removeLocaleTitle")}</DialogTitle>
      <DialogContent>
        {translate("workspace.confirm.removeLocaleMessage", { locale: localeLabel })}
        {translatedSlotsCount > 0
          ? ` ${translate("workspace.confirm.removeLocaleTranslatedCount", { count: translatedSlotsCount })}`
          : ""}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{translate("workspace.confirm.cancel")}</Button>
        <Button color="error" onClick={onConfirm} autoFocus>
          {translate("workspace.confirm.remove")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ComparisonContent({
  schema,
  sourceLocale,
  targetLocale,
  availableLocales,
  policy,
  readOnly = false,
  translationAdapter,
  onChange,
  onTranslationChange,
  onTranslationReport,
  onTranslationError,
  signal,
  slots,
  onLocaleAdded,
  onLocaleRemoved,
  onLocaleChange,
  beforeRemoveLocale,
  onTranslationStart,
  onTranslationSuccess,
  validateLocale,
  createTranslationMetadata,
  showInternalPath = false,
  i18n
}: TranslationComparisonWorkspaceProps) {
  const { translator } = useFormEngineI18n();
  const translate = (key: string, params: Record<string, unknown> = {}) => translator(key, params);
  const [newLocale, setNewLocale] = useState("");
  const defaultConfirmRemoveLocale = (props: ConfirmRemoveLocaleSlotProps) => (
    <DefaultLocaleRemovalDialog {...props} translate={translate} />
  );
  const localizedAvailableLocales = availableLocales?.map((candidate) =>
    typeof candidate === "string"
      ? { locale: candidate, label: i18n?.getLocaleLabel?.(candidate) ?? candidate }
      : candidate
  );
  const comparison = useTranslationComparison({
    schema,
    targetLocale: targetLocale ?? "",
    ...(localizedAvailableLocales === undefined ? {} : { availableLocales: localizedAvailableLocales }),
    ...(policy === undefined ? {} : { policy }),
    ...(sourceLocale === undefined ? {} : { sourceLocale }),
    ...(translationAdapter === undefined ? {} : { translationAdapter }),
    ...(signal === undefined ? {} : { signal }),
    readOnly,
    ...(onChange === undefined ? {} : { onChange }),
    ...(onTranslationChange === undefined ? {} : { onTranslationChange }),
    ...(onTranslationReport === undefined ? {} : { onTranslationReport }),
    ...(onTranslationError === undefined ? {} : { onTranslationError }),
    ...(onLocaleAdded === undefined ? {} : { onLocaleAdded }),
    ...(onLocaleRemoved === undefined ? {} : { onLocaleRemoved }),
    ...(onLocaleChange === undefined ? {} : { onLocaleChange }),
    ...(beforeRemoveLocale === undefined ? {} : { beforeRemoveLocale }),
    ...(onTranslationStart === undefined ? {} : { onTranslationStart }),
    ...(onTranslationSuccess === undefined ? {} : { onTranslationSuccess }),
    ...(validateLocale === undefined ? {} : { validateLocale }),
    ...(createTranslationMetadata === undefined ? {} : { createTranslationMetadata }),
    confirmRemoveLocale: slots?.confirmRemoveLocale ?? defaultConfirmRemoveLocale
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
  const sourceLocaleLabel =
    comparison.localeOptions.find(
      (option) => (normalizeLocale(option.locale) ?? option.locale) === comparison.sourceLocale
    )?.label ??
    i18n?.getLocaleLabel?.(comparison.sourceLocale) ??
    comparison.sourceLocale;
  const targetLocaleLabel =
    comparison.localeOptions.find(
      (option) => (normalizeLocale(option.locale) ?? option.locale) === comparison.targetLocale
    )?.label ??
    i18n?.getLocaleLabel?.(comparison.targetLocale) ??
    comparison.targetLocale;
  const sourceHeader = translate("workspace.comparison.sourceHeader", { locale: sourceLocaleLabel });
  const targetHeader = translate("workspace.comparison.targetHeader", { locale: targetLocaleLabel });
  const targetLocaleSet = new Set(comparison.targetLocales.map((locale) => normalizeLocale(locale) ?? locale));
  const localeCandidates = comparison.localeOptions.filter((option) => {
    const locale = normalizeLocale(option.locale) ?? option.locale;
    return locale !== comparison.sourceLocale && !targetLocaleSet.has(locale);
  });
  const selectedLocaleOption = comparison.localeOptions.find(
    (option) => (normalizeLocale(option.locale) ?? option.locale) === comparison.targetLocale
  );
  const canRemoveTargetLocale =
    !readOnly && comparison.targetLocale.length > 0 && comparison.targetLocale !== comparison.sourceLocale;
  const handleAddLocale = () => {
    const result = comparison.addLocale(newLocale);
    if (result.success) setNewLocale("");
  };
  const errorMessage =
    comparison.error === undefined
      ? undefined
      : comparison.error.type === "locale_not_allowed"
        ? translate("workspace.errors.localeNotAllowed", { locale: comparison.error.locale })
        : comparison.error.type === "locale_already_exists"
          ? translate("workspace.errors.localeAlreadyExists", { locale: comparison.error.locale })
          : comparison.error.type === "source_locale"
            ? translate("workspace.errors.sourceLocale", { locale: comparison.error.locale })
            : comparison.error.type === "max_locales_exceeded"
              ? translate("workspace.errors.maxLocalesExceeded", { max: comparison.error.max })
              : comparison.error.type === "custom_validation_failed"
                ? comparison.error.message
                : comparison.error.type === "adapter_not_configured"
                  ? translate("workspace.errors.adapterNotConfigured")
                  : comparison.error.type === "target_locale_missing"
                    ? translate("workspace.errors.targetLocaleMissing")
                    : comparison.error.type === "cancelled"
                      ? translate("workspace.errors.cancelled")
                      : comparison.error.type === "partial_failure"
                        ? translate("workspace.errors.partialFailure", {
                            succeeded: comparison.error.succeeded,
                            failed: comparison.error.failed
                          })
                        : translate("workspace.errors.translationFailed");

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
            <Box role="alert" sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Typography color="error">
                {translate("workspace.errors.partialFailure", {
                  succeeded: comparison.error.succeeded,
                  failed: comparison.error.failed
                })}
              </Typography>
              <Button size="small" onClick={headerProps.onTranslateAll} disabled={comparison.isTranslating}>
                {translate("workspace.header.retry")}
              </Button>
            </Box>
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
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center", mb: 2 }}>
        <Typography variant="body2" component="span">
          {translate("workspace.header.sourceLocale")}: {comparison.sourceLocale}
        </Typography>
        <Typography variant="body2" component="span">
          {translate("workspace.header.targetLocale")}:
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }} role="tablist" aria-label={targetHeader}>
          {comparison.targetLocales.map((locale) => (
            <Button
              key={locale}
              role="tab"
              aria-selected={locale === comparison.targetLocale}
              variant={locale === comparison.targetLocale ? "contained" : "outlined"}
              onClick={() => comparison.setTargetLocale(locale)}
              disabled={readOnly && locale !== comparison.targetLocale}
            >
              {comparison.localeOptions.find((option) => option.locale === locale)?.label ?? locale}
            </Button>
          ))}
        </Box>
        <TextField
          {...(availableLocales !== undefined ? { select: true } : {})}
          size="small"
          label={translate("workspace.header.addLocale")}
          value={newLocale}
          onChange={(event) => setNewLocale(event.target.value)}
          disabled={readOnly || (availableLocales !== undefined && localeCandidates.length === 0)}
          sx={{ minWidth: 180 }}
        >
          {availableLocales === undefined
            ? null
            : localeCandidates.map((option) => (
                <MenuItem key={option.locale} value={option.locale}>
                  {option.label}
                </MenuItem>
              ))}
        </TextField>
        <Button onClick={handleAddLocale} disabled={readOnly || !comparison.isAddLocaleAllowed(newLocale)}>
          {translate("workspace.header.addLocale")}
        </Button>
        <Button
          color="error"
          variant="outlined"
          onClick={() => void comparison.removeLocale(comparison.targetLocale)}
          disabled={!canRemoveTargetLocale || selectedLocaleOption?.removable === false}
        >
          {translate("workspace.header.removeLocale")}
        </Button>
      </Box>
      {errorMessage === undefined ? null : (
        <Typography role="alert" color="error">
          {errorMessage}
        </Typography>
      )}
      {comparison.removeLocaleConfirmation}
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
            nodeKind: item.targetKind,
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
                      {translate(nodeKindKey[item.targetKind])}
                      {item.nodeTitle === undefined ? "" : ` · ${item.nodeTitle}`}
                      {" ("}
                      {translate(propertyKey[item.targetProperty])}
                      {")"}
                      {showInternalPath ? ` · ${item.path}` : ""}
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
                      label={`${targetHeader} · ${
                        item.targetKind === "form"
                          ? translate(propertyKey[item.targetProperty])
                          : (item.nodeTitle ?? translate(propertyKey[item.targetProperty]))
                      }`}
                      value={item.translatedText}
                      onChange={(event) => rowProps.onChange(event.target.value)}
                      disabled={readOnly}
                      inputProps={{
                        "aria-label": `${targetHeader} · ${
                          item.targetKind === "form"
                            ? translate(propertyKey[item.targetProperty])
                            : (item.nodeTitle ?? translate(propertyKey[item.targetProperty]))
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
