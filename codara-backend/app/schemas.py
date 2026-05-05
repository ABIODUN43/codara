from typing import Literal

from pydantic import BaseModel


class Repository(BaseModel):
    id: str
    name: str
    description: str
    source_type: Literal["github", "zip", "local"]
    language: str
    files: int
    modules: int
    status: Literal["ready", "review", "analyzing", "failed"]
    last_analyzed_at: str | None = None


class RepositoryCreate(BaseModel):
    name: str
    source_type: Literal["github", "zip", "local"] = "github"
    url: str | None = None
    branch: str | None = None


class RepositoryTimelineEvent(BaseModel):
    id: str
    title: str
    detail: str
    status: Literal["done", "running", "pending", "blocked"]
    timestamp: str | None = None
    artifact: str | None = None


class RepositoryIntelligenceSummary(BaseModel):
    repository_id: str
    health_label: Literal["Strong", "Stable", "Needs review", "Blocked"]
    health_score: int
    modules_mapped: int
    risk_signals: int
    top_hotspot: str | None = None
    next_action: str
    rationale: str


class AnalysisJob(BaseModel):
    id: str
    repository_id: str
    status: Literal["pending", "processing", "completed", "failed"]
    progress: int
    files_processed: int
    started_at: str
    completed_at: str | None = None
    error_message: str | None = None


class Issue(BaseModel):
    id: str
    severity: Literal["low", "medium", "high"]
    type: str
    title: str
    description: str
    related_files: list[str]


class RiskReviewStatus(BaseModel):
    issue_id: str
    status: Literal["open", "reviewed", "skipped"]
    note: str = ""
    updated_at: str


class RiskReviewUpdate(BaseModel):
    status: Literal["open", "reviewed", "skipped"] | None = None
    note: str | None = None


class RiskTask(BaseModel):
    id: str
    issue_id: str
    title: str
    severity: Literal["low", "medium", "high"]
    files: list[str]
    status: Literal["todo", "blocked", "done"]
    owner: str = "Unassigned"
    priority: Literal["low", "medium", "high"] = "medium"
    due_date: str | None = None
    note: str = ""
    created_at: str
    updated_at: str


class RiskTaskEvent(BaseModel):
    id: str
    task_id: str
    task_title: str
    event_type: Literal["created", "updated", "deleted"]
    field: str | None = None
    previous_value: str | None = None
    next_value: str | None = None
    message: str
    timestamp: str


class RiskTaskCreate(BaseModel):
    issue_id: str
    title: str
    severity: Literal["low", "medium", "high"]
    files: list[str] = []
    owner: str = "Unassigned"
    priority: Literal["low", "medium", "high"] = "medium"
    due_date: str | None = None
    note: str = ""


class RiskTaskUpdate(BaseModel):
    status: Literal["todo", "blocked", "done"] | None = None
    owner: str | None = None
    priority: Literal["low", "medium", "high"] | None = None
    due_date: str | None = None
    note: str | None = None


class RiskTaskBulkUpdate(RiskTaskUpdate):
    task_ids: list[str]


class AnalysisSummary(BaseModel):
    analysis_id: str
    repository_id: str
    modules_mapped: int
    risk_signals: int
    embeddings: int
    summary: str
    key_modules: list[str]


class CodeModule(BaseModel):
    path: str
    module_name: str
    language: Literal["python", "javascript", "typescript"]
    imports: list[str]
    functions: list[str]
    classes: list[str]
    dependency_count: int


class ModuleDependency(BaseModel):
    source: str
    target: str
    import_name: str
    dependency_type: Literal["import"]


class AnalyzerResult(BaseModel):
    root_path: str
    files_scanned: int
    modules: list[CodeModule]
    dependencies: list[ModuleDependency]
    circular_dependencies: list[list[str]]


class SearchResult(BaseModel):
    module_name: str
    path: str
    match_type: Literal["module", "path", "function", "class", "import"]
    matched_text: str
    score: int
    functions: list[str]
    classes: list[str]


class OnboardingModule(BaseModel):
    module_name: str
    path: str
    reason: str
    dependency_count: int


class ArchitectureRecommendation(BaseModel):
    title: str
    priority: Literal["low", "medium", "high"]
    rationale: str
    impact: str
    related_modules: list[str]


class RefactorPriority(BaseModel):
    title: str
    effort: Literal["small", "medium", "large"]
    reason: str
    target_modules: list[str]


class OnboardingReport(BaseModel):
    analysis_id: str
    repository_id: str
    overview: str
    reading_order: list[OnboardingModule]
    key_risks: list[Issue]
    architecture_recommendations: list[ArchitectureRecommendation]
    refactor_priorities: list[RefactorPriority]
    first_tasks: list[str]


class DiagramNode(BaseModel):
    id: str
    label: str
    kind: str
    risk: Literal["low", "medium", "high"] | None = None


class DiagramEdge(BaseModel):
    source: str
    target: str
    label: str


class Diagram(BaseModel):
    analysis_id: str
    mode: Literal["service", "data", "risk"]
    nodes: list[DiagramNode]
    edges: list[DiagramEdge]


class ChatRequest(BaseModel):
    repository_id: str
    message: str


class ChatResponse(BaseModel):
    answer: str
    cited_files: list[str]
    related_nodes: list[str]


class ServiceHealth(BaseModel):
    service: str
    status: Literal["healthy", "watch", "down"]
    detail: str


class HealthResponse(BaseModel):
    status: Literal["healthy", "degraded"]
    services: list[ServiceHealth]


class LogEvent(BaseModel):
    id: str
    level: Literal["debug", "info", "warn", "error"]
    service: str
    message: str
    timestamp: str


class AlertRule(BaseModel):
    id: str
    severity: Literal["low", "medium", "high"]
    title: str
    description: str
    condition: str
    target: str
