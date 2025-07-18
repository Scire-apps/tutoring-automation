import os
from dotenv import load_dotenv
from utils.db import get_db_manager
import supabase

# Load environment variables
load_dotenv()

def test_database_connection():
    """Test the connection to the Supabase database"""
    print("Testing Supabase database connection...")
    
    # Print environment variables (without showing full key)
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY")
    print(f"SUPABASE_URL: {supabase_url}")
    print(f"SUPABASE_KEY: {supabase_key[:10]}...{supabase_key[-5:] if supabase_key else ''}")
    
    try:
        # Create direct Supabase client
        client = supabase.create_client(supabase_url, supabase_key)
        
        # Try to query the subjects table
        response = client.table("subjects").select("*").execute()
        subjects = response.data
        
        print(f"\nConnection successful! Found {len(subjects)} subjects in the database.")
        print("\nSubjects:")
        for subject in subjects:
            print(f"- {subject.get('name')} ({subject.get('category')})")
        
        # Try to query the schools table
        response = client.table("schools").select("*").execute()
        schools = response.data
        
        print(f"\nFound {len(schools)} schools in the database.")
        print("\nSchools:")
        for school in schools:
            print(f"- {school.get('name')} ({school.get('domain')})")
            
        return True
    except Exception as e:
        print(f"Connection failed: {str(e)}")
        return False

if __name__ == "__main__":
    test_database_connection()