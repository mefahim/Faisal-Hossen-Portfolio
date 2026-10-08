import "server-only";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getConfig } from "../config";

function rootDir() {
  const configured = getConfig().MEDIA_STORAGE_DIR;
  const resolved = path.resolve(process.cwd(), configured);
  const publicRoot = path.resolve(process.cwd(), "public") + path.sep;
  if (resolved === path.resolve(process.cwd(), "public") || resolved.startsWith(publicRoot)) throw new Error("MEDIA_STORAGE_DIR must be outside the public directory.");
  return resolved;
}
export async function createMediaKey(extension: string) {
  if (!/^(jpg|png|webp|avif)$/.test(extension)) throw new Error("Unsupported image extension.");
  return `original/${randomUUID()}.${extension}`;
}
export async function writePrivateMedia(key: string, data: Uint8Array) {
  const root = rootDir();
  const resolved = path.resolve(root, key);
  if (!resolved.startsWith(root + path.sep)) throw new Error("Invalid media key.");
  await mkdir(path.dirname(resolved), { recursive: true, mode: 0o700 });
  const tempPath = `${resolved}.${randomUUID()}.tmp`;
  await writeFile(tempPath, data, { mode: 0o600, flag: "wx" });
  await rename(tempPath, resolved);
}
export async function readPrivateMedia(key: string) {
  const root = rootDir();
  const resolved = path.resolve(root, key);
  if (!resolved.startsWith(root + path.sep)) throw new Error("Invalid media key.");
  return readFile(resolved);
}
export async function deletePrivateMedia(key: string) {
  const root = rootDir();
  const resolved = path.resolve(root, key);
  if (!resolved.startsWith(root + path.sep)) throw new Error("Invalid media key.");
  await rm(resolved, { force: true });
}
