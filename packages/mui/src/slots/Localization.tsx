import type { BuilderLocalizationSlotProps, FormBuilderSlots } from "@form-engine-ts/react";
import { ExpandMore } from "@mui/icons-material";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Chip,
  Stack,
  Tab,
  Tabs,
  Typography
} from "@mui/material";
import type { ComponentType, KeyboardEvent, ReactNode, SyntheticEvent } from "react";
import { useEffect, useState } from "react";
import { useResolvedMuiAdapterOptions } from "../context";
import type { LocaleOptionItem, MuiAdapterOptions } from "../types";

const DEFAULT_EMPTY_STATE_MESSAGE =
  "No translation locales have been added yet. Select a language from the dropdown above to add one.";

function normalizeLocaleOptions(
  options: readonly (LocaleOptionItem | string)[],
  getLocaleLabel?: (locale: string) => string
): LocaleOptionItem[] {
  const seen = new Set<string>();
  const normalized: LocaleOptionItem[] = [];
  for (const item of options) {
    const value = typeof item === "string" ? item : item.value;
    if (value.length === 0 || seen.has(value)) continue;
    seen.add(value);
    normalized.push({ value, label: typeof item === "string" ? (getLocaleLabel?.(value) ?? value) : item.label });
  }
  return normalized;
}

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
    const [pendingFocusLocale, setPendingFocusLocale] = useState<string | null>(null);
    const locales = Array.from(
      new Set((schema.supportedLocales ?? []).filter((locale) => locale !== schema.defaultLocale))
    );
    const editingLocaleConfigured = locales.includes(currentLocale);
    const registeredLocales = new Set([
      ...(schema.defaultLocale === undefined ? [] : [schema.defaultLocale]),
      ...(schema.supportedLocales ?? [])
    ]);
    const localizationOptions = resolved.localizationOptions ?? {};
    const availableLocaleSource = localizationOptions.availableLocales;
    const availableLocaleOptions =
      availableLocaleSource === undefined
        ? policy?.allowedLocales?.map((value) => ({
            value,
            label: resolved.getLocaleLabel?.(value) ?? value
          }))
        : normalizeLocaleOptions(availableLocaleSource, resolved.getLocaleLabel);
    const filteredAvailableLocales = availableLocaleOptions?.filter(
      (locale) =>
        !registeredLocales.has(locale.value) &&
        (policy?.allowedLocales === undefined || policy.allowedLocales.includes(locale.value))
    );
    const hasLocaleSelector = filteredAvailableLocales !== undefined;
    const localeLimitReached = policy?.maxLocales !== undefined && registeredLocales.size >= policy.maxLocales;
    const normalizedLocale = newLocale.trim();
    const selectedLocaleAvailable =
      !hasLocaleSelector || filteredAvailableLocales.some((locale) => locale.value === normalizedLocale);
    const localeAllowed = policy?.allowedLocales === undefined || policy.allowedLocales.includes(normalizedLocale);
    const canAddLocale =
      !readOnly &&
      normalizedLocale.length > 0 &&
      selectedLocaleAvailable &&
      localeAllowed &&
      !registeredLocales.has(normalizedLocale) &&
      !localeLimitReached;
    const handleTabChange = (_event: SyntheticEvent, value: string) => onCurrentLocaleChange(value);
    const addLocale = () => {
      if (!canAddLocale) return;
      const result = actions.addLocale(normalizedLocale);
      if (!result.success) return;
      onCurrentLocaleChange(normalizedLocale);
      if (localizationOptions.autoFocusNewTab ?? true) setPendingFocusLocale(normalizedLocale);
      setNewLocale("");
    };
    const handleAddKeyDown = (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== "Enter" || !canAddLocale) return;
      event.preventDefault();
      event.stopPropagation();
      addLocale();
    };
    useEffect(() => {
      if (pendingFocusLocale === null || currentLocale !== pendingFocusLocale) return;
      const tab = document.getElementById(`mui-builder-locale-tab-${pendingFocusLocale}`);
      if (tab === null) return;
      tab.focus();
      setPendingFocusLocale(null);
    }, [currentLocale, pendingFocusLocale]);

    const stackProps = resolved.muiSlotProps?.stack;
    const collapsible = localizationOptions.collapsible ?? false;
    const defaultLocaleControl = localizationOptions.defaultLocaleControl ?? "editable";
    const configuredTranslationLocales = locales.filter((locale) => locale !== schema.defaultLocale);
    const configuredLocales = [
      ...(schema.defaultLocale === undefined ? [] : [schema.defaultLocale]),
      ...configuredTranslationLocales
    ];
    const legacySummaryLabel =
      configuredTranslationLocales.length === 0
        ? "Translations not configured"
        : `${configuredLocales.length} ${configuredLocales.length === 1 ? "language" : "languages"} configured: ${configuredLocales
            .map((locale) =>
              locale === schema.defaultLocale
                ? `${resolved.getLocaleLabel?.(locale) ?? locale} (default)`
                : (resolved.getLocaleLabel?.(locale) ?? locale)
            )
            .join(", ")}`;
    const emptyStateMessage =
      localizationOptions.emptyStateMessage === undefined
        ? DEFAULT_EMPTY_STATE_MESSAGE
        : translate(localizationOptions.emptyStateMessage);
    const summaryContext = {
      defaultLocale: schema.defaultLocale ?? "",
      supportedLocales: schema.supportedLocales ?? [],
      totalLocales: registeredLocales.size
    } as const;
    const summary =
      localizationOptions.renderSummary === undefined ? (
        localizationOptions.showSummary ? (
          configuredTranslationLocales.length > 0 ? (
            <Alert severity="success" sx={{ mb: 2 }}>
              {translate("builder.localization.localesConfiguredSummary", {
                count: schema.supportedLocales?.length ?? 0
              })}
            </Alert>
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>
              {translate("builder.localization.noLocalesConfigured")}
            </Alert>
          )
        ) : null
      ) : (
        localizationOptions.renderSummary(summaryContext)
      );
    const title = (
      <Stack alignItems="center" direction="row" spacing={1}>
        <Typography variant="subtitle1" fontWeight="bold">
          {translate("builder.localization")}
        </Typography>
        {localizationOptions.renderSummary === undefined &&
        localizationOptions.showSummary &&
        configuredTranslationLocales.length > 0 ? (
          <Chip
            label={legacySummaryLabel}
            size="small"
            color={configuredTranslationLocales.length > 0 ? "primary" : "default"}
            variant="outlined"
          />
        ) : null}
      </Stack>
    );
    const noCandidateLocales = hasLocaleSelector && filteredAvailableLocales.length === 0;
    const candidateHelperText = localeLimitReached
      ? undefined
      : noCandidateLocales
        ? translate("builder.localization.allLocalesAdded")
        : undefined;
    const content = (
      <Stack {...stackProps} spacing={resolved.dense ? 1 : 2}>
        {!collapsible ? title : null}
        {summary}
        <Stack
          {...stackProps}
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "stretch", sm: "center" }}
          spacing={resolved.dense ? 1 : 2}
          sx={{ mt: 1 }}
        >
          {defaultLocaleControl === "hidden" ? null : (
            <Box sx={{ flexGrow: 1, minWidth: 0, width: { xs: "100%", sm: "auto" } }}>
              {defaultLocaleControl === "readOnly" ? (
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
            </Box>
          )}
          <Box sx={{ flexGrow: 1, minWidth: 0, width: { xs: "100%", sm: "auto" } }} onKeyDownCapture={handleAddKeyDown}>
            {hasLocaleSelector ? (
              <Select
                id="mui-builder-new-locale"
                label={translate("builder.localization.selectLocaleToAdd")}
                value={newLocale}
                options={filteredAvailableLocales.map((locale) => ({ value: locale.value, label: locale.label }))}
                {...(candidateHelperText === undefined ? {} : { helperText: candidateHelperText })}
                disabled={readOnly || localeLimitReached || noCandidateLocales}
                onChange={setNewLocale}
              />
            ) : (
              <TextInput
                id="mui-builder-new-locale"
                label={translate("builder.addLocale")}
                value={newLocale}
                disabled={readOnly || localeLimitReached}
                onChange={setNewLocale}
              />
            )}
          </Box>
          <Box
            sx={{
              flexShrink: 0,
              minWidth: "max-content",
              ...((localizationOptions.noWrapActions ?? true) ? { whiteSpace: "nowrap" } : {})
            }}
          >
            <Button
              variant="primary"
              action="addLocale"
              noWrap={localizationOptions.noWrapActions ?? true}
              disabled={!canAddLocale}
              onClick={addLocale}
            >
              {translate("builder.addLocale")}
            </Button>
          </Box>
        </Stack>
        {localeLimitReached ? (
          <Typography variant="body2" color="text.secondary">
            {translate("builder.localization.maxLocalesReached", { max: policy?.maxLocales ?? 0 })}
          </Typography>
        ) : null}
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
                id={`mui-builder-locale-tab-${locale}`}
                key={locale}
                value={locale}
                label={resolved.getLocaleLabel?.(locale) ?? locale}
                disabled={readOnly && locale !== currentLocale}
                sx={{ whiteSpace: "nowrap" }}
              />
            ))}
          </Tabs>
        )}
        {!translationAdapterAvailable ? null : (
          <Box sx={{ minWidth: "max-content", whiteSpace: "nowrap" }}>
            <Button
              variant="secondary"
              noWrap={localizationOptions.noWrapActions ?? true}
              disabled={readOnly || !editingLocaleConfigured || isTranslating}
              onClick={onAutoTranslate}
            >
              {isTranslating ? translate("builder.translating") : translate("builder.autoTranslate")}
            </Button>
          </Box>
        )}
        {translationError === undefined ? null : <ErrorMessage message={translationError} />}
        {!editingLocaleConfigured ? (
          <Typography variant="body2" color="text.secondary">
            {locales.length === 0 ? emptyStateMessage : translate("builder.selectLocale")}
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
      localizationOptions.defaultExpanded === "when-configured"
        ? configured
        : localizationOptions.defaultExpanded === "always"
          ? true
          : (localizationOptions.defaultExpanded ?? false);
    if (collapsible) {
      return (
        <Accordion {...resolved.muiSlotProps?.accordion} data-mui-slot="localization" defaultExpanded={defaultExpanded}>
          <AccordionSummary expandIcon={<ExpandMore />}>{title}</AccordionSummary>
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
