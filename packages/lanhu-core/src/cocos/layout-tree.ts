/**
 * 蓝湖 Sketch JSON（PS `board` / Sketch·Figma `artboard`）→ 与 Cocos 版本无关的节点树。
 * 坐标沿用 sketch-to-html 的约定：图层 left/top 为相对画板左上角的绝对设计像素。
 */
import type { UnknownRecord } from "../types.js";
import { isSketchRecord } from "../transform/sketch-utils.js";

export interface DesignRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type CocosNodeKind = "node" | "sprite" | "label";

export type CocosHorizontalAlign = "left" | "center" | "right";

export interface CocosLabelInfo {
  string: string;
  /** 设计像素 */
  fontSize?: number;
  /** 设计像素 */
  lineHeight?: number;
  /** `#RRGGBB` 或 `#RRGGBBAA` */
  color?: string;
  fontFamily?: string;
  bold?: boolean;
  horizontalAlign: CocosHorizontalAlign;
}

export interface CocosSliceCandidate {
  file: string;
  relPath: string;
  width: number;
  height: number;
  score: number;
  reason: string;
}

export type CocosMatchConfidence = "high" | "medium" | "low" | "none";

export interface CocosSpriteInfo {
  /** 选中的本地切图（相对 slice_dir） */
  relPath?: string;
  file?: string;
  confidence: CocosMatchConfidence;
  candidates: CocosSliceCandidate[];
}

export interface LayoutNode {
  /** 从根开始的子节点序号路径，如 `0.3.1`（根为空串） */
  id: string;
  name: string;
  layerPath: string;
  layerType: string;
  kind: CocosNodeKind;
  rect: DesignRect;
  /** 0~100 */
  opacity?: number;
  /** 形状图层纯色填充 */
  fillColor?: string;
  /** 蓝湖该图层带有导出图（说明设计师把它当一张图） */
  lanhuHasImage: boolean;
  label?: CocosLabelInfo;
  sprite?: CocosSpriteInfo;
  children: LayoutNode[];
}

export interface LayoutTree {
  source: "ps" | "artboard";
  boardName: string;
  boardWidth: number;
  boardHeight: number;
  root: LayoutNode;
  warnings: string[];
}

function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function rec(value: unknown): UnknownRecord {
  return isSketchRecord(value) ? value : {};
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function hex2(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0").toUpperCase();
}

function rgbToHex(r: number, g: number, b: number, alpha = 1): string {
  const base = `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  return alpha < 1 ? `${base}${hex2(alpha * 255)}` : base;
}

/** 蓝湖颜色对象 / CSS 颜色字符串 → `#RRGGBB(AA)` */
export function normalizeColor(color: unknown, opacityPercent = 100): string | undefined {
  if (typeof color === "string") {
    const value = color.trim();
    if (/^#[0-9a-f]{3}$/i.test(value)) {
      const [r, g, b] = value.slice(1).split("").map((c) => parseInt(c + c, 16));
      return rgbToHex(r!, g!, b!, opacityPercent / 100);
    }
    if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value)) {
      return value.toUpperCase();
    }
    const match = value.match(/^rgba?\(([^)]+)\)$/i);
    if (match) {
      const parts = match[1]!.split(",").map((p) => Number(p.trim()));
      const alpha = (parts[3] ?? 1) * (opacityPercent / 100);
      return rgbToHex(parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, alpha);
    }
    return undefined;
  }
  if (!isSketchRecord(color)) {
    return undefined;
  }
  if (typeof color["value"] === "string") {
    return normalizeColor(color["value"], opacityPercent);
  }
  const r = num(color["red"] ?? color["r"]);
  const g = num(color["green"] ?? color["g"]);
  const b = num(color["blue"] ?? color["b"]);
  if (r === undefined && g === undefined && b === undefined) {
    return undefined;
  }
  const alphaRaw = num(color["alpha"] ?? color["a"]);
  const alpha = (alphaRaw !== undefined && alphaRaw <= 1 ? alphaRaw : 1) * (opacityPercent / 100);
  return rgbToHex(r ?? 0, g ?? 0, b ?? 0, alpha);
}

function normalizeAlign(value: unknown): CocosHorizontalAlign {
  const v = str(value).toLowerCase();
  if (v === "center" || v === "centre") return "center";
  if (v === "right" || v === "end") return "right";
  return "left";
}

function unionRect(rects: DesignRect[]): DesignRect | undefined {
  if (rects.length === 0) {
    return undefined;
  }
  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.left + r.width));
  const bottom = Math.max(...rects.map((r) => r.top + r.height));
  return { left, top, width: right - left, height: bottom - top };
}

interface LayerReader {
  isVisible(layer: UnknownRecord): boolean;
  rect(layer: UnknownRecord): DesignRect;
  opacity(layer: UnknownRecord): number | undefined;
  label(layer: UnknownRecord, opacity: number): CocosLabelInfo | undefined;
  fillColor(layer: UnknownRecord, opacity: number): string | undefined;
  hasImage(layer: UnknownRecord): boolean;
}

const psReader: LayerReader = {
  isVisible: (layer) => layer["visible"] !== false,
  rect: (layer) => ({
    left: num(layer["left"]) ?? 0,
    top: num(layer["top"]) ?? 0,
    width: num(layer["width"]) ?? 0,
    height: num(layer["height"]) ?? 0,
  }),
  opacity: (layer) => {
    const blend = rec(layer["blendOptions"]);
    if (!("opacity" in blend)) return undefined;
    const op = blend["opacity"];
    return num(isSketchRecord(op) ? op["value"] : op);
  },
  label: (layer, opacity) => {
    if (str(layer["type"]) !== "textLayer") return undefined;
    const ti = rec(layer["textInfo"]);
    const text = str(ti["text"]);
    return {
      string: text.replace(/\r\n?/g, "\n"),
      fontSize: num(ti["size"]),
      lineHeight: num(ti["leading"]),
      color: normalizeColor(ti["color"], opacity),
      fontFamily: str(ti["fontPostScriptName"]) || str(ti["fontName"]) || undefined,
      bold: Boolean(ti["bold"]) || /bold|heavy|black/i.test(str(ti["fontStyleName"])),
      horizontalAlign: normalizeAlign(ti["justification"]),
    };
  },
  fillColor: (layer, opacity) => normalizeColor(rec(layer["fill"])["color"], opacity),
  hasImage: (layer) => {
    const images = rec(layer["images"]);
    return Boolean(images["png_xxxhd"] || images["svg"]);
  },
};

function artboardOpacity(layer: UnknownRecord): number | undefined {
  const raw = num(layer["opacity"]) ?? num(rec(layer["style"])["opacity"]);
  if (raw === undefined) return undefined;
  return raw <= 1 ? raw * 100 : raw;
}

const artboardReader: LayerReader = {
  isVisible: (layer) => layer["isVisible"] !== false && layer["visible"] !== false,
  rect: (layer) => {
    const frame = isSketchRecord(layer["frame"])
      ? layer["frame"]
      : isSketchRecord(layer["ddsOriginFrame"])
        ? layer["ddsOriginFrame"]
        : {};
    return {
      left: num(frame["left"] ?? frame["x"]) ?? 0,
      top: num(frame["top"] ?? frame["y"]) ?? 0,
      width: num(frame["width"]) ?? 0,
      height: num(frame["height"]) ?? 0,
    };
  },
  opacity: artboardOpacity,
  label: (layer, opacity) => {
    if (str(layer["type"]) !== "textLayer") return undefined;
    const text = rec(layer["text"]);
    const style = rec(text["style"]);
    const font = rec(style["font"]);
    const lineHeight = font["lineHeight"];
    return {
      string: str(text["value"]).replace(/\r\n?/g, "\n"),
      fontSize: num(font["size"]),
      lineHeight: num(isSketchRecord(lineHeight) ? lineHeight["value"] : lineHeight),
      color: normalizeColor(style["color"], opacity),
      fontFamily: str(font["name"]) || str(font["postScriptName"]) || undefined,
      bold:
        Boolean(font["bold"]) ||
        (num(font["fontWeight"]) ?? 0) >= 600 ||
        /bold|heavy|black/i.test(str(font["type"])),
      horizontalAlign: normalizeAlign(font["align"]),
    };
  },
  fillColor: (layer, opacity) => {
    const fills = rec(layer["style"])["fills"];
    for (const fill of Array.isArray(fills) ? fills : []) {
      if (!isSketchRecord(fill) || fill["isEnabled"] === false) continue;
      const color = normalizeColor(fill["color"], opacity);
      if (color) return color;
    }
    return undefined;
  },
  hasImage: (layer) => {
    const image = rec(layer["image"]);
    const dds = rec(layer["ddsImage"]);
    return Boolean(image["imageUrl"] || image["svgUrl"] || dds["imageUrl"] || layer["hasExportImage"]);
  },
};

function buildNode(
  layer: UnknownRecord,
  reader: LayerReader,
  id: string,
  parentPath: string,
): LayoutNode | undefined {
  if (!reader.isVisible(layer)) {
    return undefined;
  }
  const name = str(layer["name"]) || "unnamed";
  const layerPath = parentPath ? `${parentPath}/${name}` : name;
  const layerType = str(layer["type"]) || "unknown";

  const rawChildren = Array.isArray(layer["layers"]) ? layer["layers"] : [];
  const children: LayoutNode[] = [];
  // 蓝湖 layers[0] 在最上层；Cocos 后面的子节点渲染在上面，所以倒序
  for (const child of [...rawChildren].reverse()) {
    if (!isSketchRecord(child)) continue;
    const node = buildNode(child, reader, `${id ? `${id}.` : ""}${children.length}`, layerPath);
    if (node) children.push(node);
  }

  let rect = reader.rect(layer);
  if (rect.width <= 0 || rect.height <= 0) {
    const union = unionRect(children.map((c) => c.rect));
    if (!union) {
      return undefined;
    }
    rect = union;
  }

  const opacity = reader.opacity(layer);
  // 图层不透明度单独落到节点 opacity 上，颜色里不再叠加
  const label = reader.label(layer, 100);
  const kind: CocosNodeKind = label ? "label" : children.length > 0 ? "node" : "sprite";

  const node: LayoutNode = {
    id,
    name,
    layerPath,
    layerType,
    kind,
    rect: {
      left: round2(rect.left),
      top: round2(rect.top),
      width: round2(rect.width),
      height: round2(rect.height),
    },
    lanhuHasImage: reader.hasImage(layer),
    children: label ? [] : children,
  };
  if (opacity !== undefined && opacity < 100) {
    node.opacity = round2(opacity);
  }
  if (label) {
    node.label = label;
  } else if (kind === "sprite") {
    const fill = reader.fillColor(layer, 100);
    if (fill) node.fillColor = fill;
  }
  return node;
}

function boardSize(board: UnknownRecord): { width: number; height: number } {
  const rect = rec(rec(board["artboard"])["artboardRect"]);
  if ("right" in rect && "left" in rect && "bottom" in rect && "top" in rect) {
    return {
      width: (num(rect["right"]) ?? 0) - (num(rect["left"]) ?? 0),
      height: (num(rect["bottom"]) ?? 0) - (num(rect["top"]) ?? 0),
    };
  }
  return { width: num(board["width"]) ?? 0, height: num(board["height"]) ?? 0 };
}

export function buildLayoutTree(sketch: UnknownRecord, fallbackName = "design"): LayoutTree {
  const warnings: string[] = [];
  let source: LayoutTree["source"];
  let container: UnknownRecord;
  let reader: LayerReader;
  let width: number;
  let height: number;

  if (isSketchRecord(sketch["artboard"])) {
    source = "artboard";
    container = sketch["artboard"];
    reader = artboardReader;
    const frame = rec(container["frame"] ?? container["realFrame"]);
    width = num(frame["width"]) ?? 0;
    height = num(frame["height"]) ?? 0;
    if ((num(frame["left"] ?? frame["x"]) ?? 0) !== 0 || (num(frame["top"] ?? frame["y"]) ?? 0) !== 0) {
      warnings.push("画板 frame 原点不为 (0,0)，若节点整体偏移请对照预览图检查坐标基准");
    }
  } else if (isSketchRecord(sketch["board"])) {
    source = "ps";
    container = sketch["board"];
    reader = psReader;
    ({ width, height } = boardSize(container));
    const rect = rec(rec(container["artboard"])["artboardRect"]);
    if ((num(rect["left"]) ?? 0) !== 0 || (num(rect["top"]) ?? 0) !== 0) {
      warnings.push("PS 画板 artboardRect 原点不为 (0,0)，若节点整体偏移请对照预览图检查坐标基准");
    }
  } else {
    throw new Error("Sketch JSON 中既没有 artboard 也没有 board，无法生成 Cocos 节点树");
  }

  const boardName = str(container["name"]) || fallbackName;
  const rawLayers = Array.isArray(container["layers"]) ? container["layers"] : [];
  const children: LayoutNode[] = [];
  for (const layer of [...rawLayers].reverse()) {
    if (!isSketchRecord(layer)) continue;
    const node = buildNode(layer, reader, String(children.length), boardName);
    if (node) children.push(node);
  }

  if (width <= 0 || height <= 0) {
    const union = unionRect(children.map((c) => c.rect));
    width = union ? union.left + union.width : 0;
    height = union ? union.top + union.height : 0;
    warnings.push("画板尺寸缺失，已用图层包围盒估算");
  }

  return {
    source,
    boardName,
    boardWidth: round2(width),
    boardHeight: round2(height),
    root: {
      id: "",
      name: boardName,
      layerPath: boardName,
      layerType: "board",
      kind: "node",
      rect: { left: 0, top: 0, width: round2(width), height: round2(height) },
      lanhuHasImage: false,
      children,
    },
    warnings,
  };
}

export function walkLayoutNodes(root: LayoutNode, visit: (node: LayoutNode, parent?: LayoutNode) => void): void {
  const walk = (node: LayoutNode, parent?: LayoutNode): void => {
    visit(node, parent);
    for (const child of node.children) walk(child, node);
  };
  walk(root);
}
