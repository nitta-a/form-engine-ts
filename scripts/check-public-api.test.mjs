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
