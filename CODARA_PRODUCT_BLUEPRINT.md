# Codara Product Blueprint

## 1. Product Direction

Codara is an architecture intelligence assistant for developers. It helps a team understand a codebase, see how the system is connected, detect design risks, and ask architecture-aware questions before making changes.

Codara should feel:

- Calm and focused, like a serious developer tool.
- Architecture-first, not autocomplete-first.
- Visual, but not decorative.
- Trustworthy enough for real engineering decisions.
- Useful from the first repository upload.

The product should avoid looking like a generic AI chatbot dashboard. The assistant is important, but the architecture map, repo analysis, and risk signals are the product center.

## 2. Unique Positioning

Most AI coding tools help developers write code faster. Codara helps developers understand systems better.

Core positioning:

> Codara is the AI architecture layer for codebases.

Unique product angles:

- Repository understanding before code generation.
- Architecture diagrams generated from real code structure.
- AI answers grounded in repository files and dependency relationships.
- Onboarding support for new developers joining a project.
- Observability-aware architecture review for backend and worker systems.

## 3. Primary Users

### Solo Developer

Needs to understand and improve a project quickly.

Key jobs:

- Upload a repo.
- See structure and important modules.
- Ask questions about flows.
- Find risky areas before refactoring.

### New Team Member

Needs fast onboarding into an unfamiliar codebase.

Key jobs:

- Understand project layout.
- Learn critical paths.
- Find authentication, data, worker, and API modules.
- Get plain-English explanations.

### Backend / Platform Engineer

Needs architecture and operations visibility.

Key jobs:

- Understand services and dependencies.
- Monitor analysis workers.
- Track failures and queue behavior.
- Connect architecture risks to runtime signals.

## 4. MVP Product Promise

The MVP should answer one clear question:

> Can Codara make a developer understand a repository faster than reading the files manually?

MVP must include:

- Repository upload or connection flow.
- Codebase structure extraction.
- Module and dependency mapping.
- Basic architecture diagram.
- AI chat over repository context.
- Basic refactoring and code smell alerts.
- Analysis status and health checks.

MVP should not try to do:

- Full automatic refactoring.
- Enterprise permissions.
- Multi-repo intelligence.
- Deep custom model training.
- Complex CI/CD integration.

## 5. Core User Journey

1. User opens Codara workspace.
2. User uploads or connects a repository.
3. Codara creates an analysis job.
4. User sees analysis progress.
5. Codara shows repository summary, modules, and risk signals.
6. User opens architecture diagram.
7. User clicks a node to inspect related files and dependencies.
8. User asks Codara a question.
9. Codara answers with relevant files and architecture context.
10. User exports a report, diagram, or refactoring suggestion.

## 6. App Screens

### Workspace

Purpose:

Give the user the current state of the selected repository.

Must show:

- Current repository.
- Analysis summary.
- Risk count.
- Embedding/search readiness.
- Assistant chat.
- Architecture preview.
- Top issues.

### Repositories

Purpose:

Manage codebases and analysis readiness.

Must show:

- Connect GitHub.
- Upload ZIP.
- Local folder option later.
- Repository list.
- Analysis status.
- File/module counts.
- Last analyzed time.
- Failed analysis state.

### Diagrams

Purpose:

Make architecture visible and explorable.

Must show:

- System graph.
- Service/data/risk modes.
- Critical path.
- Dependency bottlenecks.
- Node details.
- Export actions.

Future:

- Zoom and pan.
- Click node to ask Codara.
- Show circular dependencies.
- Compare architecture over time.

### Observability

Purpose:

Make backend operations visible.

Must show:

- FastAPI health.
- Worker queue health.
- Vector DB ingestion.
- Go metrics collector.
- Logs.
- Alert rules.
- Analysis latency.

### Reports

Purpose:

Turn analysis into a shareable artifact.

Must show:

- Architecture summary.
- Risk list.
- Suggested improvements.
- Onboarding notes.
- Export PDF or Markdown.

### Settings

Purpose:

Configure integrations and AI behavior.

Must show later:

- API keys.
- GitHub connection.
- Vector database settings.
- Model provider.
- Privacy and data retention.

## 7. Key MVP Data Objects

### Repository

- id
- name
- source type
- default branch
- file count
- language summary
- last analyzed at
- status

### Analysis Job

- id
- repository id
- status
- progress
- started at
- completed at
- error message
- files processed

### Module

- id
- repository id
- path
- language
- functions
- classes
- imports
- dependency count

### Dependency

- id
- source module
- target module
- dependency type
- strength

### Issue

- id
- repository id
- type
- severity
- title
- description
- related files

### Diagram

- id
- repository id
- graph json
- mode
- created at

### Chat Session

- id
- repository id
- messages
- cited files
- created at

## 8. MVP API Contract

Initial endpoints:

```text
POST /repositories
GET /repositories
GET /repositories/{id}

POST /analysis
GET /analysis/{id}
GET /analysis/{id}/summary
GET /analysis/{id}/issues

GET /diagram/{analysis_id}
POST /chat

GET /health
GET /metrics
```

## 9. Frontend Build Plan

### Step 1: Convert Static UI Into Real App

Recommended stack:

- React
- Vite
- TypeScript
- CSS modules or plain CSS first
- Later: component library only if needed

Build:

- App shell.
- Sidebar routing.
- Workspace view.
- Repositories view.
- Diagrams view.
- Observability view.
- Mock API data layer.

### Step 2: Component System

Create reusable components:

- AppShell
- Sidebar
- Topbar
- MetricCard
- RepositoryRow
- StatusPill
- AssistantPanel
- DiagramCanvas
- IssueList
- ServiceHealthCard
- LogStream

### Step 3: Wire Real API Later

Replace mock data with:

- repository client
- analysis client
- diagram client
- chat client
- metrics client

## 10. Backend Build Plan

Recommended backend structure:

```text
app/
  api/
  services/
  analyzers/
  ai/
  diagrams/
  workers/
  db/
  observability/
```

First backend milestones:

1. FastAPI project setup.
2. Health endpoint.
3. Repository upload endpoint.
4. Analysis job model.
5. Basic Python import analyzer.
6. Dependency graph JSON output.
7. Diagram endpoint.
8. Chat endpoint with mocked response.
9. Embedding pipeline.
10. Prometheus metrics.

## 11. What Makes The UI Unique

Codara's UI should organize everything around architecture understanding.

Unique interaction ideas:

- Ask Codara from any selected module.
- Click a diagram node and see related files, risks, and AI explanation.
- Turn a risk into a suggested refactoring task.
- Show "onboarding path" for new developers.
- Show "critical system paths" instead of only file trees.
- Connect analysis health to observability health.

Signature product patterns:

- Architecture map is always near the assistant.
- Every AI answer can reference files and diagram nodes.
- Issues are grouped by architecture impact, not generic lint severity.
- Observability is treated as part of architecture quality.

## 12. First Build Milestones

### Milestone 1: Real Frontend Skeleton

Goal:

Turn the static prototype into a real React app.

Deliverables:

- Vite React project.
- Sidebar routes.
- Four working screens.
- Mock data.
- Responsive layout.

### Milestone 2: FastAPI Skeleton

Goal:

Create backend foundation.

Deliverables:

- FastAPI app.
- `/health`.
- `/repositories`.
- `/analysis`.
- `/diagram/{id}` with mocked graph.
- `/chat` with mocked answer.

### Milestone 3: Basic Analyzer

Goal:

Analyze a Python repo enough to produce value.

Deliverables:

- File tree scan.
- Python import extraction.
- Module list.
- Dependency graph.
- Circular dependency detection.

### Milestone 4: UI + Backend Integration

Goal:

Make the UI consume real backend data.

Deliverables:

- Repository list from API.
- Analysis status from API.
- Diagram from API.
- Issues from analyzer.

### Milestone 5: AI Context Layer

Goal:

Make Codara answer repository questions.

Deliverables:

- Code chunking.
- Embeddings.
- Vector search.
- Chat with retrieved context.
- File citations.

## 13. Immediate Next Step

The next practical move is:

> Convert the current static Codara UI into a Vite React app with mocked data and real routing.

This gives the project a proper frontend foundation before backend integration starts.
