# core/llm.py — Ollama LLM caller (model-agnostic)

import requests
import time
import os

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
#OLLAMA_URL = "http://localhost:11434/api/chat"

AVAILABLE_MODELS = {
    "llama3.1:latest":     "llama3.1:latest",
    "qwen2.5-coder:7b":   "qwen2.5:latest",    # mapped to installed version
    "qwen2.5:latest":     "qwen2.5:latest",
    "llama3.1":           "llama3.1:latest",
    "qwen2.5":            "qwen2.5:latest",
}


def call_llm(prompt: str, system: str = "", model: str = "llama3.1:latest") -> str:
    # Resolve alias
    model = AVAILABLE_MODELS.get(model, model)

    result = _try_model(model, prompt, system)
    if result:
        return result

    # Fallback to llama3.1 if requested model fails
    if model != "llama3.1:latest":
        print(f"   ⏭️  Falling back to llama3.1:latest...")
        result = _try_model("llama3.1:latest", prompt, system)
        if result:
            return result

    return '{"tool": "none", "reason": "LLM unavailable", "finished": true}'


def _try_model(model: str, prompt: str, system: str) -> str | None:
    try:
        response = requests.post(
            f"{OLLAMA_URL.rstrip('/')}/api/chat",
            json={
                "model":  model,
                "stream": False,
                "options": {
                    "temperature": 0.1,
                    "num_predict": 400,
                },
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user",   "content": prompt},
                ]
            },
            timeout=300,
        )

        if response.status_code == 404:
            print(f"   ⚠️  Model '{model}' not found — run: ollama pull {model}")
            return None

        data = response.json()
        content = data.get("message", {}).get("content", "").strip()
        print(f"   ✅ Model: {model}")
        return content if content else None

    except requests.exceptions.ConnectionError:
        print("   ⚠️  Ollama not running — start it first")
        return None
    except Exception as e:
        print(f"   ⚠️  {model}: {str(e)[:80]}")
        return None