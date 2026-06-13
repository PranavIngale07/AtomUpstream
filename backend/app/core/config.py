from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Real-Time Video Support API"
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/videoplatform"
    REDIS_URL: str = "redis://localhost:6379/0"
    AGENT_ACCESS_CODE: str = "SUPPORT_AGENT_2026"
    DASHBOARD_ACCESS_CODE: str = "ADMIN_DASHBOARD_2026"
    STORAGE_DIR: str = "storage"

    class Config:
        env_file = ".env"

settings = Settings()
