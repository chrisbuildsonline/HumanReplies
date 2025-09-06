#!/usr/bin/env python3
"""
Migration script to add the external_service_urls table to existing database.
Run this script to add the new table without affecting existing data.
"""

import asyncio
import asyncpg
from app.config import settings
from app.models import ExternalServiceUrl
from app.database import engine
from datetime import datetime, timedelta

async def create_service_urls_table():
    """Create the external_service_urls table and populate with initial data"""
    
    print("🔧 Adding external_service_urls table...")
    
    # Create the table using SQLAlchemy
    async with engine.begin() as conn:
        # Import Base to ensure all models are registered
        from app.database import Base
        
        # Create only the new table
        await conn.run_sync(ExternalServiceUrl.__table__.create, checkfirst=True)
        print("✅ external_service_urls table created successfully")
    
    # Add initial service URLs
    print("📝 Adding initial service URLs...")
    
    # Connect directly to insert initial data
    conn = await asyncpg.connect(
        host=settings.database_host,
        port=settings.database_port,
        user=settings.database_user,
        password=settings.database_password,
        database=settings.database_name
    )
    
    try:
        # Insert Pollinations.ai URL
        now = datetime.utcnow()
        cache_expires = now + timedelta(hours=1)
        
        await conn.execute("""
            INSERT INTO external_service_urls 
            (service_name, url, is_active, last_checked, cache_expires_at, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (service_name) DO NOTHING
        """, 
        "pollinations", 
        "https://text.pollinations.ai", 
        True, 
        now, 
        cache_expires, 
        now, 
        now)
        
        print("✅ Pollinations.ai URL added successfully")
        
        # Verify the data was inserted
        result = await conn.fetch("SELECT * FROM external_service_urls")
        print(f"📊 Total service URLs in database: {len(result)}")
        
        for row in result:
            print(f"   - {row['service_name']}: {row['url']} (active: {row['is_active']})")
    
    finally:
        await conn.close()

async def verify_table_structure():
    """Verify the table was created with correct structure"""
    print("\n🔍 Verifying table structure...")
    
    conn = await asyncpg.connect(
        host=settings.database_host,
        port=settings.database_port,
        user=settings.database_user,
        password=settings.database_password,
        database=settings.database_name
    )
    
    try:
        # Get table info
        columns = await conn.fetch("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'external_service_urls'
            ORDER BY ordinal_position
        """)
        
        print("📋 Table structure:")
        for col in columns:
            nullable = "NULL" if col['is_nullable'] == 'YES' else "NOT NULL"
            default = f" DEFAULT {col['column_default']}" if col['column_default'] else ""
            print(f"   {col['column_name']}: {col['data_type']} {nullable}{default}")
        
        # Check indexes
        indexes = await conn.fetch("""
            SELECT indexname, indexdef 
            FROM pg_indexes 
            WHERE tablename = 'external_service_urls'
        """)
        
        print("\n📇 Indexes:")
        for idx in indexes:
            print(f"   {idx['indexname']}: {idx['indexdef']}")
    
    finally:
        await conn.close()

async def main():
    """Run the migration"""
    print("🚀 HumanReplies Database Migration")
    print("Adding external_service_urls table...")
    print("=" * 50)
    
    try:
        await create_service_urls_table()
        await verify_table_structure()
        
        print("\n" + "=" * 50)
        print("🎉 Migration completed successfully!")
        print("\n📝 What was added:")
        print("   ✅ external_service_urls table")
        print("   ✅ Initial Pollinations.ai URL entry")
        print("   ✅ Proper indexes and constraints")
        print("\n🔄 Next steps:")
        print("   1. Restart your backend server")
        print("   2. Test the new endpoints with: python test_services.py")
        print("   3. Update your extension to use the new API")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {str(e)}")
        print("Please check your database connection and try again.")
        raise

if __name__ == "__main__":
    asyncio.run(main())