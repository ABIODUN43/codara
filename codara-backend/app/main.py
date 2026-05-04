from typing import Literal

from fastapi import FastAPI, File, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, generate_latest

from app import mock_store
from app.services.uploads import save_repository_zip
from app.schemas import (
    AlertRule,
    AnalysisJob,
    AnalysisSummary,
    AnalyzerResult,
    ChatRequest,
    ChatResponse,
    Diagram,
    HealthResponse,
    Issue,
    LogEvent,
    OnboardingReport,
    Repository,
    RepositoryCreate,
    RepositoryIntelligenceSummary,
    RepositoryTimelineEvent,
    RiskReviewStatus,
    RiskReviewUpdate,
    RiskTask,
    RiskTaskBulkUpdate,
    RiskTaskCreate,
    RiskTaskEvent,
    RiskTaskUpdate,
    SearchResult,
)

app = FastAPI(
    title="Codara API",
    description="Backend API for Codara architecture intelligence.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5174",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

analysis_requests_total = Counter(
    "codara_analysis_requests_total",
    "Total analysis jobs requested.",
)
analysis_queue_depth = Gauge(
    "codara_analysis_queue_depth",
    "Mocked number of queued analysis jobs.",
)
analysis_queue_depth.set(2)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    services = mock_store.get_service_health()
    status = "degraded" if any(service.status == "down" for service in services) else "healthy"
    return HealthResponse(status=status, services=services)


@app.get("/metrics")
def metrics() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/observability/logs", response_model=list[LogEvent])
def logs(limit: int = 20) -> list[LogEvent]:
    return mock_store.get_log_events(limit)


@app.get("/observability/alerts", response_model=list[AlertRule])
def alerts() -> list[AlertRule]:
    return mock_store.get_alert_rules()


@app.get("/repositories", response_model=list[Repository])
def repositories() -> list[Repository]:
    return mock_store.list_repositories()


@app.post("/repositories", response_model=Repository, status_code=201)
def create_repository(payload: RepositoryCreate) -> Repository:
    try:
        return mock_store.create_repository(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/repositories/upload", response_model=Repository, status_code=201)
async def upload_repository(file: UploadFile = File(...)) -> Repository:
    repository_id, root_path = await save_repository_zip(file)
    return mock_store.register_uploaded_repository(
        repository_id=repository_id,
        name=file.filename.rsplit(".", 1)[0] if file.filename else repository_id,
        root_path=root_path,
    )


@app.get("/repositories/{repository_id}", response_model=Repository)
def repository(repository_id: str) -> Repository:
    repo = mock_store.get_repository(repository_id)
    if repo is None:
        raise HTTPException(status_code=404, detail="Repository not found")
    return repo


@app.get("/repositories/{repository_id}/timeline", response_model=list[RepositoryTimelineEvent])
def repository_timeline(repository_id: str) -> list[RepositoryTimelineEvent]:
    if mock_store.get_repository(repository_id) is None:
        raise HTTPException(status_code=404, detail="Repository not found")
    return mock_store.get_repository_timeline(repository_id)


@app.get("/repositories/{repository_id}/intelligence", response_model=RepositoryIntelligenceSummary)
def repository_intelligence(repository_id: str) -> RepositoryIntelligenceSummary:
    if mock_store.get_repository(repository_id) is None:
        raise HTTPException(status_code=404, detail="Repository not found")
    return mock_store.get_repository_intelligence(repository_id)


@app.post("/analysis", response_model=AnalysisJob, status_code=202)
def create_analysis(repository_id: str) -> AnalysisJob:
    if mock_store.get_repository(repository_id) is None:
        raise HTTPException(status_code=404, detail="Repository not found")
    analysis_requests_total.inc()
    return mock_store.create_analysis(repository_id)


@app.get("/analysis", response_model=list[AnalysisJob])
def analysis_history(repository_id: str | None = None) -> list[AnalysisJob]:
    if repository_id and mock_store.get_repository(repository_id) is None:
        raise HTTPException(status_code=404, detail="Repository not found")
    return mock_store.list_analysis_jobs(repository_id)


@app.get("/analysis/{analysis_id}", response_model=AnalysisJob)
def analysis(analysis_id: str) -> AnalysisJob:
    job = mock_store.get_analysis(analysis_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return job


@app.get("/analysis/{analysis_id}/summary", response_model=AnalysisSummary)
def analysis_summary(analysis_id: str) -> AnalysisSummary:
    if mock_store.get_analysis(analysis_id) is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return mock_store.get_summary(analysis_id)


@app.get("/analysis/{analysis_id}/issues", response_model=list[Issue])
def analysis_issues(analysis_id: str) -> list[Issue]:
    if mock_store.get_analysis(analysis_id) is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return mock_store.get_analysis_issues(analysis_id)


@app.get("/analysis/{analysis_id}/risk-reviews", response_model=list[RiskReviewStatus])
def risk_review_statuses(analysis_id: str) -> list[RiskReviewStatus]:
    if mock_store.get_analysis(analysis_id) is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return mock_store.get_risk_review_statuses(analysis_id)


@app.patch("/analysis/{analysis_id}/risk-reviews/{issue_id}", response_model=RiskReviewStatus)
def update_risk_review_status(
    analysis_id: str,
    issue_id: str,
    payload: RiskReviewUpdate,
) -> RiskReviewStatus:
    if mock_store.get_analysis(analysis_id) is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    status = mock_store.update_risk_review_status(analysis_id, issue_id, payload.status, payload.note)
    if status is None:
        raise HTTPException(status_code=404, detail="Risk signal not found")
    return status


@app.get("/analysis/{analysis_id}/risk-tasks", response_model=list[RiskTask])
def risk_tasks(analysis_id: str) -> list[RiskTask]:
    if mock_store.get_analysis(analysis_id) is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return mock_store.list_risk_tasks(analysis_id)


@app.get("/analysis/{analysis_id}/risk-tasks/events", response_model=list[RiskTaskEvent])
def risk_task_events(analysis_id: str, limit: int = 30) -> list[RiskTaskEvent]:
    if mock_store.get_analysis(analysis_id) is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return mock_store.list_risk_task_events(analysis_id, limit)


@app.post("/analysis/{analysis_id}/risk-tasks", response_model=RiskTask, status_code=201)
def create_risk_task(analysis_id: str, payload: RiskTaskCreate) -> RiskTask:
    if mock_store.get_analysis(analysis_id) is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    task = mock_store.create_risk_task(analysis_id, payload)
    if task is None:
        raise HTTPException(status_code=404, detail="Risk signal not found")
    return task


@app.patch("/analysis/{analysis_id}/risk-tasks/bulk", response_model=list[RiskTask])
def bulk_update_risk_tasks(analysis_id: str, payload: RiskTaskBulkUpdate) -> list[RiskTask]:
    if mock_store.get_analysis(analysis_id) is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    tasks = mock_store.bulk_update_risk_tasks(
        analysis_id,
        payload.task_ids,
        payload.status,
        payload.owner,
        payload.priority,
        payload.due_date,
        payload.note,
    )
    if not tasks:
        raise HTTPException(status_code=404, detail="No matching risk tasks found")
    return tasks


@app.patch("/analysis/{analysis_id}/risk-tasks/{task_id}", response_model=RiskTask)
def update_risk_task(analysis_id: str, task_id: str, payload: RiskTaskUpdate) -> RiskTask:
    if mock_store.get_analysis(analysis_id) is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    task = mock_store.update_risk_task(
        analysis_id,
        task_id,
        payload.status,
        payload.owner,
        payload.priority,
        payload.due_date,
        payload.note,
    )
    if task is None:
        raise HTTPException(status_code=404, detail="Risk task not found")
    return task


@app.delete("/analysis/{analysis_id}/risk-tasks/{task_id}", status_code=204)
def delete_risk_task(analysis_id: str, task_id: str) -> Response:
    if mock_store.get_analysis(analysis_id) is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    deleted = mock_store.delete_risk_task(analysis_id, task_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Risk task not found")
    return Response(status_code=204)


@app.get("/analysis/{analysis_id}/modules", response_model=AnalyzerResult)
def analysis_modules(analysis_id: str) -> AnalyzerResult:
    if mock_store.get_analysis(analysis_id) is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return mock_store.get_live_analyzer_result(analysis_id)


@app.get("/analysis/{analysis_id}/search", response_model=list[SearchResult])
def analysis_search(analysis_id: str, q: str) -> list[SearchResult]:
    if mock_store.get_analysis(analysis_id) is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return mock_store.search_analysis(analysis_id, q)


@app.get("/analysis/{analysis_id}/onboarding", response_model=OnboardingReport)
def onboarding_report(analysis_id: str) -> OnboardingReport:
    if mock_store.get_analysis(analysis_id) is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return mock_store.get_onboarding_report(analysis_id)


@app.get("/diagram/{analysis_id}", response_model=Diagram)
def diagram(
    analysis_id: str,
    mode: Literal["service", "data", "risk"] = "service",
) -> Diagram:
    if mock_store.get_analysis(analysis_id) is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return mock_store.get_diagram(analysis_id, mode)


@app.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest) -> ChatResponse:
    if mock_store.get_repository(payload.repository_id) is None:
        raise HTTPException(status_code=404, detail="Repository not found")
    return mock_store.answer_chat(payload.message, payload.repository_id)
