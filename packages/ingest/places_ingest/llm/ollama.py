"""Cliente mínimo de Ollama (HTTP local). Sin dependencias de terceros más allá de httpx."""

from __future__ import annotations

import base64
import json
import shutil
import subprocess
import time
from pathlib import Path
from typing import Any

import httpx

from ..config import settings


def _b64(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode()


def generate_with_image(model: str, prompt: str, image_path: Path | None, timeout_s: int,
                        json_schema: dict[str, Any] | None = None, system: str | None = None) -> str:
    payload: dict[str, Any] = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.1, "num_ctx": 8192},
    }
    if system:
        payload["system"] = system
    if image_path is not None:
        payload["images"] = [_b64(image_path)]
    if json_schema is not None:
        payload["format"] = json_schema  # Ollama: salida estructurada por JSON schema
    r = httpx.post(f"{settings.ollama_url}/api/generate", json=payload, timeout=timeout_s)
    r.raise_for_status()
    return r.json().get("response", "")


def is_available() -> bool:
    try:
        return httpx.get(f"{settings.ollama_url}/api/tags", timeout=3).status_code == 200
    except Exception:
        return False


def has_model(name: str) -> bool:
    try:
        tags = httpx.get(f"{settings.ollama_url}/api/tags", timeout=5).json().get("models", [])
        names = {m.get("name", "") for m in tags}
        return name in names or f"{name}:latest" in names
    except Exception:
        return False


def parse_json(text: str) -> dict[str, Any]:
    """Extrae el primer objeto JSON del texto (tolerante a ```json ... ```)."""
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("sin JSON en la respuesta")
    return json.loads(text[start:end + 1])


class OllamaServer:
    """Arranca `ollama serve` bajo demanda y lo apaga al salir, para no dejar el servidor corriendo.

    Si Ollama ya estaba corriendo (p. ej. lo abrió el usuario), no lo toca.
    """

    def __init__(self) -> None:
        self.proc: subprocess.Popen | None = None

    def __enter__(self) -> "OllamaServer":
        if is_available():
            return self
        if not shutil.which("ollama"):
            raise RuntimeError("ollama no está instalado (brew install ollama)")
        self.proc = subprocess.Popen(
            ["ollama", "serve"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            env={**__import__("os").environ, "OLLAMA_KEEP_ALIVE": "10m"},
        )
        for _ in range(60):
            if is_available():
                return self
            time.sleep(0.5)
        self.__exit__(None, None, None)
        raise RuntimeError("ollama serve no respondió en 30 s")

    def __exit__(self, *exc) -> None:
        if self.proc is None:
            return
        # descargar el modelo de memoria y apagar el servidor
        try:
            httpx.post(f"{settings.ollama_url}/api/generate", json={"model": settings.vision_model, "keep_alive": 0}, timeout=10)
        except Exception:
            pass
        self.proc.terminate()
        try:
            self.proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            self.proc.kill()
        self.proc = None
