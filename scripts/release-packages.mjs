import { spawn } from "node:child_process";
import { appendFile, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryUrl = "git+https://github.com/nitta-a/form-engine-ts.git";

export async function discoverReleasePackages(rootDirectory = process.cwd()) {
  const packagesDirectory = join(rootDirectory, "packages");
  const entries = await readdir(packagesDirectory, { withFileTypes: true });
  const packages = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const directory = join(packagesDirectory, entry.name);
    const manifestPath = join(directory, "package.json");
    try {
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      packages.push({ directory, manifestPath, manifest });
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return packages.sort((left, right) => String(left.manifest.name).localeCompare(String(right.manifest.name)));
}

export async function validateReleasePackages(expectedVersion, options = {}) {
  if (typeof expectedVersion !== "string" || expectedVersion.length === 0) {
    throw new TypeError("expectedVersion must not be empty.");
  }
  const packages = await discoverReleasePackages(options.rootDirectory);
  if (packages.length === 0) throw new Error("No release packages were discovered.");
  for (const pkg of packages) {
    if (pkg.manifest.version !== expectedVersion) {
      throw new Error(`${pkg.manifestPath} version is ${pkg.manifest.version}; expected ${expectedVersion}`);
    }
    if (pkg.manifest.private === true) throw new Error(`${pkg.manifestPath} is marked private`);
    if (typeof pkg.manifest.name !== "string" || pkg.manifest.name.length === 0) {
      throw new Error(`${pkg.manifestPath} has no package name`);
    }
    if (pkg.manifest.repository?.url !== repositoryUrl) {
      throw new Error(`${pkg.manifestPath} repository.url must be ${repositoryUrl}`);
    }
  }
  return packages;
}

export function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      shell: process.platform === "win32",
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit"
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

function isNotFound(result) {
  return (
    result.code !== 0 && /(?:E404|404 Not Found|is not in this registry)/i.test(`${result.stdout}\n${result.stderr}`)
  );
}

function npmViewArgs(identifier) {
  return ["view", identifier, "version", "--json", "--prefer-online", "--registry=https://registry.npmjs.org/"];
}

export async function publishUnpublishedPackages(packages, options = {}) {
  const execute = options.runCommand ?? runCommand;
  const published = [];
  const skipped = [];
  for (const pkg of packages) {
    const identifier = `${pkg.manifest.name}@${pkg.manifest.version}`;
    const lookup = await execute("npm", npmViewArgs(identifier), { capture: true });
    if (lookup.code === 0) {
      skipped.push(identifier);
      options.onStatus?.(`skip ${identifier} (already published)`);
      continue;
    }
    if (!isNotFound(lookup)) {
      throw new Error(`Unable to determine npm publication state for ${identifier}: ${lookup.stderr || lookup.stdout}`);
    }
    options.onStatus?.(`publish ${identifier}`);
    const result = await execute(
      "pnpm",
      ["--dir", pkg.directory, "publish", "--access", "public", "--provenance", "--no-git-checks"],
      { env: options.env }
    );
    if (result.code !== 0) throw new Error(`Publishing ${identifier} failed with exit code ${result.code}.`);
    published.push(identifier);
  }
  return { published, skipped };
}

export async function waitForPublishedPackages(packages, options = {}) {
  const execute = options.runCommand ?? runCommand;
  const timeoutMs = options.timeoutMs ?? 180_000;
  const initialDelayMs = options.initialDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 15_000;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const startedAt = now();
  let delayMs = initialDelayMs;
  let unavailable = packages;
  while (unavailable.length > 0) {
    const checks = await Promise.all(
      unavailable.map(async (pkg) => {
        const identifier = `${pkg.manifest.name}@${pkg.manifest.version}`;
        const result = await execute("npm", npmViewArgs(identifier), { capture: true });
        if (result.code !== 0) return pkg;
        try {
          return JSON.parse(result.stdout) === pkg.manifest.version ? null : pkg;
        } catch {
          return pkg;
        }
      })
    );
    unavailable = checks.filter((pkg) => pkg !== null);
    if (unavailable.length === 0) return;
    const elapsed = now() - startedAt;
    if (elapsed >= timeoutMs) {
      throw new Error(
        `npm publication verification timed out for: ${unavailable.map((pkg) => `${pkg.manifest.name}@${pkg.manifest.version}`).join(", ")}`
      );
    }
    const waitMs = Math.min(delayMs, maxDelayMs, timeoutMs - elapsed);
    options.onStatus?.(`waiting ${waitMs}ms for ${unavailable.length} npm package(s)`);
    await sleep(waitMs);
    delayMs = Math.min(maxDelayMs, delayMs * 2);
  }
}

export function formatReleaseNotes(version, result) {
  const list = (items) => (items.length === 0 ? "- None" : items.map((item) => `- \`${item}\``).join("\n"));
  return [
    `## Package publication (${version})`,
    "",
    "### Published",
    list(result.published),
    "",
    "### Already available",
    list(result.skipped)
  ].join("\n");
}

export async function resolvePreviousReleaseTag(expectedVersion, options = {}) {
  const execute = options.runCommand ?? runCommand;
  const current = await execute("git", ["describe", "--tags", "--abbrev=0"], { capture: true });
  if (current.code !== 0) return undefined;
  const currentTag = current.stdout.trim();
  if (currentTag.replace(/^v/, "") !== expectedVersion) return currentTag;
  const previous = await execute("git", ["describe", "--tags", "--abbrev=0", "HEAD^"], { capture: true });
  return previous.code === 0 ? previous.stdout.trim() : undefined;
}

export async function generateApiMigrationNotes(previousTag, options = {}) {
  if (previousTag === undefined) return "## API migration notes\n\n- No previous release tag was found.";
  const execute = options.runCommand ?? runCommand;
  const result = await execute("git", ["diff", "--unified=0", previousTag, "--", "api-reports"], { capture: true });
  if (result.code !== 0)
    throw new Error(`Unable to generate API migration notes from ${previousTag}: ${result.stderr}`);
  const changes = [];
  let report = "unknown";
  for (const line of result.stdout.split(/\r?\n/u)) {
    const match = /^\+\+\+ b\/api-reports\/(.+)\.d\.ts$/u.exec(line);
    if (match?.[1] !== undefined) {
      report = match[1];
      continue;
    }
    if ((!line.startsWith("+") && !line.startsWith("-")) || line.startsWith("+++") || line.startsWith("---")) {
      continue;
    }
    const declaration = line.slice(1).trim();
    if (declaration.length === 0 || declaration.startsWith("export {")) continue;
    changes.push({ report, kind: line[0] === "+" ? "Added/changed" : "Removed/changed", declaration });
  }
  if (changes.length === 0)
    return `## API migration notes\n\nCompared with \`${previousTag}\`.\n\n- No public declaration changes.`;
  return [
    "## API migration notes",
    "",
    `Compared with \`${previousTag}\`. Review changed signatures when upgrading:`,
    "",
    ...changes
      .slice(0, 100)
      .map(
        ({ report: packageReport, kind, declaration }) =>
          `- **${packageReport}** ${kind}: \`${declaration.slice(0, 240).replaceAll("`", "\\`")}\``
      ),
    ...(changes.length <= 100 ? [] : [`- ${changes.length - 100} additional declaration changes omitted.`])
  ].join("\n");
}

async function writeGitHubOutputs(version, result) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath === undefined) return;
  await appendFile(
    outputPath,
    `${[
      `version=${version}`,
      `published_json=${JSON.stringify(result.published)}`,
      `skipped_json=${JSON.stringify(result.skipped)}`
    ].join("\n")}\n`
  );
}

async function main() {
  const command = process.argv[2];
  const expectedVersion = (process.env.RELEASE_TAG ?? "").replace(/^v/, "");
  if (command === "validate") {
    const packages = await validateReleasePackages(expectedVersion);
    console.log(`Validated ${packages.length} release packages at ${expectedVersion}.`);
    return;
  }
  if (command === "publish") {
    const packages =
      expectedVersion.length === 0 ? await discoverReleasePackages() : await validateReleasePackages(expectedVersion);
    const result = await publishUnpublishedPackages(packages, { onStatus: console.log, env: process.env });
    await waitForPublishedPackages(packages, { onStatus: console.log });
    await writeGitHubOutputs(expectedVersion || String(packages[0]?.manifest.version ?? "unknown"), result);
    console.log(`Published ${result.published.length}; skipped ${result.skipped.length}.`);
    return;
  }
  if (command === "migration-notes") {
    const previousTag = await resolvePreviousReleaseTag(expectedVersion);
    console.log(await generateApiMigrationNotes(previousTag));
    return;
  }
  throw new Error("Usage: node scripts/release-packages.mjs <validate|publish|migration-notes>");
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
