"""Small CLI and import smoke entry point for the worker package."""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path

from .media import MediaProbeError, MediaProbe, validate_supported_media_type


def smoke_message() -> str:
    """Return a stable message for a dependency-free import smoke check."""

    return "humaniti_worker import ok"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Probe permitted local media metadata")
    parser.add_argument("path", nargs="?", help="local media path")
    parser.add_argument("--mime", help="declared media MIME type")
    parser.add_argument(
        "--smoke", action="store_true", help="verify that the package imports"
    )
    args = parser.parse_args(argv)

    if args.smoke:
        print(smoke_message())
        return 0
    if args.path is None or args.mime is None:
        parser.error("path and --mime are required unless --smoke is used")

    try:
        validate_supported_media_type(Path(args.path).name, args.mime)
        metadata = MediaProbe().probe(args.path)
    except MediaProbeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    print(json.dumps(asdict(metadata), sort_keys=True))
    return 0
