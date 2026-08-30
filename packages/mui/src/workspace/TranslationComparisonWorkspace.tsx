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
  type TranslationComparisonAppearance,
  type TranslationComparisonHeaderProps,
  type TranslationComparisonItemIconProps,
  type TranslationComparisonItemRowProps,
  type TranslationComparisonLayoutSettings,
  type TranslationComparisonLayoutTarget,
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

function comparisonLayoutTarget(item: TranslationComparisonItemRowProps["item"]): TranslationComparisonLayoutTarget {
  if (item.targetKind === "option") return "option";
  if (item.targetProperty === "completionMessage") return "completionMessage";
  if (item.targetKind === "field") return "question";
  return "title";
}

function resolveComparisonLayout(
  layout: TranslationComparisonAppearance["layout"],
  target: TranslationComparisonLayoutTarget
): TranslationComparisonLayoutSettings {
  const base = layout ?? {};
  return { ...base, ...(base.byTarget?.[target] ?? {}) };
}

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
  readonly appearance?: TranslationComparisonAppearance;
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
    appearance = {},
    slots
  } = props;
  const layout = appearance.layout ?? {};
  const statusOptions = appearance.status ?? {};
  const responsiveMode = layout.responsive ?? "stack";
  const gridRatio = layout.gridRatio;
  const comparisonColumns = `${layout.sourceWidth ?? (gridRatio === undefined ? "minmax(0, 1fr)" : `${gridRatio.source}fr`)} ${layout.targetWidth ?? (gridRatio === undefined ? "minmax(0, 1fr)" : `${gridRatio.target}fr`)}`;
  const rowGridTemplateColumns = responsiveMode === "stack" ? { xs: "1fr", md: comparisonColumns } : comparisonColumns;
  const rowOverflow = responsiveMode === "scroll" ? { overflowX: "auto" } : {};
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
        <Box
          sx={{
            display: "grid",
            gap: 1,
            mb: 2,
            ...(layout.headerHeight === undefined ? {} : { minHeight: layout.headerHeight })
          }}
        >
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
        {availableLocales === undefined ? (
          <>
            <TextField
              size="small"
              label={translate("workspace.header.addLocale")}
              value={newLocale}
              onChange={(event) => setNewLocale(event.target.value)}
              disabled={readOnly}
              sx={{ minWidth: 180 }}
            />
            <Button onClick={handleAddLocale} disabled={readOnly || !comparison.isAddLocaleAllowed(newLocale)}>
              {translate("workspace.header.addLocale")}
            </Button>
          </>
        ) : (
          <>
            <TextField
              select
              size="small"
              label={translate("workspace.header.addLocale")}
              value={newLocale}
              onChange={(event) => setNewLocale(event.target.value)}
              disabled={readOnly || localeCandidates.length === 0}
              sx={{ minWidth: 180 }}
            >
              {localeCandidates.map((option) => (
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
          </>
        )}
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
          gridTemplateColumns: rowGridTemplateColumns,
          gap: layout.gap ?? 1.5,
          mb: 1,
          px: 1,
          ...rowOverflow
        }}
      >
        <Typography variant="subtitle2" color="text.secondary">
          {sourceHeader}
        </Typography>
        <Typography variant="subtitle2" color="text.secondary">
          {targetHeader}
        </Typography>
      </Box>
      <Box sx={{ display: "grid", gap: 0, ...rowOverflow }}>
        {comparison.items.map((item) => {
          const itemLayout = resolveComparisonLayout(appearance.layout, comparisonLayoutTarget(item));
          const itemResponsiveMode = itemLayout.responsive ?? "stack";
          const itemComparisonColumns = `${itemLayout.sourceWidth ?? "minmax(0, 1fr)"} ${itemLayout.targetWidth ?? "minmax(0, 1fr)"}`;
          const itemRowGridTemplateColumns =
            itemResponsiveMode === "stack" ? { xs: "1fr", md: itemComparisonColumns } : itemComparisonColumns;
          const itemRowOverflow = itemResponsiveMode === "scroll" ? { overflowX: "auto" } : {};
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
          const statusColor = statusOptions.colors?.[item.status];
          const statusLabel =
            statusOptions.labels?.[item.status] ??
            props.i18n?.customDictionary?.statusLabels?.[item.status] ??
            translate(translationStatusKey[item.status]);
          const statusIcon = statusOptions.icons?.[item.status];
          const statusBadge =
            statusOptions.visible === false
              ? null
              : (slots?.renderStatusBadge?.({ status: item.status }) ?? (
                  <Chip
                    size="small"
                    label={
                      <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                        {statusIcon}
                        <span>{statusLabel}</span>
                      </Box>
                    }
                    color={statusColor === undefined ? translationStatusColor(item.status) : undefined}
                    sx={statusColor === undefined ? undefined : { backgroundColor: statusColor }}
                    data-testid={`translation-status-badge-${item.id}`}
                  />
                ));
          const showHeaderStatus = (statusOptions.position ?? "header") === "header";
          const showSourceStatus = statusOptions.position === "source";
          const showTargetStatus = statusOptions.position === "target";
          const inputBorderColors = appearance.input?.borderColor ?? {};
          const statusBorderColor =
            inputBorderColors[item.status] ??
            (item.status === "manual" ? inputBorderColors.translated : undefined) ??
            (item.status === "manual-stale" ? inputBorderColors.stale : undefined);
          const normalBorderColor =
            appearance.targetInput?.borderColor ?? inputBorderColors.default ?? statusBorderColor;
          const hoverBorderColor = inputBorderColors.hover ?? statusBorderColor;
          const focusBorderColor = inputBorderColors.focus ?? statusBorderColor;
          const inputSx = {
            ...(normalBorderColor === undefined
              ? {}
              : { "& .MuiOutlinedInput-notchedOutline": { borderColor: normalBorderColor } }),
            ...(hoverBorderColor === undefined
              ? {}
              : { "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: hoverBorderColor } }),
            ...(focusBorderColor === undefined
              ? {}
              : { "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: focusBorderColor } }),
            ...(appearance.targetInput?.height === undefined &&
            appearance.input?.height === undefined &&
            itemLayout.inputHeight === undefined
              ? {}
              : {
                  "& .MuiInputBase-root": {
                    minHeight:
                      appearance.targetInput?.minHeight ??
                      appearance.targetInput?.height ??
                      appearance.input?.height ??
                      itemLayout.inputHeight,
                    height: appearance.targetInput?.height
                  }
                }),
            ...(appearance.targetInput?.backgroundColor === undefined
              ? {}
              : { backgroundColor: appearance.targetInput.backgroundColor }),
            ...(appearance.targetInput?.borderWidth === undefined
              ? {}
              : { "& .MuiOutlinedInput-notchedOutline": { borderWidth: appearance.targetInput.borderWidth } }),
            ...(appearance.targetInput?.borderRadius === undefined
              ? {}
              : { borderRadius: appearance.targetInput.borderRadius })
          };
          const targetLabel = `${targetHeader} · ${
            item.targetKind === "form"
              ? translate(translationPropertyKey[item.targetProperty])
              : (item.nodeTitle ?? translate(translationPropertyKey[item.targetProperty]))
          }`;
          const labelPosition =
            itemLayout.labelPosition ??
            (itemLayout.labelPlacement === "inline" ? "inside" : itemLayout.labelPlacement) ??
            "inside";
          const showItemStatus = itemLayout.showStatusBadge ?? statusOptions.visible !== false;
          return (
            <Box
              key={item.id}
              data-testid={`translation-comparison-row-${item.id.replace(/[^a-zA-Z0-9_-]/gu, "-")}`}
              sx={{
                display: "grid",
                gridTemplateColumns: itemRowGridTemplateColumns,
                gap: itemLayout.gap ?? 1.5,
                borderBottom: 1,
                borderColor: "divider",
                pb: 1.5,
                mb: itemLayout.rowGap ?? 1.5,
                alignItems:
                  layout.alignInput === "center" ? "center" : layout.alignInput === "start" ? "start" : "stretch",
                ...itemRowOverflow
              }}
            >
              {slots?.renderItemRow?.(rowProps) ?? (
                <Box
                  sx={{
                    display: "grid",
                    gridColumn: { xs: "1", md: "1 / -1" },
                    gridTemplateColumns:
                      itemLayout.gridRatio === undefined
                        ? itemRowGridTemplateColumns
                        : `${itemLayout.gridRatio.source}fr ${itemLayout.gridRatio.target}fr`,
                    gap: itemLayout.gap ?? 1.5,
                    alignItems:
                      (itemLayout.alignInput ?? layout.alignInput) === "center"
                        ? "center"
                        : (itemLayout.alignInput ?? layout.alignInput) === "start"
                          ? "start"
                          : "stretch",
                    ...(layout.equalInputHeight === false ? {} : { gridAutoRows: "auto" })
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
                      {showHeaderStatus && showItemStatus ? statusBadge : null}
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
                  <Box aria-readonly="true" sx={{ ...(layout.equalInputHeight === false ? {} : { height: "100%" }) }}>
                    {showSourceStatus && showItemStatus ? statusBadge : null}
                    <Paper
                      variant="outlined"
                      data-testid={`translation-source-input-${item.id.replace(/[^a-zA-Z0-9_-]/gu, "-")}`}
                      sx={{
                        bgcolor: appearance.sourceInput?.backgroundColor ?? "action.hover",
                        ...(layout.equalInputHeight === false ? {} : { height: "100%" }),
                        ...(appearance.sourceInput?.minHeight === undefined
                          ? {}
                          : { minHeight: appearance.sourceInput.minHeight }),
                        ...(appearance.sourceInput?.height === undefined
                          ? {}
                          : { height: appearance.sourceInput.height }),
                        ...(appearance.sourceInput?.borderColor === undefined
                          ? {}
                          : { borderColor: appearance.sourceInput.borderColor }),
                        ...(appearance.sourceInput?.borderWidth === undefined
                          ? {}
                          : { borderWidth: appearance.sourceInput.borderWidth }),
                        ...(appearance.sourceInput?.borderRadius === undefined
                          ? {}
                          : { borderRadius: appearance.sourceInput.borderRadius }),
                        p: 1.5
                      }}
                    >
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }} aria-label={sourceHeader}>
                        {item.sourceText || translate("workspace.comparison.emptySource")}
                      </Typography>
                    </Paper>
                  </Box>
                  <Box sx={{ ...(layout.equalInputHeight === false ? {} : { height: "100%" }) }}>
                    {showTargetStatus && showItemStatus ? statusBadge : null}
                    {labelPosition === "top" ? <Typography variant="caption">{targetLabel}</Typography> : null}
                    <TextField
                      data-testid={`translation-target-input-${item.id.replace(/[^a-zA-Z0-9_-]/gu, "-")}`}
                      fullWidth
                      multiline
                      minRows={itemLayout.minRows ?? 2}
                      {...(itemLayout.maxRows === undefined ? {} : { maxRows: itemLayout.maxRows })}
                      label={labelPosition === "inside" ? targetLabel : undefined}
                      value={item.translatedText}
                      onChange={(event) => rowProps.onChange(event.target.value)}
                      disabled={readOnly}
                      inputProps={{
                        "aria-label": targetLabel
                      }}
                      placeholder={
                        item.status === "missing"
                          ? (props.i18n?.customDictionary?.placeholders?.[comparisonLayoutTarget(item)] ?? targetHeader)
                          : undefined
                      }
                      sx={{ ...inputSx, ...(layout.equalInputHeight === false ? {} : { height: "100%" }) }}
                    />
                    {statusOptions.visible !== false && (item.status === "stale" || item.status === "manual-stale") ? (
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
      {...(i18n.customCatalogs === undefined ? {} : { customCatalogs: i18n.customCatalogs })}
      {...(i18n.customDictionary === undefined ? {} : { customDictionary: i18n.customDictionary })}
      {...(i18n.onMissingKey === undefined ? {} : { onMissingKey: i18n.onMissingKey })}
      {...(i18n.strict === undefined ? {} : { strict: i18n.strict })}
      {...(i18n.translator === undefined ? {} : { translator: i18n.translator })}
    >
      <ComparisonContent {...props} />
    </FormEngineI18nProvider>
  );
}
