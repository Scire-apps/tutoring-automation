from typing import ClassVar, List, Optional
from datetime import datetime
from .base import BaseModel

class SubjectApproval(BaseModel):
    """Subject approval model"""
    
    table_name: ClassVar[str] = "subject_approvals"
    fields: ClassVar[List[str]] = [
        'id', 
        'tutor_id', 
        'subject_id', 
        'status', 
        'approved_by', 
        'approved_at', 
        'created_at', 
        'updated_at'
    ]
    required_fields: ClassVar[List[str]] = ['tutor_id', 'subject_id']
    
    def __init__(self, **kwargs):
        """Initialize subject approval with data"""
        super().__init__(**kwargs)
        
        # Set attributes
        self.tutor_id = kwargs.get('tutor_id')
        self.subject_id = kwargs.get('subject_id')
        self.status = kwargs.get('status', 'pending')
        self.approved_by = kwargs.get('approved_by')
        self.approved_at = kwargs.get('approved_at')
    
    def validate(self):
        """Validate subject approval data"""
        # Run base validation
        validation = super().validate()
        
        # Add custom validation
        if hasattr(self, 'status') and self.status:
            # Check if status is valid
            valid_statuses = ['pending', 'approved', 'rejected']
            if self.status not in valid_statuses:
                validation['valid'] = False
                validation['errors'].append(f"Status must be one of: {', '.join(valid_statuses)}")
        
        return validation
    
    def approve(self, admin_id: str) -> None:
        """
        Approve the subject approval
        
        Args:
            admin_id: ID of the admin approving
        """
        self.status = 'approved'
        self.approved_by = admin_id
        self.approved_at = datetime.now()
        self.save()
    
    def reject(self, admin_id: str) -> None:
        """
        Reject the subject approval
        
        Args:
            admin_id: ID of the admin rejecting
        """
        self.status = 'rejected'
        self.approved_by = admin_id
        self.approved_at = datetime.now()
        self.save()