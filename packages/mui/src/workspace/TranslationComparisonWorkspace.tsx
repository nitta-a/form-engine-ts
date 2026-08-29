import type { FormSchema, TranslationAdapter, TranslationStatus } from "@form-engine-ts/core";
import {
  FormEngineI18nProvider,
  type TranslationComparisonHeaderProps,
  type TranslationComparisonItem,
  type TranslationComparisonItemRowProps,
  type UseTranslationComparisonOptions,
  useFormEngineI18n,
  useTranslationComparison
} from "@form-engine-ts/react";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import { Box, Chip, IconButton, Paper, TextField, Typography } from "@mui/material";
import type { ReactNode } from "react";
import type { MuiFormEngineI18nOptions } from "../types";

export interface TranslationComparisonWorkspaceProps {
  readonly schema: FormSchema;
  readonly sourceLocale?: string;
  readonly targetLocale: string;
  readonly readOnly?: boolean;
  readonly translationAdapter?: TranslationAdapter;
  readonly onChange?: (nextSchema: FormSchema) => void;
  readonly onTranslationChange?: UseTranslationComparisonOptions["onTranslationChange"];
  readonly i18n?: MuiFormEngineI18nOptions;
  readonly slots?: {
    readonly renderHeader?: (props: TranslationComparisonHeaderProps) => ReactNode;
    readonly renderItemRow?: (props: TranslationComparisonItemRowProps) => ReactNode;
    readonly renderStatusBadge?: (props: { readonly status: TranslationStatus }) => ReactNode;
  };
}

const statusKey: Record<TranslationStatus, string> = {
  missing: "workspace.status.missing",
  translated: "workspace.status.translated",
  stale: "workspace.status.stale",
  manual: "workspace.status.manual",
  "manual-stale": "workspace.status.manualStale"
};

const propertyKey: Record<TranslationComparisonItem["targetProperty"], string> = {
  title: "workspace.comparison.property.title",
  description: "workspace.comparison.property.description",
  label: "workspace.comparison.property.label",
  completionMessage: "workspace.comparison.property.completionMessage"
};

function statusColor(status: TranslationStatus): "default" | "success" | "warning" {
  if (status === "translated" || status === "manual") return "success";
  if (status === "stale" || status === "manual-stale") return "warning";
  return "default";
}

function ComparisonContent({
  schema,
  sourceLocale,
  targetLocale,
  readOnly = false,
  translationAdapter,
  onChange,
  onTranslationChange,
  slots
}: TranslationComparisonWorkspaceProps) {
  const { translator } = useFormEngineI18n();
  const translate = (key: string, params: Record<string, unknown> = {}) => translator(key, params);
  const comparison = useTranslationComparison({
    schema,
    targetLocale,
    ...(sourceLocale === undefined ? {} : { sourceLocale }),
    ...(translationAdapter === undefined ? {} : { translationAdapter }),
    readOnly,
    ...(onChange === undefined ? {} : { onChange }),
    ...(onTranslationChange === undefined ? {} : { onTranslationChange })
  });
  const headerProps: TranslationComparisonHeaderProps = {
    sourceLocale: comparison.sourceLocale,
    targetLocale: comparison.targetLocale,
    summary: comparison.summary,
    onTranslateAll: () => void comparison.translateAll(),
    isTranslating: comparison.isTranslating,
    readOnly
  };
  const sourceHeader = translate("workspace.comparison.sourceHeader", { locale: comparison.sourceLocale });
  const targetHeader = translate("workspace.comparison.targetHeader", { locale: comparison.targetLocale });

  return (
    <Box data-testid="translation-comparison-workspace">
      {slots?.renderHeader?.(headerProps) ?? (
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, alignItems: "center", mb: 2 }}>
          <Typography variant="h6">{translate("workspace.comparison.title")}</Typography>
          <Typography variant="body2" color="text.secondary">
            {comparison.summary.translated}/{comparison.summary.total}
          </Typography>
        </Box>
      )}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 1.5,
          mb: 1,
          px: 1
        }}
      >
        <Typography variant="subtitle2" color="text.secondary">
          {sourceHeader}
        </Typography>
        <Typography variant="subtitle2" color="text.secondary">
          {targetHeader}
        </Typography>
      </Box>
      <Box sx={{ display: "grid", gap: 1.5 }}>
        {comparison.items.map((item) => {
          const rowProps: TranslationComparisonItemRowProps = {
            item,
            readOnly,
            onChange: (text) => comparison.updateTranslation(item.path, text),
            onTranslate: () => void comparison.translateSingle(item.path)
          };
          return (
            <Box
              key={item.id}
              data-testid={`translation-comparison-row-${item.id.replace(/[^a-zA-Z0-9_-]/gu, "-")}`}
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                gap: 1.5,
                borderBottom: 1,
                borderColor: "divider",
                pb: 1.5
              }}
            >
              {slots?.renderItemRow?.(rowProps) ?? (
                <>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {item.nodeTitle === undefined
                        ? translate(propertyKey[item.targetProperty])
                        : `${item.nodeTitle} (${translate(propertyKey[item.targetProperty])})`}
                    </Typography>
                    <Paper
                      variant="outlined"
                      sx={{
                        bgcolor: "action.hover",
                        minHeight: 56,
                        p: 1.5,
                        mt: 0.5,
                        ...(item.status === "stale" || item.status === "manual-stale"
                          ? { borderColor: "warning.main", borderWidth: 2 }
                          : {})
                      }}
                    >
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                        {item.sourceText || translate("workspace.comparison.emptySource")}
                      </Typography>
                    </Paper>
                  </Box>
                  <Box>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                      {slots?.renderStatusBadge?.({ status: item.status }) ?? (
                        <Chip size="small" color={statusColor(item.status)} label={translate(statusKey[item.status])} />
                      )}
                      {item.translatable ? (
                        <IconButton
                          size="small"
                          aria-label={translate("workspace.slot.translateSingle")}
                          title={translate("workspace.slot.translateSingle")}
                          onClick={rowProps.onTranslate}
                          disabled={readOnly || comparison.isTranslating}
                        >
                          <AutoFixHighIcon fontSize="small" />
                        </IconButton>
                      ) : null}
                    </Box>
                    <TextField
                      fullWidth
                      multiline
                      minRows={2}
                      label={`${targetHeader} · ${item.nodeTitle ?? translate(propertyKey[item.targetProperty])}`}
                      value={item.translatedText}
                      onChange={(event) => rowProps.onChange(event.target.value)}
                      disabled={readOnly}
                      placeholder={item.status === "missing" ? targetHeader : undefined}
                      sx={
                        item.status === "stale" || item.status === "manual-stale"
                          ? { "& .MuiOutlinedInput-notchedOutline": { borderColor: "warning.main" } }
                          : undefined
                      }
                    />
                    {item.status === "stale" || item.status === "manual-stale" ? (
                      <Typography color="warning.main" variant="caption">
                        {translate("workspace.comparison.staleWarning")}
                      </Typography>
                    ) : null}
                  </Box>
                </>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export function TranslationComparisonWorkspace(props: TranslationComparisonWorkspaceProps) {
  const { i18n } = props;
  if (i18n === undefined) return <ComparisonContent {...props} />;
  return (
    <FormEngineI18nProvider
      {...(i18n.locale === undefined ? {} : { locale: i18n.locale })}
      {...(i18n.fallbackLocale === undefined ? {} : { fallbackLocale: i18n.fallbackLocale })}
      {...(i18n.messages === undefined ? {} : { messages: i18n.messages })}
      {...(i18n.onMissingKey === undefined ? {} : { onMissingKey: i18n.onMissingKey })}
      {...(i18n.strict === undefined ? {} : { strict: i18n.strict })}
      {...(i18n.translator === undefined ? {} : { translator: i18n.translator })}
    >
      <ComparisonContent {...props} />
    </FormEngineI18nProvider>
  );
}
