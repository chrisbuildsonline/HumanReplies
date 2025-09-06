from fastapi import APIRouter, HTTPException, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from sqlalchemy.orm import selectinload
from app.models import Reply, User, ReplyCreate, ReplyResponse, DashboardStats, RecentActivity
from app.database import get_db
from app.auth import get_current_user
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import json

router = APIRouter(prefix="/replies", tags=["Replies"])

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

@router.post("/", response_model=ReplyResponse)
async def create_reply(
    reply_data: ReplyCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new reply"""
    try:
        # Get or create user in local database
        user = await get_or_create_user(db, current_user)
        
        # Create reply
        reply = Reply(
            user_id=user.id,
            original_post=reply_data.original_post,
            generated_reply=reply_data.generated_reply,
            service_type=reply_data.service_type,
            post_url=reply_data.post_url,
            metadata=json.dumps(reply_data.metadata) if reply_data.metadata else None
        )
        
        db.add(reply)
        await db.commit()
        await db.refresh(reply)
        
        return ReplyResponse(
            id=str(reply.id),
            user_id=str(reply.user_id),
            original_post=reply.original_post,
            generated_reply=reply.generated_reply,
            service_type=reply.service_type,
            post_url=reply.post_url,
            metadata=json.loads(reply.metadata) if reply.metadata else None,
            created_at=reply.created_at,
            updated_at=reply.updated_at
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create reply: {str(e)}"
        )

@router.get("/", response_model=List[ReplyResponse])
async def get_user_replies(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    service_type: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's replies with pagination and filtering"""
    try:
        user = await get_or_create_user(db, current_user)
        
        # Build query
        query = select(Reply).where(Reply.user_id == user.id)
        
        if service_type:
            query = query.where(Reply.service_type == service_type)
        
        query = query.order_by(desc(Reply.created_at)).offset(skip).limit(limit)
        
        result = await db.execute(query)
        replies = result.scalars().all()
        
        return [
            ReplyResponse(
                id=str(reply.id),
                user_id=str(reply.user_id),
                original_post=reply.original_post,
                generated_reply=reply.generated_reply,
                service_type=reply.service_type,
                post_url=reply.post_url,
                metadata=json.loads(reply.metadata) if reply.metadata else None,
                created_at=reply.created_at,
                updated_at=reply.updated_at
            )
            for reply in replies
        ]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch replies: {str(e)}"
        )

@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get dashboard statistics"""
    try:
        user = await get_or_create_user(db, current_user)
        
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=7)
        month_start = today_start - timedelta(days=30)
        
        # Total replies
        total_result = await db.execute(
            select(func.count(Reply.id)).where(Reply.user_id == user.id)
        )
        total_replies = total_result.scalar() or 0
        
        # Today's replies
        today_result = await db.execute(
            select(func.count(Reply.id)).where(
                and_(Reply.user_id == user.id, Reply.created_at >= today_start)
            )
        )
        today_replies = today_result.scalar() or 0
        
        # Week replies
        week_result = await db.execute(
            select(func.count(Reply.id)).where(
                and_(Reply.user_id == user.id, Reply.created_at >= week_start)
            )
        )
        week_replies = week_result.scalar() or 0
        
        # Month replies
        month_result = await db.execute(
            select(func.count(Reply.id)).where(
                and_(Reply.user_id == user.id, Reply.created_at >= month_start)
            )
        )
        month_replies = month_result.scalar() or 0
        
        # Daily activity (last 7 days)
        daily_activity = []
        for i in range(7):
            day_start = today_start - timedelta(days=i)
            day_end = day_start + timedelta(days=1)
            
            day_result = await db.execute(
                select(func.count(Reply.id)).where(
                    and_(
                        Reply.user_id == user.id,
                        Reply.created_at >= day_start,
                        Reply.created_at < day_end
                    )
                )
            )
            count = day_result.scalar() or 0
            
            daily_activity.append({
                "date": day_start.strftime("%Y-%m-%d"),
                "count": count
            })
        
        daily_activity.reverse()  # Show oldest to newest
        
        # Top services
        services_result = await db.execute(
            select(Reply.service_type, func.count(Reply.id).label('count'))
            .where(Reply.user_id == user.id)
            .group_by(Reply.service_type)
            .order_by(desc('count'))
            .limit(5)
        )
        
        top_services = []
        for service, count in services_result:
            percentage = (count / total_replies * 100) if total_replies > 0 else 0
            top_services.append({
                "service": service,
                "count": count,
                "percentage": round(percentage, 1)
            })
        
        return DashboardStats(
            total_replies=total_replies,
            today_replies=today_replies,
            week_replies=week_replies,
            month_replies=month_replies,
            daily_activity=daily_activity,
            top_services=top_services
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch stats: {str(e)}"
        )

@router.get("/recent", response_model=RecentActivity)
async def get_recent_activity(
    limit: int = Query(10, ge=1, le=50),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get recent reply activity"""
    try:
        user = await get_or_create_user(db, current_user)
        
        # Get recent replies
        result = await db.execute(
            select(Reply)
            .where(Reply.user_id == user.id)
            .order_by(desc(Reply.created_at))
            .limit(limit)
        )
        replies = result.scalars().all()
        
        # Get total count
        count_result = await db.execute(
            select(func.count(Reply.id)).where(Reply.user_id == user.id)
        )
        total_count = count_result.scalar() or 0
        
        reply_responses = [
            ReplyResponse(
                id=str(reply.id),
                user_id=str(reply.user_id),
                original_post=reply.original_post,
                generated_reply=reply.generated_reply,
                service_type=reply.service_type,
                post_url=reply.post_url,
                metadata=json.loads(reply.metadata) if reply.metadata else None,
                created_at=reply.created_at,
                updated_at=reply.updated_at
            )
            for reply in replies
        ]
        
        return RecentActivity(
            replies=reply_responses,
            total_count=total_count
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch recent activity: {str(e)}"
        )

@router.delete("/{reply_id}")
async def delete_reply(
    reply_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a specific reply"""
    try:
        user = await get_or_create_user(db, current_user)
        
        # Find and delete reply
        result = await db.execute(
            select(Reply).where(
                and_(Reply.id == reply_id, Reply.user_id == user.id)
            )
        )
        reply = result.scalar_one_or_none()
        
        if not reply:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reply not found"
            )
        
        await db.delete(reply)
        await db.commit()
        
        return {"message": "Reply deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete reply: {str(e)}"
        )