"""settings.json 로드/저장. UI 편집값이 .env 기본값보다 우선한다."""
from __future__ import annotations

import json
from typing import Any

from core import constants


_KEYS = ("provider", "litellm_url", "litellm_key", "chat_model", "vision_model")


def _defaults() -> dict[str, Any]:
    return {
        "provider": constants.DEFAULT_PROVIDER,
        "litellm_url": constants.DEFAULT_LITELLM_URL,
        "litellm_key": constants.DEFAULT_LITELLM_KEY,
        "chat_model": constants.DEFAULT_CHAT_MODEL,
        "vision_model": constants.DEFAULT_VISION_MODEL,
    }


def load_settings() -> dict[str, Any]:
    """settings.json 이 있으면 그 값으로 기본값을 덮어쓴다."""
    settings = _defaults()
    if constants.SETTINGS_PATH.exists():
        try:
            saved = json.loads(constants.SETTINGS_PATH.read_text(encoding="utf-8"))
            for key in settings:
                if saved.get(key):
                    settings[key] = saved[key]
        except (json.JSONDecodeError, OSError):
            pass  # 손상된 파일은 무시하고 기본값 사용
    return settings


def save_settings(data: dict[str, Any]) -> dict[str, Any]:
    """허용된 키만 골라 저장하고, 저장된 전체 설정을 돌려준다."""
    current = load_settings()
    for key in _KEYS:
        value = data.get(key)
        if value is not None and str(value).strip():
            current[key] = str(value).strip()
    constants.SETTINGS_PATH.write_text(
        json.dumps(current, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return current


def public_settings() -> dict[str, Any]:
    """프론트로 보낼 때 API 키는 마스킹한다. 프로바이더 프리셋 목록도 함께 전달."""
    s = load_settings()
    key = s.get("litellm_key", "")
    return {
        "provider": s.get("provider", constants.DEFAULT_PROVIDER),
        "litellm_url": s["litellm_url"],
        "litellm_key_set": bool(key),
        "litellm_key_masked": (key[:6] + "…" + key[-2:]) if len(key) > 10 else ("설정됨" if key else ""),
        "chat_model": s["chat_model"],
        "vision_model": s["vision_model"],
        "provider_presets": constants.PROVIDER_PRESETS,
    }
