"""Private deterministic artifact names and temporary workspace handling."""

from __future__ import annotations

import hashlib
import re
import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator


class ArtifactNameError(ValueError):
    """Raised when an artifact kind or extension is unsafe."""


def artifact_name(job_id: str, kind: str, extension: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9_-]+", job_id):
        raise ArtifactNameError("job_id contains unsafe characters")
    if not re.fullmatch(r"[a-z][a-z0-9_-]{0,63}", kind):
        raise ArtifactNameError("artifact kind contains unsafe characters")
    if not re.fullmatch(r"\.[a-z0-9]{1,8}", extension):
        raise ArtifactNameError("artifact extension is unsafe")
    digest = hashlib.sha256(job_id.encode("utf-8")).hexdigest()[:24]
    return f"jobs/{digest}/{kind}{extension}"


@contextmanager
def private_workspace(root: str | Path, job_id: str) -> Iterator[Path]:
    """Yield a private scratch directory and remove it on every exit path."""

    root_path = Path(root)
    root_path.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=f"{job_id[:24]}-", dir=root_path) as directory:
        workspace = Path(directory)
        workspace.chmod(0o700)
        yield workspace
