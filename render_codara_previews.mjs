import fs from "node:fs/promises";
import path from "node:path";
import { Canvas } from "file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/node_modules/skia-canvas/lib/index.mjs";
import {
  PresentationFile,
  drawSlideToCtx,
} from "file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const root = "C:/Users/user/Documents/Codex/2026-04-28/files-mentioned-by-the-user-codara-17";
const pptxPath = path.join(root, "Codara Roadmap Updated.pptx");
const previewDir = path.join(root, "codara-roadmap-previews");
await fs.mkdir(previewDir, { recursive: true });

const bytes = await fs.readFile(pptxPath);
const presentation = await PresentationFile.importPptx(bytes);

for (let i = 0; i < presentation.slides.items.length; i += 1) {
  const slide = presentation.slides.items[i];
  const canvas = new Canvas(slide.frame.width, slide.frame.height);
  const ctx = canvas.getContext("2d");
  await drawSlideToCtx(slide, presentation, ctx);
  const png = await canvas.toBuffer("png");
  const out = path.join(previewDir, `slide-${String(i + 1).padStart(2, "0")}.png`);
  await fs.writeFile(out, png);
}

console.log(`Rendered ${presentation.slides.items.length} slide previews to ${previewDir}`);
