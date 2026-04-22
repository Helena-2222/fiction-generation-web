from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


DEEPSEEK_MAX_COMPLETION_TOKENS = 8192


def _load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def _get_bounded_int_env(name: str, default: int, *, minimum: int, maximum: int) -> int:
    raw_value = os.getenv(name, str(default)).strip()
    try:
        parsed = int(raw_value)
    except ValueError:
        return default
    return max(minimum, min(parsed, maximum))


ROOT_DIR = Path(__file__).resolve().parents[1]
_load_env_file(ROOT_DIR / ".env")


@dataclass(frozen=True)
class Settings:
    deepseek_api_key: str = os.getenv("DEEPSEEK_API_KEY", "")
    deepseek_base_url: str = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
    deepseek_model: str = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
    request_timeout_seconds: float = float(os.getenv("REQUEST_TIMEOUT_SECONDS", "180"))
    supabase_url: str = os.getenv("VITE_SUPABASE_URL", "")
    supabase_anon_key: str = os.getenv("VITE_SUPABASE_ANON_KEY", "")
    deepseek_json_max_tokens: int = _get_bounded_int_env(
        "DEEPSEEK_JSON_MAX_TOKENS",
        DEEPSEEK_MAX_COMPLETION_TOKENS,
        minimum=1,
        maximum=DEEPSEEK_MAX_COMPLETION_TOKENS,
    )


settings = Settings()
