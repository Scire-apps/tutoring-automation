from typing import ClassVar, List
from .base import BaseModel

class Subject(BaseModel):
    """Subject model"""
    
    table_name: ClassVar[str] = "subjects"
    fields: ClassVar[List[str]] = [
        'id', 
        'name', 
        'category', 
        'grade_level', 
        'created_at', 
        'updated_at'
    ]
    required_fields: ClassVar[List[str]] = ['name']
    
    def __init__(self, **kwargs):
        """Initialize subject with data"""
        super().__init__(**kwargs)
        
        # Set attributes
        self.name = kwargs.get('name')
        self.category = kwargs.get('category')
        self.grade_level = kwargs.get('grade_level')
    
    def validate(self):
        """Validate subject data"""
        # Run base validation
        validation = super().validate()
        
        # Add custom validation if needed
        
        return validation