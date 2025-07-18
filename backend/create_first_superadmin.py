import os
from dotenv import load_dotenv
import supabase

# Load environment variables
load_dotenv()

def create_first_superadmin():
    """Create the first superadmin account using regular signup"""
    print("Creating first superadmin account...")
    
    # Get Supabase credentials
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY")
    
    if not supabase_url or not supabase_key:
        print("Error: SUPABASE_URL and SUPABASE_KEY environment variables must be set")
        return False
    
    try:
        # Create Supabase client
        client = supabase.create_client(supabase_url, supabase_key)
        
        # Superadmin details (you can modify these)
        email = "1hashmimoi+superadmin@hdsb.ca"
        password = "SuperAdmin123!"
        first_name = "Moiz"
        last_name = "Hashmi"
        
        print(f"Creating superadmin account for {email}...")
        
        # Create user using regular signup
        auth_response = client.auth.sign_up({
            "email": email,
            "password": password,
            "options": {
                "data": {
                    "first_name": first_name,
                    "last_name": last_name,
                    "role": "superadmin"
                }
            }
        })
        
        if auth_response.user:
            print(f"✅ Auth user created with ID: {auth_response.user.id}")
            
            # Create admin record in database
            admin_data = {
                "auth_id": auth_response.user.id,
                "email": email,
                "first_name": first_name,
                "last_name": last_name,
                "school_id": None,  # Superadmins don't belong to a specific school
                "role": "superadmin"
            }
            
            admin_response = client.table("admins").insert(admin_data).execute()
            
            if admin_response.data:
                print(f"✅ Admin record created with ID: {admin_response.data[0]['id']}")
                print(f"\n🎉 Superadmin account created successfully!")
                print(f"Email: {email}")
                print(f"Password: {password}")
                print(f"Role: superadmin")
                print(f"\n⚠️  IMPORTANT: You may need to verify the email address in Supabase Auth")
                print(f"Go to Supabase Dashboard > Authentication > Users and confirm the email")
                print(f"\nYou can now log in at: http://localhost:3000/auth/login")
                print(f"After logging in, access the admin dashboard at: http://localhost:3000/admin/dashboard")
                print(f"Manage invitations at: http://localhost:3000/admin/invitations")
                return True
            else:
                print("❌ Failed to create admin record")
                return False
        else:
            print("❌ Failed to create auth user")
            if auth_response.session:
                print("But session was created, user might already exist")
            return False
            
    except Exception as e:
        print(f"❌ Error creating superadmin: {str(e)}")
        return False

if __name__ == "__main__":
    create_first_superadmin()