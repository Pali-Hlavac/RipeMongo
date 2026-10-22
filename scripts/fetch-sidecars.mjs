// Downloads the MongoDB Database Tools pinned in scripts/sidecars.lock.json, verifies each
// archive's SHA-256 and extracts the bundled tools to src-tauri/binaries/<tool>-<target>[.exe],
// the names Tauri's `externalBin` expects. The binaries are git-ignored, never committed.
//
//   pnpm sidecars                         tools for this computer
//   pnpm sidecars --target <triple>|all   tools for other targets (release builds)
//   pnpm sidecars --force                 download again even if up to date
//   pnpm sidecars --update-checksums      re-pin every target after changing "version"
//
// See docs/architecture/sidecars.md.
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { readTarGz, readZip } from "./lib/archive.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOCK_FILE = join(ROOT, "scripts", "sidecars.lock.json");
const BINARIES_DIR = join(ROOT, "src-tauri", "binaries");
const LICENSES_DIR = join(BINARIES_DIR, "licenses", "mongodb-database-tools");
/** Files from the archive root that must ship with the binaries (Apache 2.0 notices). */
const LICENSE_FILES = ["LICENSE.md", "THIRD-PARTY-NOTICES"];
const DOWNLOAD_BASE = "https://fastdl.mongodb.org/tools/db";
const RELEASE_FEED = "https://downloads.mongodb.org/tools/db/release.json";
const EXECUTABLE_MODE = 0o755;
const BYTES_PER_MB = 1024 * 1024;

/** Rust target triple → MongoDB platform name and archive type. */
const PLATFORMS = {
  "x86_64-pc-windows-msvc": { platform: "windows-x86_64", extension: "zip" },
  "x86_64-apple-darwin": { platform: "macos-x86_64", extension: "zip" },
  "aarch64-apple-darwin": { platform: "macos-arm64", extension: "zip" },
  // Same baseline (glibc 2.35) as the Ubuntu 22.04 runners the Linux installers are built on.
  "x86_64-unknown-linux-gnu": { platform: "ubuntu2204-x86_64", extension: "tgz" },
};
/** `${process.platform}-${process.arch}` → target triple of this computer. */
const HOST_TARGETS = {
  "win32-x64": "x86_64-pc-windows-msvc",
  "darwin-x64": "x86_64-apple-darwin",
  "darwin-arm64": "aarch64-apple-darwin",
  "linux-x64": "x86_64-unknown-linux-gnu",
};

/**
 * @typedef {{ url: string, sha256: string }} LockedArchive
 * @typedef {{ version: string, tools: string[], targets: Record<string, LockedArchive> }} Lock
 */

const args = process.argv.slice(2);
/** @type {Lock} */
const lock = JSON.parse(readFileSync(LOCK_FILE, "utf8"));

try {
  if (args.includes("--update-checksums")) await updateChecksums();
  for (const target of requestedTargets()) await fetchTarget(target);
} catch (error) {
  console.error(`sidecars: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

/** @returns {string[]} */
function requestedTargets() {
  const index = args.indexOf("--target");
  if (index === -1) {
    const host = /** @type {Record<string, string>} */ (HOST_TARGETS)[
      `${process.platform}-${process.arch}`
    ];
    if (!host) throw new Error(`No MongoDB tools for ${process.platform}-${process.arch}.`);
    return [host];
  }
  const target = args[index + 1];
  if (target === "all") return Object.keys(PLATFORMS);
  if (!target || !(target in lock.targets)) {
    throw new Error(
      `Unknown target "${target ?? ""}". Known: ${Object.keys(PLATFORMS).join(", ")}.`,
    );
  }
  return [target];
}

/** @param {string} target */
async function fetchTarget(target) {
  const locked = lock.targets[target];
  if (!locked) throw new Error(`${target} is not pinned in sidecars.lock.json.`);
  const stampFile = join(BINARIES_DIR, `.${target}.stamp`);
  const stamp = `${lock.version} ${locked.sha256}`;
  const outputs = lock.tools.map((tool) => join(BINARIES_DIR, binaryName(tool, target)));
  const upToDate =
    existsSync(stampFile) &&
    readFileSync(stampFile, "utf8") === stamp &&
    outputs.every((file) => existsSync(file));
  if (upToDate && !args.includes("--force")) {
    console.log(`sidecars: ${target} already has tools ${lock.version}.`);
    return;
  }

  const archive = await download(locked.url);
  const actual = sha256(archive);
  if (actual !== locked.sha256) {
    throw new Error(
      `Checksum mismatch for ${locked.url}: expected ${locked.sha256}, got ${actual}.`,
    );
  }
  const entries = locked.url.endsWith(".zip") ? readZip(archive) : readTarGz(archive);
  const byPath = new Map(entries.map((entry) => [entry.name.split("/").slice(1).join("/"), entry]));
  const suffix = target.includes("windows") ? ".exe" : "";

  mkdirSync(LICENSES_DIR, { recursive: true });
  lock.tools.forEach((tool, index) => {
    const entry = byPath.get(`bin/${tool}${suffix}`);
    if (!entry) throw new Error(`${tool} is missing from ${locked.url}.`);
    const output = /** @type {string} */ (outputs[index]);
    writeFileSync(output, entry.data());
    chmodSync(output, EXECUTABLE_MODE);
  });
  for (const name of LICENSE_FILES) {
    const entry = byPath.get(name);
    if (!entry) throw new Error(`${name} is missing from ${locked.url}.`);
    writeFileSync(join(LICENSES_DIR, name), entry.data());
  }
  writeFileSync(stampFile, stamp);
  console.log(`sidecars: ${target} now has tools ${lock.version} (${lock.tools.join(", ")}).`);
}

/** Re-pins every target to `lock.version`, cross-checking MongoDB's release feed. */
async function updateChecksums() {
  const feed = await fetchJson(RELEASE_FEED);
  /** @type {Map<string, string>} */
  const published = new Map();
  for (const release of feed.versions ?? []) {
    for (const item of release.downloads ?? []) {
      if (item.archive?.url && item.archive.sha256) {
        published.set(item.archive.url, item.archive.sha256);
      }
    }
  }
  /** @type {Record<string, LockedArchive>} */
  const targets = {};
  for (const [target, { platform, extension }] of Object.entries(PLATFORMS)) {
    const url = `${DOWNLOAD_BASE}/mongodb-database-tools-${platform}-${lock.version}.${extension}`;
    const hash = sha256(await download(url));
    const expected = published.get(url);
    if (expected && expected !== hash) {
      throw new Error(`${url} does not match MongoDB's published checksum.`);
    }
    if (!expected) console.warn(`sidecars: ${url} is not in the release feed; pinned by download.`);
    targets[target] = { url, sha256: hash };
  }
  lock.targets = targets;
  writeFileSync(LOCK_FILE, `${JSON.stringify(lock, null, 2)}\n`);
  console.log(`sidecars: pinned ${Object.keys(targets).length} targets to ${lock.version}.`);
}

/**
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
async function download(url) {
  console.log(`sidecars: downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Downloading ${url} failed: HTTP ${response.status}.`);
  const data = Buffer.from(await response.arrayBuffer());
  console.log(`sidecars: ${(data.length / BYTES_PER_MB).toFixed(1)} MB`);
  return data;
}

/**
 * @param {string} url
 * @returns {Promise<any>}
 */
async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Downloading ${url} failed: HTTP ${response.status}.`);
  return response.json();
}

/** @param {Buffer} data */
function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * @param {string} tool
 * @param {string} target
 */
function binaryName(tool, target) {
  return `${tool}-${target}${target.includes("windows") ? ".exe" : ""}`;
}
