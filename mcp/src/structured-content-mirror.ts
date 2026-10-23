/** 已注册的镜像 key：lanhu_design mode=list */
export const LANHU_DESIGN_LIST_MIRROR_KEY = "lanhu_design:list";

/** 已注册的镜像 key：lanhu_design mode=slices */
export const LANHU_DESIGN_SLICES_MIRROR_KEY = "lanhu_design:slices";

/** 已注册的镜像 key：lanhu_design mode=cocos（仅未落盘时镜像 JSON） */
export const LANHU_DESIGN_COCOS_MIRROR_KEY = "lanhu_design:cocos";

/**
 * C-JSON 镜像：将 structuredContent 以紧凑 JSON 追加到 content 文本末尾。
 *
 * **Cursor 专项 workaround**：Agent 主要读 content，读不到 structuredContent。
 * 仅对下列白名单 key 做镜像；若 Cursor 官方修复，可从 STRUCTURED_CONTENT_MIRROR_KEYS
 * 移除条目并更新 mcp/tests/structured-content-mirror.test.ts（见 docs/CHANGELOG.md §0.1.2）。
 * key 格式：`{tool}:{mode}`；为其他 tool/mode 启用镜像时在此数组追加条目即可。
 */
export const STRUCTURED_CONTENT_MIRROR_KEYS = [
  LANHU_DESIGN_LIST_MIRROR_KEY,
  LANHU_DESIGN_SLICES_MIRROR_KEY,
  LANHU_DESIGN_COCOS_MIRROR_KEY,
] as const;

export type StructuredContentMirrorKey = (typeof STRUCTURED_CONTENT_MIRROR_KEYS)[number];

const MIRROR_KEY_SET = new Set<string>(STRUCTURED_CONTENT_MIRROR_KEYS);

/** 判断 mirrorKey 是否在镜像名单内 */
export function shouldMirrorStructuredContent(key: string): key is StructuredContentMirrorKey {
  return MIRROR_KEY_SET.has(key);
}

/** 在摘要后追加 structuredContent 的紧凑 JSON 字符串 */
export function appendStructuredContentMirror(
  summary: string,
  structured: Record<string, unknown>,
): string {
  return `${summary}\n\n${JSON.stringify(structured)}`;
}

/**
 * 组装 tool 返回的 content 文本。
 * mirrorKey 命中名单时，在 summary 后追加 JSON 镜像；否则仅返回 summary。
 */
export function buildToolResultText(
  summary: string,
  structured: Record<string, unknown> | undefined,
  mirrorKey?: string,
): string {
  if (!structured || !mirrorKey || !shouldMirrorStructuredContent(mirrorKey)) {
    return summary;
  }
  return appendStructuredContentMirror(summary, structured);
}
