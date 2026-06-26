"""프롬프트 빌더 — FastAPI 진입점.

정적 프론트 서빙 + API 라우터 마운트. run.bat 가 uvicorn 으로 기동한다.
"""
from __future__ import annotations

import threading
import webbrowser

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from core import constants
from routes import (
    archive_routes, chat_routes, manuscript_routes, preset_routes, settings_routes,
)

app = FastAPI(title=constants.APP_TITLE)

app.include_router(chat_routes.router)
app.include_router(settings_routes.router)
app.include_router(preset_routes.router)
app.include_router(manuscript_routes.router)
app.include_router(archive_routes.router)


@app.get("/")
def index() -> FileResponse:
    return FileResponse(constants.STATIC_DIR / "index.html")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# 프리셋 커버 이미지 서빙
constants.PRESETS_DIR.mkdir(exist_ok=True)
app.mount("/presets", StaticFiles(directory=str(constants.PRESETS_DIR)), name="presets")

# 정적 자산 (css/js 등) — 마지막에 마운트 (API 경로와 충돌 방지)
app.mount("/", StaticFiles(directory=str(constants.STATIC_DIR)), name="static")


def _open_browser() -> None:
    webbrowser.open(f"http://{constants.HOST}:{constants.PORT}")


if __name__ == "__main__":
    import uvicorn

    threading.Timer(1.2, _open_browser).start()
    uvicorn.run(app, host=constants.HOST, port=constants.PORT)
