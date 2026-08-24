import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { discoverReleasePackages, publishUnpublishedPackages, validateReleasePackages } from "./release-packages.mjs";

async function fixture(packages) {
  const root = await mkdtemp(join(tmpdir(), "form-engine-release-"));
  await mkdir(join(root, "packages"));
  for (const [directory, manifest] of Object.entries(packages)) {
    const packageDirectory = join(root, "packages", directory);
    await mkdir(packageDirectory);
    await writeFile(join(packageDirectory, "package.json"), JSON.stringify(manifest));
  }
  return root;
}

test("discovers every package directory and validates release metadata", async () => {
  const root = await fixture({
    core: { name: "@form-engine-ts/core", version: "2.6.0" },
    adapter: { name: "@form-engine-ts/adapter", version: "2.6.0" }
  });
  try {
    assert.equal((await discoverReleasePackages(root)).length, 2);
    assert.equal((await validateReleasePackages("2.6.0", { rootDirectory: root })).length, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects mismatched and private packages", async () => {
  const root = await fixture({
    core: { name: "@form-engine-ts/core", version: "2.2.9" },
    hidden: { name: "@form-engine-ts/hidden", version: "2.6.0", private: true }
  });
  try {
    await assert.rejects(validateReleasePackages("2.6.0", { rootDirectory: root }), /version is 2\.2\.9/);
    await writeFile(
      join(root, "packages", "core", "package.json"),
      JSON.stringify({ name: "@form-engine-ts/core", version: "2.6.0" })
    );
    await assert.rejects(validateReleasePackages("2.6.0", { rootDirectory: root }), /marked private/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("skips published versions and publishes only missing packages", async () => {
  const packages = [
    { directory: "/packages/core", manifest: { name: "@form-engine-ts/core", version: "2.6.0" } },
    { directory: "/packages/react", manifest: { name: "@form-engine-ts/react", version: "2.6.0" } }
  ];
  const calls = [];
  const result = await publishUnpublishedPackages(packages, {
    runCommand: async (command, args) => {
      calls.push([command, ...args]);
      if (command === "npm" && args[1].startsWith("@form-engine-ts/core")) {
        return { code: 0, stdout: '"2.6.0"', stderr: "" };
      }
      if (command === "npm") return { code: 1, stdout: "", stderr: "npm error code E404" };
      return { code: 0, stdout: "", stderr: "" };
    }
  });
  assert.deepEqual(result, {
    published: ["@form-engine-ts/react@2.6.0"],
    skipped: ["@form-engine-ts/core@2.6.0"]
  });
  assert.equal(calls.filter(([command]) => command === "pnpm").length, 1);
});

test("does not publish when npm availability cannot be determined", async () => {
  await assert.rejects(
    publishUnpublishedPackages(
      [{ directory: "/packages/core", manifest: { name: "@form-engine-ts/core", version: "2.6.0" } }],
      { runCommand: async () => ({ code: 1, stdout: "", stderr: "ECONNRESET" }) }
    ),
    /Unable to determine/
  );
});
