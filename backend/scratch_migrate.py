import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type VARCHAR DEFAULT 'TEXT'"))
            await conn.execute(text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_url VARCHAR"))
            await conn.execute(text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_size VARCHAR"))
            print('Migration Done')
        except Exception as e:
            print(f'Error: {e}')

asyncio.run(main())
