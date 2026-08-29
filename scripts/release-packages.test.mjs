import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  discoverReleasePackages,
  formatReleaseNotes,
  generateApiMigrationNotes,
  publishUnpublishedPackages,
  validateReleasePackages,
  waitForPublishedPackages
} from "./release-packages.mjs";

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

const repository = { type: "git", url: "git+https://github.com/nitta-a/form-engine-ts.git" };

test("discovers every package directory and validates release metadata", async () => {
  const root = await fixture({
    core: { name: "@form-engine-ts/core", version: "2.7.0", repository },
    adapter: { name: "@form-engine-ts/adapter", version: "2.7.0", repository }
  });
  try {
    assert.equal((await discoverReleasePackages(root)).length, 2);
    assert.equal((await validateReleasePackages("2.7.0", { rootDirectory: root })).length, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects mismatched and private packages", async () => {
  const root = await fixture({
    core: { name: "@form-engine-ts/core", version: "2.2.9", repository },
    hidden: { name: "@form-engine-ts/hidden", version: "2.7.0", private: true, repository }
  });
  try {
    await assert.rejects(validateReleasePackages("2.7.0", { rootDirectory: root }), /version is 2\.2\.9/);
    await writeFile(
      join(root, "packages", "core", "package.json"),
      JSON.stringify({ name: "@form-engine-ts/core", version: "2.7.0", repository })
    );
    await assert.rejects(validateReleasePackages("2.7.0", { rootDirectory: root }), /marked private/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects packages without matching repository metadata", async () => {
  const root = await fixture({
    storage: { name: "@form-engine-ts/storage", version: "2.7.0" }
  });
  try {
    await assert.rejects(validateReleasePackages("2.7.0", { rootDirectory: root }), /repository\.url/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("skips published versions and publishes only missing packages", async () => {
  const packages = [
    { directory: "/packages/core", manifest: { name: "@form-engine-ts/core", version: "2.7.0" } },
    { directory: "/packages/react", manifest: { name: "@form-engine-ts/react", version: "2.7.0" } }
  ];
  const calls = [];
  const result = await publishUnpublishedPackages(packages, {
    runCommand: async (command, args) => {
      calls.push([command, ...args]);
      if (command === "npm" && args[1].startsWith("@form-engine-ts/core")) {
        return { code: 0, stdout: '"2.7.0"', stderr: "" };
      }
      if (command === "npm") return { code: 1, stdout: "", stderr: "npm error code E404" };
      return { code: 0, stdout: "", stderr: "" };
    }
  });
  assert.deepEqual(result, {
    published: ["@form-engine-ts/react@2.7.0"],
    skipped: ["@form-engine-ts/core@2.7.0"]
  });
  assert.equal(calls.filter(([command]) => command === "pnpm").length, 1);
  assert.equal(calls.find(([command]) => command === "pnpm")?.includes("--provenance"), true);
  assert.equal(
    calls.filter(([command]) => command === "npm").every((call) => call.includes("--prefer-online")),
    true
  );
});

test("generates migration notes from public declaration changes", async () => {
  const notes = await generateApiMigrationNotes("v2.8.0", {
    runCommand: async () => ({
      code: 0,
      stdout: [
        "diff --git a/api-reports/core.d.ts b/api-reports/core.d.ts",
        "--- a/api-reports/core.d.ts",
        "+++ b/api-reports/core.d.ts",
        "-declare function oldApi(value: string): void;",
        "+declare function newApi(value: string): void;"
      ].join("\n"),
      stderr: ""
    })
  });
  assert.match(notes, /Compared with `v2\.8\.0`/);
  assert.match(notes, /core.*Removed\/changed.*oldApi/);
  assert.match(notes, /core.*Added\/changed.*newApi/);
});

test("does not publish when npm availability cannot be determined", async () => {
  await assert.rejects(
    publishUnpublishedPackages(
      [{ directory: "/packages/core", manifest: { name: "@form-engine-ts/core", version: "2.7.0" } }],
      { runCommand: async () => ({ code: 1, stdout: "", stderr: "ECONNRESET" }) }
    ),
    /Unable to determine/
  );
});

test("polls npm with exponential backoff until every exact version is visible", async () => {
  const packages = [
    { directory: "/packages/core", manifest: { name: "@form-engine-ts/core", version: "2.7.0" } },
    { directory: "/packages/react", manifest: { name: "@form-engine-ts/react", version: "2.7.0" } }
  ];
  let time = 0;
  let calls = 0;
  const waits = [];
  await waitForPublishedPackages(packages, {
    now: () => time,
    initialDelayMs: 10,
    maxDelayMs: 40,
    timeoutMs: 180,
    sleep: async (milliseconds) => {
      waits.push(milliseconds);
      time += milliseconds;
    },
    runCommand: async (_command, args) => {
      calls += 1;
      const visible = calls > 2 || String(args[1]).includes("core");
      return visible
        ? { code: 0, stdout: '"2.7.0"', stderr: "" }
        : { code: 1, stdout: "", stderr: "npm error code E404" };
    }
  });
  assert.deepEqual(waits, [10]);
  assert.equal(calls, 3);
});

test("times out npm polling and formats release package notes", async () => {
  const packages = [{ directory: "/packages/core", manifest: { name: "@form-engine-ts/core", version: "2.7.0" } }];
  let time = 0;
  await assert.rejects(
    waitForPublishedPackages(packages, {
      now: () => time,
      initialDelayMs: 10,
      timeoutMs: 20,
      sleep: async (milliseconds) => {
        time += milliseconds;
      },
      runCommand: async () => ({ code: 1, stdout: "", stderr: "not found" })
    }),
    /timed out.*core@2\.7\.0/
  );
  assert.match(
    formatReleaseNotes("2.7.0", {
      published: ["@form-engine-ts/core@2.7.0"],
      skipped: ["@form-engine-ts/react@2.7.0"]
    }),
    /Package publication \(2\.7\.0\)[\s\S]*Published[\s\S]*core@2\.7\.0[\s\S]*Already available[\s\S]*react@2\.7\.0/
  );
});
