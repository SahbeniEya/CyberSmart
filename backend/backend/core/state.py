# core/state.py — LangGraph shared state
# This is the "memory" that all nodes in the graph read and write

from typing import TypedDict, Literal, Annotated


class StepResult(TypedDict):
    tool: str
    command: str
    output: str
    timestamp: str


def merge_steps(existing: list, new: list) -> list:
    """Merge function for steps — LangGraph requires this for list fields."""
    return existing + new


class OrchestratorDecision(TypedDict):
    """Record of one routing decision made by the orchestrator."""
    step:        int
    agent:       str    # "web" | "network" | "ad"
    reason:      str
    timestamp:   str


def merge_decisions(existing: list, new: list) -> list:
    return existing + new


class PentestState(TypedDict):
    # Input
    scan_id:     str
    target:      str
    agent_type:  Literal["web", "network", "ad", "unknown"]
    model:       str
    max_steps:   int

    # Orchestrator
    orchestrator_decisions: Annotated[list[OrchestratorDecision], merge_decisions]

    # Runtime
    current_step:   int
    status:         Literal["running", "finished", "error"]
    steps:          Annotated[list[StepResult], merge_steps]

    # Findings (extracted automatically)
    open_ports:      list[str]
    services:        list[str]
    vulnerabilities: list[str]
    cvss_max:        float

    # Output
    report_path: str | None
    error:       str | None
    started_at:  str
    finished_at: str | None