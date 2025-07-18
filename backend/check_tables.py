import os
from dotenv import load_dotenv
import supabase

# Load environment variables
load_dotenv()

def check_tables():
    """Check if tables exist in the database and have data"""
    print("Checking database tables...")
    
    # Get Supabase credentials
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY")
    
    if not supabase_url or not supabase_key:
        print("Error: SUPABASE_URL and SUPABASE_KEY environment variables must be set")
        return False
    
    try:
        # Create Supabase client
        client = supabase.create_client(supabase_url, supabase_key)
        
        # Check schools table
        print("\nChecking schools table...")
        response = client.table("schools").select("*").execute()
        schools = response.data
        
        print(f"Found {len(schools)} schools:")
        for school in schools:
            print(f"- {school.get('name')} ({school.get('domain')})")
        
        # If no schools found, insert White Oaks Secondary School
        if len(schools) == 0:
            print("\nNo schools found. Inserting White Oaks Secondary School...")
            response = client.table("schools").insert({
                "name": "White Oaks Secondary School",
                "domain": "hdsb.ca"
            }).execute()
            
            if response.data:
                print("Successfully inserted White Oaks Secondary School")
            else:
                print("Failed to insert school")
        
        # Check subjects table
        print("\nChecking subjects table...")
        response = client.table("subjects").select("*").execute()
        subjects = response.data
        
        print(f"Found {len(subjects)} subjects:")
        for subject in subjects:
            print(f"- {subject.get('name')} ({subject.get('category')})")
        
        # If no subjects found, insert some default subjects
        if len(subjects) == 0:
            print("\nNo subjects found. Inserting default subjects...")
            default_subjects = [
                {"name": "Calculus", "category": "Mathematics", "grade_level": "High School"},
                {"name": "Advanced Functions", "category": "Mathematics", "grade_level": "High School"},
                {"name": "Biology", "category": "Science", "grade_level": "High School"},
                {"name": "Chemistry", "category": "Science", "grade_level": "High School"},
                {"name": "Physics", "category": "Science", "grade_level": "High School"},
                {"name": "English", "category": "Language Arts", "grade_level": "High School"},
                {"name": "Computer Science", "category": "Technology", "grade_level": "High School"},
                {"name": "French", "category": "Foreign Language", "grade_level": "High School"}
            ]
            
            response = client.table("subjects").insert(default_subjects).execute()
            
            if response.data:
                print(f"Successfully inserted {len(response.data)} subjects")
            else:
                print("Failed to insert subjects")
        
        return True
    except Exception as e:
        print(f"Error checking tables: {str(e)}")
        return False

if __name__ == "__main__":
    check_tables()