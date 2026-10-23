import { describe, expect, it } from "vitest";

import { buildCocosLayoutDocument, toCocosTransform } from "../src/cocos/emit.js";
import { buildLayoutTree } from "../src/cocos/layout-tree.js";
import type { UnknownRecord } from "../src/types.js";

const sketch: UnknownRecord = {
  board: {
    name: "首页",
    artboard: { artboardRect: { left: 0, top: 0, right: 750, bottom: 1334 } },
    layers: [
      {
        name: "title",
        type: "textLayer",
        left: 40,
        top: 80,
        width: 200,
        height: 40,
        textInfo: { text: "开始游戏", size: 32, color: { value: "#FFFFFF" } },
      },
      {
        name: "btn_start",
        type: "layer",
        left: 255,
        top: 600,
        width: 240,
        height: 80,
      },
    ],
  },
};

describe("toCocosTransform", () => {
  it("converts top-left y-down absolute rect to parent-center y-up", () => {
    const tree = buildLayoutTree(sketch);
    const btn = tree.root.children.find((c) => c.name === "btn_start")!;
    const t = toCocosTransform(btn, tree.root, 1);
    expect(t.width).toBe(240);
    expect(t.height).toBe(80);
    expect(t.x).toBe(0);
    expect(t.y).toBe(27);
  });

  it("applies unitScale", () => {
    const tree = buildLayoutTree(sketch);
    const btn = tree.root.children.find((c) => c.name === "btn_start")!;
    const t = toCocosTransform(btn, tree.root, 0.5);
    expect(t.width).toBe(120);
    expect(t.x).toBe(0);
    expect(t.y).toBe(13.5);
  });
});

describe("buildCocosLayoutDocument", () => {
  it("emits 2.x node fields and 3.x UITransform", () => {
    const tree = buildLayoutTree(sketch);
    const doc2 = buildCocosLayoutDocument(tree, { cocosVersion: "2.x" });
    const doc3 = buildCocosLayoutDocument(tree, { cocosVersion: "3.x" });

    expect(doc2.format).toBe("lanhu-cocos-layout");
    expect(doc2.designResolution).toEqual({ width: 750, height: 1334 });

    const title2 = doc2.root.children.find((c) => c.name === "title")!;
    expect(title2["anchorX"]).toBe(0.5);
    expect(title2.components[0]?.["__type__"]).toBe("cc.Label");
    expect(title2.components[0]?.["string"]).toBe("开始游戏");

    const title3 = doc3.root.children.find((c) => c.name === "title")!;
    expect(title3.components[0]?.["__type__"]).toBe("cc.UITransform");
    expect(title3.components[1]?.["__type__"]).toBe("cc.Label");
    expect(title3["position"]).toMatchObject({ z: 0 });
  });
});
