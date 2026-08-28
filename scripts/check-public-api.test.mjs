import assert from "node:assert/strict";
import test from "node:test";
import { assertSemverCompatibility, findBreakingApiChanges } from "./check-public-api.mjs";

function report(body, exports) {
  return `${body}\nexport { ${exports} };\n`;
}

test("detects removed parameters, requiredized properties, and changed types", () => {
  const previous = report(
    [
      "interface Options { readonly optional?: string; readonly stable: string; }",
      "declare function execute(value: string, count: number): Promise<string>;"
    ].join("\n"),
    "type Options, execute"
  );
  const current = report(
    [
      "interface Options { readonly optional: string; readonly stable: number; }",
      "declare function execute(value: string): Promise<string>;"
    ].join("\n"),
    "type Options, execute"
  );
  const changes = findBreakingApiChanges(previous, current, "fixture");
  assert.equal(
    changes.some((change) => /optional.*required/u.test(change)),
    true
  );
  assert.equal(
    changes.some((change) => /stable.*type changed/u.test(change)),
    true
  );
  assert.equal(
    changes.some((change) => /parameter 2 was removed/u.test(change)),
    true
  );
  assert.throws(() => assertSemverCompatibility(changes, "2.8.0", "2.9.0"), /major vX\.0\.0/);
  assert.doesNotThrow(() => assertSemverCompatibility(changes, "2.8.0", "3.0.0"));
});

test("allows additive unions, optional members, and trailing optional parameters", () => {
  const previous = report(
    [
      'type Result = { type: "one" };',
      "interface Options { readonly stable: string; readonly callback: (value: string) => void; }"
    ].join("\n"),
    "type Result, type Options"
  );
  const current = report(
    [
      'type Result = { type: "one" } | { type: "two" };',
      "interface Options { readonly stable: string; readonly added?: number; readonly callback: (value: string, extra?: number) => void; }"
    ].join("\n"),
    "type Result, type Options"
  );
  assert.deepEqual(findBreakingApiChanges(previous, current, "fixture"), []);
});

test("allows widening an interface property with an additive union", () => {
  const previous = report("interface Options { readonly value?: string; }", "type Options");
  const current = report("interface Options { readonly value?: string | number; }", "type Options");
  assert.deepEqual(findBreakingApiChanges(previous, current, "fixture"), []);
});

test("allows a defaulted generic parameter that preserves the previous property type", () => {
  const previous = report("interface Option { readonly value: string; }", "type Option");
  const current = report("interface Option<T extends string = string> { readonly value: T; }", "type Option");
  assert.deepEqual(findBreakingApiChanges(previous, current, "fixture"), []);
});

test("allows additive result members and returning a value from a void callback", () => {
  const previous = report("interface ActionResult { readonly execute: (value: string) => void; }", "type ActionResult");
  const current = report(
    "interface ActionResult { readonly execute: (value: string) => { readonly success: boolean }; readonly canExecute: (value: string) => boolean; }",
    "type ActionResult"
  );
  assert.deepEqual(findBreakingApiChanges(previous, current, "fixture"), []);
});

test("allows nested object union widening and preserving a callback overload", () => {
  const previous = report(
    'interface Options { readonly validate?: (locale: string, currentLocales: readonly string[]) => Result; } interface Result { readonly error?: { readonly type: "invalid"; readonly message: string; }; }',
    "type Options"
  );
  const current = report(
    'type Custom = (locale: string, context: { readonly locale: string; readonly currentLocales: readonly string[] }) => Result | boolean; interface Options { readonly validate?: ((locale: string, currentLocales: readonly string[]) => Result) | Custom; } interface Result { readonly error?: { readonly type: "invalid" | "duplicate"; readonly message: string; }; }',
    "type Options"
  );
  assert.deepEqual(findBreakingApiChanges(previous, current, "fixture"), []);
});

test("allows adding a compatible options union to an exported function value", () => {
  const previous = report(
    "declare const migrate: (schema: Schema, migrator?: (oldMeta: unknown, sourceText: string) => Metadata) => Schema; export { migrate };",
    "const migrate"
  );
  const current = report(
    "declare const migrate: (schema: Schema, migrator?: ((oldMeta: unknown, sourceText: string) => Metadata) | NewMigrator | Options) => Schema; export { migrate };",
    "const migrate"
  );
  assert.deepEqual(findBreakingApiChanges(previous, current, "fixture"), []);
});
