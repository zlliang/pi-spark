#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["orjson", "typer"]
# ///
"""Measure prompt and output tokens from one minimal Pi turn."""

from __future__ import annotations

import csv
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Annotated, Any

import orjson
import typer

app = typer.Typer(
    add_completion=False,
    rich_markup_mode=None,
    pretty_exceptions_enable=False,
)


def first_assistant(session_file: Path) -> dict[str, Any]:
    with session_file.open("rb") as source:
        for line in source:
            entry = orjson.loads(line)
            message = entry.get("message", {})
            if entry.get("type") == "message" and message.get("role") == "assistant":
                return message
    raise RuntimeError(f"No assistant message found in {session_file}")


@app.command(
    context_settings={"allow_extra_args": True, "ignore_unknown_options": True}
)
def measure(
    ctx: typer.Context,
    label: Annotated[str, typer.Argument(help="CSV label for this measurement")],
    provider: Annotated[str, typer.Argument(help="Pi provider ID")],
    model: Annotated[str, typer.Argument(help="Pi model ID")],
    timeout: Annotated[float, typer.Option(min=1, help="Pi timeout in seconds")] = 180,
    pi: Annotated[str, typer.Option(envvar="PI_BIN", help="Pi executable")] = "pi",
) -> None:
    """Runs one minimal Pi turn and prints label,provider,model,prompt,output as CSV."""
    if shutil.which(pi) is None:
        raise typer.BadParameter(f"executable not found: {pi}", param_hint="--pi")

    with tempfile.TemporaryDirectory(prefix="pi-token-usage-") as temp:
        session_dir = Path(temp) / "session"
        session_dir.mkdir()
        result = subprocess.run(
            [
                pi,
                "-ne",
                "-nc",
                "-ns",
                "-np",
                "--session-dir",
                str(session_dir),
                "--provider",
                provider,
                "--model",
                model,
                *ctx.args,
                "-p",
                "hi",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
            timeout=timeout,
        )

        files = list(session_dir.rglob("*.jsonl"))
        if len(files) != 1:
            detail = result.stderr.strip() or f"pi exited with code {result.returncode}"
            raise RuntimeError(
                f"Expected one session file, found {len(files)}: {detail}"
            )

        message = first_assistant(files[0])
        usage = message.get("usage", {})
        prompt = sum(
            int(usage.get(key, 0)) for key in ("input", "cacheRead", "cacheWrite")
        )
        csv.writer(sys.stdout).writerow(
            [label, provider, model, prompt, int(usage.get("output", 0))]
        )

        if message.get("stopReason") == "error":
            typer.echo(message.get("errorMessage", "Model request failed"), err=True)
            raise typer.Exit(2)


if __name__ == "__main__":
    try:
        app()
    except (
        OSError,
        RuntimeError,
        subprocess.TimeoutExpired,
        orjson.JSONDecodeError,
    ) as error:
        typer.echo(f"measure.py: {error}", err=True)
        raise typer.Exit(1) from error
