#!/usr/bin/env python3
"""
FastAPI + Supabase Backend Server
Run with: python run.py
"""

import uvicorn
from app.config import settings

if __name__ == "__main__":
    # If port is in use, exit early
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind((settings.api_host, settings.api_port))
        except OSError:
            print(f"Port {settings.api_port} is already in use. Please free the port and try again.")
            exit(1)
            
    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.environment == "development",
        log_level="info"
    )