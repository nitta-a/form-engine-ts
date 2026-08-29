import type {
  AsyncTranslationAdapter,
  FormPolicy,
  FormSchema,
  LocaleOption,
  TranslationAdapter,
  TranslationStatus
} from "@form-engine-ts/core";
import {
  type LocaleSelectorProps,
  type TranslationComparisonItem,
  type TranslationComparisonItemRowProps,
  type TranslationEventPayload,
  type TranslationSlotChangeEvent,
  type TranslationSlotRowProps,
  type TranslationWorkspaceActionsProps,
  type TranslationWorkspaceError,
  type TranslationWorkspaceHeaderProps,
  type TranslationWorkspaceSlots,
  type UseTranslationWorkspaceOptions,
  useFormEngineI18n,
  useTranslationWorkspace
} from "@form-engine-ts/react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography
} from "@mui/material";
import { useState } from "react";

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
  readonly validateLocale?: UseTranslationWorkspaceOptions["validateLocale"];
  readonly slots?: TranslationWorkspaceSlots;
}

const statusKey: Record<TranslationStatus, Parameters<ReturnType<typeof useFormEngineI18n>["translator"]>[0]> = {
  missing: "workspace.status.missing",
  translated: "workspace.status.translated",
  stale: "workspace.status.stale",
  manual: "workspace.status.manual",
  "manual-stale": "workspace.status.manualStale"
};

function SlotCard({
  slot,
  readOnly,
  onChange,
  onTranslate,
  translate,
  renderStatusBadge
}: TranslationSlotRowProps & {
  readonly translate: ReturnType<typeof useFormEngineI18n>["translator"];
  readonly renderStatusBadge?: TranslationWorkspaceSlots["renderStatusBadge"];
}) {
  const status = slot.status ?? "missing";
  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: "grid", gap: 1.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle2">{slot.path}</Typography>
            {renderStatusBadge?.({ status }) ?? <Chip size="small" label={translate(statusKey[status])} />}
          </Stack>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
            <TextField
              label={`${translate("workspace.slot.sourceText")} · ${slot.path}`}
              value={slot.sourceText}
              multiline
              fullWidth
              slotProps={{ input: { readOnly: true, "aria-readonly": true } }}
            />
            <TextField
              label={`${translate("workspace.slot.translatedText")} · ${slot.path}`}
              value={slot.existingText ?? ""}
              multiline
              fullWidth
              disabled={readOnly}
              onChange={(event) => onChange(event.target.value)}
              inputProps={{ "aria-label": `${translate("workspace.slot.translatedText")} · ${slot.path}` }}
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

function comparisonItemFromSlot(
  schema: FormSchema,
  slot: import("@form-engine-ts/core").TranslationSlot,
  hasAdapter: boolean
): TranslationComparisonItem {
  const path = slot.path ?? `${slot.kind}.${slot.nodeId}.${slot.property}`;
  const fieldId = /^fields\.([^.]+)\./u.exec(path)?.[1];
  const field = schema.fields.find((candidate) => candidate.id === fieldId);
  const nodeTitle =
    slot.kind === "field" || slot.kind === "option"
      ? field?.title
      : slot.kind === "page"
        ? schema.pages?.find((page) => page.id === slot.nodeId)?.title
        : undefined;
  return {
    id: path,
    path,
    targetKind: slot.kind,
    targetProperty: slot.property,
    ...(nodeTitle === undefined ? {} : { nodeTitle }),
    sourceText: slot.sourceText,
    translatedText: slot.existingText ?? "",
    status: slot.status ?? "missing",
    translatable: hasAdapter && slot.sourceText.trim().length > 0
  };
}

function comparisonContext(
  schema: FormSchema,
  item: TranslationComparisonItem
): Pick<TranslationComparisonItemRowProps, "questionIndex" | "fieldType" | "optionIndex"> {
  const fieldId = /^fields\.([^.]+)\./u.exec(item.path)?.[1];
  if (fieldId === undefined) return {};
  const questionIndex = schema.fields.findIndex((field) => field.id === fieldId);
  const field = schema.fields[questionIndex];
  if (field === undefined) return {};
  if (item.targetKind === "field") return { questionIndex, fieldType: field.type };
  const optionId = /^fields\.[^.]+\.options\.([^.]+)\./u.exec(item.path)?.[1];
  const optionIndex = "options" in field ? field.options.findIndex((option) => option.id === optionId) : -1;
  return { questionIndex, fieldType: field.type, ...(optionIndex < 0 ? {} : { optionIndex }) };
}

function workspaceErrorMessage(
  error: TranslationWorkspaceError,
  translate: (key: string, params?: Record<string, unknown>) => string
): string {
  switch (error.type) {
    case "locale_not_allowed":
      return translate("workspace.errors.localeNotAllowed", { locale: error.locale });
    case "locale_already_exists":
      return translate("workspace.errors.localeAlreadyExists", { locale: error.locale });
    case "invalid_locale_format":
      return translate("workspace.errors.invalidLocale", { locale: error.locale });
    case "max_locales_exceeded":
      return translate("workspace.errors.maxLocalesExceeded", { max: error.max });
    case "read_only_mode":
      return translate("workspace.errors.readOnly");
    case "adapter_not_configured":
      return translate("workspace.errors.adapterNotConfigured");
    case "target_locale_missing":
      return translate("workspace.errors.targetLocaleMissing");
    case "translation_failed":
      return translate("workspace.errors.translationFailed");
    case "partial_failure":
      return translate("workspace.errors.partialFailure", { succeeded: error.succeeded, failed: error.failed });
    case "cancelled":
      return translate("workspace.errors.cancelled");
    case "custom_validation_failed":
      return error.message;
  }
}

export function TranslationWorkspace({
  schema,
  onChange,
  sourceLocale,
  targetLocale,
  translationAdapter,
  signal,
  readOnly = false,
  policy,
  availableLocales,
  onLocaleAdded,
  onLocaleRemoved,
  onLocaleChange,
  beforeRemoveLocale,
  onTranslationStart,
  onTranslationSuccess,
  onTranslationReport,
  onTranslationError,
  onTranslationChange,
  validateLocale,
  slots: workspaceSlots
}: TranslationWorkspaceProps) {
  const { translator } = useFormEngineI18n();
  const translate = (key: string, params: Record<string, unknown> = {}) => translator(key, params);
  const workspace = useTranslationWorkspace({
    schema,
    ...(onChange === undefined ? {} : { onChange }),
    ...(sourceLocale === undefined ? {} : { sourceLocale }),
    ...(targetLocale === undefined ? {} : { targetLocale }),
    ...(translationAdapter === undefined ? {} : { translationAdapter }),
    ...(signal === undefined ? {} : { signal }),
    readOnly,
    ...(policy === undefined ? {} : { policy }),
    ...(availableLocales === undefined ? {} : { availableLocales }),
    ...(onLocaleAdded === undefined ? {} : { onLocaleAdded }),
    ...(onLocaleRemoved === undefined ? {} : { onLocaleRemoved }),
    ...(onLocaleChange === undefined ? {} : { onLocaleChange }),
    ...(beforeRemoveLocale === undefined ? {} : { beforeRemoveLocale }),
    ...(workspaceSlots?.confirmRemoveLocale === undefined
      ? {}
      : { confirmRemoveLocale: workspaceSlots.confirmRemoveLocale }),
    ...(onTranslationStart === undefined ? {} : { onTranslationStart }),
    ...(onTranslationSuccess === undefined ? {} : { onTranslationSuccess }),
    ...(onTranslationReport === undefined ? {} : { onTranslationReport }),
    ...(onTranslationError === undefined ? {} : { onTranslationError }),
    ...(onTranslationChange === undefined ? {} : { onTranslationChange }),
    ...(validateLocale === undefined ? {} : { validateLocale })
  });
  const [newLocale, setNewLocale] = useState("");
  const headerProps: TranslationWorkspaceHeaderProps = {
    schema,
    sourceLocale: workspace.sourceLocale,
    targetLocale: workspace.targetLocale,
    summary: workspace.summary,
    onTranslateAll: () => void workspace.translateAll(),
    isTranslating: workspace.isTranslating,
    readOnly,
    ...(workspace.progress === undefined ? {} : { progress: workspace.progress }),
    onCancel: workspace.cancelTranslation
  };
  const actionsProps: TranslationWorkspaceActionsProps = {
    onTranslateAll: headerProps.onTranslateAll,
    isTranslating: workspace.isTranslating,
    readOnly
  };
  const localeSelectorProps: LocaleSelectorProps = {
    targetLocale: workspace.targetLocale,
    targetLocales: workspace.targetLocales,
    localeOptions: workspace.localeOptions,
    newLocale,
    readOnly,
    onTargetLocaleChange: workspace.setTargetLocale,
    onNewLocaleChange: setNewLocale,
    onAddLocale: () => {
      const result = workspace.addLocale(newLocale);
      if (result.success) setNewLocale("");
    }
  };
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
            {translate("workspace.header.sourceLocale")}: {workspace.sourceLocale}
          </Typography>
          <Typography variant="body2">{translate("workspace.header.targetLocale")}:</Typography>
          <Tabs
            value={workspace.targetLocale}
            onChange={(_event, value: string) => workspace.setTargetLocale(value)}
            aria-label={translate("workspace.header.targetLocale")}
          >
            {workspace.targetLocales.map((locale) => (
              <Tab
                key={locale}
                value={locale}
                label={workspace.localeOptions.find((option) => option.locale === locale)?.label ?? locale}
              />
            ))}
          </Tabs>
          <TextField
            size="small"
            label={translate("workspace.header.targetLocale")}
            value={newLocale}
            onChange={(event) => setNewLocale(event.target.value)}
          />
          <Button onClick={localeSelectorProps.onAddLocale} disabled={readOnly}>
            {translate("builder.addLocale")}
          </Button>
        </Stack>
      )}
      {workspace.error === undefined ? null : (
        <Box role="alert" sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Typography color="error">{workspaceErrorMessage(workspace.error, translate)}</Typography>
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
              ...comparisonContext(schema, comparisonItem),
              sourceLocaleLabel: translate("workspace.comparison.sourceHeader", { locale: workspace.sourceLocale }),
              targetLocaleLabel: translate("workspace.comparison.targetHeader", { locale: workspace.targetLocale }),
              readOnly,
              onChange: rowProps.onChange,
              onTranslate: async () => {
                await workspace.translateSlot(slot);
              }
            };
            return (
              <span key={slot.path}>
                {workspaceSlots?.renderItemRow?.(comparisonRowProps) ?? workspaceSlots?.renderSlotRow?.(rowProps) ?? (
                  <SlotCard {...rowProps} translate={translate} renderStatusBadge={workspaceSlots?.renderStatusBadge} />
                )}
              </span>
            );
          })
        )}
      </Stack>
    </Stack>
  );
}
