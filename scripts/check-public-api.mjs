import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { discoverReleasePackages } from "./release-packages.mjs";

function normalize(value) {
  return `${value.replaceAll("\r\n", "\n").trimEnd()}\n`;
}

async function main() {
  const mode = process.argv[2] ?? "check";
  if (mode !== "check" && mode !== "update") {
    throw new Error("Usage: node scripts/check-public-api.mjs <check|update>");
  }
  const root = process.cwd();
  const reportDirectory = join(root, "api-reports");
  const packages = await discoverReleasePackages(root);
  if (mode === "update") await mkdir(reportDirectory, { recursive: true });
  const changed = [];
  for (const pkg of packages) {
    const packageName = basename(pkg.directory);
    const declarationPath = join(pkg.directory, "dist", "index.d.ts");
    const reportPath = join(reportDirectory, `${packageName}.d.ts`);
    const declaration = normalize(await readFile(declarationPath, "utf8"));
    if (mode === "update") {
      await writeFile(reportPath, declaration);
      continue;
    }
    let report;
    try {
      report = normalize(await readFile(reportPath, "utf8"));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      changed.push(`${packageName} (missing report)`);
      continue;
    }
    if (report !== declaration) changed.push(packageName);
  }
  if (changed.length > 0) {
    throw new Error(
      `Public API reports changed for ${changed.join(", ")}. Review compatibility, then run pnpm api:update.`
    );
  }
  console.log(`${mode === "update" ? "Updated" : "Verified"} ${packages.length} public API reports.`);
}

await main();
