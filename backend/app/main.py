# from fastapi import FastAPI

# app = FastAPI(
#     title="LedgerLine",
#     version="1.0.0",
#     description="Secure Financial Transaction Platform",
# )

# @app.get("/")
# def root():
#     return {"application": "LedgerLine", "status": "running"}

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.v1.health import router as health_router


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Secure Financial Transaction Platform"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization"]
)


app.include_router(
    health_router,
    prefix="/api/v1"
)


@app.get("/")
def root():

    return {
        "application": "LedgerLine",
        "message": "Secure Financial Platform API",
        "status": "running"
    }