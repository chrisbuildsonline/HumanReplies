from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from app.routers import auth, users, replies, services
from app.config import settings
from app.database import engine, Base
import uvicorn
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database initialization
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Cleanup on shutdown
    await engine.dispose()

# Create FastAPI app
app = FastAPI(
    title="HumanReplies Backend",
    description="FastAPI backend with Supabase auth and PostgreSQL data storage",
    version="1.0.0",
    docs_url="/docs" if settings.environment == "development" else None,
    redoc_url="/redoc" if settings.environment == "development" else None,
    lifespan=lifespan
)

# Configure CORS properly
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# Add explicit OPTIONS handlers for common API paths
@app.options("/api/v1/services/generate-reply")
async def options_generate_reply():
    return JSONResponse(
        content={"message": "CORS preflight accepted"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE, PATCH",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Max-Age": "86400",  # 24 hours
        }
    )

# Global exception handler
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.detail,
            "status_code": exc.status_code
        }
    )

# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "environment": settings.environment,
        "message": "HumanReplies backend is running",
        "database": "PostgreSQL + Supabase Auth"
    }

# Include routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(replies.router, prefix="/api/v1")
app.include_router(services.router, prefix="/api/v1")

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Welcome to the HumanReplies Backend",
        "docs": "/docs" if settings.environment == "development" else "Documentation disabled in production",
        "health": "/health",
        "features": [
            "Supabase Authentication",
            "PostgreSQL Data Storage", 
            "Reply Management",
            "Dashboard Statistics",
            "Multi-platform Support"
        ]
    }

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.environment == "development"
    )