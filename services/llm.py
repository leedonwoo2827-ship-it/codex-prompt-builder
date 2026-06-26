"""회사 LiteLLM(OpenAI 호환) 호출 래퍼.

- chat_reply(): 텍스트 대화/프롬프트 산출 (기본 deepseek-v4-flash)
- analyze_image(): 첨부 레퍼런스 이미지를 비전 모델(MiMo-V2.5)로 분석
- test_connection(): 설정 화면 "연결 확인"용 초소형 ping
"""
from __future__ import annotations

import time
from typing import Any

from openai import OpenAI

from core import config, constants


def _client(url: str, key: str) -> OpenAI:
    base_url = url.rstrip("/")
    if not base_url.endswith("/v1"):
        base_url = f"{base_url}/v1"
    return OpenAI(base_url=base_url, api_key=key or "no-key")


def _token_kwargs(model: str, max_tokens: int) -> dict[str, int]:
    """신 OpenAI 모델은 max_completion_tokens, 그 외(deepseek/claude/gemini)는 max_tokens."""
    if model in constants.NEW_OPENAI_MODELS:
        return {"max_completion_tokens": max_tokens}
    return {"max_tokens": max_tokens}


def _friendly_error(exc: Exception) -> str:
    msg = str(exc)
    low = msg.lower()
    if "connection" in low or "connect" in low or "timeout" in low:
        return "게이트웨이에 연결하지 못했습니다. URL과 사내망 접속을 확인하세요."
    if "401" in msg or "403" in low or "unauthorized" in low or "invalid" in low and "key" in low:
        return "인증 실패입니다. API 키를 확인하세요."
    if "not found" in low or "404" in msg or "does not exist" in low:
        return "모델을 찾을 수 없습니다. 모델명(등록 별칭)을 확인하세요."
    return f"호출 오류: {msg[:300]}"


# ─────────────────────────────────────────────────────────────
# 비전: 첨부 이미지 분석
# ─────────────────────────────────────────────────────────────
_VISION_INSTRUCTION = (
    "너는 이미지 분석가다. 첨부된 레퍼런스 이미지를 분석해 카드뉴스/표지/배너 제작에 쓸 "
    "프롬프트 재료를 한국어로 추출하라. 다음 항목을 간결한 글머리표로 정리한다: "
    "① 전체 인상/무드 ② 주요 색상(가능하면 HEX 추정) ③ 구도/레이아웃 ④ 조명/질감 "
    "⑤ 텍스트(헤드라인·보조문구) 배치와 폰트 느낌 ⑥ 가장 가까운 스타일(스타일 카탈로그 기준) 추정. "
    "이미지에 없는 내용은 지어내지 말 것."
)


def analyze_image(images: list[str], note: str = "") -> str:
    """images: data:image/...;base64,... data URL 리스트. 분석 텍스트를 반환."""
    settings = config.load_settings()
    client = _client(settings["litellm_url"], settings["litellm_key"])
    model = settings["vision_model"]

    content: list[dict[str, Any]] = [{"type": "text", "text": _VISION_INSTRUCTION}]
    if note.strip():
        content.append({"type": "text", "text": f"사용자 메모: {note.strip()}"})
    for url in images:
        content.append({"type": "image_url", "image_url": {"url": url}})

    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": content}],
        **_token_kwargs(model, 900),
    )
    return (resp.choices[0].message.content or "").strip()


# ─────────────────────────────────────────────────────────────
# 텍스트: 대화/프롬프트 산출
# ─────────────────────────────────────────────────────────────
def chat_reply(messages: list[dict[str, Any]]) -> str:
    """messages: OpenAI chat 포맷(system/user/assistant, content=str). deepseek로 응답."""
    settings = config.load_settings()
    client = _client(settings["litellm_url"], settings["litellm_key"])
    model = settings["chat_model"]

    resp = client.chat.completions.create(
        model=model,
        messages=messages,
        **_token_kwargs(model, 3500),
    )
    msg = resp.choices[0].message
    content = (msg.content or "").strip()
    if not content:
        # 추론형 모델(MiMo 등)이 응답 토큰을 추론에 소진하고 content가 빈 경우 대비
        content = (getattr(msg, "reasoning_content", "") or "").strip()
    return content


# ─────────────────────────────────────────────────────────────
# 연결 확인
# ─────────────────────────────────────────────────────────────
def _ping(client: OpenAI, model: str) -> dict[str, Any]:
    t0 = time.monotonic()
    try:
        client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "ping"}],
            **_token_kwargs(model, 5),
        )
        return {"ok": True, "model": model, "ms": int((time.monotonic() - t0) * 1000)}
    except Exception as exc:  # noqa: BLE001 — 사용자에게 친화 메시지로 변환
        return {"ok": False, "model": model, "error": _friendly_error(exc)}


def test_connection(url: str, key: str, chat_model: str, vision_model: str) -> dict[str, Any]:
    """입력된 설정으로 텍스트/비전 모델 각각 ping. 설정은 저장하지 않는다."""
    client = _client(url, key)
    chat_result = _ping(client, chat_model)
    vision_result = _ping(client, vision_model)
    return {
        "ok": chat_result["ok"] and vision_result["ok"],
        "chat": chat_result,
        "vision": vision_result,
    }
