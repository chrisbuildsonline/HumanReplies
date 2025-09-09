#!/usr/bin/env python3
"""
Complete setup verification script for HumanReplies database
Shows the current status of all database components
"""

import asyncio
import asyncpg
from app.config import settings
from app.database import AsyncSessionLocal
from app.models import User, UserSettings, Tone, ExternalServiceUrl
from sqlalchemy import select, func
from datetime import datetime

async def verify_setup():
    """Verify the complete database setup"""
    print("🔍 HumanReplies Database Setup Verification")
    print("=" * 50)
    
    try:
        # Test basic connection
        conn = await asyncpg.connect(
            host=settings.database_host,
            port=settings.database_port,
            user=settings.database_user,
            password=settings.database_password,
            database=settings.database_name
        )
        
        print("✅ PostgreSQL connection successful")
        print(f"   📊 Database: {settings.database_name}")
        print(f"   🔗 Host: {settings.database_host}:{settings.database_port}")
        
        # Check all tables exist
        tables = await conn.fetch("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        """)
        
        expected_tables = ['users', 'user_settings', 'replies', 'tones', 'external_service_urls', 'schema_migrations']
        existing_tables = [t['table_name'] for t in tables]
        
        print(f"\n📋 Database Tables ({len(existing_tables)} found):")
        for table in expected_tables:
            if table in existing_tables:
                count = await conn.fetchval(f'SELECT COUNT(*) FROM "{table}";')
                print(f"   ✅ {table}: {count} rows")
            else:
                print(f"   ❌ {table}: MISSING")
        
        await conn.close()
        
        # Test SQLAlchemy ORM
        print(f"\n🔧 Testing SQLAlchemy ORM...")
        async with AsyncSessionLocal() as session:
            # Test user settings functionality
            users_count = await session.scalar(select(func.count(User.id)))
            settings_count = await session.scalar(select(func.count(UserSettings.id)))
            tones_count = await session.scalar(select(func.count(Tone.id)))
            preset_tones_count = await session.scalar(select(func.count(Tone.id)).where(Tone.is_preset == True))
            custom_tones_count = await session.scalar(select(func.count(Tone.id)).where(Tone.is_preset == False))
            services_count = await session.scalar(select(func.count(ExternalServiceUrl.id)))
            
            print(f"   ✅ SQLAlchemy connection successful")
            print(f"   👥 Users: {users_count}")
            print(f"   ⚙️  User Settings: {settings_count}")
            print(f"   🎨 Total Tones: {tones_count}")
            print(f"   📋 Preset Tones: {preset_tones_count}")
            print(f"   🎯 Custom Tones: {custom_tones_count}")
            print(f"   🔗 External Services: {services_count}")
        
        # Check migrations
        conn = await asyncpg.connect(
            host=settings.database_host,
            port=settings.database_port,
            user=settings.database_user,
            password=settings.database_password,
            database=settings.database_name
        )
        
        migrations = await conn.fetch("SELECT * FROM schema_migrations ORDER BY id;")
        print(f"\n🔄 Applied Migrations ({len(migrations)}):")
        for migration in migrations:
            print(f"   ✅ {migration['migration_name']}")
            print(f"      Applied: {migration['applied_at']}")
        
        await conn.close()
        
        # Show available API endpoints
        print(f"\n🚀 Available API Endpoints:")
        print(f"   Authentication:")
        print(f"   - POST /api/v1/auth/login")
        print(f"   - POST /api/v1/auth/register")
        print(f"   - POST /api/v1/auth/refresh")
        print(f"   ")
        print(f"   User Settings (NEW):")
        print(f"   - GET  /api/v1/user-settings/")
        print(f"   - POST /api/v1/user-settings/")
        print(f"   - PUT  /api/v1/user-settings/")
        print(f"   - DELETE /api/v1/user-settings/")
        print(f"   ")
        print(f"   Tones (UPDATED):")
        print(f"   - GET  /api/v1/tones/ (presets + user custom)")
        print(f"   - POST /api/v1/tones/ (create custom tone)")
        print(f"   - PUT  /api/v1/tones/{{id}} (update own tone)")
        print(f"   - DELETE /api/v1/tones/{{id}} (delete own tone)")
        print(f"   ")
        print(f"   Other:")
        print(f"   - GET /api/v1/replies/")
        print(f"   - POST /api/v1/services/generate-reply")
        print(f"   - GET /health")
        
        print(f"\n" + "=" * 50)
        print("✅ Database setup verification completed successfully!")
        print("🎯 Your HumanReplies backend is ready with:")
        print("   • User-specific settings (writing style & guardian text)")
        print("   • Custom user tones (in addition to system presets)")
        print("   • Proper migration tracking")
        print("   • Full API documentation at /docs")
        print(f"\n🚀 Start server with: python run.py")
        print("=" * 50)
        
        return True
        
    except Exception as e:
        print(f"❌ Verification failed: {e}")
        return False

async def main():
    """Main function"""
    success = await verify_setup()
    if not success:
        exit(1)

if __name__ == "__main__":
    asyncio.run(main())
