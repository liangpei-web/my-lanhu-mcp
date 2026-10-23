# @lanhu/core

蓝湖设计稿解析的 **纯 Node 库**：URL 解析、蓝湖 HTTP、Schema/Sketch 转 HTML、切图元数据、一键流水线。

- **无** HTTP 服务、**无** Vue、**无** MCP
- 由 `server-nest`、`mcp/` 等上层 `import` 后对外提供 API

```bash
npm run build -w @lanhu/core
npm run check -w @lanhu/core
```

测试：`tests/` · 根目录 `npm test`。

**项目架构** → [`../../docs/CONTEXT.md`](../../docs/CONTEXT.md) · **HTTP 路由** → [`../../server-nest/README.md`](../../server-nest/README.md) · **排错** → [`../../docs/TROUBLESHOOTING.md`](../../docs/TROUBLESHOOTING.md)

---

## 目录结构

### 先记四层

`@lanhu/core` 按职责分层：

```text
┌─────────────────────────────────────────────────────────────┐
│ 编排层   pipeline/*  analyze-design / analyze-include / analyze-cocos │
├─────────────────────────────────────────────────────────────┤
│ 蓝湖层   lanhu/*  client / parse-url / designs / pages       │
│          pick-design / design-sectors                        │
├─────────────────────────────────────────────────────────────┤
│ 转换层   transform/*  （只吃 JSON，不打蓝湖）                 │
├─────────────────────────────────────────────────────────────┤
│ 落盘层   persist/*    （可选，LANHU_DATA_DIR）                │
└─────────────────────────────────────────────────────────────┘
         index.ts  types.ts  → 对外 export
```

日常改 bug：**列表/切图** → `lanhu/designs.ts`；**原型** → `lanhu/pages.ts` + `transform/page-*`；**HTML/mapping** → `transform/`；**一键 analyze** → `pipeline/`；**写 data/** → `persist/`。

### `packages/lanhu-core/` 文件树（当前）

```text
packages/lanhu-core/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts                 # 对外 export 汇总
│   ├── types.ts                 # 公共类型（保留根目录，全包引用）
│   ├── lanhu/
│   │   ├── client.ts
│   │   ├── parse-url.ts
│   │   ├── designs.ts           # list / schema / sketch / getSlices（B 套）
│   │   ├── pages.ts             # 原型：列文档/列页/下载/分析
│   │   ├── design-sectors.ts
│   │   └── pick-design.ts
│   ├── pipeline/
│   │   ├── analyze-design.ts    # analyzeDesign / analyzeDesignBatch
│   │   ├── analyze-include.ts   # include 分支（MCP / HTTP 共用）
│   │   ├── analyze-cocos.ts     # 效果图 + 本地切图 → Cocos 节点 JSON
│   │   └── concurrency.ts       # 批量并发（默认 5）
│   ├── cocos/
│   │   ├── layout-tree.ts       # Sketch → 引擎无关节点树
│   │   ├── local-slices.ts      # 扫描用户切图目录
│   │   ├── slice-match.ts       # 尺寸为主匹配 Sprite
│   │   ├── emit.ts              # 2.x / 3.x 节点 JSON
│   │   └── image-size.ts        # PNG/JPEG/WebP/GIF 文件头尺寸
│   ├── persist/
│   │   ├── data-dir.ts          # LANHU_DATA_DIR、安全文件名
│   │   ├── analyze-artifacts.ts # 落盘 html / mapping / 预览图等
│   │   └── cocos-artifacts.ts   # 落盘 cocos-layout JSON
│   └── transform/
│       ├── convert-schema.ts    # Schema → HTML + mapping（A 套入口）
│       ├── schema-to-html.ts    # DDS 树 → HTML 字符串
│       ├── localize-image-urls.ts
│       ├── convert-sketch.ts    # Sketch fallback 入口
│       ├── sketch-to-html.ts
│       ├── sketch-utils.ts
│       ├── design-tokens.ts
│       ├── layer-tree.ts
│       ├── layout-summary.ts
│       ├── sketch-annotations.ts
│       ├── slice-scale-urls.ts  # B 套 scaleUrls
│       ├── fix-html-files.ts    # 原型 HTML 修复
│       ├── page-browser-analyzer.ts
│       ├── page-static-extractor.ts
│       ├── page-design-info-format.ts
│       └── constants.ts
├── tests/                       # vitest（根目录 npm test）
│   ├── pick-design.test.ts
│   ├── get-slices.test.ts
│   ├── layer-tree.test.ts
│   ├── layout-summary.test.ts
│   └── data-dir.test.ts
└── dist/                        # tsc 产物（勿手改；勿提交陈旧 .js）
```

> `transform/` 文件多，是因为 **A 套 / Sketch fallback / 标注 / B 套 URL / 原型 Playwright** 分文件；`lanhu/designs.ts` 单文件较大，主因 **B 套切图** 逻辑集中在此（后续可抽到 `lanhu/slices/` 子目录）。

---

## 对外 API 一览

从 `import { … } from "@lanhu/core"` 导出，按模块说明用途。

### `lanhu/parse-url.ts`

| 导出 | 用途 |
|------|------|
| `parseLanhuUrl(input)` | 解析 stage / detailDetach 等链接或 query 字符串 |
| `buildQuery(params)` | 拼蓝湖 API query（内部/调试） |

### `lanhu/client.ts`

| 导出 | 用途 |
|------|------|
| `LanhuClient` | 带 Cookie 的蓝湖客户端 |
| `LanhuApiError` | API 非 `00000` 或 HTTP 失败 |
| `createLanhuFetch` | 注入统一 Header 的 fetch |
| `getLanhuPayload` / `getJson` | 通用 JSON 请求 |
| `getDocumentInfo` / `getDesignDocument` | 单稿详情 |
| `getProjectMultiInfo` | 项目多图、查 `latest_version` |
| `getDdsSchemaRevision` | DDS schema 修订 URL |
| `getProjectSectors` | 项目分组（`listDesigns` 内部也会调） |
| `fetchBinaryUrl` | 下载 CDN/预览图二进制（base64） |

构造：`new LanhuClient({ cookie, ddsCookie?, fetchImpl? })`。

### `lanhu/designs.ts`

| 导出 | 用途 | 访问蓝湖 |
|------|------|----------|
| `listDesigns(client, url \| params)` | 设计稿列表；合并 sectors、`aiSuggestion`（>8 张） | 是 |
| `getDesignSchemaJson(client, imageId, teamId, projectId)` | 拉 DDS Schema JSON | 是 |
| `getSketchJson(...)` | 拉 Sketch JSON + 文档信息 | 是 |
| `getSlices(...)` | **切图 B 套**：从 sketch 提取切图 + `scaleUrls` | 是 |

`listDesigns` 支持 `detailDetach` 单稿 URL（返回 1 条，不拉 sectors）。

### `lanhu/design-sectors.ts`

| 导出 | 用途 |
|------|------|
| `normalizeDesignSectors(raw)` | 分组路径、`image_id → 分组列表` |
| `sectorNamesForDesign(map, id)` | 单稿分组名数组 |
| `buildDesignListAiSuggestion(n)` | 设计过多时的 AI 提示文案 |

### `lanhu/pick-design.ts`

| 导出 | 用途 |
|------|------|
| `pickDesign` / `pickDesigns` | 按 index / 全名 / 子串选稿 |
| `normalizeDesignQuotes` | 弯引号 → 直引号 |

### `lanhu/pages.ts` — 原型 / PRD（Axure）

使用 `createLanhuFetch({ cookie })` 或 `LanhuClient` 派生的 fetch；URL 须为 `#/item/project/product?tid=...&pid=...`，列页/下载/分析须带 `docId`。

| 导出 | 用途 | 访问蓝湖 |
|------|------|----------|
| `listProductDocuments(fetch, teamId, projectId)` | 项目下 PRD/原型文档列表 | 是 |
| `listPages(fetch, url)` | 单份文档内页面树（sitemap） | 是 |
| `downloadResources(fetch, url, outputDir, forceUpdate?)` | 下载整包 Axure 静态资源 | 是 |
| `analyzePrototypePages(fetch, url, outputDir, pageNames, opts?)` | 下载 → 修 HTML → **Playwright** 截图/文本/样式 | 是 / 否 |
| `analyzeLocalPage(outputDir, pageName, opts?)` | 对已下载目录单页重分析（不访问蓝湖） | 否 |
| `getPrototypeDocumentInfo(fetch, url)` | 文档元信息 + mapping URL | 是 |
| `resolvePrototypeDocumentUrl(url, docId)` | 拼带 docId 的标准 product URL | 否 |

`pageNames` 为页面**展示名**、`"all"` 或数组；**不**直接读 URL 中的 `pageId`（MCP/HTTP 层负责映射）。

### `transform/page-*` + `persist/data-dir.ts`（原型）

| 导出 | 用途 |
|------|------|
| `fixHtmlFiles(outputDir)` | 修复 Axure HTML 路径与脚本 |
| `renderPrototypePages(...)` | Playwright 渲染引擎（低层） |
| `extractPageContentFromFile` / `extractPageContentFromHtml` | 静态 HTML 提取（辅助） |
| `formatPageDesignInfo` | 样式摘要文本 |
| `resolvePrototypeOutputDir` / `resolvePrototypeScreenshotDir` | `data/lanhu_prototypes/{pid}/{docId}_{slug}/` + `screenshots/` |
| `resolveAxureOutputDir` / `resolveAxureScreenshotDir` | 上述函数别名（保留旧导出名） |

原型管线与 MCP 行为详见 [`../../docs/PROTOTYPE_AND_MCP.md`](../../docs/PROTOTYPE_AND_MCP.md)。HTTP 路由见 [`../../server-nest/README.md`](../../server-nest/README.md) §原型接口。

### `pipeline/analyze-design.ts`

| 导出 | 用途 |
|------|------|
| `analyzeDesign(options)` | 一键流水线（见下节） |
| `analyzeDesignBatch(options)` | 多稿并发（`pipeline/concurrency.ts`） |

`AnalyzeDesignOptions`：`url`、`design?`、`withSlices?`、`cookie`、`ddsCookie`。

### `pipeline/analyze-cocos.ts` + `cocos/`

蓝湖效果图提供层级/坐标/文案，**切图目录由调用方提供**（不下载蓝湖 PNG）。输出节点描述 JSON，不是 `.prefab`。

| 导出 | 用途 |
|------|------|
| `analyzeDesignForCocos(client, ctx, design, options)` | 拉 Sketch → 扫 `sliceDir` → 匹配 → 2.x/3.x JSON |
| `buildCocosFromSketch(sketch, options)` | 纯转换（已有 Sketch / 切图列表时） |
| `buildLayoutTree` / `matchLocalSlices` / `buildCocosLayoutDocument` | 分步：树 / 匹配 / emit |

### `transform/` — 本地处理（一般不访问蓝湖）

| 导出 | 用途 |
|------|------|
| `convertLanhuSchema(schema, designName)` | **A 套**：Schema → HTML + `mapping` |
| `convertLanhuToHtml` / `minifyHtml` / `localizeImageUrls` | 转换子步骤 |
| `convertLanhuSketch(sketch, opts)` | Sketch → HTML fallback |
| `convertSketchToHtml` | 底层 sketch 转 HTML |
| `extractDesignTokens(sketch)` | 设计 token 文本（供 AI） |
| `resolveDesignScale` / `resolveDesignImageUrl` | Sketch 辅助 |
| `buildScaleUrls` / `buildPsScaleUrls` / `applyFormatToScaleUrl` | **B 套** 多倍率 URL |

---

## `analyzeDesign` 流水线

```text
parseLanhuUrl
  → listDesigns
  → pickDesign
  → [有 teamId] getDesignSchemaJson → convertLanhuSchema     （convertSource: schema）
  → getSketchJson
  → extractDesignTokens
  → [schema 失败] convertLanhuSketch                         （convertSource: sketch）
  → [withSlices] getSlices
```

- 失败步骤写入 `warnings[]`，不中断整条（除非 list 等关键步失败）。
- 返回 `AnalyzeDesignResult`：`design`、`convert`、`schema`、`sketch`、`designTokens`、`layoutSummary`、`layerTree`、`sketchAnnotations`、`layerAnnotations`、`slices` 等。

---

## 原型分析流水线

```text
parseLanhuUrl（kind=prototype）
  → [无 docId] listProductDocuments
  → [有 docId] getPrototypeDocumentInfo → downloadResources
  → listPages
  → fixHtmlFiles
  → renderPrototypePages（Playwright）
  → 截图 + 文本 + 样式 JSON
```

- 落盘：`resolveAxureOutputDir` / `resolveAxureScreenshotDir`（见 [`../../docs/DATA_LAYOUT.md`](../../docs/DATA_LAYOUT.md) §2）。
- 需本机已执行 `npx playwright install chromium`（见 [`../../docs/TROUBLESHOOTING.md`](../../docs/TROUBLESHOOTING.md) §3）。

---

## 切图：A 套 vs B 套

| 套 | 数据从哪来 | core 入口 | 典型用途 |
|----|------------|-----------|----------|
| **A** | `convert.after.mapping` | `convertLanhuSchema` → `localizeImageUrls` | HTML 内 `./assets/slices/*` 对照 CDN |
| **B** | 设计师登记切图 + 倍率 | `getSlices` + `buildScaleUrls` / `buildPsScaleUrls` | 下载 PNG/WebP、MCP 切图 tool |

两套互不替代；B 套入口为 `getSlices`。

### 当前行为（实现现状）

| 入口 | A 套 | B 套 |
|------|------|------|
| `analyzeDesign` | **默认有**：Schema/sketch 转换产出 `convert.after.mapping` + HTML 本地路径 | **默认无**：仅当 `withSlices: true` 时在结果里附带 `slices`（元数据，不批量下载 PNG） |
| `POST /api/designs/slices` | — | 仅 B 套 |
| `POST /api/designs/convert` | 仅 A 套 | — |
| 调试台切图 Tab | 可手动切 `mapping` / `scaleUrls` 两源展示与下载 | 同左 |

`persistAnalyzeArtifacts` 落盘整稿预览 PNG、HTML/mapping、schema/sketch、各类摘要，以及 **warnings.json**、**slices.json**（B 套元数据）、Schema 路径的 **css/body.html**、并存的 **sketch-fallback.html**；**不会**自动把 A 套 mapping 里每张图或 B 套切图 PNG 全部下载到 `data/`（切图 PNG 走 `mode=slices` / `downloadDesignSlices`）。

### 计划：统一选择 A 套 / B 套（待做）

后续在 **analyze / MCP / 调试台 / 批量下载** 中支持显式选择切图源，避免 Agent 或前端混用两套路径：

| 计划参数（草案） | 取值 | 行为 |
|------------------|------|------|
| `sliceSource` 或 `assetSource` | `"mapping"` | 仅 A 套：用 `convert.after.mapping` 生成下载列表 |
| | `"slices"` | 仅 B 套：调 `getSlices`，用 `scaleUrls` / `downloadUrl` |
| | `"both"` | 两套都返回/都可选下载（去重策略待定） |

拟落地范围：

- `@lanhu/core`：`AnalyzeDesignOptions.sliceSource?`；按选择拉取/聚合，不与 `withSlices` 语义重复（`withSlices` 可收敛为 `sliceSource` 含 B 套）
- `server-nest`：`POST /api/designs/analyze` body 同上；可选 `POST /api/designs/download-assets` 按源批量落盘
- `mcp/`：`lanhu_design` · `analyze` 的 `include` 或独立字段对齐，并增加 **mapping 资产** 说明
- `debug-react`：切图 Tab 已有 `mapping` / `scaleUrls` 切换，与 API 字段对齐命名

---

## 主要类型（`types.ts`）

| 类型 | 说明 |
|------|------|
| `LanhuUrlParams` | 解析后的 URL 参数 |
| `LanhuDesignSummary` / `LanhuDesignListResult` | 列表项与列表结果（含 `sectors`、`aiSuggestion`） |
| `LanhuDesignSchemaJsonResult` | schema + versionId + schemaUrl |
| `LanhuSketchJsonResult` | sketch + documentInfo |
| `LanhuSlicesResult` / `LanhuSliceInfo` | B 套切图列表 |
| `AnalyzeDesignResult` | 流水线聚合结果 |
| `ConvertLanhuSchemaResult` / `ConvertSketchResult` | 转换结果（before/after/mapping） |
| `LanhuPageEntry` / `LanhuPagesListResult` | 原型文档内页面列表 |
| `DownloadResourcesResult` | Axure 包下载结果 |
| `AnalyzeLocalPageResult` | 单页本地重分析结果 |

---

## 使用示例

```ts
import {
  LanhuClient,
  listDesigns,
  analyzeDesign,
  convertLanhuSchema,
} from "@lanhu/core";

const client = new LanhuClient({ cookie: process.env.LANHU_COOKIE });

// 列表
const list = await listDesigns(client, "https://lanhuapp.com/web/#/item/project/stage?tid=...&pid=...");

// 仅转换（已有 schema，不访问蓝湖）
const convert = convertLanhuSchema(schemaObject, "首页");

// 一键（会访问蓝湖）
const analyzed = await analyzeDesign({
  url: "https://lanhuapp.com/web/#/item/project/stage?tid=...&pid=...",
  design: "6",
  withSlices: true,
  cookie: process.env.LANHU_COOKIE,
});
```

```ts
import { createLanhuFetch, analyzePrototypePages } from "@lanhu/core";

const fetch = createLanhuFetch({ cookie: process.env.LANHU_COOKIE });
const url = "https://lanhuapp.com/web/#/item/project/product?tid=...&pid=...&docId=...";

// 分析文档内全部页面（需已安装 Playwright Chromium）
const proto = await analyzePrototypePages(
  fetch,
  url,
  "./data/lanhu_prototypes/{pid}/{docId}_{slug}",
  "all",
);
```

---

## 依赖与约束

- Node.js ≥ 20，`"type": "module"`
- 需要有效蓝湖 **Cookie**（`LANHU_COOKIE`；DDS 默认复用同一 Cookie，或 HTTP body 传 `ddsCookie`）
- 列表 / schema 等设计稿接口通常需要 URL 中的 **`tid`（team_id）**
- 原型 Playwright 分析需 **`npx playwright install chromium`**（`@lanhu/core` 依赖 `playwright`）

---

## 相关文档

- 文档索引：[`../../docs/README.md`](../../docs/README.md)
- 项目上下文：[`../../docs/CONTEXT.md`](../../docs/CONTEXT.md)
- **蓝湖外网 API**：[`../../docs/LANHU_API.md`](../../docs/LANHU_API.md)
- HTTP 路由：[`../../server-nest/README.md`](../../server-nest/README.md)
- 原型管线：[`../../docs/PROTOTYPE_AND_MCP.md`](../../docs/PROTOTYPE_AND_MCP.md)
- 排错：[`../../docs/TROUBLESHOOTING.md`](../../docs/TROUBLESHOOTING.md)
