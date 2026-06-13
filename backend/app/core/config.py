from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Real-Time Video Support API"
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/videoplatform"
    REDIS_URL: str = "redis://localhost:6379/0"

    class Config:
        env_file = ".env"

settings = Settings()
