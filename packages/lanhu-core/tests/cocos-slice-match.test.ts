import { describe, expect, it } from "vitest";

import { buildLayoutTree } from "../src/cocos/layout-tree.js";
import type { LocalSliceFile } from "../src/cocos/local-slices.js";
import { matchLocalSlices, normalizeSliceName } from "../src/cocos/slice-match.js";
import type { UnknownRecord } from "../src/types.js";

function file(relPath: string, width: number, height: number): LocalSliceFile {
  return {
    file: `/abs/${relPath}`,
    relPath,
    name: relPath.replace(/\.[^.]+$/, "").split("/").pop() ?? relPath,
    width,
    height,
  };
}

const sketch: UnknownRecord = {
  board: {
    name: "首页",
    artboard: { artboardRect: { left: 0, top: 0, right: 750, bottom: 1334 } },
    layers: [
      {
        name: "btn_start",
        type: "layer",
        left: 255,
        top: 600,
        width: 240,
        height: 80,
      },
      {
        name: "icon",
        type: "layer",
        left: 10,
        top: 10,
        width: 48,
        height: 48,
      },
    ],
  },
};

describe("normalizeSliceName", () => {
  it("strips @2x and copy suffixes", () => {
    expect(normalizeSliceName("btn_start@2x")).toBe("btnstart");
    expect(normalizeSliceName("button 拷贝")).toBe("button");
  });
});

describe("matchLocalSlices", () => {
  it("auto-detects 2x and prefers size match", () => {
    const tree = buildLayoutTree(sketch);
    const result = matchLocalSlices(tree.root, [
      file("btn_start.png", 480, 160),
      file("icon.png", 96, 96),
      file("unused.png", 10, 10),
    ]);

    expect(result.sliceScale).toMatchObject({ scale: 2, source: "auto" });
    const btn = tree.root.children.find((c) => c.name === "btn_start")!;
    expect(btn.sprite?.confidence).toBe("high");
    expect(btn.sprite?.relPath).toBe("btn_start.png");
    const icon = tree.root.children.find((c) => c.name === "icon")!;
    expect(icon.sprite?.relPath).toBe("icon.png");
    expect(result.unusedSlices.map((f) => f.relPath)).toEqual(["unused.png"]);
    expect(result.stats.high).toBe(2);
  });

  it("keeps name-only match as low confidence", () => {
    const tree = buildLayoutTree(sketch);
    matchLocalSlices(tree.root, [file("btn_start.png", 10, 10)], { sliceScale: 2 });
    const btn = tree.root.children.find((c) => c.name === "btn_start")!;
    expect(btn.sprite?.confidence).toBe("low");
    expect(btn.sprite?.relPath).toBe("btn_start.png");
  });
});
