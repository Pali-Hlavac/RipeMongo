// Minimal readers for the two archive formats MongoDB ships the Database Tools in (.zip and
// .tgz). Pure Node, so fetching sidecars needs no system tools and behaves the same on every
// OS (Git Bash's `tar`, for example, cannot read zip files).
import { gunzipSync, inflateRawSync } from "node:zlib";

/** @typedef {{ name: string, data: () => Buffer }} ArchiveEntry */

const ZIP_END_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_SIGNATURE = 0x04034b50;
const ZIP_END_SIZE = 22;
const ZIP_CENTRAL_SIZE = 46;
const ZIP_LOCAL_SIZE = 30;
const ZIP_MAX_COMMENT = 0xffff;
/** Placeholder values that mean "see the zip64 record", which these archives never need. */
const ZIP64_COUNT = 0xffff;
const ZIP64_SIZE = 0xffffffff;
const METHOD_STORED = 0;
const METHOD_DEFLATED = 8;

const TAR_BLOCK = 512;
const TAR_FILE_TYPES = ["0", "\0"];
const TAR_LONG_NAME = "L";
const TAR_PAX_HEADER = "x";
const OCTAL = 8;

/**
 * Lists the files in a zip archive held in memory.
 * @param {Buffer} buffer
 * @returns {ArchiveEntry[]}
 */
export function readZip(buffer) {
  const end = findZipEnd(buffer);
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  if (count === ZIP64_COUNT || offset === ZIP64_SIZE) throw new Error("zip64 is not supported.");
  /** @type {ArchiveEntry[]} */
  const entries = [];
  for (let index = 0; index < count; index++) {
    if (buffer.readUInt32LE(offset) !== ZIP_CENTRAL_SIGNATURE) {
      throw new Error("Corrupt zip archive (bad central directory).");
    }
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const size = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const start = offset + ZIP_CENTRAL_SIZE;
    const name = buffer.toString("utf8", start, start + nameLength);
    if (!name.endsWith("/")) {
      entries.push({
        name,
        data: () => zipEntryData(buffer, localOffset, method, compressedSize, size),
      });
    }
    offset = start + nameLength + extraLength + commentLength;
  }
  return entries;
}

/**
 * @param {Buffer} buffer
 * @returns {number}
 */
function findZipEnd(buffer) {
  const lowest = Math.max(0, buffer.length - ZIP_END_SIZE - ZIP_MAX_COMMENT);
  for (let offset = buffer.length - ZIP_END_SIZE; offset >= lowest; offset--) {
    if (buffer.readUInt32LE(offset) === ZIP_END_SIGNATURE) return offset;
  }
  throw new Error("Not a zip archive.");
}

/**
 * @param {Buffer} buffer
 * @param {number} localOffset
 * @param {number} method
 * @param {number} compressedSize
 * @param {number} size
 * @returns {Buffer}
 */
function zipEntryData(buffer, localOffset, method, compressedSize, size) {
  if (buffer.readUInt32LE(localOffset) !== ZIP_LOCAL_SIGNATURE) {
    throw new Error("Corrupt zip archive (bad local header).");
  }
  const nameLength = buffer.readUInt16LE(localOffset + 26);
  const extraLength = buffer.readUInt16LE(localOffset + 28);
  const start = localOffset + ZIP_LOCAL_SIZE + nameLength + extraLength;
  const raw = buffer.subarray(start, start + compressedSize);
  let data;
  if (method === METHOD_STORED) data = Buffer.from(raw);
  else if (method === METHOD_DEFLATED) data = inflateRawSync(raw);
  else throw new Error(`Unsupported zip compression method ${method}.`);
  if (data.length !== size) throw new Error("Corrupt zip archive (size mismatch).");
  return data;
}

/**
 * Lists the regular files in a gzip-compressed tar archive held in memory.
 * @param {Buffer} buffer
 * @returns {ArchiveEntry[]}
 */
export function readTarGz(buffer) {
  return readTar(gunzipSync(buffer));
}

/**
 * Lists the regular files in a tar archive (ustar, with GNU long names and pax paths).
 * @param {Buffer} tar
 * @returns {ArchiveEntry[]}
 */
export function readTar(tar) {
  /** @type {ArchiveEntry[]} */
  const entries = [];
  /** @type {string | undefined} */
  let nextName;
  let offset = 0;
  while (offset + TAR_BLOCK <= tar.length) {
    const header = tar.subarray(offset, offset + TAR_BLOCK);
    if (header.every((byte) => byte === 0)) break;
    const size = parseInt(text(header, 124, 12).trim() || "0", OCTAL);
    const type = String.fromCharCode(header[156] ?? 0);
    const start = offset + TAR_BLOCK;
    const data = tar.subarray(start, start + size);
    offset = start + Math.ceil(size / TAR_BLOCK) * TAR_BLOCK;
    if (type === TAR_LONG_NAME) {
      nextName = text(data, 0, data.length);
    } else if (type === TAR_PAX_HEADER) {
      nextName = paxPath(data.toString("utf8")) ?? nextName;
    } else {
      const prefix = text(header, 345, 155);
      const base = text(header, 0, 100);
      const name = nextName ?? (prefix ? `${prefix}/${base}` : base);
      nextName = undefined;
      if (TAR_FILE_TYPES.includes(type)) entries.push({ name, data: () => Buffer.from(data) });
    }
  }
  return entries;
}

/**
 * A NUL-terminated string field.
 * @param {Buffer} buffer
 * @param {number} start
 * @param {number} length
 */
function text(buffer, start, length) {
  const field = buffer.subarray(start, start + length);
  const end = field.indexOf(0);
  return field.toString("utf8", 0, end === -1 ? field.length : end);
}

/**
 * The `path` record of a pax extended header ("<length> path=<value>\n" lines).
 * @param {string} records
 * @returns {string | undefined}
 */
function paxPath(records) {
  for (const line of records.split("\n")) {
    const match = /^\d+ path=(.*)$/.exec(line);
    if (match) return match[1];
  }
  return undefined;
}
