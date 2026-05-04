from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from uuid import uuid4
from zipfile import BadZipFile, ZipFile

from fastapi import HTTPException, UploadFile

UPLOAD_ROOT = Path(__file__).resolve().parents[2] / "storage" / "repositories"
MAX_UPLOAD_BYTES = 25 * 1024 * 1024
MAX_GITHUB_BYTES = 50 * 1024 * 1024


async def save_repository_zip(file: UploadFile) -> tuple[str, Path]:
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Upload must be a .zip file")

    safe_name = _safe_name(Path(file.filename).stem)
    repository_id = f"repo_{safe_name}_{uuid4().hex[:8]}"
    destination = UPLOAD_ROOT / repository_id
    archive_path = destination / "source.zip"
    extracted_path = destination / "source"

    destination.mkdir(parents=True, exist_ok=True)

    size = 0
    with archive_path.open("wb") as output:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                raise HTTPException(status_code=413, detail="Upload exceeds 25 MB limit")
            output.write(chunk)

    try:
        _extract_zip_safely(archive_path, extracted_path)
    except BadZipFile as exc:
        raise HTTPException(status_code=400, detail="Invalid ZIP archive") from exc

    return repository_id, _find_project_root(extracted_path)


def fetch_github_repository(url: str, name: str | None = None, branch: str | None = None) -> tuple[str, str, Path]:
    owner, repo, inferred_branch = _parse_github_url(url)
    selected_branch = branch or inferred_branch or "main"
    safe_name = _safe_name(name or repo)
    repository_id = f"repo_{safe_name}_{uuid4().hex[:8]}"
    destination = UPLOAD_ROOT / repository_id
    archive_path = destination / "source.zip"
    extracted_path = destination / "source"
    destination.mkdir(parents=True, exist_ok=True)

    archive_url = f"https://codeload.github.com/{owner}/{repo}/zip/refs/heads/{selected_branch}"
    try:
        _download_to_file(archive_url, archive_path, MAX_GITHUB_BYTES)
    except HTTPException:
        if branch or selected_branch == "master":
            raise
        selected_branch = "master"
        archive_url = f"https://codeload.github.com/{owner}/{repo}/zip/refs/heads/{selected_branch}"
        _download_to_file(archive_url, archive_path, MAX_GITHUB_BYTES)

    try:
        _extract_zip_safely(archive_path, extracted_path)
    except BadZipFile as exc:
        raise HTTPException(status_code=400, detail="GitHub archive is not a valid ZIP") from exc

    return repository_id, f"{owner}/{repo}", _find_project_root(extracted_path)


def _download_to_file(url: str, destination: Path, max_bytes: int) -> None:
    request = Request(url, headers={"User-Agent": "Codara/0.1"})
    try:
        with urlopen(request, timeout=30) as response, destination.open("wb") as output:
            size = 0
            while chunk := response.read(1024 * 1024):
                size += len(chunk)
                if size > max_bytes:
                    raise HTTPException(status_code=413, detail="GitHub repository archive exceeds 50 MB limit")
                output.write(chunk)
    except HTTPError as exc:
        raise HTTPException(status_code=400, detail=f"GitHub repository could not be fetched: HTTP {exc.code}") from exc
    except URLError as exc:
        raise HTTPException(status_code=400, detail="GitHub repository could not be fetched") from exc


def _parse_github_url(url: str) -> tuple[str, str, str | None]:
    parsed = urlparse(url.strip())
    if parsed.netloc.lower() not in {"github.com", "www.github.com"}:
        raise HTTPException(status_code=400, detail="Only public github.com repository URLs are supported")

    parts = [part for part in parsed.path.strip("/").split("/") if part]
    if len(parts) < 2:
        raise HTTPException(status_code=400, detail="GitHub URL must include owner and repository")

    owner = parts[0]
    repo = parts[1].removesuffix(".git")
    branch = None
    if len(parts) >= 4 and parts[2] == "tree":
        branch = parts[3]
    return owner, repo, branch


def _extract_zip_safely(archive_path: Path, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    destination_root = destination.resolve()

    with ZipFile(archive_path) as archive:
        for member in archive.infolist():
            target = (destination / member.filename).resolve()
            if not str(target).startswith(str(destination_root)):
                raise HTTPException(status_code=400, detail="ZIP contains unsafe paths")
            if member.is_dir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(member) as source, target.open("wb") as output:
                    output.write(source.read())


def _find_project_root(extracted_path: Path) -> Path:
    children = [child for child in extracted_path.iterdir() if child.name != "__MACOSX"]
    directories = [child for child in children if child.is_dir()]
    files = [child for child in children if child.is_file()]
    if len(directories) == 1 and not files:
        return directories[0]
    return extracted_path


def _safe_name(value: str) -> str:
    cleaned = "".join(char.lower() if char.isalnum() else "-" for char in value)
    return "-".join(part for part in cleaned.split("-") if part)[:40] or "repository"
