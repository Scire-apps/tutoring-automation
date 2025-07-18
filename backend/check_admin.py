#!/usr/bin/env python3

import os
from utils.db import get_supabase_client

def check_admin_user():
    """Check if the admin user exists in the database"""
    
    email = "1hashmimoi+superadmin@hdsb.ca"
    
    try:
        supabase = get_supabase_client()
        
        print(f"Checking for admin user: {email}")
        
        # Check if user exists in auth.users (this requires service key)
        print("\n=== Checking auth.users table ===")
        try:
            # This might not work with RLS, but let's try
            auth_result = supabase.auth.admin.list_users()
            print(f"Found {len(auth_result.users)} total users")
            
            target_user = None
            for user in auth_result.users:
                if user.email == email:
                    target_user = user
                    break
            
            if target_user:
                print(f"✓ Found auth user: {target_user.id}")
                print(f"  Email: {target_user.email}")
                print(f"  Email confirmed: {target_user.email_confirmed_at is not None}")
                print(f"  Created: {target_user.created_at}")
                
                # Now check if admin record exists
                print(f"\n=== Checking admins table for auth_id: {target_user.id} ===")
                admin_result = supabase.table('admins').select('*').eq('auth_id', target_user.id).execute()
                
                if admin_result.data:
                    print("✓ Found admin record:")
                    for admin in admin_result.data:
                        print(f"  ID: {admin['id']}")
                        print(f"  Email: {admin['email']}")
                        print(f"  Role: {admin['role']}")
                        print(f"  Name: {admin['first_name']} {admin['last_name']}")
                        print(f"  School ID: {admin['school_id']}")
                else:
                    print("✗ No admin record found!")
                    print("Creating admin record...")
                    
                    # Create admin record
                    admin_data = {
                        'auth_id': target_user.id,
                        'email': email,
                        'first_name': 'Super',
                        'last_name': 'Admin',
                        'role': 'superadmin',
                        'school_id': None
                    }
                    
                    create_result = supabase.table('admins').insert(admin_data).execute()
                    if create_result.data:
                        print("✓ Admin record created successfully!")
                    else:
                        print("✗ Failed to create admin record")
                        print(f"Error: {create_result}")
            else:
                print(f"✗ No auth user found with email: {email}")
                
        except Exception as e:
            print(f"Error checking auth users: {e}")
            print("This might be normal if using anon key instead of service key")
            
        # Try direct admin table query
        print(f"\n=== Direct admin table query for email: {email} ===")
        admin_result = supabase.table('admins').select('*').eq('email', email).execute()
        
        if admin_result.data:
            print("✓ Found admin record by email:")
            for admin in admin_result.data:
                print(f"  ID: {admin['id']}")
                print(f"  Auth ID: {admin['auth_id']}")
                print(f"  Email: {admin['email']}")
                print(f"  Role: {admin['role']}")
                print(f"  Name: {admin['first_name']} {admin['last_name']}")
        else:
            print("✗ No admin record found by email")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_admin_user()