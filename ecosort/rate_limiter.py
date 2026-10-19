# -*- coding: utf-8 -*-
"""
EcoSort Basic In-Memory Rate Limiter.
Sliding-window limiter to protect inference endpoints from abuse.
"""
import time
from collections import defaultdict
from threading import Lock


class RateLimiter:
    """
    Sliding window in-memory rate limiter per client IP.
    """

    def __init__(self, max_requests: int = 30, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests = defaultdict(list)
        self._lock = Lock()

    def is_allowed(self, client_ip: str) -> tuple[bool, int]:
        """
        Check if client_ip is within rate limits.
        Returns (is_allowed: bool, retry_after: int).
        """
        now = time.time()
        with self._lock:
            timestamps = self._requests[client_ip]
            cutoff = now - self.window_seconds
            # Purge expired timestamps
            self._requests[client_ip] = [ts for ts in timestamps if ts > cutoff]
            current_count = len(self._requests[client_ip])

            if current_count >= self.max_requests:
                oldest = self._requests[client_ip][0]
                retry_after = max(1, int(oldest + self.window_seconds - now))
                return False, retry_after

            self._requests[client_ip].append(now)
            return True, 0

    def reset(self):
        """Clear all rate limit histories (useful for testing)."""
        with self._lock:
            self._requests.clear()


def get_client_ip(request) -> str:
    """
    Extract reliable client IP taking into account reverse proxies / Vercel headers.
    """
    forwarded = request.headers.get('X-Forwarded-For')
    if forwarded:
        return forwarded.split(',')[0].strip()
    real_ip = request.headers.get('X-Real-IP')
    if real_ip:
        return real_ip.strip()
    return request.remote_addr or '127.0.0.1'
