# core/graph.py — LangGraph graph definition
#
# Architecture:
#   START
#     → orchestrator            (principal agent: decides WHICH sub-agent runs)
#     → web_step / network_step / ad_step   (sub-agents)
#     → should_continue         (loop the same sub-agent, or finish)
#     → finalize
#     → END

from langgraph.graph import StateGraph, END
from core.state import PentestState
from core.orchestrator import orchestrator_node, route_after_orchestrator
from core.nodes import (
    web_agent_step,
    network_agent_step,
    ad_agent_step,
    should_continue,
    finalize,
)


def build_pentest_graph() -> StateGraph:
    graph = StateGraph(PentestState)

    # ── Add all nodes ──────────────────────────────────────────
    graph.add_node("orchestrator",    orchestrator_node)
    graph.add_node("web_step",        web_agent_step)
    graph.add_node("network_step",    network_agent_step)
    graph.add_node("ad_step",         ad_agent_step)
    graph.add_node("finalize",        finalize)

    # ── Entry point: the orchestrator always runs first ────────
    graph.set_entry_point("orchestrator")

    # ── After orchestrator: route to the chosen sub-agent ───────
    graph.add_conditional_edges(
        "orchestrator",
        route_after_orchestrator,
        {
            "web_step":     "web_step",
            "network_step": "network_step",
            "ad_step":      "ad_step",
        }
    )

    # ── After each agent step: loop or finish ───────────────────
    for node in ["web_step", "network_step", "ad_step"]:
        graph.add_conditional_edges(
            node,
            should_continue,
            {
                "continue": node,
                "finish":   "finalize",
            }
        )

    # ── After finalize: end ────────────────────────────────────
    graph.add_edge("finalize", END)

    return graph.compile()


# Singleton — compiled once, reused for every scan
pentest_graph = build_pentest_graph()


def run_pentest(scan_id: str, target: str, model: str = "llama3.1:latest",
                max_steps: int = 8, agent_type: str = "unknown") -> PentestState:
    """
    Main entry point — runs the full pentest graph.
    Called by FastAPI in a background thread.
    """
    from datetime import datetime

    initial_state: PentestState = {
        "scan_id":       scan_id,
        "target":        target,
        "agent_type":    agent_type,
        "model":         model,
        "max_steps":     max_steps,
        "orchestrator_decisions": [],
        "current_step":  0,
        "status":        "running",
        "steps":         [],
        "open_ports":    [],
        "services":      [],
        "vulnerabilities": [],
        "cvss_max":      0.0,
        "report_path":   None,
        "error":         None,
        "started_at":    datetime.now().isoformat(),
        "finished_at":   None,
    }

    print(f"\n🚀 Starting pentest — target: {target} | model: {model}")

    final_state = pentest_graph.invoke(initial_state)
    return final_state