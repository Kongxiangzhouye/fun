import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const uiDir = path.resolve(repoRoot, "public/assets/ui");
const indexFile = path.join(uiDir, "ui-art-manifest-index.json");
const allowedAssetExt = new Set([".svg", ".png", ".jpg", ".jpeg", ".webp"]);
const nameRegex = /^[a-z0-9]+(?:[-_][a-z0-9]+)*\.(svg|png|jpg|jpeg|webp)$/;

/** @param {string} p */
function readJson(p) {
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw);
}

/** @param {string[]} errs */
function fail(errs) {
  for (const e of errs) console.error(`❌ ${e}`);
  process.exit(1);
}

if (!fs.existsSync(indexFile)) {
  fail([`Missing index file: ${path.relative(repoRoot, indexFile)}`]);
}

const errors = [];
const indexJson = readJson(indexFile);
if (!Array.isArray(indexJson.manifests)) {
  fail([`Invalid index format: "manifests" must be an array in ${path.relative(repoRoot, indexFile)}`]);
}

const indexManifestFiles = new Set();
for (const entry of indexJson.manifests) {
  if (!entry || typeof entry.file !== "string" || typeof entry.id !== "string") {
    errors.push(`Invalid manifest entry in index: ${JSON.stringify(entry)}`);
    continue;
  }
  if (indexManifestFiles.has(entry.file)) {
    errors.push(`Duplicate manifest file in index: ${entry.file}`);
  }
  indexManifestFiles.add(entry.file);
}

for (const manifestName of indexManifestFiles) {
  const manifestPath = path.join(uiDir, manifestName);
  if (!fs.existsSync(manifestPath)) {
    errors.push(`Manifest listed in index but missing on disk: ${manifestName}`);
    continue;
  }
  let manifest;
  try {
    manifest = readJson(manifestPath);
  } catch (e) {
    errors.push(`Manifest JSON parse failed: ${manifestName} (${/** @type {Error} */ (e).message})`);
    continue;
  }
  const assetsEntry = Object.entries(manifest).find(([, v]) => Array.isArray(v));
  const assets = assetsEntry?.[1];
  const assetsKey = assetsEntry?.[0];
  if (!Array.isArray(assets)) {
    errors.push(`Manifest ${manifestName} missing asset array`);
    continue;
  }
  const ids = new Set();
  const files = new Set();
  for (const asset of assets) {
    const assetId =
      typeof asset?.id === "string"
        ? asset.id
        : typeof asset?.rarity === "string"
          ? asset.rarity
          : typeof asset?.name === "string"
            ? asset.name
            : typeof asset?.key === "string"
              ? asset.key
              : null;
    if (!asset || typeof asset.file !== "string" || !assetId) {
      errors.push(
        `Manifest ${manifestName} has invalid asset entry in "${assetsKey ?? "unknown"}": ${JSON.stringify(asset)}`,
      );
      continue;
    }
    if (ids.has(assetId)) errors.push(`Manifest ${manifestName} has duplicated asset id: ${assetId}`);
    ids.add(assetId);
    if (files.has(asset.file)) errors.push(`Manifest ${manifestName} has duplicated asset file: ${asset.file}`);
    files.add(asset.file);

    if (!nameRegex.test(asset.file)) {
      errors.push(`Asset filename violates naming convention in ${manifestName}: ${asset.file}`);
    }
    const ext = path.extname(asset.file).toLowerCase();
    if (!allowedAssetExt.has(ext)) {
      errors.push(`Asset filename has unsupported extension in ${manifestName}: ${asset.file}`);
    }
    const assetPath = path.join(uiDir, asset.file);
    if (!fs.existsSync(assetPath)) {
      errors.push(`Asset missing on disk (${manifestName}): ${asset.file}`);
    }
  }
}

if (errors.length > 0) {
  fail(errors);
}

console.log(`✅ UI art manifests validated (${indexManifestFiles.size} manifests).`);
