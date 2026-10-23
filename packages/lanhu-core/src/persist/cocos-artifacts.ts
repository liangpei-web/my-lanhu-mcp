import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import type { AnalyzeCocosResult } from "../pipeline/analyze-cocos.js";
import { formatCocosAnalyzeText } from "../pipeline/analyze-cocos.js";
import type { LanhuDesignSummary } from "../types.js";
import { ensureDir, resolveDesignOutputDir, safeDesignFilename } from "./data-dir.js";

export interface CocosArtifactsPaths {
  outputDir: string;
  previewPng?: string;
  layout2x?: string;
  layout3x?: string;
  layoutText?: string;
}

export interface PersistCocosArtifactsOptions {
  dataDir: string;
  projectId: string;
  /** 显式落盘根目录时不追加 designId 层（与 slices 的 output_dir 一致） */
  outputDir?: string;
  downloadPreview?: boolean;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(value, null, 2), "utf8");
}

/** 将 Cocos 节点 JSON / 摘要 / 预览图落到设计稿目录或 output_dir */
export async function persistCocosArtifacts(
  design: LanhuDesignSummary,
  result: AnalyzeCocosResult,
  options: PersistCocosArtifactsOptions,
): Promise<CocosArtifactsPaths> {
  const outputDir = options.outputDir?.trim()
    ? resolve(options.outputDir)
    : resolveDesignOutputDir(options.dataDir, options.projectId, design.id, design.name);
  await ensureDir(outputDir);

  const slug = safeDesignFilename(design.name);
  const paths: CocosArtifactsPaths = { outputDir };

  for (const doc of result.documents) {
    const file =
      doc.cocosVersion === "2.x" ? `${slug}.cocos-layout-2x.json` : `${slug}.cocos-layout-3x.json`;
    const full = join(outputDir, file);
    await writeJson(full, doc);
    if (doc.cocosVersion === "2.x") paths.layout2x = full;
    else paths.layout3x = full;
  }

  const textPath = join(outputDir, `${slug}.cocos.txt`);
  await writeFile(textPath, formatCocosAnalyzeText(result), "utf8");
  paths.layoutText = textPath;

  if (options.downloadPreview !== false && result.previewImage?.base64) {
    const previewPath = join(outputDir, `${slug}.png`);
    await writeFile(previewPath, Buffer.from(result.previewImage.base64, "base64"));
    paths.previewPng = previewPath;
    result.previewImage.path = previewPath;
  }

  return paths;
}
