# 版本迭代记录

> 本仓库为 monorepo；各包版本见对应 `package.json`。此处记录**面向使用者的功能与行为变更**。

---

## [Unreleased]

### 概述

`lanhu_design` 新增 **`mode=cocos`**：蓝湖效果图 + 本地切图目录 → Cocos Creator 2.x / 3.x 节点 JSON（不是 `.prefab`）。

### `@lanhu/core`

- 新增 `cocos/`：Sketch → 节点树、本地切图扫描、尺寸优先匹配、2.x/3.x emit
- 新增 `pipeline/analyze-cocos.ts`、`persist/cocos-artifacts.ts`
- 落盘：`{slug}.cocos-layout-2x.json` / `{slug}.cocos-layout-3x.json` / `{slug}.cocos.txt`

### `@lanhu/mcp`

- `lanhu_design` 增加 mode `cocos`；必填 `slice_dir`；可选 `cocos_version`（默认 both）、`unit_scale`、`local_slice_scale`、`output_dir`

### 升级注意

1. `npm run build:mcp` 后重启 MCP
2. 切图路径由调用方提供，不会从蓝湖下载 PNG

---

## [0.1.5] — 2026-08-17

### 概述

MCP 落盘时在 **`content` 文本**输出 `--- 落盘路径 ---` 块，Agent 可直接读取目录，无需依赖 `structuredContent`。

### `@lanhu/mcp`

- 新增 `mcp/src/format/persist-location.ts`：`formatPersistLocationBlock` 等共用格式化
- **`lanhu_design` · `analyze`**：多画板逐行列出落盘目录（修复原先「见 structuredContent」）
- **`lanhu_design` · `mode=slices`**：落盘路径块统一格式
- **`lanhu_page`**：落盘时输出 Axure 包根 + `screenshots/` 路径
- 切图清单文案指向 content 中的落盘路径块

### 文档

- 更新 [`BACKLOG.md`](./BACKLOG.md) §P0 各 mode 说明

### 升级注意

1. `npm run build:mcp` 后重启 MCP / Inspector

---

### 概述

统一 MCP / REST **落盘行为**：设计稿 `analyze` 默认落盘并扩展产物文件；新增 env **`LANHU_PERSIST_ARTIFACTS`** 全局开关；原型目录改为 **`lanhu_prototypes/{pid}/{docId}_{文档名}/`** 规范路径（替代旧 `axure_extract_*`）。

### `@lanhu/core`

#### 设计稿 analyze 落盘

- **`persistAnalyzeArtifacts` 扩展**（`analyze-artifacts.ts`）：`{slug}.warnings.json`、`{slug}.slices.json`（B 套元数据）、Schema 路径 `{slug}.css` / `{slug}.body.html`、并存的 `{slug}.sketch-fallback.html`
- **`{slug}.analyze-meta.json` 扩展**：`projectName`、`projectId`、`teamId`、`include`、`withSlices`、`versionId`、`schemaUrl`、`documentInfo`、`warnings` 全文
- **`analyzeDesign`**：落盘时写入 `include` / `withSlices`
- 测试：`analyze-artifacts.test.ts`

#### 落盘开关

- **`resolveLanhuPersistArtifacts`**、**`createLanhuEphemeralWorkDir`** / **`removeLanhuEphemeralWorkDir`**（`persist-config.ts`）
- **`fetchPrototypeDownloadSources`**：`LANHU_PERSIST_ARTIFACTS=false` 时 `download` 仅返回 CDN 源，不写磁盘
- 测试：`persist-config.test.ts`

#### 原型路径

- 默认输出由 `data/axure_extract_{docId8}/` + `*_screenshots/` 改为  
  `{LANHU_DATA_DIR}/lanhu_prototypes/{pid}/{docId}_{文档名}/screenshots/`
- 与 `lanhu_designs/{pid}/{designId}_{slug}/` 同族分层；自定义 `output_dir` 时截图默认 `{output_dir}/screenshots/`

### `@lanhu/mcp`

- **`lanhu_design` · `mode=analyze`**：分析成功后按 env 调用 `persistAnalyzeArtifacts`；摘要提示落盘目录；`structuredContent.designs[].artifacts` 返回路径
- **`lanhu_design` · `mode=slices`**：`LANHU_PERSIST_ARTIFACTS=false` 时退回 B 套元数据 JSON，不下载 PNG
- **`lanhu_page`**：`persist=false` 时用系统 temp 跑 Playwright，返回后清理；`persist=true` 时走 `lanhu_prototypes/` 规范路径
- **`loadConfig`**：读取 `LANHU_PERSIST_ARTIFACTS`

### `server-nest`

- **`resolveLanhuPersistArtifacts`** 与 MCP 共用 env
- **`POST /api/pages/analyze`**：`persist=false` 时允许 `tmpdir` 下截图路径供调试台读取
- **`POST /api/pages/download`**：`persist=false` 时仅返回 `sources`

### 文档

- 新增 [`DATA_LAYOUT.md`](./DATA_LAYOUT.md)
- 更新 `GITIGNORE.md`、`CURSOR_MCP.md`、`MCP_DESIGN.md`、`MCP_IMPLEMENTATION.md`、`MCP_SLICES.md`、`DEVELOPMENT.md`、`TROUBLESHOOTING.md`、`MCP_INSPECTOR.md`、`BACKLOG.md`、`README.md`、`PROTOTYPE_AND_MCP.md`、`lanhu-core/README.md`

### 升级注意

1. `npm run build:mcp`（及 `server-nest` 若在用）后重启 MCP / HTTP 服务
2. 已有 analyze 目录需**重新 analyze** 才会生成 warnings / css / body 等新文件
3. B 套切图 **PNG** 仍走 `mode=slices`，不在 analyze 落盘范围内
4. 原型旧目录 `axure_extract_*` 不会自动迁移；新请求写入 `lanhu_prototypes/`
5. Inspector 调试见 [`MCP_INSPECTOR.md`](./MCP_INSPECTOR.md)（本机终端启动、`unset PLAYWRIGHT_BROWSERS_PATH`）

---

## [0.1.3] — 2026-08-14

### 概述

`lanhu_design` **`mode=slices`** 由「仅返回 B 套切图元数据」升级为 **默认下载落盘**：一次调用完成 URL 解析、fetch 与写入 `{outputRoot}/assets/slices/`。

### `@lanhu/core`

#### 新增

- **`downloadDesignSlices`**（`packages/lanhu-core/src/lanhu/download-slices.ts`）  
  B 套切图：拉元数据 → 按 `slice_format` / `slice_scale` 解析 URL → `fetchBinaryUrl` → 落盘
- 辅助导出：`sanitizeSliceFilename`、`resolveSliceDownloadUrl`、`filterSlicesByNames`、`resolveSlicesOutputPaths`、`SliceNamesNotFoundError`
- 导出 **`applyFormatToScaleUrl`**（`slice-scale-urls.ts`）

#### 参数默认值

| 参数 | 默认 |
|------|------|
| `slice_format` | `png` |
| `slice_scale` | `2x` |
| `outputRoot`（MCP 未传 `output_dir` 时） | `{LANHU_DATA_DIR}/lanhu_designs/{pid}/{designId}_{slug}/` |

#### 测试

- 新增 `packages/lanhu-core/tests/download-slices.test.ts`（URL 解析、文件名、过滤）

### `@lanhu/mcp`

#### 变更

- **`lanhu_design` · `mode=slices`**：改调 `downloadDesignSlices`；新增 Zod 参数 `slice_format`、`slice_scale`、`slice_names`、`output_dir`
- 响应摘要 + **切图清单 Markdown 表**（蓝湖文件名 / 尺寸 / 说明 / 修改后名称）+ C-JSON mirror（含 `inventory[]` 映射字段）
- Tool description 更新：说明 slices 为下载模式，Agent 读表补全后 mv，无需再次调用 MCP

### 升级注意

1. `npm run build:mcp` 后重启 MCP
2. 未传 `output_dir` 时文件落在 **`{repoRoot}/data/lanhu_designs/{pid}/{designId}_{slug}/assets/slices/`**（传 `output_dir` 时不追加 designId 层）
3. 要写入前端业务仓库，**必须**传绝对或相对 `output_dir`

#### 修复（路径）

- MCP `loadConfig` 改用 `resolveLanhuDataDirAnchored`：默认 `{repoRoot}/data`，不再随 Cursor MCP 进程 cwd（如 `~/`）漂移到 `~/data/`
- **落盘目录加 `{designId}_{slug}` 层**：analyze + slices 默认写入 `lanhu_designs/{pid}/{designId}_{slug}/`；用户传 `output_dir` 时保持扁平
- `server-nest` 同步复用 core 同一函数，避免双份逻辑

### 未包含（后续迭代）

> 完整待办见 [`BACKLOG.md`](./BACKLOG.md)。

- `lanhu_design:selection_error` 加入镜像名单（P0 剩余）
- A 套 mapping 下载、`slice_source=mapping`（P2）
- HTTP `download-assets`、CLI（P2）

---

## [0.1.2] — 2026-08-14

### 概述

解决 Cursor Agent **读不到 `structuredContent`** 的问题：`lanhu_design` **`list` / `slices`** 模式下，在 `content` 文本末尾追加 Structured JSON 镜像，Agent 可直接解析完整列表或 B 套切图元数据。

> **Cursor 专项 workaround**  
> 镜像机制是为 **Cursor 客户端**准备的：Agent 上下文通常只含 `content`，读不到 `structuredContent`（Inspector 正常）。这不是 MCP 协议要求，其他客户端若已支持 Structured 可不受影响。  
> 维护入口：`mcp/src/structured-content-mirror.ts` → `STRUCTURED_CONTENT_MIRROR_KEYS`（白名单）。  
> **若 Cursor 官方修复**（Agent 能稳定消费 `structuredContent`），可从白名单移除对应 key、停做 content 双写，并同步调整 `mcp/tests/structured-content-mirror.test.ts`。详见 [`BACKLOG.md`](./BACKLOG.md) §P0。

### `@lanhu/mcp` — C-JSON 镜像（P0 部分）

#### 新增

- **`structured-content-mirror.ts`**  
  常量名单 `STRUCTURED_CONTENT_MIRROR_KEYS`（格式 `{tool}:{mode}`），当前 `lanhu_design:list`、`lanhu_design:slices`
- **`createToolResult(..., mirrorKey?)`**（`mcp/src/result.ts`）  
  `mirrorKey` 命中名单时，在摘要后追加 `JSON.stringify(structuredContent)`（紧凑 JSON，不截断）

#### 变更

- **`lanhu_design` · `mode=list`**：`content` 由「仅一行摘要」改为「摘要 + JSON 镜像」；`structuredContent` 仍保留供 Inspector 使用
- **`lanhu_design` · `mode=slices`**：同上，Agent 可解析完整 B 套切图元数据（`slices[]`、`scaleUrls` 等）
- **`analyze` / `tokens`**：不启用 mirror（已有足够文本，避免双倍 token）

#### 测试

- 新增 `mcp/tests/structured-content-mirror.test.ts`（含 list / slices mirror 用例）

### 升级注意

1. `npm run build:mcp` 后重启 MCP（Cursor Settings → MCP Restart）
2. Agent 调用 `list` / `slices` 时，`content` 末尾会出现完整 JSON；大项目或大切图列表 token 消耗会增加（后续 P1 可加分页）

### 未包含（后续迭代）

> 完整待办见 [`BACKLOG.md`](./BACKLOG.md)。

- `lanhu_design:selection_error` 加入镜像名单（P0 剩余）
- **`mode=slices` B 套切图下载**（默认 png@2x 落盘、`output_dir` 等，见 [`MCP_SLICES.md`](./MCP_SLICES.md)） — **已发布** §0.1.3
- structuredContent 中返回完整 `resolved_design` 元数据（P1）
- stage URL 自动从浏览器上下文推断当前画板（P1）
- `list` 分页 / sector 过滤（P1）

---

## [0.1.1] — 2026-08-13

### 概述

优化 `lanhu_design` 选稿体验：**detailDetach 链接含 `image_id` 时可直接 analyze**，与 HTTP `analyzeDesign` 行为对齐；stage 全项目多稿场景仍要求显式选稿，避免误分析。

### `@lanhu/mcp` — `lanhu_design` 选稿逻辑

#### 新增

- **`resolveDesignSelector`**（`mcp/src/tools/resolve-design-selector.ts`）  
  统一解析 `design_names`，优先级：
  1. 显式传入 `design_names`（可覆盖 URL 中的 `image_id`）
  2. URL 含 `image_id` / `docId` → 自动选该稿
  3. `listDesigns` 仅返回 1 张 → 自动选该张
  4. stage 全项目多稿且无 `image_id` → 报错并返回可选列表

- 成功响应字段 **`design_names_resolved_from`**（`analyze` / `slices` / `tokens`）  
  取值：`explicit` | `url.image_id` | `single_design`

#### 变更

- **`design_names` 由「非 list 必填」改为「有条件必填」**
  - ✅ 可省略：`detailDetach?...&image_id=...`、list 仅 1 张
  - ❌ 仍必填：`stage?tid=...&pid=...` 且项目内多稿

- 缺参错误信息增强：返回 `hint`、`auto_selectable`、`available_designs`（含 index / id / name）

- Tool **description** 与 **inputSchema** 说明同步更新

#### 测试

- 新增 `mcp/tests/resolve-design-selector.test.ts`（5 用例）
- `vitest.config.ts` 纳入 `mcp/tests/**/*.test.ts`

### 文档

| 文件 | 变更 |
|------|------|
| `docs/CURSOR_MCP.md` | `design_names` 何时可省略、参数总览 |
| `docs/MCP_DESIGN.md` | MCP 与 HTTP 选稿约定、四个 mode 说明 |
| `docs/MCP_IMPLEMENTATION.md` | 分发流程、`resolveDesignSelector` |
| `docs/TROUBLESHOOTING.md` | analyze 报 `design_names` 的排查说明 |

### Prompt

- `mcp/src/prompts/design-prompts.ts`：`frontend-dev` / `design-review` 注明 URL 含 `image_id` 时可省略 `design_names`

### 使用示例

**detailDetach（推荐，无需再传画板名）：**

```json
{
  "url": "https://lanhuapp.com/web/#/item/project/detailDetach?tid=TEAM_ID&pid=PROJECT_ID&image_id=DESIGN_ID",
  "mode": "analyze"
}
```

**stage 全项目（须指定画板）：**

```json
{
  "url": "https://lanhuapp.com/web/#/item/project/stage?tid=TEAM_ID&pid=PROJECT_ID",
  "mode": "analyze",
  "design_names": "画板名"
}
```

### 升级注意

1. 修改代码后执行 `npm run build:mcp`
2. 重启 MCP（Cursor Settings → MCP Restart，或重启 Inspector）
3. 更新 `.env` 中 `LANHU_COOKIE` 后须重启 MCP 进程（无需重新 build）
4. Schema 链路依赖 URL 中的 **`tid`** 与有效的 DDS Cookie（见 `docs/TROUBLESHOOTING.md`）

### 未包含（后续迭代）

> 完整待办见 [`BACKLOG.md`](./BACKLOG.md)。

- structuredContent 中返回完整 `resolved_design` 元数据（第二阶段）
- stage URL 自动从浏览器上下文推断当前画板
- **P0**：Cursor Agent 读不到 `structuredContent` → list/slices/选稿失败时把数据写入 `content` 文本（见 BACKLOG §P0）

---

## [0.1.0] — 基线

- `@lanhu/mcp`：`lanhu_design`（list / analyze / slices / tokens）、`lanhu_page`、Resource、Prompt
- `@lanhu/core`：设计稿 Schema / Sketch 双链路、原型 Playwright 分析
- `server-nest`：HTTP 调试 API
- 文档：`docs/CONTEXT.md`、`docs/CURSOR_MCP.md`、`docs/LANHU_API.md` 等
