import os
from dotenv import load_dotenv
import supabase

# Load environment variables
load_dotenv()

def create_storage_bucket():
    """Create storage bucket for session recordings"""
    print("Creating storage bucket for session recordings...")
    
    # Get Supabase credentials
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY")
    
    if not supabase_url or not supabase_key:
        print("Error: SUPABASE_URL and SUPABASE_KEY environment variables must be set")
        return False
    
    try:
        # Create Supabase client
        client = supabase.create_client(supabase_url, supabase_key)
        
        # Create storage bucket
        try:
            client.storage.create_bucket("session-recordings")
            print("Storage bucket 'session-recordings' created successfully")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("Storage bucket 'session-recordings' already exists")
            else:
                print(f"Error creating storage bucket: {str(e)}")
                return False
        
        return True
    except Exception as e:
        print(f"Error connecting to Supabase: {str(e)}")
        return False

if __name__ == "__main__":
    create_storage_bucket()