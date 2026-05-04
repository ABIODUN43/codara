import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.schemas import AnalyzerResult, ChatResponse, Issue


OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"


def answer_with_llm(
    message: str,
    analyzer_result: AnalyzerResult,
    issues: list[Issue],
) -> ChatResponse | None:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None

    module_context = "\n".join(
        (
            f"- {module.module_name} ({module.path}): "
            f"{len(module.functions)} functions, {len(module.classes)} classes, "
            f"{module.dependency_count} internal imports"
        )
        for module in sorted(
            analyzer_result.modules,
            key=lambda item: (item.dependency_count, len(item.functions), len(item.classes)),
            reverse=True,
        )[:12]
    )
    issue_context = "\n".join(
        f"- {issue.severity}: {issue.title} ({', '.join(issue.related_files)}) - {issue.description}"
        for issue in issues[:10]
    )

    payload = {
        "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are Codara, an architecture assistant. Give practical, concise architecture "
                    "answers grounded in the provided repository facts. Mention relevant files when useful."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Question: {message}\n\n"
                    f"Repository facts: {analyzer_result.files_scanned} files, "
                    f"{len(analyzer_result.modules)} modules, {len(analyzer_result.dependencies)} dependency edges.\n\n"
                    f"Key modules:\n{module_context or 'No modules mapped.'}\n\n"
                    f"Risk signals:\n{issue_context or 'No risk signals.'}"
                ),
            },
        ],
        "temperature": 0.2,
        "max_tokens": 500,
    }

    request = Request(
        OPENAI_CHAT_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=30) as response:
            data = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
        return None

    answer = data.get("choices", [{}])[0].get("message", {}).get("content")
    if not answer:
        return None

    cited_files = _best_cited_files(analyzer_result, issues)
    return ChatResponse(
        answer=answer,
        cited_files=cited_files,
        related_nodes=[module.module_name for module in analyzer_result.modules[:5]],
    )


def _best_cited_files(analyzer_result: AnalyzerResult, issues: list[Issue]) -> list[str]:
    issue_files = [file for issue in issues[:5] for file in issue.related_files]
    module_files = [
        module.path
        for module in sorted(analyzer_result.modules, key=lambda item: item.dependency_count, reverse=True)[:5]
    ]
    return list(dict.fromkeys(issue_files + module_files))[:8]
