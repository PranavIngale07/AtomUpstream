import asyncio
from app.core.database import engine, Base
from app.models import models

async def drop_all():
    async with engine.begin() as conn:
        print("Dropping all tables...")
        await conn.run_sync(Base.metadata.drop_all)
        print("All tables dropped.")
        
if __name__ == "__main__":
    asyncio.run(drop_all())
