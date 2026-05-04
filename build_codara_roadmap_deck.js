const pptxgen = require("pptxgenjs");
const fs = require("fs");
const path = require("path");

const outDir = __dirname;
const previewDir = path.join(outDir, "codara-roadmap-previews");
fs.mkdirSync(previewDir, { recursive: true });

const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "Codara";
pptx.subject = "Codara project roadmap and observability ownership";
pptx.title = "Codara Roadmap";
pptx.company = "Codara";
pptx.lang = "en-US";
pptx.theme = {
  headFontFace: "Aptos Display",
  bodyFontFace: "Aptos",
  lang: "en-US",
};
pptx.defineLayout({ name: "LAYOUT_WIDE", width: 13.333, height: 7.5 });

const C = {
  ink: "111827",
  muted: "5B6472",
  faint: "E8ECF1",
  panel: "F7F9FC",
  white: "FFFFFF",
  blue: "2563EB",
  green: "16A34A",
  cyan: "0891B2",
  amber: "D97706",
  violet: "7C3AED",
  red: "DC2626",
  dark: "0B1220",
};

function addBg(slide, color = C.white) {
  slide.background = { color };
}

function title(slide, text, subtitle) {
  slide.addText(text, {
    x: 0.62, y: 0.34, w: 8.8, h: 0.45,
    fontFace: "Aptos Display", fontSize: 24, bold: true,
    color: C.ink, margin: 0, breakLine: false, fit: "shrink",
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.64, y: 0.83, w: 10.7, h: 0.35,
      fontSize: 10.5, color: C.muted, margin: 0, fit: "shrink",
    });
  }
  slide.addShape(pptx.ShapeType.line, {
    x: 0.64, y: 1.25, w: 1.0, h: 0,
    line: { color: C.blue, width: 2.2 },
  });
}

function footer(slide, n) {
  slide.addText(`Codara architecture roadmap | ${n}`, {
    x: 10.4, y: 7.08, w: 2.25, h: 0.16,
    fontSize: 6.5, color: "8A93A3", align: "right", margin: 0,
  });
}

function chip(slide, txt, x, y, w, color) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h: 0.26,
    rectRadius: 0.06,
    fill: { color, transparency: 88 },
    line: { color, transparency: 100 },
  });
  slide.addText(txt, {
    x: x + 0.08, y: y + 0.055, w: w - 0.16, h: 0.13,
    fontSize: 6.8, bold: true, color,
    margin: 0, align: "center", fit: "shrink",
  });
}

function bulletList(slide, items, x, y, w, opts = {}) {
  const fontSize = opts.fontSize || 10.5;
  items.forEach((item, i) => {
    const yy = y + i * (opts.gap || 0.38);
    slide.addShape(pptx.ShapeType.ellipse, {
      x, y: yy + 0.06, w: 0.07, h: 0.07,
      fill: { color: opts.color || C.blue },
      line: { color: opts.color || C.blue },
    });
    slide.addText(item, {
      x: x + 0.16, y: yy, w, h: opts.rowH || 0.25,
      fontSize, color: opts.textColor || C.ink,
      margin: 0, fit: "shrink",
      breakLine: false,
    });
  });
}

function sectionNumber(slide, label, x, y, color) {
  slide.addText(label, {
    x, y, w: 0.36, h: 0.22,
    fontSize: 8, bold: true, color: C.white, align: "center", margin: 0.02,
    fill: { color }, shape: pptx.ShapeType.ellipse,
  });
}

function addCard(slide, x, y, w, h, heading, body, accent = C.blue) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    rectRadius: 0.08,
    fill: { color: C.white },
    line: { color: C.faint, width: 1 },
    shadow: { type: "outer", color: "D7DEE8", opacity: 0.18, blur: 1, angle: 45, distance: 1 },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x, y, w: 0.06, h,
    fill: { color: accent },
    line: { color: accent },
  });
  slide.addText(heading, {
    x: x + 0.24, y: y + 0.18, w: w - 0.42, h: 0.26,
    fontSize: 11.5, bold: true, color: C.ink, margin: 0, fit: "shrink",
  });
  slide.addText(body, {
    x: x + 0.24, y: y + 0.55, w: w - 0.42, h: h - 0.72,
    fontSize: 8.6, color: C.muted, breakLine: false,
    valign: "top", margin: 0, fit: "shrink",
  });
}

function phaseSlide(num, phase, goal, groups, accent, slideNo) {
  const s = pptx.addSlide();
  addBg(s, "FBFCFE");
  title(s, phase, goal);
  const xs = [0.72, 3.9, 7.08, 10.26];
  groups.forEach((g, i) => {
    const x = xs[i % 4], y = i < 4 ? 1.66 : 4.35;
    addCard(s, x, y, 2.68, 1.85, g.h, g.b.join("\n"), accent);
  });
  slideNo && footer(s, slideNo);
}

function cover() {
  const s = pptx.addSlide();
  addBg(s, C.dark);
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: C.dark }, line: { color: C.dark } });
  s.addShape(pptx.ShapeType.arc, { x: 8.6, y: -1.15, w: 5.2, h: 5.2, line: { color: C.blue, width: 2, transparency: 20 }, adjustPoint: 0.25 });
  s.addShape(pptx.ShapeType.arc, { x: 9.3, y: 3.0, w: 3.7, h: 3.7, line: { color: C.green, width: 2, transparency: 25 }, adjustPoint: 0.25 });
  s.addText("Codara", {
    x: 0.74, y: 1.85, w: 7.2, h: 0.82,
    fontFace: "Aptos Display", fontSize: 54, bold: true,
    color: C.white, margin: 0,
  });
  s.addText("Architecture intelligence roadmap", {
    x: 0.78, y: 2.82, w: 7.4, h: 0.46,
    fontSize: 20, color: "D9E5F4", margin: 0,
  });
  s.addText("Backend + AI core + system observability plan", {
    x: 0.8, y: 3.42, w: 5.8, h: 0.3,
    fontSize: 11, color: "99A8BA", margin: 0,
  });
  const phases = [["MVP", C.green], ["Advanced AI", C.blue], ["Research AI", C.violet], ["Global platform", C.amber]];
  phases.forEach((p, i) => chip(s, p[0], 0.8 + i * 1.38, 5.85, 1.16, p[1]));
  s.addText("Prepared for Codara project planning", {
    x: 0.8, y: 6.55, w: 4.5, h: 0.22, fontSize: 8, color: "7F8EA3", margin: 0,
  });
}

function problem() {
  const s = pptx.addSlide();
  addBg(s, "FBFCFE");
  title(s, "The Problem Codara Solves", "Developers lose time understanding codebases before they can safely improve them.");
  s.addText("Codara turns a repository into an architecture map, a searchable knowledge base, and a practical assistant for design decisions.", {
    x: 0.72, y: 1.65, w: 6.2, h: 1.05,
    fontSize: 23, bold: true, color: C.ink, margin: 0, fit: "shrink",
  });
  const items = [
    "Analyze architecture, dependencies, modules, classes, and functions.",
    "Detect issues such as circular dependencies, dead code, and smells.",
    "Generate diagrams and summaries that reduce onboarding time.",
    "Answer natural-language questions about the repository context.",
  ];
  bulletList(s, items, 0.82, 3.15, 5.9, { color: C.green, fontSize: 11.4, gap: 0.46, rowH: 0.3 });
  addCard(s, 7.45, 1.65, 4.55, 3.9, "MVP promise", "A useful architecture assistant that developers can start using now: repo analysis, contextual suggestions, diagrams, onboarding summaries, and basic refactoring alerts.", C.green);
  footer(s, 2);
}

function systemOverview() {
  const s = pptx.addSlide();
  addBg(s);
  title(s, "System Overview", "A single backend coordinates upload, analysis, retrieval, diagrams, and observability.");
  const nodes = [
    ["Frontend", 0.9, 2.25, C.blue],
    ["FastAPI backend", 3.25, 2.25, C.green],
    ["Async workers", 5.8, 1.45, C.amber],
    ["Analyzer + AI", 5.8, 3.1, C.violet],
    ["Postgres", 8.45, 1.45, C.cyan],
    ["Vector DB", 8.45, 3.1, C.cyan],
    ["Golang observability", 10.55, 2.25, C.red],
  ];
  nodes.forEach(([label, x, y, color]) => {
    s.addShape(pptx.ShapeType.roundRect, { x, y, w: 1.75, h: 0.66, rectRadius: 0.08, fill: { color, transparency: 90 }, line: { color, width: 1.2 } });
    s.addText(label, { x: x + 0.08, y: y + 0.23, w: 1.59, h: 0.18, fontSize: 8.6, bold: true, color, align: "center", margin: 0, fit: "shrink" });
  });
  const arrows = [[2.65,2.58,0.55,0],[5.0,2.58,0.65,-0.72],[5.0,2.58,0.65,0.78],[7.55,1.78,0.72,0],[7.55,3.43,0.72,0],[10.23,2.58,0.24,0]];
  arrows.forEach(([x,y,w,h]) => s.addShape(pptx.ShapeType.line, { x, y, w, h, line: { color: "8A93A3", width: 1.4, beginArrowType: "none", endArrowType: "triangle" } }));
  s.addText("Golang services collect metrics, logs, queue signals, worker health, and alert state across the supporting infrastructure.", {
    x: 1.0, y: 5.62, w: 10.8, h: 0.45, fontSize: 15, bold: true, color: C.ink, align: "center", margin: 0,
  });
  footer(s, 3);
}

function backendLayers() {
  const s = pptx.addSlide();
  addBg(s, "FBFCFE");
  title(s, "Backend Layers", "Keep each responsibility explicit so the system can scale without becoming hard to reason about.");
  const layers = [
    ["API Layer", "Requests, auth boundary, validation, health endpoints", C.blue],
    ["Service Layer", "Business flow, orchestration, domain rules", C.green],
    ["Analyzer Layer", "Code parsing, dependency extraction, structure mapping", C.violet],
    ["AI Layer", "RAG, contextual suggestions, reasoning prompts", C.amber],
    ["Diagram Layer", "Architecture graph generation and JSON output", C.cyan],
    ["Async Queue", "Large repo analysis, status, retries, job progress", C.red],
    ["Data Layer", "PostgreSQL metadata plus vector search storage", "475569"],
  ];
  layers.forEach((l, i) => addCard(s, 0.85 + (i % 2) * 5.9, 1.55 + Math.floor(i / 2) * 1.22, 5.15, 0.86, l[0], l[1], l[2]));
  footer(s, 4);
}

function dataFlow() {
  const s = pptx.addSlide();
  addBg(s);
  title(s, "Core Data Flow", "From repository upload to usable architecture intelligence.");
  const steps = ["Upload repo", "Create job", "Queue work", "Analyze code", "Store embeddings", "Generate suggestions", "Create diagram", "Fetch results"];
  steps.forEach((step, i) => {
    const x = 0.65 + (i % 4) * 3.05;
    const y = 1.72 + Math.floor(i / 4) * 2.12;
    sectionNumber(s, String(i + 1), x, y + 0.05, i < 4 ? C.green : C.blue);
    s.addText(step, { x: x + 0.45, y, w: 2.15, h: 0.3, fontSize: 13, bold: true, color: C.ink, margin: 0, fit: "shrink" });
    s.addShape(pptx.ShapeType.line, { x: x + 0.45, y: y + 0.45, w: 2.0, h: 0, line: { color: C.faint, width: 1.2 } });
    if (i % 4 !== 3) s.addShape(pptx.ShapeType.line, { x: x + 2.58, y: y + 0.17, w: 0.35, h: 0, line: { color: "AAB3C2", width: 1.2, endArrowType: "triangle" } });
  });
  s.addText("The same flow creates observability events: request received, analyzer started, AI reasoning completed, diagram generated, result saved.", {
    x: 0.9, y: 6.05, w: 11.2, h: 0.34, fontSize: 12.5, color: C.muted, align: "center", margin: 0,
  });
  footer(s, 5);
}

function apiContracts() {
  const s = pptx.addSlide();
  addBg(s, "FBFCFE");
  title(s, "API Contracts", "Frontend and monitoring services depend on stable, simple endpoints.");
  const rows = [
    ["POST /analyze", "Start repository analysis"],
    ["GET /analysis/{id}", "Fetch status and results"],
    ["POST /chat", "Ask the AI about repo context"],
    ["GET /diagram/{id}", "Fetch architecture diagram JSON"],
    ["GET /health", "Report service health"],
    ["GET /metrics", "Expose Prometheus metrics"],
  ];
  rows.forEach((r, i) => {
    const y = 1.55 + i * 0.72;
    s.addText(r[0], { x: 1.0, y, w: 2.8, h: 0.28, fontSize: 11.5, bold: true, color: C.blue, margin: 0, fit: "shrink" });
    s.addText(r[1], { x: 4.05, y, w: 6.2, h: 0.28, fontSize: 11.5, color: C.ink, margin: 0, fit: "shrink" });
    s.addShape(pptx.ShapeType.line, { x: 1.0, y: y + 0.43, w: 10.7, h: 0, line: { color: C.faint, width: 1 } });
  });
  footer(s, 6);
}

function aiPipeline() {
  const s = pptx.addSlide();
  addBg(s);
  title(s, "AI Pipeline", "RAG-based architecture intelligence turns static code into contextual help.");
  const items = [
    ["Extract", "Analyzer builds code structure and dependency map.", C.green],
    ["Chunk", "Code and metadata are split into retrieval-friendly units.", C.blue],
    ["Embed", "Chunks become vectors and are stored for semantic search.", C.cyan],
    ["Retrieve", "User question pulls relevant codebase context.", C.amber],
    ["Reason", "LLM generates suggestions, summaries, and design guidance.", C.violet],
  ];
  items.forEach((it, i) => addCard(s, 0.75 + i * 2.45, 2.05, 2.05, 2.55, it[0], it[1], it[2]));
  s.addText("Phase 1 can start with embeddings and natural-language queries; later phases deepen project-wide reasoning and automation.", {
    x: 1.1, y: 5.6, w: 11.2, h: 0.35, fontSize: 13, bold: true, color: C.ink, align: "center", margin: 0,
  });
  footer(s, 7);
}

function roadmapOverview() {
  const s = pptx.addSlide();
  addBg(s, "FBFCFE");
  title(s, "Codara Roadmap", "A practical path from MVP assistant to enterprise architecture intelligence platform.");
  const phases = [
    ["Phase 1", "MVP now", "Useful architecture assistant developers can start using.", C.green],
    ["Phase 2", "Advanced AI during MSc", "Deeper intelligence, metrics, partial automation, dataset growth.", C.blue],
    ["Phase 3", "Research-powered during PhD", "Deep architecture reasoning, multi-agent review, proactive help.", C.violet],
    ["Phase 4", "Global AI platform post-PhD", "Enterprise SaaS, cross-project intelligence, continuous learning.", C.amber],
  ];
  phases.forEach((p, i) => {
    const x = 0.8 + i * 3.08;
    s.addShape(pptx.ShapeType.line, { x: x + 0.46, y: 2.0, w: 2.35, h: 0, line: { color: i === 3 ? "FFFFFF" : "B9C3D1", width: 1.2, endArrowType: i === 3 ? "none" : "triangle" } });
    sectionNumber(s, String(i + 1), x, 1.83, p[3]);
    s.addText(p[0], { x, y: 2.45, w: 2.4, h: 0.24, fontSize: 9, bold: true, color: p[3], margin: 0 });
    s.addText(p[1], { x, y: 2.82, w: 2.45, h: 0.58, fontSize: 16, bold: true, color: C.ink, margin: 0, fit: "shrink" });
    s.addText(p[2], { x, y: 3.68, w: 2.35, h: 1.0, fontSize: 9.2, color: C.muted, margin: 0, fit: "shrink" });
  });
  footer(s, 8);
}

function observabilityYou() {
  const s = pptx.addSlide();
  addBg(s);
  title(s, "Your Backend / AI Observability Scope", "Make the FastAPI backend, analysis pipeline, and AI core measurable and reliable.");
  const groups = [
    { h: "Metrics", b: ["API response time", "analysis latency", "files processed", "embeddings generated"], c: C.green },
    { h: "Structured logs", b: ["request received", "analyzer start/end", "AI reasoning start/end", "diagram generation"], c: C.blue },
    { h: "Health checks", b: ["/health endpoint", "database status", "vector DB status", "AI module status"], c: C.cyan },
    { h: "Error tracking", b: ["Sentry exceptions", "critical FastAPI failures", "AI processing errors"], c: C.red },
    { h: "Async jobs", b: ["pending jobs", "processing duration", "worker failures", "queue depth"], c: C.amber },
    { h: "Alerts", b: ["repo upload failure", "analyzer crash", "latency threshold", "critical service outage"], c: C.violet },
  ];
  groups.forEach((g, i) => addCard(s, 0.75 + (i % 3) * 4.08, 1.55 + Math.floor(i / 3) * 2.15, 3.45, 1.55, g.h, g.b.join("\n"), g.c));
  footer(s, 13);
}

function teamMember() {
  const s = pptx.addSlide();
  addBg(s, "FBFCFE");
  title(s, "Pending For Go / Infrastructure Team Member", "Keep supporting services healthy, observable, and compatible with Grafana dashboards.");
  addCard(s, 0.72, 1.55, 3.75, 1.65, "Service health", "Build /health endpoints for logging service, metrics collector, Docker worker orchestration, and supporting services. Report health to Prometheus.", C.green);
  addCard(s, 4.8, 1.55, 3.75, 1.65, "System metrics", "Expose CPU, memory, disk usage, jobs in queue, worker count, and vector DB ingestion rate using the Prometheus Go client.", C.blue);
  addCard(s, 8.88, 1.55, 3.75, 1.65, "Logging", "Capture logs from supporting services and Docker workers, including stdout/stderr. Optionally forward container logs to Loki or ELK.", C.cyan);
  addCard(s, 0.72, 4.0, 3.75, 1.65, "Alerts", "Detect unhealthy or unresponsive services. Example: vector DB ingestion fails, then Prometheus Alertmanager triggers Slack/email.", C.red);
  addCard(s, 4.8, 4.0, 3.75, 1.65, "Observability integration", "Ensure all logs, metrics, and health endpoints are compatible with Prometheus and Grafana dashboards.", C.violet);
  addCard(s, 8.88, 4.0, 3.75, 1.65, "Docker workers", "Monitor worker orchestration, process status, queue load, and runtime output so analysis failures are visible quickly.", C.amber);
  footer(s, 14);
}

function risks() {
  const s = pptx.addSlide();
  addBg(s);
  title(s, "Risks & Open Questions", "Track these early so the MVP does not grow blind spots.");
  const risks = [
    "Large repository performance",
    "Embedding storage cost",
    "Diagram complexity and readability",
    "Async worker scaling",
    "API versioning and contract drift",
    "Vector DB choice and ingestion reliability",
    "Log volume and retention cost",
    "Alert noise versus useful incident signals",
  ];
  risks.forEach((r, i) => {
    const x = 0.95 + (i % 2) * 5.8;
    const y = 1.55 + Math.floor(i / 2) * 0.9;
    sectionNumber(s, String(i + 1), x, y, i < 4 ? C.amber : C.red);
    s.addText(r, { x: x + 0.5, y: y + 0.03, w: 4.8, h: 0.24, fontSize: 12, color: C.ink, margin: 0, fit: "shrink" });
  });
  s.addText("Next planning move: agree the MVP observability contract first, then wire dashboards and alerts around real analysis jobs.", {
    x: 1.0, y: 6.15, w: 11.1, h: 0.35, fontSize: 13.5, bold: true, color: C.blue, align: "center", margin: 0,
  });
  footer(s, 15);
}

cover();
problem();
systemOverview();
backendLayers();
dataFlow();
apiContracts();
aiPipeline();
roadmapOverview();
phaseSlide(1, "Phase 1 - MVP (Now)", "Goal: build a useful architecture assistant developers can start using.", [
  { h: "Codebase understanding", b: ["Analyze repositories", "Map modules/classes/functions", "Show dependencies"] },
  { h: "Contextual suggestions", b: ["Detect anti-patterns", "Provide smart hints", "Improve with context"] },
  { h: "Architecture visualization", b: ["Generate component diagrams", "Highlight bottlenecks", "Show critical paths"] },
  { h: "Onboarding aid", b: ["Summarize codebase", "Highlight key modules", "Guide new developers"] },
  { h: "Refactoring alerts", b: ["Simple refactoring suggestions", "Dead code warnings", "Circular dependency checks"] },
  { h: "Powerful optional", b: ["Semantic search", "Natural language queries", "Auth module discovery"] },
], C.green, 9);
phaseSlide(2, "Phase 2 - Advanced AI Intelligence", "Goal: upgrade Codara with deeper intelligence during MSc.", [
  { h: "Advanced understanding", b: ["Whole-project context", "Service relationships", "Library dependency tracking"] },
  { h: "Intelligent suggestions", b: ["Architecture-aware improvements", "Refactoring recommendations", "Design-aware guidance"] },
  { h: "Analytics and metrics", b: ["High-risk areas", "Maintainability scores", "Architecture health view"] },
  { h: "Partial automation", b: ["Small refactoring tasks", "Dependency cleanup", "Assisted fixes"] },
  { h: "Dataset growth", b: ["Anonymized usage data", "Training dataset", "Feedback loop"] },
], C.blue, 10);
phaseSlide(3, "Phase 3 - Research-Powered Assistant", "Goal: turn Codara into deep-tech AI during PhD.", [
  { h: "Deep reasoning", b: ["System-wide patterns", "Design flaw detection", "Architecture diagnosis"] },
  { h: "Multi-agent review", b: ["Specialized AI agents", "Collaborative code review", "Engineering team simulation"] },
  { h: "Predictive assistance", b: ["Future bottleneck prediction", "Proactive architecture ideas", "Risk forecasting"] },
  { h: "Knowledge transfer", b: ["Teach new developers", "Dependency summaries", "History-aware onboarding"] },
  { h: "Enterprise integration", b: ["CI/CD integration", "Manager dashboards", "Governance signals"] },
], C.violet, 11);
phaseSlide(4, "Phase 4 - Global AI Platform", "Goal: become an enterprise AI architecture platform post-PhD.", [
  { h: "Architecture autonomy", b: ["Suggest redesigns", "Large-scale refactoring", "Architecture transformation"] },
  { h: "Cross-project intelligence", b: ["Multiple repositories", "Safe knowledge transfer", "Organization-level context"] },
  { h: "Enterprise SaaS", b: ["Hundreds of companies", "Subscription assistant", "Team dashboards"] },
  { h: "Continuous learning", b: ["Usage patterns", "Dynamic model updates", "Improving intelligence"] },
], C.amber, 12);
observabilityYou();
teamMember();
risks();

const outPath = path.join(outDir, "Codara Roadmap Updated.pptx");
pptx.writeFile({ fileName: outPath });

