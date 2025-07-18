from typing import ClassVar, List, Dict, Any, Optional
from .base import BaseModel

class TutoringJob(BaseModel):
    """Tutoring job model"""
    
    table_name: ClassVar[str] = "tutoring_jobs"
    fields: ClassVar[List[str]] = [
        'id', 
        'opportunity_id', 
        'tutor_id', 
        'scheduled_date', 
        'scheduled_time', 
        'location', 
        'status', 
        'created_at', 
        'updated_at'
    ]
    required_fields: ClassVar[List[str]] = ['opportunity_id', 'tutor_id']
    
    def __init__(self, **kwargs):
        """Initialize tutoring job with data"""
        super().__init__(**kwargs)
        
        # Set attributes
        self.opportunity_id = kwargs.get('opportunity_id')
        self.tutor_id = kwargs.get('tutor_id')
        self.scheduled_date = kwargs.get('scheduled_date')
        self.scheduled_time = kwargs.get('scheduled_time')
        self.location = kwargs.get('location')
        self.status = kwargs.get('status', 'scheduled')
        
        # Cache for related objects
        self._opportunity = None
        self._tutor = None
    
    def validate(self):
        """Validate tutoring job data"""
        # Run base validation
        validation = super().validate()
        
        # Add custom validation
        if hasattr(self, 'status') and self.status:
            # Check if status is valid
            valid_statuses = ['scheduled', 'completed', 'cancelled']
            if self.status not in valid_statuses:
                validation['valid'] = False
                validation['errors'].append(f"Status must be one of: {', '.join(valid_statuses)}")
        
        return validation
    
    def schedule(self, date: str, time: str, location: str) -> Dict[str, Any]:
        """
        Schedule the tutoring job
        
        Args:
            date: Scheduled date (YYYY-MM-DD)
            time: Scheduled time
            location: Location
            
        Returns:
            Updated job data
        """
        # Update scheduling info
        self.scheduled_date = date
        self.scheduled_time = time
        self.location = location
        
        # Save changes
        return self.save()
    
    def complete(self) -> Dict[str, Any]:
        """
        Mark job as completed
        
        Returns:
            Updated job data
        """
        # Update status
        self.status = 'completed'
        
        # Save changes
        return self.save()
    
    def cancel(self) -> Dict[str, Any]:
        """
        Cancel the job
        
        Returns:
            Updated job data
        """
        # Update status
        self.status = 'cancelled'
        
        # Save changes
        return self.save()