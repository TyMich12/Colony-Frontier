import { readdir, readFile, writeFile, unlink, stat } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

// One-time migration entrypoint; run from repository root.
// Keeps the current game structure while emitting JavaScript/JSX source.
// The mockup registry generator now emits syntax valid in plain JavaScript.
const root = process.cwd();
const skipDirectories = new Set([".git", "node_modules", ".pnpm", ".cache", "dist", "target", "coverage"]);
const sourceFiles = [];
const configFiles = [];
const textFiles = [];
const issues = [];

async function walk(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    if (entry.name === ".git") continue;
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join("/");
    if (entry.isDirectory()) {
      if (!skipDirectories.has(entry.name)) await walk(absolute);
      continue;
    }
    if (!entry.isFile()) continue;
    if (/\.(tsx?|mts|cts)$/.test(entry.name)) sourceFiles.push({ absolute, relative });
    if (/^tsconfig(?:\..+)?\.json$/.test(entry.name)) configFiles.push(absolute);
    if (/\.(mjs|cjs|js|jsx|json|html|yaml|yml|toml|css|sh|md|replit)$/.test(entry.name) && !entry.name.endsWith(".lock")) {
      textFiles.push(absolute);
    }
  }
}

function jsPath(relative) {
  return relative.endsWith(".jsx")
    ? relative.slice(0, -4) + ".jsx"
    : relative.endsWith(".mts")
      ? relative.slice(0, -4) + ".mjs"
      : relative.endsWith(".cts")
        ? relative.slice(0, -4) + ".cjs"
        : relative.endsWith(".js")
          ? relative.slice(0, -3) + ".js"
          : relative;
}

await walk(root);
sourceFiles.sort((a, b) => a.relative.localeCompare(b.relative));

if (sourceFiles.length === 0) {
  console.log("No TypeScript source files found; nothing to convert.");
  process.exit(0);
}

// Phase one: compile every source file to ordinary JavaScript/JSX.
// Original source files are not deleted until all transpilation succeeds.
const outputs = [];
for (const source of sourceFiles) {
  if (/\.d\.js$/.test(source.relative)) {
    outputs.push({ ...source, outputPath: null, outputText: null, declaration: true });
    continue;
  }
  const sourceText = await readFile(source.absolute, "utf8");
  const result = ts.transpileModule(sourceText, {
    fileName: source.relative,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.Preserve,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      experimentalDecorators: true,
      useDefineForClassFields: true,
      sourceMap: false,
      inlineSourceMap: false,
      removeComments: false,
    },
  });
  const errors = (result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
  if (errors.length) {
    issues.push({
      file: source.relative,
      errors: errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n")),
    });
    continue;
  }
  const outputRelative = jsPath(source.relative);
  outputs.push({
    ...source,
    outputPath: path.join(root, outputRelative),
    outputRelative,
    outputText: result.outputText,
    declaration: false,
  });
}
if (issues.length) {
  console.error(JSON.stringify({ error: "Transpilation failed; no TypeScript sources were deleted.", issues }, null, 2));
  process.exit(1);
}

// Guard against silently overwriting an unrelated JavaScript file.
for (const output of outputs) {
  if (!output.outputPath) continue;
  try {
    await stat(output.outputPath);
    throw new Error("Refusing to overwrite existing file: " + output.outputRelative);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

for (const output of outputs) {
  if (output.outputPath) {
    await writeFile(output.outputPath, output.outputText, "utf8");
  }
}

// Update explicit source suffixes and glob patterns in generated output/config files.
const extFix = text => text.replace(/\.jsx\b/g, ".jsx").replace(/\.js\b/g, ".js");
for (const absolute of textFiles) {
  try {
    let text = await readFile(absolute, "utf8");
    const next = extFix(text);
    if (next !== text) await writeFile(absolute, next, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
// Also fix the just-emitted files; their imports can contain explicit TypeScript suffixes.
for (const output of outputs) {
  if (!output.outputPath) continue;
  const text = await readFile(output.outputPath, "utf8");
  const next = extFix(text);
  if (next !== text) await writeFile(output.outputPath, next, "utf8");
}

// Remove obsolete TS entrypoints only after the converted replacements exist.
for (const source of sourceFiles) await unlink(source.absolute);
for (const config of configFiles) await unlink(config);

// Update build scripts and package entry points for the JS-only source tree.
const packagePaths = [];
async function findPackages(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === "dist" || entry.name === "target") continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await findPackages(absolute);
    else if (entry.isFile() && entry.name === "package.json") packagePaths.push(absolute);
  }
}
await findPackages(root);
for (const packagePath of packagePaths) {
  const pkg = JSON.parse(await readFile(packagePath, "utf8"));
  const relative = path.relative(root, packagePath).split(path.sep).join("/");
  pkg.scripts ||= {};
  for (const key of Object.keys(pkg.scripts)) {
    if (/^typecheck(?::.*)?$/.test(key)) delete pkg.scripts[key];
  }
  for (const [key, value] of Object.entries(pkg.scripts)) {
    if (typeof value === "string") pkg.scripts[key] = extFix(value);
  }

  if (relative === "package.json") {
    pkg.scripts.build = "pnpm -r --if-present run build";
    delete pkg.scripts["typecheck:libs"];
    delete pkg.scripts.typecheck;
    if (pkg.devDependencies) delete pkg.devDependencies.typescript;
  }
  if (relative === "scripts/package.json") {
    pkg.scripts.hello = "node ./src/hello.js";
    if (pkg.devDependencies) delete pkg.devDependencies.jsx;
  }
  if (relative === "lib/api-spec/package.json") {
    pkg.scripts.codegen = "orval --config ./orval.config.js";
  }
  // Entry-point metadata in workspace packages must resolve to JavaScript now.
  const fixValue = value => {
    if (typeof value === "string") return extFix(value);
    if (Array.isArray(value)) return value.map(fixValue);
    if (value && typeof value === "object") {
      for (const key of Object.keys(value)) value[key] = fixValue(value[key]);
      return value;
    }
    return value;
  };
  const fixed = fixValue(pkg);
  await writeFile(packagePath, JSON.stringify(fixed, null, 2) + "\n", "utf8");
}

// shadcn's generator must not regenerate TypeScript UI components.
const componentsJson = path.join(root, "artifacts/mockup-sandbox/components.json");
try {
  const config = JSON.parse(await readFile(componentsJson, "utf8"));
  config.jsx = false;
  config.typescript = false;
  await writeFile(componentsJson, JSON.stringify(config, null, 2) + "\n", "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

// Remove obsolete generated TypeScript build state, and write a verifiable report.
const leftover = [];
async function scanLeftovers(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === ".pnpm" || entry.name === "dist" || entry.name === "target") continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await scanLeftovers(absolute);
    else if (entry.isFile() && /\.(tsx?|mts|cts|tsbuildinfo)$/.test(entry.name)) leftover.push(path.relative(root, absolute));
  }
}
await scanLeftovers(root);
if (leftover.length) {
  console.error("Found leftover TypeScript files: " + leftover.join(", "));
  process.exit(1);
}

const converted = outputs.filter(x => !x.declaration).length;
const jsxCount = outputs.filter(x => !x.declaration && x.relative.endsWith(".jsx")).length;
const report = [
  "# JavaScript language migration",
  "",
  "- Converted TypeScript source files: " + converted,
  "- JSX components emitted as JavaScript JSX files: " + jsxCount,
  "- TypeScript source/config files remaining in the repository: 0",
  "- Existing component logic was transpiled rather than manually rewritten to preserve current behavior.",
  "- This automated conversion removes types and changes file extensions; runtime/build validation is still required.",
  "",
].join("\n");
await writeFile(path.join(root, "LANGUAGE_MIGRATION_REPORT.md"), report, "utf8");
console.log(JSON.stringify({ converted, jsxCount, deletedConfigs: configFiles.length, tsRemaining: leftover.length }, null, 2));
