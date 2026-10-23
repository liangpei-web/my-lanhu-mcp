# Cursor 如何调用 Lanhu MCP

本文说明在 Cursor 里如何使用 `@lanhu/mcp`：有哪些入口、**设计稿 `lanhu_design` 与原型 `lanhu_page`** 参数怎么传、常见场景怎么组合。

---

## 1. 前置配置

在 Cursor 的 MCP 配置（如 `mcp.json`）中注册服务，并设置环境变量：

| 变量 | 必填 | 说明 |
|------|------|------|
| `LANHU_COOKIE` | 是 | 蓝湖登录 Cookie（浏览器 DevTools → Network 复制） |
| `LANHU_DATA_DIR` | 否 | 本地落盘根目录，默认 `{repoRoot}/data`；相对路径锚定仓库根（如 `hong/my-data`）；绝对路径如 `/Users/hong/my-text-data`（**勿用** `~`，Node 不展开） |
| `LANHU_PERSIST_ARTIFACTS` | 否 | 是否写入 `LANHU_DATA_DIR`，默认 `true`；`false` 时见 [`DATA_LAYOUT.md`](./DATA_LAYOUT.md) §0 |
| Playwright Chromium | 原型必填 | 首次在仓库根执行 `npx playwright install chromium`（见 [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) §3） |

与 **server-nest**、**debug 页面**共用同一份 Cookie：在仓库根目录 `.env` 中填写 `LANHU_COOKIE` 即可。

本地开发示例：

```bash
# 编辑根目录 .env 中的 LANHU_COOKIE
npm run dev:mcp
# 或构建后 node mcp/dist/server.js（stdio）
```

Cursor 里也可在 `mcp.json` 的 `env` 中配置，无需改 `.env` 文件。

---

## 2. MCP 提供什么

Cursor 里 Agent 可通过 Tool / Resource / Prompt 访问蓝湖资源：

| 类型 | 名称 | 作用 |
|------|------|------|
| **Tool** | `lanhu_design` | UI 设计稿：列画板、分析、切图、tokens（路由 `stage` / `detailDetach`） |
| **Tool** | `lanhu_page` | 原型 / PRD / Axure：列文档、下载、Playwright 截图与文本（路由 `product`） |
| **Resource** | `project-designs` | 只读资源：`lanhu://project/{pid}/designs?tid={tid}` 列画板 |
| **Resource** | `design` | 只读资源：`lanhu://project/{pid}/design/{design_id}?tid={tid}` 单张设计稿 JSON 分析 |
| **Prompt** | `frontend-dev` | 预置任务：像素级前端还原（设计稿） |
| **Prompt** | `design-review` | 预置任务：设计一致性与可实现性审查（设计稿） |

**重要**：Prompt 只生成一段「用户指令」，**不会自动拉数据**；设计稿取数靠 `lanhu_design`（或 Resource），原型取数靠 `lanhu_page`。详见 [`PROTOTYPE_AND_MCP.md`](./PROTOTYPE_AND_MCP.md)。

---

## 3. 推荐工作流

### 3.1 UI 设计稿（`lanhu_design`）

```text
1. list 或读 Resource project-designs  → 看清画板名 / 序号 / id
2. lanhu_design(mode=analyze, design_names=...)  → 拿 HTML、预览图、tokens 等，并落盘到 data/lanhu_designs/{pid}/{designId}_{slug}/
3. （可选）mode=slices 或 with_slices=true  → 下载 B 套切图到本地（见 MCP_SLICES.md）
4. Agent 在项目里写代码 / 做审查
```

单张 `detailDetach` URL 可直接 `mode=analyze`（可省略 `design_names`）；`stage` 全项目须 `design_names` 或先 list。

### 3.2 原型 / PRD（`lanhu_page`）

```text
1. url 仅含 tid+pid（无 docId）→ lanhu_page 返回 documents[].doc_url
2. 用户/Agent 选一份 PRD，用 doc_url 再调 lanhu_page
3. 有 docId + pageId → 只分析当前页；无 pageId → 分析文档内全部页面
4. 读返回文本 + 截图（需支持图像的模型），磁盘产物在 `data/lanhu_prototypes/{pid}/{docId}_{文档名}/`
```

从蓝湖复制链接时：**需求/交互/PRD 用 `lanhu_page`**，**视觉 UI 稿用 `lanhu_design`**，勿混用。

---

## 4. Tool：`lanhu_design`

### 4.1 `mode`（先选干什么）

| mode | 说明 | 需要 `design_names` | 默认 |
|------|------|---------------------|------|
| `list` | 列出项目内所有设计稿 | 否 | |
| `analyze` | 深度分析（HTML/CSS、tokens、图层等） | 有条件（见下） | **是** |
| `slices` | 下载 B 套切图到 `{root}/assets/slices/`（默认 png@2x） | 有条件（见下） | |
| `tokens` | 仅 Design Tokens | 有条件（见下） | |
| `cocos` | 效果图 + 本地切图 → Cocos 2.x / 3.x 节点 JSON（不是 .prefab） | 有条件（见下） | |

**`design_names` 何时可省略**

| URL 情况 | 是否可省略 `design_names` |
|----------|---------------------------|
| `detailDetach` 含 `image_id` | ✅ 自动分析 URL 指定画板 |
| list 仅 1 张设计稿 | ✅ 自动选该张 |
| `stage` 全项目（多稿） | ❌ 必填，或先 `mode=list` |

`design_names` 支持：画板名、序号（如 `"1"`）、id、`"all"`。显式传入时优先于 URL 的 `image_id`。

**示例（Agent 调用 JSON）：**

```json
{ "url": "https://lanhuapp.com/web/#/item/project/stage?pid=xxx&tid=xxx", "mode": "list" }
```

```json
{
  "url": "https://lanhuapp.com/web/#/item/project/stage?pid=xxx&tid=xxx",
  "mode": "analyze",
  "design_names": "首页"
}
```

```json
{
  "url": "...",
  "mode": "analyze",
  "design_names": ["首页", "详情页"]
}
```

```json
{ "url": "...", "mode": "slices", "design_names": "首页" }
```

```json
{
  "url": "...",
  "mode": "cocos",
  "design_names": "首页",
  "slice_dir": "D:/game/assets/ui/home",
  "cocos_version": "both"
}
```

不传 `mode` 时等价于 `"analyze"`。

---

### 4.2 `include`（仅 `mode=analyze`）

控制 analyze **返回哪些数据产物**（不是换 mode）。

| 值 | 返回内容 |
|----|----------|
| `html` | HTML+CSS（还原主数据） |
| `image` | 预览图（content 里的 image 块） |
| `tokens` | Design Tokens |
| `layers` | 图层树 |
| `layout` | 布局摘要 |
| `slices` | A 套图片 mapping（本地路径 ← 远程 URL） |

**默认**（不传 `include`）：

```json
["html", "tokens", "layers", "layout", "image", "slices"]
```

**与 `mode=slices` 的区别：**

| | `analyze` + `include` 含 `slices` | `mode=slices` |
|--|-----------------------------------|---------------|
| 内容 | A 套 mapping（HTML 用到的图 URL） | **下载** B 套切图文件（默认 png@2x） |
| 其它 | 可同时要 html、tokens、预览图 | 只下切图；进业务项目须传 `output_dir` |

另：**`with_slices: true`**（仅 analyze）会在结果里再挂一份 B 套 `getSlices` 元数据。

---

### 4.3 `workflow_guide`（仅 `mode=analyze`）

控制返回文本里是否附带 **STEP 1~5 设计稿还原工作流说明**（见 `mcp/src/analyze/design-workflow-guide.ts`）。

| 值 | 行为 |
|----|------|
| 不传 / `true` | 默认附带（需 `include` 含 `html`） |
| `false` | 不附带，省 token |

**生效条件（须同时满足）：**

1. `workflow_guide !== false`
2. `include` 中包含 `"html"`

无 `html` 时即使 `workflow_guide: true` 也不会插入 guide。

返回的 `structuredContent.workflow_guide` 表示**本次是否实际附带了** guide。

---

### 4.4 `mode=cocos`（效果图 → Cocos 节点树）

蓝湖只提供效果图（层级、位置、文案）；**切图必须是你本地已有的目录**，不会从蓝湖下载 PNG。输出是 `lanhu-cocos-layout` JSON，**不是** `.prefab`。

| 参数 | 必填 | 说明 |
|------|------|------|
| `slice_dir` | 是 | 本地切图目录（扫描 png/jpg/webp/gif，忽略 `.meta`） |
| `cocos_version` | 否 | `2.x` / `3.x` / `both`，默认 `both` |
| `unit_scale` | 否 | 设计像素 × 该值 = Cocos 单位，默认 `1`（设计稿 750、游戏 375 时传 `0.5`） |
| `local_slice_scale` | 否 | 切图像素 / 设计像素；不传则按文件尺寸自动识别 |
| `output_dir` | 否 | JSON 落盘根目录；未传则 `data/lanhu_designs/{pid}/{designId}_{slug}/` |

匹配规则：尺寸为主、名字为辅。`high` 可直接用；`medium` / `low` / 无候选会出现在「需要看图确认」里，对照预览图改 `spriteFrame`。

坐标约定：锚点 `(0.5, 0.5)`，y 轴向上，`position` 相对父节点中心。落地时用编辑器脚本读 `root` 建节点，SpriteFrame 走相对 `slice_dir` 的路径（资源须已导入工程）。

---

## 5. Tool：`lanhu_page`

原型 / PRD / Axure 专用。**仅一个入参 `url`**，无 `mode` / `page_names` 等字段；行为完全由 URL 中的 query 决定。

### 5.1 URL 要求

| 约束 | 说明 |
|------|------|
| 协议与域名 | 必须以 `https://lanhuapp.com/` 开头 |
| Hash 路由 | `#/item/project/product`（不是 `stage` / `detailDetach`） |
| 必填 query | `tid`（团队）、`pid`（项目） |
| 文档 | 列页 / 下载 / 分析须含 `docId` 或同义 `image_id` |
| 单页 | 可选 `pageId`，表示蓝湖 UI 当前选中的页面 |

**不支持**：邀请链 `/invite`、纯 hash 片段、MCP 侧自定义 `output_dir`（落盘路径固定，见 §5.3）。

### 5.2 URL 驱动分支

| URL 状态 | 行为 | structuredContent.status |
|----------|------|----------------------------|
| 无 `docId` | 返回项目下 PRD/原型文档列表 | `need_document_selection` |
| 有 `docId` + 有效 `pageId` | 只分析该页（截图 + 文本 + 样式） | `success` |
| 有 `docId`、无 `pageId` | 分析文档内**全部**页面 | `success` |
| 有 `docId` + 无效 `pageId` | 报错并返回 `available_pages` | `error` |

**示例（Agent 调用 JSON）：**

```json
{
  "url": "https://lanhuapp.com/web/#/item/project/product?tid=xxx&pid=xxx"
}
```

→ 返回 `documents[]`，每项含 `doc_url`，选一份后再调。

```json
{
  "url": "https://lanhuapp.com/web/#/item/project/product?tid=xxx&pid=xxx&docId=yyy&pageId=zzz"
}
```

→ 只分析 `pageId` 对应页面。

```json
{
  "url": "https://lanhuapp.com/web/#/item/project/product?tid=xxx&pid=xxx&docId=yyy"
}
```

→ 分析该 PRD 内全部页面（多页时依次 Playwright，耗时较长）。

### 5.3 落盘与缓存

`lanhu_page` 与 `lanhu_design(mode=analyze)` 默认落盘到 `LANHU_DATA_DIR`。`LANHU_PERSIST_ARTIFACTS=false` 时不写 `data/`；REST 仍可用 body `persistArtifacts: false` 在 env 为 `true` 时单次关闭 analyze。

| 目录 | 内容 |
|------|------|
| `{LANHU_DATA_DIR}/lanhu_prototypes/{pid}/{docId}_{文档名}/` | Axure HTML + 静态资源 + mapping sidecar |
| `…/screenshots/` | 每页 `.png` / `.txt` / `_styles.json` + `.screenshot_cache.json` |

每个文件说明见 [`DATA_LAYOUT.md`](./DATA_LAYOUT.md) §2。默认 `{LANHU_DATA_DIR}` 为仓库根 `data/`（MCP 相对路径锚定 repo root）。同 `version_id` 且文件齐全时会跳过重复下载 / 截图。管线细节见 [`PROTOTYPE_AND_MCP.md`](./PROTOTYPE_AND_MCP.md) §3–§4。

### 5.4 返回结构

- **content[0]**：文本摘要（每页正文 +「设计样式参考」）
- **content[1..n]**：成功页的 PNG（MCP `image` 块，base64）
- **structuredContent**（分析成功时）含 `output_dir`、`screenshot_output_dir`、`download`、`pages[]`、`results[]`

**模型要求**：截图在 content 的 image 块中，Agent 需使用**支持图像分析**的模型（Claude、GPT-4o、Gemini 等）。

与调试台 REST 的差异 → [`PROTOTYPE_AND_MCP.md`](./PROTOTYPE_AND_MCP.md) §5.2。

---

## 6. 在 Cursor 里怎么「控制」参数

Cursor **没有**单独 UI 开关，由 **对话意图 → Agent 构造 tool 参数**。

### 6.1 设计稿（`lanhu_design`）

| 你想做的事 | 对话示例 | Agent 应传参 |
|------------|----------|--------------|
| 列画板 | 「列出这个项目的设计稿」 | `mode: "list"` |
| 完整分析还原 | 「分析首页并写代码」 | `mode: "analyze"`, `design_names: "首页"` |
| 轻量分析 | 「只要 HTML 和预览图」 | `include: ["html", "image"]` |
| 不要布局摘要 | 「不要 layout summary」 | `include` 里去掉 `"layout"` |
| 不要 STEP 1~5 | 「不要工作流说明」 | `workflow_guide: false` |
| 下载 B 套切图 | 「下载首页切图到项目里」 | `mode: "slices"`, `design_names: "首页"`, 可选 `output_dir` |
| 只要 tokens | 「提取首页 design tokens」 | `mode: "tokens"`, `design_names: "首页"` |
| 设计审查 | 「审查这个设计稿的一致性」 | 可用 Prompt `design-review`；或 `include` 去掉 `html`，`workflow_guide: false` |

也可用 **Resource** 代替 `list`：读取 `lanhu://project/{pid}/designs?tid={tid}`。

单张稿结构化 JSON（无长文本/HTML 块）可读 `lanhu://project/{pid}/design/{design_id}?tid={tid}`；完整还原仍推荐 `lanhu_design(mode=analyze)`。

### 6.2 原型（`lanhu_page`）

| 你想做的事 | 对话示例 | Agent 应传参 |
|------------|----------|--------------|
| 列项目 PRD | 「这个项目有哪些需求文档」 | `url` 仅含 `tid`+`pid`（无 docId） |
| 分析当前页 | 「分析这个 PRD 当前页」 | 从蓝湖复制含 `docId`+`pageId` 的 product 链接 |
| 扫描整份 PRD | 「把这个 PRD 所有页面都分析一遍」 | `url` 含 `docId`，**去掉** `pageId` |
| 换一份 PRD | 「分析【xxx】这份 PRD」 | 用上一轮返回的 `documents[].doc_url` 作为 `url` |

**注意**：`lanhu_page` 只有 `url`，不能传 `page_names`；选页靠 URL 里的 `pageId`，或省略以分析全部。

---

## 7. Prompt 入口

### `frontend-dev`

- **参数**：`url`（必填）、`design_name`（可选）
- **作用**：触发「像素级前端还原」任务（中文短说明）
- **实际调用**：Agent 仍应 `lanhu_design(mode=analyze, design_names=...)`；默认 `include` 含 `html`，`workflow_guide` 默认 `true`

### `design-review`

- **参数**：`url`（必填）、`design_name`（可选，画板名）
- **作用**：触发设计一致性 / 可实现性审查
- **Prompt 正文已写明**推荐先调 `lanhu_design`：
  - `mode: "analyze"`
  - `design_names`: 与 `design_name` 一致，未传时需 Agent 自行指定画板名
  - `include: ["layout", "layers", "image", "tokens"]`（**不要** `html`）
  - `workflow_guide: false`
- **说明**：审查靠预览图 + tokens/layers，避免 HTML 长文与 STEP 1~5 guide 占 token；拿到数据后再与用户代码对比

`frontend-dev` 不会在正文里写死 tool 参数，Agent 应默认 `mode=analyze`、全量 `include`、`workflow_guide: true`。

---

## 8. 常见组合示例

### 8.1 设计稿

```json
{
  "url": "https://lanhuapp.com/web/#/item/project/stage?pid=xxx&tid=xxx",
  "mode": "analyze",
  "design_names": "首页"
}
```

默认：全量 include + STEP 1~5 guide（适合还原）。

```json
{
  "url": "...",
  "mode": "analyze",
  "design_names": "首页",
  "include": ["html", "image"],
  "workflow_guide": false
}
```

轻量：只要 HTML 和预览图，省 token。

```json
{
  "url": "...",
  "mode": "analyze",
  "design_names": "首页",
  "include": ["layout", "layers", "image", "tokens"],
  "workflow_guide": false
}
```

审查向：不要 HTML 长文和还原 guide（`layout` 默认已含，可只去掉 `html`）。

```json
{
  "url": "...",
  "mode": "analyze",
  "design_names": "首页",
  "with_slices": true
}
```

analyze 同时带 B 套切图元数据。

### 8.2 原型

```json
{
  "url": "https://lanhuapp.com/web/#/item/project/product?tid=xxx&pid=xxx"
}
```

列 PRD → 从返回的 `doc_url` 再调。

```json
{
  "url": "https://lanhuapp.com/web/#/item/project/product?tid=xxx&pid=xxx&docId=yyy&pageId=zzz"
}
```

只分析蓝湖当前选中的一页（快）。

```json
{
  "url": "https://lanhuapp.com/web/#/item/project/product?tid=xxx&pid=xxx&docId=yyy"
}
```

整份 PRD 全页扫描（慢，页数多时可分批带不同 `pageId` 调）。

---

## 9. 参数总览

```text
lanhu_design
├── url                    必填，蓝湖项目 URL（stage 或 detailDetach）
├── mode                   list | analyze（默认）| slices | tokens
├── design_names           analyze/slices/tokens：URL 含 image_id 或仅 1 张时可省略；stage 多稿必填
├── include                仅 analyze；控制返回数据类型
├── workflow_guide         仅 analyze；默认 true；需 include 含 html 才插入 STEP 1~5
├── with_slices            仅 analyze；是否额外挂 B 套 getSlices 元数据
└── output_dir             仅 slices；B 套切图落盘业务根目录（可选）

lanhu_page
└── url                    必填，蓝湖原型 URL（#/item/project/product）
                           无 docId → 列文档；有 docId → 下载+分析并落盘
                           pageId 可选：有则单页，无则全部
```

---

## 10. 返回结构简述

### 10.1 `lanhu_design`

- **文本 content**：`formatAnalyzeSummary` 拼装的说明 + 各画板 HTML / layout / mapping 等  
  摘要标题为中文，例如：`设计稿分析结果`、`--- 布局摘要 ---`、`--- 图层结构 ---`、`--- 设计令牌（Design Tokens）---`
- **图片 content**：`include` 含 `image` 时，每画板预览图 base64（多稿时文本顶部有顺序说明）
- **structuredContent**：JSON，含 `mode`、`include`、`workflow_guide`、各 `designs[]` 字段（`html_code`、`image_url_mapping` 等）

**Resource `design`**：返回 JSON（含 `html_code`、`design_tokens` 等），不含 MCP image 块与 workflow 长文。详见 `mcp/src/tools/lanhu-design.ts`。

**MCP analyze 落盘**：`LANHU_PERSIST_ARTIFACTS=true`（默认）时，`lanhu_design(mode=analyze)` 与 REST 相同，调用 `persistAnalyzeArtifacts` 写入 `{LANHU_DATA_DIR}/lanhu_designs/{pid}/{designId}_{slug}/`。

每个文件是什么、何时出现、A/B 套切图如何区分，见 [`DATA_LAYOUT.md`](./DATA_LAYOUT.md) §1.1–§1.6。`{slug}.analyze-meta.json` 是目录索引（`files` 绝对路径）；`structuredContent.designs[].artifacts` 同样带路径。B 套切图 **PNG** 仍走 `mode=slices`，见 [`MCP_SLICES.md`](./MCP_SLICES.md)。

### 10.2 `lanhu_page`

- **文本 content**：每页 `--- 页面名 ---`、正文、`--- 设计样式参考 ---`（颜色/字体统计）
- **图片 content**：每成功页一张 PNG（从包内 `screenshots/` 读取）
- **structuredContent**：`output_dir`、`screenshot_output_dir`、`download`、`results[]` 等

**落盘**：每次分析成功调用都会写入 `data/lanhu_prototypes/...`（见 §5.3）。格式化逻辑见 `mcp/src/format/page-result.ts`。
