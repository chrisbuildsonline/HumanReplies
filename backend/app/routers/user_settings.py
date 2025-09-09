from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import UserSettings, UserSettingsResponse, UserSettingsCreateRequest, UserSettingsUpdateRequest
from app.auth import get_current_user
from app.models import User
import uuid
from typing import Dict, Any

router = APIRouter(prefix="/user-settings", tags=["user-settings"])

@router.get("/", response_model=UserSettingsResponse)
async def get_user_settings(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current user's settings"""
    try:
        # Get user from database using supabase user ID
        user_result = await db.execute(
            select(User).where(User.supabase_user_id == current_user["id"])
        )
        user = user_result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user_uuid = user.id
        
        result = await db.execute(
            select(UserSettings).where(UserSettings.user_id == user_uuid)
        )
        settings = result.scalar_one_or_none()
        
        if not settings:
            # Create default settings if none exist
            settings = UserSettings(
                user_id=user_uuid,
                writing_style=None,
                guardian_text=None
            )
            db.add(settings)
            await db.commit()
            await db.refresh(settings)
        
        return UserSettingsResponse(
            id=str(settings.id),
            user_id=str(settings.user_id),
            writing_style=settings.writing_style,
            guardian_text=settings.guardian_text,
            created_at=settings.created_at,
            updated_at=settings.updated_at
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving user settings: {str(e)}"
        )

@router.post("/", response_model=UserSettingsResponse)
async def create_user_settings(
    settings_request: UserSettingsCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create user settings (only if none exist)"""
    try:
        # Get user from database using supabase user ID
        user_result = await db.execute(
            select(User).where(User.supabase_user_id == current_user["id"])
        )
        user = user_result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user_uuid = user.id
        
        # Check if settings already exist
        result = await db.execute(
            select(UserSettings).where(UserSettings.user_id == user_uuid)
        )
        existing_settings = result.scalar_one_or_none()
        
        if existing_settings:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User settings already exist. Use PUT to update."
            )
        
        # Create new settings
        settings = UserSettings(
            user_id=user_uuid,
            writing_style=settings_request.writing_style,
            guardian_text=settings_request.guardian_text
        )
        
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
        
        return UserSettingsResponse(
            id=str(settings.id),
            user_id=str(settings.user_id),
            writing_style=settings.writing_style,
            guardian_text=settings.guardian_text,
            created_at=settings.created_at,
            updated_at=settings.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating user settings: {str(e)}"
        )

@router.put("/", response_model=UserSettingsResponse)
async def update_user_settings(
    settings_request: UserSettingsUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update user settings"""
    try:
        # Get user from database using supabase user ID
        user_result = await db.execute(
            select(User).where(User.supabase_user_id == current_user["id"])
        )
        user = user_result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user_uuid = user.id
        
        result = await db.execute(
            select(UserSettings).where(UserSettings.user_id == user_uuid)
        )
        settings = result.scalar_one_or_none()
        
        if not settings:
            # Create settings if they don't exist
            settings = UserSettings(
                user_id=user_uuid,
                writing_style=settings_request.writing_style,
                guardian_text=settings_request.guardian_text
            )
            db.add(settings)
        else:
            # Update existing settings
            if settings_request.writing_style is not None:
                settings.writing_style = settings_request.writing_style
            if settings_request.guardian_text is not None:
                settings.guardian_text = settings_request.guardian_text
        
        await db.commit()
        await db.refresh(settings)
        
        return UserSettingsResponse(
            id=str(settings.id),
            user_id=str(settings.user_id),
            writing_style=settings.writing_style,
            guardian_text=settings.guardian_text,
            created_at=settings.created_at,
            updated_at=settings.updated_at
        )
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating user settings: {str(e)}"
        )

@router.delete("/", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_settings(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete user settings (reset to defaults)"""
    try:
        # Get user from database using supabase user ID
        user_result = await db.execute(
            select(User).where(User.supabase_user_id == current_user["id"])
        )
        user = user_result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user_uuid = user.id
        
        result = await db.execute(
            select(UserSettings).where(UserSettings.user_id == user_uuid)
        )
        settings = result.scalar_one_or_none()
        
        if settings:
            await db.delete(settings)
            await db.commit()
        
        return None
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting user settings: {str(e)}"
        )
