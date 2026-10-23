"""Worker process entry point.

Production persistence is injected through a JobRepository adapter. This
module intentionally refuses to invent a database-backed adapter or run a
fake user-facing analysis when one is not configured.
"""

from __future__ import annotations

import argparse
import json
import sys

from .jobs.tooling import MediaToolUnavailableError, require_media_tools


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run the Humaniti private media worker")
    parser.add_argument("--smoke", action="store_true", help="verify worker imports")
    parser.add_argument("--check-tools", action="store_true", help="check ffmpeg and ffprobe")
    args = parser.parse_args(argv)

    if args.smoke:
        print("humaniti_worker lifecycle import ok")
        return 0
    if args.check_tools:
        try:
            tools = require_media_tools()
        except MediaToolUnavailableError as error:
            print(json.dumps({"status": "blocked", "error": str(error)}))
            return 2
        print(json.dumps({"status": "ok", "ffmpeg": tools.ffmpeg, "ffprobe": tools.ffprobe}))
        return 0

    print(
        "Worker repository adapter is not configured; refusing to start a fake or in-memory production worker.",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
