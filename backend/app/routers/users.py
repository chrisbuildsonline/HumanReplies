from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import User, UserProfile, UpdateUserRequest, BaseResponse
from app.database import get_db
from app.auth import get_current_user
from typing import Dict, Any

router = APIRouter(prefix="/users", tags=["Users"])

async def get_or_create_user(db: AsyncSession, supabase_user: Dict[str, Any]) -> User:
    """Get existing user or create new one"""
    # Check if user exists
    result = await db.execute(
        select(User).where(User.supabase_user_id == supabase_user["id"])
    )
    user = result.scalar_one_or_none()
    
    if not user:
        # Create new user
        user = User(
            supabase_user_id=supabase_user["id"],
            email=supabase_user["email"],
            full_name=supabase_user.get("user_metadata", {}).get("full_name"),
            avatar_url=supabase_user.get("user_metadata", {}).get("avatar_url")
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    
    return user

@router.get("/profile", response_model=UserProfile)
async def get_user_profile(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user profile from local database"""
    try:
        user = await get_or_create_user(db, current_user)
        
        return UserProfile(
            id=str(user.id),
            email=user.email,
            full_name=user.full_name,
            avatar_url=user.avatar_url,
            role=user.role,
            created_at=user.created_at,
            updated_at=user.updated_at
        )
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch profile: {str(e)}"
        )

@router.put("/profile", response_model=UserProfile)
async def update_user_profile(
    update_data: UpdateUserRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update user profile in local database"""
    try:
        user = await get_or_create_user(db, current_user)
        
        update_dict = update_data.model_dump(exclude_unset=True)
        if not update_dict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No data provided for update"
            )
        
        # Update user fields
        for field, value in update_dict.items():
            if hasattr(user, field):
                setattr(user, field, value)
        
        await db.commit()
        await db.refresh(user)
        
        return UserProfile(
            id=str(user.id),
            email=user.email,
            full_name=user.full_name,
            avatar_url=user.avatar_url,
            role=user.role,
            created_at=user.created_at,
            updated_at=user.updated_at
        )
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update profile: {str(e)}"
        )

@router.delete("/profile", response_model=BaseResponse)
async def delete_user_account(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Deactivate user account (soft delete)"""
    try:
        user = await get_or_create_user(db, current_user)
        
        # Soft delete by marking as inactive
        user.is_active = False
        await db.commit()
        
        return BaseResponse(message="Account deactivated successfully")
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to deactivate account: {str(e)}"
        )