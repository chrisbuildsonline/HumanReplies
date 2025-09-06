from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.models import ExternalServiceUrl, ServiceUrlsResponse, ExternalServiceUrlResponse, GenerateReplyRequest, GenerateReplyResponse
from app.database import get_db
from app.auth import get_current_user
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import httpx
import asyncio
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/services", tags=["External Services"])

# Cache duration for URLs (1 hour as requested)
CACHE_DURATION_HOURS = 1

async def get_or_update_service_url(db: AsyncSession, service_name: str, default_url: str) -> ExternalServiceUrl:
    """Get service URL from database or create/update if needed"""
    
    # Check if we have a cached URL
    result = await db.execute(
        select(ExternalServiceUrl).where(ExternalServiceUrl.service_name == service_name)
    )
    service_url = result.scalar_one_or_none()
    
    now = datetime.utcnow()
    
    # If no record exists or cache expired, fetch/update
    if not service_url or (service_url.cache_expires_at and service_url.cache_expires_at <= now):
        
        # For pollinations, we'll use the default URL since it's stable
        # In the future, you could add logic to check if the URL is still valid
        url_to_use = default_url
        
        if not service_url:
            # Create new record
            service_url = ExternalServiceUrl(
                service_name=service_name,
                url=url_to_use,
                is_active=True,
                last_checked=now,
                cache_expires_at=now + timedelta(hours=CACHE_DURATION_HOURS)
            )
            db.add(service_url)
        else:
            # Update existing record
            service_url.url = url_to_use
            service_url.last_checked = now
            service_url.cache_expires_at = now + timedelta(hours=CACHE_DURATION_HOURS)
            service_url.is_active = True
        
        await db.commit()
        await db.refresh(service_url)
        
        logger.info(f"Updated {service_name} URL: {url_to_use}")
    
    return service_url

@router.get("/urls", response_model=ServiceUrlsResponse)
async def get_service_urls(
    db: AsyncSession = Depends(get_db)
):
    """Get all external service URLs (cached for 1 hour)"""
    try:
        # Get pollinations URL
        pollinations_service = await get_or_update_service_url(
            db, 
            "pollinations", 
            "https://text.pollinations.ai"
        )
        
        return ServiceUrlsResponse(
            pollinations_url=pollinations_service.url,
            cache_expires_at=pollinations_service.cache_expires_at,
            last_updated=pollinations_service.last_checked
        )
        
    except Exception as e:
        logger.error(f"Failed to get service URLs: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch service URLs: {str(e)}"
        )

@router.get("/urls/{service_name}", response_model=ExternalServiceUrlResponse)
async def get_service_url(
    service_name: str,
    db: AsyncSession = Depends(get_db)
):
    """Get specific service URL"""
    try:
        # Map service names to default URLs
        default_urls = {
            "pollinations": "https://text.pollinations.ai"
        }
        
        if service_name not in default_urls:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Service '{service_name}' not supported"
            )
        
        service_url = await get_or_update_service_url(
            db, 
            service_name, 
            default_urls[service_name]
        )
        
        return ExternalServiceUrlResponse(
            service_name=service_url.service_name,
            url=service_url.url,
            is_active=service_url.is_active,
            last_checked=service_url.last_checked,
            cache_expires_at=service_url.cache_expires_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get service URL for {service_name}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch service URL: {str(e)}"
        )

@router.post("/urls/{service_name}/refresh")
async def refresh_service_url(
    service_name: str,
    db: AsyncSession = Depends(get_db)
):
    """Force refresh a service URL (admin function)"""
    try:
        # Find existing record
        result = await db.execute(
            select(ExternalServiceUrl).where(ExternalServiceUrl.service_name == service_name)
        )
        service_url = result.scalar_one_or_none()
        
        if not service_url:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Service '{service_name}' not found"
            )
        
        # Force cache expiration
        service_url.cache_expires_at = datetime.utcnow() - timedelta(minutes=1)
        await db.commit()
        
        # Get updated URL
        default_urls = {
            "pollinations": "https://text.pollinations.ai"
        }
        
        updated_service = await get_or_update_service_url(
            db, 
            service_name, 
            default_urls.get(service_name, service_url.url)
        )
        
        return {
            "message": f"Service URL for '{service_name}' refreshed successfully",
            "url": updated_service.url,
            "last_checked": updated_service.last_checked
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to refresh service URL for {service_name}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to refresh service URL: {str(e)}"
        )

@router.post("/generate-reply", response_model=GenerateReplyResponse)
async def generate_reply(
    request: GenerateReplyRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate a reply using external AI service (proxied through our backend)"""
    try:
        # Get pollinations URL
        pollinations_service = await get_or_update_service_url(
            db, 
            "pollinations", 
            "https://text.pollinations.ai"
        )
        
        if not pollinations_service.is_active:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI service is currently unavailable"
            )
        
        # Build prompt
        prompt = build_prompt(request.context, {
            "tone": request.tone,
            "platform": request.platform,
            "userWritingStyle": request.user_writing_style or ""
        })
        
        # Make request to pollinations
        async with httpx.AsyncClient(timeout=30.0) as client:
            encoded_prompt = httpx._utils.quote(prompt, safe='')
            url = f"{pollinations_service.url}/{encoded_prompt}"
            
            response = await client.get(url, headers={"Accept": "text/plain"})
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"AI service returned error: {response.status_code}"
                )
            
            reply = response.text.strip().strip('"').strip("'")
            
            # Store the reply for analytics (import the function from replies router)
            from app.routers.replies import get_or_create_user
            from app.models import Reply
            import json
            
            user = await get_or_create_user(db, current_user)
            
            # Store reply
            reply_record = Reply(
                user_id=user.id,
                original_post=request.context,
                generated_reply=reply,
                service_type=request.platform,
                post_url=None,
                reply_metadata=json.dumps({
                    "tone": request.tone,
                    "length": request.length,
                    "service_used": "pollinations",
                    "timestamp": datetime.utcnow().isoformat()
                })
            )
            
            db.add(reply_record)
            await db.commit()
            
            return GenerateReplyResponse(
                reply=reply,
                remaining_replies=None,  # Unlimited for now
                is_limit_reached=False,
                service_used="pollinations"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate reply: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate reply: {str(e)}"
        )

def build_prompt(context: str, options: Dict[str, Any]) -> str:
    """Build prompt for AI service - same logic as extension"""
    tone = options.get("tone", "helpful")
    platform = options.get("platform", "social media")
    user_writing_style = options.get("userWritingStyle", "")
    
    p = str(platform).lower()
    is_twitter = p == "twitter" or p == "x"
    
    platform_instructions = (
        "Limit to under 100 characters. Keep it very light and short, do not sound to stiff. "
        "Avoid hashtags and unnecessary @mentions. Use newlines \\r\\n if suitable. "
        if is_twitter else "Keep it concise and skimmable."
    )
    
    tone_instruction = "Write a helpful, balanced reply. "
    if tone == "joke":
        tone_instruction = "Write a funny, good-natured reply."
    elif tone == "support":
        tone_instruction = "Write a supportive, encouraging reply. You don't have to write keep going in every response."
    elif tone == "idea":
        tone_instruction = "Suggest an innovative, practical idea as a reply."
    elif tone == "confident":
        tone_instruction = "Write a confident, assertive reply."
    elif tone == "question":
        tone_instruction = "Ask a thoughtful, conversation-starting question as a reply."
    
    tone_instruction += (
        " You are replying to a human, so act like it. Use smileys only if appropriate. "
        "Build on the original post. Answer questions if asked."
    )
    
    no_dash_rule = (
        "Do not use em dashes (—) or en dashes (–). Use commas, periods, or semicolons instead. "
        "Grammar should be easy to read, for everyone. "
        "Before returning, scan the text and replace any em/en dash with a comma or period."
    )
    
    style = f"Adopt this writing style: {user_writing_style}" if user_writing_style else ""
    
    prompt_parts = [
        style,
        f"{tone_instruction} to this {('X (Twitter)' if is_twitter else p)} post: \"{context}\".",
        f"{platform_instructions} Keep it conversational and human-like.",
        "Be respectful. No emojis unless present in the original.",
        no_dash_rule,
        ". If you cant generate a valid reply, just reply with the text: error"
    ]
    
    return "\n".join(filter(None, prompt_parts)).strip()