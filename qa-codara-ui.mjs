import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const root = "C:/Users/user/Documents/Codex/2026-04-28/files-mentioned-by-the-user-codara-17";
const pageUrl = `file:///${path.join(root, "index.html").replaceAll("\\", "/")}`;
const outDir = path.join(root, "ui-previews");

const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
await page.goto(pageUrl);

for (const view of ["workspace", "repositories", "diagrams", "observability"]) {
  if (view !== "workspace") {
    await page.locator(`[data-view-target="${view}"].nav-item`).click();
  }
  await page.screenshot({ path: path.join(outDir, `${view}.png`), fullPage: true });
}

await page.setViewportSize({ width: 390, height: 900 });
await page.goto(pageUrl);
for (const view of ["repositories", "diagrams", "observability"]) {
  await page.locator(`[data-view-target="${view}"].nav-item`).click();
  await page.screenshot({ path: path.join(outDir, `${view}-mobile.png`), fullPage: true });
}

await browser.close();
console.log(`Saved UI previews to ${outDir}`);
