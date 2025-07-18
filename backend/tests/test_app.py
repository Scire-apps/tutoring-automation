import unittest
import json
from app import create_app

class AppTestCase(unittest.TestCase):
    """Test case for the Flask application"""
    
    def setUp(self):
        """Set up test client"""
        self.app = create_app()
        self.client = self.app.test_client()
        
    def test_hello_endpoint(self):
        """Test the root endpoint"""
        response = self.client.get('/')
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(data['message'], 'Tutoring Automation Backend API')
        
    def test_health_endpoint(self):
        """Test the health check endpoint"""
        response = self.client.get('/health')
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(data['status'], 'healthy')
        
    def test_api_status_endpoint(self):
        """Test the API status endpoint"""
        response = self.client.get('/api/status')
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(data['status'], 'operational')
        self.assertEqual(data['version'], '1.0.0')
        
if __name__ == '__main__':
    unittest.main()