import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from app.ai.context_chat import answer_architecture_question
from app.analyzers.codebase_analyzer import analyze_codebase_project
from app.analyzers.risk_engine import generate_issues
from app.schemas import (
    AlertRule,
    AnalysisJob,
    AnalysisSummary,
    ArchitectureRecommendation,
    AnalyzerResult,
    ChatResponse,
    Diagram,
    DiagramEdge,
    DiagramNode,
    Issue,
    LogEvent,
    OnboardingModule,
    OnboardingReport,
    RefactorPriority,
    Repository,
    RepositoryCreate,
    RepositoryIntelligenceSummary,
    RepositoryTimelineEvent,
    RiskReviewStatus,
    RiskTask,
    RiskTaskCreate,
    RiskTaskEvent,
    SearchResult,
    ServiceHealth,
)

BACKEND_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = Path(__file__).resolve().parents[2]
STATE_PATH = BACKEND_ROOT / "storage" / "state.json"
DEFAULT_REPOSITORY_IDS = {"repo_codara_api", "repo_codara_web", "repo_codara_observe"}
DEFAULT_ANALYSIS_IDS = {"analysis_codara_api_latest"}


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


repositories: list[Repository] = [
    Repository(
        id="repo_codara_api",
        name="codara-api",
        description="FastAPI backend, analyzer workers, AI pipeline",
        source_type="github",
        language="Python",
        files=128,
        modules=42,
        status="ready",
        last_analyzed_at="2026-04-30T17:20:00+00:00",
    ),
    Repository(
        id="repo_codara_web",
        name="codara-web",
        description="Frontend workspace, diagrams, onboarding UI",
        source_type="github",
        language="TypeScript",
        files=86,
        modules=19,
        status="review",
        last_analyzed_at="2026-04-30T16:45:00+00:00",
    ),
    Repository(
        id="repo_codara_observe",
        name="codara-observe",
        description="Go metrics collector, Docker worker monitoring",
        source_type="github",
        language="Go",
        files=54,
        modules=12,
        status="ready",
        last_analyzed_at="2026-04-30T16:30:00+00:00",
    ),
]

repository_paths: dict[str, Path] = {
    "repo_codara_api": BACKEND_ROOT,
    "repo_codara_web": WORKSPACE_ROOT / "codara-frontend",
    "repo_codara_observe": WORKSPACE_ROOT,
}

analysis_jobs: list[AnalysisJob] = [
    AnalysisJob(
        id="analysis_codara_api_latest",
        repository_id="repo_codara_api",
        status="completed",
        progress=100,
        files_processed=128,
        started_at="2026-04-30T17:18:00+00:00",
        completed_at="2026-04-30T17:20:00+00:00",
    )
]

issues: list[Issue] = [
    Issue(
        id="issue_queue_latency",
        severity="high",
        type="performance",
        title="Queue latency rising",
        description="Large repo analysis may block worker capacity.",
        related_files=["workers/analyzer.py", "services/analysis.py"],
    ),
    Issue(
        id="issue_circular_dependency",
        severity="medium",
        type="architecture",
        title="Circular dependency",
        description="services.analysis depends on diagram.generator and receives graph formatting concerns back from it.",
        related_files=["services/analysis.py", "diagrams/generator.py"],
    ),
    Issue(
        id="issue_dead_code",
        severity="low",
        type="maintainability",
        title="Dead code candidate",
        description="legacy_parser.py has no inbound references in the latest analysis.",
        related_files=["analyzers/legacy_parser.py"],
    ),
]
risk_review_statuses: dict[str, dict[str, RiskReviewStatus]] = {}
risk_tasks: dict[str, list[RiskTask]] = {}
risk_task_events: dict[str, list[RiskTaskEvent]] = {}

log_events: list[LogEvent] = [
    LogEvent(
        id="log_analysis_received",
        level="info",
        service="FastAPI backend",
        message="analysis request received for codara-api",
        timestamp="2026-05-01T09:12:04+00:00",
    ),
    LogEvent(
        id="log_analyzer_started",
        level="info",
        service="Analyzer",
        message="analyzer started: 128 files queued",
        timestamp="2026-05-01T09:12:06+00:00",
    ),
    LogEvent(
        id="log_vector_slow",
        level="warn",
        service="Vector DB",
        message="vector ingestion slower than baseline",
        timestamp="2026-05-01T09:12:11+00:00",
    ),
    LogEvent(
        id="log_diagram_done",
        level="info",
        service="Diagram service",
        message="diagram generation completed in 2.4s",
        timestamp="2026-05-01T09:12:18+00:00",
    ),
]

alert_rules: list[AlertRule] = [
    AlertRule(
        id="alert_analyzer_failure_rate",
        severity="high",
        title="Analyzer failure rate",
        description="Alert if failures exceed 5% for 10 minutes.",
        condition="rate(codara_analysis_failures_total[10m]) > 0.05",
        target="Slack #codara-alerts",
    ),
    AlertRule(
        id="alert_queue_depth",
        severity="medium",
        title="Queue depth",
        description="Alert if pending jobs stay above 20.",
        condition="codara_analysis_queue_depth > 20",
        target="Prometheus Alertmanager",
    ),
    AlertRule(
        id="alert_health_endpoint",
        severity="low",
        title="Health endpoint",
        description="Alert when any service is unresponsive.",
        condition='codara_service_health{status="down"} > 0',
        target="Email ops digest",
    ),
]


def list_repositories() -> list[Repository]:
    return repositories


def list_analysis_jobs(repository_id: str | None = None) -> list[AnalysisJob]:
    if repository_id:
        return [job for job in analysis_jobs if job.repository_id == repository_id]
    return analysis_jobs


def create_repository(payload: RepositoryCreate) -> Repository:
    if payload.source_type == "github":
        if not payload.url:
            raise ValueError("GitHub repository URL is required")
        from app.services.uploads import fetch_github_repository

        repository_id, full_name, root_path = fetch_github_repository(payload.url, payload.name, payload.branch)
        return register_github_repository(repository_id, payload.name or full_name, full_name, root_path)

    repo = Repository(
        id=f"repo_{uuid4().hex[:10]}",
        name=payload.name,
        description="New repository awaiting analysis",
        source_type=payload.source_type,
        language="Unknown",
        files=0,
        modules=0,
        status="analyzing",
        last_analyzed_at=None,
    )
    repositories.insert(0, repo)
    _save_state()
    return repo


def register_github_repository(repository_id: str, name: str, full_name: str, root_path: Path) -> Repository:
    analyzer_result = analyze_codebase_project(root_path)
    repo = Repository(
        id=repository_id,
        name=name,
        description=f"Public GitHub repository: {full_name}",
        source_type="github",
        language=_language_summary(analyzer_result),
        files=analyzer_result.files_scanned,
        modules=len(analyzer_result.modules),
        status="ready",
        last_analyzed_at=utc_now(),
    )
    repositories.insert(0, repo)
    repository_paths[repository_id] = root_path
    create_analysis(repository_id)
    _save_state()
    return repo


def register_uploaded_repository(repository_id: str, name: str, root_path: Path) -> Repository:
    analyzer_result = analyze_codebase_project(root_path)
    repo = Repository(
        id=repository_id,
        name=name,
        description="Uploaded ZIP repository",
        source_type="zip",
        language=_language_summary(analyzer_result),
        files=analyzer_result.files_scanned,
        modules=len(analyzer_result.modules),
        status="ready",
        last_analyzed_at=utc_now(),
    )
    repositories.insert(0, repo)
    repository_paths[repository_id] = root_path
    _save_state()
    return repo


def get_repository(repository_id: str) -> Repository | None:
    return next((repo for repo in repositories if repo.id == repository_id), None)


def get_repository_timeline(repository_id: str) -> list[RepositoryTimelineEvent]:
    repository = get_repository(repository_id)
    if repository is None:
        return []

    latest_analysis = get_latest_analysis(repository_id)
    if latest_analysis is None:
        waiting_status = "pending" if repository.source_type == "zip" else "blocked"
        return [
            RepositoryTimelineEvent(
                id=f"{repository_id}_registered",
                title="Source registered",
                detail=f"{repository.name} is available in Codara as a {repository.source_type} repository.",
                status="done",
                timestamp=repository.last_analyzed_at,
                artifact=repository.source_type,
            ),
            RepositoryTimelineEvent(
                id=f"{repository_id}_waiting_analysis",
                title="Waiting for first analysis",
                detail="Run analysis or upload a ZIP so Codara can map modules, risks, diagrams, and onboarding guidance.",
                status=waiting_status,
                timestamp=None,
                artifact="analysis",
            ),
        ]

    analyzer_result = get_live_analyzer_result(latest_analysis.id)
    generated_issues = get_analysis_issues(latest_analysis.id)
    completed_at = latest_analysis.completed_at or latest_analysis.started_at
    high_risk_count = len([issue for issue in generated_issues if issue.severity == "high"])

    return [
        RepositoryTimelineEvent(
            id=f"{repository_id}_registered",
            title="Source registered",
            detail=f"{repository.name} is connected as a {repository.source_type} repository.",
            status="done",
            timestamp=latest_analysis.started_at,
            artifact=repository.source_type,
        ),
        RepositoryTimelineEvent(
            id=f"{latest_analysis.id}_analysis",
            title="Architecture analysis completed" if latest_analysis.status == "completed" else "Architecture analysis running",
            detail=f"{latest_analysis.files_processed} files processed in run {latest_analysis.id}.",
            status=_timeline_status_for_job(latest_analysis),
            timestamp=completed_at,
            artifact=latest_analysis.id,
        ),
        RepositoryTimelineEvent(
            id=f"{latest_analysis.id}_modules",
            title="Modules and dependencies mapped",
            detail=(
                f"{len(analyzer_result.modules)} modules and "
                f"{len(analyzer_result.dependencies)} internal dependency edges were extracted."
            ),
            status="done" if analyzer_result.files_scanned else "pending",
            timestamp=completed_at,
            artifact="module graph",
        ),
        RepositoryTimelineEvent(
            id=f"{latest_analysis.id}_risks",
            title="Risk scan generated",
            detail=(
                f"{len(generated_issues)} risk signals found"
                + (f", including {high_risk_count} high severity." if high_risk_count else ".")
            ),
            status="blocked" if high_risk_count else "done",
            timestamp=completed_at,
            artifact="risk report",
        ),
        RepositoryTimelineEvent(
            id=f"{latest_analysis.id}_diagram",
            title="Diagram context ready",
            detail="Service, data, and risk diagram modes can render from the latest analyzer graph.",
            status="done" if analyzer_result.modules else "pending",
            timestamp=completed_at,
            artifact="diagram",
        ),
        RepositoryTimelineEvent(
            id=f"{latest_analysis.id}_onboarding",
            title="Onboarding report available",
            detail="Codara can export reading order, architecture recommendations, and refactor priorities.",
            status="done" if analyzer_result.files_scanned else "pending",
            timestamp=completed_at,
            artifact="markdown",
        ),
    ]


def get_repository_intelligence(repository_id: str) -> RepositoryIntelligenceSummary:
    repository = get_repository(repository_id)
    latest_analysis = get_latest_analysis(repository_id)

    if repository is None or latest_analysis is None:
        return RepositoryIntelligenceSummary(
            repository_id=repository_id,
            health_label="Blocked",
            health_score=0,
            modules_mapped=0,
            risk_signals=0,
            top_hotspot=None,
            next_action="Run the first architecture analysis.",
            rationale="Codara needs an analysis run before it can score architecture health or recommend a module path.",
        )

    analyzer_result = get_live_analyzer_result(latest_analysis.id)
    generated_issues = get_analysis_issues(latest_analysis.id)
    top_module = max(
        analyzer_result.modules,
        key=lambda module: (module.dependency_count, len(module.functions), len(module.classes)),
        default=None,
    )
    health_score = _repository_health_score(analyzer_result, generated_issues)
    health_label = _repository_health_label(health_score, generated_issues)
    next_action = _repository_next_action(analyzer_result, generated_issues, top_module.module_name if top_module else None)

    return RepositoryIntelligenceSummary(
        repository_id=repository_id,
        health_label=health_label,
        health_score=health_score,
        modules_mapped=len(analyzer_result.modules),
        risk_signals=len(generated_issues),
        top_hotspot=top_module.module_name if top_module else None,
        next_action=next_action,
        rationale=_repository_intelligence_rationale(analyzer_result, generated_issues),
    )


def create_analysis(repository_id: str) -> AnalysisJob:
    analyzer_result = analyze_codebase_project(_root_for_repository(repository_id))
    job = AnalysisJob(
        id=f"analysis_{uuid4().hex[:10]}",
        repository_id=repository_id,
        status="completed",
        progress=100,
        files_processed=analyzer_result.files_scanned,
        started_at=utc_now(),
        completed_at=utc_now(),
    )
    analysis_jobs.insert(0, job)
    _save_state()
    return job


def get_analysis(analysis_id: str) -> AnalysisJob | None:
    return next((job for job in analysis_jobs if job.id == analysis_id), None)


def get_latest_analysis(repository_id: str) -> AnalysisJob | None:
    return next((job for job in analysis_jobs if job.repository_id == repository_id), None)


def _timeline_status_for_job(job: AnalysisJob) -> str:
    if job.status == "completed":
        return "done"
    if job.status in {"pending", "processing"}:
        return "running"
    return "blocked"


def _repository_health_score(analyzer_result: AnalyzerResult, generated_issues: list[Issue]) -> int:
    if not analyzer_result.files_scanned:
        return 0

    high_risk_count = len([issue for issue in generated_issues if issue.severity == "high"])
    medium_risk_count = len([issue for issue in generated_issues if issue.severity == "medium"])
    circular_penalty = len(analyzer_result.circular_dependencies) * 14
    hotspot_penalty = len([module for module in analyzer_result.modules if module.dependency_count >= 3]) * 5
    issue_penalty = high_risk_count * 18 + medium_risk_count * 8 + max(0, len(generated_issues) - 4) * 2
    score = 92 - circular_penalty - hotspot_penalty - issue_penalty
    return max(0, min(100, score))


def _repository_health_label(score: int, generated_issues: list[Issue]) -> str:
    if any(issue.severity == "high" for issue in generated_issues) or score < 45:
        return "Blocked"
    if score < 70:
        return "Needs review"
    if score < 86:
        return "Stable"
    return "Strong"


def _repository_next_action(
    analyzer_result: AnalyzerResult,
    generated_issues: list[Issue],
    top_hotspot: str | None,
) -> str:
    high_risk = next((issue for issue in generated_issues if issue.severity == "high"), None)
    if high_risk:
        return f"Open the top high-risk finding: {high_risk.title}."
    if analyzer_result.circular_dependencies:
        return "Trace and break the first circular dependency cycle."
    if top_hotspot:
        return f"Review dependency boundaries around {top_hotspot}."
    if analyzer_result.files_scanned:
        return "Generate the onboarding report and document module ownership."
    return "Upload a supported repository or run analysis on a Python, JavaScript, or TypeScript codebase."


def _repository_intelligence_rationale(analyzer_result: AnalyzerResult, generated_issues: list[Issue]) -> str:
    if not analyzer_result.files_scanned:
        return "No supported code files were available for architecture scoring."
    return (
        f"Score uses {len(analyzer_result.modules)} mapped modules, "
        f"{len(analyzer_result.dependencies)} dependency edges, "
        f"{len(generated_issues)} risk signals, and "
        f"{len(analyzer_result.circular_dependencies)} circular dependency cycles."
    )


def _language_summary(analyzer_result: AnalyzerResult) -> str:
    languages = sorted({module.language for module in analyzer_result.modules})
    if not languages:
        return "Unknown"
    labels = {
        "python": "Python",
        "javascript": "JavaScript",
        "typescript": "TypeScript",
    }
    return " + ".join(labels.get(language, language.title()) for language in languages)


def get_summary(analysis_id: str) -> AnalysisSummary:
    analysis = get_analysis(analysis_id)
    analyzer_result = get_live_analyzer_result(analysis_id)
    generated_issues = get_analysis_issues(analysis_id)
    key_modules = [
        module.module_name
        for module in sorted(
            analyzer_result.modules,
            key=lambda item: item.dependency_count,
            reverse=True,
        )[:5]
    ]
    return AnalysisSummary(
        analysis_id=analysis_id,
        repository_id=analysis.repository_id if analysis else "repo_codara_api",
        modules_mapped=len(analyzer_result.modules),
        risk_signals=len(generated_issues),
        embeddings=analyzer_result.files_scanned * 214,
        summary=(
            "Codara analyzed the source with the multi-language codebase analyzer, mapping modules, "
            "imports, functions, classes, and internal dependency edges."
            if analyzer_result.files_scanned
            else "No supported modules were detected yet. Upload a Python, JavaScript, or TypeScript repository to generate architecture intelligence."
        ),
        key_modules=key_modules,
    )


def get_issues() -> list[Issue]:
    generated = generate_issues(get_live_analyzer_result())
    return generated or issues


def get_analysis_issues(analysis_id: str) -> list[Issue]:
    analyzer_result = get_live_analyzer_result(analysis_id)
    if not analyzer_result.files_scanned:
        return []
    generated = generate_issues(analyzer_result)
    return generated or issues


def get_risk_review_statuses(analysis_id: str) -> list[RiskReviewStatus]:
    issue_ids = {issue.id for issue in get_analysis_issues(analysis_id)}
    saved_statuses = risk_review_statuses.get(analysis_id, {})
    for issue_id in issue_ids:
        saved_statuses.setdefault(
            issue_id,
            RiskReviewStatus(issue_id=issue_id, status="open", note="", updated_at=utc_now()),
        )
    risk_review_statuses[analysis_id] = {
        issue_id: status
        for issue_id, status in saved_statuses.items()
        if issue_id in issue_ids
    }
    return list(risk_review_statuses[analysis_id].values())


def update_risk_review_status(
    analysis_id: str,
    issue_id: str,
    status: str | None = None,
    note: str | None = None,
) -> RiskReviewStatus | None:
    issue_ids = {issue.id for issue in get_analysis_issues(analysis_id)}
    if issue_id not in issue_ids:
        return None
    if status is not None and status not in {"open", "reviewed", "skipped"}:
        return None

    current = risk_review_statuses.setdefault(analysis_id, {}).get(
        issue_id,
        RiskReviewStatus(issue_id=issue_id, status="open", note="", updated_at=utc_now()),
    )

    next_status = RiskReviewStatus(
        issue_id=issue_id,
        status=(status or current.status),  # type: ignore[arg-type]
        note=(note if note is not None else current.note)[:500],
        updated_at=utc_now(),
    )
    risk_review_statuses.setdefault(analysis_id, {})[issue_id] = next_status
    _save_state()
    return next_status


def list_risk_tasks(analysis_id: str) -> list[RiskTask]:
    issue_ids = {issue.id for issue in get_analysis_issues(analysis_id)}
    tasks = [
        task
        for task in risk_tasks.get(analysis_id, [])
        if task.issue_id in issue_ids
    ]
    risk_tasks[analysis_id] = tasks
    return tasks


def list_risk_task_events(analysis_id: str, limit: int = 30) -> list[RiskTaskEvent]:
    return risk_task_events.get(analysis_id, [])[: max(1, min(limit, 100))]


def create_risk_task(analysis_id: str, payload: RiskTaskCreate) -> RiskTask | None:
    issue_ids = {issue.id for issue in get_analysis_issues(analysis_id)}
    if payload.issue_id not in issue_ids:
        return None

    existing = next(
        (task for task in risk_tasks.get(analysis_id, []) if task.issue_id == payload.issue_id),
        None,
    )
    if existing:
        return existing

    now = utc_now()
    task = RiskTask(
        id=f"task_{uuid4().hex[:10]}",
        issue_id=payload.issue_id,
        title=payload.title[:160],
        severity=payload.severity,
        files=payload.files[:8],
        status="todo",
        owner=payload.owner[:48] or "Unassigned",
        priority=payload.priority,
        due_date=payload.due_date,
        note=payload.note[:500],
        created_at=now,
        updated_at=now,
    )
    risk_tasks.setdefault(analysis_id, []).insert(0, task)
    _record_risk_task_event(
        analysis_id,
        task,
        "created",
        None,
        None,
        None,
        f"Created task for {task.title}.",
    )
    _save_state()
    return task


def update_risk_task(
    analysis_id: str,
    task_id: str,
    status: str | None = None,
    owner: str | None = None,
    priority: str | None = None,
    due_date: str | None = None,
    note: str | None = None,
) -> RiskTask | None:
    if status is not None and status not in {"todo", "blocked", "done"}:
        return None
    if priority is not None and priority not in {"low", "medium", "high"}:
        return None
    if status is None and owner is None and priority is None and due_date is None and note is None:
        return None

    tasks = risk_tasks.get(analysis_id, [])
    for index, task in enumerate(tasks):
        if task.id == task_id:
            changes = _risk_task_changes(task, status, owner, priority, due_date, note)
            updated = RiskTask(
                **{
                    **_model_to_dict(task),
                    **({"status": status} if status is not None else {}),
                    **({"owner": owner[:48] or "Unassigned"} if owner is not None else {}),
                    **({"priority": priority} if priority is not None else {}),
                    **({"due_date": due_date or None} if due_date is not None else {}),
                    **({"note": note[:500]} if note is not None else {}),
                    "updated_at": utc_now(),
                }
            )
            tasks[index] = updated
            for field, previous_value, next_value in changes:
                _record_risk_task_event(
                    analysis_id,
                    updated,
                    "updated",
                    field,
                    previous_value,
                    next_value,
                    _risk_task_event_message(field, previous_value, next_value),
                )
            _save_state()
            return updated
    return None


def bulk_update_risk_tasks(
    analysis_id: str,
    task_ids: list[str],
    status: str | None = None,
    owner: str | None = None,
    priority: str | None = None,
    due_date: str | None = None,
    note: str | None = None,
) -> list[RiskTask]:
    updated_tasks = []
    for task_id in task_ids[:100]:
        updated = update_risk_task(analysis_id, task_id, status, owner, priority, due_date, note)
        if updated is not None:
            updated_tasks.append(updated)
    return updated_tasks


def delete_risk_task(analysis_id: str, task_id: str) -> bool:
    tasks = risk_tasks.get(analysis_id, [])
    deleted_task = next((task for task in tasks if task.id == task_id), None)
    next_tasks = [task for task in tasks if task.id != task_id]
    if len(next_tasks) == len(tasks):
        return False
    risk_tasks[analysis_id] = next_tasks
    if deleted_task is not None:
        _record_risk_task_event(
            analysis_id,
            deleted_task,
            "deleted",
            None,
            None,
            None,
            f"Removed task: {deleted_task.title}.",
        )
    _save_state()
    return True


def search_analysis(analysis_id: str, query: str) -> list[SearchResult]:
    analyzer_result = get_live_analyzer_result(analysis_id)
    terms = [term for term in query.lower().replace("_", " ").replace("-", " ").split() if term]
    if not terms:
        return []

    results: list[SearchResult] = []
    for module in analyzer_result.modules:
        candidates = [
            ("module", module.module_name),
            ("path", module.path),
            *[("function", function) for function in module.functions],
            *[("class", class_name) for class_name in module.classes],
            *[("import", import_name) for import_name in module.imports],
        ]
        best_match: tuple[str, str, int] | None = None
        for match_type, value in candidates:
            score = _search_score(value, terms)
            if score and (best_match is None or score > best_match[2]):
                best_match = (match_type, value, score)

        if best_match:
            results.append(
                SearchResult(
                    module_name=module.module_name,
                    path=module.path,
                    match_type=best_match[0],  # type: ignore[arg-type]
                    matched_text=best_match[1],
                    score=best_match[2] + module.dependency_count,
                    functions=module.functions[:6],
                    classes=module.classes[:6],
                )
            )

    return sorted(results, key=lambda result: result.score, reverse=True)[:8]


def get_onboarding_report(analysis_id: str) -> OnboardingReport:
    analysis = get_analysis(analysis_id)
    analyzer_result = get_live_analyzer_result(analysis_id)
    generated_issues = get_analysis_issues(analysis_id)
    key_modules = sorted(
        analyzer_result.modules,
        key=lambda module: (module.dependency_count, len(module.functions), len(module.classes)),
        reverse=True,
    )[:6]
    reading_order = [
        OnboardingModule(
            module_name=module.module_name,
            path=module.path,
            reason=_reading_reason(module.dependency_count, len(module.functions), len(module.classes)),
            dependency_count=module.dependency_count,
        )
        for module in key_modules
    ]

    if analyzer_result.files_scanned:
        overview = (
            f"Codara scanned {analyzer_result.files_scanned} supported code files, mapped "
            f"{len(analyzer_result.modules)} modules, and found "
            f"{len(analyzer_result.dependencies)} internal dependency edges."
        )
    else:
        overview = "No supported code modules were found in this analysis yet."

    return OnboardingReport(
        analysis_id=analysis_id,
        repository_id=analysis.repository_id if analysis else "repo_codara_api",
        overview=overview,
        reading_order=reading_order,
        key_risks=generated_issues[:4],
        architecture_recommendations=_architecture_recommendations(analyzer_result, generated_issues),
        refactor_priorities=_refactor_priorities(analyzer_result, generated_issues),
        first_tasks=_first_onboarding_tasks(analyzer_result, generated_issues),
    )


def _reading_reason(dependency_count: int, function_count: int, class_count: int) -> str:
    if dependency_count > 2:
        return "High dependency pressure; read this early to understand architecture boundaries."
    if function_count or class_count:
        return "Contains executable structure that explains how this area behaves."
    return "Small module; skim it to understand package layout."


def _first_onboarding_tasks(analyzer_result: AnalyzerResult, generated_issues: list[Issue]) -> list[str]:
    tasks = [
        "Start with the reading order and open each module detail drawer.",
        "Review the dependency diagram in Service mode, then switch to Risk mode.",
    ]
    if generated_issues:
        tasks.append(f"Inspect the top risk first: {generated_issues[0].title}.")
    if analyzer_result.circular_dependencies:
        tasks.append("Trace circular dependency cycles before attempting refactors.")
    if analyzer_result.files_scanned:
        tasks.append("Use code search to find feature-specific entry points before changing code.")
    return tasks


def _architecture_recommendations(
    analyzer_result: AnalyzerResult,
    generated_issues: list[Issue],
) -> list[ArchitectureRecommendation]:
    recommendations: list[ArchitectureRecommendation] = []
    circular_modules = _modules_in_cycles(analyzer_result)
    dependency_hotspots = sorted(
        [module for module in analyzer_result.modules if module.dependency_count >= 3],
        key=lambda module: module.dependency_count,
        reverse=True,
    )

    if circular_modules:
        recommendations.append(
            ArchitectureRecommendation(
                title="Break circular dependency boundaries",
                priority="high",
                rationale="Codara detected modules that import each other, which makes changes harder to reason about.",
                impact="Cleaner boundaries reduce regression risk and make future AI-assisted refactors safer.",
                related_modules=sorted(circular_modules)[:6],
            )
        )

    if dependency_hotspots:
        recommendations.append(
            ArchitectureRecommendation(
                title="Stabilize high-dependency modules",
                priority="medium" if recommendations else "high",
                rationale="Some modules sit at the center of several dependency paths and may become architecture bottlenecks.",
                impact="Splitting orchestration from domain logic will make diagrams easier to read and onboarding faster.",
                related_modules=[module.module_name for module in dependency_hotspots[:5]],
            )
        )

    if generated_issues:
        issue_files = sorted({file for issue in generated_issues for file in issue.related_files})
        recommendations.append(
            ArchitectureRecommendation(
                title="Treat top risk files as design review candidates",
                priority="medium",
                rationale="The current risk list points to files that should be reviewed before new feature work starts.",
                impact="A short design review now can prevent small code smells from turning into service-level friction.",
                related_modules=issue_files[:6],
            )
        )

    if analyzer_result.files_scanned and not recommendations:
        recommendations.append(
            ArchitectureRecommendation(
                title="Capture module ownership early",
                priority="low",
                rationale="The scan found a small or low-risk codebase, which is a good moment to document ownership.",
                impact="Clear ownership gives new contributors a faster path from question to responsible module.",
                related_modules=[module.module_name for module in analyzer_result.modules[:4]],
            )
        )

    return recommendations[:3]


def _refactor_priorities(
    analyzer_result: AnalyzerResult,
    generated_issues: list[Issue],
) -> list[RefactorPriority]:
    priorities: list[RefactorPriority] = []
    circular_modules = sorted(_modules_in_cycles(analyzer_result))

    if circular_modules:
        priorities.append(
            RefactorPriority(
                title="Extract shared contracts from dependency cycles",
                effort="large",
                reason="Circular imports usually need a boundary module, interface, or shared schema extracted first.",
                target_modules=circular_modules[:6],
            )
        )

    high_risk_files = sorted({
        file
        for issue in generated_issues
        if issue.severity == "high"
        for file in issue.related_files
    })
    if high_risk_files:
        priorities.append(
            RefactorPriority(
                title="Reduce high-risk module complexity",
                effort="medium",
                reason="High-severity signals should be reduced before automated refactoring or LLM code changes are trusted.",
                target_modules=high_risk_files[:6],
            )
        )

    modules_with_many_functions = sorted(
        [module for module in analyzer_result.modules if len(module.functions) >= 8],
        key=lambda module: len(module.functions),
        reverse=True,
    )
    if modules_with_many_functions:
        priorities.append(
            RefactorPriority(
                title="Split broad utility modules by responsibility",
                effort="medium",
                reason="Modules with many functions are harder for new developers and AI tools to summarize accurately.",
                target_modules=[module.module_name for module in modules_with_many_functions[:5]],
            )
        )

    if analyzer_result.files_scanned:
        priorities.append(
            RefactorPriority(
                title="Add architecture notes near entry points",
                effort="small",
                reason="Small documentation near the main entry points improves onboarding without changing runtime behavior.",
                target_modules=[module.module_name for module in analyzer_result.modules[:4]],
            )
        )

    return priorities[:3]


def _modules_in_cycles(analyzer_result: AnalyzerResult) -> set[str]:
    return {
        module_name
        for cycle in analyzer_result.circular_dependencies
        for module_name in cycle
    }


def _search_score(value: str, terms: list[str]) -> int:
    normalized = value.lower().replace("_", " ").replace("-", " ")
    score = 0
    for term in terms:
        if normalized == term:
            score += 12
        elif term in normalized:
            score += 6
        elif any(part.startswith(term) for part in normalized.split(".")):
            score += 4
    return score


def get_diagram(analysis_id: str, mode: str = "service") -> Diagram:
    analyzer_result = get_live_analyzer_result(analysis_id)
    selected_modules = _select_diagram_modules(analyzer_result, mode)
    circular_modules = {
        module_name
        for cycle in analyzer_result.circular_dependencies
        for module_name in cycle
    }
    selected_names = {module.module_name for module in selected_modules}
    live_edges = [
        DiagramEdge(
            source=dependency.source,
            target=dependency.target,
            label=dependency.import_name,
        )
        for dependency in analyzer_result.dependencies
        if dependency.source in selected_names and dependency.target in selected_names
    ]

    if selected_modules:
        return Diagram(
            analysis_id=analysis_id,
            mode=mode,  # type: ignore[arg-type]
            nodes=[
                DiagramNode(
                    id=module.module_name,
                    label=_short_module_label(module.module_name),
                    kind=_diagram_node_kind(module, mode),
                    risk=_diagram_node_risk(module.module_name, module.dependency_count, circular_modules),
                )
                for module in selected_modules
            ],
            edges=live_edges,
        )

    return Diagram(
        analysis_id=analysis_id,
        mode=mode,  # type: ignore[arg-type]
        nodes=[
            DiagramNode(id="frontend", label="Frontend", kind="client"),
            DiagramNode(id="api", label="FastAPI", kind="service"),
            DiagramNode(id="queue", label="Queue", kind="worker"),
            DiagramNode(id="analyzer", label="Analyzer", kind="service", risk="medium"),
            DiagramNode(id="ai", label="AI/RAG", kind="service"),
            DiagramNode(id="vector", label="Vector DB", kind="database", risk="medium"),
            DiagramNode(id="diagram", label="Diagram service", kind="service", risk="high"),
        ],
        edges=[
            DiagramEdge(source="frontend", target="api", label="uploads repo"),
            DiagramEdge(source="api", target="queue", label="creates job"),
            DiagramEdge(source="queue", target="analyzer", label="runs analysis"),
            DiagramEdge(source="analyzer", target="ai", label="chunks context"),
            DiagramEdge(source="ai", target="vector", label="stores embeddings"),
            DiagramEdge(source="analyzer", target="diagram", label="generates graph"),
        ],
    )


def _select_diagram_modules(analyzer_result: AnalyzerResult, mode: str):
    modules = analyzer_result.modules
    if mode == "risk":
        circular_modules = {
            module_name
            for cycle in analyzer_result.circular_dependencies
            for module_name in cycle
        }
        risky_modules = [
            module
            for module in modules
            if module.module_name in circular_modules or module.dependency_count > 1
        ]
        return sorted(
            risky_modules or modules,
            key=lambda module: (
                module.module_name in circular_modules,
                module.dependency_count,
                len(module.imports),
            ),
            reverse=True,
        )[:7]

    if mode == "data":
        return sorted(
            modules,
            key=lambda module: (len(module.imports), len(module.functions), len(module.classes)),
            reverse=True,
        )[:7]

    return sorted(
        modules,
        key=lambda module: module.dependency_count,
        reverse=True,
    )[:7]


def _diagram_node_kind(module, mode: str) -> str:
    if mode == "data":
        if module.classes:
            return "model"
        if module.functions:
            return "logic"
    if mode == "risk":
        return "risk"
    return "module"


def _diagram_node_risk(module_name: str, dependency_count: int, circular_modules: set[str]) -> str | None:
    if module_name in circular_modules:
        return "high"
    if dependency_count > 2:
        return "medium"
    return None


def _short_module_label(module_name: str) -> str:
    if module_name == "__init__":
        return "__init__"
    parts = module_name.split(".")
    return ".".join(parts[-2:]) if len(parts) > 1 else module_name


def get_service_health() -> list[ServiceHealth]:
    return [
        ServiceHealth(service="FastAPI backend", status="healthy", detail="p95 latency 186ms"),
        ServiceHealth(service="Worker queue", status="healthy", detail="4 active, 2 pending"),
        ServiceHealth(service="Vector DB", status="watch", detail="ingestion +18% this hour"),
        ServiceHealth(service="Go collector", status="healthy", detail="scrape interval 15s"),
    ]


def get_log_events(limit: int = 20) -> list[LogEvent]:
    return log_events[:limit]


def get_alert_rules() -> list[AlertRule]:
    return alert_rules


def get_live_analyzer_result(analysis_id: str | None = None) -> AnalyzerResult:
    root = _root_for_analysis(analysis_id) if analysis_id else repository_paths["repo_codara_api"]
    return analyze_codebase_project(root)


def answer_chat(message: str, repository_id: str) -> ChatResponse:
    analysis = get_latest_analysis(repository_id)
    analyzer_result = get_live_analyzer_result(analysis.id if analysis else None)
    return answer_architecture_question(
        message,
        analyzer_result,
        get_analysis_issues(analysis.id) if analysis else get_issues(),
    )


def _root_for_analysis(analysis_id: str | None) -> Path:
    if analysis_id:
        analysis = get_analysis(analysis_id)
        if analysis:
            return _root_for_repository(analysis.repository_id)
    return repository_paths["repo_codara_api"]


def _root_for_repository(repository_id: str) -> Path:
    return repository_paths.get(repository_id, repository_paths["repo_codara_api"])


def _record_risk_task_event(
    analysis_id: str,
    task: RiskTask,
    event_type: str,
    field: str | None,
    previous_value: str | None,
    next_value: str | None,
    message: str,
) -> None:
    event = RiskTaskEvent(
        id=f"event_{uuid4().hex[:10]}",
        task_id=task.id,
        task_title=task.title,
        event_type=event_type,
        field=field,
        previous_value=previous_value,
        next_value=next_value,
        message=message,
        timestamp=utc_now(),
    )
    risk_task_events.setdefault(analysis_id, []).insert(0, event)
    risk_task_events[analysis_id] = risk_task_events[analysis_id][:200]


def _risk_task_changes(
    task: RiskTask,
    status: str | None,
    owner: str | None,
    priority: str | None,
    due_date: str | None,
    note: str | None,
) -> list[tuple[str, str | None, str | None]]:
    requested = {
        "status": status,
        "owner": owner[:48] or "Unassigned" if owner is not None else None,
        "priority": priority,
        "due_date": due_date or None if due_date is not None else None,
        "note": note[:500] if note is not None else None,
    }
    changes = []
    current = _model_to_dict(task)
    for field, next_value in requested.items():
        if field in {"status", "owner", "priority"} and next_value is None:
            continue
        if field == "due_date" and due_date is None:
            continue
        if field == "note" and note is None:
            continue
        previous_value = current.get(field)
        if previous_value != next_value:
            changes.append((field, previous_value, next_value))
    return changes


def _risk_task_event_message(field: str, previous_value: str | None, next_value: str | None) -> str:
    labels = {
        "status": "Status",
        "owner": "Owner",
        "priority": "Priority",
        "due_date": "Due date",
        "note": "Note",
    }
    label = labels.get(field, field)
    if field == "note":
        return "Updated task note."
    return f"{label} changed from {previous_value or 'none'} to {next_value or 'none'}."


def _save_state() -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    custom_repository_ids = {
        repository.id for repository in repositories if repository.id not in DEFAULT_REPOSITORY_IDS
    }
    payload = {
        "repositories": [
            _model_to_dict(repository)
            for repository in repositories
            if repository.id in custom_repository_ids
        ],
        "analysis_jobs": [
            _model_to_dict(job)
            for job in analysis_jobs
            if job.id not in DEFAULT_ANALYSIS_IDS or job.repository_id in custom_repository_ids
        ],
        "repository_paths": {
            repository_id: str(path)
            for repository_id, path in repository_paths.items()
            if repository_id in custom_repository_ids
        },
        "risk_review_statuses": {
            analysis_id: {
                issue_id: _model_to_dict(status)
                for issue_id, status in statuses.items()
            }
            for analysis_id, statuses in risk_review_statuses.items()
        },
        "risk_tasks": {
            analysis_id: [_model_to_dict(task) for task in tasks]
            for analysis_id, tasks in risk_tasks.items()
        },
        "risk_task_events": {
            analysis_id: [_model_to_dict(event) for event in events]
            for analysis_id, events in risk_task_events.items()
        },
    }
    STATE_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _load_state() -> None:
    if not STATE_PATH.exists():
        return

    try:
        payload = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return

    existing_repository_ids = {repository.id for repository in repositories}
    for repository_data in payload.get("repositories", []):
        repository = Repository(**repository_data)
        if repository.id not in existing_repository_ids:
            repositories.insert(0, repository)
            existing_repository_ids.add(repository.id)

    existing_analysis_ids = {job.id for job in analysis_jobs}
    for job_data in payload.get("analysis_jobs", []):
        job = AnalysisJob(**job_data)
        if job.id not in existing_analysis_ids:
            analysis_jobs.insert(0, job)
            existing_analysis_ids.add(job.id)

    for repository_id, path in payload.get("repository_paths", {}).items():
        repository_paths[repository_id] = Path(path)

    for analysis_id, statuses in payload.get("risk_review_statuses", {}).items():
        risk_review_statuses[analysis_id] = {
            issue_id: RiskReviewStatus(**status_data)
            for issue_id, status_data in statuses.items()
        }

    for analysis_id, tasks in payload.get("risk_tasks", {}).items():
        risk_tasks[analysis_id] = [RiskTask(**task_data) for task_data in tasks]

    for analysis_id, events in payload.get("risk_task_events", {}).items():
        risk_task_events[analysis_id] = [RiskTaskEvent(**event_data) for event_data in events]


def _model_to_dict(model) -> dict:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


_load_state()
