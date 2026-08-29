import type { ConfirmRemoveLocaleSlotProps } from "@form-engine-ts/react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";

export interface TranslationWorkspaceDialogProps extends ConfirmRemoveLocaleSlotProps {
  readonly translate: (key: string, params?: Record<string, unknown>) => string;
}

export function TranslationWorkspaceDialog({
  localeLabel,
  translatedSlotsCount,
  isOpen,
  onConfirm,
  onCancel,
  translate
}: TranslationWorkspaceDialogProps) {
  return (
    <Dialog open={isOpen} onClose={onCancel} aria-labelledby="translation-remove-locale-title">
      <DialogTitle id="translation-remove-locale-title">{translate("workspace.confirm.removeLocaleTitle")}</DialogTitle>
      <DialogContent>
        {translate("workspace.confirm.removeLocaleMessage", { locale: localeLabel })}
        {translatedSlotsCount > 0
          ? ` ${translate("workspace.confirm.removeLocaleTranslatedCount", { count: translatedSlotsCount })}`
          : ""}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{translate("workspace.confirm.cancel")}</Button>
        <Button color="error" onClick={onConfirm} autoFocus>
          {translate("workspace.confirm.remove")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
