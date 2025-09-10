from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Supabase (Auth only)
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_jwt_secret: str
    
    # Local PostgreSQL Database
    database_url: str
    database_host: str = "localhost"
    database_port: int = 5432
    database_name: str = "humanreplies"
    database_user: str = "postgres"
    database_password: str = "password"
    
    # API Settings
    environment: str = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    
    # Redis Cache
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0
    redis_enabled: bool = True
    
    class Config:
        env_file = ".env"

settings = Settings()