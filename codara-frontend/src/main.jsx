import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import {
  bulkUpdateRiskTasks,
  createAnalysis,
  createRepository,
  createRiskTask,
  deleteRiskTask,
  getAlerts,
  getAnalysisJobs,
  getAnalysisIssues,
  getAnalysisModules,
  getAnalysisSummary,
  getDiagram,
  getHealth,
  getLogs,
  getOnboardingReport,
  getRepositories,
  getRepositoryIntelligence,
  getRepositoryTimeline,
  getRiskReviewStatuses,
  getRiskTaskEvents,
  getRiskTasks,
  searchAnalysis,
  sendChatMessage,
  updateRiskReviewStatus,
  updateRiskTask,
  uploadRepositoryZip,
} from "./api.js";
import { mockData } from "./mockData.js";

const viewCopy = {
  workspace: {
    eyebrow: "MVP workspace",
    title: "Understand the architecture before changing the code.",
    action: "New analysis",
  },
  repositories: {
    eyebrow: "Repository intake",
    title: "Bring codebases into Codara and track analysis readiness.",
    action: "Upload repo",
  },
  diagrams: {
    eyebrow: "Architecture visualization",
    title: "Inspect system paths, dependencies, and design bottlenecks.",
    action: "Generate diagram",
  },
  observability: {
    eyebrow: "Monitoring and operations",
    title: "Watch service health, logs, metrics, queues, and alerts.",
    action: "Open dashboard",
  },
};

const taskOwners = ["Unassigned", "Architecture", "Backend", "AI", "DevOps"];
const taskStatuses = ["todo", "blocked", "done"];
const taskPriorities = ["low", "medium", "high"];

function App() {
  const [activeView, setActiveView] = useState("workspace");
  const [messages, setMessages] = useState(mockData.messages);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [repositories, setRepositories] = useState(mockData.repositories);
  const [services, setServices] = useState(mockData.services);
  const [logs, setLogs] = useState(mockData.logs);
  const [alerts, setAlerts] = useState(mockData.alerts);
  const [diagram, setDiagram] = useState(null);
  const [diagramMode, setDiagramMode] = useState("service");
  const [analyzerResult, setAnalyzerResult] = useState(null);
  const [summary, setSummary] = useState(null);
  const [issues, setIssues] = useState(mockData.issues);
  const [analysisJobs, setAnalysisJobs] = useState(mockData.analysisJobs);
  const [searchResults, setSearchResults] = useState([]);
  const [searchStatus, setSearchStatus] = useState("Search indexed modules, functions, classes, and imports.");
  const [selectedModule, setSelectedModule] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [onboardingReport, setOnboardingReport] = useState(null);
  const [repositoryTimeline, setRepositoryTimeline] = useState([]);
  const [repositoryIntelligence, setRepositoryIntelligence] = useState(null);
  const [riskReviewStatuses, setRiskReviewStatuses] = useState({});
  const [riskTasks, setRiskTasks] = useState([]);
  const [riskTaskEvents, setRiskTaskEvents] = useState([]);
  const [activeRepositoryId, setActiveRepositoryId] = useState("repo_codara_api");
  const [activeAnalysisId, setActiveAnalysisId] = useState("analysis_codara_api_latest");
  const [runStatus, setRunStatus] = useState({
    state: "ready",
    message: "Analyzer ready. Latest scan is loaded.",
  });
  const copy = viewCopy[activeView];
  const activeRepository =
    repositories.find((repo) => repo.id === activeRepositoryId) || repositories[0];
  const displayedRepositories = repositories.map((repo) => ({
    ...repo,
    selected: repo.id === activeRepository?.id,
  }));

  async function loadAnalysisData(analysisId = activeAnalysisId, mode = diagramMode) {
    const [diagramData, moduleData, summaryData, issueData] = await Promise.all([
      getDiagram(analysisId, mode),
      getAnalysisModules(analysisId),
      getAnalysisSummary(analysisId),
      getAnalysisIssues(analysisId),
    ]);

    setDiagram(diagramData);
    setAnalyzerResult(moduleData);
    setSummary(summaryData);
    setIssues(issueData.map(mapIssue));
    await refreshRiskReviewStatuses(analysisId);
    await refreshRiskTasks(analysisId);
    await refreshRiskTaskEvents(analysisId);
  }

  useEffect(() => {
    getRepositories()
      .then((items) => setRepositories(items.map(mapRepository)))
      .catch(() => setRepositories(mockData.repositories));

    getHealth()
      .then((health) => setServices(health.services.map(mapService)))
      .catch(() => setServices(mockData.services));

    getLogs()
      .then((items) => setLogs(items.map(mapLogEvent)))
      .catch(() => setLogs(mockData.logs));

    getAlerts()
      .then((items) => setAlerts(items.map(mapAlertRule)))
      .catch(() => setAlerts(mockData.alerts));

    refreshAnalysisJobs().catch(() => setAnalysisJobs(mockData.analysisJobs));
    refreshRepositoryTimeline("repo_codara_api").catch(() => setRepositoryTimeline([]));
    refreshRepositoryIntelligence("repo_codara_api").catch(() => setRepositoryIntelligence(null));

    loadAnalysisData("analysis_codara_api_latest").catch(() => {
      setDiagram(null);
      setAnalyzerResult(null);
      setSummary(null);
      setIssues(mockData.issues);
      setRunStatus({
        state: "offline",
        message: "Backend unavailable. Showing local mock data.",
      });
    });
  }, []);

  async function analyzeRepository(repositoryId, repositoryName = "repository") {
    const job = await createAnalysis(repositoryId);
    setActiveRepositoryId(repositoryId);
    setActiveAnalysisId(job.id);
    await loadAnalysisData(job.id);
    await refreshAnalysisJobs();
    await refreshRepositoryTimeline(repositoryId);
    await refreshRepositoryIntelligence(repositoryId);
    setRunStatus({
      state: "ready",
      message: `${repositoryName} analysis completed. Workspace, diagrams, and assistant context are updated.`,
    });
    return job;
  }

  async function runAnalysis() {
    const repositoryId = activeRepository?.id || "repo_codara_api";
    const repositoryName = activeRepository?.name || "codara-api";

    setRunStatus({
      state: "running",
      message: `Starting a new analysis for ${repositoryName}...`,
    });

    try {
      await analyzeRepository(repositoryId, repositoryName);
    } catch {
      setRunStatus({
        state: "offline",
        message: "Analysis could not start. Check that the backend is running.",
      });
    }
  }

  async function refreshRepositories() {
    try {
      const items = await getRepositories();
      const mapped = items.map(mapRepository);
      setRepositories(mapped);
      return mapped;
    } catch {
      setRepositories(mockData.repositories);
      return mockData.repositories;
    }
  }

  async function refreshAnalysisJobs(repositoryId) {
    const jobs = await getAnalysisJobs(repositoryId);
    const mappedJobs = jobs.map((job) => mapAnalysisJob(job, repositories));
    setAnalysisJobs(mappedJobs);
    return mappedJobs;
  }

  async function refreshRepositoryTimeline(repositoryId = activeRepositoryId) {
    const timeline = await getRepositoryTimeline(repositoryId);
    setRepositoryTimeline(timeline.map(mapTimelineEvent));
    return timeline;
  }

  async function refreshRepositoryIntelligence(repositoryId = activeRepositoryId) {
    const intelligence = await getRepositoryIntelligence(repositoryId);
    setRepositoryIntelligence(mapRepositoryIntelligence(intelligence));
    return intelligence;
  }

  async function refreshRiskReviewStatuses(analysisId = activeAnalysisId) {
    const statuses = await getRiskReviewStatuses(analysisId);
    const mappedStatuses = Object.fromEntries(statuses.map((item) => [item.issue_id, mapRiskReviewStatus(item)]));
    setRiskReviewStatuses(mappedStatuses);
    return mappedStatuses;
  }

  async function handleRiskReviewStatus(issueId, updates) {
    setRiskReviewStatuses((current) => ({
      ...current,
      [issueId]: { status: "open", note: "", ...(current[issueId] || {}), ...updates },
    }));
    try {
      const updated = await updateRiskReviewStatus(activeAnalysisId, issueId, updates);
      setRiskReviewStatuses((current) => ({ ...current, [updated.issue_id]: mapRiskReviewStatus(updated) }));
    } catch {
      setRunStatus({
        state: "offline",
        message: "Risk review status could not be saved. Check that the backend is running.",
      });
    }
  }

  async function refreshRiskTasks(analysisId = activeAnalysisId) {
    const tasks = await getRiskTasks(analysisId);
    setRiskTasks(tasks.map(mapRiskTask));
    return tasks;
  }

  async function refreshRiskTaskEvents(analysisId = activeAnalysisId) {
    const events = await getRiskTaskEvents(analysisId);
    setRiskTaskEvents(events.map(mapRiskTaskEvent));
    return events;
  }

  async function handleCreateRiskTask(issue) {
    const payload = {
      issue_id: issue.id,
      title: `Resolve ${issue.title}`,
      severity: issue.severity,
      files: issue.relatedFiles || [],
      owner: issue.type?.toLowerCase().includes("observability") ? "DevOps" : "Architecture",
      priority: issue.severity === "high" ? "high" : "medium",
    };
    try {
      const task = await createRiskTask(activeAnalysisId, payload);
      setRiskTasks((current) => {
        const mapped = mapRiskTask(task);
        return current.some((item) => item.id === mapped.id)
          ? current.map((item) => (item.id === mapped.id ? mapped : item))
          : [mapped, ...current];
      });
      setRunStatus({
        state: "ready",
        message: `Task created for ${issue.title}.`,
      });
      await refreshRiskTaskEvents(activeAnalysisId).catch(() => {});
    } catch {
      setRunStatus({
        state: "offline",
        message: "Risk task could not be created. Check that the backend is running.",
      });
    }
  }

  async function handleToggleRiskTask(task) {
    const nextStatus = task.status === "done" ? "todo" : "done";
    await handleUpdateRiskTask(task, { status: nextStatus }, `Task marked ${nextStatus}.`);
  }

  async function handleUpdateRiskTask(task, updates, successMessage = "Task updated.") {
    setRiskTasks((current) => current.map((item) => (
      item.id === task.id ? { ...item, ...updates } : item
    )));
    try {
      const updated = await updateRiskTask(activeAnalysisId, task.id, updates);
      setRiskTasks((current) => current.map((item) => (
        item.id === updated.id ? mapRiskTask(updated) : item
      )));
      setRunStatus({
        state: "ready",
        message: successMessage,
      });
      await refreshRiskTaskEvents(activeAnalysisId).catch(() => {});
    } catch {
      setRunStatus({
        state: "offline",
        message: "Risk task could not be updated. Check that the backend is running.",
      });
      await refreshRiskTasks(activeAnalysisId).catch(() => {});
    }
  }

  async function handleAssignRiskTask(task, owner) {
    await handleUpdateRiskTask(task, { owner }, `Task assigned to ${owner}.`);
  }

  async function handleBulkUpdateRiskTasks(taskIds, updates) {
    if (!taskIds.length) return;
    setRiskTasks((current) => current.map((task) => (
      taskIds.includes(task.id) ? { ...task, ...mapTaskUpdateToClient(updates) } : task
    )));
    try {
      const updated = await bulkUpdateRiskTasks(activeAnalysisId, { task_ids: taskIds, ...updates });
      const mapped = updated.map(mapRiskTask);
      setRiskTasks((current) => current.map((task) => (
        mapped.find((item) => item.id === task.id) || task
      )));
      await refreshRiskTaskEvents(activeAnalysisId).catch(() => {});
      setRunStatus({
        state: "ready",
        message: `${updated.length} task${updated.length === 1 ? "" : "s"} updated in bulk.`,
      });
    } catch {
      setRunStatus({
        state: "offline",
        message: "Bulk task update failed. Check that the backend is running.",
      });
      await refreshRiskTasks(activeAnalysisId).catch(() => {});
    }
  }

  async function handleDeleteRiskTask(task) {
    setRiskTasks((current) => current.filter((item) => item.id !== task.id));
    try {
      await deleteRiskTask(activeAnalysisId, task.id);
      setRunStatus({
        state: "ready",
        message: `Task removed: ${task.title}.`,
      });
      await refreshRiskTaskEvents(activeAnalysisId).catch(() => {});
    } catch {
      setRunStatus({
        state: "offline",
        message: "Risk task could not be deleted. Check that the backend is running.",
      });
      await refreshRiskTasks(activeAnalysisId).catch(() => {});
    }
  }

  async function handleRepositoryUpload(file) {
    if (!file) return;
    setRunStatus({
      state: "running",
      message: `Uploading and analyzing ${file.name}...`,
    });

    try {
      const repo = await uploadRepositoryZip(file);
      await refreshRepositories();
      await analyzeRepository(repo.id, repo.name);
    } catch {
      setRunStatus({
        state: "offline",
        message: "Upload failed. Use a valid ZIP under 25 MB.",
      });
    }
  }

  async function handleGitHubConnect(payload) {
    setRunStatus({
      state: "running",
      message: `Fetching and analyzing ${payload.name} from GitHub...`,
    });

    try {
      const repo = await createRepository({
        name: payload.name,
        source_type: "github",
        url: payload.url,
        branch: payload.branch,
      });
      await refreshRepositories();
      setActiveRepositoryId(repo.id);
      const jobs = await refreshAnalysisJobs(repo.id);
      const latestJob = jobs.find((job) => job.repositoryId === repo.id) || jobs[0];
      if (latestJob) {
        setActiveAnalysisId(latestJob.id);
        await loadAnalysisData(latestJob.id);
      }
      await refreshRepositoryTimeline(repo.id);
      await refreshRepositoryIntelligence(repo.id);
      setRunStatus({
        state: "ready",
        message: `${repo.name} was fetched from GitHub and analyzed. Modules, risks, diagrams, and assistant context are updated.`,
      });
    } catch {
      setRunStatus({
        state: "offline",
        message: "GitHub repository could not be fetched. Use a public GitHub URL or upload a ZIP.",
      });
    }
  }

  async function handleRepositorySelect(repo) {
    if (!repo || repo.id === activeRepositoryId) return;
    setRunStatus({
      state: "running",
      message: `Loading architecture context for ${repo.name}...`,
    });

    try {
      await analyzeRepository(repo.id, repo.name);
      setActiveView("workspace");
    } catch {
      setRunStatus({
        state: "offline",
        message: `${repo.name} could not be analyzed. Try the default Codara backend or upload a supported ZIP.`,
      });
    }
  }

  async function handleDiagramModeChange(mode) {
    setDiagramMode(mode);
    setRunStatus({
      state: "running",
      message: `Rendering ${mode} diagram for ${activeRepository?.name || "current repository"}...`,
    });

    try {
      const diagramData = await getDiagram(activeAnalysisId, mode);
      setDiagram(diagramData);
      setRunStatus({
        state: "ready",
        message: `${mode[0].toUpperCase()}${mode.slice(1)} diagram is ready.`,
      });
    } catch {
      setRunStatus({
        state: "offline",
        message: "Diagram mode could not be loaded. Check that the backend is running.",
      });
    }
  }

  async function handlePrimaryAction() {
    if (activeView === "workspace" || activeView === "diagrams") {
      await runAnalysis();
    } else if (activeView === "repositories") {
      setActiveView("repositories");
      setRunStatus({
        state: "ready",
        message: "Repository intake is ready. Connect GitHub or upload a ZIP next.",
      });
    } else {
      setRunStatus({
        state: "ready",
        message: "Observability dashboard is using live backend health data.",
      });
    }
  }

  function inspectModule(moduleNameOrPath) {
    if (moduleNameOrPath?.module_name) {
      setSelectedModule(moduleNameOrPath);
      return;
    }

    const modules = analyzerResult?.modules || [];
    const match = modules.find((module) => (
      module.module_name === moduleNameOrPath ||
      module.path === moduleNameOrPath ||
      shortName(module.module_name) === shortName(moduleNameOrPath) ||
      shortPath(module.path) === shortPath(moduleNameOrPath)
    ));

    if (match) {
      setSelectedModule(match);
      return;
    }

    setRunStatus({
      state: "offline",
    message: `No module detail found for ${moduleNameOrPath}. Try running analysis on a supported repository.`,
    });
  }

  async function sendPrompt(prompt) {
    if (assistantBusy) return;
    const pendingId = crypto.randomUUID();
    setAssistantBusy(true);
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", body: prompt },
      {
        id: pendingId,
        role: "assistant",
        body: "Reading architecture context...",
        pending: true,
        citedFiles: [],
        relatedNodes: [],
      },
    ]);

    try {
      const response = await sendChatMessage(activeRepository?.id || "repo_codara_api", prompt);
      setMessages((current) => current.map((message) => (
        message.id === pendingId ? {
          id: crypto.randomUUID(),
          role: "assistant",
          body: response.answer,
          citedFiles: response.cited_files,
          relatedNodes: response.related_nodes,
          confidence: confidenceForAnswer(response.cited_files, response.related_nodes),
        } : message
      )));
    } catch {
      setMessages((current) => current.map((message) => (
        message.id === pendingId ? {
          id: crypto.randomUUID(),
          role: "assistant",
          body: "Codara would retrieve related modules, dependency edges, and file references before answering this question.",
          citedFiles: [],
          relatedNodes: [],
        } : message
      )));
    } finally {
      setAssistantBusy(false);
    }
  }

  async function handleCodeSearch(query) {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setSearchResults([]);
      setSearchStatus("Search indexed modules, functions, classes, and imports.");
      return;
    }

    setSearchStatus(`Searching for "${trimmedQuery}"...`);
    try {
      const results = await searchAnalysis(activeAnalysisId, trimmedQuery);
      setSearchResults(results);
      setSearchStatus(results.length ? `${results.length} code results found.` : "No matching code context found.");
    } catch {
      setSearchResults([]);
      setSearchStatus("Search unavailable. Run analysis on a supported repository first.");
    }
  }

  async function openOnboardingReport() {
    setRunStatus({
      state: "running",
      message: "Generating onboarding report from the latest analysis...",
    });

    try {
      const report = await getOnboardingReport(activeAnalysisId);
      setOnboardingReport(report);
      setRunStatus({
        state: "ready",
        message: "Onboarding report is ready.",
      });
    } catch {
      setRunStatus({
        state: "offline",
        message: "Onboarding report could not be generated. Run analysis on a supported repository first.",
      });
    }
  }

  return (
    <div className="app-shell">
      <Sidebar activeView={activeView} onNavigate={setActiveView} currentRepository={activeRepository} />
      <main className="workspace">
        <Topbar copy={copy} onPrimaryAction={handlePrimaryAction} currentRepository={activeRepository} />
        <RunStatus status={runStatus} />
        {activeView === "workspace" && (
          <Workspace
            messages={messages}
            onSendPrompt={sendPrompt}
            assistantBusy={assistantBusy}
            onInspectModule={inspectModule}
            onSelectIssue={setSelectedIssue}
            onCodeSearch={handleCodeSearch}
            onOpenOnboarding={openOnboardingReport}
            searchResults={searchResults}
            searchStatus={searchStatus}
            summary={summary}
            issues={issues}
            riskReviewStatuses={riskReviewStatuses}
            riskTasks={riskTasks}
            riskTaskEvents={riskTaskEvents}
            onRiskReviewStatus={handleRiskReviewStatus}
            onCreateRiskTask={handleCreateRiskTask}
            onToggleRiskTask={handleToggleRiskTask}
            onUpdateRiskTask={handleUpdateRiskTask}
            onBulkUpdateRiskTasks={handleBulkUpdateRiskTasks}
            onAssignRiskTask={handleAssignRiskTask}
            onDeleteRiskTask={handleDeleteRiskTask}
          />
        )}
        {activeView === "repositories" && (
          <Repositories
            repositories={displayedRepositories}
            analyzerResult={analyzerResult}
            timeline={repositoryTimeline}
            intelligence={repositoryIntelligence}
            currentRepository={activeRepository}
            onConnectGitHub={handleGitHubConnect}
            onUploadRepository={handleRepositoryUpload}
            onSelectRepository={handleRepositorySelect}
            onInspectModule={inspectModule}
            onNavigate={setActiveView}
          />
        )}
        {activeView === "diagrams" && (
          <Diagrams
            diagram={diagram}
            mode={diagramMode}
            onModeChange={handleDiagramModeChange}
            analyzerResult={analyzerResult}
            onInspectModule={inspectModule}
          />
        )}
        {activeView === "observability" && (
          <Observability
            services={services}
            logs={logs}
            alerts={alerts}
            analysisJobs={analysisJobs}
            currentRepository={activeRepository}
            onRefreshJobs={() => refreshAnalysisJobs(activeRepository?.id)}
          />
        )}
        {selectedModule && (
          <ModuleDetailDrawer
            module={selectedModule}
            dependencies={analyzerResult?.dependencies || []}
            circularDependencies={analyzerResult?.circular_dependencies || []}
            onClose={() => setSelectedModule(null)}
          />
        )}
        {selectedIssue && (
          <IssueDetailDrawer
            issue={selectedIssue}
            onInspectModule={inspectModule}
            onClose={() => setSelectedIssue(null)}
          />
        )}
        {onboardingReport && (
          <OnboardingDrawer
            report={onboardingReport}
            onInspectModule={inspectModule}
            onSelectIssue={setSelectedIssue}
            onClose={() => setOnboardingReport(null)}
          />
        )}
      </main>
    </div>
  );
}

function confidenceForAnswer(citedFiles = [], relatedNodes = []) {
  const evidenceCount = citedFiles.length + relatedNodes.length;
  if (evidenceCount >= 5) {
    return { label: "Strong context", level: "strong", detail: `${evidenceCount} sources` };
  }
  if (evidenceCount >= 2) {
    return { label: "Partial context", level: "partial", detail: `${evidenceCount} sources` };
  }
  return { label: "Limited context", level: "limited", detail: `${evidenceCount} sources` };
}

function mapRepository(repo) {
  return {
    id: repo.id,
    name: repo.name,
    description: repo.description,
    files: repo.files,
    modules: repo.modules,
    status: repo.status === "ready" ? "Ready" : "Review",
    language: repo.language,
    sourceType: repo.source_type,
  };
}

function mapService(service) {
  return {
    label: service.service,
    status: service.status === "watch" ? "Watch" : service.status === "down" ? "Down" : "Healthy",
    detail: service.detail,
    state: service.status === "watch" ? "warning" : service.status === "down" ? "warning" : "healthy",
  };
}

function mapIssue(issue) {
  return {
    id: issue.id || issue.title,
    severity: issue.severity,
    type: issue.type || "architecture",
    title: issue.title,
    detail: issue.description || issue.detail,
    relatedFiles: issue.related_files || issue.relatedFiles || [],
    recommendation: recommendationForIssue(issue),
  };
}

function recommendationForIssue(issue) {
  const title = `${issue.title || ""} ${issue.type || ""}`.toLowerCase();
  if (title.includes("circular")) {
    return "Extract the shared behavior into a lower-level module, then make both modules depend on that shared boundary instead of each other.";
  }
  if (title.includes("hotspot") || title.includes("dependency")) {
    return "Split orchestration from implementation details and move secondary imports behind smaller service interfaces.";
  }
  if (title.includes("thin") || title.includes("dead") || title.includes("isolated")) {
    return "Confirm whether this module is still part of an active path. If it is not referenced, remove it or fold it into the nearest owning feature.";
  }
  return "Review the related files, identify the boundary being crossed, and reduce the number of reasons this module needs to change.";
}

function mapLogEvent(log) {
  return {
    id: log.id,
    level: log.level,
    service: log.service,
    body: log.message,
    timestamp: log.timestamp,
  };
}

function mapAlertRule(alert) {
  return {
    severity: alert.severity,
    title: alert.title,
    detail: `${alert.description} Target: ${alert.target}.`,
  };
}

function mapAnalysisJob(job, repositoryItems) {
  const repo = repositoryItems.find((item) => item.id === job.repository_id);
  return {
    id: job.id,
    repositoryId: job.repository_id,
    repositoryName: repo?.name || job.repository_id.replace("repo_", ""),
    status: job.status,
    progress: job.progress,
    filesProcessed: job.files_processed,
    startedAt: job.started_at,
    completedAt: job.completed_at,
  };
}

function mapTimelineEvent(event) {
  return {
    id: event.id,
    title: event.title,
    detail: event.detail,
    status: event.status,
    timestamp: event.timestamp,
    artifact: event.artifact,
  };
}

function mapRiskReviewStatus(item) {
  return {
    status: item.status || "open",
    note: item.note || "",
    updatedAt: item.updated_at,
  };
}

function mapRiskTask(task) {
  return {
    id: task.id,
    issueId: task.issue_id,
    title: task.title,
    severity: task.severity,
    files: task.files || [],
    status: task.status,
    owner: task.owner || "Unassigned",
    priority: task.priority || "medium",
    dueDate: task.due_date || "",
    note: task.note || "",
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  };
}

function mapRiskTaskEvent(event) {
  return {
    id: event.id,
    taskId: event.task_id,
    taskTitle: event.task_title,
    eventType: event.event_type,
    field: event.field,
    previousValue: event.previous_value,
    nextValue: event.next_value,
    message: event.message,
    timestamp: event.timestamp,
  };
}

function mapTaskUpdateToClient(updates) {
  return {
    ...(updates.status ? { status: updates.status } : {}),
    ...(updates.owner ? { owner: updates.owner } : {}),
    ...(updates.priority ? { priority: updates.priority } : {}),
    ...(updates.due_date !== undefined ? { dueDate: updates.due_date || "" } : {}),
    ...(updates.note !== undefined ? { note: updates.note || "" } : {}),
  };
}

function mapRepositoryIntelligence(intelligence) {
  return {
    repositoryId: intelligence.repository_id,
    healthLabel: intelligence.health_label,
    healthScore: intelligence.health_score,
    modulesMapped: intelligence.modules_mapped,
    riskSignals: intelligence.risk_signals,
    topHotspot: intelligence.top_hotspot,
    nextAction: intelligence.next_action,
    rationale: intelligence.rationale,
  };
}

function formatTimestamp(value) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Sidebar({ activeView, onNavigate, currentRepository }) {
  const nav = [
    ["workspace", "workspace", "Workspace"],
    ["repositories", "repositories", "Repositories"],
    ["diagrams", "diagrams", "Diagrams"],
    ["observability", "observability", "Observability"],
  ];

  return (
    <aside className="sidebar" aria-label="Codara navigation">
      <div className="brand-row">
        <CodaraLogo />
        <div>
          <p className="brand-name">Codara</p>
          <p className="brand-subtitle">Architecture assistant</p>
        </div>
      </div>

      <nav className="nav-stack">
        {nav.map(([view, icon, label]) => (
          <button
            className={`nav-item ${activeView === view ? "active" : ""}`}
            type="button"
            key={view}
            onClick={() => onNavigate(view)}
            aria-current={activeView === view ? "page" : undefined}
          >
            <NavIcon name={icon} />
            {label}
          </button>
        ))}
      </nav>

      <div className="repo-panel">
        <p className="panel-label">Current repository</p>
        <div className="repo-card">
            <div className="repo-dot"></div>
            <div>
            <p className="repo-name">{currentRepository?.name || "codara-api"}</p>
            <p className="repo-meta">{currentRepository?.language || "FastAPI"} - {currentRepository?.files || 128} files</p>
            </div>
          </div>
        <button className="ghost-button" type="button" onClick={() => onNavigate("repositories")}>
          Upload repository
        </button>
      </div>

      <div className="status-card">
        <div className="status-line">
          <span className="pulse"></span>
          Analyzer ready
        </div>
        <p>Backend, vector DB, and worker queue are responding.</p>
      </div>
    </aside>
  );
}

function CodaraLogo() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 48 48" role="img">
        <path className="logo-shell" d="M24 4 41.3 14v20L24 44 6.7 34V14L24 4Z" />
        <path className="logo-path" d="M15 18.5h8.2l4.2 5.5-4.2 5.5H15" />
        <path className="logo-path" d="M33 16.5 25.6 24 33 31.5" />
        <circle className="logo-node" cx="15" cy="18.5" r="2.3" />
        <circle className="logo-node" cx="15" cy="29.5" r="2.3" />
        <circle className="logo-node" cx="33" cy="16.5" r="2.3" />
        <circle className="logo-node" cx="33" cy="31.5" r="2.3" />
      </svg>
    </div>
  );
}

function NavIcon({ name }) {
  return (
    <span className="icon" aria-hidden="true">
      {name === "workspace" && (
        <svg viewBox="0 0 24 24">
          <rect x="4" y="5" width="7" height="6" rx="1.8" />
          <rect x="13" y="5" width="7" height="6" rx="1.8" />
          <rect x="4" y="13" width="16" height="6" rx="1.8" />
        </svg>
      )}
      {name === "repositories" && (
        <svg viewBox="0 0 24 24">
          <path d="M5 7.5h6l2 2H19v8.2a1.8 1.8 0 0 1-1.8 1.8H6.8A1.8 1.8 0 0 1 5 17.7V7.5Z" />
          <path d="M5 7.5V6.8A1.8 1.8 0 0 1 6.8 5h3.4l2 2H17" />
        </svg>
      )}
      {name === "diagrams" && (
        <svg viewBox="0 0 24 24">
          <circle cx="6" cy="7" r="2.2" />
          <circle cx="18" cy="7" r="2.2" />
          <circle cx="12" cy="17" r="2.2" />
          <path d="M8.2 8.2 10.8 15" />
          <path d="M15.8 8.2 13.2 15" />
          <path d="M8.4 7h7.2" />
        </svg>
      )}
      {name === "observability" && (
        <svg viewBox="0 0 24 24">
          <path d="M4 13.5h3l2-5 3.4 9 2.2-5H20" />
          <path d="M5.5 6.5A8.7 8.7 0 0 1 12 4a8.7 8.7 0 0 1 6.5 2.5" />
          <path d="M7.5 19.5A8.7 8.7 0 0 0 12 20a8.7 8.7 0 0 0 4.5-.5" />
        </svg>
      )}
    </span>
  );
}

function Topbar({ copy, onPrimaryAction, currentRepository }) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p className="topbar-context">
          Active repo: <strong>{currentRepository?.name || "codara-api"}</strong>
        </p>
      </div>
      <div className="topbar-actions">
        <button className="icon-button" type="button" aria-label="Refresh analysis" onClick={onPrimaryAction}>R</button>
        <button className="primary-button" type="button" onClick={onPrimaryAction}>
          {copy.action}
        </button>
      </div>
    </header>
  );
}

function RunStatus({ status }) {
  return (
    <section className={`run-status ${status.state}`} aria-live="polite">
      <span></span>
      <p>{status.message}</p>
    </section>
  );
}

function MetricCard({ label, value, detail }) {
  return (
    <article className="metric-card">
      <p className="metric-label">{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

function Workspace({
  messages,
  onSendPrompt,
  assistantBusy,
  onInspectModule,
  onSelectIssue,
  onCodeSearch,
  onOpenOnboarding,
  searchResults,
  searchStatus,
  summary,
  issues,
  riskReviewStatuses,
  riskTasks,
  riskTaskEvents,
  onRiskReviewStatus,
  onCreateRiskTask,
  onToggleRiskTask,
  onUpdateRiskTask,
  onBulkUpdateRiskTasks,
  onAssignRiskTask,
  onDeleteRiskTask,
}) {
  const metrics = summary
    ? [
        {
          label: "Modules mapped",
          value: String(summary.modules_mapped),
          detail: `${summary.key_modules.length} key modules`,
        },
        {
          label: "Risk signals",
          value: String(summary.risk_signals),
          detail: "Generated by analyzer rules",
        },
        {
          label: "Embeddings",
          value: String(summary.embeddings),
          detail: "Estimated chunks ready",
        },
      ]
    : mockData.metrics;

  return (
    <section className="view active">
      <section className="analysis-grid" aria-label="Analysis summary">
        {metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </section>
      <CodeSearchPanel
        results={searchResults}
        status={searchStatus}
        onSearch={onCodeSearch}
        onInspectModule={onInspectModule}
      />
      <section className="onboarding-panel">
        <div>
          <p className="section-kicker">Onboarding</p>
          <h2>New developer guide</h2>
          <p>Generate a reading order, top risks, and first tasks from this analysis.</p>
        </div>
        <button className="primary-button" type="button" onClick={onOpenOnboarding}>
          Generate report
        </button>
      </section>
      <RiskReviewQueue
        issues={issues}
        reviewStatuses={riskReviewStatuses}
        tasks={riskTasks}
        events={riskTaskEvents}
        onReviewStatus={onRiskReviewStatus}
        onCreateTask={onCreateRiskTask}
        onToggleTask={onToggleRiskTask}
        onUpdateTask={onUpdateRiskTask}
        onBulkUpdateTasks={onBulkUpdateRiskTasks}
        onAssignTask={onAssignRiskTask}
        onDeleteTask={onDeleteRiskTask}
        onSelectIssue={onSelectIssue}
        onInspectModule={onInspectModule}
        onAskCodara={onSendPrompt}
      />

      <section className="main-grid">
        <AssistantPanel
          messages={messages}
          onSendPrompt={onSendPrompt}
          assistantBusy={assistantBusy}
          onInspectModule={onInspectModule}
        />
        <ArchitecturePreview issues={issues} onSelectIssue={onSelectIssue} />
      </section>
    </section>
  );
}

function RiskReviewQueue({
  issues = [],
  reviewStatuses = {},
  tasks = [],
  events = [],
  onReviewStatus,
  onCreateTask,
  onToggleTask,
  onUpdateTask,
  onBulkUpdateTasks,
  onAssignTask,
  onDeleteTask,
  onSelectIssue,
  onInspectModule,
  onAskCodara,
}) {
  const orderedIssues = useMemo(() => [...issues].sort((a, b) => (
    severityRank(b.severity) - severityRank(a.severity)
  )), [issues]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const [draftNote, setDraftNote] = useState("");
  const filteredIssues = useMemo(() => orderedIssues.filter((issue) => {
    const status = reviewStatuses[issue.id]?.status || "open";
    const matchesStatus = statusFilter === "all" || status === statusFilter;
    const matchesSeverity = severityFilter === "all" || issue.severity === severityFilter;
    return matchesStatus && matchesSeverity;
  }), [orderedIssues, reviewStatuses, statusFilter, severityFilter]);
  const activeIssue = filteredIssues[activeIndex];
  const activeReview = activeIssue ? reviewStatuses[activeIssue.id] || { status: "open", note: "" } : { status: "open", note: "" };
  const reviewedCount = orderedIssues.filter((issue) => reviewStatuses[issue.id]?.status === "reviewed").length;
  const skippedCount = orderedIssues.filter((issue) => reviewStatuses[issue.id]?.status === "skipped").length;
  const openCount = orderedIssues.filter((issue) => !["reviewed", "skipped"].includes(reviewStatuses[issue.id]?.status)).length;
  const highestRemainingRisk = orderedIssues.find((issue) => !["reviewed", "skipped"].includes(reviewStatuses[issue.id]?.status));
  const activeStatus = activeReview.status || "open";
  const activeTaskExists = activeIssue ? tasks.some((task) => task.issueId === activeIssue.id) : false;
  const progress = orderedIssues.length ? Math.round((reviewedCount / orderedIssues.length) * 100) : 0;

  useEffect(() => {
    setActiveIndex(0);
  }, [orderedIssues.length, statusFilter, severityFilter]);

  useEffect(() => {
    setDraftNote(activeReview.note || "");
  }, [activeIssue?.id, activeReview.note]);

  function updateStatus(status) {
    if (!activeIssue) return;
    onReviewStatus(activeIssue.id, { status, note: draftNote.trim() });
    if (status !== "open") {
      setActiveIndex((current) => Math.min(current + 1, Math.max(filteredIssues.length - 1, 0)));
    }
  }

  function saveNote() {
    if (!activeIssue) return;
    onReviewStatus(activeIssue.id, { note: draftNote.trim() });
  }

  function move(delta) {
    setActiveIndex((current) => Math.min(Math.max(current + delta, 0), filteredIssues.length - 1));
  }

  function askCodaraAboutRisk() {
    if (!activeIssue) return;
    const files = (activeIssue.relatedFiles || []).join(", ") || "no related files listed";
    onAskCodara(
      `Review this architecture risk and suggest the next practical fix: ${activeIssue.title}. ` +
      `Severity: ${activeIssue.severity}. Detail: ${activeIssue.detail}. Related files: ${files}.`
    );
  }

  function createRiskTask() {
    if (!activeIssue) return;
    onCreateTask(activeIssue);
  }

  return (
    <section className="risk-review-queue" aria-label="Risk review queue">
      <div className="panel-header compact">
        <div>
          <p className="section-kicker">Risk workflow</p>
          <h2>Review queue</h2>
          <p>{orderedIssues.length ? `${reviewedCount}/${orderedIssues.length} reviewed, ${skippedCount} skipped.` : "Run analysis to generate a risk review queue."}</p>
        </div>
        <div className="queue-header-actions">
          <div className="queue-progress" aria-label={`${progress}% reviewed`}>
            <span style={{ width: `${progress}%` }}></span>
          </div>
          <button
            className="ghost-button"
            type="button"
            onClick={() => exportRiskReviewMarkdown(orderedIssues, reviewStatuses)}
            disabled={!orderedIssues.length}
          >
            Export report
          </button>
        </div>
      </div>
      <RiskReviewSummary
        openCount={openCount}
        reviewedCount={reviewedCount}
        skippedCount={skippedCount}
        highestRemainingRisk={highestRemainingRisk}
        onSelectIssue={onSelectIssue}
      />
      <RiskQueueFilters
        statusFilter={statusFilter}
        severityFilter={severityFilter}
        filteredCount={filteredIssues.length}
        totalCount={orderedIssues.length}
        onStatusFilter={setStatusFilter}
        onSeverityFilter={setSeverityFilter}
      />

      {activeIssue ? (
        <div className="queue-body">
          <div className={`queue-focus ${activeIssue.severity}`}>
            <span>{activeIssue.severity}</span>
            <h3>{activeIssue.title}</h3>
            <p>{activeIssue.detail}</p>
            <small className={`queue-status ${activeStatus}`}>
              {activeStatus}
            </small>
            <div className="queue-actions">
              <button className="primary-button" type="button" onClick={() => onSelectIssue(activeIssue)}>
                Open risk
              </button>
              <button className="ghost-button" type="button" onClick={askCodaraAboutRisk}>
                Ask Codara
              </button>
              <button className="ghost-button" type="button" onClick={createRiskTask} disabled={activeTaskExists}>
                {activeTaskExists ? "Task exists" : "Create task"}
              </button>
              <button className="ghost-button" type="button" onClick={() => updateStatus("reviewed")}>
                Mark reviewed
              </button>
              <button className="ghost-button" type="button" onClick={() => updateStatus("skipped")}>
                Skip
              </button>
              {activeStatus !== "open" && (
                <button className="ghost-button reopen-button" type="button" onClick={() => updateStatus("open")}>
                  Reset to open
                </button>
              )}
            </div>
          </div>
          <div className="queue-side">
            <div className="queue-controls">
              <button className="icon-button" type="button" aria-label="Previous risk" onClick={() => move(-1)} disabled={activeIndex === 0}>
                P
              </button>
              <strong>{activeIndex + 1} / {filteredIssues.length}</strong>
              <button className="icon-button" type="button" aria-label="Next risk" onClick={() => move(1)} disabled={activeIndex >= filteredIssues.length - 1}>
                N
              </button>
            </div>
            <label className="queue-note">
              <span>Review note</span>
              <textarea
                value={draftNote}
                onChange={(event) => setDraftNote(event.target.value)}
                placeholder="Why was this reviewed, skipped, or left open?"
                maxLength={500}
              />
              <button className="ghost-button" type="button" onClick={saveNote}>
                Save note
              </button>
            </label>
            <div className="detail-chip-list">
              {(activeIssue.relatedFiles || []).length ? activeIssue.relatedFiles.map((file) => (
                <button className="detail-action-chip" type="button" key={file} onClick={() => onInspectModule(file)}>
                  {shortPath(file)}
                </button>
              )) : <p>No related files were attached to this risk.</p>}
            </div>
          </div>
        </div>
      ) : (
        <p className="empty-state">
          {orderedIssues.length ? "No risk signals match these filters." : "No risk signals are available for this repository yet."}
        </p>
      )}
      <RiskTaskList
        tasks={tasks}
        events={events}
        onToggleTask={onToggleTask}
        onUpdateTask={onUpdateTask}
        onBulkUpdateTasks={onBulkUpdateTasks}
        onAssignTask={onAssignTask}
        onDeleteTask={onDeleteTask}
        onInspectModule={onInspectModule}
      />
    </section>
  );
}

function RiskTaskList({ tasks, events, onToggleTask, onUpdateTask, onBulkUpdateTasks, onAssignTask, onDeleteTask, onInspectModule }) {
  const [taskFilter, setTaskFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [sortMode, setSortMode] = useState("smart");
  const [groupMode, setGroupMode] = useState("owner");
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [bulkOwner, setBulkOwner] = useState("");
  const [bulkPriority, setBulkPriority] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkDueDate, setBulkDueDate] = useState("");
  const doneCount = tasks.filter((task) => task.status === "done").length;
  const blockedCount = tasks.filter((task) => task.status === "blocked").length;
  const highPriorityCount = tasks.filter((task) => task.priority === "high" && task.status !== "done").length;
  const dueSoonCount = tasks.filter((task) => getDueState(task.dueDate) === "due-soon" && task.status !== "done").length;
  const overdueCount = tasks.filter((task) => getDueState(task.dueDate) === "overdue" && task.status !== "done").length;
  const todoCount = tasks.length - doneCount;
  const highestTask = [...tasks].sort((a, b) => taskRank(b) - taskRank(a))[0];
  const ownerCounts = tasks.reduce((counts, task) => {
    counts[task.owner] = (counts[task.owner] || 0) + 1;
    return counts;
  }, {});
  const busiestOwner = Object.entries(ownerCounts).sort((a, b) => b[1] - a[1])[0];
  const filteredTasks = tasks.filter((task) => {
    const matchesStatus = taskFilter === "all" || task.status === taskFilter;
    const matchesOwner = ownerFilter === "all" || task.owner === ownerFilter;
    return matchesStatus && matchesOwner;
  });
  const sortedTasks = sortTasks(filteredTasks, sortMode);
  const taskGroups = groupTasks(sortedTasks, groupMode);
  const analytics = getTaskAnalytics(tasks);
  const visibleTaskIds = sortedTasks.map((task) => task.id);
  const allVisibleSelected = visibleTaskIds.length > 0 && visibleTaskIds.every((id) => selectedTaskIds.includes(id));

  function toggleTaskSelection(taskId) {
    setSelectedTaskIds((current) => (
      current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId]
    ));
  }

  function toggleVisibleSelection() {
    setSelectedTaskIds((current) => (
      allVisibleSelected
        ? current.filter((id) => !visibleTaskIds.includes(id))
        : Array.from(new Set([...current, ...visibleTaskIds]))
    ));
  }

  async function applyBulkUpdates() {
    const updates = {
      ...(bulkOwner ? { owner: bulkOwner } : {}),
      ...(bulkPriority ? { priority: bulkPriority } : {}),
      ...(bulkStatus ? { status: bulkStatus } : {}),
      ...(bulkDueDate ? { due_date: bulkDueDate } : {}),
    };
    if (!Object.keys(updates).length) return;
    await onBulkUpdateTasks(selectedTaskIds, updates);
    setSelectedTaskIds([]);
    setBulkOwner("");
    setBulkPriority("");
    setBulkStatus("");
    setBulkDueDate("");
  }

  return (
    <section className="risk-task-list" aria-label="Risk follow-up tasks">
      <div className="panel-header compact">
        <div>
          <p className="section-kicker">Follow-up tasks</p>
          <h2>Risk actions</h2>
          <p>{tasks.length ? `${tasks.length} task${tasks.length === 1 ? "" : "s"} created from review.` : "Create tasks from risks that need follow-up."}</p>
        </div>
        <div className="task-list-actions">
          <span>{doneCount}/{tasks.length} done</span>
          <div className="segmented-control">
            {["all", ...taskStatuses].map((status) => (
              <button
                className={taskFilter === status ? "active" : ""}
                type="button"
                key={status}
                onClick={() => setTaskFilter(status)}
              >
                {status}
              </button>
            ))}
          </div>
          <select
            className="owner-filter"
            value={ownerFilter}
            onChange={(event) => setOwnerFilter(event.target.value)}
            aria-label="Filter tasks by owner"
          >
            <option value="all">All owners</option>
            {taskOwners.map((owner) => (
              <option value={owner} key={owner}>{owner}</option>
            ))}
          </select>
          <select
            className="owner-filter"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value)}
            aria-label="Sort risk tasks"
          >
            <option value="smart">Smart sort</option>
            <option value="priority">Priority</option>
            <option value="due">Due date</option>
            <option value="status">Status</option>
          </select>
          <select
            className="owner-filter"
            value={groupMode}
            onChange={(event) => setGroupMode(event.target.value)}
            aria-label="Group risk tasks"
          >
            <option value="owner">Group by owner</option>
            <option value="status">Group by status</option>
            <option value="priority">Group by priority</option>
            <option value="none">No grouping</option>
          </select>
          <button className="ghost-button" type="button" onClick={() => exportRiskTasksMarkdown(tasks)} disabled={!tasks.length}>
            Export tasks
          </button>
        </div>
      </div>
      <div className="task-summary" aria-label="Risk task summary">
        <div>
          <span>Total</span>
          <strong>{tasks.length}</strong>
        </div>
        <div>
          <span>Todo</span>
          <strong>{todoCount}</strong>
        </div>
        <div>
          <span>Done</span>
          <strong>{doneCount}</strong>
        </div>
        <div>
          <span>Blocked</span>
          <strong>{blockedCount}</strong>
        </div>
        <div>
          <span>Due soon</span>
          <strong>{dueSoonCount}</strong>
        </div>
        <div>
          <span>Overdue</span>
          <strong>{overdueCount}</strong>
        </div>
        <div>
          <span>Top owner</span>
          <strong>{busiestOwner ? `${busiestOwner[0]} (${busiestOwner[1]})` : "None"}</strong>
        </div>
        <button
          className={`task-summary-hotspot ${highestTask?.severity || "clear"}`}
          type="button"
          onClick={() => highestTask?.files?.[0] && onInspectModule(highestTask.files[0])}
          disabled={!highestTask?.files?.length}
        >
          <span>Highest task</span>
          <strong>{highestTask ? highestTask.title : "Clear"}</strong>
        </button>
      </div>
      <div className="execution-summary" aria-label="Risk execution summary">
        <span>{blockedCount} blocked</span>
        <span>{highPriorityCount} high priority</span>
        <span>{dueSoonCount} due soon</span>
        <span>{overdueCount} overdue</span>
      </div>
      <TaskAnalyticsPanel analytics={analytics} />
      <TaskActivityFeed events={events} />
      <div className="bulk-task-toolbar" aria-label="Bulk task actions">
        <button className="ghost-button" type="button" onClick={toggleVisibleSelection} disabled={!visibleTaskIds.length}>
          {allVisibleSelected ? "Clear visible" : "Select visible"}
        </button>
        <span>{selectedTaskIds.length} selected</span>
        <select value={bulkOwner} onChange={(event) => setBulkOwner(event.target.value)} aria-label="Bulk assign owner">
          <option value="">Owner</option>
          {taskOwners.map((owner) => <option value={owner} key={owner}>{owner}</option>)}
        </select>
        <select value={bulkPriority} onChange={(event) => setBulkPriority(event.target.value)} aria-label="Bulk set priority">
          <option value="">Priority</option>
          {taskPriorities.map((priority) => <option value={priority} key={priority}>{priority}</option>)}
        </select>
        <select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)} aria-label="Bulk set status">
          <option value="">Status</option>
          {taskStatuses.map((status) => <option value={status} key={status}>{status}</option>)}
        </select>
        <input
          type="date"
          value={bulkDueDate}
          onChange={(event) => setBulkDueDate(event.target.value)}
          aria-label="Bulk set due date"
        />
        <button className="primary-button" type="button" onClick={applyBulkUpdates} disabled={!selectedTaskIds.length}>
          Apply bulk
        </button>
      </div>
      {sortedTasks.length ? (
        <div className="task-group-list">
          {taskGroups.map((group) => (
            <section className="task-group" key={group.label}>
              <div className="task-group-header">
                <h3>{group.label}</h3>
                <span>{group.tasks.length} task{group.tasks.length === 1 ? "" : "s"}</span>
              </div>
              <div className="task-card-list">
                {group.tasks.map((task) => (
            <article className={`risk-task ${task.status} ${task.severity} priority-${task.priority} due-${getDueState(task.dueDate)}`} key={task.id}>
              <div className="task-select-column">
                <input
                  type="checkbox"
                  checked={selectedTaskIds.includes(task.id)}
                  onChange={() => toggleTaskSelection(task.id)}
                  aria-label={`Select ${task.title}`}
                />
                <button className="task-check" type="button" onClick={() => onToggleTask(task)} aria-label="Toggle task status">
                  {task.status === "done" ? "OK" : ""}
                </button>
              </div>
              <div>
                <strong>{task.title}</strong>
                <span>{task.severity} risk / {task.priority} priority / {task.status}</span>
                <div className="task-badge-row">
                  <span className={`task-due-badge ${getDueState(task.dueDate)}`}>
                    {formatDueLabel(task.dueDate)}
                  </span>
                  {task.status === "blocked" && <span className="task-due-badge blocked">Blocked</span>}
                  {task.priority === "high" && <span className="task-due-badge high">High priority</span>}
                </div>
                <div className="task-field-grid">
                  <label className="task-control">
                    <span>Status</span>
                    <select
                      value={task.status}
                      onChange={(event) => onUpdateTask(task, { status: event.target.value }, `Task marked ${event.target.value}.`)}
                      aria-label={`Set status for ${task.title}`}
                    >
                      {taskStatuses.map((status) => (
                        <option value={status} key={status}>{status}</option>
                      ))}
                    </select>
                  </label>
                  <label className="task-control">
                    <span>Priority</span>
                    <select
                      value={task.priority}
                      onChange={(event) => onUpdateTask(task, { priority: event.target.value }, `Task priority set to ${event.target.value}.`)}
                      aria-label={`Set priority for ${task.title}`}
                    >
                      {taskPriorities.map((priority) => (
                        <option value={priority} key={priority}>{priority}</option>
                      ))}
                    </select>
                  </label>
                  <label className="task-control">
                    <span>Owner</span>
                    <select
                      value={task.owner}
                      onChange={(event) => onAssignTask(task, event.target.value)}
                      aria-label={`Assign ${task.title}`}
                    >
                      {taskOwners.map((owner) => (
                        <option value={owner} key={owner}>{owner}</option>
                      ))}
                    </select>
                  </label>
                  <label className="task-control">
                    <span>Due</span>
                    <input
                      type="date"
                      value={task.dueDate || ""}
                      onChange={(event) => onUpdateTask(task, { due_date: event.target.value }, "Task due date updated.")}
                      aria-label={`Set due date for ${task.title}`}
                    />
                  </label>
                </div>
                <TaskNoteEditor task={task} onUpdateTask={onUpdateTask} />
                <div className="detail-chip-list">
                  {task.files.slice(0, 3).map((file) => (
                    <button className="detail-action-chip" type="button" key={file} onClick={() => onInspectModule(file)}>
                      {shortPath(file)}
                    </button>
                  ))}
                </div>
                <button className="task-remove" type="button" onClick={() => onDeleteTask(task)}>
                  Remove task
                </button>
              </div>
            </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <p className="empty-state">
          {tasks.length ? "No tasks match this filter." : "No follow-up tasks have been created yet."}
        </p>
      )}
    </section>
  );
}

function TaskAnalyticsPanel({ analytics }) {
  return (
    <section className="task-analytics-panel" aria-label="Risk task analytics">
      <div className="analytics-header">
        <div>
          <p className="section-kicker">Execution health</p>
          <h3>{analytics.healthLabel}</h3>
        </div>
        <strong>{analytics.completionRate}%</strong>
      </div>
      <div className="analytics-meter" aria-label={`${analytics.completionRate}% complete`}>
        <span style={{ width: `${analytics.completionRate}%` }}></span>
      </div>
      <div className="analytics-grid">
        <div>
          <span>Resolved this week</span>
          <strong>{analytics.resolvedThisWeek}</strong>
        </div>
        <div>
          <span>Blocked load</span>
          <strong>{analytics.blockedRate}%</strong>
        </div>
        <div>
          <span>High remaining</span>
          <strong>{analytics.highRemaining}</strong>
        </div>
        <div>
          <span>Due pressure</span>
          <strong>{analytics.duePressure}</strong>
        </div>
      </div>
      <div className="owner-load-list">
        {analytics.ownerLoads.length ? analytics.ownerLoads.map((owner) => (
          <div className="owner-load" key={owner.owner}>
            <div>
              <strong>{owner.owner}</strong>
              <span>{owner.total} total / {owner.blocked} blocked</span>
            </div>
            <div className="owner-load-bar" aria-label={`${owner.owner} load`}>
              <span style={{ width: `${owner.share}%` }}></span>
            </div>
          </div>
        )) : (
          <p>No owner load to show yet.</p>
        )}
      </div>
    </section>
  );
}

function TaskActivityFeed({ events = [] }) {
  return (
    <section className="task-activity-feed" aria-label="Risk task activity">
      <div className="activity-feed-header">
        <div>
          <p className="section-kicker">Activity history</p>
          <h3>Recent task changes</h3>
        </div>
        <span>{events.length} event{events.length === 1 ? "" : "s"}</span>
      </div>
      <div className="activity-list">
        {events.length ? events.slice(0, 8).map((event) => (
          <article className={`activity-event ${event.eventType}`} key={event.id}>
            <span className="activity-dot"></span>
            <div>
              <strong>{event.message}</strong>
              <p>{event.taskTitle}</p>
              <small>{formatTimestamp(event.timestamp)}</small>
            </div>
          </article>
        )) : (
          <p>No task changes have been recorded yet.</p>
        )}
      </div>
    </section>
  );
}

function TaskNoteEditor({ task, onUpdateTask }) {
  const [draft, setDraft] = useState(task.note || "");

  useEffect(() => {
    setDraft(task.note || "");
  }, [task.id, task.note]);

  function saveNote() {
    if ((task.note || "") === draft.trim()) return;
    onUpdateTask(task, { note: draft.trim() }, "Task note saved.");
  }

  return (
    <label className="task-note-editor">
      <span>Note</span>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={saveNote}
        placeholder="Add execution detail, blocker, or handoff context."
        maxLength={500}
      />
    </label>
  );
}

function exportRiskTasksMarkdown(tasks) {
  const doneCount = tasks.filter((task) => task.status === "done").length;
  const blockedCount = tasks.filter((task) => task.status === "blocked").length;
  const lines = [
    "# Codara Risk Action Plan",
    "",
    `Generated: ${new Date().toLocaleString()}`,
    "",
    "## Summary",
    "",
    `- Total tasks: ${tasks.length}`,
    `- Done: ${doneCount}`,
    `- Todo: ${tasks.length - doneCount}`,
    `- Blocked: ${blockedCount}`,
    "",
    "## Tasks",
    "",
    ...tasks.flatMap((task, index) => [
      `${index + 1}. ${task.title}`,
      `   - Status: ${task.status}`,
      `   - Severity: ${task.severity}`,
      `   - Priority: ${task.priority}`,
      `   - Owner: ${task.owner || "Unassigned"}`,
      `   - Due date: ${task.dueDate || "Not set"}`,
      `   - Note: ${task.note || "None"}`,
      `   - Related files: ${(task.files || []).join(", ") || "None"}`,
    ]),
    "",
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "codara-risk-action-plan.md";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function RiskQueueFilters({
  statusFilter,
  severityFilter,
  filteredCount,
  totalCount,
  onStatusFilter,
  onSeverityFilter,
}) {
  return (
    <div className="risk-queue-filters" aria-label="Risk queue filters">
      <div className="segmented-control">
        {["all", "open", "reviewed", "skipped"].map((status) => (
          <button
            className={statusFilter === status ? "active" : ""}
            type="button"
            key={status}
            onClick={() => onStatusFilter(status)}
          >
            {status}
          </button>
        ))}
      </div>
      <div className="segmented-control">
        {["all", "high", "medium", "low"].map((severity) => (
          <button
            className={severityFilter === severity ? "active" : ""}
            type="button"
            key={severity}
            onClick={() => onSeverityFilter(severity)}
          >
            {severity}
          </button>
        ))}
      </div>
      <span>{filteredCount} of {totalCount} shown</span>
    </div>
  );
}

function RiskReviewSummary({ openCount, reviewedCount, skippedCount, highestRemainingRisk, onSelectIssue }) {
  return (
    <div className="risk-review-summary" aria-label="Risk review summary">
      <div>
        <span>Open</span>
        <strong>{openCount}</strong>
      </div>
      <div>
        <span>Reviewed</span>
        <strong>{reviewedCount}</strong>
      </div>
      <div>
        <span>Skipped</span>
        <strong>{skippedCount}</strong>
      </div>
      <button
        className={`highest-risk ${highestRemainingRisk?.severity || "clear"}`}
        type="button"
        onClick={() => highestRemainingRisk && onSelectIssue(highestRemainingRisk)}
        disabled={!highestRemainingRisk}
      >
        <span>Highest remaining</span>
        <strong>{highestRemainingRisk ? highestRemainingRisk.title : "Clear"}</strong>
      </button>
    </div>
  );
}

function exportRiskReviewMarkdown(issues, reviewStatuses) {
  const reviewedCount = issues.filter((issue) => reviewStatuses[issue.id]?.status === "reviewed").length;
  const skippedCount = issues.filter((issue) => reviewStatuses[issue.id]?.status === "skipped").length;
  const openCount = issues.length - reviewedCount - skippedCount;
  const lines = [
    "# Codara Risk Review Report",
    "",
    `Generated: ${new Date().toLocaleString()}`,
    "",
    "## Summary",
    "",
    `- Open: ${openCount}`,
    `- Reviewed: ${reviewedCount}`,
    `- Skipped: ${skippedCount}`,
    `- Total risks: ${issues.length}`,
    "",
    "## Risks",
    "",
    ...issues.flatMap((issue, index) => {
      const review = reviewStatuses[issue.id] || { status: "open", note: "" };
      return [
        `${index + 1}. ${issue.title}`,
        `   - Severity: ${issue.severity}`,
        `   - Type: ${issue.type}`,
        `   - Status: ${review.status}`,
        `   - Detail: ${issue.detail}`,
        `   - Related files: ${(issue.relatedFiles || []).join(", ") || "None"}`,
        `   - Note: ${review.note || "None"}`,
      ];
    }),
    "",
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "codara-risk-review-report.md";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function severityRank(severity) {
  return { high: 3, medium: 2, low: 1 }[severity] || 0;
}

function taskRank(task) {
  const blockedBonus = task.status === "blocked" ? 4 : 0;
  return severityRank(task.severity) + severityRank(task.priority) + blockedBonus;
}

function getTaskAnalytics(tasks) {
  const activeTasks = tasks.filter((task) => task.status !== "done");
  const doneCount = tasks.filter((task) => task.status === "done").length;
  const blockedCount = tasks.filter((task) => task.status === "blocked").length;
  const highRemaining = activeTasks.filter((task) => task.priority === "high").length;
  const duePressureCount = activeTasks.filter((task) => ["overdue", "due-soon"].includes(getDueState(task.dueDate))).length;
  const completionRate = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  const blockedRate = tasks.length ? Math.round((blockedCount / tasks.length) * 100) : 0;
  const weekStart = Date.now() - (7 * 86400000);
  const resolvedThisWeek = tasks.filter((task) => (
    task.status === "done" && task.updatedAt && new Date(task.updatedAt).getTime() >= weekStart
  )).length;
  const ownerLoads = Object.values(tasks.reduce((owners, task) => {
    const owner = task.owner || "Unassigned";
    if (!owners[owner]) owners[owner] = { owner, total: 0, blocked: 0 };
    owners[owner].total += 1;
    if (task.status === "blocked") owners[owner].blocked += 1;
    return owners;
  }, {}))
    .sort((a, b) => b.total - a.total || b.blocked - a.blocked)
    .map((owner) => ({
      ...owner,
      share: tasks.length ? Math.max(6, Math.round((owner.total / tasks.length) * 100)) : 0,
    }));
  const healthLabel = !tasks.length
    ? "No execution data yet"
    : blockedRate >= 35 || duePressureCount >= 3
      ? "Execution needs attention"
      : completionRate >= 70
        ? "Execution moving well"
        : "Execution in progress";

  return {
    completionRate,
    blockedRate,
    resolvedThisWeek,
    highRemaining,
    duePressure: duePressureCount ? `${duePressureCount} task${duePressureCount === 1 ? "" : "s"}` : "Clear",
    ownerLoads,
    healthLabel,
  };
}

function sortTasks(tasks, sortMode) {
  const byDue = (task) => task.dueDate ? new Date(`${task.dueDate}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
  const byStatus = (task) => ({ blocked: 0, todo: 1, done: 2 }[task.status] ?? 3);
  const bySmart = (task) => {
    const dueState = getDueState(task.dueDate);
    const dueBonus = dueState === "overdue" ? 8 : dueState === "due-soon" ? 4 : 0;
    const donePenalty = task.status === "done" ? -12 : 0;
    return taskRank(task) + dueBonus + donePenalty;
  };

  return [...tasks].sort((a, b) => {
    if (sortMode === "priority") return severityRank(b.priority) - severityRank(a.priority) || byDue(a) - byDue(b);
    if (sortMode === "due") return byDue(a) - byDue(b) || taskRank(b) - taskRank(a);
    if (sortMode === "status") return byStatus(a) - byStatus(b) || taskRank(b) - taskRank(a);
    return bySmart(b) - bySmart(a) || byDue(a) - byDue(b);
  });
}

function groupTasks(tasks, groupMode) {
  if (groupMode === "none") return [{ label: "All tasks", tasks }];

  const order = {
    owner: taskOwners,
    status: taskStatuses,
    priority: [...taskPriorities].reverse(),
  }[groupMode] || [];

  const groups = tasks.reduce((items, task) => {
    const label = groupMode === "owner" ? task.owner : task[groupMode];
    if (!items[label]) items[label] = [];
    items[label].push(task);
    return items;
  }, {});

  return Object.entries(groups)
    .sort(([a], [b]) => {
      const aIndex = order.indexOf(a);
      const bIndex = order.indexOf(b);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    })
    .map(([label, groupedTasks]) => ({ label, tasks: groupedTasks }));
}

function getDueState(dueDate) {
  if (!dueDate) return "none";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T00:00:00`);
  const daysUntilDue = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue <= 3) return "due-soon";
  return "scheduled";
}

function formatDueLabel(dueDate) {
  if (!dueDate) return "No due date";
  const state = getDueState(dueDate);
  const formatted = new Date(`${dueDate}T00:00:00`).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
  if (state === "overdue") return `Overdue ${formatted}`;
  if (state === "due-soon") return `Due soon ${formatted}`;
  return `Due ${formatted}`;
}

function CodeSearchPanel({ results, status, onSearch, onInspectModule }) {
  const [query, setQuery] = useState("");

  function submitSearch(event) {
    event.preventDefault();
    onSearch(query);
  }

  return (
    <section className="code-search-panel" aria-label="Code search">
      <form className="code-search-form" onSubmit={submitSearch}>
        <div>
          <p className="section-kicker">Code search</p>
          <h2>Find architecture context</h2>
          <p>{status}</p>
        </div>
        <div className="code-search-controls">
          <input
            type="search"
            placeholder="Search modules, functions, classes, imports..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button className="primary-button" type="submit">Search</button>
        </div>
      </form>
      {results.length > 0 && (
        <div className="search-results">
          {results.map((result) => (
            <button
              className="search-result"
              type="button"
              key={`${result.module_name}-${result.matched_text}`}
              onClick={() => onInspectModule(result.module_name)}
            >
              <div>
                <strong>{result.module_name}</strong>
                <span>{result.path}</span>
              </div>
              <div className="search-result-meta">
                <span>{result.match_type}</span>
                <span>{result.matched_text}</span>
                <strong>{result.score}</strong>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function AssistantPanel({ messages, onSendPrompt, assistantBusy, onInspectModule }) {
  const [prompt, setPrompt] = useState("");
  const suggestions = [
    "Summarize the architecture",
    "What are the main risks?",
    "Show dependency hotspots",
    "How should a new developer onboard?",
  ];

  function submitPrompt(event) {
    event.preventDefault();
    const nextPrompt = prompt.trim();
    if (!nextPrompt || assistantBusy) return;
    onSendPrompt(nextPrompt);
    setPrompt("");
  }

  return (
    <section className="assistant-panel" aria-label="Codara assistant">
      <div className="panel-header">
        <div>
          <h2>Ask Codara</h2>
          <p>Query the repo using architecture context.</p>
        </div>
        <span className="mode-pill">Context aware</span>
      </div>
      <div className="conversation">
        {messages.map((message) => (
          <div className={`message ${message.role} ${message.pending ? "pending" : ""}`} key={message.id}>
            <p className="message-name">{message.role === "user" ? "You" : "Codara"}</p>
            <p>{message.body}</p>
            {message.pending && (
              <div className="thinking-dots" aria-label="Codara is thinking">
                <span></span>
                <span></span>
                <span></span>
              </div>
            )}
            {message.role === "assistant" && (
              <>
                {!message.pending && (
                  <AnswerEvidence confidence={message.confidence} />
                )}
                <CitationStrip
                  citedFiles={message.citedFiles}
                  relatedNodes={message.relatedNodes}
                  onInspectModule={onInspectModule}
                />
              </>
            )}
          </div>
        ))}
      </div>
      <div className="suggestion-row" aria-label="Suggested questions">
        {suggestions.map((suggestion) => (
          <button
            type="button"
            key={suggestion}
            onClick={() => onSendPrompt(suggestion)}
            disabled={assistantBusy}
          >
            {suggestion}
          </button>
        ))}
      </div>
      <form className="prompt-bar" onSubmit={submitPrompt}>
        <input
          aria-label="Ask Codara"
          placeholder="Ask about modules, risks, flows, or refactoring..."
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          disabled={assistantBusy}
        />
        <button type="submit" aria-label="Send prompt" disabled={assistantBusy}>
          {assistantBusy ? "Wait" : "Send"}
        </button>
      </form>
    </section>
  );
}

function AnswerEvidence({ confidence }) {
  const evidence = confidence || { label: "Limited context", level: "limited", detail: "0 sources" };

  return (
    <div className={`answer-evidence ${evidence.level}`}>
      <span>{evidence.label}</span>
      <strong>{evidence.detail}</strong>
    </div>
  );
}

function CitationStrip({ citedFiles = [], relatedNodes = [], onInspectModule }) {
  const hasCitations = citedFiles.length || relatedNodes.length;
  if (!hasCitations) return null;

  return (
    <div className="citation-strip" aria-label="Answer citations">
      {citedFiles.slice(0, 4).map((file) => (
        <button
          className="citation-chip file"
          type="button"
          key={`file-${file}`}
          onClick={() => onInspectModule(file)}
        >
          {shortPath(file)}
        </button>
      ))}
      {relatedNodes.slice(0, 3).map((node) => (
        <button
          className="citation-chip node"
          type="button"
          key={`node-${node}`}
          onClick={() => onInspectModule(node)}
        >
          {shortName(node)}
        </button>
      ))}
    </div>
  );
}

function shortPath(filePath) {
  return filePath.split(/[\\/]/).slice(-2).join("/");
}

function ArchitecturePreview({ issues, onSelectIssue }) {
  return (
    <aside className="insights-panel" aria-label="Architecture insights">
      <div className="panel-header compact">
        <div>
          <h2>Architecture map</h2>
          <p>Critical path preview</p>
        </div>
      </div>
      <div className="flow-map" aria-label="Repository architecture flow">
        {mockData.flow.map((item) => (
          <React.Fragment key={item.label}>
            <div className={`node ${item.kind}`}>{item.label}</div>
            {item.connector && <div className={`connector ${item.connector}`}></div>}
          </React.Fragment>
        ))}
      </div>
      <IssueList issues={issues} onSelectIssue={onSelectIssue} />
    </aside>
  );
}

function IssueList({ issues, onSelectIssue }) {
  return (
    <div className="issue-list">
      {issues.map((issue) => (
        <button
          className={`issue-item ${issue.severity}`}
          type="button"
          key={issue.title}
          onClick={() => onSelectIssue?.(issue)}
        >
          <span></span>
          <div>
            <p>{issue.title}</p>
            <small>{issue.detail}</small>
          </div>
        </button>
      ))}
    </div>
  );
}

function Repositories({
  repositories,
  analyzerResult,
  timeline,
  intelligence,
  currentRepository,
  onConnectGitHub,
  onUploadRepository,
  onSelectRepository,
  onInspectModule,
  onNavigate,
}) {
  const [isGithubOpen, setIsGithubOpen] = useState(false);
  const [repoQuery, setRepoQuery] = useState("");
  const [repoFilter, setRepoFilter] = useState("all");
  const normalizedQuery = repoQuery.trim().toLowerCase();
  const filteredRepositories = repositories.filter((repo) => {
    const matchesQuery = [repo.name, repo.description, repo.language, repo.status]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedQuery));
    const matchesFilter =
      repoFilter === "all" ||
      (repoFilter === "ready" && repo.status === "Ready") ||
      (repoFilter === "review" && repo.status !== "Ready");
    return matchesQuery && matchesFilter;
  });

  return (
    <section className="view active">
      <section className="repo-workbench">
        <div className="upload-zone">
          <div>
            <p className="section-kicker">Repository intake</p>
            <h2>Connect or upload a codebase</h2>
            <p>Start analysis from GitHub, a local ZIP, or a mounted project folder.</p>
          </div>
          <div className="upload-actions">
            <button className="primary-button" type="button" onClick={() => setIsGithubOpen(true)}>
              Connect GitHub
            </button>
            <label className="file-upload-button">
              Upload ZIP
              <input
                type="file"
                accept=".zip,application/zip"
                onChange={(event) => onUploadRepository(event.target.files?.[0])}
              />
            </label>
          </div>
        </div>
        <RepositoryToolbar
          query={repoQuery}
          filter={repoFilter}
          onQueryChange={setRepoQuery}
          onFilterChange={setRepoFilter}
        />
        <div className="repo-list">
          {filteredRepositories.map((repo) => (
            <RepositoryRow repo={repo} key={repo.id || repo.name} onSelectRepository={onSelectRepository} />
          ))}
          {!filteredRepositories.length && (
            <div className="empty-state">
              No repositories match this search.
            </div>
          )}
        </div>
        <RepositoryIntelligenceCard
          intelligence={intelligence}
          currentRepository={currentRepository}
          onInspectModule={onInspectModule}
          onNavigate={onNavigate}
        />
        <RepositoryTimeline timeline={timeline} currentRepository={currentRepository} />
        <ModuleExplorer analyzerResult={analyzerResult} onInspectModule={onInspectModule} />
      </section>
      {isGithubOpen && (
        <GitHubConnectDrawer
          onConnect={async (payload) => {
            await onConnectGitHub(payload);
            setIsGithubOpen(false);
          }}
          onClose={() => setIsGithubOpen(false)}
        />
      )}
    </section>
  );
}

function RepositoryIntelligenceCard({ intelligence, currentRepository, onInspectModule, onNavigate }) {
  const score = intelligence?.healthScore ?? 0;
  const scoreStyle = { "--score": `${score}%` };
  const scoreClass = score >= 86 ? "strong" : score >= 70 ? "stable" : score >= 45 ? "review" : "blocked";
  const actionTarget = actionTargetForRecommendation(intelligence?.nextAction || "");

  return (
    <section className={`repository-intelligence ${scoreClass}`} aria-label="Repository intelligence summary">
      <div className="intelligence-score" style={scoreStyle}>
        <span>{score}</span>
        <small>{intelligence?.healthLabel || "Blocked"}</small>
      </div>
      <div className="intelligence-main">
        <p className="section-kicker">Repository intelligence</p>
        <h2>{currentRepository?.name || "Selected repository"}</h2>
        <p>{intelligence?.rationale || "Run analysis to let Codara generate architecture health signals."}</p>
      </div>
      <div className="intelligence-facts">
        <div>
          <span>Modules</span>
          <strong>{intelligence?.modulesMapped ?? 0}</strong>
        </div>
        <div>
          <span>Risks</span>
          <strong>{intelligence?.riskSignals ?? 0}</strong>
        </div>
        <button
          className="intelligence-fact-button"
          type="button"
          onClick={() => intelligence?.topHotspot && onInspectModule(intelligence.topHotspot)}
          disabled={!intelligence?.topHotspot}
        >
          <span>Hotspot</span>
          <strong>{intelligence?.topHotspot ? shortName(intelligence.topHotspot) : "None"}</strong>
        </button>
      </div>
      <button
        className="intelligence-action"
        type="button"
        onClick={() => onNavigate(actionTarget)}
      >
        <span>Next action</span>
        <strong>{intelligence?.nextAction || "Run the first architecture analysis."}</strong>
      </button>
    </section>
  );
}

function actionTargetForRecommendation(action) {
  const normalized = action.toLowerCase();
  if (normalized.includes("diagram") || normalized.includes("dependency")) {
    return "diagrams";
  }
  if (normalized.includes("upload") || normalized.includes("analysis")) {
    return "repositories";
  }
  return "workspace";
}

function RepositoryTimeline({ timeline = [], currentRepository }) {
  const completedCount = timeline.filter((event) => event.status === "done").length;
  const statusCopy = currentRepository
    ? `${completedCount}/${timeline.length || 0} workflow steps ready for ${currentRepository.name}.`
    : "Select a repository to review the Codara workflow.";

  return (
    <section className="repository-timeline" aria-label="Repository workflow timeline">
      <div className="panel-header compact">
        <div>
          <h2>Analysis timeline</h2>
          <p>{statusCopy}</p>
        </div>
        <span className="mode-pill">{currentRepository?.status || "Review"}</span>
      </div>
      <div className="timeline-list">
        {timeline.length ? timeline.map((event) => (
          <article className={`timeline-event ${event.status}`} key={event.id}>
            <span className="timeline-dot"></span>
            <div>
              <div className="timeline-event-head">
                <strong>{event.title}</strong>
                <span>{event.status}</span>
              </div>
              <p>{event.detail}</p>
              <div className="timeline-meta">
                {event.artifact && <span>{event.artifact}</span>}
                {event.timestamp && <span>{formatTimestamp(event.timestamp)}</span>}
              </div>
            </div>
          </article>
        )) : (
          <p className="empty-state">Timeline will appear after Codara can reach the backend.</p>
        )}
      </div>
    </section>
  );
}

function GitHubConnectDrawer({ onConnect, onClose }) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [branch, setBranch] = useState("");

  function inferredName() {
    const cleaned = url.trim().replace(/\.git$/, "");
    const parts = cleaned.split("/").filter(Boolean);
    return parts.slice(-1)[0] || "github-repository";
  }

  function submit(event) {
    event.preventDefault();
    const nextUrl = url.trim();
    if (!nextUrl) return;
    onConnect({
      url: nextUrl,
      name: name.trim() || inferredName(),
      branch: branch.trim() || undefined,
    });
  }

  return (
    <aside className="github-drawer" aria-label="Connect GitHub repository">
      <div className="module-drawer-header">
        <div>
          <p className="section-kicker">GitHub intake</p>
          <h2>Connect repository</h2>
          <p>Fetch a public GitHub repository and run Codara analysis immediately.</p>
        </div>
        <button className="icon-button" type="button" aria-label="Close GitHub intake" onClick={onClose}>
          X
        </button>
      </div>

      <form className="github-form" onSubmit={submit}>
        <label>
          <span>Repository URL</span>
          <input
            type="url"
            placeholder="https://github.com/org/repository"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
        </label>
        <label>
          <span>Display name</span>
          <input
            type="text"
            placeholder={inferredName()}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          <span>Branch optional</span>
          <input
            type="text"
            placeholder="main"
            value={branch}
            onChange={(event) => setBranch(event.target.value)}
          />
        </label>
        <div className="github-note">
          Public repositories are downloaded as GitHub ZIP archives. Private repo auth and branch browsing come later.
        </div>
        <button className="primary-button" type="submit">
          Fetch and analyze
        </button>
      </form>
    </aside>
  );
}

function ModuleExplorer({ analyzerResult, onInspectModule }) {
  const [moduleQuery, setModuleQuery] = useState("");
  const modules = analyzerResult?.modules || [];
  const normalizedQuery = moduleQuery.trim().toLowerCase();
  const filteredModules = modules.filter((module) => {
    if (!normalizedQuery) return true;
    return [module.module_name, module.path, ...module.functions, ...module.classes]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedQuery));
  });

  return (
    <section className="module-explorer">
      <div className="panel-header compact">
        <div>
          <h2>Extracted modules</h2>
          <p>
            {analyzerResult
              ? `${analyzerResult.files_scanned} code files scanned from the live analyzer.`
              : "Analyzer module data will appear here when the backend is available."}
          </p>
        </div>
        <span className="mode-pill">{filteredModules.length} modules</span>
      </div>
      <label className="search-box module-search">
        <span>Module search</span>
        <input
          type="search"
          placeholder="Filter modules, files, functions, classes..."
          value={moduleQuery}
          onChange={(event) => setModuleQuery(event.target.value)}
        />
      </label>
      <div className="module-list">
        {filteredModules.slice(0, 8).map((module) => (
          <button
            className="module-row"
            type="button"
            key={module.module_name}
            onClick={() => onInspectModule(module)}
          >
            <div>
              <h3>{module.module_name}</h3>
              <p>{module.path}</p>
            </div>
            <div className="repo-stats">
              <span>{module.functions.length} functions</span>
              <span>{module.classes.length} classes</span>
              <strong className={module.dependency_count > 1 ? "warn" : "good"}>
                {module.dependency_count} deps
              </strong>
            </div>
          </button>
        ))}
        {!filteredModules.length && (
          <div className="empty-state">
            No modules match this search.
          </div>
        )}
      </div>
    </section>
  );
}

function RepositoryToolbar({ query, filter, onQueryChange, onFilterChange }) {
  const filters = [
    ["all", "All"],
    ["ready", "Ready"],
    ["review", "Needs review"],
  ];

  return (
    <div className="repo-toolbar">
      <label className="search-box">
        <span>Search</span>
        <input
          type="search"
          placeholder="Filter repositories..."
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>
      <div className="segmented-control" aria-label="Repository filter">
        {filters.map(([value, label]) => (
          <button
            className={filter === value ? "active" : ""}
            type="button"
            key={value}
            onClick={() => onFilterChange(value)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function RepositoryRow({ repo, onSelectRepository }) {
  return (
    <button
      className={`repo-row ${repo.selected ? "selected" : ""}`}
      type="button"
      onClick={() => onSelectRepository(repo)}
      aria-pressed={repo.selected}
    >
      <div>
        <h3>{repo.name}</h3>
        <p>{repo.description}</p>
      </div>
      <div className="repo-stats">
        <span>{repo.files} files</span>
        <span>{repo.modules} modules</span>
        <strong className={repo.status === "Ready" ? "good" : "warn"}>{repo.status}</strong>
      </div>
    </button>
  );
}

function ModuleDetailDrawer({ module, dependencies, circularDependencies, onClose }) {
  const incoming = dependencies.filter((dependency) => dependency.target === module.module_name);
  const outgoing = dependencies.filter((dependency) => dependency.source === module.module_name);
  const circular = circularDependencies.filter((cycle) => cycle.includes(module.module_name));

  return (
    <aside className="module-drawer" aria-label="Module detail">
      <div className="module-drawer-header">
        <div>
          <p className="section-kicker">Module detail</p>
          <h2>{module.module_name}</h2>
          <p>{module.path}</p>
        </div>
        <button className="icon-button" type="button" aria-label="Close module detail" onClick={onClose}>
          X
        </button>
      </div>

      <div className="module-detail-grid">
        <MetricCard label="Functions" value={String(module.functions.length)} detail="Defined in module" />
        <MetricCard label="Classes" value={String(module.classes.length)} detail="Defined in module" />
        <MetricCard label="Dependencies" value={String(module.dependency_count)} detail="Internal imports" />
      </div>

      <ModuleDetailSection title="Functions" items={module.functions} empty="No functions detected." />
      <ModuleDetailSection title="Classes" items={module.classes} empty="No classes detected." />
      <ModuleDetailSection title="Imports" items={module.imports} empty="No imports detected." />

      <section className="module-detail-section">
        <h3>Dependency flow</h3>
        <div className="dependency-flow">
          <div>
            <strong>{incoming.length}</strong>
            <span>incoming</span>
          </div>
          <div>
            <strong>{outgoing.length}</strong>
            <span>outgoing</span>
          </div>
          <div>
            <strong>{circular.length}</strong>
            <span>cycles</span>
          </div>
        </div>
        {outgoing.slice(0, 5).map((dependency) => (
          <p className="dependency-line" key={`${dependency.source}-${dependency.target}`}>
            {shortName(dependency.source)} imports {shortName(dependency.target)}
          </p>
        ))}
      </section>
    </aside>
  );
}

function ModuleDetailSection({ title, items, empty }) {
  return (
    <section className="module-detail-section">
      <h3>{title}</h3>
      <div className="detail-chip-list">
        {items.length ? items.slice(0, 12).map((item) => (
          <span key={item}>{item}</span>
        )) : <p>{empty}</p>}
      </div>
    </section>
  );
}

function IssueDetailDrawer({ issue, onInspectModule, onClose }) {
  const relatedFiles = issue.relatedFiles || [];
  const recommendation = issue.recommendation || recommendationForIssue(issue);

  return (
    <aside className="issue-drawer" aria-label="Issue detail">
      <div className="module-drawer-header">
        <div>
          <p className="section-kicker">Risk detail</p>
          <h2>{issue.title}</h2>
          <p>{issue.type} / {issue.severity}</p>
        </div>
        <button className="icon-button" type="button" aria-label="Close issue detail" onClick={onClose}>
          X
        </button>
      </div>

      <section className={`issue-detail-hero ${issue.severity}`}>
        <strong>{issue.severity}</strong>
        <p>{issue.detail}</p>
      </section>

      <section className="module-detail-section">
        <h3>Recommended fix</h3>
        <p className="recommendation-copy">{recommendation}</p>
      </section>

      <section className="module-detail-section">
        <h3>Related files</h3>
        <div className="detail-chip-list">
          {relatedFiles.length ? relatedFiles.map((file) => (
            <button className="detail-action-chip" type="button" key={file} onClick={() => onInspectModule(file)}>
              {shortPath(file)}
            </button>
          )) : <p>No related files were provided for this issue.</p>}
        </div>
      </section>
    </aside>
  );
}

function OnboardingDrawer({ report, onInspectModule, onSelectIssue, onClose }) {
  const architectureRecommendations = report.architecture_recommendations || [];
  const refactorPriorities = report.refactor_priorities || [];

  return (
    <aside className="onboarding-drawer" aria-label="Onboarding report">
      <div className="module-drawer-header">
        <div>
          <p className="section-kicker">Onboarding report</p>
          <h2>New developer guide</h2>
          <p>{report.analysis_id}</p>
        </div>
        <div className="drawer-actions">
          <button className="ghost-button" type="button" onClick={() => exportOnboardingMarkdown(report)}>
            Export Markdown
          </button>
          <button className="icon-button" type="button" aria-label="Close onboarding report" onClick={onClose}>
            X
          </button>
        </div>
      </div>

      <section className="module-detail-section">
        <h3>Overview</h3>
        <p className="recommendation-copy">{report.overview}</p>
      </section>

      <section className="module-detail-section">
        <h3>Reading order</h3>
        <div className="onboarding-list">
          {report.reading_order.map((module, index) => (
            <button
              className="onboarding-row"
              type="button"
              key={module.module_name}
              onClick={() => onInspectModule(module.module_name)}
            >
              <strong>{index + 1}</strong>
              <div>
                <p>{module.module_name}</p>
                <span>{module.reason}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="module-detail-section">
        <h3>Architecture recommendations</h3>
        <div className="recommendation-list">
          {architectureRecommendations.length ? architectureRecommendations.map((recommendation) => (
            <article className={`recommendation-card ${recommendation.priority}`} key={recommendation.title}>
              <div>
                <strong>{recommendation.title}</strong>
                <span>{recommendation.priority} priority</span>
              </div>
              <p>{recommendation.rationale}</p>
              <p>{recommendation.impact}</p>
              <div className="detail-chip-list">
                {recommendation.related_modules.map((moduleName) => (
                  <button
                    className="detail-action-chip"
                    type="button"
                    key={moduleName}
                    onClick={() => onInspectModule(moduleName)}
                  >
                    {shortPath(moduleName)}
                  </button>
                ))}
              </div>
            </article>
          )) : <p className="recommendation-copy">No architecture recommendations were generated for this analysis.</p>}
        </div>
      </section>

      <section className="module-detail-section">
        <h3>Refactor priorities</h3>
        <div className="recommendation-list">
          {refactorPriorities.length ? refactorPriorities.map((priority) => (
            <article className="recommendation-card" key={priority.title}>
              <div>
                <strong>{priority.title}</strong>
                <span>{priority.effort} effort</span>
              </div>
              <p>{priority.reason}</p>
              <div className="detail-chip-list">
                {priority.target_modules.map((moduleName) => (
                  <button
                    className="detail-action-chip"
                    type="button"
                    key={moduleName}
                    onClick={() => onInspectModule(moduleName)}
                  >
                    {shortPath(moduleName)}
                  </button>
                ))}
              </div>
            </article>
          )) : <p className="recommendation-copy">No refactor priorities were generated for this analysis.</p>}
        </div>
      </section>

      <section className="module-detail-section">
        <h3>Top risks</h3>
        <IssueList issues={report.key_risks.map(mapIssue)} onSelectIssue={onSelectIssue} />
      </section>

      <section className="module-detail-section">
        <h3>First tasks</h3>
        <div className="detail-chip-list task-list">
          {report.first_tasks.map((task) => (
            <span key={task}>{task}</span>
          ))}
        </div>
      </section>
    </aside>
  );
}

function exportOnboardingMarkdown(report) {
  const architectureRecommendations = report.architecture_recommendations || [];
  const refactorPriorities = report.refactor_priorities || [];
  const lines = [
    "# Codara Onboarding Report",
    "",
    `Analysis: ${report.analysis_id}`,
    `Repository: ${report.repository_id}`,
    "",
    "## Overview",
    "",
    report.overview,
    "",
    "## Reading Order",
    "",
    ...report.reading_order.flatMap((module, index) => [
      `${index + 1}. ${module.module_name}`,
      `   - Path: ${module.path}`,
      `   - Reason: ${module.reason}`,
      `   - Dependencies: ${module.dependency_count}`,
    ]),
    "",
    "## Architecture Recommendations",
    "",
    ...(architectureRecommendations.length
      ? architectureRecommendations.flatMap((recommendation) => [
          `- ${recommendation.priority.toUpperCase()}: ${recommendation.title}`,
          `  - Rationale: ${recommendation.rationale}`,
          `  - Impact: ${recommendation.impact}`,
          `  - Related modules: ${recommendation.related_modules.join(", ") || "None"}`,
        ])
      : ["No architecture recommendations were generated."]),
    "",
    "## Refactor Priorities",
    "",
    ...(refactorPriorities.length
      ? refactorPriorities.flatMap((priority) => [
          `- ${priority.title}`,
          `  - Effort: ${priority.effort}`,
          `  - Reason: ${priority.reason}`,
          `  - Target modules: ${priority.target_modules.join(", ") || "None"}`,
        ])
      : ["No refactor priorities were generated."]),
    "",
    "## Top Risks",
    "",
    ...(report.key_risks.length
      ? report.key_risks.flatMap((issue) => [
          `- ${issue.severity.toUpperCase()}: ${issue.title}`,
          `  - ${issue.description}`,
          `  - Related files: ${issue.related_files?.join(", ") || "None"}`,
        ])
      : ["No risk signals found."]),
    "",
    "## First Tasks",
    "",
    ...report.first_tasks.map((task) => `- ${task}`),
    "",
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `codara-${report.analysis_id}-onboarding.md`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function Diagrams({ diagram, mode, onModeChange, analyzerResult, onInspectModule }) {
  const [isJsonOpen, setIsJsonOpen] = useState(false);
  const nodeCount = diagram?.nodes?.length || mockData.diagramNodes.length;
  const edgeCount = diagram?.edges?.length || 0;
  const modeCopy = {
    service: {
      title: "Service dependency view",
      body: "Shows module-to-module import paths and the broad component shape of the selected repository.",
    },
    data: {
      title: "Data movement view",
      body: "Focuses on import labels and flow direction so you can inspect how context moves through the codebase.",
    },
    risk: {
      title: "Risk concentration view",
      body: "Highlights modules with heavier dependency pressure and paths that deserve refactoring review.",
    },
  };

  return (
    <section className="view active">
      <section className="diagram-layout">
        <div className="diagram-stage">
          <div className="diagram-toolbar">
            <div>
              <p className="section-kicker">System diagram</p>
              <h2>Live module dependency graph</h2>
            </div>
            <div className="segmented-control">
              {["service", "data", "risk"].map((item) => (
                <button
                  className={mode === item ? "active" : ""}
                  type="button"
                  key={item}
                  onClick={() => onModeChange(item)}
                >
                  {item[0].toUpperCase() + item.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <DiagramCanvas
            diagram={diagram}
            mode={mode}
            analyzerResult={analyzerResult}
            onInspectModule={onInspectModule}
          />
        </div>
        <aside className="diagram-side">
          <div className="side-card graph-summary">
            <h3>Analyzer graph</h3>
            <div className="graph-stat-grid">
              <div>
                <strong>{nodeCount}</strong>
                <span>modules</span>
              </div>
              <div>
                <strong>{edgeCount}</strong>
                <span>edges</span>
              </div>
            </div>
            <p>Generated from imports extracted by the backend analyzer.</p>
          </div>
          <div className="side-card mode-card">
            <h3>{modeCopy[mode].title}</h3>
            <p>{modeCopy[mode].body}</p>
          </div>
          {mockData.diagramNotes.map((note) => (
            <div className="side-card" key={note.title}>
              <h3>{note.title}</h3>
              <p>{note.body}</p>
            </div>
          ))}
          <div className="side-card">
            <h3>Diagram actions</h3>
            <button className="ghost-button" type="button" onClick={() => exportDiagramPng(diagram, mode)}>
              Export PNG
            </button>
            <button className="ghost-button" type="button" onClick={() => setIsJsonOpen(true)}>
              Open graph JSON
            </button>
          </div>
        </aside>
      </section>
      {isJsonOpen && (
        <GraphJsonDrawer
          diagram={diagram}
          mode={mode}
          onClose={() => setIsJsonOpen(false)}
        />
      )}
    </section>
  );
}

function exportDiagramPng(diagram, mode) {
  const graph = diagram || {
    analysis_id: "local_preview",
    mode,
    nodes: mockData.diagramNodes.map((node) => ({
      id: node.label.toLowerCase().replace(/\s+/g, "_"),
      label: node.label,
      risk: node.className.includes("danger") ? "high" : null,
    })),
    edges: [],
  };
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 760;
  const context = canvas.getContext("2d");
  if (!context) return;

  const background = mode === "risk" ? "#fffafa" : "#fbfcfd";
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid(context, canvas.width, canvas.height);
  drawExportHeader(context, graph, mode);
  drawExportEdges(context, mode);
  drawExportNodes(context, graph.nodes, mode);
  drawExportEdgeList(context, graph.edges, mode);

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `codara-${graph.analysis_id}-${mode}-diagram.png`;
  link.click();
}

function drawGrid(context, width, height) {
  context.strokeStyle = "#e6ebf1";
  context.lineWidth = 1;
  for (let x = 0; x < width; x += 48) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = 0; y < height; y += 48) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
}

function drawExportHeader(context, graph, mode) {
  context.fillStyle = "#17211f";
  context.font = "700 32px Arial";
  context.fillText("Codara architecture diagram", 48, 62);
  context.fillStyle = "#6f7c78";
  context.font = "16px Arial";
  context.fillText(`${graph.analysis_id} / ${mode}`, 48, 92);
}

function drawExportEdges(context, mode) {
  const paths = [
    [210, 190, 330, 190, 430, 188],
    [520, 205, 570, 250, 650, 360],
    [520, 160, 650, 95, 790, 128],
    [760, 390, 825, 365, 910, 300],
    [860, 175, 915, 205, 940, 248],
    [520, 225, 595, 430, 715, 560],
  ];
  paths.forEach((path, index) => {
    context.beginPath();
    context.moveTo(path[0], path[1]);
    context.bezierCurveTo(path[2], path[3], path[4], path[5], path[4], path[5]);
    context.strokeStyle = index === 5 ? "#cf3f3f" : mode === "data" ? "#0891b2" : "#9aa6b6";
    context.setLineDash(index === 5 ? [10, 8] : []);
    context.lineWidth = index === 5 ? 3 : 2;
    context.stroke();
    context.setLineDash([]);
  });
}

function drawExportNodes(context, nodes, mode) {
  const positions = [
    [90, 156],
    [390, 156],
    [650, 120],
    [550, 350],
    [860, 285],
    [900, 120],
    [690, 545],
  ];
  nodes.slice(0, 7).forEach((node, index) => {
    const [x, y] = positions[index];
    const isRisk = mode === "risk" && node.risk;
    context.fillStyle = isRisk ? "#fff7f7" : "#ffffff";
    context.strokeStyle = isRisk ? "#cf3f3f" : "#cfd8e3";
    context.lineWidth = 2;
    roundRect(context, x, y, 170, 58, 10);
    context.fill();
    context.stroke();
    context.fillStyle = isRisk ? "#cf3f3f" : "#17211f";
    context.font = "700 15px Arial";
    context.fillText(node.label, x + 18, y + 36, 136);
  });
}

function drawExportEdgeList(context, edges, mode) {
  context.fillStyle = "rgba(255,255,255,0.92)";
  context.strokeStyle = "#dde5ef";
  roundRect(context, 790, 530, 330, 150, 10);
  context.fill();
  context.stroke();
  context.fillStyle = "#17211f";
  context.font = "700 15px Arial";
  context.fillText("Dependency edges", 815, 560);
  context.fillStyle = "#6f7c78";
  context.font = "13px Arial";
  const labels = edges.slice(0, 5).map((edge) => (
    `${mode === "data" ? `${edge.label}: ` : ""}${shortName(edge.source)} to ${shortName(edge.target)}`
  ));
  (labels.length ? labels : ["No live edges in this view"]).forEach((label, index) => {
    context.fillText(label, 815, 588 + index * 20, 280);
  });
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function GraphJsonDrawer({ diagram, mode, onClose }) {
  const graphPayload = diagram || {
    analysis_id: "local_preview",
    mode,
    nodes: mockData.diagramNodes.map((node) => ({
      id: node.label.toLowerCase().replace(/\s+/g, "_"),
      label: node.label,
      kind: "preview",
      risk: node.className.includes("danger") ? "high" : null,
    })),
    edges: [],
  };

  return (
    <aside className="json-drawer" aria-label="Graph JSON">
      <div className="json-drawer-header">
        <div>
          <p className="section-kicker">Graph JSON</p>
          <h2>{graphPayload.analysis_id}</h2>
        </div>
        <button className="icon-button" type="button" aria-label="Close graph JSON" onClick={onClose}>
          X
        </button>
      </div>
      <pre>{JSON.stringify(graphPayload, null, 2)}</pre>
    </aside>
  );
}

function DiagramCanvas({ diagram, mode, analyzerResult, onInspectModule }) {
  const nodes = useMemo(() => {
    if (!diagram) return mockData.diagramNodes;
    return diagram.nodes.map((node, index) => ({
      id: node.id,
      label: node.label,
      className: `${["n1", "n2", "n3", "n4", "n5", "n6", "n7"][index] || "n1"} ${
        mode === "risk" && node.risk ? "danger" : ""
      }`,
    }));
  }, [diagram, mode]);
  const edges = diagram?.edges || [];
  const modules = analyzerResult?.modules || [];

  return (
    <div className={`diagram-canvas ${mode}`} aria-label="Architecture diagram preview">
      {nodes.map((node) => (
        <button
          className={`diagram-node ${node.className}`}
          type="button"
          key={node.label}
          onClick={() => {
            const module = modules.find((item) => item.module_name === node.id);
            if (module) onInspectModule(module);
          }}
        >
          {node.label}
        </button>
      ))}
      <svg className="diagram-lines" viewBox="0 0 820 420" aria-hidden="true">
        <path d="M150 96 C230 96 220 94 300 94" />
        <path d="M392 112 C440 140 462 170 490 220" />
        <path d="M392 78 C470 50 515 52 590 70" />
        <path d="M578 240 C618 230 650 210 690 180" />
        <path d="M640 104 C672 118 690 134 706 152" />
        <path className="risk-line" d="M398 126 C440 230 475 292 540 324" />
      </svg>
      <div className="edge-list" aria-label="Live dependency edges">
        {edges.slice(0, 5).map((edge) => (
          <span key={`${edge.source}-${edge.target}`}>
            {mode === "data" ? `${edge.label}: ` : ""}
            {shortName(edge.source)} to {shortName(edge.target)}
          </span>
        ))}
      </div>
    </div>
  );
}

function shortName(moduleName) {
  const parts = moduleName.split(".");
  return parts.slice(-2).join(".");
}

function Observability({ services, logs, alerts, analysisJobs, currentRepository, onRefreshJobs }) {
  return (
    <section className="view active">
      <section className="ops-grid">
        {services.map((service) => (
          <article className={`service-card ${service.state}`} key={service.label}>
            <p className="metric-label">{service.label}</p>
            <strong>{service.status}</strong>
            <span>{service.detail}</span>
          </article>
        ))}
      </section>
      <section className="observability-layout">
        <MetricsPanel />
        <AnalysisHistory
          jobs={analysisJobs}
          currentRepository={currentRepository}
          onRefreshJobs={onRefreshJobs}
        />
        <LogsPanel logs={logs} />
        <aside className="alerts-panel">
          <div className="panel-header compact">
            <div>
              <h2>Alert rules</h2>
              <p>Prometheus Alertmanager targets</p>
            </div>
          </div>
          <IssueList issues={alerts} />
        </aside>
      </section>
    </section>
  );
}

function AnalysisHistory({ jobs, currentRepository, onRefreshJobs }) {
  const visibleJobs = jobs.slice(0, 5);

  return (
    <section className="analysis-history">
      <div className="panel-header compact">
        <div>
          <h2>Analysis runs</h2>
          <p>{currentRepository?.name || "Current repository"} job history</p>
        </div>
        <button className="ghost-button" type="button" onClick={onRefreshJobs}>
          Refresh
        </button>
      </div>
      <div className="job-list">
        {visibleJobs.length ? (
          visibleJobs.map((job) => <AnalysisJobRow job={job} key={job.id} />)
        ) : (
          <p className="empty-state">No analysis jobs have been recorded for this repository yet.</p>
        )}
      </div>
    </section>
  );
}

function AnalysisJobRow({ job }) {
  const completedAt = job.completedAt ? new Date(job.completedAt).toLocaleString() : "Running";

  return (
    <article className="job-row">
      <div>
        <h3>{job.repositoryName}</h3>
        <p>{job.id}</p>
      </div>
      <div className="job-progress" aria-label={`${job.progress}% complete`}>
        <span style={{ width: `${job.progress}%` }}></span>
      </div>
      <div className="job-meta">
        <strong className={job.status === "completed" ? "good" : "warn"}>{job.status}</strong>
        <span>{job.filesProcessed} files</span>
        <span>{completedAt}</span>
      </div>
    </article>
  );
}

function MetricsPanel() {
  return (
    <div className="metrics-panel">
      <div className="panel-header compact">
        <div>
          <h2>Metrics trend</h2>
          <p>Analysis latency and queue depth</p>
        </div>
      </div>
      <div className="bar-chart" aria-label="Metrics bar chart">
        {mockData.trend.map((value) => <span style={{ height: `${value}%` }} key={value}></span>)}
      </div>
    </div>
  );
}

function LogsPanel({ logs }) {
  return (
    <div className="logs-panel">
      <div className="panel-header compact">
        <div>
          <h2>Live logs</h2>
          <p>Structured events from analysis services</p>
        </div>
      </div>
      <div className="log-stream">
        {logs.map((log) => (
          <p key={log.id || `${log.level}-${log.body}`}>
            <span>{log.level}</span>
            {log.service ? `${log.service}: ` : ""}{log.body}
          </p>
        ))}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
