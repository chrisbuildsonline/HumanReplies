from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from typing import Optional, Dict, Any
from app.config import settings
from app.database import supabase

security = HTTPBearer()

class AuthService:
    @staticmethod
    def verify_token(token: str) -> Dict[str, Any]:
        """Verify JWT token and return user data"""
        try:
            payload = jwt.decode(
                token, 
                settings.supabase_jwt_secret, 
                algorithms=["HS256"],
                audience="authenticated"
            )
            return payload
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token"
            )
    
    @staticmethod
    def get_user_from_token(token: str) -> Dict[str, Any]:
        """Get user data from Supabase using token"""
        try:
            # Set the auth token for this request
            supabase.auth.set_session(token, "")
            user = supabase.auth.get_user()
            if not user.user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found"
                )
            return user.user.model_dump()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token or user not found"
            )

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """Dependency to get current authenticated user"""
    token = credentials.credentials
    payload = AuthService.verify_token(token)
    user = AuthService.get_user_from_token(token)
    return user

async def get_optional_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[Dict[str, Any]]:
    """Optional authentication - returns None if no token provided"""
    if not credentials:
        return None
    return await get_current_user(credentials)