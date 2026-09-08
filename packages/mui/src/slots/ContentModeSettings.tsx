import { contentMetadataToJson, getFormContentMode } from "@form-engine-ts/core";
import type { BuilderBasicSettingsSlotProps, FormBuilderSlots } from "@form-engine-ts/react";
import { Stack, Typography } from "@mui/material";
import { useContext, useId } from "react";
import { ContentModeSettings } from "../ContentModeSettings";
import { contentTranslation } from "../contentTranslation";
import { MuiFormBuilderContext, useResolvedMuiAdapterOptions } from "../context";
import type { MuiAdapterOptions } from "../types";

export function createMuiContentModeSettingsSlot(
  options?: MuiAdapterOptions
): NonNullable<FormBuilderSlots["basicSettingsAfter"]> {
  return function MuiContentModeSettingsSlot({
    schema,
    onChange,
    locale,
    readOnly,
    components,
    translate
  }: BuilderBasicSettingsSlotProps) {
    const mode = getFormContentMode(schema.metadata);
    const resolved = useResolvedMuiAdapterOptions(options);
    const { showContentModeSelector } = useContext(MuiFormBuilderContext);
    const id = useId();
    const t = contentTranslation(locale, translate);
    const { Select } = components;
    if (mode === "survey" && !showContentModeSelector) return null;
    return (
      <Stack {...resolved.muiSlotProps?.stack} data-mui-slot="content-mode-settings" spacing={resolved.dense ? 1 : 2}>
        {showContentModeSelector ? (
          <Select
            id={`${id}-mode`}
            label={t("builder.content.mode")}
            value={mode}
            disabled={readOnly}
            options={[
              { value: "survey", label: t("builder.content.survey") },
              { value: "poll", label: t("builder.content.poll") },
              { value: "quiz", label: t("builder.content.quiz") }
            ]}
            onChange={(value) => {
              if (readOnly || (value !== "survey" && value !== "poll" && value !== "quiz")) return;
              onChange?.({ ...schema, metadata: contentMetadataToJson({ ...schema.metadata, mode: value }) });
            }}
          />
        ) : null}
        {mode === "survey" ? null : (
          <Typography variant="subtitle2">
            {t(mode === "poll" ? "builder.content.pollSettings" : "builder.content.quizSettings")}
          </Typography>
        )}
        <ContentModeSettings
          components={components}
          translate={translate}
          schema={schema}
          {...(onChange === undefined ? {} : { onChange })}
          locale={locale}
          readOnly={readOnly}
        />
      </Stack>
    );
  };
}

export const MuiContentModeSettingsSlot: NonNullable<FormBuilderSlots["basicSettingsAfter"]> =
  createMuiContentModeSettingsSlot();
