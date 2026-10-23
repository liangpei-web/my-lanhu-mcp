# 本地落盘目录结构

> `{LANHU_DATA_DIR}` 默认 `{repoRoot}/data`（MCP 锚定仓库根，见 [`CHANGELOG.md`](./CHANGELOG.md) §0.1.3）。  
> Git 忽略规则见 [`GITIGNORE.md`](./GITIGNORE.md)。设计稿 MCP 用法见 [`CURSOR_MCP.md`](./CURSOR_MCP.md) §10.1；原型管线见 [`PROTOTYPE_AND_MCP.md`](./PROTOTYPE_AND_MCP.md) §3，产物说明见本文 §2。

## 0. 落盘开关 `LANHU_PERSIST_ARTIFACTS`

| 值 | 含义 |
|----|------|
| 未设置 / `true` | 写入 `{LANHU_DATA_DIR}/lanhu_designs/`、`lanhu_prototypes/` |
| `false` | **不写 `data/`**；设计稿 analyze 仅返回内存结果；`mode=slices` 仅 B 套元数据 JSON；原型 analyze 用系统临时目录跑 Playwright（MCP 返回后清理 temp，REST 截图路径在 `tmpdir` 下供调试台读取） |

REST `POST /api/designs/analyze` 在 env 为 `false` 时忽略 body `persistArtifacts: true`；body `persistArtifacts: false` 在 env 为 `true` 时仍可单次关闭。

---

## 1. 设计稿 `lanhu_designs/`

触发：`POST /api/designs/analyze`（默认 `persistArtifacts: true`）、MCP `lanhu_design(mode=analyze)`、`mode=slices`（切图 PNG 子目录）。  
当 `LANHU_PERSIST_ARTIFACTS=false` 时，analyze 与 slices **PNG 下载**均跳过落盘（slices 仅返回 B 套元数据 JSON）。

```text
{LANHU_DATA_DIR}/lanhu_designs/{projectId}/{designId}_{画板名}/
  {slug}.analyze-meta.json           # 索引：路径 + include / warnings / convertSource
  {slug}.png                         # 整稿预览
  {slug}.html                        # 主 HTML（Schema 优先，否则 Sketch）
  {slug}.css                         # Schema 路径才有
  {slug}.body.html                   # Schema 路径才有
  {slug}.sketch-fallback.html        # Schema 主 HTML 与 Sketch HTML 并存且内容不同时
  {slug}.image-mapping.json          # A 套：本地相对路径 → 蓝湖 OSS URL
  {slug}.schema.json                 # DDS 原始节点树
  {slug}.sketch.json                 # Sketch/PSD 原始 JSON（通常最大）
  {slug}.tokens.txt                  # Design Tokens 文本
  {slug}.layout-summary.txt          # Schema 布局树（flex / 尺寸 / 文案）
  {slug}.layer-tree.txt              # Sketch 图层树
  {slug}.sketch-annotations.txt      # Sketch 标注（文本/形状/位图/色板）
  {slug}.layer-annotations.json      # 每层绝对定位 CSS（与标注同源）
  {slug}.warnings.json               # 有 warnings 时
  {slug}.slices.json                 # with_slices 时的 B 套元数据（非 PNG）
  {slug}.cocos-layout-2x.json        # mode=cocos：2.x 节点描述（不是 .prefab）
  {slug}.cocos-layout-3x.json        # mode=cocos：3.x 节点描述
  {slug}.cocos.txt                   # mode=cocos：给 AI 读的节点树摘要
  assets/slices/                     # mode=slices 下载的 B 套切图（可选 output_dir 改根）
    title.png
    …
```

- `{slug}` = `safeDesignFilename(画板名)`，与目录段 `{designId}_{画板名}` 中的画板名一致。
- `include` 缺哪项，对应文件可能不存在（例如未跑 `layout` 则无 `.layout-summary.txt`）。
- 落盘由 env `LANHU_PERSIST_ARTIFACTS` 控制（MCP + REST 共用，默认 `true`）。REST 还可用 body `persistArtifacts: false` 在 env 为 `true` 时单次关闭 analyze。

分析管线会同时碰到两套蓝湖数据，目录里因此会出现「同源但形态不同」的文件：

| 源 | `analyze-meta.json` 里的标记 | 主要产物 |
|----|------------------------------|----------|
| **DDS Schema** | `convertSource: "schema"` | HTML / CSS / body / layout-summary / schema.json / A 套 mapping |
| **Sketch / PSD** | 始终可能并存 | sketch.json、layer-tree、sketch-annotations、layer-annotations；Schema 不可用时 HTML 也走 Sketch |

`include` 控制跑哪些抽取步骤，不保证每个文件都会出现。Tokens 抽空、未开 `with_slices`、Schema 与 Sketch HTML 相同，都是正常缺文件，不是落盘失败。

### 1.1 索引

**`{slug}.analyze-meta.json`**  
每次成功写入都会有。是这份目录的总目录：画板 id / 名、项目 pid、tid、`convertSource`、本次 `include`、是否 `withSlices`、Schema 的 `versionId` / `schemaUrl`、蓝湖 `documentInfo`（含画板宽高、更新时间）、`warnings` 全文，以及 `files` 里其余产物的绝对路径。某个文件在不在，以这里的 `files` 为准。

**`{slug}.warnings.json`**  
`warnings` 非空时另存一份数组，内容与 meta 里的 `warnings` 相同。常见条目：「Design Tokens 为空」「DDS Schema HTML 可用，同时提取了 Sketch 标注作为参考」。

### 1.2 派生文件（从 Schema / Sketch 抽出来的可读文本）

这些是管线已经消化过的结果，体积通常远小于原始 JSON。

**`{slug}.layout-summary.txt`**  
来自 Schema 布局摘要（`include` 含 `layout`）。缩进树：节点类型（`lanhupage` / `lanhublock` / `lanhutext` / `lanhuimage`）、class、宽高、flex、margin、文案和颜色。和 Sketch 图层树不是同一套命名。

**`{slug}.body.html`**  
Schema 转出的 `<body>` 片段（仅 Schema 路径、`include` 含 `html`）。没有 html/head。`<img src>` 指向蓝湖 OSS，不是本地 `assets/slices/`。

**`{slug}.html`**  
完整主 HTML（含 style）。Schema 成功时是 Schema 的 `htmlFull`，否则是 Sketch HTML。常见整文件单行，比 `body.html` + `css` 难读。

**`{slug}.css`**  
Schema `after.css`（仅 Schema 路径）。尺寸按画板逻辑像素（常见宽 750）。与 `body.html` 成对。

**`{slug}.sketch-fallback.html`**  
主 HTML 已经是 Schema，同时又抽出一份内容不同的 Sketch HTML 时才写。两份都在时，主结构以 Schema 那份为准，这份是 Sketch 转换对照。

**`{slug}.layer-tree.txt`**  
Sketch 图层树（`include` 含 `layers`）：组、文本层、形状、位图，带坐标和尺寸。顶层组名来自设计师源文件（如「组 13」「tab」），与 layout-summary 里的 `.section_1` 对不上号。

**`{slug}.sketch-annotations.txt`**  
从 Sketch/PSD 抽的标注文本：图层组、文本图层（内容 + 字号/字体/颜色）、形状（填充/特效）、位图清单、色板与字号汇总。Schema 经常不带齐字号和图层特效，缺口在这份里。

**`{slug}.tokens.txt`**  
Sketch Design Tokens 的文本导出。`include` 含 `tokens` **且真正抽到内容** 才落盘。抽空则只有 warning，不会写空文件。

### 1.3 对照图

**`{slug}.png`**  
蓝湖画板预览图（默认会下）。整稿一张，不是切图，也不是 B 套 `assets/slices/` 里的文件。

### 1.4 原始数据

体积大，给调试和再转换用；标注、布局、HTML 已经从里面抽过了。

**`{slug}.schema.json`**  
DDS Schema 节点树，HTML / CSS / layout-summary / A 套 mapping 的源。有 Schema 时写入。

**`{slug}.sketch.json`**  
`getSketchJson` 的原始数据，通常是目录里最大的文件（可达数百 KB～数 MB）。layer-tree、sketch-annotations、layer-annotations 都从这里抽。

**`{slug}.layer-annotations.json`**  
与 sketch-annotations 同源：每个图层的 name / type / 绝对定位 CSS（以及文本层的 `text`）。JSON 便于程序读，txt 便于人读，内容重叠。

**`{slug}.image-mapping.json`**  
**A 套** mapping：`convert.after.mapping`，形如 `./assets/slices/image_1.png` → 蓝湖 OSS URL。HTML 里的 `<img>` 用的就是右侧 URL。analyze **不会**按 mapping 把 PNG 下到本目录；左侧相对路径只是转换时的占位名，和设计师在蓝湖登记的 B 套切图名不是同一套。

### 1.5 切图（A 套 URL vs B 套文件）

| 产物 | 套 | 是什么 | 谁写入 |
|------|----|--------|--------|
| `{slug}.image-mapping.json` | A | 相对路径 → OSS URL，无本地图 | analyze（`include` 含 `html` 且 mapping 非空） |
| `{slug}.slices.json` | B 元数据 | `getSlices()`：切图 name / id / 各倍率 URL 等 | analyze 且 `with_slices` / `withSlices: true` |
| `assets/slices/` | B 文件 | 实际 PNG / webp / svg | **`mode=slices`**（`downloadDesignSlices`） |

`include: ["slices"]` 只表示分析流程里带 A 套 mapping，**不会**生成 `.slices.json`，也 **不会** 下载 PNG。

`mode=slices` 未传 `output_dir` 时，切图落在本目录 `assets/slices/`；传入 `output_dir` 则写到 `{output_dir}/assets/slices/`，不再套 `{designId}_{slug}` 层。进业务仓库必须显式传 `output_dir`。详见 [`MCP_SLICES.md`](./MCP_SLICES.md)。

`LANHU_PERSIST_ARTIFACTS=false` 时 `mode=slices` 只返回 B 套元数据 JSON，不写盘。

### 1.6 哪些文件经常没有

| 没有 | 通常原因 |
|------|----------|
| `{slug}.tokens.txt` | Tokens 抽空（warning 会写「Design Tokens 为空」） |
| `{slug}.css` / `{slug}.body.html` | 主 HTML 走的是 Sketch，不是 Schema |
| `{slug}.sketch-fallback.html` | 没有 Sketch HTML，或与 Schema 主 HTML 相同 |
| `{slug}.slices.json` | 未开 `with_slices`（analyze 默认不开） |
| `assets/slices/` | 没跑 `mode=slices`，或切图写到了业务侧 `output_dir` |

例如周 CP「奖励」稿：`convertSource` 为 schema、`withSlices` 为 false，因此有 HTML/CSS/layout/标注和 A 套 mapping，没有 tokens、slices.json、sketch-fallback、`assets/slices/`。

---

## 2. 原型 `lanhu_prototypes/`

触发：`POST /api/pages/download`（只下包）、`POST /api/pages/analyze` / `analyze-local`、MCP `lanhu_page`（URL 含 `docId` 时下载 + 分析）。  
`LANHU_PERSIST_ARTIFACTS=false` 时不写本目录，Playwright 用系统临时目录，返回后清理。

一份蓝湖 PRD/Axure **文档**对应一个目录（完整 `docId` + 文档名，不是 docId 前 8 位）。文档里有几页，根上就有几个 `*.html`，`screenshots/` 里就有几套 png/txt/styles。

下载与分析是两步：

```text
CDN 拉 Axure 整包（html + 静态资源 + .lanhu-* 索引）
  → 可选：Playwright 打开各页 → screenshots/{stem}.png / .txt / _styles.json
```

```text
{LANHU_DATA_DIR}/lanhu_prototypes/{projectId}/{docId}_{文档名}/
  {页面stem}.html                    # Axure 页面 HTML（CDN 原包，fixHtmlFiles 修补过路径）
  files/                             # 每页 styles.css、data.js
  resources/                         # Axure 运行时 css/js
  data/                              # 文档级样式等
  images/                            # 页内图片
  .lanhu-page-cache.json             # 下载缓存（version_id / 页列表）
  .lanhu-project-mapping.json        # GET json_url 的项目 mapping
  .lanhu-download-sources.json       # json_url + 每页 CDN URL
  .lanhu-page-mappings/              # 各页 mapping_md5 的资源表
    {页面stem}.json
  screenshots/
    .screenshot_cache.json
    {页面stem}.png
    {页面stem}.txt
    {页面stem}_styles.json
```

`{页面stem}` 与 html 文件名去掉 `.html` 后一致（只去掉文件系统非法字符）。例如文档「【FAHA】国庆活动」下仅一页时，stem 为 `【faha】巴西国庆活动`。

> **旧路径（已废弃）**：`data/axure_extract_{docId前8位}/` + 并列 `*_screenshots/`（v0.1.4 以前）。不要再按 8 位前缀找目录。

CDN 怎么解析 `json_url` / `sign_md5`、谁调用下载，见 [`PROTOTYPE_AND_MCP.md`](./PROTOTYPE_AND_MCP.md) §3.3–§3.4。

### 2.1 Axure 包

蓝湖把设计师导出的 Axure 静态站点按 `sign_md5` 挂在 CDN（`axure-file.lanhuapp.com` 等），本地按 mapping **整包下载**，不是根据 sitemap 在本地拼 HTML。

**`{页面stem}.html`**  
这一页的 Axure HTML。引用同目录的 `resources/`、`data/styles.css`、`files/{stem}/styles.css` 和一堆 axure js，并插入蓝湖的 `lanhu_Axure_Mapping_Data`。给浏览器跑原型用。Axure 依赖脚本和相对资源，需要 HTTP 访问（分析时 Playwright 会在本地起服务）；`file://` 双击经常脚本或图片不齐。

**`files/{页面stem}/`**  
这一页自己的 `styles.css`、`data.js`（以及 Axure 页级文件）。

**`resources/`**  
Axure 运行时：`css/axure_rp_page.css`、`scripts/jquery-*.js`、`scripts/axure/*.js` 等，多页共用。

**`data/`**  
文档级资源，常见 `styles.css`。

**`images/`**  
页里用到的图，通常按页面再分子目录，如 `images/{页面stem}/u288.png`。

只跑 `POST /api/pages/download` 时，有以上内容，**没有** `screenshots/`。

### 2.2 下载索引（`.lanhu-*`）

下载管线写入，用来判断要不要重下、资源从哪来。不是 Axure 原包的一部分。

**`.lanhu-page-cache.json`**  
这份包的缓存头：`version_id`、`document_id` / `document_name`、已下载的 html 文件名列表、`download_time`、`total_files`。同一 `version_id` 且文件还在，会跳过重新下载。版本号取蓝湖 API `versions[0].id`，不是 URL 里的 `versionId`。

**`.lanhu-download-sources.json`**  
下载地址清单：项目 mapping 的 `json_url`，以及每页 `html_filename`、`html_sign_md5`、`html_cdn_url`、`mapping_md5`、`mapping_cdn_url`。与 REST/MCP 返回的 `download.sources` 同结构。

**`.lanhu-project-mapping.json`**  
GET `json_url` 拿到的项目 mapping：`sitemap.rootNodes`（页面树：id / pageName / url）、`pages[html文件名]` 下的 html / dataJs 路径和 md5。`listPages` 读的是 sitemap；真正拉文件用的是 `pages[*].html.sign_md5`。

**`.lanhu-page-mappings/{页面stem}.json`**  
这一页的资源表（GET `mapping_md5`）：html 引用了哪些 css/js/图，每个文件的 `sign_md5`。下载时按这张表把 `resources/`、`files/`、`images/` 拉齐。

### 2.3 `screenshots/`（Playwright 分析）

本地 HTTP 托管包根目录，Chromium 打开目标 html（`networkidle` + 短等待），再写出三个文件。实现见 `packages/lanhu-core/src/transform/page-browser-analyzer.ts`。视口默认 1920×1080（可用 `VIEWPORT_WIDTH` / `VIEWPORT_HEIGHT` 覆盖）。

**`{页面stem}.png`**  
`page.screenshot({ fullPage: true })` 的整页截图。是把 Axure HTML 跑起来之后截的，不是蓝湖接口里的封面图。

**`{页面stem}.txt`**  
在页面 DOM 里抽文案，按段拼接（某段没有就不写）：

1. `[Important Tips/Warnings]` — 计算样式为红色（`rgb(255,0,0)` / `red`）且长度小于 200 的短文本  
2. `[Flowchart/Component Text]` — Axure 图形节点（`id` 以 `u` 开头、shape 类等）上的短文本，去重后最多 20 条，用 ` | ` 拼成一行  
3. `[Full Page Text]` — `document.body.innerText`，整页可见文字  

MCP `lanhu_page` 回给调用方的页面正文主要来自这份 txt。抽空时文件内容会提示无法提取。

**`{页面stem}_styles.json`**  
同一轮渲染里扫可见节点的 `getComputedStyle`，按出现次数排序：

- `textColors` / `bgColors`：颜色字符串 + 次数  
- `fontSpecs`：`字号|字重|颜色` + 次数  
- `images`：扫到的 `<img>` 或背景图（`src` / `type` / `w` / `h`）。`src` 常带分析当时本地服务地址，如 `http://127.0.0.1:端口/images/...`，不是 CDN 永久链接  

这是原型页算出来的样式分布（Axure 默认灰字会占绝大多数），不是视觉设计规范。

**`.screenshot_cache.json`**  
`version_id` + `cached_pages`（页面 stem 列表）。版本没变且对应 png/txt/styles 还在，会跳过该页 Playwright。逐页分析时 **合并** `cached_pages`，不覆盖。

`POST /api/pages/analyze-local` 只重跑这一步，不访问蓝湖、不改包根。

### 2.4 谁写入、哪些会缺

| 入口 | Axure 包 + `.lanhu-*` | `screenshots/` |
|------|------------------------|----------------|
| MCP `lanhu_page`（URL 含 `docId`） | ✅（可缓存跳过） | ✅ |
| `POST /api/pages/download` | ✅ | ❌ |
| `POST /api/pages/analyze` | ✅ | ✅ |
| `POST /api/pages/analyze-local` | ❌（须已下载） | ✅ 指定页 |

MCP 不支持自定义 `output_dir`。REST analyze 可在 body 传 `output_dir`（包根）与 `screenshot_output_dir`（未传则为 `{output_dir}/screenshots/`）。

| 没有 | 通常原因 |
|------|----------|
| `screenshots/` | 只做了 download，还没 analyze |
| 某一页的 png/txt/styles | URL 带了 `pageId` 只分析了那一页；或该页 Playwright 失败 |
| `[Important Tips/Warnings]` 段 | 页上没有红色短文本 |
| `.lanhu-page-mappings/{stem}.json` | 该页 mapping 没有 `mapping_md5` |

同 `version_id` 且文件齐全时，下载和截图都会跳过，目录看起来「没更新」是缓存命中。

---

## 3. 相关文档

| 主题 | 文档 |
|------|------|
| MCP 设计稿 analyze | [`CURSOR_MCP.md`](./CURSOR_MCP.md) §3.1、§10.1 |
| 设计稿产物说明 | 本文 §1.1–§1.6 |
| 原型产物说明 | 本文 §2.1–§2.4 |
| MCP 原型 | [`CURSOR_MCP.md`](./CURSOR_MCP.md) §5.3 |
| 原型管线 / CDN 下载 | [`PROTOTYPE_AND_MCP.md`](./PROTOTYPE_AND_MCP.md) §3 |
| Git 忽略 | [`GITIGNORE.md`](./GITIGNORE.md) |
