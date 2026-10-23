import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { scanLocalSlices } from "../src/cocos/local-slices.js";
import { fakePng } from "./cocos-image-size.test.js";

describe("scanLocalSlices", () => {
  it("scans png files and skips .meta / non-images", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lanhu-slices-"));
    await writeFile(join(dir, "btn.png"), fakePng(480, 160));
    await writeFile(join(dir, "btn.png.meta"), "uuid: abc");
    await writeFile(join(dir, "readme.txt"), "nope");

    const result = await scanLocalSlices(dir);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toMatchObject({ relPath: "btn.png", width: 480, height: 160 });
  });

  it("throws when directory is missing", async () => {
    await expect(scanLocalSlices(join(tmpdir(), "lanhu-missing-slices-xyz"))).rejects.toThrow(
      /切图目录不存在/,
    );
  });
});
