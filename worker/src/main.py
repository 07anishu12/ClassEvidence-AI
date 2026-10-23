"""Executable worker-process wrapper for local deployments."""

from humaniti_worker.main import main


if __name__ == "__main__":
    raise SystemExit(main())
