import { access, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageDirectories = ["packages/core", "packages/react", "packages/mui"];

for (const packageDirectory of packageDirectories) {
  const directory = join(root, packageDirectory);
  const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
  const rootImport = manifest.exports["."]?.import;
  for (const [subpath, definition] of Object.entries(manifest.exports)) {
    const targets = typeof definition === "string" ? [definition] : Object.values(definition);
    for (const target of targets) {
      if (typeof target !== "string") continue;
      await access(join(directory, target));
    }
    if (subpath !== "." && typeof definition !== "string" && definition.import === rootImport) {
      throw new Error(`${manifest.name}${subpath} must not point at the root ESM entry.`);
    }
  }
}

console.log(`Verified package export targets for ${packageDirectories.length} packages.`);
