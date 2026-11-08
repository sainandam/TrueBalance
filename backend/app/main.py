from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.v1.health import router as health_router
from app.api.v1.auth import router as auth_router
from app.api.v1.accounts import router as accounts_router
from app.api.v1.transactions import router as transactions_router
from app.api.v1.audit import router as audit_router

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Secure Financial Transaction Platform",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "Idempotency-Key"],
)

# Register API routers
app.include_router(health_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(accounts_router, prefix="/api/v1")
app.include_router(transactions_router, prefix="/api/v1")
app.include_router(audit_router, prefix="/api/v1")


# Serve compiled React frontend in standalone / production mode if dist exists
@app.get("/")
def root():
    return {
        "application": "LedgerLine",
        "message": "Secure Financial Platform API",
        "status": "running",
    }


# Serve compiled React frontend in standalone / production mode under /app
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if (frontend_dist / "index.html").exists():
    if (frontend_dist / "assets").exists():
        app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

    @app.get("/app")
    @app.get("/app/{full_path:path}")
    def serve_spa(full_path: str = ""):
        return FileResponse(frontend_dist / "index.html")
