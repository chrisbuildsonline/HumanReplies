from fastapi import FastAPI, Request
from fastapi.middleware.base import BaseHTTPMiddleware
from fastapi.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)

class CustomCORSMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: FastAPI, allowed_origins: list = None):
        super().__init__(app)
        self.allowed_origins = allowed_origins or ["*"]
        logger.info(f"Initialized CustomCORSMiddleware with allowed origins: {self.allowed_origins}")

    async def dispatch(self, request: Request, call_next):
        # Log the request details
        origin = request.headers.get('origin', '')
        method = request.method
        path = request.url.path
        logger.debug(f"Request: {method} {path} from Origin: {origin}")

        if method == "OPTIONS":
            # Handle CORS preflight requests
            logger.info(f"CORS Preflight request: {method} {path} from Origin: {origin}")
            headers = {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE, PATCH",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Max-Age": "86400",  # 24 hours
            }
            return JSONResponse(content={"message": "CORS preflight accepted"}, headers=headers)
        
        # Process the request
        response = await call_next(request)
        
        # Add CORS headers to all responses
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS, PUT, DELETE, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        
        logger.debug(f"Response headers: {response.headers}")
        return response
