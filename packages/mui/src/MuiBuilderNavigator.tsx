import type { FormSchema } from "@form-engine-ts/core";
import { ChevronRight } from "@mui/icons-material";
import { Collapse, List, ListItem, ListItemButton, ListItemText, Paper, Typography } from "@mui/material";
import { useEffect, useState } from "react";

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
  readonly dense?: boolean;
}

export function MuiBuilderNavigator({
  schema,
  activeFieldId,
  onActiveFieldChange,
  selectedPageId,
  onSelectedPageChange,
  ariaLabel = "Form structure",
  pageLabel = "Page",
  questionsLabel = "Questions",
  dense = false
}: MuiBuilderNavigatorProps) {
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
    onSelectedPageChange?.(pageId);
    const firstFieldId = schema.pages
      ?.find((page) => page.id === pageId)
      ?.questionIds.find((fieldId) => schema.fields.some((field) => field.id === fieldId));
    if (firstFieldId !== undefined) onActiveFieldChange?.(firstFieldId);
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
          <ListItemText primary={field.title || `${questionsLabel} ${index + 1}`} />
        </ListItemButton>
      </ListItem>
    );
  };

  return (
    <Paper data-mui-slot="builder-navigator" variant="outlined" sx={{ p: dense ? 0.5 : 1 }}>
      <Typography component="h2" variant={dense ? "subtitle2" : "subtitle1"} sx={{ px: 1, py: 0.5 }}>
        {ariaLabel}
      </Typography>
      <List component="nav" aria-label={ariaLabel} disablePadding>
        {pageList.length === 0 ? (
          <>
            <ListItem disablePadding>
              <ListItemText primary={questionsLabel} sx={{ px: 1, py: 0.5 }} />
            </ListItem>
            {schema.fields.map((field, index) => renderField(field.id, index))}
          </>
        ) : (
          <>
            {pageList.map((page, pageIndex) => {
              const expanded = expandedPages.has(page.id);
              return (
                <ListItem key={page.id} disablePadding sx={{ display: "block" }}>
                  <ListItemButton
                    selected={page.id === selectedPageId}
                    aria-current={page.id === selectedPageId ? "true" : undefined}
                    aria-expanded={expanded}
                    onClick={() => togglePage(page.id)}
                    dense={dense}
                  >
                    <ChevronRight
                      fontSize="small"
                      aria-hidden="true"
                      sx={{ mr: 0.5, transform: expanded ? "rotate(90deg)" : undefined }}
                    />
                    <ListItemText primary={page.title ?? `${pageLabel} ${pageIndex + 1}`} />
                  </ListItemButton>
                  <Collapse in={expanded} timeout="auto" unmountOnExit>
                    <List disablePadding aria-label={`${page.title ?? `${pageLabel} ${pageIndex + 1}`} questions`}>
                      {page.questionIds.map((fieldId, index) => renderField(fieldId, index))}
                    </List>
                  </Collapse>
                </ListItem>
              );
            })}
            {schema.fields.some((field) => !pageList.some((page) => page.questionIds.includes(field.id))) ? (
              <>
                <ListItem disablePadding>
                  <ListItemText primary={questionsLabel} sx={{ px: 1, py: 0.5 }} />
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
