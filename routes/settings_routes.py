"""설정 조회/저장 + 연결 확인 라우트."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from core import config
from services import llm

router = APIRouter(prefix="/api", tags=["settings"])


class SettingsBody(BaseModel):
    provider: str | None = None         # "litellm" | "xiaomi"
    litellm_url: str | None = None
    litellm_key: str | None = None      # 빈 값이면 기존 키 유지
    chat_model: str | None = None
    vision_model: str | None = None


class TestBody(BaseModel):
    litellm_url: str | None = None
    litellm_key: str | None = None      # 빈 값이면 저장된 키 사용
    chat_model: str | None = None
    vision_model: str | None = None


@router.get("/settings")
def get_settings() -> dict[str, Any]:
    return {"ok": True, "settings": config.public_settings()}


@router.post("/settings")
def post_settings(body: SettingsBody) -> dict[str, Any]:
    config.save_settings(body.model_dump(exclude_none=True))
    return {"ok": True, "settings": config.public_settings()}


@router.post("/test-connection")
def test_connection(body: TestBody) -> dict[str, Any]:
    """입력값 우선, 비면 저장된 설정으로 채워서 ping (저장은 하지 않음)."""
    saved = config.load_settings()
    url = body.litellm_url or saved["litellm_url"]
    key = body.litellm_key or saved["litellm_key"]
    chat_model = body.chat_model or saved["chat_model"]
    vision_model = body.vision_model or saved["vision_model"]
    return {"ok": True, "result": llm.test_connection(url, key, chat_model, vision_model)}
