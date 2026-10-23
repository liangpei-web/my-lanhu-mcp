# Lanhu Node — 项目上下文

> 供新 Cursor 对话 / 新协作者快速恢复上下文。  
> 文档索引见 [`docs/README.md`](./README.md) · 开发上手见 [`DEVELOPMENT.md`](./DEVELOPMENT.md)。  
> 最后更新：2026-07-22

---

## 1. 项目是什么

**lanhu-node** 是用 Node.js + TypeScript 实现的蓝湖（Lanhu）设计稿与原型（PRD/Axure）解析 monorepo。

统一架构：

```text
调试台（apps/debug-react · 主）
        ↓ HTTP :3001
Nest 服务（server-nest/）
        ↓ import
核心库（packages/lanhu-core/）
        ↓ fetch + Cookie
蓝湖 API（lanhuapp.com / dds.lanhuapp.com / CDN）

MCP（mcp/ · @lanhu/mcp）──┐
                           ├─ 同样只调 @lanhu/core
Cursor / Inspector ────────┘
```

**原则**

- 业务逻辑全部在 `@lanhu/core`；HTTP 与 MCP 都是薄壳
- 调试台不直连蓝湖；Cookie 只在 server / MCP 环境变量中配置
- 切图分 **A 套**（convert mapping）与 **B 套**（scaleUrls / getSlices），是本项目专有术语

---

## 2. 目录结构

```text
lanhu-node/
├── packages/lanhu-core/     # 蓝湖 API、Schema/Sketch 转换、原型管线、落盘
├── server-nest/             # Nest HTTP 调试 API（:3001）
├── mcp/                     # stdio MCP：lanhu_design、lanhu_page
├── apps/
│   └── debug-react/         # 主调试台（:5174，npm run dev 默认启动）
├── data/                    # analyze / 原型缓存落盘（gitignore）
├── docs/                    # 项目文档
└── package.json             # npm workspaces 根
```

各包细节：

| 路径 | 说明 |
|------|------|
| [`packages/lanhu-core/README.md`](../packages/lanhu-core/README.md) | core 模块树、导出 API |
| [`server-nest/README.md`](../server-nest/README.md) | HTTP 路由与调用关系 |
| [`mcp/README.md`](../mcp/README.md) | MCP 注册项与 Cursor 配置 |

---

## 3. 已实现能力

### 3.1 设计稿（UI）

| 能力 | 位置 | 对外入口 |
|------|------|----------|
| URL 解析、列表、选稿 | `lanhu/`、`pick-design.ts` | HTTP 分步 API；MCP `lanhu_design` |
| Schema → HTML + mapping（A 套） | `transform/convert-schema.ts` | `/api/designs/convert`、`mode=analyze` |
| Sketch fallback、tokens、图层树 | `transform/convert-sketch.ts` 等 | analyze `include` |
| B 套切图元数据 | `designs.ts` · `getSlices` | `/api/designs/slices`、`mode=slices` |
| 一键 analyze + 落盘 | `pipeline/analyze-design.ts` | `/api/designs/analyze` → `data/lanhu_designs/` |
| Cocos 节点树（2.x / 3.x JSON） | `cocos/`、`pipeline/analyze-cocos.ts` | MCP `lanhu_design` `mode=cocos` |

**`lanhu_design` 两条内容链路**

1. **Schema（DDS）**：`multi_info` → `store_schema_revise` → 下载 schema → `convertLanhuSchema`
2. **Sketch**：Schema 不可用或 `detailDetach` 时，`getSketchJson` → `convertSketchToHtml`

`include` 默认含 `html`、`tokens`、`layers`、`layout`、`image`、`slices`；B 套切图元数据另用 `mode=slices` 或 analyze 的 `with_slices`。

### 3.2 原型 / PRD（Axure）

| 能力 | 说明 |
|------|------|
| 文档列表、页面列表 | `lanhu/pages.ts` |
| 下载 mapping + 静态资源 | `downloadResources` |
| HTML 修复、Playwright 渲染 | `fix-html-files.ts`、`page-browser-analyzer.ts` |
| 文本 / 样式 / 截图提取 | analyze 原型页 |

详见 [`PROTOTYPE_AND_MCP.md`](./PROTOTYPE_AND_MCP.md)。HTTP：`/api/pages/*`；MCP：`lanhu_page`。

### 3.3 MCP（`@lanhu/mcp`）

| 类型 | 名称 |
|------|------|
| Tool | `lanhu_design`（list / analyze / slices / tokens / cocos） |
| Tool | `lanhu_page`（原型） |
| Resource | `project-designs`、单稿 design |
| Prompt | `frontend-dev`、`design-review` |

使用说明：[`CURSOR_MCP.md`](./CURSOR_MCP.md)（`lanhu_design` §4 · `lanhu_page` §5） · 本地调试：[`MCP_INSPECTOR.md`](./MCP_INSPECTOR.md)

### 3.4 尚未实现（低优先级）

- 邀请链接解析（`resolve_invite_link`）
- 团队留言板（say 系列）
- 飞书集成

---

## 4. 设计稿核心链路

```text
1. parseLanhuUrl(url)              → tid / pid / image_id / kind
2. listDesigns(url)                → 项目内设计稿列表
3. pickDesign(designs, selector)   → 单稿或批量
4. getDesignSchemaJson()           → DDS schema
   └→ convertLanhuSchema()          → HTML + image-mapping（A 套）
5. getSketchJson()                 → sketch + tokens + 图层
   └→ convertSketchToHtml()        → Sketch fallback
6. [可选] getSlices()              → B 套切图元数据 + scaleUrls
7. [可选] persistAnalyzeArtifacts  → data/lanhu_designs/{pid}/{designId}_{slug}/（含 warnings/slices 元数据、Schema css/body、扩展 meta）
```

### 关键蓝湖 API

详见 [`LANHU_API.md`](./LANHU_API.md)（入参 / 回参 / 调用链）。摘要：

| 端点 | 域名 | 用途 |
|------|------|------|
| `GET /api/project/images` | lanhuapp.com | 设计稿列表 |
| `GET /api/project/multi_info` | lanhuapp.com | version_id |
| `GET /api/dds/image/store_schema_revise` | dds.lanhuapp.com | Schema URL |
| `GET /api/project/image` | lanhuapp.com | 原型 mapping |

公共 Header：`Cookie`、`Referer: https://lanhuapp.com/web/`、`request-from: web`

---

## 5. HTTP API 概览

设计稿（`POST /api/designs/…`）：

```text
list · sectors · detail · multi-info · schema-revise · schema · sketch
convert-sketch · sketch-layer-annotations · sketch-annotations · convert
preview · slices · analyze
```

原型（`POST /api/pages/…`）：

```text
list-documents · list · download · analyze · analyze-local
GET screenshot
```

通用：`GET /api/health` · `POST /api/parse-url`

完整参数与响应见 [`server-nest/README.md`](../server-nest/README.md)（设计稿 + 原型 `/api/pages/*`）。

**切图 A/B 套**：analyze 默认产出 A 套 mapping；B 套走 `/api/designs/slices` 或 analyze 的 `withSlices`。调试台切图 Tab 可手动切换 `mapping` / `scaleUrls`。

---

## 6. 本地开发

```bash
cp .env.example .env          # 填 LANHU_COOKIE
npm install
npx playwright install chromium   # 原型分析需要（首次或升级 playwright 后）
npm run dev                   # server :3001 + debug-react :5174
npm run dev:server            # 仅 HTTP
npm run dev:react             # 仅 React 调试台
npm run dev:mcp               # MCP stdio（配合 Inspector / Cursor）
npm run build                 # core + server-nest + mcp
npm test                      # vitest（packages/lanhu-core/tests）
npm run check                 # core 类型检查
```

环境变量（根目录 `.env`）：

| 变量 | 说明 |
|------|------|
| `LANHU_COOKIE` | 蓝湖登录 Cookie（必填；server / MCP 均读取） |
| `LANHU_DATA_DIR` | 落盘目录，默认 `{repoRoot}/data`（相对路径锚定仓库根；绝对路径如 `/Users/hong/my-text-data`；见 [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) §3） |
| `LANHU_PERSIST_ARTIFACTS` | 是否写入 `LANHU_DATA_DIR`，默认 `true`；`false` 见 [`DATA_LAYOUT.md`](./DATA_LAYOUT.md) §0 |

DDS 请求默认复用 `LANHU_COOKIE`。HTTP 请求 body 可传 `ddsCookie` / `dds_cookie` 覆盖；`.env.example` 中的 `LANHU_DDS_COOKIE` 为预留项，**当前 server / MCP 不读取**。

Mock 模式：调试台开启后不请求 server，读 `apps/debug-react/src/mock/`。

Cookie 获取、503、Playwright 安装失败等见 [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md)。

---

## 7. 技术选型

| 项 | 选择 |
|----|------|
| 运行时 | Node.js ≥ 20 |
| 语言 | TypeScript strict |
| 包管理 | npm workspaces |
| HTTP | NestJS（`server-nest`） |
| 浏览器渲染 | Playwright（原型分析） |
| 测试 | Vitest |
| MCP | `@modelcontextprotocol/sdk`（stdio） |

---

## 8. 新对话引用模板

```text
继续 lanhu-node，请先读：
@docs/README.md
@docs/CONTEXT.md

当前任务：<填写>
涉及模块：<core | server-nest | mcp | debug-react>
```

文档地图与包旁 README 分工见 [`README.md`](./README.md)。按主题追加：

| 主题 | 追加文档 |
|------|----------|
| Cursor 调 MCP | `@docs/CURSOR_MCP.md` |
| 原型 / lanhu_page | `@docs/PROTOTYPE_AND_MCP.md` |
| MCP 方案细节 | `@docs/MCP_DESIGN.md` |
| Cookie / Playwright 排错 | `@docs/TROUBLESHOOTING.md` |
| 蓝湖外网 API | `@docs/LANHU_API.md` |
