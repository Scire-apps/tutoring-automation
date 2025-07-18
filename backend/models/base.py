from typing import Dict, Any, List, Optional, ClassVar, Type
from datetime import datetime
import uuid
from utils.db import get_db_manager

class BaseModel:
    """Base model class for all database models"""
    
    # Class variables to be overridden by subclasses
    table_name: ClassVar[str] = ""
    fields: ClassVar[List[str]] = []
    required_fields: ClassVar[List[str]] = []
    
    def __init__(self, **kwargs):
        """Initialize model with data"""
        self.id = kwargs.get('id', str(uuid.uuid4()))
        self.created_at = kwargs.get('created_at', datetime.now())
        self.updated_at = kwargs.get('updated_at', datetime.now())
        
        # Set attributes from kwargs
        for field in self.fields:
            if field not in ['id', 'created_at', 'updated_at']:
                setattr(self, field, kwargs.get(field))
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert model to dictionary"""
        data = {'id': self.id}
        
        for field in self.fields:
            if field not in ['id'] and hasattr(self, field):
                value = getattr(self, field)
                # Convert datetime to ISO format string
                if isinstance(value, datetime):
                    value = value.isoformat()
                data[field] = value
                
        return data
    
    def validate(self) -> Dict[str, Any]:
        """
        Validate model data
        
        Returns:
            Dict with 'valid' boolean and 'errors' list
        """
        errors = []
        
        # Check required fields
        for field in self.required_fields:
            if not hasattr(self, field) or getattr(self, field) is None:
                errors.append(f"Field '{field}' is required")
        
        return {
            'valid': len(errors) == 0,
            'errors': errors
        }
    
    def save(self) -> Dict[str, Any]:
        """
        Save model to database
        
        Returns:
            Dict with saved data including ID
        """
        # Validate data
        validation = self.validate()
        if not validation['valid']:
            raise ValueError(f"Invalid data: {validation['errors']}")
        
        # Get database manager
        db = get_db_manager()
        
        # Convert model to dictionary
        data = self.to_dict()
        
        # Remove None values
        data = {k: v for k, v in data.items() if v is not None}
        
        # Update or insert
        if hasattr(self, 'id') and self.id:
            # Update existing record
            result = db.update_record(self.table_name, self.id, data)
        else:
            # Insert new record
            result = db.insert_record(self.table_name, data)
            
            # Update model with new ID
            if 'id' in result:
                self.id = result['id']
        
        return result
    
    @classmethod
    def get_by_id(cls, id: str) -> Optional['BaseModel']:
        """
        Get model by ID
        
        Args:
            id: Record ID
            
        Returns:
            Model instance or None if not found
        """
        db = get_db_manager()
        
        try:
            # Query by ID
            response = db.client.table(cls.table_name).select("*").eq("id", id).execute()
            
            if response.data and len(response.data) > 0:
                # Create model instance
                return cls(**response.data[0])
            else:
                return None
        except Exception as e:
            print(f"Error getting {cls.table_name} by ID: {str(e)}")
            return None
    
    @classmethod
    def get_all(cls, filters: Optional[Dict[str, Any]] = None) -> List['BaseModel']:
        """
        Get all records with optional filters
        
        Args:
            filters: Optional filters
            
        Returns:
            List of model instances
        """
        db = get_db_manager()
        
        try:
            # Start query
            query = db.client.table(cls.table_name).select("*")
            
            # Apply filters
            if filters:
                for field, value in filters.items():
                    query = query.eq(field, value)
            
            # Execute query
            response = query.execute()
            
            # Create model instances
            return [cls(**record) for record in response.data]
        except Exception as e:
            print(f"Error getting all {cls.table_name}: {str(e)}")
            return []
    
    @classmethod
    def delete(cls, id: str) -> bool:
        """
        Delete record by ID
        
        Args:
            id: Record ID
            
        Returns:
            True if deleted, False otherwise
        """
        db = get_db_manager()
        
        try:
            # Delete record
            response = db.client.table(cls.table_name).delete().eq("id", id).execute()
            
            return len(response.data) > 0
        except Exception as e:
            print(f"Error deleting {cls.table_name}: {str(e)}")
            return False