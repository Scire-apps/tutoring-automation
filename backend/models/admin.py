from typing import ClassVar, List, Optional
from .base import BaseModel
from .school import School

class Admin(BaseModel):
    """Admin model"""
    
    table_name: ClassVar[str] = "admins"
    fields: ClassVar[List[str]] = [
        'id', 
        'auth_id', 
        'email', 
        'first_name', 
        'last_name', 
        'school_id', 
        'role', 
        'created_at', 
        'updated_at'
    ]
    required_fields: ClassVar[List[str]] = ['auth_id', 'email', 'first_name', 'last_name']
    
    def __init__(self, **kwargs):
        """Initialize admin with data"""
        super().__init__(**kwargs)
        
        # Set attributes
        self.auth_id = kwargs.get('auth_id')
        self.email = kwargs.get('email')
        self.first_name = kwargs.get('first_name')
        self.last_name = kwargs.get('last_name')
        self.school_id = kwargs.get('school_id')
        self.role = kwargs.get('role', 'admin')
        
        # Cache for related objects
        self._school = None
    
    def validate(self):
        """Validate admin data"""
        # Run base validation
        validation = super().validate()
        
        # Add custom validation
        if hasattr(self, 'email') and self.email:
            # Check if email is valid
            if '@' not in self.email:
                validation['valid'] = False
                validation['errors'].append("Email must be a valid email address")
        
        if hasattr(self, 'role') and self.role:
            # Check if role is valid
            valid_roles = ['admin', 'superadmin']
            if self.role not in valid_roles:
                validation['valid'] = False
                validation['errors'].append(f"Role must be one of: {', '.join(valid_roles)}")
        
        return validation
    
    @property
    def full_name(self) -> str:
        """Get admin's full name"""
        return f"{self.first_name} {self.last_name}"
    
    def get_school(self) -> Optional[School]:
        """Get admin's school"""
        if self._school is None and self.school_id:
            self._school = School.get_by_id(self.school_id)
        return self._school
    
    def is_superadmin(self) -> bool:
        """Check if admin is a superadmin"""
        return self.role == 'superadmin'