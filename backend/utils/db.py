import os
import logging
import time
from collections import OrderedDict
from supabase import create_client, Client
from typing import Dict, List, Any, Optional, Tuple

# Configure logging
logger = logging.getLogger(__name__)

class DatabaseManager:
    """Ephemeral Supabase client manager using anon key and optional user JWT."""

    def __init__(self, user_jwt: Optional[str] = None):
        url = os.environ.get("SUPABASE_URL")
        anon_key = os.environ.get("SUPABASE_ANON_KEY")
        if not url or not anon_key:
            raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set")
        try:
            self._client: Client = create_client(url, anon_key)
            # Attach user JWT when provided so RLS is enforced by Supabase
            if user_jwt:
                try:
                    self._client.postgrest.auth(user_jwt)
                except Exception:
                    # If token is invalid, queries will fail under RLS in subsequent calls
                    pass
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {str(e)}")
            raise

    @property
    def client(self) -> Client:
        return self._client

    # Convenience helpers (optional; used by a few call sites)
    def query_table(self, table_name: str, query_params: Optional[Dict] = None) -> List[Dict]:
        try:
            query = self.client.table(table_name).select("*")
            if query_params:
                if 'filter' in query_params:
                    for column, operator, value in query_params['filter']:
                        query = query.filter(column, operator, value)
                if 'order' in query_params:
                    column, direction = query_params['order']
                    query = query.order(column, ascending=(direction.lower() == 'asc'))
                if 'limit' in query_params:
                    query = query.limit(query_params['limit'])
            response = query.execute()
            return response.data
        except Exception as e:
            logger.error(f"Error querying table {table_name}: {str(e)}")
            raise

    def insert_record(self, table_name: str, record_data: Dict) -> Dict:
        try:
            response = self.client.table(table_name).insert(record_data).execute()
            return response.data[0] if response.data else {}
        except Exception as e:
            logger.error(f"Error inserting into table {table_name}: {str(e)}")
            raise

    def update_record(self, table_name: str, record_id: str, record_data: Dict) -> Dict:
        try:
            response = self.client.table(table_name).update(record_data).eq("id", record_id).execute()
            return response.data[0] if response.data else {}
        except Exception as e:
            logger.error(f"Error updating record in table {table_name}: {str(e)}")
            raise

    def delete_record(self, table_name: str, record_id: str) -> Dict:
        try:
            response = self.client.table(table_name).delete().eq("id", record_id).execute()
            return response.data[0] if response.data else {}
        except Exception as e:
            logger.error(f"Error deleting record from table {table_name}: {str(e)}")
            raise


def _extract_bearer_token_from_request() -> Optional[str]:
    try:
        from flask import request
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return None
        parts = auth_header.split()
        if len(parts) == 2 and parts[0].lower() == 'bearer':
            return parts[1]
        return None
    except Exception:
        return None


class _ClientLRUCache:
    """Small LRU cache to reuse Supabase clients per JWT for a short TTL.

    This avoids the overhead of creating a new HTTP client on every request,
    while keeping memory bounded and respecting short-lived tokens.
    """

    def __init__(self, max_size: int = 64, ttl_seconds: int = 60):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self._store: OrderedDict[str, Tuple[float, Client]] = OrderedDict()

    def get(self, key: str) -> Optional[Client]:
        now = time.time()
        try:
            entry = self._store.get(key)
            if not entry:
                return None
            ts, client = entry
            if now - ts > self.ttl_seconds:
                # expired
                try:
                    del self._store[key]
                except Exception:
                    pass
                return None
            # mark as recently used
            try:
                self._store.move_to_end(key)
            except Exception:
                pass
            return client
        except Exception:
            return None

    def set(self, key: str, client: Client) -> None:
        now = time.time()
        try:
            self._store[key] = (now, client)
            self._store.move_to_end(key)
            while len(self._store) > self.max_size:
                try:
                    self._store.popitem(last=False)
                except Exception:
                    break
        except Exception:
            # best-effort cache, ignore failures
            pass


_cache_size = int(os.environ.get("SUPABASE_CLIENT_CACHE_SIZE", "64"))
_cache_ttl = int(os.environ.get("SUPABASE_CLIENT_TTL_SECONDS", "60"))
_client_cache = _ClientLRUCache(max_size=_cache_size, ttl_seconds=_cache_ttl)


def _get_or_create_client(user_jwt: Optional[str]) -> Client:
    key = user_jwt or "__anon__"
    cached = _client_cache.get(key)
    if cached is not None:
        return cached
    mgr = DatabaseManager(user_jwt=user_jwt)
    _client_cache.set(key, mgr.client)
    return mgr.client


def get_supabase_client() -> Client:
    """Return a cached Supabase client bound to the current user's JWT if present."""
    token = _extract_bearer_token_from_request()
    return _get_or_create_client(token)


def get_db_manager() -> DatabaseManager:
    """Return an ephemeral DatabaseManager bound to the current user's JWT if present."""
    token = _extract_bearer_token_from_request()
    # For callers that rely on helper methods, wrap the cached client
    mgr = DatabaseManager(user_jwt=token)
    # Replace the fresh client with cached one to avoid duplicate sessions
    try:
        object.__setattr__(mgr, "_client", _get_or_create_client(token))
    except Exception:
        pass
    return mgr