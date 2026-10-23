/** 节点树 → Cocos Creator 2.x / 3.x 节点描述 JSON（不是 .prefab 序列化格式） */
import type { LocalSliceFile } from "./local-slices.js";
import type { LayoutNode, LayoutTree } from "./layout-tree.js";
import type { MatchLocalSlicesResult } from "./slice-match.js";

export type CocosVersion = "2.x" | "3.x";

export interface CocosTransform {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CocosNodeSpec {
  name: string;
  [key: string]: unknown;
  components: Array<Record<string, unknown>>;
  children: CocosNodeSpec[];
}

export interface CocosLayoutDocument {
  format: "lanhu-cocos-layout";
  formatVersion: 1;
  cocosVersion: CocosVersion;
  design: { id?: string; name: string; source: LayoutTree["source"]; width: number; height: number };
  coordinateSystem: string;
  unitScale: number;
  designResolution: { width: number; height: number };
  sliceDir?: string;
  sliceScale?: MatchLocalSlicesResult["sliceScale"];
  matchStats?: MatchLocalSlicesResult["stats"];
  root: CocosNodeSpec;
  /** 需要看图确认的节点 */
  review: Array<{
    id: string;
    layerPath: string;
    confidence: string;
    selected?: string;
    candidates: Array<{ relPath: string; score: number; reason: string }>;
  }>;
  unusedSlices: Array<{ relPath: string; width: number; height: number }>;
  warnings: string[];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** 中心锚点、y 轴向上、相对父节点中心 */
export function toCocosTransform(node: LayoutNode, parent: LayoutNode | undefined, unitScale: number): CocosTransform {
  const width = round2(node.rect.width * unitScale);
  const height = round2(node.rect.height * unitScale);
  if (!parent) {
    return { x: 0, y: 0, width, height };
  }
  const cx = node.rect.left + node.rect.width / 2;
  const cy = node.rect.top + node.rect.height / 2;
  const pcx = parent.rect.left + parent.rect.width / 2;
  const pcy = parent.rect.top + parent.rect.height / 2;
  return {
    x: round2((cx - pcx) * unitScale),
    y: round2((pcy - cy) * unitScale),
    width,
    height,
  };
}

function opacity255(node: LayoutNode): number | undefined {
  return node.opacity === undefined ? undefined : Math.round((node.opacity / 100) * 255);
}

function alignEnum(align: "left" | "center" | "right"): string {
  return align.toUpperCase();
}

function labelLineHeight(node: LayoutNode, unitScale: number): number | undefined {
  const label = node.label!;
  if (label.lineHeight) return round2(label.lineHeight * unitScale);
  if (!label.fontSize) return undefined;
  const lines = label.string.split("\n").length;
  return lines > 1 ? round2((node.rect.height / lines) * unitScale) : round2(label.fontSize * 1.2 * unitScale);
}

function spriteFrameOf(node: LayoutNode): string | null {
  return node.sprite?.relPath ?? null;
}

function lanhuMeta(node: LayoutNode): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    id: node.id,
    layerPath: node.layerPath,
    layerType: node.layerType,
    kind: node.kind,
    designRect: node.rect,
  };
  if (node.lanhuHasImage) meta["lanhuHasImage"] = true;
  if (node.fillColor) meta["fillColor"] = node.fillColor;
  if (node.sprite) {
    meta["match"] = {
      confidence: node.sprite.confidence,
      candidates: node.sprite.candidates.map((c) => ({ relPath: c.relPath, score: c.score, reason: c.reason })),
    };
  }
  return meta;
}

function emit2x(node: LayoutNode, parent: LayoutNode | undefined, unitScale: number): CocosNodeSpec {
  const t = toCocosTransform(node, parent, unitScale);
  const spec: CocosNodeSpec = {
    name: node.name,
    x: t.x,
    y: t.y,
    width: t.width,
    height: t.height,
    anchorX: 0.5,
    anchorY: 0.5,
    components: [],
    children: [],
  };
  const op = opacity255(node);
  if (op !== undefined) spec["opacity"] = op;

  if (node.kind === "label" && node.label) {
    const label = node.label;
    if (label.color) spec["color"] = label.color.slice(0, 7);
    spec.components.push({
      __type__: "cc.Label",
      string: label.string,
      ...(label.fontSize ? { fontSize: round2(label.fontSize * unitScale) } : {}),
      ...(labelLineHeight(node, unitScale) ? { lineHeight: labelLineHeight(node, unitScale) } : {}),
      ...(label.fontFamily ? { fontFamily: label.fontFamily } : {}),
      ...(label.bold ? { enableBold: true } : {}),
      horizontalAlign: alignEnum(label.horizontalAlign),
      verticalAlign: "CENTER",
      overflow: "NONE",
    });
  } else if (node.kind === "sprite") {
    if (node.fillColor && !node.sprite?.relPath) spec["color"] = node.fillColor.slice(0, 7);
    spec.components.push({
      __type__: "cc.Sprite",
      spriteFrame: spriteFrameOf(node),
      sizeMode: "CUSTOM",
      type: "SIMPLE",
    });
  }

  spec["_lanhu"] = lanhuMeta(node);
  spec.children = node.children.map((child) => emit2x(child, node, unitScale));
  return spec;
}

function emit3x(node: LayoutNode, parent: LayoutNode | undefined, unitScale: number): CocosNodeSpec {
  const t = toCocosTransform(node, parent, unitScale);
  const spec: CocosNodeSpec = {
    name: node.name,
    position: { x: t.x, y: t.y, z: 0 },
    components: [
      {
        __type__: "cc.UITransform",
        contentSize: { width: t.width, height: t.height },
        anchorPoint: { x: 0.5, y: 0.5 },
      },
    ],
    children: [],
  };

  if (node.kind === "label" && node.label) {
    const label = node.label;
    spec.components.push({
      __type__: "cc.Label",
      string: label.string,
      ...(label.fontSize ? { fontSize: round2(label.fontSize * unitScale) } : {}),
      ...(labelLineHeight(node, unitScale) ? { lineHeight: labelLineHeight(node, unitScale) } : {}),
      ...(label.color ? { color: label.color } : {}),
      ...(label.fontFamily ? { fontFamily: label.fontFamily } : {}),
      ...(label.bold ? { isBold: true } : {}),
      horizontalAlign: alignEnum(label.horizontalAlign),
      verticalAlign: "CENTER",
      overflow: "NONE",
    });
  } else if (node.kind === "sprite") {
    const relPath = spriteFrameOf(node);
    spec.components.push({
      __type__: "cc.Sprite",
      spriteFrame: relPath ? `${relPath}/spriteFrame` : null,
      sizeMode: "CUSTOM",
      type: "SIMPLE",
      ...(node.fillColor && !relPath ? { color: node.fillColor } : {}),
    });
  }

  const op = opacity255(node);
  if (op !== undefined) spec.components.push({ __type__: "cc.UIOpacity", opacity: op });

  spec["_lanhu"] = lanhuMeta(node);
  spec.children = node.children.map((child) => emit3x(child, node, unitScale));
  return spec;
}

export interface BuildCocosDocumentOptions {
  cocosVersion: CocosVersion;
  unitScale?: number;
  designId?: string;
  sliceDir?: string;
  match?: MatchLocalSlicesResult;
  extraWarnings?: string[];
}

function collectReview(root: LayoutNode): CocosLayoutDocument["review"] {
  const review: CocosLayoutDocument["review"] = [];
  const walk = (node: LayoutNode): void => {
    const sprite = node.sprite;
    if (node.kind === "sprite" && sprite && sprite.confidence !== "high") {
      review.push({
        id: node.id,
        layerPath: node.layerPath,
        confidence: sprite.confidence,
        ...(sprite.relPath ? { selected: sprite.relPath } : {}),
        candidates: sprite.candidates.map((c) => ({ relPath: c.relPath, score: c.score, reason: c.reason })),
      });
    } else if (node.kind === "node" && sprite && sprite.candidates.length > 0) {
      review.push({
        id: node.id,
        layerPath: node.layerPath,
        confidence: "group",
        candidates: sprite.candidates.map((c) => ({ relPath: c.relPath, score: c.score, reason: c.reason })),
      });
    }
    node.children.forEach(walk);
  };
  walk(root);
  return review;
}

export function buildCocosLayoutDocument(tree: LayoutTree, options: BuildCocosDocumentOptions): CocosLayoutDocument {
  const unitScale = options.unitScale && options.unitScale > 0 ? options.unitScale : 1;
  const root =
    options.cocosVersion === "2.x"
      ? emit2x(tree.root, undefined, unitScale)
      : emit3x(tree.root, undefined, unitScale);

  return {
    format: "lanhu-cocos-layout",
    formatVersion: 1,
    cocosVersion: options.cocosVersion,
    design: {
      ...(options.designId ? { id: options.designId } : {}),
      name: tree.boardName,
      source: tree.source,
      width: tree.boardWidth,
      height: tree.boardHeight,
    },
    coordinateSystem:
      "anchor (0.5,0.5)，y 轴向上，position 相对父节点中心；单位 = 设计像素 × unitScale；" +
      "_lanhu.designRect 为相对画板左上角的原始设计像素",
    unitScale,
    designResolution: {
      width: round2(tree.boardWidth * unitScale),
      height: round2(tree.boardHeight * unitScale),
    },
    ...(options.sliceDir ? { sliceDir: options.sliceDir } : {}),
    ...(options.match ? { sliceScale: options.match.sliceScale, matchStats: options.match.stats } : {}),
    root,
    review: collectReview(tree.root),
    unusedSlices: (options.match?.unusedSlices ?? []).map((f: LocalSliceFile) => ({
      relPath: f.relPath,
      width: f.width,
      height: f.height,
    })),
    warnings: [...tree.warnings, ...(options.extraWarnings ?? [])],
  };
}

function describeNode(node: LayoutNode, t: CocosTransform): string {
  let line = `${node.name} [${node.kind}] ${t.width}x${t.height} @(${t.x},${t.y})`;
  if (node.opacity !== undefined) line += ` opacity=${node.opacity}%`;
  if (node.label) {
    const text = node.label.string.replace(/\n/g, "\\n");
    line += ` "${text.length > 30 ? `${text.slice(0, 30)}...` : text}"`;
    if (node.label.fontSize) line += ` ${node.label.fontSize}px`;
    if (node.label.color) line += ` ${node.label.color}`;
  } else if (node.kind === "sprite") {
    if (node.sprite?.relPath) line += ` ← ${node.sprite.relPath} (${node.sprite.confidence})`;
    else if (node.fillColor) line += ` 纯色 ${node.fillColor}（无切图）`;
    else line += " ⚠ 无切图";
  } else if (node.sprite?.candidates.length) {
    line += ` （整组可能对应切图: ${node.sprite.candidates[0]!.relPath}）`;
  }
  return line;
}

/** 给 AI 读的精简文本：节点树 + 待确认列表 */
export function formatCocosLayoutText(tree: LayoutTree, doc: CocosLayoutDocument): string {
  const lines: string[] = [];
  lines.push(`Cocos 节点树（${doc.cocosVersion}）：${tree.boardName}`);
  lines.push(
    `设计稿 ${tree.boardWidth}x${tree.boardHeight}（${tree.source === "ps" ? "PS" : "Sketch/Figma"}）→ ` +
      `Cocos ${doc.designResolution.width}x${doc.designResolution.height}，unitScale=${doc.unitScale}`,
  );
  lines.push("坐标：锚点 (0.5,0.5)，y 轴向上，@(x,y) 为相对父节点中心的位置；子节点顺序即渲染顺序（后面的在上层）");
  if (doc.sliceScale && doc.matchStats) {
    const s = doc.matchStats;
    const hits = doc.sliceScale.hits
      ? `，各倍率精确命中: ${Object.entries(doc.sliceScale.hits)
          .map(([k, v]) => `${k}=${v}`)
          .join(" ")}`
      : "";
    lines.push(`切图目录：${doc.sliceDir}（${s.sliceFiles} 张，倍率 ${doc.sliceScale.scale}x / ${doc.sliceScale.source}${hits}）`);
    lines.push(
      `匹配：sprite 节点 ${s.spriteNodes} 个，high ${s.high} / medium ${s.medium} / low ${s.low} / 无候选 ${s.none}；未用到的切图 ${s.unusedSlices} 张`,
    );
  }

  lines.push("");
  lines.push("--- 节点树 ---");
  const walk = (node: LayoutNode, parent: LayoutNode | undefined, depth: number): void => {
    lines.push(`${"  ".repeat(depth)}- ${describeNode(node, toCocosTransform(node, parent, doc.unitScale))}`);
    for (const child of node.children) walk(child, node, depth + 1);
  };
  walk(tree.root, undefined, 0);

  if (doc.review.length > 0) {
    lines.push("");
    lines.push(`--- 需要看图确认（${doc.review.length}）---`);
    for (const item of doc.review) {
      const candidates = item.candidates.length
        ? item.candidates.map((c) => `${c.relPath}(${c.score})`).join(", ")
        : "无尺寸匹配的切图";
      lines.push(`- [${item.confidence}] ${item.layerPath}：${candidates}`);
    }
  }

  if (doc.unusedSlices.length > 0) {
    lines.push("");
    lines.push(`--- 未用到的切图（${doc.unusedSlices.length}）---`);
    for (const f of doc.unusedSlices.slice(0, 50)) {
      lines.push(`- ${f.relPath} ${f.width}x${f.height}`);
    }
    if (doc.unusedSlices.length > 50) lines.push(`- ……其余 ${doc.unusedSlices.length - 50} 张见 JSON`);
  }

  if (doc.warnings.length > 0) {
    lines.push("");
    lines.push("--- 警告 ---");
    for (const w of doc.warnings) lines.push(`- ${w}`);
  }

  return lines.join("\n");
}
