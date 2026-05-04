const API_BASE_URL = "http://127.0.0.1:8000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`Codara API request failed: ${response.status}`);
  }

  return response.json();
}

export function getRepositories() {
  return request("/repositories");
}

export function createRepository(payload) {
  return request("/repositories", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getRepositoryTimeline(repositoryId) {
  return request(`/repositories/${encodeURIComponent(repositoryId)}/timeline`);
}

export function getRepositoryIntelligence(repositoryId) {
  return request(`/repositories/${encodeURIComponent(repositoryId)}/intelligence`);
}

export function getHealth() {
  return request("/health");
}

export function getLogs(limit = 20) {
  return request(`/observability/logs?limit=${encodeURIComponent(limit)}`);
}

export function getAlerts() {
  return request("/observability/alerts");
}

export function getDiagram(analysisId = "analysis_codara_api_latest", mode = "service") {
  return request(`/diagram/${analysisId}?mode=${encodeURIComponent(mode)}`);
}

export function getAnalysisModules(analysisId = "analysis_codara_api_latest") {
  return request(`/analysis/${analysisId}/modules`);
}

export function getAnalysisSummary(analysisId = "analysis_codara_api_latest") {
  return request(`/analysis/${analysisId}/summary`);
}

export function getAnalysisIssues(analysisId = "analysis_codara_api_latest") {
  return request(`/analysis/${analysisId}/issues`);
}

export function getRiskReviewStatuses(analysisId = "analysis_codara_api_latest") {
  return request(`/analysis/${analysisId}/risk-reviews`);
}

export function updateRiskReviewStatus(analysisId, issueId, payload) {
  return request(`/analysis/${analysisId}/risk-reviews/${encodeURIComponent(issueId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getRiskTasks(analysisId = "analysis_codara_api_latest") {
  return request(`/analysis/${analysisId}/risk-tasks`);
}

export function getRiskTaskEvents(analysisId = "analysis_codara_api_latest", limit = 30) {
  return request(`/analysis/${analysisId}/risk-tasks/events?limit=${encodeURIComponent(limit)}`);
}

export function createRiskTask(analysisId, payload) {
  return request(`/analysis/${analysisId}/risk-tasks`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateRiskTask(analysisId, taskId, updates) {
  return request(`/analysis/${analysisId}/risk-tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function bulkUpdateRiskTasks(analysisId, payload) {
  return request(`/analysis/${analysisId}/risk-tasks/bulk`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteRiskTask(analysisId, taskId) {
  const response = await fetch(`${API_BASE_URL}/analysis/${analysisId}/risk-tasks/${encodeURIComponent(taskId)}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Risk task delete failed: ${response.status}`);
  }
}

export function searchAnalysis(analysisId = "analysis_codara_api_latest", query) {
  return request(`/analysis/${analysisId}/search?q=${encodeURIComponent(query)}`);
}

export function getOnboardingReport(analysisId = "analysis_codara_api_latest") {
  return request(`/analysis/${analysisId}/onboarding`);
}

export function getAnalysisJobs(repositoryId) {
  const query = repositoryId ? `?repository_id=${encodeURIComponent(repositoryId)}` : "";
  return request(`/analysis${query}`);
}

export function createAnalysis(repositoryId) {
  return request(`/analysis?repository_id=${encodeURIComponent(repositoryId)}`, {
    method: "POST",
  });
}

export async function uploadRepositoryZip(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/repositories/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Repository upload failed: ${response.status}`);
  }

  return response.json();
}

export function sendChatMessage(repositoryId, message) {
  return request("/chat", {
    method: "POST",
    body: JSON.stringify({ repository_id: repositoryId, message }),
  });
}
