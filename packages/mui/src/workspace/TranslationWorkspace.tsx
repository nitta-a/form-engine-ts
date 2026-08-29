import type {
  AsyncTranslationAdapter,
  FormSchema,
  LocaleOption,
  TranslationAdapter,
  TranslationStatus
} from "@form-engine-ts/core";
import {
  type LocaleSelectorProps,
  type TranslationEventPayload,
  type TranslationSlotChangeEvent,
  type TranslationSlotRowProps,
  type TranslationWorkspaceActionsProps,
  type TranslationWorkspaceError,
  type TranslationWorkspaceHeaderProps,
  type TranslationWorkspaceSlots,
  useFormEngineI18n,
  useTranslationWorkspace
} from "@form-engine-ts/react";
import {
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
  readonly readOnly?: boolean;
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
  readonly onTranslationError?: (params: {
    readonly targetLocale: string;
    readonly error: TranslationWorkspaceError;
  }) => void;
  readonly onTranslationChange?: (event: TranslationSlotChangeEvent) => void;
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
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle2">{slot.path}</Typography>
            {renderStatusBadge?.({ status }) ?? <Chip size="small" label={translate(statusKey[status])} />}
          </Stack>
          <TextField
            label={translate("workspace.slot.sourceText")}
            value={slot.sourceText}
            multiline
            fullWidth
            slotProps={{ input: { readOnly: true } }}
          />
          <TextField
            label={translate("workspace.slot.translatedText")}
            value={slot.existingText ?? ""}
            multiline
            fullWidth
            disabled={readOnly}
            onChange={(event) => onChange(event.target.value)}
          />
          {slot.status === "stale" || slot.status === "manual-stale" ? (
            <Typography color="warning.main" variant="body2">
              {translate("workspace.status.stale")}
            </Typography>
          ) : null}
          <Button variant="outlined" onClick={onTranslate} disabled={readOnly}>
            {translate("workspace.slot.translateSingle")}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

function workspaceErrorMessage(
  error: TranslationWorkspaceError,
  translate: (key: string, params?: Record<string, unknown>) => string
): string {
  switch (error.type) {
    case "locale_not_allowed":
      return translate("workspace.errors.localeNotAllowed", { locale: error.locale });
    case "locale_already_exists":
      return translate("workspace.errors.localeNotAllowed", { locale: error.locale });
    case "invalid_locale_format":
      return translate("workspace.errors.localeNotAllowed", { locale: error.locale });
    case "max_locales_exceeded":
      return translate("workspace.errors.maxLocalesExceeded", { max: error.max });
    case "read_only_mode":
      return translate("workspace.errors.readOnly");
    case "adapter_not_configured":
      return translate("workspace.errors.adapterNotConfigured");
    case "target_locale_missing":
      return translate("workspace.empty.noTargetLocales");
    case "translation_failed":
      return translate("workspace.errors.translationFailed");
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
  readOnly = false,
  availableLocales,
  onLocaleAdded,
  onLocaleRemoved,
  onLocaleChange,
  beforeRemoveLocale,
  onTranslationStart,
  onTranslationSuccess,
  onTranslationError,
  onTranslationChange,
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
    readOnly,
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
    ...(onTranslationError === undefined ? {} : { onTranslationError }),
    ...(onTranslationChange === undefined ? {} : { onTranslationChange })
  });
  const [newLocale, setNewLocale] = useState("");
  const headerProps: TranslationWorkspaceHeaderProps = {
    schema,
    sourceLocale: workspace.sourceLocale,
    targetLocale: workspace.targetLocale,
    summary: workspace.summary,
    onTranslateAll: () => void workspace.translateAll(),
    isTranslating: workspace.isTranslating,
    readOnly
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
            {translate("workspace.header.progress", {
              translated: workspace.summary.translatedCount,
              total: workspace.summary.totalSlots,
              percent: workspace.summary.completionPercentage
            })}
          </Typography>
          {workspaceSlots?.renderActions?.(actionsProps) ?? (
            <Button
              variant="contained"
              onClick={headerProps.onTranslateAll}
              disabled={readOnly || workspace.isTranslating}
            >
              {translate("workspace.header.translateAll")}
            </Button>
          )}
        </Stack>
      )}
      <LinearProgress variant="determinate" value={workspace.summary.completionPercentage} />
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
        <Typography color="error">{workspaceErrorMessage(workspace.error, translate)}</Typography>
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
            return (
              <span key={slot.path}>
                {workspaceSlots?.renderSlotRow?.(rowProps) ?? (
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
