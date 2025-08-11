import os
from dotenv import load_dotenv
import supabase

# Load environment variables
load_dotenv()

def check_superadmin():
    """Check if the admin account exists and is properly configured (legacy name)"""
    print("Checking admin account...")
    
    # Get Supabase credentials
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY")
    
    if not supabase_url or not supabase_key:
        print("Error: SUPABASE_URL and SUPABASE_KEY environment variables must be set")
        return False
    
    try:
        # Create Supabase client
        client = supabase.create_client(supabase_url, supabase_key)
        
        email = "1hashmimoi+admin@hdsb.ca"
        
        print(f"Checking for admin: {email}")
        
        # Check if admin record exists
        admin_response = client.table("admins").select("*").eq("email", email).execute()
        
        if admin_response.data:
            admin = admin_response.data[0]
            print(f"✅ Admin record found:")
            print(f"   ID: {admin['id']}")
            print(f"   Email: {admin['email']}")
            print(f"   Name: {admin['first_name']} {admin['last_name']}")
            print(f"   Role: {admin['role']}")
            print(f"   Auth ID: {admin['auth_id']}")
            
            # Check if corresponding auth user exists
            try:
                # We can't directly query auth users with the anon key
                # But we can try to sign in to verify the account exists
                auth_response = client.auth.sign_in_with_password({
                    "email": email,
                    "password": "SuperAdmin123!"
                })
                
                if auth_response.user:
                    print(f"✅ Auth user exists and login works:")
                    print(f"   User ID: {auth_response.user.id}")
                    print(f"   Email Confirmed: {auth_response.user.email_confirmed_at is not None}")
                    
                    # Sign out after test
                    client.auth.sign_out()
                    
                    return True
                else:
                    print("❌ Auth user login failed")
                    return False
                    
            except Exception as auth_error:
                print(f"❌ Auth user login error: {str(auth_error)}")
                return False
                
        else:
            print("❌ Admin record not found")
            return False
            
    except Exception as e:
        print(f"❌ Error checking superadmin: {str(e)}")
        return False

if __name__ == "__main__":
    check_superadmin()