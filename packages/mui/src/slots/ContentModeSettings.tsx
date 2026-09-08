import { contentMetadataToJson, type FormEngineTranslationKey, getFormContentMode } from "@form-engine-ts/core";
import type { BuilderBasicSettingsSlotProps, FormBuilderSlots } from "@form-engine-ts/react";
import { Alert, AlertTitle, Stack, Typography } from "@mui/material";
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
    const { contentModeOptions, validationState } = useContext(MuiFormBuilderContext);
    const id = useId();
    const t = contentTranslation(locale, translate);
    const { Select } = components;
    const controls = contentModeOptions?.controls;
    const modeControl = controls?.mode ?? (contentModeOptions?.showSelector === true ? "editable" : "hidden");
    const settingsVisible =
      mode === "poll"
        ? controls?.resultVisibility !== "hidden" || controls?.strictOneVotePerUser !== "hidden"
        : mode === "quiz"
          ? controls?.showExplanation !== "hidden" || controls?.passingScore !== "hidden"
          : false;
    const validationVisible =
      mode !== "survey" &&
      contentModeOptions?.validation !== "hidden" &&
      validationState !== undefined &&
      !validationState.valid;
    if (modeControl === "hidden" && !settingsVisible && !validationVisible) return null;
    return (
      <Stack {...resolved.muiSlotProps?.stack} data-mui-slot="content-mode-settings" spacing={resolved.dense ? 1 : 2}>
        {modeControl === "hidden" ? null : (
          <Select
            id={`${id}-mode`}
            label={t("builder.content.mode")}
            value={mode}
            disabled={readOnly || modeControl === "readOnly"}
            options={[
              { value: "survey", label: t("builder.content.survey") },
              { value: "poll", label: t("builder.content.poll") },
              { value: "quiz", label: t("builder.content.quiz") }
            ]}
            onChange={(value) => {
              if (
                readOnly ||
                modeControl === "readOnly" ||
                (value !== "survey" && value !== "poll" && value !== "quiz")
              )
                return;
              onChange?.({ ...schema, metadata: contentMetadataToJson({ ...schema.metadata, mode: value }) });
            }}
          />
        )}
        {mode === "survey" || !settingsVisible ? null : (
          <Typography variant="subtitle2">
            {t(mode === "poll" ? "builder.content.pollSettings" : "builder.content.quizSettings")}
          </Typography>
        )}
        <ContentModeSettings
          components={components}
          translate={translate}
          {...(controls === undefined ? {} : { controls })}
          schema={schema}
          {...(onChange === undefined ? {} : { onChange })}
          locale={locale}
          readOnly={readOnly}
        />
        {validationVisible
          ? (contentModeOptions?.renderValidationSummary?.(validationState) ?? (
              <Alert severity="warning" role="alert">
                <AlertTitle>{t("builder.content.validationTitle")}</AlertTitle>
                <ul>
                  {validationState.issues.map((issue) => (
                    <li key={`${issue.source}-${issue.path}-${issue.code}`}>
                      {issue.source === "contentMode"
                        ? t(`builder.content.validation.${issue.code}` as FormEngineTranslationKey)
                        : issue.message}
                    </li>
                  ))}
                </ul>
              </Alert>
            ))
          : null}
      </Stack>
    );
  };
}

export const MuiContentModeSettingsSlot: NonNullable<FormBuilderSlots["basicSettingsAfter"]> =
  createMuiContentModeSettingsSlot();
