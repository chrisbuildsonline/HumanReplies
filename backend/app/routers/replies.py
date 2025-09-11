from fastapi import APIRouter, HTTPException, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from app.models import Reply, User, ReplyCreate, ReplyResponse, DashboardStats, RecentActivity
from app.database import get_db
from app.auth import get_current_user, get_optional_user
from app.cache import redis_cache
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

router = APIRouter(prefix="/replies", tags=["Replies - Privacy First Analytics"])

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
async def log_reply_usage(
    reply_data: ReplyCreate,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """Log reply usage for analytics - NO SENSITIVE DATA STORED
    
    Only logs:
    - Timestamp of when reply was generated
    - Service type (platform key like 'x', 'facebook', 'linkedin')  
    - User ID (only if user is logged in)
    
    NO content, URLs, or other sensitive data is stored.
    """
    try:
        user_id = None
        
        # Only get user ID if user is authenticated
        if current_user:
            user = await get_or_create_user(db, current_user)
            user_id = user.id
        
        # Create minimal analytics record - NO SENSITIVE DATA
        reply = Reply(
            user_id=user_id,  # NULL if not logged in
            service_type=reply_data.service_type,  # Just the platform key
            tone_type=reply_data.tone_type  # The tone used for the reply
            # NO original_post, generated_reply, post_url, or metadata stored!
        )
        
        db.add(reply)
        await db.commit()
        await db.refresh(reply)
        
        return ReplyResponse(
            id=str(reply.id),
            user_id=str(reply.user_id) if reply.user_id else None,
            service_type=reply.service_type,
            tone_type=reply.tone_type,
            created_at=reply.created_at
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to log reply usage: {str(e)}"
        )

@router.get("/", response_model=List[ReplyResponse])
async def get_user_reply_analytics(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    service_type: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's reply analytics (timestamps and service types only)"""
    try:
        user = await get_or_create_user(db, current_user)
        
        # Build query - only return analytics data, no content
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
                service_type=reply.service_type,
                tone_type=reply.tone_type,
                created_at=reply.created_at
            )
            for reply in replies
        ]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch reply analytics: {str(e)}"
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
    """Get recent reply activity (analytics only - no sensitive data)"""
    try:
        user = await get_or_create_user(db, current_user)
        
        # Get recent reply analytics
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
                service_type=reply.service_type,
                tone_type=reply.tone_type,
                created_at=reply.created_at
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
async def delete_reply_analytics(
    reply_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a specific reply analytics record"""
    try:
        user = await get_or_create_user(db, current_user)
        
        # Find and delete reply analytics record
        result = await db.execute(
            select(Reply).where(
                and_(Reply.id == reply_id, Reply.user_id == user.id)
            )
        )
        reply = result.scalar_one_or_none()
        
        if not reply:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reply analytics record not found"
            )
        
        await db.delete(reply)
        await db.commit()
        
        return {"message": "Reply analytics record deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete reply analytics: {str(e)}"
        )

@router.get("/count")
async def get_total_replies(db: AsyncSession = Depends(get_db)):
    """Get total count of all replies in the system - cached for 5 minutes"""
    try:
        cache_key = "total_replies_count"
        
        async def load_total_count():
            result = await db.execute(select(func.count(Reply.id)))
            return result.scalar() or 0
        
        # Use Redis cache with 5 minute (300 seconds) TTL
        total_count, was_cached = await redis_cache.cached(
            cache_key, 
            300,  # 5 minutes
            load_total_count
        )
        
        return {
            "success": True,
            "total_replies": total_count,
            "cached": was_cached
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch total replies count: {str(e)}"
        )