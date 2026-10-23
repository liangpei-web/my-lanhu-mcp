import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { join, resolve } from "node:path";
import * as z from "zod/v4";
import {
  LanhuClient,
  analyzeDesignForCocos,
  analyzeDesignWithInclude,
  createLanhuEphemeralWorkDir,
  DEFAULT_ANALYZE_INCLUDE,
  downloadDesignSlices,
  extractDesignTokens,
  formatCocosAnalyzeText,
  getSketchJson,
  getSlices,
  listDesigns,
  mapConcurrent,
  parseLanhuUrl,
  persistAnalyzeArtifacts,
  persistCocosArtifacts,
  pickDesigns,
  removeLanhuEphemeralWorkDir,
  resolveDesignOutputDir,
  SliceNamesNotFoundError,
  type AnalyzeCocosResult,
  type AnalyzeDesignResult,
  type AnalyzeArtifactsPaths,
  type AnalyzeInclude,
  type CocosArtifactsPaths,
  type ConvertSketchResult,
  type ConvertLanhuSchemaResult,
  type LanhuDesignSummary,
  type SketchLayerAnnotation,
} from "@lanhu/core";

import { buildDesignWorkflowGuide } from "../analyze/design-workflow-guide.js";
import {
  formatAnalyzePersistEntries,
  formatPersistLocationBlock,
} from "../format/persist-location.js";
import { type McpConfig, requireLanhuCookie } from "../config.js";
import { createToolError, createToolResult, type ToolContent } from "../result.js";
import {
  LANHU_DESIGN_COCOS_MIRROR_KEY,
  LANHU_DESIGN_LIST_MIRROR_KEY,
  LANHU_DESIGN_SLICES_MIRROR_KEY,
  buildToolResultText,
} from "../structured-content-mirror.js";
import { resolveDesignSelector } from "./resolve-design-selector.js";
import { buildSliceInventoryRows, formatSliceInventorySection } from "../slices-inventory-table.js";

const IncludeOption = z.enum(["html", "image", "tokens", "layout", "layers", "slices"]);

function createClient(config: McpConfig): LanhuClient {
  const cookie = requireLanhuCookie(config);
  return new LanhuClient({ cookie });
}

function getHtmlFromConvert(
  convert: ConvertLanhuSchemaResult | ConvertSketchResult | undefined,
): string | undefined {
  if (!convert || !("after" in convert)) {
    return undefined;
  }
  const after = convert.after as { htmlFull?: string; htmlBody?: string };
  return after.htmlFull ?? after.htmlBody;
}

function getMappingFromConvert(
  convert: ConvertLanhuSchemaResult | ConvertSketchResult | undefined,
): Record<string, string> | undefined {
  if (!convert || !("after" in convert)) {
    return undefined;
  }
  const after = convert.after as { mapping?: Record<string, string> };
  return after.mapping;
}

function shouldAttachWorkflowGuide(
  includeSet: Set<AnalyzeInclude>,
  workflowGuide: boolean,
): boolean {
  return workflowGuide && includeSet.has("html");
}

type AnalyzeDesignSlice = Awaited<ReturnType<typeof analyzeDesignWithInclude>>;

function toAnalyzeDesignResult(
  slice: AnalyzeDesignSlice,
  params: ReturnType<typeof parseLanhuUrl>,
  projectName: string | undefined,
): AnalyzeDesignResult {
  return {
    status: "success",
    params,
    projectName,
    design: slice.design,
    convertSource: slice.convertSource,
    schema: slice.schema,
    schemaMeta: slice.schemaMeta,
    convert: slice.convert,
    sketch: slice.sketch,
    sketchMeta: slice.sketchMeta,
    sketchConvert: slice.sketchConvert,
    designTokens: slice.designTokens,
    layerAnnotations: slice.layerAnnotations,
    layoutSummary: slice.layoutSummary,
    layerTree: slice.layerTree,
    sketchAnnotations: slice.sketchAnnotations,
    slices: slice.slices,
    previewImage: slice.previewImage,
    warnings: slice.warnings,
  };
}

async function persistAnalyzeSliceArtifacts(
  client: LanhuClient,
  config: McpConfig,
  projectId: string,
  params: ReturnType<typeof parseLanhuUrl>,
  projectName: string | undefined,
  slice: AnalyzeDesignSlice,
  persistContext: { include?: AnalyzeInclude[]; withSlices?: boolean } = {},
): Promise<AnalyzeArtifactsPaths | undefined> {
  const result = toAnalyzeDesignResult(slice, params, projectName);
  try {
    return await persistAnalyzeArtifacts(client, slice.design, result, {
      dataDir: config.dataDir,
      projectId,
      include: persistContext.include,
      withSlices: persistContext.withSlices,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    slice.warnings.push(`analyze 产物落盘失败: ${message}`);
    return undefined;
  }
}

function formatLayerAnnotationsText(annotations: SketchLayerAnnotation[] | undefined): string {
  if (!annotations || annotations.length === 0) {
    return "";
  }
  const lines: string[] = [`CSS 标注（共 ${annotations.length} 层）：`];
  for (const la of annotations) {
    const cssStr = Object.entries(la.css)
      .map(([k, v]) => `${k}: ${v}`)
      .join("; ");
    let line = `  [${la.type}] ${la.name}: ${cssStr}`;
    if (la.text) line += ` | text="${la.text.slice(0, 50)}"`;
    if (la.slice_url) line += ` | slice=${la.slice_url}`;
    lines.push(line);
  }
  return lines.join("\n");
}

function formatAnalyzeSummary(
  projectName: string | undefined,
  slices: AnalyzeDesignSlice[],
  includeSet: Set<AnalyzeInclude>,
  options: {
    workflowGuide?: boolean;
    persistArtifacts?: boolean;
    artifactPaths?: Array<AnalyzeArtifactsPaths | undefined>;
  } = {},
): string {
  const workflowGuide = options.workflowGuide ?? true;
  const lines: string[] = ["设计稿分析结果"];
  lines.push(`项目：${projectName ?? "未知"}`);

  const persistBlock = formatPersistLocationBlock(
    options.persistArtifacts ?? false,
    formatAnalyzePersistEntries(slices, options.artifactPaths ?? []),
  );
  if (persistBlock) {
    lines.push(persistBlock);
  }

  if (includeSet.has("html")) {
    const success = slices.filter((s) => getHtmlFromConvert(s.convert)).length;
    const fallback = slices.filter((s) => s.convertSource === "sketch").length;
    lines.push(`${success}/${slices.length} 份 HTML 已生成`);
    if (fallback > 0) {
      lines.push(`${fallback} 张设计稿使用 Sketch 回退`);
    }
  }

  if (includeSet.has("image") && slices.length > 1) {
    lines.push("");
    lines.push("📋 设计图列表（自上而下顺序）：");
    lines.push("下方图片顺序与列表中各画板区块一一对应，请按顺序关联图片与代码。");
  }

  if (shouldAttachWorkflowGuide(includeSet, workflowGuide)) {
    lines.push("");
    lines.push(buildDesignWorkflowGuide());
  }

  for (const slice of slices) {
    lines.push("");
    lines.push(`--- ${slice.design.name} ---`);

    const html = getHtmlFromConvert(slice.convert);
    if (html && includeSet.has("html")) {
      lines.push("```html");
      lines.push(html);
      lines.push("```");
    } else if (includeSet.has("html") && !html) {
      lines.push(`HTML 生成失败或已跳过（${slice.warnings.join("; ") || "无输出"}）`);
    }

    if (slice.layoutSummary && includeSet.has("layout")) {
      lines.push("\n--- 布局摘要 ---");
      lines.push(slice.layoutSummary);
    }

    const mapping = getMappingFromConvert(slice.convert);
    if (mapping && Object.keys(mapping).length > 0 && includeSet.has("slices")) {
      lines.push(`\n图片资源（${Object.keys(mapping).length}）：`);
      for (const [localPath, remoteUrl] of Object.entries(mapping)) {
        lines.push(`  ${localPath} <- ${remoteUrl}`);
      }
    }

    if (slice.layerTree && includeSet.has("layers")) {
      lines.push("\n--- 图层结构 ---");
      lines.push(slice.layerTree);
    }

    if (slice.designTokens && includeSet.has("tokens")) {
      lines.push("\n--- 设计令牌（Design Tokens）---");
      lines.push(slice.designTokens);
    }

    if (slice.layerAnnotations && slice.layerAnnotations.length > 0 && includeSet.has("html")) {
      lines.push("\n--- CSS 标注 ---");
      lines.push(formatLayerAnnotationsText(slice.layerAnnotations));
    }

    if (slice.sketchAnnotations && includeSet.has("html")) {
      lines.push("\n--- Sketch 完整标注 ---");
      lines.push(slice.sketchAnnotations);
    }

    if (slice.warnings.length) {
      lines.push("\n--- 警告 ---");
      for (const w of slice.warnings) {
        lines.push(`- ${w}`);
      }
    }
  }

  return lines.join("\n").trim();
}

export function registerLanhuDesignTool(server: McpServer, config: McpConfig): void {
  server.registerTool(
    "lanhu_design",
    {
      description:
        "蓝湖设计稿统一工具。支持列出画板、分析还原、提取设计令牌（tokens）、获取切图信息、生成 Cocos 节点树。\n\n" +
        "推荐流程：detailDetach（含 image_id）可直接 analyze；stage 全项目则 mode=list → design_names → analyze。\n\n" +
        "模式说明：\n" +
        "  - list：列出项目内全部设计图\n" +
        "  - analyze：分析设计稿，输出 HTML/CSS、tokens、图层等，并落盘到 data/lanhu_designs/（与 REST analyze 一致）\n" +
        "  - slices：下载 B 套切图到 `{output_dir}/assets/slices/`，并输出切图清单表（蓝湖文件名/尺寸/说明/修改后名称）\n" +
        "  - tokens：仅提取设计令牌\n" +
        "  - cocos：蓝湖效果图 + 本地切图目录 → Cocos 2.x / 3.x 节点 JSON（不是 .prefab）\n\n" +
        "design_names：URL 含 image_id 或 list 仅 1 张时可省略；stage 多稿时必填（名称/序号/id/all）。\n\n" +
        "slices：下载后请读清单表补全「说明」「修改后名称」，再 mv 重命名并改引用（无需再次调用 MCP）。\n" +
        "slices 参数：slice_format（默认 png）、slice_scale（默认 2x）、slice_names（默认全部）、output_dir（业务项目路径须显式传入）。\n\n" +
        "cocos：必须传 slice_dir（你本地已有的切图目录，不从蓝湖下载）。按尺寸为主、名字为辅匹配 Sprite；歧义看预览图确认。\n" +
        "cocos 参数：cocos_version（2.x / 3.x / both，默认 both）、unit_scale（设计像素→Cocos 单位，默认 1）、local_slice_scale（切图像素/设计像素，默认自动识别）。\n\n" +
        "analyze 选项：workflow_guide 默认为 true，且 include 含 html 时会在文本中附带 STEP 1~5 还原指引。",
      inputSchema: {
        url: z.string().min(1).describe("蓝湖项目链接（stage 或 detailDetach 页面 URL）。"),
        mode: z
          .enum(["list", "analyze", "slices", "tokens", "cocos"])
          .default("analyze")
          .describe("操作模式。默认 analyze。"),
        design_names: z
          .union([z.string(), z.array(z.string())])
          .optional()
          .describe(
            "analyze/slices/tokens 选稿：画板名 / 序号 / id / 'all' / 数组。" +
              "URL 含 image_id 或 list 仅 1 张时可省略；stage 多稿时必填。",
          ),
        include: z
          .array(IncludeOption)
          .optional()
          .describe(
            "仅 analyze 有效。默认 ['html','tokens','layers','layout','image','slices']。B 套切图请用 mode=slices。",
          ),
        with_slices: z
          .boolean()
          .optional()
          .describe("仅 analyze：通过 getSlices 附加 B 套切图元数据。"),
        workflow_guide: z
          .boolean()
          .optional()
          .default(true)
          .describe(
            "仅 analyze：在文本回复中附带 STEP 1~5 设计稿还原工作流。" +
              "默认 true；仅当 include 含 html 时展示。设为 false 可节省 token。",
          ),
        slice_format: z
          .enum(["png", "webp", "svg"])
          .optional()
          .describe("仅 slices：下载格式，默认 png。"),
        slice_scale: z
          .string()
          .optional()
          .describe('仅 slices：倍率键名，默认 "2x"（对应 scaleUrls["2x"]）。'),
        slice_names: z
          .union([z.string(), z.array(z.string())])
          .optional()
          .describe("仅 slices：指定切图 name 或 id；默认下载全部。"),
        output_dir: z
          .string()
          .optional()
          .describe(
            "slices：落盘根目录，文件写入 {output_dir}/assets/slices/。" +
              "cocos：节点 JSON 落盘根目录。" +
              "未传时使用 LANHU_DATA_DIR/lanhu_designs/{pid}/{designId}_{slug}/；传 output_dir 时不追加 designId 层。",
          ),
        slice_dir: z
          .string()
          .optional()
          .describe(
            "仅 cocos：本地切图目录（已有 PNG 等，不从蓝湖下载）。必填。",
          ),
        cocos_version: z
          .enum(["2.x", "3.x", "both"])
          .optional()
          .describe("仅 cocos：生成哪份节点 JSON。默认 both。"),
        unit_scale: z
          .number()
          .positive()
          .optional()
          .describe("仅 cocos：设计像素 × unit_scale = Cocos 单位。默认 1。设计稿 750、游戏 375 时传 0.5。"),
        local_slice_scale: z
          .number()
          .positive()
          .optional()
          .describe("仅 cocos：切图像素 / 设计像素。不传则按文件尺寸自动识别（常见 2）。"),
      },
    },
    async ({
      url,
      mode,
      design_names,
      include,
      with_slices,
      workflow_guide,
      slice_format,
      slice_scale,
      slice_names,
      output_dir,
      slice_dir,
      cocos_version,
      unit_scale,
      local_slice_scale,
    }) => {
      try {
        const client = createClient(config);
        const parsed = parseLanhuUrl(url);
        const listResult = await listDesigns(client, url);

        if (mode === "list") {
          const structured = {
            status: "success",
            mode: "list",
            projectName: listResult.projectName,
            totalDesigns: listResult.totalDesigns,
            designs: listResult.designs.map((d) => ({
              index: d.index,
              id: d.id,
              name: d.name,
              width: d.width,
              height: d.height,
              sectors: d.sectors,
            })),
          };
          return createToolResult(
            `Loaded ${listResult.totalDesigns} design(s)${listResult.projectName ? ` from ${listResult.projectName}` : ""}.`,
            structured,
            false,
            LANHU_DESIGN_LIST_MIRROR_KEY,
          );
        }

        const selection = resolveDesignSelector(design_names, parsed, listResult);
        if (!selection.ok) {
          return createToolResult(
            selection.message,
            {
              status: "error",
              hint: selection.hint,
              auto_selectable: selection.autoSelectable,
              available_designs: selection.availableDesigns,
            },
            true,
          );
        }

        const targetDesigns = pickDesigns(
          listResult.designs,
          selection.selector,
          parsed.docId ?? parsed.imageId,
        );

        if (!targetDesigns.length) {
          return createToolResult(
            "No matching design found.",
            {
              status: "error",
              available_designs: listResult.designs.map((d) => d.name),
            },
            true,
          );
        }

        const teamId = listResult.params.teamId;
        const projectId = listResult.params.projectId;

        if (mode === "slices") {
          if (!teamId && targetDesigns[0]!.source !== "detailDetach") {
            return createToolResult(
              "team_id is required for slices mode.",
              { status: "error", hint: "Use a Lanhu URL that includes tid/team_id." },
              true,
            );
          }

          const target = targetDesigns[0]!;
          const warning =
            targetDesigns.length > 1
              ? `slices mode uses only the first design: ${target.name}`
              : undefined;

          if (!config.persistArtifacts) {
            const slicesResult = await getSlices(client, target.id, teamId, projectId, true);
            const structured = {
              status: "success" as const,
              mode: "slices" as const,
              persist_artifacts: false,
              design_names_resolved_from: selection.resolvedFrom,
              warning,
              ...slicesResult,
            };
            const summary = [
              `Loaded ${slicesResult.totalSlices} slice(s) for ${target.name} (metadata only; LANHU_PERSIST_ARTIFACTS=false).`,
              warning,
            ]
              .filter(Boolean)
              .join("\n");
            return createToolResult(summary, structured, false, LANHU_DESIGN_SLICES_MIRROR_KEY);
          }

          const outputRoot = output_dir?.trim()
            ? resolve(output_dir)
            : resolveDesignOutputDir(config.dataDir, projectId, target.id, target.name);

          let downloadResult;
          try {
            downloadResult = await downloadDesignSlices(
              client,
              { teamId, projectId },
              target,
              {
                sliceFormat: slice_format,
                sliceScale: slice_scale,
                sliceNames: slice_names,
                outputRoot,
              },
            );
          } catch (error) {
            if (error instanceof SliceNamesNotFoundError) {
              return createToolResult(
                error.message,
                {
                  status: "error",
                  available_slices: error.availableSlices,
                  missing: error.missing,
                },
                true,
              );
            }
            throw error;
          }

          const inventory = buildSliceInventoryRows(downloadResult.files);
          const structured = {
            status: "success",
            mode: "slices",
            persist_artifacts: true,
            design_names_resolved_from: selection.resolvedFrom,
            warning,
            output_root: downloadResult.outputRoot,
            output_dir: downloadResult.outputDir,
            slice_format: downloadResult.sliceFormat,
            slice_scale: downloadResult.sliceScale,
            total_slices: downloadResult.totalSlices,
            downloaded: downloadResult.downloaded,
            failed: downloadResult.failed,
            inventory,
            files: downloadResult.files,
            warnings: downloadResult.warnings.length ? downloadResult.warnings : undefined,
            slices: downloadResult.slices,
          };

          const summaryLines = [
            `Downloaded ${downloadResult.downloaded} slice(s) (${downloadResult.sliceFormat}@${downloadResult.sliceScale}).`,
            formatPersistLocationBlock(true, [
              { label: target.name, dir: downloadResult.outputDir, note: "assets/slices" },
            ]),
          ];
          if (downloadResult.failed > 0) {
            summaryLines.push(`${downloadResult.failed} slice(s) failed.`);
          }
          if (warning) {
            summaryLines.push(warning);
          }
          summaryLines.push("");
          summaryLines.push(formatSliceInventorySection(downloadResult.files));

          return createToolResult(
            summaryLines.join("\n"),
            structured,
            false,
            LANHU_DESIGN_SLICES_MIRROR_KEY,
          );
        }

        if (mode === "tokens") {
          if (!teamId && targetDesigns.some((d) => d.source !== "detailDetach")) {
            return createToolResult(
              "team_id is required for tokens mode.",
              { status: "error", hint: "Use a Lanhu URL that includes tid/team_id." },
              true,
            );
          }

          const tokenResults = await mapConcurrent(
            targetDesigns,
            async (design: LanhuDesignSummary) => {
              const sketchResult = await getSketchJson(client, design.id, teamId, projectId);
              return {
                name: design.name,
                tokens: extractDesignTokens(sketchResult.sketch),
              };
            },
            5,
          );

          const sections: string[] = [];
          for (let i = 0; i < tokenResults.length; i++) {
            const entry = tokenResults[i]!;
            const design = targetDesigns[i]!;
            if (entry.status === "fulfilled") {
              sections.push(`--- ${entry.value.name} ---`);
              sections.push(entry.value.tokens || "(no tokens found)");
              sections.push("");
            } else {
              sections.push(`--- ${design.name} ---`);
              sections.push(
                `Error: ${entry.reason instanceof Error ? entry.reason.message : String(entry.reason)}`,
              );
              sections.push("");
            }
          }

          return createToolResult(sections.join("\n").trim(), {
            status: "success",
            mode: "tokens",
            design_names_resolved_from: selection.resolvedFrom,
            total: targetDesigns.length,
          });
        }

        if (mode === "cocos") {
          const sliceDir = slice_dir?.trim();
          if (!sliceDir) {
            return createToolResult(
              "mode=cocos 需要 slice_dir（本地切图目录，不从蓝湖下载）。",
              {
                status: "error",
                hint: "传入游戏工程里已有的切图路径，例如 assets/ui/home。",
              },
              true,
            );
          }

          const warning =
            targetDesigns.length > 1
              ? `多画板共用同一 slice_dir，请确认切图目录对应这些画板（${targetDesigns.map((d) => d.name).join("、")}）`
              : undefined;

          const analyzed = await mapConcurrent(
            targetDesigns,
            (design) =>
              analyzeDesignForCocos(client, { teamId, projectId }, design, {
                sliceDir,
                cocosVersion: cocos_version,
                unitScale: unit_scale,
                localSliceScale: local_slice_scale,
              }),
            5,
          );

          const results: AnalyzeCocosResult[] = [];
          const artifactPaths: Array<CocosArtifactsPaths | undefined> = [];
          for (let i = 0; i < analyzed.length; i++) {
            const entry = analyzed[i]!;
            const design = targetDesigns[i]!;
            if (entry.status === "rejected") {
              artifactPaths.push(undefined);
              results.push({
                design,
                tree: {
                  source: "ps",
                  boardName: design.name,
                  boardWidth: 0,
                  boardHeight: 0,
                  root: {
                    id: "",
                    name: design.name,
                    layerPath: design.name,
                    layerType: "board",
                    kind: "node",
                    rect: { left: 0, top: 0, width: 0, height: 0 },
                    lanhuHasImage: false,
                    children: [],
                  },
                  warnings: [],
                },
                documents: [],
                warnings: [entry.reason instanceof Error ? entry.reason.message : String(entry.reason)],
              });
              continue;
            }
            const result = entry.value;
            const artifacts =
              config.persistArtifacts
                ? await persistCocosArtifacts(design, result, {
                    dataDir: config.dataDir,
                    projectId,
                    outputDir: output_dir,
                  }).catch((error: unknown) => {
                    const message = error instanceof Error ? error.message : String(error);
                    result.warnings.push(`Cocos 产物落盘失败: ${message}`);
                    return undefined;
                  })
                : undefined;
            artifactPaths.push(artifacts);
            results.push(result);
          }

          const content: ToolContent[] = [];
          for (const result of results) {
            if (result.previewImage?.base64) {
              content.push({
                type: "image",
                data: result.previewImage.base64,
                mimeType: result.previewImage.contentType || "image/png",
              });
            }
          }

          const summaryParts: string[] = [];
          if (warning) summaryParts.push(warning);
          const persistBlock = formatPersistLocationBlock(
            config.persistArtifacts,
            results.flatMap((result, index) => {
              const dir = artifactPaths[index]?.outputDir?.trim();
              if (!dir) return [];
              const files = [
                artifactPaths[index]?.layout2x,
                artifactPaths[index]?.layout3x,
                artifactPaths[index]?.layoutText,
              ].filter(Boolean);
              return [
                {
                  label: result.design.name,
                  dir,
                  note: files.length ? files.map((f) => f!.split(/[\\/]/).pop()).join(", ") : undefined,
                },
              ];
            }),
          );
          if (persistBlock) summaryParts.push(persistBlock.trim());

          for (const result of results) {
            if (results.length > 1) {
              summaryParts.push("");
              summaryParts.push(`======== ${result.design.name} ========`);
            }
            summaryParts.push(formatCocosAnalyzeText(result));
          }

          const structured = {
            status: "success",
            mode: "cocos",
            persist_artifacts: config.persistArtifacts,
            project_name: listResult.projectName ?? null,
            design_names_resolved_from: selection.resolvedFrom,
            slice_dir: sliceDir,
            cocos_version: cocos_version ?? "both",
            unit_scale: unit_scale ?? 1,
            warning,
            designs: results.map((result, index) => ({
              name: result.design.name,
              id: result.design.id,
              match_stats: result.match?.stats ?? null,
              slice_scale: result.match?.sliceScale ?? null,
              review: result.documents[0]?.review ?? [],
              unused_slices: result.documents[0]?.unusedSlices ?? [],
              documents: result.documents,
              artifacts: artifactPaths[index] ?? null,
              warnings: result.warnings,
            })),
          };

          const summaryText = summaryParts.join("\n").trim();
          content.unshift({
            type: "text",
            text: config.persistArtifacts
              ? summaryText
              : buildToolResultText(summaryText, structured, LANHU_DESIGN_COCOS_MIRROR_KEY),
          });
          return { content, structuredContent: structured };
        }

        // analyze
        const includeList = (include as AnalyzeInclude[] | undefined) ?? [...DEFAULT_ANALYZE_INCLUDE];
        const includeSet = new Set(includeList);

        const analyzed = await mapConcurrent(
          targetDesigns,
          (design) =>
            analyzeDesignWithInclude(
              client,
              { teamId, projectId },
              design,
              { include: includeList, withSlices: Boolean(with_slices) },
            ),
          5,
        );

        const slices: AnalyzeDesignSlice[] = [];
        const artifactPaths: Array<AnalyzeArtifactsPaths | undefined> = [];
        for (let i = 0; i < analyzed.length; i++) {
          const entry = analyzed[i]!;
          if (entry.status === "fulfilled") {
            const slice = entry.value;
            const artifacts = config.persistArtifacts
              ? await persistAnalyzeSliceArtifacts(
                  client,
                  config,
                  projectId,
                  parsed,
                  listResult.projectName,
                  slice,
                  { include: includeList, withSlices: Boolean(with_slices) },
                )
              : undefined;
            artifactPaths.push(artifacts);
            slices.push(slice);
          } else {
            const design = targetDesigns[i]!;
            artifactPaths.push(undefined);
            slices.push({
              design,
              warnings: [
                entry.reason instanceof Error ? entry.reason.message : String(entry.reason),
              ],
            });
          }
        }

        const content: ToolContent[] = [];
        for (const slice of slices) {
          if (slice.previewImage?.base64 && includeSet.has("image")) {
            content.push({
              type: "image",
              data: slice.previewImage.base64,
              mimeType: slice.previewImage.contentType || "image/png",
            });
          }
        }

        const attachWorkflowGuide = shouldAttachWorkflowGuide(includeSet, workflow_guide ?? true);
        const summaryText = formatAnalyzeSummary(listResult.projectName, slices, includeSet, {
          workflowGuide: workflow_guide ?? true,
          persistArtifacts: config.persistArtifacts,
          artifactPaths,
        });
        content.unshift({ type: "text", text: summaryText });

        const structuredDesigns = slices.map((slice, index) => ({
          name: slice.design.name,
          id: slice.design.id,
          convert_source: slice.convertSource ?? null,
          html_code: getHtmlFromConvert(slice.convert) ?? null,
          image_url_mapping: getMappingFromConvert(slice.convert) ?? null,
          layout_summary: slice.layoutSummary ?? null,
          layer_tree: slice.layerTree ?? null,
          design_tokens: slice.designTokens ?? null,
          sketch_annotations: slice.sketchAnnotations ?? null,
          preview_image: slice.previewImage
            ? { contentType: slice.previewImage.contentType, hasBase64: Boolean(slice.previewImage.base64) }
            : null,
          slices: slice.slices ?? null,
          warnings: slice.warnings,
          artifacts: artifactPaths[index] ?? null,
        }));

        return {
          content,
          structuredContent: {
            status: "success",
            mode: "analyze",
            persist_artifacts: config.persistArtifacts,
            project_name: listResult.projectName ?? null,
            total_designs: targetDesigns.length,
            design_names_resolved_from: selection.resolvedFrom,
            include: includeList,
            workflow_guide: attachWorkflowGuide,
            designs: structuredDesigns,
          },
        };
      } catch (error) {
        return createToolError(error, { url, mode });
      }
    },
  );
}
