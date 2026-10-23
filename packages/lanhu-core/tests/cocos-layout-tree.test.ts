import { describe, expect, it } from "vitest";

import { buildLayoutTree, normalizeColor, walkLayoutNodes } from "../src/cocos/layout-tree.js";
import type { UnknownRecord } from "../src/types.js";

const psSketch: UnknownRecord = {
  board: {
    name: "首页",
    width: 750,
    height: 1334,
    artboard: { artboardRect: { left: 0, top: 0, right: 750, bottom: 1334 } },
    layers: [
      {
        name: "title",
        type: "textLayer",
        left: 40,
        top: 80,
        width: 200,
        height: 40,
        textInfo: {
          text: "开始游戏",
          size: 32,
          color: { red: 255, green: 255, blue: 255 },
          justification: "center",
        },
      },
      {
        name: "btn_start",
        type: "layer",
        left: 255,
        top: 600,
        width: 240,
        height: 80,
        images: { png_xxxhd: "https://example.com/btn.png" },
      },
      {
        name: "bg",
        type: "layer",
        left: 0,
        top: 0,
        width: 750,
        height: 1334,
      },
      {
        name: "hidden",
        type: "layer",
        visible: false,
        left: 0,
        top: 0,
        width: 10,
        height: 10,
      },
    ],
  },
};

describe("normalizeColor", () => {
  it("converts rgb object and hex3", () => {
    expect(normalizeColor({ red: 255, green: 0, blue: 0 })).toBe("#FF0000");
    expect(normalizeColor("#0af")).toBe("#00AAFF");
  });
});

describe("buildLayoutTree", () => {
  it("builds PS board: skip hidden, reverse for Cocos z-order, classify kinds", () => {
    const tree = buildLayoutTree(psSketch);
    expect(tree.source).toBe("ps");
    expect(tree.boardWidth).toBe(750);
    expect(tree.boardHeight).toBe(1334);
    expect(tree.root.children.map((c) => c.name)).toEqual(["bg", "btn_start", "title"]);

    const byName = Object.fromEntries(tree.root.children.map((c) => [c.name, c]));
    expect(byName["title"]?.kind).toBe("label");
    expect(byName["title"]?.label?.string).toBe("开始游戏");
    expect(byName["title"]?.label?.fontSize).toBe(32);
    expect(byName["title"]?.label?.horizontalAlign).toBe("center");
    expect(byName["btn_start"]?.kind).toBe("sprite");
    expect(byName["btn_start"]?.lanhuHasImage).toBe(true);
    expect(byName["bg"]?.kind).toBe("sprite");
  });

  it("builds Sketch artboard from frame", () => {
    const sketch: UnknownRecord = {
      artboard: {
        name: "Page",
        frame: { x: 0, y: 0, width: 375, height: 812 },
        layers: [
          {
            name: "icon",
            type: "bitmap",
            isVisible: true,
            frame: { x: 10, y: 20, width: 48, height: 48 },
            image: { imageUrl: "https://example.com/icon.png" },
          },
        ],
      },
    };
    const tree = buildLayoutTree(sketch);
    expect(tree.source).toBe("artboard");
    expect(tree.root.children).toHaveLength(1);
    expect(tree.root.children[0]?.lanhuHasImage).toBe(true);
    const names: string[] = [];
    walkLayoutNodes(tree.root, (node) => names.push(node.name));
    expect(names).toEqual(["Page", "icon"]);
  });
});
