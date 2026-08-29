import type {
  AsyncTranslationAdapter,
  FormPolicy,
  FormSchema,
  LocaleOption,
  TranslationAdapter
} from "@form-engine-ts/core";
import {
  FormEngineI18nProvider,
  type TranslationComparisonItemRowProps,
  type TranslationEventPayload,
  type TranslationSlotChangeEvent,
  type TranslationSlotRowProps,
  type TranslationWorkspaceError,
  type TranslationWorkspaceSlots,
  type UseTranslationWorkspaceOptions,
  useFormEngineI18n
} from "@form-engine-ts/react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography
} from "@mui/material";
import {
  comparisonItemFromSlot,
  translationComparisonContext,
  translationStatusKey
} from "./translationWorkspaceUtils";
import { useTranslationWorkspaceView } from "./useTranslationWorkspaceView";

export interface TranslationWorkspaceProps {
  readonly schema: FormSchema;
  readonly onChange?: (schema: FormSchema) => void;
  readonly sourceLocale?: string;
  readonly targetLocale?: string;
  readonly translationAdapter?: TranslationAdapter | AsyncTranslationAdapter;
  readonly signal?: AbortSignal;
  readonly readOnly?: boolean;
  readonly policy?: FormPolicy;
  readonly availableLocales?: readonly (string | LocaleOption)[];
  readonly onLocaleAdded?: (locale: string) => void;
  readonly onLocaleRemoved?: (locale: string) => void;
  readonly onLocaleChange?: (locale: string) => void;
  readonly beforeRemoveLocale?: (locale: string, context: { readonly slotCount: number }) => Promise<boolean> | boolean;
  readonly onTranslationStart?: (params: {
    readonly targetLocale: string;
    readonly mode: "manual" | "automatic";
  }) => void;
  readonly onTranslationSuccess?: (payload: TranslationEventPayload) => void;
  readonly onTranslationReport?: (report: import("@form-engine-ts/core").TranslationReport) => void;
  readonly onTranslationError?: (params: {
    readonly targetLocale: string;
    readonly error: TranslationWorkspaceError;
  }) => void;
  readonly onTranslationChange?: (event: TranslationSlotChangeEvent) => void;
  readonly createTranslationMetadata?: UseTranslationWorkspaceOptions["createTranslationMetadata"];
  readonly validateLocale?: UseTranslationWorkspaceOptions["validateLocale"];
  readonly showInternalPath?: boolean;
  readonly localeSelectorMode?: "tabs" | "select";
  readonly i18n?: import("../types").MuiFormEngineI18nOptions;
  readonly slots?: TranslationWorkspaceSlots;
}

function SlotCard({
  slot,
  readOnly,
  onChange,
  onTranslate,
  translate,
  renderStatusBadge,
  showInternalPath = false
}: TranslationSlotRowProps & {
  readonly translate: ReturnType<typeof useFormEngineI18n>["translator"];
  readonly renderStatusBadge?: TranslationWorkspaceSlots["renderStatusBadge"];
  readonly showInternalPath?: boolean;
}) {
  const status = slot.status ?? "missing";
  const nodeLabel = `${translate(`workspace.comparison.nodeKind.${slot.kind}`)}${
    showInternalPath ? ` · ${slot.path ?? ""}` : ""
  }`;
  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: "grid", gap: 1.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle2">
              {translate(`workspace.comparison.nodeKind.${slot.kind}`)} ·{" "}
              {translate(`workspace.comparison.property.${slot.property}`)}
              {showInternalPath ? ` · ${slot.path ?? ""}` : ""}
            </Typography>
            {renderStatusBadge?.({ status }) ?? <Chip size="small" label={translate(translationStatusKey[status])} />}
          </Stack>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
            <TextField
              label={`${translate("workspace.slot.sourceText")} · ${nodeLabel}`}
              value={slot.sourceText}
              multiline
              fullWidth
              slotProps={{ input: { readOnly: true, "aria-readonly": true } }}
            />
            <TextField
              label={`${translate("workspace.slot.translatedText")} · ${nodeLabel}`}
              value={slot.existingText ?? ""}
              multiline
              fullWidth
              disabled={readOnly}
              onChange={(event) => onChange(event.target.value)}
              inputProps={{
                "aria-label": `${translate("workspace.slot.translatedText")} · ${nodeLabel}`
              }}
            />
          </Box>
          {slot.status === "stale" || slot.status === "manual-stale" ? (
            <Typography color="warning.main" variant="body2">
              {translate("workspace.status.stale")}
            </Typography>
          ) : null}
          <Button variant="outlined" onClick={onTranslate} disabled={readOnly}>
            {translate("workspace.slot.translateSingle")}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

function TranslationWorkspaceContent(props: TranslationWorkspaceProps) {
  const {
    schema,
    translationAdapter,
    readOnly = false,
    slots: workspaceSlots,
    showInternalPath = false,
    localeSelectorMode = "tabs"
  } = props;
  const { translator } = useFormEngineI18n();
  const translate = (key: string, params: Record<string, unknown> = {}) => translator(key, params);
  const {
    workspace,
    newLocale,
    setNewLocale,
    handleAddLocale,
    localeLabel,
    headerProps,
    actionsProps,
    localeSelectorProps,
    errorMessage
  } = useTranslationWorkspaceView(props, translate);
  return (
    <Stack spacing={2} data-testid="translation-workspace">
      {workspaceSlots?.renderHeader?.(headerProps) ?? (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
          <Typography variant="h6">{translate("workspace.header.title")}</Typography>
          <Typography variant="body2">
            {workspace.progress === undefined
              ? translate("workspace.header.progress", {
                  translated: workspace.summary.translatedCount,
                  total: workspace.summary.totalSlots,
                  percent: workspace.summary.completionPercentage
                })
              : translate("workspace.header.batchProgress", {
                  completed: workspace.progress.completed,
                  total: workspace.progress.total,
                  succeeded: workspace.progress.succeeded,
                  failed: workspace.progress.failed,
                  percent: workspace.progress.percentage
                })}
          </Typography>
          {workspaceSlots?.renderActions?.(actionsProps) ?? (
            <>
              <Button
                variant="contained"
                onClick={headerProps.onTranslateAll}
                disabled={readOnly || workspace.isTranslating}
              >
                {translate("workspace.header.translateAll")}
              </Button>
              {workspace.isTranslating ? (
                <Button size="small" onClick={headerProps.onCancel}>
                  {translate("workspace.header.cancel")}
                </Button>
              ) : null}
            </>
          )}
        </Stack>
      )}
      <LinearProgress
        variant="determinate"
        value={workspace.progress?.percentage ?? workspace.summary.completionPercentage}
        aria-label={translate("workspace.header.progress", {
          translated: workspace.summary.translatedCount,
          total: workspace.summary.totalSlots,
          percent: workspace.summary.completionPercentage
        })}
      />
      {workspaceSlots?.renderLocaleSelector?.(localeSelectorProps) ?? (
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2">
            {translate("workspace.header.sourceLocale")}: {localeLabel(workspace.sourceLocale)}
          </Typography>
          <Typography variant="body2">{translate("workspace.header.targetLocale")}:</Typography>
          {localeSelectorMode === "select" ? (
            workspace.targetLocales.length > 1 ? (
              <TextField
                select
                size="small"
                label={translate("workspace.header.targetLocale")}
                value={workspace.targetLocale}
                onChange={(event) => workspace.setTargetLocale(event.target.value)}
                disabled={readOnly}
              >
                {workspace.targetLocales.map((locale) => (
                  <MenuItem key={locale} value={locale}>
                    {localeLabel(locale)}
                  </MenuItem>
                ))}
              </TextField>
            ) : null
          ) : (
            <Tabs
              value={workspace.targetLocale}
              onChange={(_event, value: string) => workspace.setTargetLocale(value)}
              aria-label={translate("workspace.header.targetLocale")}
            >
              {workspace.targetLocales.map((locale) => (
                <Tab key={locale} value={locale} label={localeLabel(locale)} />
              ))}
            </Tabs>
          )}
          <TextField
            size="small"
            label={translate("workspace.header.targetLocale")}
            value={newLocale}
            onChange={(event) => setNewLocale(event.target.value)}
          />
          <Button onClick={handleAddLocale} disabled={readOnly}>
            {translate("builder.addLocale")}
          </Button>
          <Button
            color="error"
            variant="outlined"
            onClick={() => void workspace.removeLocale(workspace.targetLocale)}
            disabled={
              readOnly ||
              workspace.targetLocale.length === 0 ||
              workspace.targetLocale === workspace.sourceLocale ||
              workspace.localeOptions.find((option) => option.locale === workspace.targetLocale)?.removable === false
            }
          >
            {translate("workspace.header.removeLocale")}
          </Button>
        </Stack>
      )}
      {workspace.error === undefined ? null : (
        <Box role="alert" sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Typography color="error">{errorMessage}</Typography>
          {workspace.error.type === "translation_failed" || workspace.error.type === "partial_failure" ? (
            <Button size="small" onClick={headerProps.onTranslateAll} disabled={workspace.isTranslating}>
              {translate("workspace.header.retry")}
            </Button>
          ) : null}
        </Box>
      )}
      {workspace.removeLocaleConfirmation}
      <Stack spacing={1.5}>
        {workspace.slots.length === 0 ? (
          <Typography color="text.secondary">
            {workspace.targetLocales.length === 0
              ? translate("workspace.empty.noTargetLocales")
              : translate("workspace.empty.noSlotsToTranslate")}
          </Typography>
        ) : (
          workspace.slots.map((slot) => {
            const rowProps: TranslationSlotRowProps = {
              slot,
              readOnly,
              onChange: (text) => workspace.setTranslation(slot, text),
              onTranslate: () => void workspace.translateSlot(slot)
            };
            const comparisonItem = comparisonItemFromSlot(schema, slot, translationAdapter !== undefined);
            const comparisonRowProps: TranslationComparisonItemRowProps = {
              item: comparisonItem,
              nodeKind: comparisonItem.targetKind,
              ...translationComparisonContext(schema, comparisonItem),
              sourceLocaleLabel: translate("workspace.comparison.sourceHeader", {
                locale: localeLabel(workspace.sourceLocale)
              }),
              targetLocaleLabel: translate("workspace.comparison.targetHeader", {
                locale: localeLabel(workspace.targetLocale)
              }),
              readOnly,
              onChange: rowProps.onChange,
              onTranslate: async () => {
                await workspace.translateSlot(slot);
              }
            };
            return (
              <span key={slot.path}>
                {workspaceSlots?.renderItemRow?.(comparisonRowProps) ?? workspaceSlots?.renderSlotRow?.(rowProps) ?? (
                  <SlotCard
                    {...rowProps}
                    translate={translate}
                    renderStatusBadge={workspaceSlots?.renderStatusBadge}
                    showInternalPath={showInternalPath}
                  />
                )}
              </span>
            );
          })
        )}
      </Stack>
    </Stack>
  );
}

export function TranslationWorkspace(props: TranslationWorkspaceProps) {
  const { i18n } = props;
  if (i18n === undefined) return <TranslationWorkspaceContent {...props} />;
  return (
    <FormEngineI18nProvider
      {...(i18n.locale === undefined ? {} : { locale: i18n.locale })}
      {...(i18n.fallbackLocale === undefined ? {} : { fallbackLocale: i18n.fallbackLocale })}
      {...(i18n.messages === undefined ? {} : { messages: i18n.messages })}
      {...(i18n.onMissingKey === undefined ? {} : { onMissingKey: i18n.onMissingKey })}
      {...(i18n.strict === undefined ? {} : { strict: i18n.strict })}
      {...(i18n.translator === undefined ? {} : { translator: i18n.translator })}
    >
      <TranslationWorkspaceContent {...props} />
    </FormEngineI18nProvider>
  );
}
