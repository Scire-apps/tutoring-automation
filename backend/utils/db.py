import os
import logging
from supabase import create_client, Client
from typing import Dict, List, Any, Optional

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


def get_supabase_client() -> Client:
    """Return a new Supabase client using the anon key, bound to the current user's JWT if present."""
    token = _extract_bearer_token_from_request()
    return DatabaseManager(user_jwt=token).client


def get_db_manager() -> DatabaseManager:
    """Return an ephemeral DatabaseManager bound to the current user's JWT if present."""
    token = _extract_bearer_token_from_request()
    return DatabaseManager(user_jwt=token)