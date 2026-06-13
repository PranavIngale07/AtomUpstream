import asyncio
import os
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.api.sessions import router as sessions_router
from app.api.ws import router as ws_router
from app.api.dashboard import router as dashboard_router
from app.core.database import engine, Base
from app.core.config import settings

# Setup logging
log_dir = os.path.join("logs", datetime.now().strftime("%Y-%m-%d"))
os.makedirs(log_dir, exist_ok=True)
logger.add(os.path.join(log_dir, "run_{time:HH-mm-ss}.log"), rotation="1 day", retention="7 days")

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For hackathon MVP
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    logger.info("Starting up FastAPI application...")
    # Create DB tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables initialized.")

app.include_router(sessions_router, prefix="/api/sessions", tags=["sessions"])
app.include_router(ws_router, prefix="/ws/chat", tags=["websocket"])
app.include_router(dashboard_router, prefix="/api/dashboard", tags=["dashboard"])
