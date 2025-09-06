from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

# SQLAlchemy setup for local PostgreSQL
class Base(DeclarativeBase):
    pass

# Create async engine
engine = create_async_engine(
    settings.database_url,
    echo=settings.environment == "development",
    future=True
)

# Create session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Dependency to get database session
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

# Supabase clients (Auth only) - Initialize lazily to avoid import issues
supabase = None
supabase_admin = None

def get_supabase_client():
    global supabase
    if supabase is None:
        from supabase import create_client, Client
        supabase = create_client(settings.supabase_url, settings.supabase_anon_key)
    return supabase

def get_supabase_admin_client():
    global supabase_admin
    if supabase_admin is None:
        from supabase import create_client, Client
        supabase_admin = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return supabase_admin