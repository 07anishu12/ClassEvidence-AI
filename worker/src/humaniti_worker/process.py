"""Local POSIX subprocess limits; never capture or expose diagnostic/media text."""
from __future__ import annotations

import math
import os
import resource
import selectors
import subprocess
import time


def run_bounded(command: list[str], *, timeout: float, max_output: int = 1_000_000,
                max_file_bytes: int = 16_000_000) -> subprocess.CompletedProcess[bytes]:
    if not math.isfinite(timeout) or timeout <= 0:
        raise ValueError("invalid_process_timeout")

    def limits() -> None:
        # All executables are operator-installed, with two compute threads at most.
        resource.setrlimit(resource.RLIMIT_FSIZE, (max_file_bytes, max_file_bytes))
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        resource.setrlimit(resource.RLIMIT_CPU, (math.ceil(timeout * 2), math.ceil(timeout * 2) + 1))
        resource.setrlimit(resource.RLIMIT_AS, (8 * 1024**3, 8 * 1024**3))

    deadline = time.monotonic() + timeout
    with subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                          stderr=subprocess.DEVNULL, preexec_fn=limits) as child:
        assert child.stdout is not None
        output = bytearray()
        try:
            with selectors.DefaultSelector() as selector:
                selector.register(child.stdout, selectors.EVENT_READ)
                while selector.get_map():
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        raise subprocess.TimeoutExpired("local_media_process", timeout)
                    for key, _ in selector.select(remaining):
                        chunk = os.read(key.fd, min(65536, max_output + 1 - len(output)))
                        if not chunk:
                            selector.unregister(key.fileobj)
                            break
                        output.extend(chunk)
                        if len(output) > max_output:
                            raise ValueError("media_output_limit")
            code = child.wait(timeout=max(0.001, deadline - time.monotonic()))
            return subprocess.CompletedProcess([], code, bytes(output), b"")
        except BaseException:
            child.kill()
            child.wait()
            raise
