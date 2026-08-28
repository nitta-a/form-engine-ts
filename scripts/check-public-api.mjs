import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { discoverReleasePackages, resolvePreviousReleaseTag, runCommand } from "./release-packages.mjs";

function normalize(value) {
  return `${value.replaceAll("\r\n", "\n").trimEnd()}\n`;
}

function compactText(node, sourceFile) {
  return node.getText(sourceFile).replaceAll(/\s+/gu, " ").trim();
}

function declarationName(statement) {
  if (
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isFunctionDeclaration(statement) ||
    ts.isClassDeclaration(statement) ||
    ts.isEnumDeclaration(statement)
  ) {
    return statement.name?.text;
  }
  return undefined;
}

function collectPublicApi(sourceText, fileName) {
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declarations = new Map();
  const exports = new Set();
  for (const statement of sourceFile.statements) {
    const name = declarationName(statement);
    if (name !== undefined) {
      const existing = declarations.get(name) ?? [];
      existing.push(statement);
      declarations.set(name, existing);
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) declarations.set(declaration.name.text, [declaration]);
      }
    }
    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause !== undefined &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) exports.add(element.name.text);
    }
    if (
      statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) === true &&
      name !== undefined
    ) {
      exports.add(name);
    }
  }
  return { sourceFile, declarations, exports };
}

function isOptional(node) {
  return node.questionToken !== undefined || node.initializer !== undefined;
}

function isVoidType(node, sourceFile) {
  return node !== undefined && compactText(node, sourceFile) === "void";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function normalizeTypeWithDefaultParameters(node, sourceFile, declaration) {
  let value = compactText(node, sourceFile);
  for (const parameter of declaration?.typeParameters ?? []) {
    if (parameter.default === undefined || !ts.isIdentifier(parameter.name)) continue;
    const parameterName = escapeRegExp(parameter.name.text);
    const defaultType = compactText(parameter.default, sourceFile);
    value = value.replace(new RegExp(`\\b${parameterName}\\b`, "gu"), defaultType);
  }
  return value;
}

function resolveObjectMembers(node, sourceFile, seen = new Set()) {
  if (node === undefined) return undefined;
  if (ts.isTypeLiteralNode(node)) return node.members;
  if (!ts.isTypeReferenceNode(node) || !ts.isIdentifier(node.typeName) || seen.has(node.typeName.text)) {
    return undefined;
  }
  seen.add(node.typeName.text);
  const declaration = sourceFile.statements.find((statement) => declarationName(statement) === node.typeName.text);
  if (ts.isInterfaceDeclaration(declaration)) return declaration.members;
  if (ts.isTypeAliasDeclaration(declaration)) return resolveObjectMembers(declaration.type, sourceFile, seen);
  return undefined;
}

function isAdditiveObjectParameter(previousType, currentType, previousFile, currentFile) {
  const previousMembers = resolveObjectMembers(previousType, previousFile);
  const currentMembers = resolveObjectMembers(currentType, currentFile);
  if (previousMembers === undefined || currentMembers === undefined) return false;
  const currentByName = new Map(
    currentMembers
      .filter((member) => member.name !== undefined)
      .map((member) => [compactText(member.name, currentFile), member])
  );
  return previousMembers.every((member) => {
    if (member.name === undefined) return false;
    const currentMember = currentByName.get(compactText(member.name, previousFile));
    return currentMember !== undefined && compactText(member, previousFile) === compactText(currentMember, currentFile);
  });
}

function compareSignatures(name, previous, current, previousFile, currentFile) {
  const changes = [];
  const previousTypeParameters =
    previous.typeParameters?.map((parameter) => compactText(parameter, previousFile)) ?? [];
  const currentTypeParameters = current.typeParameters?.map((parameter) => compactText(parameter, currentFile)) ?? [];
  if (previousTypeParameters.join("|") !== currentTypeParameters.join("|")) {
    changes.push(`${name}: generic parameters changed`);
  }
  for (let index = 0; index < previous.parameters.length; index += 1) {
    const oldParameter = previous.parameters[index];
    const newParameter = current.parameters[index];
    if (newParameter === undefined) {
      changes.push(`${name}: parameter ${index + 1} was removed`);
      continue;
    }
    const oldType = oldParameter.type === undefined ? "unknown" : compactText(oldParameter.type, previousFile);
    const newType = newParameter.type === undefined ? "unknown" : compactText(newParameter.type, currentFile);
    if (
      (oldType !== newType &&
        !isAdditiveObjectParameter(oldParameter.type, newParameter.type, previousFile, currentFile) &&
        !isWidenedType(oldParameter.type, newParameter.type, previousFile, currentFile)) ||
      (oldParameter.dotDotDotToken !== undefined) !== (newParameter.dotDotDotToken !== undefined)
    ) {
      changes.push(`${name}: parameter ${index + 1} changed from ${oldType} to ${newType}`);
    }
    if (isOptional(oldParameter) && !isOptional(newParameter)) {
      changes.push(`${name}: parameter ${index + 1} became required`);
    }
  }
  for (const [index, parameter] of current.parameters.slice(previous.parameters.length).entries()) {
    if (!isOptional(parameter) && parameter.dotDotDotToken === undefined) {
      changes.push(`${name}: required parameter ${previous.parameters.length + index + 1} was added`);
    }
  }
  const oldReturn = previous.type === undefined ? "unknown" : compactText(previous.type, previousFile);
  const newReturn = current.type === undefined ? "unknown" : compactText(current.type, currentFile);
  if (oldReturn !== newReturn && !isVoidType(previous.type, previousFile)) {
    changes.push(`${name}: return type changed from ${oldReturn} to ${newReturn}`);
  }
  return changes;
}

function memberKey(member, sourceFile, index) {
  if (member.name !== undefined) return compactText(member.name, sourceFile);
  if (ts.isCallSignatureDeclaration(member)) return `[[call:${index}]]`;
  if (ts.isConstructSignatureDeclaration(member)) return `[[construct:${index}]]`;
  if (ts.isIndexSignatureDeclaration(member)) return `[[index:${index}]]`;
  return `[[member:${index}]]`;
}

function isWidenedType(previousType, currentType, previousFile, currentFile) {
  if (previousType === undefined || currentType === undefined) return false;
  const previousParts = unionParts(previousType, previousFile);
  const currentParts = unionParts(currentType, currentFile);
  return [...previousParts].every((part) => currentParts.has(part));
}

function isAdditiveObjectType(previousType, currentType, previousFile, currentFile) {
  const previousMembers = resolveObjectMembers(previousType, previousFile);
  const currentMembers = resolveObjectMembers(currentType, currentFile);
  if (previousMembers === undefined || currentMembers === undefined) return false;
  const currentByName = new Map(
    currentMembers
      .filter((member) => member.name !== undefined)
      .map((member) => [compactText(member.name, currentFile), member])
  );
  return previousMembers.every((member) => {
    if (member.name === undefined) return false;
    const currentMember = currentByName.get(compactText(member.name, previousFile));
    if (currentMember === undefined || (isOptional(member) && !isOptional(currentMember))) return false;
    if (member.type === undefined || currentMember.type === undefined) {
      return compactText(member, previousFile) === compactText(currentMember, currentFile);
    }
    return (
      compactText(member.type, previousFile) === compactText(currentMember.type, currentFile) ||
      isWidenedType(member.type, currentMember.type, previousFile, currentFile) ||
      isAdditiveObjectType(member.type, currentMember.type, previousFile, currentFile)
    );
  });
}

function compareMembers(name, previous, current, previousFile, currentFile, currentDeclaration) {
  const changes = [];
  const oldMembers = new Map(previous.members.map((member, index) => [memberKey(member, previousFile, index), member]));
  const newMembers = new Map(current.members.map((member, index) => [memberKey(member, currentFile, index), member]));
  for (const [key, oldMember] of oldMembers) {
    const newMember = newMembers.get(key);
    if (newMember === undefined) {
      changes.push(`${name}.${key}: public member was removed`);
      continue;
    }
    if (isOptional(oldMember) && !isOptional(newMember)) changes.push(`${name}.${key}: member became required`);
    if (ts.isMethodSignature(oldMember) && ts.isMethodSignature(newMember)) {
      changes.push(...compareSignatures(`${name}.${key}`, oldMember, newMember, previousFile, currentFile));
      continue;
    }
    if (ts.isPropertySignature(oldMember) && ts.isPropertySignature(newMember)) {
      if (
        oldMember.type !== undefined &&
        newMember.type !== undefined &&
        ts.isFunctionTypeNode(oldMember.type) &&
        ts.isFunctionTypeNode(newMember.type)
      ) {
        changes.push(...compareSignatures(`${name}.${key}`, oldMember.type, newMember.type, previousFile, currentFile));
      } else {
        const oldType = oldMember.type === undefined ? "unknown" : compactText(oldMember.type, previousFile);
        const newType =
          newMember.type === undefined
            ? "unknown"
            : normalizeTypeWithDefaultParameters(newMember.type, currentFile, currentDeclaration);
        if (
          oldType !== newType &&
          !isWidenedType(oldMember.type, newMember.type, previousFile, currentFile) &&
          !isAdditiveObjectType(oldMember.type, newMember.type, previousFile, currentFile)
        ) {
          changes.push(`${name}.${key}: type changed from ${oldType} to ${newType}`);
        }
      }
      continue;
    }
    if (
      oldMember.kind !== newMember.kind ||
      compactText(oldMember, previousFile) !== compactText(newMember, currentFile)
    ) {
      changes.push(`${name}.${key}: signature changed`);
    }
  }
  for (const [key, newMember] of newMembers) {
    if (!oldMembers.has(key) && !isOptional(newMember) && !name.endsWith("Result")) {
      changes.push(`${name}.${key}: required member was added`);
    }
  }
  return changes;
}

function unionParts(node, sourceFile) {
  let unwrapped = node;
  while (ts.isParenthesizedTypeNode(unwrapped)) unwrapped = unwrapped.type;
  return ts.isUnionTypeNode(unwrapped)
    ? new Set(
        unwrapped.types.map((part) => {
          let normalized = part;
          while (ts.isParenthesizedTypeNode(normalized)) normalized = normalized.type;
          return compactText(normalized, sourceFile);
        })
      )
    : new Set([compactText(unwrapped, sourceFile)]);
}

function compareDeclaration(name, previous, current, previousFile, currentFile) {
  if (previous.kind !== current.kind) return [`${name}: declaration kind changed`];
  if (ts.isVariableDeclaration(previous) && ts.isVariableDeclaration(current)) {
    if (
      previous.type !== undefined &&
      current.type !== undefined &&
      ts.isFunctionTypeNode(previous.type) &&
      ts.isFunctionTypeNode(current.type)
    ) {
      return compareSignatures(name, previous.type, current.type, previousFile, currentFile);
    }
    return compactText(previous, previousFile) === compactText(current, currentFile)
      ? []
      : [`${name}: declaration changed`];
  }
  if (ts.isInterfaceDeclaration(previous) && ts.isInterfaceDeclaration(current)) {
    const oldBases = previous.heritageClauses?.map((clause) => compactText(clause, previousFile)).join("|") ?? "";
    const newBases = current.heritageClauses?.map((clause) => compactText(clause, currentFile)).join("|") ?? "";
    return [
      ...(oldBases === newBases ? [] : [`${name}: base interfaces changed`]),
      ...compareMembers(name, previous, current, previousFile, currentFile, current)
    ];
  }
  if (ts.isClassDeclaration(previous) && ts.isClassDeclaration(current)) {
    return compareMembers(name, previous, current, previousFile, currentFile, current);
  }
  if (ts.isFunctionDeclaration(previous) && ts.isFunctionDeclaration(current)) {
    return compareSignatures(name, previous, current, previousFile, currentFile);
  }
  if (ts.isTypeAliasDeclaration(previous) && ts.isTypeAliasDeclaration(current)) {
    const oldParts = unionParts(previous.type, previousFile);
    const newParts = unionParts(current.type, currentFile);
    return [...oldParts].every((part) => newParts.has(part))
      ? []
      : [
          `${name}: type changed from ${compactText(previous.type, previousFile)} to ${compactText(current.type, currentFile)}`
        ];
  }
  return compactText(previous, previousFile) === compactText(current, currentFile)
    ? []
    : [`${name}: declaration changed`];
}

export function findBreakingApiChanges(previousText, currentText, reportName = "api") {
  const previous = collectPublicApi(previousText, `${reportName}-previous.d.ts`);
  const current = collectPublicApi(currentText, `${reportName}-current.d.ts`);
  const changes = [];
  for (const name of previous.exports) {
    if (!current.exports.has(name)) {
      changes.push(`${reportName}:${name}: export was removed`);
      continue;
    }
    const oldDeclarations = previous.declarations.get(name);
    const newDeclarations = current.declarations.get(name);
    if (oldDeclarations === undefined || newDeclarations === undefined) continue;
    for (let index = 0; index < oldDeclarations.length; index += 1) {
      const oldDeclaration = oldDeclarations[index];
      const newDeclaration = newDeclarations[index];
      if (newDeclaration === undefined) {
        changes.push(`${reportName}:${name}: overload was removed`);
        continue;
      }
      changes.push(
        ...compareDeclaration(name, oldDeclaration, newDeclaration, previous.sourceFile, current.sourceFile).map(
          (change) => `${reportName}:${change}`
        )
      );
    }
  }
  return changes;
}

function versionParts(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/u.exec(version);
  if (match === null) throw new Error(`Invalid semantic version: ${version}`);
  return match.slice(1, 4).map(Number);
}

export function assertSemverCompatibility(changes, previousVersion, currentVersion) {
  if (changes.length === 0) return;
  const [previousMajor] = versionParts(previousVersion);
  const [currentMajor, currentMinor, currentPatch] = versionParts(currentVersion);
  if (currentMajor > previousMajor && currentMinor === 0 && currentPatch === 0) return;
  throw new Error(
    `Breaking public API changes require a major vX.0.0 release (previous ${previousVersion}, current ${currentVersion}):\n${changes.map((change) => `- ${change}`).join("\n")}`
  );
}

async function verifySemverGate(root, packages, reportDirectory) {
  const versions = new Set(packages.map((pkg) => pkg.manifest.version));
  if (versions.size !== 1) throw new Error("Public packages must share one version before SemVer verification.");
  const currentVersion = [...versions][0];
  const previousTag = await resolvePreviousReleaseTag(currentVersion);
  if (previousTag === undefined) {
    console.log("SemVer gate skipped because no previous git tag was found.");
    return;
  }
  const changes = [];
  for (const pkg of packages) {
    const packageName = basename(pkg.directory);
    const previous = await runCommand("git", ["show", `${previousTag}:api-reports/${packageName}.d.ts`], {
      cwd: root,
      capture: true
    });
    if (previous.code !== 0) continue;
    const current = await readFile(join(reportDirectory, `${packageName}.d.ts`), "utf8");
    changes.push(...findBreakingApiChanges(previous.stdout, current, packageName));
  }
  assertSemverCompatibility(changes, previousTag.replace(/^v/, ""), currentVersion);
  console.log(`SemVer gate passed against ${previousTag}.`);
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
  await verifySemverGate(root, packages, reportDirectory);
  console.log(`${mode === "update" ? "Updated" : "Verified"} ${packages.length} public API reports.`);
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) await main();
