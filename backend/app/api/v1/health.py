import logging

from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import engine


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("/live")
def liveness():

    return {
        "status": "alive",
        "service": "LedgerLine API"
    }


@router.get("/ready")
def readiness():

    try:

        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        return {
            "status": "ready",
            "database": "connected"
        }

    except SQLAlchemyError:

        logger.exception("Database readiness check failed")

        raise HTTPException(
            status_code=503,
            detail="Service temporarily unavailable"
        )