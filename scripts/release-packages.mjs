import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

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

export async function publishUnpublishedPackages(packages, options = {}) {
  const execute = options.runCommand ?? runCommand;
  const published = [];
  const skipped = [];
  for (const pkg of packages) {
    const identifier = `${pkg.manifest.name}@${pkg.manifest.version}`;
    const lookup = await execute("npm", ["view", identifier, "version", "--json"], { capture: true });
    if (lookup.code === 0) {
      skipped.push(identifier);
      options.onStatus?.(`skip ${identifier} (already published)`);
      continue;
    }
    if (!isNotFound(lookup)) {
      throw new Error(`Unable to determine npm publication state for ${identifier}: ${lookup.stderr || lookup.stdout}`);
    }
    options.onStatus?.(`publish ${identifier}`);
    const result = await execute("pnpm", ["--dir", pkg.directory, "publish", "--access", "public", "--no-git-checks"], {
      env: options.env
    });
    if (result.code !== 0) throw new Error(`Publishing ${identifier} failed with exit code ${result.code}.`);
    published.push(identifier);
  }
  return { published, skipped };
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
    const packages = await discoverReleasePackages();
    const result = await publishUnpublishedPackages(packages, { onStatus: console.log, env: process.env });
    console.log(`Published ${result.published.length}; skipped ${result.skipped.length}.`);
    return;
  }
  throw new Error("Usage: node scripts/release-packages.mjs <validate|publish>");
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
