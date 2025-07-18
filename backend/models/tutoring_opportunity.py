from typing import ClassVar, List, Dict, Any, Optional
from .base import BaseModel
from .tutoring_job import TutoringJob

class TutoringOpportunity(BaseModel):
    """Tutoring opportunity model"""
    
    table_name: ClassVar[str] = "tutoring_opportunities"
    fields: ClassVar[List[str]] = [
        'id', 
        'tutee_name', 
        'tutee_email', 
        'subject', 
        'grade_level', 
        'school', 
        'availability', 
        'location_preference', 
        'additional_notes', 
        'status', 
        'priority', 
        'created_at', 
        'updated_at'
    ]
    required_fields: ClassVar[List[str]] = ['tutee_name', 'tutee_email', 'subject']
    
    def __init__(self, **kwargs):
        """Initialize tutoring opportunity with data"""
        super().__init__(**kwargs)
        
        # Set attributes
        self.tutee_name = kwargs.get('tutee_name')
        self.tutee_email = kwargs.get('tutee_email')
        self.subject = kwargs.get('subject')
        self.grade_level = kwargs.get('grade_level')
        self.school = kwargs.get('school')
        self.availability = kwargs.get('availability')
        self.location_preference = kwargs.get('location_preference')
        self.additional_notes = kwargs.get('additional_notes')
        self.status = kwargs.get('status', 'open')
        self.priority = kwargs.get('priority', 'normal')
        
        # Cache for related objects
        self._job = None
    
    def validate(self):
        """Validate tutoring opportunity data"""
        # Run base validation
        validation = super().validate()
        
        # Add custom validation
        if hasattr(self, 'tutee_email') and self.tutee_email:
            # Check if email is valid
            if '@' not in self.tutee_email:
                validation['valid'] = False
                validation['errors'].append("Tutee email must be a valid email address")
        
        if hasattr(self, 'status') and self.status:
            # Check if status is valid
            valid_statuses = ['open', 'assigned', 'completed', 'cancelled']
            if self.status not in valid_statuses:
                validation['valid'] = False
                validation['errors'].append(f"Status must be one of: {', '.join(valid_statuses)}")
        
        if hasattr(self, 'priority') and self.priority:
            # Check if priority is valid
            valid_priorities = ['low', 'normal', 'high']
            if self.priority not in valid_priorities:
                validation['valid'] = False
                validation['errors'].append(f"Priority must be one of: {', '.join(valid_priorities)}")
        
        return validation
    
    def assign_to_tutor(self, tutor_id: str) -> Dict[str, Any]:
        """
        Assign opportunity to a tutor
        
        Args:
            tutor_id: ID of the tutor
            
        Returns:
            Created tutoring job
        """
        if self.status != 'open':
            raise ValueError("Cannot assign a non-open opportunity")
        
        # Update status
        self.status = 'assigned'
        self.save()
        
        # Create tutoring job
        job = TutoringJob(
            opportunity_id=self.id,
            tutor_id=tutor_id,
            status='scheduled'
        )
        job.save()
        
        # Cache job
        self._job = job
        
        return job.to_dict()
    
    def get_job(self) -> Optional[Dict[str, Any]]:
        """
        Get associated tutoring job
        
        Returns:
            Tutoring job data or None if not assigned
        """
        if self.status != 'assigned':
            return None
        
        if self._job is None:
            # Query for job
            jobs = TutoringJob.get_all({'opportunity_id': self.id})
            if jobs:
                self._job = jobs[0]
        
        return self._job.to_dict() if self._job else None
    
    def cancel(self) -> Dict[str, Any]:
        """
        Cancel the opportunity
        
        Returns:
            Updated opportunity data
        """
        # Update status
        self.status = 'cancelled'
        
        # Save changes
        return self.save()
    
    def requeue(self, high_priority: bool = True) -> Dict[str, Any]:
        """
        Requeue the opportunity
        
        Args:
            high_priority: Whether to set high priority
            
        Returns:
            Updated opportunity data
        """
        # Update status and priority
        self.status = 'open'
        if high_priority:
            self.priority = 'high'
        
        # Save changes
        return self.save()