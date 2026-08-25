import type { BuilderLocalizationSlotProps, FormBuilderSlots } from "@form-engine-ts/react";
import { ExpandMore } from "@mui/icons-material";
import { Accordion, AccordionDetails, AccordionSummary, Box, Chip, Stack, Tab, Tabs, Typography } from "@mui/material";
import type { ComponentType, ReactNode, SyntheticEvent } from "react";
import { useState } from "react";
import { useResolvedMuiAdapterOptions } from "../context";
import type { MuiAdapterOptions } from "../types";

export function createMuiLocalizationSlot(options?: MuiAdapterOptions): ComponentType<BuilderLocalizationSlotProps> {
  return function MuiLocalization({
    schema,
    currentLocale,
    onCurrentLocaleChange,
    onAutoTranslate,
    isTranslating,
    translationError,
    policy,
    translationAdapterAvailable,
    readOnly,
    actions,
    components,
    translate
  }: BuilderLocalizationSlotProps) {
    const resolved = useResolvedMuiAdapterOptions(options);
    const { Button, ErrorMessage, Select, TextArea, TextInput } = components;
    const [newLocale, setNewLocale] = useState("");
    const locales = Array.from(
      new Set((schema.supportedLocales ?? []).filter((locale) => locale !== schema.defaultLocale))
    );
    const editingLocaleConfigured = locales.includes(currentLocale);
    const registeredLocales = new Set([
      ...(schema.defaultLocale === undefined ? [] : [schema.defaultLocale]),
      ...(schema.supportedLocales ?? [])
    ]);
    const availableAllowedLocales = policy?.allowedLocales?.filter((locale) => !registeredLocales.has(locale));
    const localeLimitReached = policy?.maxLocales !== undefined && registeredLocales.size >= policy.maxLocales;
    const normalizedLocale = newLocale.trim();
    const localeAllowed = policy?.allowedLocales === undefined || policy.allowedLocales.includes(normalizedLocale);
    const canAddLocale =
      !readOnly &&
      normalizedLocale.length > 0 &&
      localeAllowed &&
      !registeredLocales.has(normalizedLocale) &&
      !localeLimitReached;
    const handleTabChange = (_event: SyntheticEvent, value: string) => onCurrentLocaleChange(value);
    const addLocale = () => {
      if (!canAddLocale) return;
      const result = actions.addLocale(normalizedLocale);
      if (!result.success) return;
      onCurrentLocaleChange(normalizedLocale);
      setNewLocale("");
    };
    const stackProps = resolved.muiSlotProps?.stack;
    const collapsible = resolved.localizationOptions?.collapsible ?? false;
    const defaultLocaleControl = resolved.localizationOptions?.defaultLocaleControl ?? "editable";
    const content = (
      <Stack {...stackProps} spacing={resolved.dense ? 1 : 2}>
        {!collapsible ? (
          <Typography variant="subtitle1" fontWeight="bold">
            {translate("builder.localization")}
          </Typography>
        ) : null}
        <Stack {...stackProps} direction={{ xs: "column", sm: "row" }} spacing={resolved.dense ? 1 : 2}>
          {defaultLocaleControl === "hidden" ? null : defaultLocaleControl === "readOnly" ? (
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">
                {translate("builder.defaultLocale")}
              </Typography>
              <Chip
                label={resolved.getLocaleLabel?.(schema.defaultLocale ?? "") ?? schema.defaultLocale ?? ""}
                size={resolved.size}
              />
            </Stack>
          ) : (
            <TextInput
              id="mui-builder-default-locale"
              label={translate("builder.defaultLocale")}
              value={schema.defaultLocale ?? ""}
              disabled={readOnly}
              onChange={(value) => {
                const result = actions.setDefaultLocale(value);
                if (result.success && value === currentLocale) onCurrentLocaleChange("");
              }}
            />
          )}
          {availableAllowedLocales === undefined ? (
            <TextInput
              id="mui-builder-new-locale"
              label={translate("builder.addLocale")}
              value={newLocale}
              disabled={readOnly || localeLimitReached}
              onChange={setNewLocale}
            />
          ) : (
            <Select
              id="mui-builder-new-locale"
              label={translate("builder.addLocale")}
              value={newLocale}
              options={[
                { value: "", label: "—" },
                ...availableAllowedLocales.map((locale) => ({
                  value: locale,
                  label: resolved.getLocaleLabel?.(locale) ?? locale
                }))
              ]}
              disabled={readOnly || localeLimitReached || availableAllowedLocales.length === 0}
              onChange={setNewLocale}
            />
          )}
          <Button variant="primary" action="addLocale" disabled={!canAddLocale} onClick={addLocale}>
            {translate("builder.addLocale")}
          </Button>
        </Stack>
        {locales.length === 0 ? null : (
          <Tabs
            value={editingLocaleConfigured ? currentLocale : false}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            aria-label={translate("builder.translationLocale")}
          >
            {locales.map((locale) => (
              <Tab
                key={locale}
                value={locale}
                label={resolved.getLocaleLabel?.(locale) ?? locale}
                disabled={readOnly && locale !== currentLocale}
              />
            ))}
          </Tabs>
        )}
        {!translationAdapterAvailable ? null : (
          <Button
            variant="secondary"
            disabled={readOnly || !editingLocaleConfigured || isTranslating}
            onClick={onAutoTranslate}
          >
            {isTranslating ? translate("builder.translating") : translate("builder.autoTranslate")}
          </Button>
        )}
        {translationError === undefined ? null : <ErrorMessage message={translationError} />}
        {!editingLocaleConfigured ? (
          <Typography variant="body2" color="text.secondary">
            {translate("builder.selectLocale")}
          </Typography>
        ) : (
          <Stack {...stackProps} spacing={resolved.dense ? 1 : 2}>
            <TextInput
              id={`mui-builder-${currentLocale}-form-title`}
              label={translate("builder.translatedFormTitle")}
              value={schema.translations?.[currentLocale]?.title ?? ""}
              disabled={readOnly}
              onChange={(value) => actions.setManualTranslation(currentLocale, { kind: "form" }, "title", value)}
            />
            <TextArea
              id={`mui-builder-${currentLocale}-form-description`}
              label={translate("builder.translatedFormDescription")}
              value={schema.translations?.[currentLocale]?.description ?? ""}
              disabled={readOnly}
              onChange={(value) => actions.setManualTranslation(currentLocale, { kind: "form" }, "description", value)}
            />
            <TextInput
              id={`mui-builder-${currentLocale}-completion-message`}
              label={translate("builder.translatedCompletionMessage")}
              value={schema.translations?.[currentLocale]?.completionMessage ?? ""}
              disabled={readOnly}
              onChange={(value) =>
                actions.setManualTranslation(currentLocale, { kind: "form" }, "completionMessage", value)
              }
            />
          </Stack>
        )}
      </Stack>
    );
    const configured = locales.length > 0;
    const defaultExpanded =
      resolved.localizationOptions?.defaultExpanded === "when-configured"
        ? configured
        : (resolved.localizationOptions?.defaultExpanded ?? false);
    if (collapsible) {
      return (
        <Accordion {...resolved.muiSlotProps?.accordion} data-mui-slot="localization" defaultExpanded={defaultExpanded}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="subtitle1" fontWeight="bold">
              {translate("builder.localization")}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>{content}</AccordionDetails>
        </Accordion>
      );
    }
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
        {content as ReactNode}
      </Box>
    );
  };
}

export const MuiLocalizationSlot: NonNullable<FormBuilderSlots["localization"]> = createMuiLocalizationSlot();
