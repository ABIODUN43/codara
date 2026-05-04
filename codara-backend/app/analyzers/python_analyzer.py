import ast
from pathlib import Path

from app.schemas import AnalyzerResult, CodeModule, ModuleDependency

IGNORED_DIRS = {
    ".git",
    ".venv",
    "__pycache__",
    "node_modules",
    "dist",
    "build",
}


def analyze_python_project(root_path: Path) -> AnalyzerResult:
    root = root_path.resolve()
    python_files = list(_iter_python_files(root))
    raw_modules = [_parse_python_file(root, file_path) for file_path in python_files]
    module_names = {module.module_name for module in raw_modules}
    dependencies = _build_dependencies(raw_modules, module_names)
    dependency_counts = _count_dependencies(dependencies)

    modules = [
        module.model_copy(
            update={"dependency_count": dependency_counts.get(module.module_name, 0)}
        )
        for module in raw_modules
    ]

    return AnalyzerResult(
        root_path=str(root),
        files_scanned=len(python_files),
        modules=modules,
        dependencies=dependencies,
        circular_dependencies=_find_two_way_cycles(dependencies),
    )


def _iter_python_files(root: Path):
    for file_path in root.rglob("*.py"):
        if any(part in IGNORED_DIRS for part in file_path.parts):
            continue
        yield file_path


def _parse_python_file(root: Path, file_path: Path) -> CodeModule:
    relative_path = file_path.relative_to(root)
    module_name = _module_name_from_path(relative_path)
    source = file_path.read_text(encoding="utf-8")

    try:
        tree = ast.parse(source)
    except SyntaxError:
        return CodeModule(
            path=str(relative_path),
            module_name=module_name,
            language="python",
            imports=[],
            functions=[],
            classes=[],
            dependency_count=0,
        )

    imports: list[str] = []
    functions: list[str] = []
    classes: list[str] = []

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imports.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                imports.append("." * node.level + node.module)
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            functions.append(node.name)
        elif isinstance(node, ast.ClassDef):
            classes.append(node.name)

    return CodeModule(
        path=str(relative_path),
        module_name=module_name,
        language="python",
        imports=sorted(set(imports)),
        functions=sorted(set(functions)),
        classes=sorted(set(classes)),
        dependency_count=0,
    )


def _module_name_from_path(relative_path: Path) -> str:
    without_suffix = relative_path.with_suffix("")
    parts = list(without_suffix.parts)
    if parts[-1] == "__init__":
        parts = parts[:-1]
    if not parts:
        return "__init__"
    return ".".join(parts)


def _build_dependencies(
    modules: list[CodeModule],
    module_names: set[str],
) -> list[ModuleDependency]:
    dependencies: list[ModuleDependency] = []

    for module in modules:
        for import_name in module.imports:
            target = _resolve_internal_import(import_name, module_names)
            if target and target != module.module_name:
                dependencies.append(
                    ModuleDependency(
                        source=module.module_name,
                        target=target,
                        import_name=import_name,
                        dependency_type="import",
                    )
                )

    return dependencies


def _resolve_internal_import(import_name: str, module_names: set[str]) -> str | None:
    normalized = import_name.lstrip(".")
    if normalized in module_names:
        return normalized

    parts = normalized.split(".")
    while len(parts) > 1:
        candidate = ".".join(parts)
        if candidate in module_names:
            return candidate
        parts.pop()

    return None


def _count_dependencies(dependencies: list[ModuleDependency]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for dependency in dependencies:
        counts[dependency.source] = counts.get(dependency.source, 0) + 1
    return counts


def _find_two_way_cycles(dependencies: list[ModuleDependency]) -> list[list[str]]:
    edge_set = {(dependency.source, dependency.target) for dependency in dependencies}
    cycles: set[tuple[str, str]] = set()

    for source, target in edge_set:
        if (target, source) in edge_set:
            cycles.add(tuple(sorted((source, target))))

    return [list(cycle) for cycle in sorted(cycles)]
