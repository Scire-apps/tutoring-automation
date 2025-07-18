import os
from dotenv import load_dotenv
import supabase
import sys

# Load environment variables
load_dotenv()

def fix_rls_policies():
    """Apply RLS policy fixes to the database"""
    print("Fixing RLS policies...")
    
    # Get Supabase credentials
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY")
    
    if not supabase_url or not supabase_key:
        print("Error: SUPABASE_URL and SUPABASE_KEY environment variables must be set")
        return False
    
    try:
        # Create Supabase client
        client = supabase.create_client(supabase_url, supabase_key)
        
        # Read SQL file
        with open('fix_rls_policies.sql', 'r') as file:
            sql = file.read()
        
        # Split SQL into statements
        statements = sql.split(';')
        
        # Execute each statement
        for statement in statements:
            if statement.strip():
                print(f"Executing: {statement.strip()[:50]}...")
                try:
                    # Execute SQL statement
                    result = client.postgrest.rpc('exec_sql', {'query': statement}).execute()
                    print("✅ Success")
                except Exception as e:
                    print(f"❌ Error: {str(e)}")
        
        print("\n🎉 RLS policies have been updated!")
        return True
            
    except Exception as e:
        print(f"❌ Error fixing RLS policies: {str(e)}")
        return False

if __name__ == "__main__":
    fix_rls_policies()