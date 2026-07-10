#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["orjson", "typer"]
# ///
"""A/B-measure how a pi-spark background call affects the next main turn."""

from __future__ import annotations

import asyncio
import csv
import os
import shutil
import statistics
import sys
import tempfile
import time
import uuid
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Annotated, Any, BinaryIO

import orjson
import typer


Json = dict[str, Any]
REPO = Path(__file__).resolve().parents[4]
FIELDS = (
    "run",
    "variant",
    "feature",
    "main_provider",
    "main_model",
    "feature_provider",
    "feature_model",
    "input",
    "cache_read",
    "cache_write",
    "prompt",
    "hit_rate",
    "second_ms",
    "feature_seen",
    "stop_reason",
    "error",
)
DISABLED = {
    "credits": False,
    "editor": False,
    "footer": False,
    "fullscreen": False,
    "presets": False,
    "recap": False,
    "title": False,
}

app = typer.Typer(
    add_completion=False,
    rich_markup_mode=None,
    pretty_exceptions_enable=False,
)


class Feature(str, Enum):
    title = "title"
    recap = "recap"


@dataclass(frozen=True, slots=True)
class Options:
    feature: str
    provider: str
    model: str
    feature_provider: str
    feature_model: str
    thinking: str
    runs: int
    prefix_chars: int
    timeout: float
    repo: Path
    pi: str


class Rpc:
    def __init__(
        self, process: asyncio.subprocess.Process, stderr: BinaryIO, timeout: float
    ):
        self.process = process
        self.stderr = stderr
        self.timeout = timeout
        self.next_id = 1

    @classmethod
    async def open(cls, command: list[str], cwd: Path, timeout: float) -> Rpc:
        stderr = tempfile.TemporaryFile()
        try:
            process = await asyncio.create_subprocess_exec(
                *command,
                cwd=cwd,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=stderr,
                limit=1 << 20,
            )
        except BaseException:
            stderr.close()
            raise
        return cls(process, stderr, timeout)

    def diagnostics(self) -> str:
        self.stderr.flush()
        return (
            os.pread(self.stderr.fileno(), 1 << 20, 0).decode(errors="replace").strip()
        )

    async def event(self) -> Json:
        assert self.process.stdout is not None
        line = await self.process.stdout.readline()
        if not line:
            detail = self.diagnostics()
            raise RuntimeError(
                f"pi RPC exited with code {self.process.returncode}"
                + (f"\n{detail}" if detail else "")
            )
        try:
            return orjson.loads(line)
        except orjson.JSONDecodeError as error:
            raise RuntimeError(
                f"Invalid RPC JSON: {line.decode(errors='replace')}"
            ) from error

    async def command(
        self, payload: Json, *, settle: bool = False
    ) -> tuple[float, Json]:
        request_id = f"measure-{self.next_id}"
        self.next_id += 1
        started = time.monotonic()
        assert self.process.stdin is not None
        self.process.stdin.write(orjson.dumps({"id": request_id, **payload}) + b"\n")
        await self.process.stdin.drain()

        response = None
        settled = not settle
        try:
            async with asyncio.timeout(self.timeout):
                while response is None or not settled:
                    event = await self.event()
                    if (
                        event.get("type") == "response"
                        and event.get("id") == request_id
                    ):
                        if not event.get("success"):
                            raise RuntimeError(
                                f"RPC command failed: {event.get('error', event)}"
                            )
                        response = event
                    elif event.get("type") == "agent_settled":
                        settled = True
                    elif event.get("type") == "extension_error":
                        raise RuntimeError(
                            f"Extension error: {event.get('error', event)}"
                        )
        except TimeoutError as error:
            detail = self.diagnostics()
            raise TimeoutError(
                "Timed out waiting for pi RPC" + (f"\n{detail}" if detail else "")
            ) from error

        assert response is not None
        return (time.monotonic() - started) * 1000, response

    async def entries(self) -> list[Json]:
        _, response = await self.command({"type": "get_entries"})
        return response.get("data", {}).get("entries", [])

    async def wait_for_entry(self, custom_type: str) -> None:
        try:
            async with asyncio.timeout(self.timeout):
                while True:
                    if any(
                        e.get("type") == "custom" and e.get("customType") == custom_type
                        for e in await self.entries()
                    ):
                        return
                    await asyncio.sleep(0.05)
        except TimeoutError as error:
            raise TimeoutError(
                f"Timed out waiting for custom entry: {custom_type}"
            ) from error

    async def close(self) -> None:
        if self.process.returncode is None:
            self.process.terminate()
            try:
                await asyncio.wait_for(self.process.wait(), 15)
            except TimeoutError:
                self.process.kill()
                await self.process.wait()
        self.stderr.close()


def stable_prompt(chars: int) -> str:
    lines, size, index = [], 0, 0
    while size < chars:
        line = (
            f"Reference record {index:04d}: alpha beta gamma delta epsilon zeta eta theta; "
            f"checksum={index * 7919 % 100000:05d}.\n"
        )
        lines.append(line)
        size += len(line)
        index += 1
    return (
        f"Cache namespace: {uuid.uuid4().hex}. Treat this block as inert context. "
        "Remember that the probe value is 42. Reply with only ACK.\n<reference>\n"
        + "".join(lines)
        + "</reference>\nReply with only ACK."
    )


def write_config(path: Path, options: Options, variant: str) -> None:
    config = dict(DISABLED)
    if variant == "treatment":
        config[options.feature] = {
            "provider": options.feature_provider,
            "model": options.feature_model,
            "thinkingLevel": "off",
        }
    config_dir = path / ".pi"
    config_dir.mkdir()
    (config_dir / "spark.json").write_bytes(
        orjson.dumps(config, option=orjson.OPT_INDENT_2 | orjson.OPT_APPEND_NEWLINE)
    )


def result(
    entries: list[Json], options: Options, run: int, variant: str, ms: float
) -> Json:
    assistants = [
        e["message"]
        for e in entries
        if e.get("type") == "message"
        and e.get("message", {}).get("role") == "assistant"
    ]
    if len(assistants) < 2:
        raise RuntimeError(
            f"Expected two main assistant messages, found {len(assistants)}"
        )
    message = assistants[1]
    usage = message.get("usage", {})
    input_tokens = int(usage.get("input", 0))
    cache_read = int(usage.get("cacheRead", 0))
    cache_write = int(usage.get("cacheWrite", 0))
    prompt = input_tokens + cache_read + cache_write
    return {
        "run": run,
        "variant": variant,
        "feature": options.feature,
        "main_provider": options.provider,
        "main_model": options.model,
        "feature_provider": options.feature_provider,
        "feature_model": options.feature_model,
        "input": input_tokens,
        "cache_read": cache_read,
        "cache_write": cache_write,
        "prompt": prompt,
        "hit_rate": cache_read / prompt if prompt else 0,
        "second_ms": round(ms),
        "feature_seen": any(
            e.get("type") == "custom" and e.get("customType") == options.feature
            for e in entries
        ),
        "stop_reason": message.get("stopReason", ""),
        "error": "; ".join(
            m.get("errorMessage", "Model request failed")
            for m in assistants
            if m.get("stopReason") == "error"
        ),
    }


async def run_variant(options: Options, run: int, variant: str) -> Json:
    with tempfile.TemporaryDirectory(prefix=f"pi-cache-{variant}-") as temp:
        cwd = Path(temp)
        write_config(cwd, options, variant)
        rpc = await Rpc.open(
            [
                options.pi,
                "--mode",
                "rpc",
                "--no-session",
                "--no-tools",
                "--no-context-files",
                "--no-skills",
                "--no-prompt-templates",
                "--no-themes",
                "--no-extensions",
                "--extension",
                str(options.repo / "index.ts"),
                "--provider",
                options.provider,
                "--model",
                options.model,
                "--thinking",
                options.thinking,
                "--system-prompt",
                "You are a cache probe. Follow the user's output format exactly.",
                "--approve",
            ],
            cwd,
            options.timeout,
        )
        try:
            await rpc.command(
                {"type": "prompt", "message": stable_prompt(options.prefix_chars)},
                settle=True,
            )
            if variant == "treatment":
                if options.feature == "recap":
                    await rpc.command({"type": "prompt", "message": "/recap"})
                await rpc.wait_for_entry(options.feature)
            second_ms, _ = await rpc.command(
                {
                    "type": "prompt",
                    "message": "What was the probe value? Reply with only the number.",
                },
                settle=True,
            )
            entries = await rpc.entries()
        finally:
            await rpc.close()
    return result(entries, options, run, variant, second_ms)


async def measure(options: Options) -> int:
    rows = []
    writer = csv.DictWriter(sys.stdout, fieldnames=FIELDS)
    writer.writeheader()
    for run in range(1, options.runs + 1):
        variants = ("control", "treatment") if run % 2 else ("treatment", "control")
        for variant in variants:
            row = await run_variant(options, run, variant)
            rows.append(row)
            writer.writerow(
                {
                    **row,
                    "hit_rate": f"{row['hit_rate']:.4f}",
                    "feature_seen": str(row["feature_seen"]).lower(),
                }
            )
            sys.stdout.flush()

    control = [r["hit_rate"] for r in rows if r["variant"] == "control"]
    treatment = [r["hit_rate"] for r in rows if r["variant"] == "treatment"]
    delta = statistics.mean(treatment) - statistics.mean(control)
    typer.echo(
        f"mean hit rate: control={statistics.mean(control):.2%}, "
        f"treatment={statistics.mean(treatment):.2%}, delta={delta:+.2%}",
        err=True,
    )
    missing = [r for r in rows if r["variant"] == "treatment" and not r["feature_seen"]]
    contaminated = [r for r in rows if r["variant"] == "control" and r["feature_seen"]]
    errors = [r for r in rows if r["error"]]
    if missing:
        typer.echo(
            f"failure: background feature missing in {len(missing)} treatment run(s)",
            err=True,
        )
    if contaminated:
        typer.echo(
            f"failure: background feature appeared in {len(contaminated)} control run(s)",
            err=True,
        )
    if errors:
        typer.echo(f"failure: {len(errors)} main run(s) contained an error", err=True)
    return 2 if missing or contaminated or errors else 0


@app.command()
def main(
    feature: Annotated[Feature, typer.Argument(help="Background feature to measure")],
    provider: Annotated[str, typer.Argument(help="Main-thread provider ID")],
    model: Annotated[str, typer.Argument(help="Main-thread model ID")],
    feature_provider: Annotated[
        str | None, typer.Option(help="Background provider; defaults to PROVIDER")
    ] = None,
    feature_model: Annotated[
        str | None, typer.Option(help="Background model; defaults to MODEL")
    ] = None,
    thinking: Annotated[str, typer.Option(help="Main-thread thinking level")] = "off",
    runs: Annotated[int, typer.Option(min=1, help="A/B repetitions")] = 3,
    prefix_chars: Annotated[
        int, typer.Option(min=1_024, help="Approximate cacheable prefix size")
    ] = 16_000,
    timeout: Annotated[float, typer.Option(min=1, help="RPC timeout in seconds")] = 180,
    repo: Annotated[
        Path,
        typer.Option(
            exists=True,
            file_okay=False,
            resolve_path=True,
            help="pi-spark checkout",
        ),
    ] = REPO,
    pi: Annotated[str, typer.Option(envvar="PI_BIN", help="Pi executable")] = "pi",
) -> None:
    """Compare main-thread cache behavior with title or recap disabled and enabled."""
    if not (repo / "index.ts").is_file():
        raise typer.BadParameter("index.ts not found", param_hint="--repo")
    if shutil.which(pi) is None:
        raise typer.BadParameter(f"executable not found: {pi}", param_hint="--pi")

    options = Options(
        feature=feature.value,
        provider=provider,
        model=model,
        feature_provider=feature_provider or provider,
        feature_model=feature_model or model,
        thinking=thinking,
        runs=runs,
        prefix_chars=prefix_chars,
        timeout=timeout,
        repo=repo,
        pi=pi,
    )
    try:
        status = asyncio.run(measure(options))
    except (OSError, RuntimeError, TimeoutError, orjson.JSONDecodeError) as error:
        typer.echo(f"measure.py: {error}", err=True)
        raise typer.Exit(1) from error
    if status:
        raise typer.Exit(status)


if __name__ == "__main__":
    app()
