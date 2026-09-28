"""
Script to fix users_collection usages in user_hierarchy_service.py
"""

import re

def fix_users_collection():
    # Read the file
    with open('user_hierarchy_service.py', 'r') as f:
        content = f.read()
    
    # Replace all occurrences of users_collection.find_one with users_collection().find_one
    fixed_content = re.sub(r'users_collection\.find_one', r'users_collection().find_one', content)
    
    # Write the fixed content back
    with open('user_hierarchy_service.py', 'w') as f:
        f.write(fixed_content)

if __name__ == "__main__":
    fix_users_collection()
    print("Fixed users_collection usages in user_hierarchy_service.py")
