from typing import ClassVar, List, Dict, Any, Optional
from .base import BaseModel
from .school import School
from .subject_approval import SubjectApproval

class Tutor(BaseModel):
    """Tutor model"""
    
    table_name: ClassVar[str] = "tutors"
    fields: ClassVar[List[str]] = [
        'id', 
        'auth_id', 
        'email', 
        'first_name', 
        'last_name', 
        'school_id', 
        'status', 
        'volunteer_hours', 
        'created_at', 
        'updated_at'
    ]
    required_fields: ClassVar[List[str]] = ['auth_id', 'email', 'first_name', 'last_name']
    
    def __init__(self, **kwargs):
        """Initialize tutor with data"""
        super().__init__(**kwargs)
        
        # Set attributes
        self.auth_id = kwargs.get('auth_id')
        self.email = kwargs.get('email')
        self.first_name = kwargs.get('first_name')
        self.last_name = kwargs.get('last_name')
        self.school_id = kwargs.get('school_id')
        self.status = kwargs.get('status', 'pending')
        self.volunteer_hours = kwargs.get('volunteer_hours', 0)
        
        # Cache for related objects
        self._school = None
        self._subject_approvals = None
    
    def validate(self):
        """Validate tutor data"""
        # Run base validation
        validation = super().validate()
        
        # Add custom validation
        if hasattr(self, 'email') and self.email:
            # Check if email is valid
            if '@' not in self.email:
                validation['valid'] = False
                validation['errors'].append("Email must be a valid email address")
        
        if hasattr(self, 'status') and self.status:
            # Check if status is valid
            valid_statuses = ['pending', 'active', 'suspended']
            if self.status not in valid_statuses:
                validation['valid'] = False
                validation['errors'].append(f"Status must be one of: {', '.join(valid_statuses)}")
        
        return validation
    
    @property
    def full_name(self) -> str:
        """Get tutor's full name"""
        return f"{self.first_name} {self.last_name}"
    
    def get_school(self) -> Optional[School]:
        """Get tutor's school"""
        if self._school is None and self.school_id:
            self._school = School.get_by_id(self.school_id)
        return self._school
    
    def get_subject_approvals(self) -> List[SubjectApproval]:
        """Get tutor's subject approvals"""
        if self._subject_approvals is None:
            self._subject_approvals = SubjectApproval.get_all({'tutor_id': self.id})
        return self._subject_approvals
    
    def is_approved_for_subject(self, subject_id: str) -> bool:
        """Check if tutor is approved for a subject"""
        approvals = self.get_subject_approvals()
        for approval in approvals:
            if approval.subject_id == subject_id and approval.status == 'approved':
                return True
        return False
    
    def add_volunteer_hours(self, hours: float) -> Dict[str, Any]:
        """
        Add volunteer hours to tutor's account
        
        Args:
            hours: Number of hours to add
            
        Returns:
            Updated tutor data
        """
        if hours <= 0:
            raise ValueError("Hours must be positive")
        
        # Update hours
        self.volunteer_hours = float(self.volunteer_hours) + hours
        
        # Save changes
        return self.save()