import type { FormSchema } from "@form-engine-ts/core";
import { FormEngineI18nContext, FormEngineI18nProviderScopeContext } from "@form-engine-ts/react";
import { ChevronRight } from "@mui/icons-material";
import { Collapse, IconButton, List, ListItem, ListItemButton, ListItemText, Paper, Typography } from "@mui/material";
import { useContext, useEffect, useState } from "react";

const EMPTY_PAGES: readonly never[] = [];

export interface MuiBuilderNavigatorProps {
  readonly schema: FormSchema;
  readonly activeFieldId?: string | undefined;
  readonly onActiveFieldChange?: (fieldId: string) => void;
  readonly selectedPageId?: string | undefined;
  readonly onSelectedPageChange?: (pageId: string) => void;
  readonly ariaLabel?: string;
  readonly pageLabel?: string;
  readonly questionsLabel?: string;
  readonly expandLabel?: string;
  readonly collapseLabel?: string;
  readonly dense?: boolean;
}

export function MuiBuilderNavigator({
  schema,
  activeFieldId,
  onActiveFieldChange,
  selectedPageId,
  onSelectedPageChange,
  ariaLabel,
  pageLabel,
  questionsLabel,
  expandLabel,
  collapseLabel,
  dense = false
}: MuiBuilderNavigatorProps) {
  const i18n = useContext(FormEngineI18nContext);
  const hasI18nProvider = useContext(FormEngineI18nProviderScopeContext);
  const translate = (key: string, fallback: string) => {
    if (!hasI18nProvider) return fallback;
    const translated = i18n.translator(key);
    return translated === key ? fallback : translated;
  };
  const resolvedAriaLabel = ariaLabel ?? translate("builder.structure", "Form structure");
  const resolvedPageLabel = pageLabel ?? translate("builder.page", "Page");
  const resolvedQuestionsLabel = questionsLabel ?? translate("builder.questions", "Questions");
  const resolvedExpandLabel = expandLabel ?? translate("builder.expand", "Expand");
  const resolvedCollapseLabel = collapseLabel ?? translate("builder.collapse", "Collapse");
  const pages = schema.pages;
  const pageList = pages ?? EMPTY_PAGES;
  const [expandedPages, setExpandedPages] = useState<ReadonlySet<string>>(
    () => new Set(pageList.map((page) => page.id))
  );

  useEffect(() => {
    setExpandedPages((current) => {
      const nextPages = schema.pages ?? EMPTY_PAGES;
      return new Set(nextPages.filter((page) => current.has(page.id) || nextPages.length === 1).map((page) => page.id));
    });
  }, [schema.pages]);

  const togglePage = (pageId: string) => {
    setExpandedPages((current) => {
      const next = new Set(current);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };

  const renderField = (fieldId: string, index: number) => {
    const field = schema.fields.find((candidate) => candidate.id === fieldId);
    if (field === undefined) return null;
    return (
      <ListItem key={field.id} disablePadding sx={{ pl: 2 }}>
        <ListItemButton
          selected={field.id === activeFieldId}
          aria-current={field.id === activeFieldId ? "true" : undefined}
          onClick={() => onActiveFieldChange?.(field.id)}
          dense={dense}
        >
          <ListItemText primary={field.title || `${resolvedQuestionsLabel} ${index + 1}`} />
        </ListItemButton>
      </ListItem>
    );
  };

  return (
    <Paper data-mui-slot="builder-navigator" variant="outlined" sx={{ p: dense ? 0.5 : 1 }}>
      <Typography component="h2" variant={dense ? "subtitle2" : "subtitle1"} sx={{ px: 1, py: 0.5 }}>
        {resolvedAriaLabel}
      </Typography>
      <List component="nav" aria-label={resolvedAriaLabel} disablePadding>
        {pageList.length === 0 ? (
          <>
            <ListItem disablePadding>
              <ListItemText primary={resolvedQuestionsLabel} sx={{ px: 1, py: 0.5 }} />
            </ListItem>
            {schema.fields.map((field, index) => renderField(field.id, index))}
          </>
        ) : (
          <>
            {pageList.map((page, pageIndex) => {
              const expanded = expandedPages.has(page.id);
              const pageTitle = page.title ?? `${resolvedPageLabel} ${pageIndex + 1}`;
              return (
                <ListItem key={page.id} disablePadding sx={{ display: "block" }}>
                  <ListItem component="div" sx={{ p: 0 }}>
                    <IconButton
                      size={dense ? "small" : "medium"}
                      aria-label={`${expanded ? resolvedCollapseLabel : resolvedExpandLabel} ${pageTitle}`}
                      aria-expanded={expanded}
                      onClick={() => togglePage(page.id)}
                    >
                      <ChevronRight
                        fontSize="small"
                        aria-hidden="true"
                        sx={{ transform: expanded ? "rotate(90deg)" : undefined }}
                      />
                    </IconButton>
                    <ListItemButton
                      selected={page.id === selectedPageId}
                      aria-current={page.id === selectedPageId ? "true" : undefined}
                      onClick={() => onSelectedPageChange?.(page.id)}
                      dense={dense}
                    >
                      <ListItemText primary={pageTitle} />
                    </ListItemButton>
                  </ListItem>
                  <Collapse in={expanded} timeout="auto" unmountOnExit>
                    <List disablePadding aria-label={`${pageTitle} ${resolvedQuestionsLabel.toLowerCase()}`}>
                      {page.questionIds.map((fieldId, index) => renderField(fieldId, index))}
                    </List>
                  </Collapse>
                </ListItem>
              );
            })}
            {schema.fields.some((field) => !pageList.some((page) => page.questionIds.includes(field.id))) ? (
              <>
                <ListItem disablePadding>
                  <ListItemText primary={resolvedQuestionsLabel} sx={{ px: 1, py: 0.5 }} />
                </ListItem>
                {schema.fields
                  .filter((field) => !pageList.some((page) => page.questionIds.includes(field.id)))
                  .map((field, index) => renderField(field.id, index))}
              </>
            ) : null}
          </>
        )}
      </List>
    </Paper>
  );
}
