from datetime import datetime, timedelta
from typing import Any, Optional, Dict
from threading import Lock


class Cache:
    """Simple in-memory cache with TTL support."""

    def __init__(self, default_ttl_seconds: int = 3600):
        self._cache: Dict[str, tuple[Any, datetime]] = {}
        self._default_ttl = default_ttl_seconds
        self._lock = Lock()

    def get(self, key: str) -> Optional[Any]:
        """Get a value from cache if it exists and hasn't expired."""
        with self._lock:
            if key not in self._cache:
                return None
            value, expiry = self._cache[key]
            if datetime.now() > expiry:
                del self._cache[key]
                return None
            return value

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        """Set a value in cache with optional custom TTL."""
        ttl = ttl_seconds if ttl_seconds is not None else self._default_ttl
        expiry = datetime.now() + timedelta(seconds=ttl)
        with self._lock:
            self._cache[key] = (value, expiry)

    def delete(self, key: str) -> None:
        """Remove a key from cache."""
        with self._lock:
            self._cache.pop(key, None)

    def clear(self) -> None:
        """Clear all cached values."""
        with self._lock:
            self._cache.clear()

    def cleanup_expired(self) -> int:
        """Remove all expired entries. Returns count of removed entries."""
        now = datetime.now()
        removed = 0
        with self._lock:
            expired_keys = [k for k, (_, expiry) in self._cache.items() if now > expiry]
            for key in expired_keys:
                del self._cache[key]
                removed += 1
        return removed


# Global cache instances
team_cache = Cache(default_ttl_seconds=86400)  # 24 hours for team data
match_cache = Cache(default_ttl_seconds=3600)  # 1 hour for match data
series_cache = Cache(default_ttl_seconds=1800)  # 30 minutes for series state
