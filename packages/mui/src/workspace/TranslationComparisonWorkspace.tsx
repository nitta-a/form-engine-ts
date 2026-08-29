import type {
  AsyncTranslationAdapter,
  FormPolicy,
  FormSchema,
  LocaleOption,
  TranslationAdapter,
  TranslationReport,
  TranslationStatus
} from "@form-engine-ts/core";
import {
  type ConfirmRemoveLocaleSlotProps,
  FormEngineI18nProvider,
  type TranslationComparisonHeaderProps,
  type TranslationComparisonItemIconProps,
  type TranslationComparisonItemRowProps,
  type TranslationComparisonLocaleSelectorProps,
  type UseTranslationComparisonOptions,
  useFormEngineI18n
} from "@form-engine-ts/react";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import { Box, Button, Chip, IconButton, LinearProgress, MenuItem, Paper, TextField, Typography } from "@mui/material";
import type { ReactNode } from "react";
import type { MuiFormEngineI18nOptions } from "../types";
import {
  defaultTranslationSlotIcon,
  translationComparisonContext,
  translationNodeKindKey,
  translationPropertyKey,
  translationStatusColor,
  translationStatusKey
} from "./translationWorkspaceUtils";
import { useTranslationComparisonView } from "./useTranslationComparisonView";

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
  readonly localeSelectorMode?: "tabs" | "select";
  readonly renderItemIcon?: (props: TranslationComparisonItemIconProps) => ReactNode;
  readonly getTranslationSlotIcon?: (props: TranslationComparisonItemIconProps) => ReactNode;
  readonly i18n?: MuiFormEngineI18nOptions;
  readonly slots?: {
    readonly renderHeader?: (props: TranslationComparisonHeaderProps) => ReactNode;
    readonly renderTargetLocaleSelector?: (props: TranslationComparisonLocaleSelectorProps) => ReactNode;
    readonly renderItemRow?: (props: TranslationComparisonItemRowProps) => ReactNode;
    readonly renderStatusBadge?: (props: { readonly status: TranslationStatus }) => ReactNode;
    readonly confirmRemoveLocale?: (props: ConfirmRemoveLocaleSlotProps) => ReactNode;
  };
}

function ComparisonContent(props: TranslationComparisonWorkspaceProps) {
  const {
    schema,
    availableLocales,
    readOnly = false,
    showInternalPath = false,
    localeSelectorMode = "tabs",
    renderItemIcon,
    getTranslationSlotIcon,
    slots
  } = props;
  const { translator } = useFormEngineI18n();
  const translate = (key: string, params: Record<string, unknown> = {}) => translator(key, params);
  const {
    comparison,
    newLocale,
    setNewLocale,
    handleAddLocale,
    localeLabel,
    sourceLocaleLabel,
    sourceHeader,
    targetHeader,
    headerProps,
    localeCandidates,
    selectedLocaleOption,
    canRemoveTargetLocale,
    errorMessage,
    targetLocaleSelectorProps
  } = useTranslationComparisonView(props, translate);

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
          {translate("workspace.header.sourceLocale")}: {sourceLocaleLabel}
        </Typography>
        <Typography variant="body2" component="span">
          {translate("workspace.header.targetLocale")}:
        </Typography>
        {slots?.renderTargetLocaleSelector?.(targetLocaleSelectorProps) ??
          (localeSelectorMode === "select" ? (
            comparison.targetLocales.length > 1 ? (
              <TextField
                select
                size="small"
                label={translate("workspace.header.targetLocale")}
                value={comparison.targetLocale}
                onChange={(event) => comparison.setTargetLocale(event.target.value)}
                disabled={readOnly}
                sx={{ minWidth: 180 }}
              >
                {comparison.targetLocales.map((locale) => (
                  <MenuItem key={locale} value={locale}>
                    {localeLabel(locale)}
                  </MenuItem>
                ))}
              </TextField>
            ) : null
          ) : (
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
                  {localeLabel(locale)}
                </Button>
              ))}
            </Box>
          ))}
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
                  {localeLabel(option.locale)}
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
          const context = translationComparisonContext(schema, item);
          const itemIconProps: TranslationComparisonItemIconProps = {
            item,
            nodeKind: item.targetKind,
            targetProperty: item.targetProperty,
            ...context
          };
          const itemIcon =
            renderItemIcon?.(itemIconProps) ??
            getTranslationSlotIcon?.(itemIconProps) ??
            defaultTranslationSlotIcon(itemIconProps);
          const rowProps: TranslationComparisonItemRowProps = {
            item,
            nodeKind: item.targetKind,
            ...context,
            sourceLocaleLabel: sourceHeader,
            targetLocaleLabel: targetHeader,
            renderItemIcon: () => itemIcon,
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
                <Box
                  sx={{
                    display: "grid",
                    gridColumn: { xs: "1", md: "1 / -1" },
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                    gap: 1.5
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.75, minWidth: 0 }}>
                    <Box component="span" aria-hidden="true" data-testid={`translation-item-icon-${item.id}`}>
                      {itemIcon}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {translate(translationNodeKindKey[item.targetKind])}
                      {item.nodeTitle === undefined ? "" : ` · ${item.nodeTitle}`}
                      {" ("}
                      {translate(translationPropertyKey[item.targetProperty])}
                      {")"}
                      {showInternalPath ? ` · ${item.path}` : ""}
                    </Typography>
                  </Box>
                  <Box
                    sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", minWidth: 0 }}
                    role="status"
                    aria-live="polite"
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                      <Box component="span" aria-hidden="true" data-testid={`translation-item-icon-${item.id}-target`}>
                        {itemIcon}
                      </Box>
                      {slots?.renderStatusBadge?.({ status: item.status }) ?? (
                        <Chip
                          size="small"
                          color={translationStatusColor(item.status)}
                          label={translate(translationStatusKey[item.status])}
                        />
                      )}
                    </Box>
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
                  <Box aria-readonly="true">
                    <Paper
                      variant="outlined"
                      sx={{
                        bgcolor: "action.hover",
                        minHeight: 56,
                        p: 1.5,
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
                    <TextField
                      fullWidth
                      multiline
                      minRows={2}
                      label={`${targetHeader} · ${
                        item.targetKind === "form"
                          ? translate(translationPropertyKey[item.targetProperty])
                          : (item.nodeTitle ?? translate(translationPropertyKey[item.targetProperty]))
                      }`}
                      value={item.translatedText}
                      onChange={(event) => rowProps.onChange(event.target.value)}
                      disabled={readOnly}
                      inputProps={{
                        "aria-label": `${targetHeader} · ${
                          item.targetKind === "form"
                            ? translate(translationPropertyKey[item.targetProperty])
                            : (item.nodeTitle ?? translate(translationPropertyKey[item.targetProperty]))
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
                </Box>
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
