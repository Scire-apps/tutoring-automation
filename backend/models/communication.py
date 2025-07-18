from typing import ClassVar, List, Dict, Any, Optional
from .base import BaseModel

class Communication(BaseModel):
    """Communication model for emails and notifications"""
    
    table_name: ClassVar[str] = "communications"
    fields: ClassVar[List[str]] = [
        'id', 
        'job_id', 
        'opportunity_id', 
        'type', 
        'recipient', 
        'subject', 
        'content', 
        'status', 
        'created_at', 
        'updated_at'
    ]
    required_fields: ClassVar[List[str]] = ['type', 'recipient']
    
    def __init__(self, **kwargs):
        """Initialize communication with data"""
        super().__init__(**kwargs)
        
        # Set attributes
        self.job_id = kwargs.get('job_id')
        self.opportunity_id = kwargs.get('opportunity_id')
        self.type = kwargs.get('type')
        self.recipient = kwargs.get('recipient')
        self.subject = kwargs.get('subject')
        self.content = kwargs.get('content')
        self.status = kwargs.get('status', 'pending')
    
    def validate(self):
        """Validate communication data"""
        # Run base validation
        validation = super().validate()
        
        # Add custom validation
        if hasattr(self, 'type') and self.type:
            # Check if type is valid
            valid_types = ['email', 'notification']
            if self.type not in valid_types:
                validation['valid'] = False
                validation['errors'].append(f"Type must be one of: {', '.join(valid_types)}")
        
        if hasattr(self, 'status') and self.status:
            # Check if status is valid
            valid_statuses = ['pending', 'sent', 'failed']
            if self.status not in valid_statuses:
                validation['valid'] = False
                validation['errors'].append(f"Status must be one of: {', '.join(valid_statuses)}")
        
        if hasattr(self, 'recipient') and self.recipient:
            # Check if recipient is valid for emails
            if self.type == 'email' and '@' not in self.recipient:
                validation['valid'] = False
                validation['errors'].append("Recipient must be a valid email address for email communications")
        
        return validation
    
    def mark_as_sent(self) -> Dict[str, Any]:
        """
        Mark communication as sent
        
        Returns:
            Updated communication data
        """
        # Update status
        self.status = 'sent'
        
        # Save changes
        return self.save()
    
    def mark_as_failed(self) -> Dict[str, Any]:
        """
        Mark communication as failed
        
        Returns:
            Updated communication data
        """
        # Update status
        self.status = 'failed'
        
        # Save changes
        return self.save()