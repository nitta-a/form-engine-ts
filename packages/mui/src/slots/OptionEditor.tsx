import type { BuilderOptionEditorSlotProps, FormBuilderSlots } from "@form-engine-ts/react";
import { Stack } from "@mui/material";
import type { ComponentType } from "react";
import { useResolvedMuiAdapterOptions } from "../context";
import type { MuiAdapterOptions } from "../types";

export function createMuiOptionEditorSlot(options?: MuiAdapterOptions): ComponentType<BuilderOptionEditorSlotProps> {
  return function MuiOptionEditor({
    field,
    option,
    index,
    currentLocale,
    readOnly,
    actions,
    components,
    translate
  }: BuilderOptionEditorSlotProps) {
    const resolved = useResolvedMuiAdapterOptions(options);
    const { IconButton, TextInput } = components;
    const describedBy = option.label.trim().length === 0 ? `mui-option-${option.id}-error` : undefined;
    return (
      <Stack {...resolved.muiSlotProps?.stack} data-mui-slot="option-editor" spacing={resolved.dense ? 0.75 : 1}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "flex-start" }}>
          <TextInput
            id={`mui-option-${option.id}`}
            label={translate("builder.optionLabel", { index: index + 1 })}
            value={option.label}
            required
            error={option.label.trim().length === 0}
            helperText={option.label.trim().length === 0 ? translate("builder.required") : ""}
            aria-describedby={describedBy}
            disabled={readOnly}
            onChange={(value) => actions.updateOption(field.id, option.id, (current) => ({ ...current, label: value }))}
          />
          <Stack direction="row" spacing={0.5}>
            <IconButton
              actionType="moveUp"
              title={translate("builder.moveUp", { title: option.label })}
              disabled={readOnly || index === 0}
              onClick={() => actions.moveOption(field.id, option.id, index - 1)}
            />
            <IconButton
              actionType="moveDown"
              title={translate("builder.moveDown", { title: option.label })}
              disabled={readOnly || index === field.options.length - 1}
              onClick={() => actions.moveOption(field.id, option.id, index + 1)}
            />
            <IconButton
              actionType="delete"
              title={translate("builder.delete", { title: option.label })}
              disabled={readOnly || field.options.length <= 1}
              onClick={() => actions.removeOption(field.id, option.id)}
            />
          </Stack>
        </Stack>
        {currentLocale.length === 0 ? null : (
          <TextInput
            id={`mui-option-${option.id}-${currentLocale}`}
            label={translate("builder.translation", {
              locale: resolved.getLocaleLabel?.(currentLocale) ?? currentLocale
            })}
            value={option.translations?.[currentLocale] ?? ""}
            disabled={readOnly}
            onChange={(value) =>
              actions.setManualTranslation(currentLocale, { kind: "option", id: option.id }, "label", value)
            }
          />
        )}
      </Stack>
    );
  };
}

export const MuiOptionEditorSlot: NonNullable<FormBuilderSlots["optionEditor"]> = createMuiOptionEditorSlot();
