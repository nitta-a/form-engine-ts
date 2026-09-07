import {
  createInitialSchemaByMode,
  type FormContentMode,
  type FormSchema,
  type FormStorageAdapter,
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
    void storage.listSchemas().then(
      (items) => {
        if (current === generation.current) setSchemas(items);
      },
      (cause: unknown) => {
        if (current === generation.current) setError(String(cause));
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
  const create = async (mode: FormContentMode, title: string, locale: string) => {
    const schema = createInitialSchemaByMode(mode, { title, locale, id: crypto.randomUUID() });
    if (mode === "survey") setSelected(schema);
    else await save(schema);
  };
  return {
    schemas: schemas.filter((schema) => filter === "all" || getFormContentMode(schema.metadata) === filter),
    filter,
    changeFilter,
    selected,
    setSelected,
    error,
    create,
    save
  };
}
