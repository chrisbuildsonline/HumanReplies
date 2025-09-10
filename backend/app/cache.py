import asyncio
import json
import logging
from typing import Any, Optional, Callable, Awaitable

from app.config import settings

try:
    import redis.asyncio as redis  # type: ignore
except ImportError:  # pragma: no cover
    redis = None  # Fallback if dependency missing

logger = logging.getLogger(__name__)

class RedisCache:
    def __init__(self):
        # Use Any to avoid typing issues if redis is None/not installed at runtime
        self._client: Optional[Any] = None
        self._lock = asyncio.Lock()

    async def get_client(self) -> Optional[Any]:
        if not settings.redis_enabled or not redis:
            return None
        if self._client is None:
            async with self._lock:
                if self._client is None:  # double-checked locking
                    try:
                        self._client = redis.Redis(
                            host=settings.redis_host,
                            port=settings.redis_port,
                            db=settings.redis_db,
                            encoding="utf-8",
                            decode_responses=True,
                        )
                        # Ping to verify
                        await self._client.ping()
                        logger.info("Redis cache connected")
                    except Exception as e:  # pragma: no cover
                        logger.warning(f"Redis connection failed, disabling cache: {e}")
                        self._client = None
        return self._client

    async def get_json(self, key: str) -> Optional[Any]:
        client = await self.get_client()
        if not client:
            return None
        try:
            raw = await client.get(key)
            if raw is None:
                return None
            return json.loads(raw)
        except Exception as e:  # pragma: no cover
            logger.debug(f"Redis get failed for {key}: {e}")
            return None

    async def set_json(self, key: str, value: Any, ttl_seconds: int) -> None:
        client = await self.get_client()
        if not client:
            return
        try:
            await client.set(key, json.dumps(value), ex=ttl_seconds)
        except Exception as e:  # pragma: no cover
            logger.debug(f"Redis set failed for {key}: {e}")

    async def cached(self, key: str, ttl_seconds: int, loader: Callable[[], Awaitable[Any]]):
        # Try cache
        cached_value = await self.get_json(key)
        if cached_value is not None:
            return cached_value, True
        # Load fresh
        data = await loader()
        # Store
        await self.set_json(key, data, ttl_seconds)
        return data, False

redis_cache = RedisCache()
