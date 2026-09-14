import type { FormPage } from "@form-engine-ts/core";
import { BuilderPageConditionEditor, type BuilderPagesSlotProps } from "@form-engine-ts/react";
import { Card, Stack } from "@mui/material";
import { type ComponentType, useId, useState } from "react";
import { useResolvedMuiAdapterOptions } from "../context";
import type { MuiAdapterOptions } from "../types";

export interface MuiPagesEditorProps extends BuilderPagesSlotProps {}

export function createMuiPagesEditorSlot(options?: MuiAdapterOptions): ComponentType<MuiPagesEditorProps> {
  return function MuiPagesEditorView({
    schema,
    actions,
    components,
    translate,
    readOnly,
    features,
    currentLocale,
    pageEditorMode = "all",
    selectedPageId,
    onSelectedPageChange
  }: MuiPagesEditorProps) {
    const resolved = useResolvedMuiAdapterOptions(options);
    const id = useId();
    const [selectedQuestionId, setSelectedQuestionId] = useState("");
    const { Button, IconButton, TextInput, TextArea, Select, Section, Fieldset } = components;
    const pages = schema.pages;
    const movableIds = new Set(
      pages?.filter((page) => page.questionIds.length > 1).flatMap((page) => page.questionIds)
    );
    const movable = schema.fields.filter((field) => movableIds.has(field.id));
    const questionId = movable.some((field) => field.id === selectedQuestionId)
      ? selectedQuestionId
      : (movable[0]?.id ?? "");
    const pagesToRender =
      pageEditorMode === "single" && selectedPageId !== undefined
        ? (pages?.filter((page) => page.id === selectedPageId) ?? [])
        : (pages ?? []);
    const pageOptions = (pages ?? []).map((page, index) => ({
      value: page.id,
      label: page.title ?? `${translate("builder.newPage")} ${index + 1}`
    }));
    const renderPage = (page: FormPage, index: number) => {
      const pageIndex = pages?.findIndex((candidate) => candidate.id === page.id) ?? index;
      const title = page.title ?? `${translate("builder.newPage")} ${pageIndex + 1}`;
      return (
        <Card
          key={page.id}
          variant="outlined"
          {...resolved.muiSlotProps?.card}
          sx={resolved.muiSlotProps?.card?.sx ?? { p: resolved.dense ? 1.5 : 2 }}
        >
          <Fieldset legend={title} disabled={readOnly}>
            <Stack direction="row" spacing={1}>
              <IconButton
                actionType="moveUp"
                title={translate("builder.moveUp", { title })}
                disabled={readOnly || pageIndex === 0}
                onClick={() => actions.movePage(page.id, pageIndex - 1)}
              />
              <IconButton
                actionType="moveDown"
                title={translate("builder.moveDown", { title })}
                disabled={readOnly || pageIndex === pageOptions.length - 1}
                onClick={() => actions.movePage(page.id, pageIndex + 1)}
              />
              <IconButton
                actionType="delete"
                title={translate("builder.delete", { title })}
                disabled={readOnly}
                onClick={() => actions.removePage(page.id)}
              />
            </Stack>
            <small>
              {pages?.length === 1 ? translate("builder.pageDeleteLast") : translate("builder.pageDeleteMoves")}
            </small>
            <TextInput
              id={`${id}-${page.id}-title`}
              label={translate("builder.pageTitle")}
              value={page.title ?? ""}
              disabled={readOnly}
              onChange={(value) => actions.setSourceText({ kind: "page", id: page.id }, "title", value)}
            />
            <TextArea
              id={`${id}-${page.id}-description`}
              label={translate("builder.pageDescription")}
              value={page.description ?? ""}
              disabled={readOnly}
              onChange={(value) => actions.setSourceText({ kind: "page", id: page.id }, "description", value)}
            />
            {features?.localization === false || currentLocale.length === 0 ? null : (
              <Fieldset
                legend={translate("builder.translation", {
                  locale: resolved.getLocaleLabel?.(currentLocale) ?? currentLocale
                })}
              >
                <TextInput
                  id={`${id}-${page.id}-${currentLocale}-title`}
                  label={translate("builder.pageTitle")}
                  value={page.translations?.[currentLocale]?.title ?? ""}
                  disabled={readOnly}
                  onChange={(value) =>
                    actions.setManualTranslation(currentLocale, { kind: "page", id: page.id }, "title", value)
                  }
                />
                <TextArea
                  id={`${id}-${page.id}-${currentLocale}-description`}
                  label={translate("builder.pageDescription")}
                  value={page.translations?.[currentLocale]?.description ?? ""}
                  disabled={readOnly}
                  onChange={(value) =>
                    actions.setManualTranslation(currentLocale, { kind: "page", id: page.id }, "description", value)
                  }
                />
              </Fieldset>
            )}
            {schema.fields
              .filter((field) => page.questionIds.includes(field.id))
              .map((field) => (
                <Select
                  key={field.id}
                  id={`${id}-assignment-${field.id}`}
                  label={field.title}
                  value={page.id}
                  disabled={readOnly}
                  options={pageOptions}
                  onChange={(value) => actions.assignFieldToPage(field.id, value)}
                />
              ))}
            {features?.conditions === false ? null : (
              <BuilderPageConditionEditor
                schema={schema}
                page={page}
                components={components}
                translate={translate}
                readOnly={readOnly}
                onChange={(condition) =>
                  actions.updatePage(page.id, (current) => {
                    const { displayCondition: _condition, ...rest } = current;
                    return condition === undefined ? rest : { ...current, displayCondition: condition };
                  })
                }
              />
            )}
          </Fieldset>
        </Card>
      );
    };
    if (features?.pages === false) return null;
    return (
      <Section title={translate("builder.pages")} headingId={`${id}-heading`}>
        <Stack {...resolved.muiSlotProps?.stack} data-mui-slot="pages-editor" spacing={resolved.dense ? 1 : 2}>
          {pages === undefined ? (
            <Button disabled={readOnly || schema.fields.length === 0} onClick={() => actions.addPage()}>
              {translate("builder.enablePages")}
            </Button>
          ) : (
            <>
              {pageEditorMode === "single" ? (
                <Stack direction="column" spacing={0.5} role="tablist" aria-label={translate("builder.pages")}>
                  {pages.map((page, index) => (
                    <Button
                      key={page.id}
                      variant={page.id === selectedPageId ? "primary" : "secondary"}
                      onClick={() => onSelectedPageChange?.(page.id)}
                    >
                      {index + 1}. {page.title ?? `${translate("builder.newPage")} ${index + 1}`} (
                      {page.questionIds.length})
                    </Button>
                  ))}
                </Stack>
              ) : null}
              {pagesToRender.map(renderPage)}
              <Select
                id={`${id}-new-page-question`}
                label={translate("builder.pageQuestionToMove")}
                value={questionId}
                disabled={readOnly || movable.length === 0}
                onChange={setSelectedQuestionId}
                options={
                  movable.length === 0
                    ? [{ value: "", label: "—" }]
                    : movable.map((field) => ({ value: field.id, label: field.title }))
                }
              />
              {movable.length === 0 ? <small role="status">{translate("builder.noPageQuestions")}</small> : null}
              <Button disabled={readOnly || movable.length === 0} onClick={() => actions.addPage(questionId)}>
                {translate("builder.splitPage")}
              </Button>
            </>
          )}
        </Stack>
      </Section>
    );
  };
}

export const MuiPagesEditor = createMuiPagesEditorSlot();
export const MuiPagesEditorSlot = MuiPagesEditor;
