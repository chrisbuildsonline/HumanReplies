#!/usr/bin/env python3
"""
Complete Database setup script for HumanReplies backend
Creates the database, all tables, and seeds initial data
"""

import asyncio
import asyncpg
from app.config import settings
from app.database import engine, Base
from app.models import Tone, ExternalServiceUrl
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid
from datetime import datetime

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
        print("   📋 Tables created:")
        print("   - users")
        print("   - user_settings")
        print("   - replies")
        print("   - tones")
        print("   - external_service_urls")
        return True
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        return False

async def seed_default_tones():
    """Insert default tone presets"""
    try:
        from app.database import AsyncSessionLocal
        
        default_tones = [
            {
                "name": "helpful",
                "display_name": "👍 Helpful",
                "description": "Supportive and constructive tone",
                "is_preset": True,
                "is_active": True,
                "sort_order": 1
            },
            {
                "name": "friendly",
                "display_name": "😊 Friendly",
                "description": "Warm and approachable tone",
                "is_preset": True,
                "is_active": True,
                "sort_order": 2
            },
            {
                "name": "professional",
                "display_name": "💼 Professional",
                "description": "Formal and business-appropriate tone",
                "is_preset": True,
                "is_active": True,
                "sort_order": 3
            },
            {
                "name": "casual",
                "display_name": "😎 Casual",
                "description": "Relaxed and informal tone",
                "is_preset": True,
                "is_active": True,
                "sort_order": 4
            },
            {
                "name": "encouraging",
                "display_name": "🌟 Encouraging",
                "description": "Motivating and uplifting tone",
                "is_preset": True,
                "is_active": True,
                "sort_order": 5
            },
            {
                "name": "humorous",
                "display_name": "😂 Humorous",
                "description": "Light-hearted and funny tone",
                "is_preset": True,
                "is_active": True,
                "sort_order": 6
            },
            {
                "name": "informative",
                "display_name": "📚 Informative",
                "description": "Educational and fact-based tone",
                "is_preset": True,
                "is_active": True,
                "sort_order": 7
            },
            {
                "name": "neutral",
                "display_name": "⚖️ Neutral",
                "description": "Balanced and objective tone",
                "is_preset": True,
                "is_active": True,
                "sort_order": 8
            }
        ]
        
        async with AsyncSessionLocal() as session:
            # Check if tones already exist
            result = await session.execute(select(Tone).where(Tone.is_preset == True))
            existing_tones = result.scalars().all()
            
            if existing_tones:
                print("✅ Default tones already exist")
                return True
            
            # Insert default tones
            for tone_data in default_tones:
                tone = Tone(
                    id=uuid.uuid4(),
                    name=tone_data["name"],
                    display_name=tone_data["display_name"],
                    description=tone_data["description"],
                    is_preset=tone_data["is_preset"],
                    is_active=tone_data["is_active"],
                    sort_order=tone_data["sort_order"],
                    user_id=None  # System preset
                )
                session.add(tone)
            
            await session.commit()
            print(f"✅ Seeded {len(default_tones)} default tones")
            
        return True
        
    except Exception as e:
        print(f"❌ Error seeding default tones: {e}")
        return False

async def seed_external_services():
    """Insert default external service URLs"""
    try:
        from app.database import AsyncSessionLocal
        
        default_services = [
            {
                "service_name": "pollinations",
                "url": "https://text.pollinations.ai/",
                "is_active": True
            }
        ]
        
        async with AsyncSessionLocal() as session:
            # Check if services already exist
            result = await session.execute(select(ExternalServiceUrl))
            existing_services = result.scalars().all()
            
            if existing_services:
                print("✅ External services already exist")
                return True
            
            # Insert default services
            for service_data in default_services:
                service = ExternalServiceUrl(
                    id=uuid.uuid4(),
                    service_name=service_data["service_name"],
                    url=service_data["url"],
                    is_active=service_data["is_active"],
                    last_checked=datetime.utcnow()
                )
                session.add(service)
            
            await session.commit()
            print(f"✅ Seeded {len(default_services)} external services")
            
        return True
        
    except Exception as e:
        print(f"❌ Error seeding external services: {e}")
        return False

async def main():
    """Main setup function"""
    print("🚀 Setting up HumanReplies database...")
    print("=" * 50)
    
    # Create database
    print("1️⃣ Creating database...")
    if not await create_database():
        print("❌ Database creation failed. Exiting.")
        return
    
    # Create tables
    print("\n2️⃣ Creating tables...")
    if not await create_tables():
        print("❌ Table creation failed. Exiting.")
        return
    
    # Seed default data
    print("\n3️⃣ Seeding default data...")
    if not await seed_default_tones():
        print("❌ Tone seeding failed. Exiting.")
        return
    
    if not await seed_external_services():
        print("❌ External services seeding failed. Exiting.")
        return
    
    print("\n" + "=" * 50)
    print("✅ Database setup complete!")
    print(f"📊 Database: {settings.database_name}")
    print(f"🔗 Connection: {settings.database_host}:{settings.database_port}")
    print("🎯 Ready to run: python run.py")
    print("=" * 50)

if __name__ == "__main__":
    asyncio.run(main())
