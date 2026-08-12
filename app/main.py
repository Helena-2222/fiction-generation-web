from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routers import outline_router, story_router, character_router, export_router, task_router


BASE_DIR = Path(__file__).resolve().parents[1]
STATIC_DIR = BASE_DIR / "static"
HTML_DIR = STATIC_DIR / "html"
SUPABASE_BROWSER_BUNDLE = STATIC_DIR / "js" / "vendor" / "supabase.js"
STATIC_CACHE_CONTROL = "public, max-age=3600"
REVALIDATE_CACHE_CONTROL = "no-cache"
PUBLIC_CONFIG_CACHE_CONTROL = "public, max-age=300"
HTML_CACHE_CONTROL = "no-cache"


class CachedStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope) -> Response:
        response = await super().get_response(path, scope)
        suffix = Path(path).suffix.lower()
        cache_control = (
            REVALIDATE_CACHE_CONTROL
            if suffix in {".js", ".css"}
            else STATIC_CACHE_CONTROL
        )
        response.headers.setdefault("Cache-Control", cache_control)
        return response


def html_file_response(filename: str) -> FileResponse:
    return FileResponse(
        HTML_DIR / filename,
        headers={"Cache-Control": HTML_CACHE_CONTROL},
    )


app = FastAPI(title="AI 协同小说创作 WEB", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.frontend_origins),
    allow_credentials=settings.frontend_origins != ("*",),
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", CachedStaticFiles(directory=STATIC_DIR), name="static")

app.include_router(outline_router.router)
app.include_router(story_router.router)
app.include_router(character_router.router)
app.include_router(export_router.router)
app.include_router(task_router.router)


@app.get("/")
async def landing() -> FileResponse:
    return html_file_response("index.html")


@app.get("/auth")
async def auth_page() -> FileResponse:
    return html_file_response("auth.html")


@app.get("/create")
async def create_page() -> FileResponse:
    return html_file_response("create.html")


@app.get("/works")
async def works_page() -> FileResponse:
    return html_file_response("works.html")


@app.get("/mynote")
async def mynote_page() -> FileResponse:
    return html_file_response("mynote.html")


@app.get("/notes")
async def notes_page() -> FileResponse:
    return html_file_response("mynote.html")


@app.get("/usercenter")
async def usercenter_page() -> FileResponse:
    return html_file_response("usercenter.html")


@app.get("/vendor/supabase.js")
async def supabase_browser_bundle() -> FileResponse:
    if not SUPABASE_BROWSER_BUNDLE.exists():
        raise HTTPException(status_code=404, detail="Supabase browser bundle not found")
    return FileResponse(
        SUPABASE_BROWSER_BUNDLE,
        media_type="text/javascript",
        headers={"Cache-Control": STATIC_CACHE_CONTROL},
    )


@app.get("/api/public-config")
async def public_config(response: Response) -> dict:
    response.headers["Cache-Control"] = PUBLIC_CONFIG_CACHE_CONTROL
    return {
        "authEnabled": bool(settings.supabase_url and settings.supabase_anon_key),
        "supabaseUrl": settings.supabase_url,
        "supabaseAnonKey": settings.supabase_anon_key,
    }


@app.get("/api/health")
async def health() -> dict:
    return {"ok": True}
