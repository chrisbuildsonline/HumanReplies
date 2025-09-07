from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from app.models import Tone, ToneResponse, TonesListResponse, ToneCreateRequest, User
from app.database import get_db
from app.auth import get_optional_user, get_current_user
from typing import List, Optional, Dict, Any
import logging
import re

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tones", tags=["Tones"])

@router.get("/", response_model=TonesListResponse)
async def get_tones(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    """Get all active tones (presets + user's custom tones if authenticated)"""
    try:
        # Base query for preset tones
        query = select(Tone).where(
            and_(Tone.is_active == True, Tone.is_preset == True)
        )
        
        # If user is authenticated, also include their custom tones
        if current_user:
            # Get user from database
            user_result = await db.execute(
                select(User).where(User.supabase_user_id == current_user["id"])
            )
            user = user_result.scalar_one_or_none()
            
            if user:
                # Include both preset tones and user's custom tones
                query = select(Tone).where(
                    and_(
                        Tone.is_active == True,
                        or_(
                            Tone.is_preset == True,
                            Tone.user_id == user.id
                        )
                    )
                )
        
        result = await db.execute(query.order_by(Tone.sort_order, Tone.name))
        tones = result.scalars().all()
        
        tone_responses = [
            ToneResponse(
                id=str(tone.id),
                name=tone.name,
                display_name=tone.display_name,
                description=tone.description,
                is_preset=tone.is_preset,
                is_active=tone.is_active,
                sort_order=tone.sort_order,
                user_id=str(tone.user_id) if tone.user_id else None
            )
            for tone in tones
        ]
        
        return TonesListResponse(tones=tone_responses)
        
    except Exception as e:
        logger.error(f"Failed to get tones: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch tones: {str(e)}"
        )

@router.get("/presets", response_model=TonesListResponse)
async def get_preset_tones(
    db: AsyncSession = Depends(get_db)
):
    """Get only preset tones"""
    try:
        result = await db.execute(
            select(Tone)
            .where(and_(Tone.is_active == True, Tone.is_preset == True))
            .order_by(Tone.sort_order, Tone.name)
        )
        tones = result.scalars().all()
        
        tone_responses = [
            ToneResponse(
                id=str(tone.id),
                name=tone.name,
                display_name=tone.display_name,
                description=tone.description,
                is_preset=tone.is_preset,
                is_active=tone.is_active,
                sort_order=tone.sort_order,
                user_id=None
            )
            for tone in tones
        ]
        
        return TonesListResponse(tones=tone_responses)
        
    except Exception as e:
        logger.error(f"Failed to get preset tones: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch preset tones: {str(e)}"
        )

@router.post("/", response_model=ToneResponse)
async def create_custom_tone(
    tone_data: ToneCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Create a custom tone for the authenticated user"""
    try:
        # Get user from database
        user_result = await db.execute(
            select(User).where(User.supabase_user_id == current_user["id"])
        )
        user = user_result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Validate tone name (lowercase, alphanumeric + underscores only)
        if not re.match(r'^[a-z0-9_]+$', tone_data.name):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tone name must be lowercase and contain only letters, numbers, and underscores"
            )
        
        # Check if tone name already exists for this user or as a preset
        existing_tone = await db.execute(
            select(Tone).where(
                and_(
                    Tone.name == tone_data.name,
                    or_(
                        Tone.is_preset == True,
                        Tone.user_id == user.id
                    )
                )
            )
        )
        
        if existing_tone.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A tone with this name already exists"
            )
        
        # Create new custom tone
        new_tone = Tone(
            name=tone_data.name,
            display_name=tone_data.display_name,
            description=tone_data.description,
            is_preset=False,
            is_active=True,
            sort_order=1000,  # Custom tones appear after presets
            user_id=user.id
        )
        
        db.add(new_tone)
        await db.commit()
        await db.refresh(new_tone)
        
        return ToneResponse(
            id=str(new_tone.id),
            name=new_tone.name,
            display_name=new_tone.display_name,
            description=new_tone.description,
            is_preset=new_tone.is_preset,
            is_active=new_tone.is_active,
            sort_order=new_tone.sort_order,
            user_id=str(new_tone.user_id)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to create custom tone: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create tone: {str(e)}"
        )

@router.put("/{tone_id}", response_model=ToneResponse)
async def update_custom_tone(
    tone_id: str,
    tone_data: ToneCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Update a custom tone (only the owner can update)"""
    try:
        # Get user from database
        user_result = await db.execute(
            select(User).where(User.supabase_user_id == current_user["id"])
        )
        user = user_result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Get the tone
        tone_result = await db.execute(
            select(Tone).where(Tone.id == tone_id)
        )
        tone = tone_result.scalar_one_or_none()
        
        if not tone:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tone not found"
            )
        
        # Check if user owns this tone
        if tone.is_preset or tone.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update your own custom tones"
            )
        
        # Validate tone name
        if not re.match(r'^[a-z0-9_]+$', tone_data.name):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tone name must be lowercase and contain only letters, numbers, and underscores"
            )
        
        # Check if new name conflicts (excluding current tone)
        if tone_data.name != tone.name:
            existing_tone = await db.execute(
                select(Tone).where(
                    and_(
                        Tone.name == tone_data.name,
                        Tone.id != tone.id,
                        or_(
                            Tone.is_preset == True,
                            Tone.user_id == user.id
                        )
                    )
                )
            )
            
            if existing_tone.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A tone with this name already exists"
                )
        
        # Update tone
        tone.name = tone_data.name
        tone.display_name = tone_data.display_name
        tone.description = tone_data.description
        
        await db.commit()
        await db.refresh(tone)
        
        return ToneResponse(
            id=str(tone.id),
            name=tone.name,
            display_name=tone.display_name,
            description=tone.description,
            is_preset=tone.is_preset,
            is_active=tone.is_active,
            sort_order=tone.sort_order,
            user_id=str(tone.user_id)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to update custom tone: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update tone: {str(e)}"
        )

@router.delete("/{tone_id}")
async def delete_custom_tone(
    tone_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Delete a custom tone (only the owner can delete)"""
    try:
        # Get user from database
        user_result = await db.execute(
            select(User).where(User.supabase_user_id == current_user["id"])
        )
        user = user_result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Get the tone
        tone_result = await db.execute(
            select(Tone).where(Tone.id == tone_id)
        )
        tone = tone_result.scalar_one_or_none()
        
        if not tone:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tone not found"
            )
        
        # Check if user owns this tone
        if tone.is_preset or tone.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own custom tones"
            )
        
        # Delete tone
        await db.delete(tone)
        await db.commit()
        
        return {"success": True, "message": "Tone deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to delete custom tone: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete tone: {str(e)}"
        )