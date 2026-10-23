import { describe, expect, it } from "vitest";

import { createToolResult } from "../src/result.js";
import {
  STRUCTURED_CONTENT_MIRROR_KEYS,
  appendStructuredContentMirror,
  buildToolResultText,
  shouldMirrorStructuredContent,
} from "../src/structured-content-mirror.js";

describe("structured-content-mirror", () => {
  it("lists mirror keys", () => {
    expect(STRUCTURED_CONTENT_MIRROR_KEYS).toEqual([
      "lanhu_design:list",
      "lanhu_design:slices",
      "lanhu_design:cocos",
    ]);
  });

  it("mirrors only registered keys", () => {
    expect(shouldMirrorStructuredContent("lanhu_design:list")).toBe(true);
    expect(shouldMirrorStructuredContent("lanhu_design:slices")).toBe(true);
    expect(shouldMirrorStructuredContent("lanhu_design:cocos")).toBe(true);
    expect(shouldMirrorStructuredContent("lanhu_design:analyze")).toBe(false);
    expect(shouldMirrorStructuredContent("lanhu_page:list")).toBe(false);
  });

  it("appends compact JSON after summary", () => {
    const structured = { mode: "list", totalDesigns: 2, designs: [{ index: 1, name: "A" }] };
    const text = appendStructuredContentMirror("Loaded 2 design(s).", structured);
    expect(text.startsWith("Loaded 2 design(s).\n\n")).toBe(true);
    expect(JSON.parse(text.slice(text.indexOf("{")))).toEqual(structured);
  });

  it("buildToolResultText skips unregistered keys", () => {
    const structured = { mode: "analyze" };
    expect(buildToolResultText("summary", structured, "lanhu_design:analyze")).toBe("summary");
  });

  it("createToolResult mirrors when mirrorKey is registered", () => {
    const structured = { mode: "list", totalDesigns: 1, designs: [] };
    const result = createToolResult("Loaded 1 design(s).", structured, false, "lanhu_design:list");
    expect(result.structuredContent).toEqual(structured);
    expect(result.content[0]?.type).toBe("text");
    if (result.content[0]?.type === "text") {
      expect(result.content[0].text).toContain('"mode":"list"');
      expect(result.content[0].text.startsWith("Loaded 1 design(s).\n\n")).toBe(true);
    }
  });

  it("createToolResult mirrors slices mode", () => {
    const structured = {
      status: "success",
      mode: "slices",
      totalSlices: 2,
      slices: [{ name: "icon", downloadUrl: "https://example.com/a.png" }],
    };
    const result = createToolResult(
      "Loaded 2 slice(s) for 首页.",
      structured,
      false,
      "lanhu_design:slices",
    );
    expect(result.structuredContent).toEqual(structured);
    expect(result.content[0]?.type).toBe("text");
    if (result.content[0]?.type === "text") {
      expect(result.content[0].text).toContain('"mode":"slices"');
      expect(result.content[0].text.startsWith("Loaded 2 slice(s) for 首页.\n\n")).toBe(true);
    }
  });
});
