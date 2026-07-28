# core/orchestrator.py — Principal orchestrator agent
#
# The orchestrator is the entry point of every scan. It decides:
#   1. WHICH agent should run next (web / network / ad)
#   2. WHY (logged as a routing decision, visible in the report)
#
# Routing strategy: deterministic heuristics based on the target string.

from datetime import datetime
from core.state import PentestState


def orchestrator_node(state: PentestState) -> dict:
    """
    Principal agent — analyzes the target and decides which sub-agent
    to call next. This is the single decision point of the whole graph.
    """
    target = state["target"]
    decision_count = len(state.get("orchestrator_decisions", []))

    agent_type, reason = _decide_agent(target, state)

    print(f"   🧠 Orchestrateur → agent choisi: {agent_type}")
    print(f"      Raison: {reason}")

    decision = {
        "step":      decision_count + 1,
        "agent":     agent_type,
        "reason":    reason,
        "timestamp": datetime.now().isoformat(),
    }

    return {
        "agent_type":             agent_type,
        "orchestrator_decisions": [decision],
    }


def _decide_agent(target: str, state: PentestState) -> tuple[str, str]:
    """
    Decision tree — the orchestrator's routing logic.

    Order of evaluation:
      1. Explicit agent selection from frontend (ad/web forced)
      2. Active Directory signals (domain/LDAP/SMB-style targets)
      3. Network-only signals (CIDR ranges)
      4. Default: web agent
    """
    # If agent was explicitly selected from frontend
    explicit = state.get("agent_type", "unknown")
    if explicit == "ad":
        return "ad", f"Agent AD sélectionné explicitement pour la cible '{target}'"
    if explicit == "web":
        return "web", f"Agent Web sélectionné explicitement pour la cible '{target}'"

    target_lower = target.lower()

    if any(x in target_lower for x in ["445", "389", "ldap", ".local", "corp.", "ad."]):
        return "ad", f"Cible '{target}' présente des signaux Active Directory (LDAP/SMB/domaine)"

    if "/" in target and not target.startswith("http"):
        return "network", f"Cible '{target}' est une plage réseau (CIDR) — scan réseau pur"

    return "web", f"Cible '{target}' traitée comme une application web (par défaut)"


def route_after_orchestrator(state: PentestState) -> str:
    """Conditional edge — maps agent_type to the corresponding graph node."""
    mapping = {
        "web":     "web_step",
        "network": "network_step",
        "ad":      "ad_step",
        "unknown": "web_step",
    }
    return mapping.get(state["agent_type"], "web_step")