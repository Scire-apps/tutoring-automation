import time
from typing import Any, Callable, Optional, Tuple, Dict
from collections import OrderedDict


class TTLCache:
    """Simple thread-unsafe TTL cache with LRU eviction.

    Intended for small, read-mostly caches inside a single worker process.
    """

    def __init__(self, max_size: int = 128, ttl_seconds: int = 300):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self._store: OrderedDict[str, Tuple[float, Any]] = OrderedDict()

    def get(self, key: str) -> Optional[Any]:
        now = time.time()
        entry = self._store.get(key)
        if not entry:
            return None
        ts, value = entry
        if now - ts > self.ttl_seconds:
            try:
                del self._store[key]
            except Exception:
                pass
            return None
        try:
            self._store.move_to_end(key)
        except Exception:
            pass
        return value

    def set(self, key: str, value: Any) -> None:
        now = time.time()
        self._store[key] = (now, value)
        try:
            self._store.move_to_end(key)
        except Exception:
            pass
        while len(self._store) > self.max_size:
            try:
                self._store.popitem(last=False)
            except Exception:
                break


