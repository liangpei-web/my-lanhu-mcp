import { describe, expect, it } from "vitest";

import { readImageSize } from "../src/cocos/image-size.js";

/** 仅含 IHDR 宽高的假 PNG，足够 readImageSize 解析 */
export function fakePng(width: number, height: number): Buffer {
  const buf = Buffer.alloc(24);
  buf.writeUInt32BE(0x89504e47, 0);
  buf.writeUInt32BE(0x0d0a1a0a, 4);
  buf.write("IHDR", 12, "ascii");
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

describe("readImageSize", () => {
  it("reads PNG IHDR width/height", () => {
    expect(readImageSize(fakePng(240, 80))).toEqual({ width: 240, height: 80 });
  });

  it("returns undefined for empty buffer", () => {
    expect(readImageSize(Buffer.alloc(0))).toBeUndefined();
  });
});
