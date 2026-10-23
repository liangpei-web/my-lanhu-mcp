# 🎨 Lanhu MCP (Node.js)

**让 Cursor 等 AI 助手直接读取蓝湖设计稿与 Axure 原型**

TypeScript 实现的蓝湖 MCP 服务器：`lanhu_design` 分析 UI 设计稿并输出 HTML+CSS / tokens / 切图；`lanhu_page` 解析 PRD 原型页面。适合 Cursor、Claude Code 等支持 MCP 的 AI 开发工具。

[快速开始](#-快速开始) · [使用示例](#-使用示例) · [开发文档](./docs/DEVELOPMENT.md) · [完整文档索引](./docs/README.md)

---

## ✨ 功能特性

### 🎨 UI 设计稿

- **列表与选稿**：按项目 URL 列出全部画板，支持画板名 / 序号 / id 选取
- **深度分析**：Schema（DDS）或 Sketch fallback → **HTML+CSS**、预览图、Design Tokens、图层树、布局摘要
- **切图**：`mode=slices` 下载设计师登记的 **B 套**切图（默认 png@2x）到本地；analyze 里的 `include: slices` 只是 A 套 URL mapping，不会下 PNG
- **Cocos 节点树**：`mode=cocos` 用蓝湖效果图 + 你提供的本地切图目录，生成 2.x / 3.x 节点 JSON（不是 `.prefab`）
- **还原工作流**：analyze 默认附带 STEP 1~5 前端还原指引（可关闭省 token）

### 📋 原型 / PRD（Axure）

- 自动下载 Axure 资源、修复 HTML、Playwright 渲染
- 提取页面文本、样式与截图，供需求分析使用

### ⚡ 工程特点

- **TypeScript monorepo**：`@lanhu/core` 统一封装蓝湖 HTTP，MCP / Nest 调试 API 共用
- **stdio MCP**：按需由 Cursor 拉起，无需常驻 HTTP 服务
- **本地调试台**：`debug-react` + `server-nest` 可视化联调

> 与社区项目 [dsphper/lanhu-mcp](https://github.com/dsphper/lanhu-mcp)（Python 版）能力相近；本仓库为 Node/TS 实现，Tool 命名为 `lanhu_design` / `lanhu_page`，暂无团队留言板（say 系列）。

---

## 🚀 快速开始

> ⚠️ **需要支持图像分析的 AI 模型**（如 Claude、GPT-4o、Gemini 等），设计稿预览与原型截图依赖视觉能力。

### 1. 安装

```bash
git clone <本仓库 URL>
cd lanhu-node
cp .env.example .env          # 填入 LANHU_COOKIE
npm install
npx playwright install chromium   # 原型分析需要（首次一次）
npm run build:mcp                 # 或 npm run build
```

**获取 Cookie**：登录 [蓝湖网页版](https://lanhuapp.com)，浏览器 DevTools → Network → 任意 `lanhuapp.com` 请求 → 复制 `Cookie` 请求头。详见 [`docs/TROUBLESHOOTING.md`](./docs/TROUBLESHOOTING.md)。

### 2. 配置 Cursor

在 Cursor MCP 配置（如 `~/.cursor/mcp.json`）中添加：

```json
{
  "mcpServers": {
    "lanhu": {
      "command": "node",
      "args": ["/绝对路径/lanhu-node/mcp/dist/server.js"],
      "env": {
        "LANHU_COOKIE": "session=..."
      }
    }
  }
}
```

开发期可用 `npx tsx` 热跑，见 [`mcp/README.md`](./mcp/README.md)。

配置说明与参数详解 → [`docs/CURSOR_MCP.md`](./docs/CURSOR_MCP.md)

---

## 🛠️ MCP 能力一览

| 类型 | 名称 | 说明 |
|------|------|------|
| Tool | `lanhu_design` | 设计稿：list / analyze / slices / tokens / cocos |
| Tool | `lanhu_page` | 原型 / PRD 页面列表与分析 |
| Resource | `project-designs` | 只读：项目内设计稿列表 |
| Resource | `design` | 只读：单张设计稿 JSON |
| Prompt | `frontend-dev` | 像素级前端还原任务 |
| Prompt | `design-review` | 设计一致性与可实现性审查 |

---

## 📖 使用示例

### 查看设计稿列表

```
请用 MCP 列出这个项目的所有设计稿：
https://lanhuapp.com/web/#/item/project/stage?tid=xxx&pid=xxx
```

Agent 应调用 `lanhu_design`，`mode: "list"`。

### 分析设计稿并写代码

```
请分析「首页」设计稿，帮我写 React 页面。
https://lanhuapp.com/web/#/item/project/stage?tid=xxx&pid=xxx
```

Agent 应调用 `lanhu_design`，`mode: "analyze"`，`design_names: "首页"`。

### 下载切图（B 套 PNG）

设计师在蓝湖登记的切图走 `mode=slices`，**默认就会下载文件**，不是只返回 URL。

下到本仓库 `data/`：

```
把「首页」的切图下载下来。
https://lanhuapp.com/web/#/item/project/detailDetach?pid=xxx&tid=xxx&image_id=xxx
```

常用可选参数：slice_format（png / webp / svg，默认 png）、slice_scale（默认 2x）、slice_names（不传则全部）。


### 生成 Cocos 节点树（2.x / 3.x）

蓝湖只负责效果图；切图用你本地目录，不从蓝湖下载。输出是节点 JSON，不是 `.prefab`。

```
请用蓝湖效果图生成 Cocos 节点树，切图在 D:\game\assets\ui\home
https://lanhuapp.com/web/#/item/project/detailDetach?pid=xxx&tid=xxx&image_id=xxx
```

Agent 应调用 `lanhu_design`，`mode: "cocos"`，`slice_dir` 必填。`cocos_version` 默认 `both`（同时出 2.x / 3.x JSON）。

### 分析 Axure 原型

```
请用 MCP 分析这个需求文档有哪些页面：
https://lanhuapp.com/web/#/item/project/product?tid=xxx&pid=xxx&docId=xxx
```

Agent 应调用 `lanhu_page`（非 `lanhu_design`）。详见 [`docs/PROTOTYPE_AND_MCP.md`](./docs/PROTOTYPE_AND_MCP.md)。

---

## 📁 项目结构

```text
lanhu-node/
├── mcp/                 # Cursor MCP（stdio）
├── packages/lanhu-core/ # 蓝湖 API + 转换 + 原型管线
├── server-nest/         # HTTP 调试 API (:3001)
├── apps/debug-react/    # 可视化调试台 (:5174)
└── docs/                # 文档
```

---

## 📚 文档

| 文档 | 用途 |
|------|------|
| [**docs/README.md**](./docs/README.md) | 文档索引与分工 |
| [**docs/CURSOR_MCP.md**](./docs/CURSOR_MCP.md) | MCP 参数、工作流、Prompt |
| [**docs/MCP_SLICES.md**](./docs/MCP_SLICES.md) | B 套切图下载：参数、落盘路径、清单表 |
| [**docs/DEVELOPMENT.md**](./docs/DEVELOPMENT.md) | 本地开发、调试、包说明 |
| [**docs/TROUBLESHOOTING.md**](./docs/TROUBLESHOOTING.md) | Cookie / Playwright / 常见错误 |
| [**docs/CONTEXT.md**](./docs/CONTEXT.md) | 架构与能力边界（新对话先读） |

---

## ⚠️ 免责声明

本项目为**第三方开源实现**，与蓝湖公司无官方关联。通过公开网页接口与蓝湖交互，需您拥有合法账号与访问权限。请遵守蓝湖服务条款；Cookie 等凭证仅保存在本地，勿提交到公开仓库。

---

## 🙏 参考

- 蓝湖设计协作平台：[lanhuapp.com](https://lanhuapp.com)
- 同类 MCP 实现（Python）：[dsphper/lanhu-mcp](https://github.com/dsphper/lanhu-mcp)
