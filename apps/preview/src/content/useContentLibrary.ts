import {
  createInitialSchemaByMode,
  createSchemaFromTemplate,
  type FormContentMode,
  type FormSchema,
  type FormStorageAdapter,
  type FormTemplate,
  getFormContentMode
} from "@form-engine-ts/core";
import { useCallback, useEffect, useRef, useState } from "react";

function readFilter(): string {
  const value = new URLSearchParams(window.location.search).get("mode");
  return value === "survey" || value === "poll" || value === "quiz" ? value : "all";
}
export function useContentLibrary(storage: FormStorageAdapter) {
  const [schemas, setSchemas] = useState<readonly FormSchema[]>([]);
  const [filter, setFilter] = useState(readFilter);
  const [selected, setSelected] = useState<FormSchema>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  useEffect(() => {
    const onPop = () => setFilter(readFilter());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    const current = ++generation.current;
    setSelected(undefined);
    setSchemas([]);
    setError(undefined);
    setLoading(true);
    void storage.listSchemas().then(
      (items) => {
        if (current === generation.current) {
          setSchemas(items);
          setLoading(false);
        }
      },
      (cause: unknown) => {
        if (current === generation.current) {
          setError(String(cause));
          setLoading(false);
        }
      }
    );
    return () => {
      generation.current++;
    };
  }, [storage]);
  const changeFilter = (value: string) => {
    const url = new URL(window.location.href);
    if (value === "all") url.searchParams.delete("mode");
    else url.searchParams.set("mode", value);
    window.history.pushState(null, "", url);
    setFilter(value);
  };
  const save = useCallback(
    async (schema: FormSchema) => {
      const current = generation.current;
      await storage.saveSchema(schema);
      const items = await storage.listSchemas();
      if (current !== generation.current) return;
      setSchemas(items);
      setSelected(schema);
    },
    [storage]
  );
  const refresh = useCallback(async () => {
    const current = generation.current;
    try {
      const items = await storage.listSchemas();
      if (current !== generation.current) return;
      setSchemas(items);
      setError(undefined);
    } catch (cause) {
      if (current === generation.current) setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [storage]);
  const create = async (mode: FormContentMode, title: string, locale: string, template?: FormTemplate, id?: string) => {
    const schemaId = id ?? crypto.randomUUID();
    const schema =
      template === undefined
        ? createInitialSchemaByMode(mode, { title, locale, id: schemaId })
        : createSchemaFromTemplate({ template, id: schemaId, title });
    if (mode === "survey") setSelected(schema);
    else await save(schema);
  };
  const duplicate = async (schema: FormSchema, title: string) => {
    const copy = structuredClone(schema);
    const translations = { ...copy.translations };
    for (const [locale, text] of Object.entries(translations)) {
      const { title: _title, ...rest } = text;
      translations[locale] = rest;
    }
    await save({ ...copy, id: crypto.randomUUID(), version: 1, title, translations });
  };
  return {
    schemas: schemas.filter((schema) => filter === "all" || getFormContentMode(schema.metadata) === filter),
    allSchemas: schemas,
    filter,
    changeFilter,
    selected,
    setSelected,
    error,
    loading,
    create,
    duplicate,
    save,
    refresh
  };
}
