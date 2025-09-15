from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.models import ExternalServiceUrl, ServiceUrlsResponse, ExternalServiceUrlResponse, GenerateReplyRequest, GenerateReplyResponse, Reply, User, Tone
from app.database import get_db
from app.auth import get_current_user, get_optional_user
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import httpx
import asyncio
import logging
import uuid

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/services", tags=["External Services"])

# Cache duration for URLs (1 hour as requested)
CACHE_DURATION_HOURS = 1

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

async def determine_tone_type(db: AsyncSession, tone_name: str, user_id: Optional[str] = None) -> str:
    """Determine if a tone is a preset or custom tone"""
    if not tone_name:
        return "unknown"
    
    # Check if it's a system preset
    result = await db.execute(
        select(Tone).where(and_(Tone.name == tone_name, Tone.is_preset == True))
    )
    preset_tone = result.scalar_one_or_none()
    
    if preset_tone:
        return tone_name  # Return the preset tone name
    
    # If user is provided, check if it's their custom tone
    if user_id:
        try:
            # Convert string to UUID if needed
            if isinstance(user_id, str):
                user_uuid = uuid.UUID(user_id)
            else:
                user_uuid = user_id
                
            result = await db.execute(
                select(Tone).where(and_(
                    Tone.name == tone_name, 
                    Tone.is_preset == False,
                    Tone.user_id == user_uuid
                ))
            )
            custom_tone = result.scalar_one_or_none()
            
            if custom_tone:
                return "custom"  # It's a user's custom tone
        except Exception:
            pass
    
    # If we can't find it, it might be a preset tone name that we just don't have in DB yet
    # Common preset tone names
    preset_names = ["helpful", "friendly", "professional", "casual", "encouraging", "humorous", "informative", "neutral"]
    if tone_name.lower() in preset_names:
        return tone_name.lower()
    
    return "unknown"

async def log_reply_usage(db: AsyncSession, platform: str, tone_type: str, user: Optional[User] = None):
    """Log reply usage for analytics"""
    try:
        reply = Reply(
            user_id=user.id if user else None,
            service_type=platform,
            tone_type=tone_type
        )
        db.add(reply)
        await db.commit()
    except Exception as e:
        logger.warning(f"Failed to log reply usage: {e}")
        # Don't fail the main request if logging fails

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
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate a prompt for AI reply generation (client will call pollinations directly)"""
    try:
        # Ensure pollinations URL is available in database
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
        
        # Get user if authenticated
        user = None
        user_settings = None
        if current_user:
            user = await get_or_create_user(db, current_user)
            # Get user settings if they exist
            from app.models import UserSettings
            result = await db.execute(
                select(UserSettings).where(UserSettings.user_id == user.id)
            )
            user_settings = result.scalar_one_or_none()
        
        # Try to fetch preset tone first
        tone_obj = None
        tone_type = "unknown"
        result = await db.execute(
            select(Tone).where(and_(Tone.name == request.tone, Tone.is_preset == True))
        )
        preset_tone = result.scalar_one_or_none()
        if preset_tone:
            tone_obj = preset_tone
            tone_type = request.tone
        elif user:
            try:
                user_uuid = user.id if not isinstance(user.id, str) else uuid.UUID(user.id)
                result = await db.execute(
                    select(Tone).where(and_(
                        Tone.name == request.tone,
                        Tone.is_preset == False,
                        Tone.user_id == user_uuid
                    ))
                )
                custom_tone = result.scalar_one_or_none()
                if custom_tone:
                    tone_obj = custom_tone
                    tone_type = "custom"
            except Exception:
                pass

        # If no matching tone, fallback to no tone
        prompt = build_prompt(request.context, {
            "tone_obj": tone_obj,
            "platform": request.platform,
            "length": request.length,
            "user_writing_style": request.user_writing_style,
            "user_settings": user_settings,
            "is_improve_mode": request.is_improve_mode
        })

        # Output prompt for debugging
        logger.info(f"Generated prompt: {prompt}")
        print(f"Generated prompt: {prompt}")

        # Log reply usage for analytics
        await log_reply_usage(db, request.platform, tone_type, user)

        # Return just the prompt, let client handle the actual generation
        return GenerateReplyResponse(
            generated_prompt=prompt,
            generated_response=None,  # Client will generate this
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
    """Build prompt for AI service - handles both reply generation and text improvement"""
    tone_obj = options.get("tone_obj")
    platform = options.get("platform", "social media")
    length = options.get("length", "medium")
    user_writing_style = options.get("user_writing_style")
    user_settings = options.get("user_settings")
    is_improve_mode = options.get("is_improve_mode", False)

    p = str(platform).lower()
    is_twitter = p == "twitter" or p == "x"

    # Length-based character limits - different for improve vs reply mode
    if is_improve_mode:
        length_instructions = {
            "short": "Keep the improved version concise and focused.",
            "medium": "Enhance the text while maintaining reasonable length.",
            "long": "Feel free to expand and add detail while improving clarity and impact."
        }
    else:
        length_instructions = {
            "short": "Keep it very brief, under 50 characters.",
            "medium": "Limit to under 100 characters." if is_twitter else "Keep it moderately concise, under 200 characters.",
            "long": "You can be more detailed, up to 280 characters." if is_twitter else "Feel free to be more comprehensive, up to 500 characters."
        }

    platform_instructions = length_instructions.get(length, length_instructions['medium'])

    # Use tone_obj's instruction/description if available
    if tone_obj and hasattr(tone_obj, "instruction") and tone_obj.instruction:
        tone_instruction = tone_obj.instruction
    elif tone_obj and hasattr(tone_obj, "description") and tone_obj.description:
        tone_instruction = tone_obj.description
    else:
        # Default instruction based on mode
        if is_improve_mode:
            tone_instruction = ""  # No default needed for improve mode
        else:
            tone_instruction = "Reply"  # Default for reply mode

    # Add user's custom writing style if provided
    custom_writing_instructions = ""
    if user_settings and hasattr(user_settings, "writing_style") and user_settings.writing_style:
        custom_writing_instructions = f"Important: Follow this custom writing style: {user_settings.writing_style}. "
    elif user_writing_style:
        custom_writing_instructions = f"Important: Follow this custom writing style: {user_writing_style}. "

    # Add guardian text (what NOT to do) if provided
    guardian_instructions = ""
    if user_settings and hasattr(user_settings, "guardian_text") and user_settings.guardian_text:
        guardian_instructions = f"IMPORTANT - Do NOT: {user_settings.guardian_text}. "

    # No dash rule
    no_dash_rule = (
        "Do not use em dashes (—) or en dashes (–). Use commas, periods, or semicolons instead. "
        "Before returning, scan the text and replace any em/en dash with a comma or period."
    )

    # Request 3 variations in JSON format - different wording for improve vs reply mode
    if is_improve_mode:
        variation_instruction = (
            "Generate exactly 3 different improved versions of the text. "
            "Return them as a JSON object with this exact format: "
            "{\"variations\": [\"variation1\", \"variation2\", \"variation3\"]}. "
            "Each variation should be a unique improvement and follow all the rules above. "
            "Do not include any other text outside the JSON response."
        )
    else:
        variation_instruction = (
            "Generate exactly 3 different variations of the reply. "
            "Return them as a JSON object with this exact format: "
            "{\"variations\": [\"variation1\", \"variation2\", \"variation3\"]}. "
            "Each variation should be unique and follow all the rules above. "
            "Do not include any other text outside the JSON response."
        )

    # Different prompt structure for improve mode vs reply mode
    if is_improve_mode:
        # For improve mode: focus on enhancing existing text
        main_instruction = f"Improve this text to make it more {tone_instruction.lower() if tone_instruction else 'polished and professional'}: \"{context}\"."
        fallback_message = "If you can't improve the text, return: {\"variations\": [\"error\", \"error\", \"error\"]}"
    else:
        # For reply mode: generate response to content
        main_instruction = f"{tone_instruction} to this {('X (Twitter)' if is_twitter else p)} post: \"{context}\"."
        fallback_message = "If you can't generate valid replies, return: {\"variations\": [\"error\", \"error\", \"error\"]}"

    prompt_parts = [
        main_instruction,
        custom_writing_instructions,
        guardian_instructions,
        f"{platform_instructions}",
        no_dash_rule,
        variation_instruction,
        fallback_message
    ]

    return "\n".join(filter(None, prompt_parts)).strip()