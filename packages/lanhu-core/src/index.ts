export {
  LanhuApiError,
  LanhuClient,
  createLanhuFetch,
  isLanhuSuccessCode,
  pickNestedString,
} from "./lanhu/client.js";
export { normalizeDesignSectors } from "./lanhu/design-sectors.js";
export {
  getDesignSchemaJson,
  getSketchJson,
  getSlices,
  listDesigns,
} from "./lanhu/designs.js";
export {
  downloadDesignSlices,
  extForSliceFormat,
  filterSlicesByNames,
  resolveSliceDownloadUrl,
  resolveSlicesOutputPaths,
  sanitizeSliceFilename,
  SliceNamesNotFoundError,
} from "./lanhu/download-slices.js";
export type {
  DownloadDesignSlicesOptions,
  DownloadDesignSlicesResult,
  DownloadedSliceFile,
  SliceDownloadFormat,
} from "./lanhu/download-slices.js";
export {
  analyzeLocalPage,
  analyzePrototypePages,
  downloadResources,
  fetchPrototypeDownloadSources,
  getPrototypeDocumentInfo,
  listPages,
  listProductDocuments,
  resolvePrototypeDocumentUrl,
} from "./lanhu/pages.js";
export type {
  AnalyzeLocalPageResult,
  DownloadResourcesResult,
  FetchPrototypeDownloadSourcesResult,
  LanhuPageEntry,
  LanhuPagesListResult,
  ProductDocumentEntry,
  ProductDocumentsListResult,
  PrototypeDownloadSources,
  PrototypePageSourceEntry,
} from "./lanhu/pages.js";
export { normalizeDesignQuotes, pickDesign, pickDesigns } from "./lanhu/pick-design.js";
export type { DesignSelector } from "./lanhu/pick-design.js";
export { mapConcurrent } from "./pipeline/concurrency.js";
export {
  analyzeDesign,
  analyzeDesignBatch,
  analyzeDesignWithInclude,
  DEFAULT_ANALYZE_INCLUDE,
  resolveAnalyzeInclude,
} from "./pipeline/analyze-design.js";
export type { AnalyzeInclude, AnalyzeDesignSliceResult } from "./pipeline/analyze-include.js";
export {
  analyzeDesignForCocos,
  buildCocosFromSketch,
  formatCocosAnalyzeText,
  resolveCocosVersions,
} from "./pipeline/analyze-cocos.js";
export type {
  AnalyzeCocosOptions,
  AnalyzeCocosResult,
  BuildCocosFromSketchOptions,
  BuildCocosFromSketchResult,
  CocosEngineTarget,
} from "./pipeline/analyze-cocos.js";
export { persistCocosArtifacts } from "./persist/cocos-artifacts.js";
export type {
  CocosArtifactsPaths,
  PersistCocosArtifactsOptions,
} from "./persist/cocos-artifacts.js";
export {
  buildCocosLayoutDocument,
  formatCocosLayoutText,
  toCocosTransform,
} from "./cocos/emit.js";
export type {
  CocosLayoutDocument,
  CocosNodeSpec,
  CocosTransform,
  CocosVersion,
} from "./cocos/emit.js";
export {
  buildLayoutTree,
  normalizeColor,
  walkLayoutNodes,
} from "./cocos/layout-tree.js";
export type {
  CocosLabelInfo,
  CocosMatchConfidence,
  CocosNodeKind,
  CocosSliceCandidate,
  CocosSpriteInfo,
  DesignRect,
  LayoutNode,
  LayoutTree,
} from "./cocos/layout-tree.js";
export { scanLocalSlices } from "./cocos/local-slices.js";
export type { LocalSliceFile, ScanLocalSlicesResult } from "./cocos/local-slices.js";
export { detectSliceScale, matchLocalSlices, normalizeSliceName } from "./cocos/slice-match.js";
export type {
  MatchLocalSlicesOptions,
  MatchLocalSlicesResult,
  SliceScaleDetection,
} from "./cocos/slice-match.js";
export { readImageSize } from "./cocos/image-size.js";
export type { ImageSize } from "./cocos/image-size.js";
export { buildQuery, buildPrototypeDocumentUrl, parseLanhuUrl } from "./lanhu/parse-url.js";
export {
  convertLanhuSchema,
  convertLanhuToHtml,
  localizeImageUrls,
  minifyHtml,
} from "./transform/convert-schema.js";
export {
  convertLanhuSketch,
  convertSketchToHtml,
  extractDesignTokens,
  resolveDesignImageUrl,
  resolveDesignScale,
} from "./transform/convert-sketch.js";
export { applyFormatToScaleUrl } from "./transform/slice-scale-urls.js";
export type { SliceImageFormat as ScaleUrlSliceFormat } from "./transform/slice-scale-urls.js";
export { extractLayoutSummary } from "./transform/layout-summary.js";
export { extractLayerTree } from "./transform/layer-tree.js";
export { extractFullAnnotationsFromSketch } from "./transform/sketch-annotations.js";
export type { ConvertLanhuSchemaResult } from "./transform/convert-schema.js";
export type { ConvertSketchResult } from "./transform/convert-sketch.js";
export type { SketchLayerAnnotation } from "./transform/sketch-to-html.js";
export { persistAnalyzeArtifacts } from "./persist/analyze-artifacts.js";
export {
  createLanhuEphemeralWorkDir,
  removeLanhuEphemeralWorkDir,
  resolveLanhuPersistArtifacts,
} from "./persist/persist-config.js";
export {
  resolveLanhuDataDir,
  resolveLanhuDataDirAnchored,
  resolveAxureOutputDir,
  resolveAxureScreenshotDir,
  resolveDesignDirSegment,
  resolveDesignOutputDir,
  resolvePrototypeDirSegment,
  resolvePrototypeOutputDir,
  resolvePrototypeScreenshotDir,
  safeDesignFilename,
} from "./persist/data-dir.js";
export {
  extractPageContentFromFile,
  extractPageContentFromHtml,
  parseInlineStyle,
} from "./transform/page-static-extractor.js";
export { fixHtmlFiles } from "./transform/fix-html-files.js";
export { formatPageDesignInfo } from "./transform/page-design-info-format.js";
export { renderPrototypePages } from "./transform/page-browser-analyzer.js";
export type {
  RenderPrototypePageResult,
  RenderPrototypePagesOptions,
} from "./transform/page-browser-analyzer.js";
export type {
  ExtractedPageContent,
  ExtractedPageImage,
  ExtractPageContentOptions,
  PageDesignInfo,
  StyleCounterEntry,
} from "./transform/page-static-extractor.js";
export type { AnalyzeArtifactsPaths } from "./persist/analyze-artifacts.js";
export type {
  AnalyzeDesignBatchItem,
  AnalyzeDesignBatchOptions,
  AnalyzeDesignBatchResult,
  AnalyzeDesignOptions,
  AnalyzeDesignResult,
  AnalyzePreviewImage,
  ConvertSource,
} from "./pipeline/analyze-design.js";
export type {
  FetchLike,
  LanhuApiEnvelope,
  LanhuClientOptions,
  LanhuDesignListAiSuggestion,
  LanhuDesignListResult,
  LanhuDesignSchemaJsonResult,
  LanhuDesignSectorSummary,
  LanhuDesignSummary,
  LanhuDocumentInfo,
  LanhuProjectImageInfo,
  LanhuProjectImagesPayload,
  LanhuSketchJsonResult,
  LanhuSliceInfo,
  LanhuSlicesResult,
  LanhuUrlKind,
  LanhuUrlParams,
  UnknownRecord,
} from "./types.js";
export { getRepoRoot, loadRepoEnvFile } from "./env/repo-env.js";
