#!/usr/bin/env python3
"""
Setup script to insert default tones into the database
"""

import asyncio
import sys
import os
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

# Add the app directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.database import AsyncSessionLocal
from app.models import Tone

# Default tones to insert
DEFAULT_TONES = [
    {
        "name": "neutral",
        "display_name": "👍 Neutral",
        "description": "Balanced and helpful tone",
        "sort_order": 1
    },
    {
        "name": "joke",
        "display_name": "😂 Joke",
        "description": "Funny and light-hearted tone",
        "sort_order": 2
    },
    {
        "name": "support",
        "display_name": "❤️ Support",
        "description": "Supportive and encouraging tone",
        "sort_order": 3
    },
    {
        "name": "idea",
        "display_name": "💡 Idea",
        "description": "Innovative and creative suggestions",
        "sort_order": 4
    },
    {
        "name": "question",
        "display_name": "❓ Question",
        "description": "Thoughtful conversation starters",
        "sort_order": 5
    },
    {
        "name": "confident",
        "display_name": "💪 Confident",
        "description": "Assertive and confident tone",
        "sort_order": 6
    }
]

async def setup_tones():
    """Insert default tones into the database"""
    print("Setting up default tones...")
    
    async with AsyncSessionLocal() as db:
        try:
            # Check existing tones
            result = await db.execute(select(Tone))
            existing_tones = result.scalars().all()
            existing_names = {tone.name for tone in existing_tones}
            
            # Insert new tones
            new_tones_count = 0
            for tone_data in DEFAULT_TONES:
                if tone_data["name"] not in existing_names:
                    tone = Tone(
                        name=tone_data["name"],
                        display_name=tone_data["display_name"],
                        description=tone_data["description"],
                        is_preset=True,
                        is_active=True,
                        sort_order=tone_data["sort_order"]
                    )
                    db.add(tone)
                    new_tones_count += 1
                    print(f"  Added tone: {tone_data['display_name']}")
                else:
                    print(f"  Skipped existing tone: {tone_data['display_name']}")
            
            if new_tones_count > 0:
                await db.commit()
                print(f"\n✅ Successfully added {new_tones_count} new tones to the database")
            else:
                print("\n✅ All default tones already exist in the database")
                
        except Exception as e:
            await db.rollback()
            print(f"\n❌ Error setting up tones: {str(e)}")
            raise

if __name__ == "__main__":
    asyncio.run(setup_tones())