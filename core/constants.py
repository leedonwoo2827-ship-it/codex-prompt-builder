"""앱 전역 상수 + .env 기반 기본값."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# 프로젝트 루트 (이 파일 = core/constants.py → 부모의 부모)
BASE_DIR = Path(__file__).resolve().parent.parent

# .env 로드 (있으면)
load_dotenv(BASE_DIR / ".env")

# 경로
STATIC_DIR = BASE_DIR / "static"
PROMPTS_DIR = BASE_DIR / "prompts"
PRESETS_DIR = BASE_DIR / "presets"
SETTINGS_PATH = BASE_DIR / "settings.json"
ARCHIVES_PATH = BASE_DIR / "archives.json"

# 서버
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8770"))

# LiteLLM 기본값 (.env > 하드코딩 폴백)
DEFAULT_LITELLM_URL = os.environ.get("UBION_LITELLM_URL", "http://localhost:4000")
DEFAULT_LITELLM_KEY = os.environ.get("UBION_LITELLM_KEY", "")

# 모델 기본값
DEFAULT_CHAT_MODEL = os.environ.get("CHAT_MODEL", "deepseek-v4-flash")
DEFAULT_VISION_MODEL = os.environ.get("VISION_MODEL", "MiMo-V2.5")

# 프로바이더 프리셋 — 선택 시 URL·모델 자동 채움. 키만 입력하면 동작.
DEFAULT_PROVIDER = os.environ.get("PROVIDER", "litellm")
PROVIDER_PRESETS = {
    "litellm": {
        "label": "회사 LiteLLM",
        "litellm_url": DEFAULT_LITELLM_URL,
        "chat_model": DEFAULT_CHAT_MODEL,
        "vision_model": DEFAULT_VISION_MODEL,
    },
    "xiaomi": {
        "label": "샤오미 MiMo (직접)",
        "litellm_url": "https://api.xiaomimimo.com/v1",
        "chat_model": "mimo-v2.5",      # 멀티모달 단일 모델 (텍스트+비전 겸용)
        "vision_model": "mimo-v2.5",
    },
}

# 신 OpenAI 모델 (max_tokens 미지원 → max_completion_tokens 필요)
NEW_OPENAI_MODELS = {
    "gpt-5.5", "gpt-5.5-pro", "chat-latest", "gpt-5.4-mini", "gpt-5.4-nano",
}

APP_TITLE = "프롬프트 빌더"
