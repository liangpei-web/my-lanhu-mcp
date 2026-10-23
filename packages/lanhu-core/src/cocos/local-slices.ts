/** 扫描用户提供的本地切图目录（与蓝湖切图无关） */
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";

import { readImageSize } from "./image-size.js";

export interface LocalSliceFile {
  /** 绝对路径 */
  file: string;
  /** 相对 sliceDir，统一用 `/` */
  relPath: string;
  /** 不含扩展名的文件名 */
  name: string;
  width: number;
  height: number;
}

export interface ScanLocalSlicesResult {
  sliceDir: string;
  files: LocalSliceFile[];
  /** 扩展名匹配但读不出尺寸的文件 */
  unreadable: string[];
  truncated: boolean;
}

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const SKIP_DIRS = new Set(["node_modules", ".git", "library", "temp", "local", "build"]);

export async function scanLocalSlices(
  sliceDir: string,
  options: { maxFiles?: number } = {},
): Promise<ScanLocalSlicesResult> {
  const root = resolve(sliceDir);
  const info = await stat(root).catch(() => undefined);
  if (!info?.isDirectory()) {
    throw new Error(`切图目录不存在或不是目录: ${root}`);
  }

  const maxFiles = options.maxFiles ?? 3000;
  const files: LocalSliceFile[] = [];
  const unreadable: string[] = [];
  let truncated = false;

  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (files.length >= maxFiles) {
        truncated = true;
        return;
      }
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name.toLowerCase()) && !entry.name.startsWith(".")) {
          await walk(full);
        }
        continue;
      }
      const ext = extname(entry.name).toLowerCase();
      if (!entry.isFile() || !IMAGE_EXTS.has(ext)) {
        continue;
      }
      const size = readImageSize(await readFile(full));
      if (!size || size.width <= 0 || size.height <= 0) {
        unreadable.push(full);
        continue;
      }
      files.push({
        file: full,
        relPath: relative(root, full).split("\\").join("/"),
        name: basename(entry.name, extname(entry.name)),
        width: size.width,
        height: size.height,
      });
    }
  };

  await walk(root);
  return { sliceDir: root, files, unreadable, truncated };
}
