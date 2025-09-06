#!/usr/bin/env python3
"""
Database setup script for HumanReplies backend
Creates the database and runs initial migrations
"""

import asyncio
import asyncpg
from app.config import settings
from app.database import engine, Base

async def create_database():
    """Create the database if it doesn't exist"""
    try:
        # Connect to postgres database to create our database
        conn = await asyncpg.connect(
            host=settings.database_host,
            port=settings.database_port,
            user=settings.database_user,
            password=settings.database_password,
            database="postgres"
        )
        
        # Check if database exists
        result = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            settings.database_name
        )
        
        if not result:
            await conn.execute(f'CREATE DATABASE "{settings.database_name}"')
            print(f"✅ Created database: {settings.database_name}")
        else:
            print(f"✅ Database already exists: {settings.database_name}")
        
        await conn.close()
        
    except Exception as e:
        print(f"❌ Error creating database: {e}")
        return False
    
    return True

async def create_tables():
    """Create all tables"""
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("✅ Created all database tables")
        return True
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        return False

async def main():
    """Main setup function"""
    print("🚀 Setting up HumanReplies database...")
    
    # Create database
    if not await create_database():
        return
    
    # Create tables
    if not await create_tables():
        return
    
    print("✅ Database setup complete!")
    print(f"📊 Database URL: {settings.database_url}")
    print("🎯 Ready to run: python run.py")

if __name__ == "__main__":
    asyncio.run(main())