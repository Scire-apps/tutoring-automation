from typing import ClassVar, List
from .base import BaseModel

class School(BaseModel):
    """School model"""
    
    table_name: ClassVar[str] = "schools"
    fields: ClassVar[List[str]] = [
        'id', 
        'name', 
        'domain', 
        'created_at', 
        'updated_at'
    ]
    required_fields: ClassVar[List[str]] = ['name', 'domain']
    
    def __init__(self, **kwargs):
        """Initialize school with data"""
        super().__init__(**kwargs)
        
        # Set attributes
        self.name = kwargs.get('name')
        self.domain = kwargs.get('domain')
    
    def validate(self):
        """Validate school data"""
        # Run base validation
        validation = super().validate()
        
        # Add custom validation
        if hasattr(self, 'domain') and self.domain:
            # Check if domain is valid
            if '.' not in self.domain:
                validation['valid'] = False
                validation['errors'].append("Domain must be a valid domain name")
        
        return validation