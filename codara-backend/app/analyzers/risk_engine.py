from app.schemas import AnalyzerResult, Issue


def generate_issues(result: AnalyzerResult) -> list[Issue]:
    issues: list[Issue] = []
    issues.extend(_dependency_hotspots(result))
    issues.extend(_circular_dependency_issues(result))
    issues.extend(_empty_module_issues(result))
    issues.extend(_isolated_module_issues(result))
    return issues[:12]


def _dependency_hotspots(result: AnalyzerResult) -> list[Issue]:
    hotspots = [
        module
        for module in result.modules
        if module.dependency_count >= 2 and not module.module_name.endswith("__init__")
    ]
    return [
        Issue(
            id=f"hotspot_{_issue_id(module.module_name)}",
            severity="medium",
            type="architecture",
            title=f"Dependency hotspot: {module.module_name}",
            description=(
                f"{module.module_name} imports {module.dependency_count} internal modules. "
                "Review whether orchestration and implementation concerns are mixed."
            ),
            related_files=[module.path],
        )
        for module in hotspots
    ]


def _circular_dependency_issues(result: AnalyzerResult) -> list[Issue]:
    return [
        Issue(
            id=f"cycle_{_issue_id('_'.join(cycle))}",
            severity="high",
            type="architecture",
            title="Circular dependency detected",
            description=f"{cycle[0]} and {cycle[1]} import each other.",
            related_files=_files_for_modules(result, cycle),
        )
        for cycle in result.circular_dependencies
    ]


def _empty_module_issues(result: AnalyzerResult) -> list[Issue]:
    empty_modules = [
        module
        for module in result.modules
        if not module.functions
        and not module.classes
        and module.imports
        and not module.module_name.endswith("__init__")
    ]
    return [
        Issue(
            id=f"thin_{_issue_id(module.module_name)}",
            severity="low",
            type="maintainability",
            title=f"Thin module: {module.module_name}",
            description=(
                f"{module.module_name} imports code but defines no functions or classes. "
                "It may be configuration glue, or it may be ready to simplify."
            ),
            related_files=[module.path],
        )
        for module in empty_modules
    ]


def _isolated_module_issues(result: AnalyzerResult) -> list[Issue]:
    connected = {
        item
        for dependency in result.dependencies
        for item in (dependency.source, dependency.target)
    }
    isolated = [
        module
        for module in result.modules
        if module.module_name not in connected
        and not module.module_name.endswith("__init__")
        and module.module_name != "app"
    ]
    return [
        Issue(
            id=f"isolated_{_issue_id(module.module_name)}",
            severity="low",
            type="maintainability",
            title=f"Isolated module: {module.module_name}",
            description=(
                f"{module.module_name} has no internal dependency edges in this scan. "
                "Confirm whether it is an entry point, a plugin module, or unused code."
            ),
            related_files=[module.path],
        )
        for module in isolated
    ]


def _files_for_modules(result: AnalyzerResult, module_names: list[str]) -> list[str]:
    module_paths = {module.module_name: module.path for module in result.modules}
    return [module_paths[name] for name in module_names if name in module_paths]


def _issue_id(value: str) -> str:
    return (
        value.lower()
        .replace("\\", "_")
        .replace("/", "_")
        .replace(".", "_")
        .replace(" ", "_")
    )
