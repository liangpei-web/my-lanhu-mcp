import { describe, expect, it } from "vitest";

import { buildCocosFromSketch, formatCocosAnalyzeText, resolveCocosVersions } from "../src/pipeline/analyze-cocos.js";
import type { LocalSliceFile } from "../src/cocos/local-slices.js";
import type { UnknownRecord } from "../src/types.js";

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
    ],
  },
};

const files: LocalSliceFile[] = [
  {
    file: "/game/assets/ui/btn_start.png",
    relPath: "btn_start.png",
    name: "btn_start",
    width: 480,
    height: 160,
  },
];

describe("resolveCocosVersions", () => {
  it("expands both", () => {
    expect(resolveCocosVersions("both")).toEqual(["2.x", "3.x"]);
    expect(resolveCocosVersions("2.x")).toEqual(["2.x"]);
  });
});

describe("buildCocosFromSketch", () => {
  it("matches slices and emits both engine documents", () => {
    const result = buildCocosFromSketch(sketch, {
      designName: "首页",
      designId: "d1",
      cocosVersion: "both",
      sliceDir: "/game/assets/ui",
      localFiles: files,
    });

    expect(result.documents).toHaveLength(2);
    expect(result.match?.stats.high).toBe(1);
    const sprite2 = result.documents[0]!.root.children.find((c) => c.name === "btn_start");
    expect(sprite2?.components[0]).toMatchObject({
      __type__: "cc.Sprite",
      spriteFrame: "btn_start.png",
    });
    const sprite3 = result.documents[1]!.root.children.find((c) => c.name === "btn_start");
    expect(sprite3?.components.find((c) => c["__type__"] === "cc.Sprite")).toMatchObject({
      spriteFrame: "btn_start.png/spriteFrame",
    });

    const text = formatCocosAnalyzeText(result);
    expect(text).toContain("btn_start");
    expect(text).toContain("不是 .prefab");
  });
});
