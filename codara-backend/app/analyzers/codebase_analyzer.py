import re
from pathlib import Path

from app.analyzers.python_analyzer import IGNORED_DIRS, analyze_python_project
from app.schemas import AnalyzerResult, CodeModule, ModuleDependency

CODE_EXTENSIONS = {".js", ".jsx", ".ts", ".tsx"}


def analyze_codebase_project(root_path: Path) -> AnalyzerResult:
    python_result = analyze_python_project(root_path)
    js_modules, js_dependencies = _analyze_js_ts_project(root_path)
    dependencies = python_result.dependencies + js_dependencies
    dependency_counts = _count_dependencies(dependencies)
    modules = [
        module.model_copy(update={"dependency_count": dependency_counts.get(module.module_name, 0)})
        for module in [*python_result.modules, *js_modules]
    ]

    return AnalyzerResult(
        root_path=python_result.root_path,
        files_scanned=python_result.files_scanned + len(js_modules),
        modules=modules,
        dependencies=dependencies,
        circular_dependencies=_find_two_way_cycles(dependencies),
    )


def _analyze_js_ts_project(root_path: Path) -> tuple[list[CodeModule], list[ModuleDependency]]:
    root = root_path.resolve()
    files = list(_iter_code_files(root))
    modules = [_parse_code_file(root, file_path) for file_path in files]
    module_names = {module.module_name for module in modules}
    path_to_module = {Path(module.path).with_suffix("").as_posix(): module.module_name for module in modules}
    dependencies = _build_code_dependencies(modules, module_names, path_to_module)
    return modules, dependencies


def _iter_code_files(root: Path):
    for file_path in root.rglob("*"):
        if file_path.suffix.lower() not in CODE_EXTENSIONS:
            continue
        if any(part in IGNORED_DIRS for part in file_path.parts):
            continue
        if file_path.name.endswith(".d.ts"):
            continue
        yield file_path


def _parse_code_file(root: Path, file_path: Path) -> CodeModule:
    relative_path = file_path.relative_to(root)
    source = file_path.read_text(encoding="utf-8", errors="ignore")
    language = "typescript" if file_path.suffix.lower() in {".ts", ".tsx"} else "javascript"
    return CodeModule(
        path=str(relative_path),
        module_name=_module_name_from_path(relative_path),
        language=language,
        imports=sorted(set(_extract_imports(source))),
        functions=sorted(set(_extract_functions(source))),
        classes=sorted(set(_extract_classes(source))),
        dependency_count=0,
    )


def _extract_imports(source: str) -> list[str]:
    imports = []
    imports.extend(re.findall(r"import\s+(?:[^'\"\n]+?\s+from\s+)?['\"]([^'\"]+)['\"]", source))
    imports.extend(re.findall(r"require\(\s*['\"]([^'\"]+)['\"]\s*\)", source))
    imports.extend(re.findall(r"import\(\s*['\"]([^'\"]+)['\"]\s*\)", source))
    return imports


def _extract_functions(source: str) -> list[str]:
    functions = []
    functions.extend(re.findall(r"\bfunction\s+([A-Za-z_$][\w$]*)\s*\(", source))
    functions.extend(re.findall(r"\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>", source))
    functions.extend(re.findall(r"\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?function\b", source))
    functions.extend(re.findall(r"\bexport\s+default\s+function\s+([A-Za-z_$][\w$]*)?\s*\(", source))
    return [name or "default" for name in functions]


def _extract_classes(source: str) -> list[str]:
    return re.findall(r"\bclass\s+([A-Za-z_$][\w$]*)\b", source)


def _build_code_dependencies(
    modules: list[CodeModule],
    module_names: set[str],
    path_to_module: dict[str, str],
) -> list[ModuleDependency]:
    dependencies: list[ModuleDependency] = []
    for module in modules:
        source_dir = Path(module.path).parent
        for import_name in module.imports:
            target = _resolve_code_import(source_dir, import_name, module_names, path_to_module)
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


def _resolve_code_import(
    source_dir: Path,
    import_name: str,
    module_names: set[str],
    path_to_module: dict[str, str],
) -> str | None:
    if not import_name.startswith("."):
        return None

    candidate_path = (source_dir / import_name).as_posix()
    candidate_path = str(Path(candidate_path)).replace("\\", "/")
    candidates = [
        candidate_path,
        f"{candidate_path}/index",
    ]
    for candidate in candidates:
        if candidate in path_to_module:
            return path_to_module[candidate]
        if candidate in module_names:
            return candidate
    return None


def _module_name_from_path(relative_path: Path) -> str:
    without_suffix = relative_path.with_suffix("")
    if without_suffix.name == "index":
        return without_suffix.parent.as_posix() or "index"
    return without_suffix.as_posix()


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
