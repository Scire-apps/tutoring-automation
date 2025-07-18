from typing import ClassVar, List, Dict, Any
from .base import BaseModel

class SessionRecording(BaseModel):
    """Session recording model"""
    
    table_name: ClassVar[str] = "session_recordings"
    fields: ClassVar[List[str]] = [
        'id', 
        'job_id', 
        'file_path', 
        'file_url', 
        'duration_seconds', 
        'volunteer_hours', 
        'status', 
        'created_at', 
        'updated_at'
    ]
    required_fields: ClassVar[List[str]] = ['job_id', 'file_path']
    
    def __init__(self, **kwargs):
        """Initialize session recording with data"""
        super().__init__(**kwargs)
        
        # Set attributes
        self.job_id = kwargs.get('job_id')
        self.file_path = kwargs.get('file_path')
        self.file_url = kwargs.get('file_url')
        self.duration_seconds = kwargs.get('duration_seconds')
        self.volunteer_hours = kwargs.get('volunteer_hours')
        self.status = kwargs.get('status', 'pending')
        
        # Cache for related objects
        self._job = None
    
    def validate(self):
        """Validate session recording data"""
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
    
    def calculate_hours(self) -> float:
        """
        Calculate volunteer hours based on duration
        
        Returns:
            Calculated hours
        """
        if not self.duration_seconds:
            return 0
        
        # Convert seconds to hours (rounded to nearest quarter hour)
        hours = round(self.duration_seconds / 3600 * 4) / 4
        
        # Update hours
        self.volunteer_hours = hours
        self.save()
        
        return hours
    
    def approve(self) -> Dict[str, Any]:
        """
        Approve the recording
        
        Returns:
            Updated recording data
        """
        # Update status
        self.status = 'approved'
        
        # Save changes
        return self.save()
    
    def reject(self) -> Dict[str, Any]:
        """
        Reject the recording
        
        Returns:
            Updated recording data
        """
        # Update status
        self.status = 'rejected'
        
        # Save changes
        return self.save()