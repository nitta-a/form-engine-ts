import type { BuilderLocalizationSlotProps, FormBuilderSlots } from "@form-engine-ts/react";
import { Box, Stack, Tab, Tabs, Typography } from "@mui/material";
import type { ComponentType, SyntheticEvent } from "react";
import { useState } from "react";
import type { MuiAdapterOptions } from "../types";
import { resolveMuiAdapterOptions } from "../types";

export function createMuiLocalizationSlot(options?: MuiAdapterOptions): ComponentType<BuilderLocalizationSlotProps> {
  const resolved = resolveMuiAdapterOptions(options);
  return function MuiLocalization({
    schema,
    currentLocale,
    onCurrentLocaleChange,
    onAutoTranslate,
    isTranslating,
    translationError,
    readOnly,
    actions,
    components
  }: BuilderLocalizationSlotProps) {
    const { Button, ErrorMessage, TextArea, TextInput } = components;
    const [newLocale, setNewLocale] = useState("");
    const locales = Array.from(
      new Set([
        ...(schema.supportedLocales ?? []),
        ...(schema.defaultLocale === undefined ? [] : [schema.defaultLocale])
      ])
    );
    const handleTabChange = (_event: SyntheticEvent, value: string) => onCurrentLocaleChange(value);
    const addLocale = () => {
      const normalized = newLocale.trim();
      if (normalized.length === 0) return;
      const result = actions.addLocale(normalized);
      if (!result.success) return;
      onCurrentLocaleChange(normalized);
      setNewLocale("");
    };
    return (
      <Box
        data-mui-slot="localization"
        sx={{
          mt: resolved.dense ? 1 : 2,
          p: resolved.dense ? 1.5 : 2,
          border: 1,
          borderColor: "divider",
          borderRadius: 1
        }}
      >
        <Stack spacing={resolved.dense ? 1 : 2}>
          <Typography variant="subtitle1" fontWeight="bold">
            Localization
          </Typography>
          <TextInput
            id="mui-builder-completion-message"
            label="Completion message"
            value={schema.completionMessage ?? ""}
            disabled={readOnly}
            onChange={(value) => actions.setSourceText({ kind: "form" }, "completionMessage", value)}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={resolved.dense ? 1 : 2}>
            <TextInput
              id="mui-builder-default-locale"
              label="Default locale"
              value={schema.defaultLocale ?? ""}
              disabled={readOnly}
              onChange={(value) => actions.setDefaultLocale(value)}
            />
            <TextInput
              id="mui-builder-new-locale"
              label="Add locale"
              value={newLocale}
              disabled={readOnly}
              onChange={setNewLocale}
            />
            <Button disabled={readOnly || newLocale.trim().length === 0} onClick={addLocale}>
              Add locale
            </Button>
          </Stack>
          {locales.length === 0 ? null : (
            <Tabs
              value={locales.includes(currentLocale) ? currentLocale : false}
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
              aria-label="Translation locale"
            >
              {locales.map((locale) => (
                <Tab key={locale} value={locale} label={locale} disabled={readOnly && locale !== currentLocale} />
              ))}
            </Tabs>
          )}
          <Button
            variant="secondary"
            disabled={readOnly || currentLocale.length === 0 || isTranslating}
            onClick={onAutoTranslate}
          >
            {isTranslating ? "Translating…" : "Translate all text"}
          </Button>
          {translationError === undefined ? null : <ErrorMessage message={translationError} />}
          {currentLocale.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Select a locale to edit translations.
            </Typography>
          ) : (
            <Stack spacing={resolved.dense ? 1 : 2}>
              <TextInput
                id={`mui-builder-${currentLocale}-form-title`}
                label="Translated form title"
                value={schema.translations?.[currentLocale]?.title ?? ""}
                disabled={readOnly}
                onChange={(value) => actions.setLocaleTranslation(currentLocale, { kind: "form" }, "title", value)}
              />
              <TextArea
                id={`mui-builder-${currentLocale}-form-description`}
                label="Translated form description"
                value={schema.translations?.[currentLocale]?.description ?? ""}
                disabled={readOnly}
                onChange={(value) =>
                  actions.setLocaleTranslation(currentLocale, { kind: "form" }, "description", value)
                }
              />
              <TextInput
                id={`mui-builder-${currentLocale}-completion-message`}
                label="Translated completion message"
                value={schema.translations?.[currentLocale]?.completionMessage ?? ""}
                disabled={readOnly}
                onChange={(value) =>
                  actions.setLocaleTranslation(currentLocale, { kind: "form" }, "completionMessage", value)
                }
              />
            </Stack>
          )}
        </Stack>
      </Box>
    );
  };
}

export const MuiLocalizationSlot: NonNullable<FormBuilderSlots["localization"]> = createMuiLocalizationSlot();
