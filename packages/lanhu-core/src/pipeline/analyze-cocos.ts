/**
 * 蓝湖效果图 + 本地切图目录 → Cocos 2.x / 3.x 节点描述（不是 .prefab）。
 */
import { LanhuClient } from "../lanhu/client.js";
import { getSketchJson } from "../lanhu/designs.js";
import {
  buildCocosLayoutDocument,
  formatCocosLayoutText,
  type CocosLayoutDocument,
  type CocosVersion,
} from "../cocos/emit.js";
import { buildLayoutTree, type LayoutTree } from "../cocos/layout-tree.js";
import { scanLocalSlices, type LocalSliceFile, type ScanLocalSlicesResult } from "../cocos/local-slices.js";
import { matchLocalSlices, type MatchLocalSlicesResult } from "../cocos/slice-match.js";
import type { AnalyzePreviewImage } from "./analyze-design.js";
import type { LanhuDesignSummary, UnknownRecord } from "../types.js";

export type CocosEngineTarget = CocosVersion | "both";

export interface AnalyzeCocosOptions {
  sliceDir: string;
  cocosVersion?: CocosEngineTarget;
  unitScale?: number;
  localSliceScale?: number;
  includePreview?: boolean;
}

export interface BuildCocosFromSketchOptions {
  designName: string;
  designId?: string;
  cocosVersion?: CocosEngineTarget;
  unitScale?: number;
  sliceDir?: string;
  localFiles?: LocalSliceFile[];
  localSliceScale?: number;
  extraWarnings?: string[];
}

export interface BuildCocosFromSketchResult {
  tree: LayoutTree;
  match?: MatchLocalSlicesResult;
  documents: CocosLayoutDocument[];
  warnings: string[];
}

export interface AnalyzeCocosResult extends BuildCocosFromSketchResult {
  design: LanhuDesignSummary;
  scan?: ScanLocalSlicesResult;
  previewImage?: AnalyzePreviewImage;
}

export function resolveCocosVersions(target: CocosEngineTarget = "both"): CocosVersion[] {
  return target === "both" ? ["2.x", "3.x"] : [target];
}

function inferPreviewMimeType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "image/png";
}

export function buildCocosFromSketch(
  sketch: UnknownRecord,
  options: BuildCocosFromSketchOptions,
): BuildCocosFromSketchResult {
  const warnings = [...(options.extraWarnings ?? [])];
  const tree = buildLayoutTree(sketch, options.designName);
  warnings.push(...tree.warnings);

  let match: MatchLocalSlicesResult | undefined;
  if (options.localFiles) {
    match = matchLocalSlices(tree.root, options.localFiles, {
      sliceScale: options.localSliceScale,
    });
    if (options.localFiles.length === 0) {
      warnings.push("切图目录里没有可读的 png/jpg/webp/gif");
    }
  }

  const versions = resolveCocosVersions(options.cocosVersion);
  const documents = versions.map((cocosVersion) =>
    buildCocosLayoutDocument(tree, {
      cocosVersion,
      unitScale: options.unitScale,
      designId: options.designId,
      sliceDir: options.sliceDir,
      match,
      extraWarnings: warnings,
    }),
  );

  return { tree, match, documents, warnings };
}

export function formatCocosAnalyzeText(result: BuildCocosFromSketchResult): string {
  const first = result.documents[0];
  if (!first) {
    return `Cocos 节点树生成失败：${result.warnings.join("; ") || "无输出"}`;
  }
  const versions = result.documents.map((d) => d.cocosVersion).join(" / ");
  const lines = [formatCocosLayoutText(result.tree, first)];
  if (result.documents.length > 1) {
    lines.push("");
    lines.push(`已同时生成 ${versions} 两份节点 JSON（结构相同，组件字段按版本区分）。`);
  }
  const extra = result.warnings.filter((w) => !first.warnings.includes(w));
  if (extra.length > 0) {
    lines.push("");
    lines.push("--- 其它警告 ---");
    for (const w of extra) lines.push(`- ${w}`);
  }
  lines.push("");
  lines.push(
    "落地说明：这是节点描述 JSON，不是 .prefab。请在 Cocos 编辑器脚本里读 root 建节点；" +
      "spriteFrame 为相对 slice_dir 的路径，资源须已导入工程。",
  );
  return lines.join("\n");
}

/** 单稿：拉 Sketch → 扫本地切图 → 匹配 → 生成 2.x / 3.x 节点 JSON */
export async function analyzeDesignForCocos(
  client: LanhuClient,
  ctx: { teamId?: string; projectId: string },
  design: LanhuDesignSummary,
  options: AnalyzeCocosOptions,
): Promise<AnalyzeCocosResult> {
  const extraWarnings: string[] = [];
  const sketchMeta = await getSketchJson(client, design.id, ctx.teamId, ctx.projectId);
  const scan = await scanLocalSlices(options.sliceDir);
  if (scan.unreadable.length > 0) {
    extraWarnings.push(`${scan.unreadable.length} 个切图文件读不出尺寸，已跳过`);
  }
  if (scan.truncated) {
    extraWarnings.push("切图文件超过扫描上限，部分文件未纳入匹配");
  }

  const built = buildCocosFromSketch(sketchMeta.sketch, {
    designName: design.name,
    designId: design.id,
    cocosVersion: options.cocosVersion,
    unitScale: options.unitScale,
    sliceDir: scan.sliceDir,
    localFiles: scan.files,
    localSliceScale: options.localSliceScale,
    extraWarnings,
  });

  const result: AnalyzeCocosResult = {
    design,
    scan,
    ...built,
  };

  if (options.includePreview !== false && design.url) {
    try {
      const binary = await client.fetchBinaryUrl(design.url.split("?")[0]!);
      result.previewImage = {
        contentType: binary.contentType || inferPreviewMimeType(design.url),
        base64: binary.data,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.warnings.push(`预览图下载失败: ${message}`);
    }
  }

  return result;
}
