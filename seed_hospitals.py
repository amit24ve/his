"""
Seed script: Creates 3 dummy hospitals + Chief Doctor role + one login per hospital.
Run from project root: python seed_hospitals.py
"""
import os, sys, jwt, random
from datetime import datetime
from pymongo import MongoClient
from bson import ObjectId

# ── Config ──────────────────────────────────────────────────────────────────
MONGO_URI   = "mongodb+srv://neelbert_test:Neelbert%40123.@cluster0.ijzzjo3.mongodb.net/?appName=Cluster0"
DB_NAME     = "hospital"
SECRET_KEY  = os.getenv("SECRET_KEY", "your_secret_key")
ALGORITHM   = "HS256"

# ── Hospitals to seed ───────────────────────────────────────────────────────
HOSPITALS = [
    {
        "hospital_id":   "HOSP-001",          # used for multi-tenancy user assignment
        "name":          "Apollo Multispeciality Hospital",
        "code":          "HOSP-001",           # display code (matches hospital_id)
        "city":          "Mumbai",
        "state":         "Maharashtra",
        "address":       "Andheri West, Mumbai – 400053",
        "pincode":       "400053",
        "phone":         "+91-22-6767-0000",
        "email":         "info@apollo-mumbai.his",
        "hospital_type": "Multi-Specialty",
        "ownership":     "Private",
        "total_beds":    350,
        "total_rooms":   120,
        "accreditation": "NABH",
        "contact_person": "Dr. Rajesh Sharma",
        "contact_designation": "CMO",
        "established_year": 1998,
        "specialties":   ["Cardiology", "Orthopaedics", "Neurology", "Oncology"],
    },
    {
        "hospital_id":   "HOSP-002",
        "name":          "Medanta Heart Institute",
        "code":          "HOSP-002",
        "city":          "Gurugram",
        "state":         "Haryana",
        "address":       "Sector 38, Gurugram – 122001",
        "pincode":       "122001",
        "phone":         "+91-124-4141-414",
        "email":         "info@medanta-delhi.his",
        "hospital_type": "Super-Specialty",
        "ownership":     "Private",
        "total_beds":    500,
        "total_rooms":   180,
        "accreditation": "JCI",
        "contact_person": "Dr. Priya Verma",
        "contact_designation": "CMO",
        "established_year": 2009,
        "specialties":   ["Cardiology", "Cardiac Surgery", "Transplant", "Oncology"],
    },
    {
        "hospital_id":   "HOSP-003",
        "name":          "Fortis Super Specialty Hospital",
        "code":          "HOSP-003",
        "city":          "Bangalore",
        "state":         "Karnataka",
        "address":       "Bannerghatta Road, Bangalore – 560076",
        "pincode":       "560076",
        "phone":         "+91-80-6621-4444",
        "email":         "info@fortis-blr.his",
        "hospital_type": "Super-Specialty",
        "ownership":     "Corporate",
        "total_beds":    280,
        "total_rooms":   95,
        "accreditation": "NABH",
        "contact_person": "Dr. Suresh Nair",
        "contact_designation": "CMO",
        "established_year": 2006,
        "specialties":   ["Orthopaedics", "Spine Surgery", "Neurology", "Urology"],
    },
]

# ── Chief Doctor users to seed ───────────────────────────────────────────────
CHIEF_DOCTORS = [
    {
        "hospital_id":   "HOSP-001",
        "username":      "dr.sharma_apollo",
        "password":      "Apollo@2026",
        "full_name":     "Dr. Rajesh Sharma",
        "email":         "dr.sharma@apollo-mumbai.his",
        "phone":         "+91-9800011001",
        "department":    "General Medicine",
        "designation":   "Chief Medical Officer",
    },
    {
        "hospital_id":   "HOSP-002",
        "username":      "dr.verma_medanta",
        "password":      "Medanta@2026",
        "full_name":     "Dr. Priya Verma",
        "email":         "dr.verma@medanta-delhi.his",
        "phone":         "+91-9800022002",
        "department":    "Cardiology",
        "designation":   "Chief Medical Officer",
    },
    {
        "hospital_id":   "HOSP-003",
        "username":      "dr.nair_fortis",
        "password":      "Fortis@2026",
        "full_name":     "Dr. Suresh Nair",
        "email":         "dr.nair@fortis-blr.his",
        "phone":         "+91-9800033003",
        "department":    "Orthopedics",
        "designation":   "Chief Medical Officer",
    },
]

# ── Password hash (same method as auth_service.py) ───────────────────────────
def hash_password(plain: str) -> str:
    return jwt.encode({"password": plain}, SECRET_KEY, algorithm=ALGORITHM)

# ── Unique user_id generator ─────────────────────────────────────────────────
def gen_user_id(users_col) -> str:
    while True:
        uid = f"USR-{random.randint(100, 999)}"
        if not users_col.find_one({"user_id": uid}):
            return uid

# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    print("Connecting to MongoDB...")
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=10000)
    db     = client[DB_NAME]

    hospitals_col = db["hospitals"]
    users_col     = db["users"]
    roles_col     = db["roles"]

    now = datetime.utcnow()

    # ── 1. Upsert hospitals ──────────────────────────────────────────────────
    print("\n── Creating / updating hospitals ──")
    for h in HOSPITALS:
        result = hospitals_col.update_one(
            {"hospital_id": h["hospital_id"]},
            {"$set": {**h, "is_active": True, "updated_at": now},
             "$setOnInsert": {"created_at": now}},
            upsert=True,
        )
        action = "created" if result.upserted_id else "updated"
        print(f"  [{action}] {h['name']} ({h['hospital_id']})")

    # ── 2. Ensure "chief_doctor" role exists ─────────────────────────────────
    print("\n── Ensuring 'chief_doctor' role ──")
    chief_role = roles_col.find_one({"name": "chief_doctor"})
    if not chief_role:
        res = roles_col.insert_one({
            "name":        "chief_doctor",
            "display_name":"Chief Doctor (CMO)",
            "description": "Chief Medical Officer – highest authority in the hospital",
            "permissions":  ["read", "write", "manage_patients", "manage_staff",
                             "view_reports", "manage_billing", "manage_opd",
                             "manage_ipd", "manage_pharmacy", "manage_lab"],
            "is_active":   True,
            "created_at":  now,
            "updated_at":  now,
        })
        chief_role = roles_col.find_one({"_id": res.inserted_id})
        print(f"  [created] chief_doctor role  (id: {chief_role['_id']})")
    else:
        print(f"  [exists]  chief_doctor role  (id: {chief_role['_id']})")

    role_id = str(chief_role["_id"])

    # ── 3. Upsert chief doctor users ─────────────────────────────────────────
    print("\n── Creating / updating chief doctor users ──")
    print(f"\n{'─'*60}")
    print(f"{'Hospital':<32} {'Username':<24} {'Password'}")
    print(f"{'─'*60}")

    for doc in CHIEF_DOCTORS:
        hashed = hash_password(doc["password"])
        hospital_name = next((h["name"] for h in HOSPITALS if h["hospital_id"] == doc["hospital_id"]), doc["hospital_id"])

        existing = users_col.find_one({"username": doc["username"]})
        if existing:
            # Update hospital assignment and role
            users_col.update_one(
                {"username": doc["username"]},
                {"$set": {
                    "hospital_id":   doc["hospital_id"],
                    "hospital_name": hospital_name,
                    "role_ids":      [role_id],
                    "roles":         ["chief_doctor"],
                    "updated_at":    now,
                }}
            )
            action = "updated"
        else:
            uid = gen_user_id(users_col)
            users_col.insert_one({
                "user_id":       uid,
                "username":      doc["username"],
                "email":         doc["email"],
                "password":      hashed,
                "full_name":     doc["full_name"],
                "phone":         doc["phone"],
                "department":    doc["department"],
                "designation":   doc["designation"],
                "hospital_id":   doc["hospital_id"],
                "hospital_name": hospital_name,
                "role_ids":      [role_id],
                "roles":         ["chief_doctor"],
                "is_active":     True,
                "created_at":    now,
                "updated_at":    now,
            })
            action = "created"

        print(f"  [{action}] {hospital_name:<30} {doc['username']:<24} {doc['password']}")

    print(f"{'─'*60}")

    # ── 4. Summary ───────────────────────────────────────────────────────────
    print("\n✅  Seed complete!\n")
    print("LOGIN CREDENTIALS")
    print("="*60)
    for doc in CHIEF_DOCTORS:
        hospital = next(h for h in HOSPITALS if h["hospital_id"] == doc["hospital_id"])
        print(f"  Hospital  : {hospital['name']}")
        print(f"  City      : {hospital['city']}")
        print(f"  Username  : {doc['username']}")
        print(f"  Password  : {doc['password']}")
        print(f"  Role      : Chief Doctor (CMO)")
        print()

    client.close()

if __name__ == "__main__":
    main()
