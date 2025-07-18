import unittest
import uuid
from models.base import BaseModel
from models.school import School
from models.tutor import Tutor
from models.subject import Subject
from models.subject_approval import SubjectApproval
from models.tutoring_opportunity import TutoringOpportunity
from models.tutoring_job import TutoringJob
from models.session_recording import SessionRecording
from models.communication import Communication
from models.admin import Admin

class TestBaseModel(unittest.TestCase):
    """Test case for the BaseModel class"""
    
    def test_init(self):
        """Test BaseModel initialization"""
        # Create a test subclass
        class TestModel(BaseModel):
            table_name = "test_table"
            fields = ["id", "name", "created_at", "updated_at"]
            required_fields = ["name"]
        
        # Initialize with data
        model = TestModel(name="Test")
        
        # Check attributes
        self.assertIsNotNone(model.id)
        self.assertEqual(model.name, "Test")
        self.assertIsNotNone(model.created_at)
        self.assertIsNotNone(model.updated_at)
    
    def test_to_dict(self):
        """Test conversion to dictionary"""
        # Create a test subclass
        class TestModel(BaseModel):
            table_name = "test_table"
            fields = ["id", "name", "created_at", "updated_at"]
            required_fields = ["name"]
        
        # Initialize with data
        model_id = str(uuid.uuid4())
        model = TestModel(id=model_id, name="Test")
        
        # Convert to dictionary
        data = model.to_dict()
        
        # Check dictionary
        self.assertEqual(data["id"], model_id)
        self.assertEqual(data["name"], "Test")
    
    def test_validate(self):
        """Test validation"""
        # Create a test subclass
        class TestModel(BaseModel):
            table_name = "test_table"
            fields = ["id", "name", "created_at", "updated_at"]
            required_fields = ["name"]
        
        # Initialize with missing required field
        model = TestModel()
        
        # Validate
        validation = model.validate()
        
        # Check validation result
        self.assertFalse(validation["valid"])
        self.assertEqual(len(validation["errors"]), 1)
        
        # Initialize with required field
        model = TestModel(name="Test")
        
        # Validate
        validation = model.validate()
        
        # Check validation result
        self.assertTrue(validation["valid"])
        self.assertEqual(len(validation["errors"]), 0)

class TestSchool(unittest.TestCase):
    """Test case for the School model"""
    
    def test_init(self):
        """Test School initialization"""
        school = School(name="Test School", domain="test.edu")
        
        self.assertEqual(school.name, "Test School")
        self.assertEqual(school.domain, "test.edu")
    
    def test_validate(self):
        """Test School validation"""
        # Valid school
        school = School(name="Test School", domain="test.edu")
        validation = school.validate()
        self.assertTrue(validation["valid"])
        
        # Invalid domain
        school = School(name="Test School", domain="invalid")
        validation = school.validate()
        self.assertFalse(validation["valid"])
        
        # Missing name
        school = School(domain="test.edu")
        validation = school.validate()
        self.assertFalse(validation["valid"])

class TestTutor(unittest.TestCase):
    """Test case for the Tutor model"""
    
    def test_init(self):
        """Test Tutor initialization"""
        tutor = Tutor(
            auth_id=str(uuid.uuid4()),
            email="test@example.com",
            first_name="John",
            last_name="Doe",
            school_id=str(uuid.uuid4()),
            status="active",
            volunteer_hours=10.5
        )
        
        self.assertEqual(tutor.email, "test@example.com")
        self.assertEqual(tutor.first_name, "John")
        self.assertEqual(tutor.last_name, "Doe")
        self.assertEqual(tutor.status, "active")
        self.assertEqual(tutor.volunteer_hours, 10.5)
    
    def test_validate(self):
        """Test Tutor validation"""
        # Valid tutor
        tutor = Tutor(
            auth_id=str(uuid.uuid4()),
            email="test@example.com",
            first_name="John",
            last_name="Doe"
        )
        validation = tutor.validate()
        self.assertTrue(validation["valid"])
        
        # Invalid email
        tutor = Tutor(
            auth_id=str(uuid.uuid4()),
            email="invalid",
            first_name="John",
            last_name="Doe"
        )
        validation = tutor.validate()
        self.assertFalse(validation["valid"])
        
        # Invalid status
        tutor = Tutor(
            auth_id=str(uuid.uuid4()),
            email="test@example.com",
            first_name="John",
            last_name="Doe",
            status="invalid"
        )
        validation = tutor.validate()
        self.assertFalse(validation["valid"])
    
    def test_full_name(self):
        """Test full_name property"""
        tutor = Tutor(
            auth_id=str(uuid.uuid4()),
            email="test@example.com",
            first_name="John",
            last_name="Doe"
        )
        
        self.assertEqual(tutor.full_name, "John Doe")
    
    def test_add_volunteer_hours(self):
        """Test adding volunteer hours"""
        tutor = Tutor(
            auth_id=str(uuid.uuid4()),
            email="test@example.com",
            first_name="John",
            last_name="Doe",
            volunteer_hours=10
        )
        
        # This will fail because we can't actually save to the database in a unit test
        # But we can test the logic
        try:
            tutor.add_volunteer_hours(5)
        except:
            pass
        
        self.assertEqual(tutor.volunteer_hours, 15)
        
        # Test negative hours
        with self.assertRaises(ValueError):
            tutor.add_volunteer_hours(-5)

class TestTutoringOpportunity(unittest.TestCase):
    """Test case for the TutoringOpportunity model"""
    
    def test_init(self):
        """Test TutoringOpportunity initialization"""
        opportunity = TutoringOpportunity(
            tutee_name="Jane Smith",
            tutee_email="jane@example.com",
            subject="Mathematics",
            grade_level="11th Grade",
            school="Test School",
            availability="Weekdays after 4pm",
            location_preference="Online",
            additional_notes="Need help with calculus",
            status="open",
            priority="normal"
        )
        
        self.assertEqual(opportunity.tutee_name, "Jane Smith")
        self.assertEqual(opportunity.tutee_email, "jane@example.com")
        self.assertEqual(opportunity.subject, "Mathematics")
        self.assertEqual(opportunity.status, "open")
        self.assertEqual(opportunity.priority, "normal")
    
    def test_validate(self):
        """Test TutoringOpportunity validation"""
        # Valid opportunity
        opportunity = TutoringOpportunity(
            tutee_name="Jane Smith",
            tutee_email="jane@example.com",
            subject="Mathematics"
        )
        validation = opportunity.validate()
        self.assertTrue(validation["valid"])
        
        # Invalid email
        opportunity = TutoringOpportunity(
            tutee_name="Jane Smith",
            tutee_email="invalid",
            subject="Mathematics"
        )
        validation = opportunity.validate()
        self.assertFalse(validation["valid"])
        
        # Invalid status
        opportunity = TutoringOpportunity(
            tutee_name="Jane Smith",
            tutee_email="jane@example.com",
            subject="Mathematics",
            status="invalid"
        )
        validation = opportunity.validate()
        self.assertFalse(validation["valid"])
        
        # Invalid priority
        opportunity = TutoringOpportunity(
            tutee_name="Jane Smith",
            tutee_email="jane@example.com",
            subject="Mathematics",
            priority="invalid"
        )
        validation = opportunity.validate()
        self.assertFalse(validation["valid"])

if __name__ == "__main__":
    unittest.main()