import os
from dotenv import load_dotenv
import supabase

# Load environment variables
load_dotenv()

def update_schools():
    """Update schools in the database"""
    print("Updating schools in the database...")
    
    # Get Supabase credentials
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY")
    
    if not supabase_url or not supabase_key:
        print("Error: SUPABASE_URL and SUPABASE_KEY environment variables must be set")
        return False
    
    try:
        # Create Supabase client
        client = supabase.create_client(supabase_url, supabase_key)
        
        # Delete existing schools
        print("Deleting existing schools...")
        # We need to use a condition for DELETE
        client.table("schools").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        
        # Insert White Oaks Secondary School
        print("Inserting White Oaks Secondary School...")
        response = client.table("schools").insert({
            "name": "White Oaks Secondary School",
            "domain": "hdsb.ca"
        }).execute()
        
        if response.data:
            print("Successfully inserted White Oaks Secondary School")
        else:
            print("Failed to insert school")
        
        # Check schools table
        print("\nChecking schools table...")
        response = client.table("schools").select("*").execute()
        schools = response.data
        
        print(f"Found {len(schools)} schools:")
        for school in schools:
            print(f"- {school.get('name')} ({school.get('domain')})")
        
        return True
    except Exception as e:
        print(f"Error updating schools: {str(e)}")
        return False

if __name__ == "__main__":
    update_schools()