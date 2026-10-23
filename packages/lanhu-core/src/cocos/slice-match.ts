/** 本地切图 ↔ 蓝湖图层：按尺寸匹配为主，名字相近为辅；歧义留给 AI 看图确认 */
import type { LocalSliceFile } from "./local-slices.js";
import {
  walkLayoutNodes,
  type CocosMatchConfidence,
  type CocosSliceCandidate,
  type LayoutNode,
} from "./layout-tree.js";

export interface MatchLocalSlicesOptions {
  /** 切图像素 / 设计像素；不传则自动识别 */
  sliceScale?: number;
  maxCandidates?: number;
}

export interface SliceScaleDetection {
  scale: number;
  source: "param" | "auto" | "default";
  /** 自动识别时各倍率下精确命中的切图数 */
  hits?: Record<string, number>;
}

export interface MatchLocalSlicesResult {
  sliceScale: SliceScaleDetection;
  stats: {
    spriteNodes: number;
    high: number;
    medium: number;
    low: number;
    none: number;
    sliceFiles: number;
    unusedSlices: number;
  };
  unusedSlices: LocalSliceFile[];
}

const SCALE_CANDIDATES = [1, 2, 3, 0.5, 1.5, 4];
/** 超过该相对误差视为尺寸不匹配 */
const MAX_REL_ERROR = 0.2;
/** 切图常有 1~2px 的裁边差异，不计入误差 */
const PIXEL_SLACK = 1.5;
/** 组节点只给出高度吻合的候选，用于“整组切成一张图”的情况 */
const GROUP_MIN_SCORE = 0.7;

function sizeRelError(file: LocalSliceFile, node: LayoutNode, scale: number): number {
  const ew = Math.max(node.rect.width * scale, 1);
  const eh = Math.max(node.rect.height * scale, 1);
  const errW = Math.max(0, Math.abs(file.width - ew) - PIXEL_SLACK) / ew;
  const errH = Math.max(0, Math.abs(file.height - eh) - PIXEL_SLACK) / eh;
  return Math.max(errW, errH);
}

export function normalizeSliceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/@\d(\.\d)?x$/, "")
    .replace(/拷贝|副本|copy/g, "")
    .replace(/[\s_\-.]+/g, "");
}

function nameScore(fileName: string, layerName: string): number {
  const a = normalizeSliceName(fileName);
  const b = normalizeSliceName(layerName);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length >= 2 && b.length >= 2 && (a.includes(b) || b.includes(a))) return 0.5;
  return 0;
}

function scoreCandidate(file: LocalSliceFile, node: LayoutNode, scale: number): CocosSliceCandidate | undefined {
  const relErr = sizeRelError(file, node, scale);
  const sizeScore = relErr <= MAX_REL_ERROR ? 1 - relErr / MAX_REL_ERROR : 0;
  const nScore = nameScore(file.name, node.name);
  let score: number;
  let reason: string;
  if (sizeScore > 0) {
    score = 0.8 * sizeScore + 0.2 * nScore;
    reason = relErr === 0 ? "尺寸一致" : `尺寸误差 ${(relErr * 100).toFixed(1)}%`;
    if (nScore > 0) reason += nScore === 1 ? "，名字一致" : "，名字相近";
  } else if (nScore === 1) {
    score = 0.35;
    reason = "仅名字一致（尺寸不符，可能是九宫格或拉伸图）";
  } else {
    return undefined;
  }
  return {
    file: file.file,
    relPath: file.relPath,
    width: file.width,
    height: file.height,
    score: Math.round(score * 1000) / 1000,
    reason,
  };
}

function collectSpriteNodes(root: LayoutNode): { sprites: LayoutNode[]; groups: LayoutNode[] } {
  const sprites: LayoutNode[] = [];
  const groups: LayoutNode[] = [];
  walkLayoutNodes(root, (node, parent) => {
    if (!parent) return;
    if (node.kind === "sprite") sprites.push(node);
    else if (node.kind === "node") groups.push(node);
  });
  return { sprites, groups };
}

export function detectSliceScale(sprites: LayoutNode[], files: LocalSliceFile[]): SliceScaleDetection {
  const hits: Record<string, number> = {};
  let best = { scale: 1, count: 0 };
  for (const scale of SCALE_CANDIDATES) {
    let count = 0;
    for (const file of files) {
      if (sprites.some((node) => sizeRelError(file, node, scale) <= 0.03)) count += 1;
    }
    hits[`${scale}x`] = count;
    if (count > best.count) best = { scale, count };
  }
  return best.count > 0 ? { scale: best.scale, source: "auto", hits } : { scale: 1, source: "default", hits };
}

function confidenceOf(candidates: CocosSliceCandidate[]): CocosMatchConfidence {
  const [first, second] = candidates;
  if (!first) return "none";
  if (first.score >= 0.9 && (!second || first.score - second.score >= 0.1)) return "high";
  if (first.score >= 0.75) return "medium";
  return "low";
}

/** 就地写入每个节点的 `sprite` 匹配结果 */
export function matchLocalSlices(
  root: LayoutNode,
  files: LocalSliceFile[],
  options: MatchLocalSlicesOptions = {},
): MatchLocalSlicesResult {
  const maxCandidates = options.maxCandidates ?? 5;
  const { sprites, groups } = collectSpriteNodes(root);
  const sliceScale: SliceScaleDetection =
    options.sliceScale && options.sliceScale > 0
      ? { scale: options.sliceScale, source: "param" }
      : detectSliceScale(sprites, files);

  const rank = (node: LayoutNode, minScore: number): CocosSliceCandidate[] =>
    files
      .map((file) => scoreCandidate(file, node, sliceScale.scale))
      .filter((c): c is CocosSliceCandidate => Boolean(c) && c!.score >= minScore)
      .sort((a, b) => b.score - a.score || a.relPath.localeCompare(b.relPath))
      .slice(0, maxCandidates);

  const stats = { spriteNodes: sprites.length, high: 0, medium: 0, low: 0, none: 0 };
  const used = new Set<string>();

  for (const node of sprites) {
    const candidates = rank(node, 0.3);
    const confidence = confidenceOf(candidates);
    const best = candidates[0];
    node.sprite = {
      confidence,
      candidates,
      ...(best ? { relPath: best.relPath, file: best.file } : {}),
    };
    if (best) used.add(best.file);
    stats[confidence] += 1;
  }

  for (const node of groups) {
    const candidates = rank(node, GROUP_MIN_SCORE);
    if (candidates.length > 0) {
      node.sprite = { confidence: "none", candidates };
    }
  }

  const unusedSlices = files.filter((file) => !used.has(file.file));
  return {
    sliceScale,
    stats: { ...stats, sliceFiles: files.length, unusedSlices: unusedSlices.length },
    unusedSlices,
  };
}
