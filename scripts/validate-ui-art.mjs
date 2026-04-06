import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const uiDir = path.resolve(repoRoot, "public/assets/ui");
const indexFile = path.join(uiDir, "ui-art-manifest-index.json");
const allowedAssetExt = new Set([".svg", ".png", ".jpg", ".jpeg", ".webp"]);
const nameRegex = /^[a-z0-9]+(?:[-_][a-z0-9]+)*\.(svg|png|jpg|jpeg|webp)$/;
const preferredAssetArrayKeys = ["assets", "items", "entries", "icons", "files", "list"];
const REQUIRED_DUNGEON_PHASE_BADGE_IDS = new Set(["phaseTrashBadgeDeco", "phaseBossPrepBadgeDeco"]);

/** @param {string} p */
function readJson(p) {
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw);
}

/** @param {string[]} errs */
function fail(errs) {
  console.error(`❌ UI art validation failed with ${errs.length} issue(s):`);
  errs.forEach((e, idx) => {
    console.error(`  ${idx + 1}. ${e}`);
  });
  process.exit(1);
}

/**
 * @param {string} targetPath
 */
function rel(targetPath) {
  return path.relative(repoRoot, targetPath).replaceAll("\\", "/");
}

/**
 * @param {unknown} asset
 */
function getAssetId(asset) {
  if (typeof asset?.id === "string") return asset.id;
  if (typeof asset?.rarity === "string") return asset.rarity;
  if (typeof asset?.name === "string") return asset.name;
  if (typeof asset?.key === "string") return asset.key;
  return null;
}

/**
 * @param {unknown} manifest
 * @returns {{ key: string; assets: unknown[] } | null}
 */
function selectAssetArray(manifest) {
  if (!manifest || typeof manifest !== "object") return null;
  const entries = Object.entries(manifest).filter(([, v]) => Array.isArray(v));
  if (entries.length === 0) return null;

  for (const key of preferredAssetArrayKeys) {
    const hit = entries.find(([k]) => k === key);
    if (!hit) continue;
    return { key: hit[0], assets: /** @type {unknown[]} */ (hit[1]) };
  }

  const fileArray = entries.find(([, v]) =>
    /** @type {unknown[]} */ (v).some((item) => item && typeof item === "object" && typeof item.file === "string"),
  );
  if (fileArray) return { key: fileArray[0], assets: /** @type {unknown[]} */ (fileArray[1]) };
  if (entries.length === 1) return { key: entries[0][0], assets: /** @type {unknown[]} */ (entries[0][1]) };
  return null;
}

if (!fs.existsSync(indexFile)) {
  fail([`Missing index file: ${rel(indexFile)}`]);
}

const errors = [];
const indexJson = readJson(indexFile);
if (!Array.isArray(indexJson.manifests)) {
  fail([`Invalid index format: "manifests" must be an array in ${rel(indexFile)}`]);
}

const indexManifestFiles = new Set();
const indexManifestIds = new Set();
for (const entry of indexJson.manifests) {
  if (!entry || typeof entry.file !== "string" || typeof entry.id !== "string") {
    errors.push(`Invalid index entry in ${rel(indexFile)}: ${JSON.stringify(entry)}`);
    continue;
  }
  if (indexManifestFiles.has(entry.file)) {
    errors.push(`Duplicate manifest file in ${rel(indexFile)}: ${entry.file}`);
  }
  if (indexManifestIds.has(entry.id)) {
    errors.push(`Duplicate manifest id in ${rel(indexFile)}: ${entry.id}`);
  }
  indexManifestIds.add(entry.id);
  indexManifestFiles.add(entry.file);
}

for (const manifestName of indexManifestFiles) {
  const manifestPath = path.join(uiDir, manifestName);
  if (!fs.existsSync(manifestPath)) {
    errors.push(`Manifest listed in index but missing on disk: ${rel(manifestPath)}`);
    continue;
  }
  let manifest;
  try {
    manifest = readJson(manifestPath);
  } catch (e) {
    errors.push(`Manifest JSON parse failed: ${rel(manifestPath)} (${/** @type {Error} */ (e).message})`);
    continue;
  }
  const selected = selectAssetArray(manifest);
  if (!selected || !Array.isArray(selected.assets)) {
    errors.push(
      `Manifest ${rel(manifestPath)} must contain one identifiable asset array (${preferredAssetArrayKeys.join(", ")})`,
    );
    continue;
  }
  const assets = selected.assets;
  const assetsKey = selected.key;
  const ids = new Set();
  const files = new Set();
  for (let idx = 0; idx < assets.length; idx += 1) {
    const asset = assets[idx];
    const assetId = getAssetId(asset);
    if (!asset || typeof asset.file !== "string" || !assetId) {
      errors.push(
        `Invalid asset entry at ${rel(manifestPath)} -> ${assetsKey}[${idx}]: ${JSON.stringify(asset)}`,
      );
      continue;
    }
    if (ids.has(assetId)) errors.push(`Duplicated asset id in ${rel(manifestPath)} -> ${assetsKey}: ${assetId}`);
    ids.add(assetId);
    if (files.has(asset.file))
      errors.push(`Duplicated asset file in ${rel(manifestPath)} -> ${assetsKey}: ${asset.file}`);
    files.add(asset.file);

    if (!nameRegex.test(asset.file)) {
      errors.push(
        `Asset filename violates naming convention at ${rel(manifestPath)} -> ${assetsKey}[${idx}].file: ${asset.file}`,
      );
    }
    const ext = path.extname(asset.file).toLowerCase();
    if (!allowedAssetExt.has(ext)) {
      errors.push(`Unsupported asset extension at ${rel(manifestPath)} -> ${assetsKey}[${idx}].file: ${asset.file}`);
    }
    const assetPath = path.join(uiDir, asset.file);
    if (!fs.existsSync(assetPath)) {
      errors.push(`Asset missing on disk referenced by ${rel(manifestPath)} -> ${assetsKey}[${idx}]: ${rel(assetPath)}`);
    }
  }
  if (manifestName === "dungeon-duel-ui-manifest.json") {
    const manifestAssetIds = new Set(assets.map((a) => getAssetId(a)).filter(Boolean));
    for (const reqId of REQUIRED_DUNGEON_PHASE_BADGE_IDS) {
      if (!manifestAssetIds.has(reqId)) {
        errors.push(`Missing required dungeon phase badge id in ${rel(manifestPath)} -> ${assetsKey}: ${reqId}`);
      }
    }
  }
}

if (errors.length > 0) {
  fail(errors);
}

console.log(`✅ UI art manifests validated (${indexManifestFiles.size} manifests).`);
