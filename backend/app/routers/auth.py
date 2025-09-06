from fastapi import APIRouter, HTTPException, Depends, status
from app.models import LoginRequest, CreateUserRequest, AuthResponse, ErrorResponse, UserProfile
from app.database import get_supabase_client
from app.auth import get_current_user
from typing import Dict, Any

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=AuthResponse)
async def register(user_data: CreateUserRequest):
    """Register a new user"""
    try:
        # Create user in Supabase Auth
        supabase = get_supabase_client()
        auth_response = supabase.auth.sign_up({
            "email": user_data.email,
            "password": user_data.password,
            "options": {
                "data": {
                    "full_name": user_data.full_name
                }
            }
        })
        
        if auth_response.user:
            return AuthResponse(
                message="User registered successfully. Please check your email for verification.",
                user=UserProfile(
                    id=auth_response.user.id,
                    email=auth_response.user.email,
                    full_name=user_data.full_name,
                    created_at=auth_response.user.created_at
                ),
                access_token=auth_response.session.access_token if auth_response.session else None
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Registration failed"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Registration failed: {str(e)}"
        )

@router.post("/login", response_model=AuthResponse)
async def login(credentials: LoginRequest):
    """Login user"""
    try:
        supabase = get_supabase_client()
        auth_response = supabase.auth.sign_in_with_password({
            "email": credentials.email,
            "password": credentials.password
        })
        
        if auth_response.user and auth_response.session:
            return AuthResponse(
                message="Login successful",
                user=UserProfile(
                    id=auth_response.user.id,
                    email=auth_response.user.email,
                    full_name=auth_response.user.user_metadata.get("full_name"),
                    avatar_url=auth_response.user.user_metadata.get("avatar_url"),
                    created_at=auth_response.user.created_at
                ),
                access_token=auth_response.session.access_token,
                refresh_token=auth_response.session.refresh_token
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Login failed: {str(e)}"
        )

@router.post("/logout")
async def logout(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Logout user"""
    try:
        supabase = get_supabase_client()
        supabase.auth.sign_out()
        return {"message": "Logged out successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Logout failed: {str(e)}"
        )

@router.get("/me", response_model=UserProfile)
async def get_current_user_profile(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get current user profile"""
    return UserProfile(
        id=current_user["id"],
        email=current_user["email"],
        full_name=current_user.get("user_metadata", {}).get("full_name"),
        avatar_url=current_user.get("user_metadata", {}).get("avatar_url"),
        created_at=current_user["created_at"]
    )