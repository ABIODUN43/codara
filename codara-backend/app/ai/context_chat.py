from app.schemas import AnalyzerResult, ChatResponse, Issue


def answer_architecture_question(
    message: str,
    analyzer_result: AnalyzerResult,
    issues: list[Issue],
) -> ChatResponse:
    query = message.lower()

    if _mentions(query, ["risk", "issue", "problem", "smell", "warning"]):
        return _risk_answer(issues)

    if _mentions(query, ["dependency", "dependencies", "import", "edge", "graph"]):
        return _dependency_answer(analyzer_result)

    if _mentions(query, ["module", "file", "structure", "where", "handling"]):
        return _module_answer(query, analyzer_result)

    if _mentions(query, ["onboard", "onboarding", "new developer", "explain"]):
        return _onboarding_answer(analyzer_result, issues)

    return _overview_answer(analyzer_result, issues)


def _risk_answer(issues: list[Issue]) -> ChatResponse:
    top_issues = issues[:3]
    if not top_issues:
        return ChatResponse(
            answer="I did not find architecture risk signals in the current analyzer scan.",
            cited_files=[],
            related_nodes=[],
        )

    issue_lines = [
        f"{issue.severity.upper()}: {issue.title} - {issue.description}"
        for issue in top_issues
    ]
    cited_files = _unique_file_list(top_issues)
    return ChatResponse(
        answer="The main risk signals are: " + " ".join(issue_lines),
        cited_files=cited_files,
        related_nodes=_nodes_from_files(cited_files),
    )


def _dependency_answer(result: AnalyzerResult) -> ChatResponse:
    dependencies = result.dependencies[:6]
    if not dependencies:
        return ChatResponse(
            answer="I did not find internal dependency edges in the current scan.",
            cited_files=[],
            related_nodes=[],
        )

    edge_text = [
        f"{dependency.source} imports {dependency.target}"
        for dependency in dependencies
    ]
    module_paths = {module.module_name: module.path for module in result.modules}
    cited_files = [
        module_paths[name]
        for dependency in dependencies
        for name in (dependency.source, dependency.target)
        if name in module_paths
    ]
    return ChatResponse(
        answer="The live dependency graph shows: " + "; ".join(edge_text) + ".",
        cited_files=sorted(set(cited_files)),
        related_nodes=sorted({dependency.source for dependency in dependencies}),
    )


def _module_answer(query: str, result: AnalyzerResult) -> ChatResponse:
    matches = [
        module
        for module in result.modules
        if query in module.module_name.lower()
        or any(part in query for part in module.module_name.lower().split("."))
        or any(function.lower() in query for function in module.functions)
        or any(class_name.lower() in query for class_name in module.classes)
    ]
    if not matches:
        matches = sorted(
            result.modules,
            key=lambda module: module.dependency_count,
            reverse=True,
        )[:4]

    module_lines = [
        (
            f"{module.module_name} defines {len(module.functions)} functions, "
            f"{len(module.classes)} classes, and imports {module.dependency_count} internal modules"
        )
        for module in matches[:5]
    ]
    return ChatResponse(
        answer="Relevant modules: " + "; ".join(module_lines) + ".",
        cited_files=[module.path for module in matches[:5]],
        related_nodes=[module.module_name for module in matches[:5]],
    )


def _onboarding_answer(result: AnalyzerResult, issues: list[Issue]) -> ChatResponse:
    key_modules = sorted(
        result.modules,
        key=lambda module: (module.dependency_count, len(module.functions)),
        reverse=True,
    )[:5]
    module_text = ", ".join(module.module_name for module in key_modules)
    risk_text = f" I would also review {issues[0].title.lower()} first." if issues else ""
    return ChatResponse(
        answer=(
            f"For onboarding, start with these key modules: {module_text}. "
            "Read them in dependency order, then inspect the generated diagram to understand how data moves."
            f"{risk_text}"
        ),
        cited_files=[module.path for module in key_modules],
        related_nodes=[module.module_name for module in key_modules],
    )


def _overview_answer(result: AnalyzerResult, issues: list[Issue]) -> ChatResponse:
    hotspots = sorted(
        result.modules,
        key=lambda module: module.dependency_count,
        reverse=True,
    )[:3]
    hotspot_text = ", ".join(module.module_name for module in hotspots)
    return ChatResponse(
        answer=(
            f"I scanned {result.files_scanned} Python files and mapped {len(result.modules)} modules "
            f"with {len(result.dependencies)} internal dependency edges. "
            f"The most connected modules are {hotspot_text}. "
            f"I found {len(issues)} risk signals from the current analyzer rules."
        ),
        cited_files=[module.path for module in hotspots],
        related_nodes=[module.module_name for module in hotspots],
    )


def _mentions(query: str, words: list[str]) -> bool:
    return any(word in query for word in words)


def _unique_file_list(issues: list[Issue]) -> list[str]:
    return sorted({file for issue in issues for file in issue.related_files})


def _nodes_from_files(files: list[str]) -> list[str]:
    return [file.replace("\\", ".").replace("/", ".").removesuffix(".py") for file in files]
