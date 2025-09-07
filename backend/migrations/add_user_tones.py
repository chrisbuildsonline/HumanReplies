#!/usr/bin/env python3
"""
Migration to add user_id column to tones table for custom user tones
"""

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import AsyncSessionLocal

async def migrate_add_user_tones():
    """Add user_id column to tones table"""
    print("Adding user_id column to tones table...")
    
    async with AsyncSessionLocal() as db:
        try:
            # Add user_id column to tones table
            await db.execute(text("""
                ALTER TABLE tones 
                ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
            """))
            
            # Add index on user_id for performance
            await db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_tones_user_id ON tones(user_id);
            """))
            
            await db.commit()
            print("✅ Successfully added user_id column to tones table")
            
        except Exception as e:
            await db.rollback()
            print(f"❌ Error adding user_id column: {str(e)}")
            raise

if __name__ == "__main__":
    asyncio.run(migrate_add_user_tones())