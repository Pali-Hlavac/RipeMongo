import { deflateRawSync, gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { readTar, readTarGz, readZip } from "./archive.mjs";

const TAR_BLOCK = 512;

/**
 * A zip with one entry per [name, content, method] (0 = stored, 8 = deflated).
 * @param {[string, string, number][]} files
 */
function zip(files) {
  /** @type {Buffer[]} */
  const locals = [];
  /** @type {Buffer[]} */
  const centrals = [];
  let offset = 0;
  for (const [name, content, method] of files) {
    const data = Buffer.from(content);
    const stored = method === 8 ? deflateRawSync(data) : data;
    const nameBytes = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(stored.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(stored.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, stored);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + stored.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

/**
 * One tar header + padded data block.
 * @param {string} name
 * @param {string} content
 * @param {string} type
 * @param {string} prefix
 */
function tarEntry(name, content, type = "0", prefix = "") {
  const data = Buffer.from(content);
  const header = Buffer.alloc(TAR_BLOCK);
  header.write(name, 0);
  header.write(`${data.length.toString(8).padStart(11, "0")}\0`, 124);
  header.write(type, 156);
  header.write(prefix, 345);
  const padded = Buffer.alloc(Math.ceil(data.length / TAR_BLOCK) * TAR_BLOCK);
  data.copy(padded);
  return Buffer.concat([header, padded]);
}

/** @param {{ name: string, data: () => Buffer }[]} entries */
function contents(entries) {
  return Object.fromEntries(entries.map((entry) => [entry.name, entry.data().toString()]));
}

describe("readZip", () => {
  it("reads stored and deflated entries and skips directories", () => {
    const archive = zip([
      ["tools/", "", 0],
      ["tools/bin/mongodump.exe", "MZ binary", 0],
      ["tools/LICENSE.md", "Apache License ".repeat(50), 8],
    ]);
    expect(contents(readZip(archive))).toEqual({
      "tools/bin/mongodump.exe": "MZ binary",
      "tools/LICENSE.md": "Apache License ".repeat(50),
    });
  });

  it("rejects data that is not a zip archive", () => {
    expect(() => readZip(Buffer.alloc(100))).toThrow("Not a zip archive.");
  });
});

describe("readTar", () => {
  it("reads files with ustar prefixes, GNU long names and pax paths", () => {
    const longName = `tools/${"x".repeat(120)}/mongodump`;
    const tar = Buffer.concat([
      tarEntry("tools/bin/", "", "5"),
      tarEntry("mongorestore", "elf restore", "0", "tools/bin"),
      tarEntry("././@LongLink", `${longName}\0`, "L"),
      tarEntry("truncated", "elf dump"),
      tarEntry("PaxHeader", "30 path=tools/THIRD-PARTY-NOTICES\n", "x"),
      tarEntry("short", "notices"),
      Buffer.alloc(TAR_BLOCK * 2),
    ]);
    expect(contents(readTarGz(gzipSync(tar)))).toEqual({
      "tools/bin/mongorestore": "elf restore",
      [longName]: "elf dump",
      "tools/THIRD-PARTY-NOTICES": "notices",
    });
    expect(readTar(tar)).toHaveLength(3);
  });
});
