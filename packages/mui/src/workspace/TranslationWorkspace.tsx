import type {
  AsyncTranslationAdapter,
  FormSchema,
  TranslationAdapter,
  TranslationSlot,
  TranslationStatus
} from "@form-engine-ts/core";
import { type TranslationWorkspaceError, useTranslationWorkspace } from "@form-engine-ts/react";
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
}

const statusLabel: Record<TranslationStatus, string> = {
  missing: "Missing",
  translated: "Translated",
  stale: "Source changed",
  manual: "Manual",
  "manual-stale": "Manual / source changed"
};

function SlotCard({
  slot,
  readOnly,
  onChange,
  onTranslate
}: {
  readonly slot: TranslationSlot;
  readonly readOnly: boolean;
  readonly onChange: (text: string) => void;
  readonly onTranslate: () => void;
}) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle2">{slot.path}</Typography>
            <Chip size="small" label={statusLabel[slot.status ?? "missing"]} />
          </Stack>
          <TextField
            label="Source"
            value={slot.sourceText}
            multiline
            fullWidth
            slotProps={{ input: { readOnly: true } }}
          />
          <TextField
            label="Translation"
            value={slot.existingText ?? ""}
            multiline
            fullWidth
            disabled={readOnly}
            onChange={(event) => onChange(event.target.value)}
          />
          {slot.status === "stale" || slot.status === "manual-stale" ? (
            <Typography color="warning.main" variant="body2">
              The source text has changed since this translation was created.
            </Typography>
          ) : null}
          <Button variant="outlined" onClick={onTranslate} disabled={readOnly}>
            Translate this slot
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

function workspaceErrorMessage(error: TranslationWorkspaceError): string {
  switch (error.type) {
    case "locale_not_allowed":
      return `Locale "${error.locale}" is not allowed.`;
    case "locale_already_exists":
      return `Locale "${error.locale}" is already registered.`;
    case "invalid_locale_format":
      return `Invalid locale format: "${error.locale}"`;
    case "max_locales_exceeded":
      return `At most ${error.max} locales are allowed.`;
    case "read_only_mode":
      return "This workspace is read-only.";
    case "adapter_not_configured":
      return "A translation adapter is not configured.";
    case "target_locale_missing":
      return "A target locale is required.";
    case "translation_failed":
      return error.message;
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
  readOnly = false
}: TranslationWorkspaceProps) {
  const workspace = useTranslationWorkspace({
    schema,
    ...(onChange === undefined ? {} : { onChange }),
    ...(sourceLocale === undefined ? {} : { sourceLocale }),
    ...(targetLocale === undefined ? {} : { targetLocale }),
    ...(translationAdapter === undefined ? {} : { translationAdapter }),
    readOnly
  });
  const [newLocale, setNewLocale] = useState("");
  return (
    <Stack spacing={2} data-testid="translation-workspace">
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
        <Typography variant="h6">Translations</Typography>
        <Typography variant="body2">
          {workspace.summary.completionPercentage}% complete ({workspace.summary.translatedCount}/
          {workspace.summary.totalSlots})
        </Typography>
        <Button
          variant="contained"
          onClick={() => void workspace.translateAll()}
          disabled={readOnly || workspace.isTranslating}
        >
          Translate all
        </Button>
      </Stack>
      <LinearProgress variant="determinate" value={workspace.summary.completionPercentage} />
      <Stack direction="row" spacing={1} alignItems="center">
        <Tabs
          value={workspace.targetLocale}
          onChange={(_event, value: string) => workspace.setTargetLocale(value)}
          aria-label="Translation locales"
        >
          {workspace.targetLocales.map((locale) => (
            <Tab key={locale} value={locale} label={locale} />
          ))}
        </Tabs>
        <TextField
          size="small"
          label="Add locale"
          value={newLocale}
          onChange={(event) => setNewLocale(event.target.value)}
        />
        <Button
          onClick={() => {
            workspace.addLocale(newLocale);
            setNewLocale("");
          }}
          disabled={readOnly}
        >
          Add
        </Button>
      </Stack>
      {workspace.error === undefined ? null : (
        <Typography color="error">{workspaceErrorMessage(workspace.error)}</Typography>
      )}
      <Stack spacing={1.5}>
        {workspace.slots.map((slot) => (
          <SlotCard
            key={slot.path}
            slot={slot}
            readOnly={readOnly}
            onChange={(text) => workspace.setTranslation(slot, text)}
            onTranslate={() => void workspace.translateSlot(slot)}
          />
        ))}
      </Stack>
    </Stack>
  );
}
