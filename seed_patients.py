"""
Seed dummy patient data: 5 families (3 members each), OPD visits, prescriptions, lab orders.
Run: python seed_patients.py
"""
import asyncio
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import random

MONGO_URI = "mongodb+srv://neelbert_test:Neelbert%40123.@cluster0.ijzzjo3.mongodb.net/?appName=Cluster0"
DB_NAME = "hospital"

FAMILIES = [
    {
        "mobile": "9876543210",
        "members": [
            {"full_name": "Rajesh Kumar Sharma", "age": 45, "gender": "Male",   "blood_group": "B+", "dob": "1980-03-15"},
            {"full_name": "Sunita Sharma",        "age": 42, "gender": "Female", "blood_group": "O+", "dob": "1983-07-22"},
            {"full_name": "Aryan Sharma",         "age": 17, "gender": "Male",   "blood_group": "B+", "dob": "2007-11-10"},
        ],
    },
    {
        "mobile": "9876543211",
        "members": [
            {"full_name": "Mohammad Irfan",       "age": 38, "gender": "Male",   "blood_group": "A+", "dob": "1987-05-01"},
            {"full_name": "Fatima Irfan",         "age": 35, "gender": "Female", "blood_group": "A-", "dob": "1990-09-14"},
            {"full_name": "Zara Irfan",           "age": 8,  "gender": "Female", "blood_group": "A+", "dob": "2016-02-28"},
        ],
    },
    {
        "mobile": "9876543212",
        "members": [
            {"full_name": "Priya Nair",           "age": 32, "gender": "Female", "blood_group": "O-", "dob": "1992-12-05"},
            {"full_name": "Rajan Nair",           "age": 34, "gender": "Male",   "blood_group": "AB+","dob": "1990-08-18"},
            {"full_name": "Kavya Nair",           "age": 5,  "gender": "Female", "blood_group": "O+", "dob": "2019-06-20"},
        ],
    },
    {
        "mobile": "9876543213",
        "members": [
            {"full_name": "Suresh Patel",         "age": 55, "gender": "Male",   "blood_group": "B-", "dob": "1970-01-25"},
            {"full_name": "Meena Patel",          "age": 50, "gender": "Female", "blood_group": "B+", "dob": "1975-04-30"},
            {"full_name": "Rohan Patel",          "age": 25, "gender": "Male",   "blood_group": "B-", "dob": "1999-10-12"},
        ],
    },
    {
        "mobile": "9876543214",
        "members": [
            {"full_name": "Ananya Singh",         "age": 28, "gender": "Female", "blood_group": "A+", "dob": "1997-07-07"},
            {"full_name": "Vikram Singh",         "age": 30, "gender": "Male",   "blood_group": "O+", "dob": "1995-03-03"},
            {"full_name": "Riya Singh",           "age": 2,  "gender": "Female", "blood_group": "A+", "dob": "2022-11-11"},
        ],
    },
]

DEPARTMENTS = ["General Medicine", "Cardiology", "Paediatrics", "Orthopaedics", "Gynaecology", "ENT", "Dermatology", "Neurology"]
DOCTORS     = ["Dr. Anil Mehta", "Dr. Priya Sharma", "Dr. Ramesh Gupta", "Dr. Sana Khan", "Dr. Thomas Jose", "Dr. Nisha Verma"]
LAB_TESTS   = [
    [{"test_name": "CBC", "test_code": "CBC001"}],
    [{"test_name": "Blood Sugar Fasting", "test_code": "BS001"}, {"test_name": "HbA1c", "test_code": "HB001"}],
    [{"test_name": "Lipid Profile", "test_code": "LP001"}],
    [{"test_name": "Thyroid Profile (T3/T4/TSH)", "test_code": "TH001"}],
    [{"test_name": "Urine Routine", "test_code": "UR001"}, {"test_name": "Creatinine", "test_code": "CR001"}],
    [{"test_name": "LFT (Liver Function Test)", "test_code": "LFT001"}],
]
COMPLAINTS  = ["Fever and body ache", "Headache and nausea", "Chest pain", "Knee pain", "Stomach ache", "Cough and cold", "Back pain", "Dizziness"]
DIAGNOSES   = ["Viral fever", "Hypertension", "Type 2 Diabetes", "Osteoarthritis", "Gastroenteritis", "Bronchitis", "Lumbar spondylosis", "Migraine"]
MEDICATIONS = [
    [{"name": "Paracetamol 500mg", "dosage": "1-0-1", "days": 5}],
    [{"name": "Amlodipine 5mg", "dosage": "1-0-0", "days": 30}, {"name": "Telmisartan 40mg", "dosage": "0-0-1", "days": 30}],
    [{"name": "Metformin 500mg", "dosage": "1-1-1", "days": 30}],
    [{"name": "Ibuprofen 400mg", "dosage": "1-1-1", "days": 7}, {"name": "Pantoprazole 40mg", "dosage": "1-0-0", "days": 7}],
]
WARDS = ["General Ward", "Private Room", "ICU", "Surgical Ward", "Maternity Ward"]

mrn_counter = [2026000001]

def next_mrn():
    m = f"MRN-{mrn_counter[0]}"
    mrn_counter[0] += 1
    return m

def days_ago(n):
    return datetime.utcnow() - timedelta(days=n)

async def seed():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]

    # Get a hospital_id
    hospital = await db.hospitals.find_one({})
    hospital_id = str(hospital["_id"]) if hospital else "default_hospital"

    print(f"Using hospital_id: {hospital_id}")

    total_patients = 0
    total_visits = 0
    total_prescriptions = 0
    total_lab_orders = 0
    total_admissions = 0

    for fam_idx, family in enumerate(FAMILIES):
        mobile = family["mobile"]
        print(f"\nFamily {fam_idx+1} — Mobile: {mobile}")

        for mem_idx, member in enumerate(family["members"]):
            mrn = next_mrn()
            pid = ObjectId()

            patient_doc = {
                "_id": pid,
                "full_name": member["full_name"],
                "name": member["full_name"],
                "mrn": mrn,
                "age": member["age"],
                "gender": member["gender"],
                "date_of_birth": member["dob"],
                "blood_group": member["blood_group"],
                "mobile": mobile,
                "phone": mobile,
                "email": f"{member['full_name'].lower().replace(' ', '.')[:15]}@example.com",
                "address": f"{random.randint(1,200)}, Sector {random.randint(1,30)}, Noida",
                "city": random.choice(["Noida", "Delhi", "Gurgaon", "Faridabad", "Ghaziabad"]),
                "patient_category": random.choice(["GENERAL", "GENERAL", "GENERAL", "INSURANCE", "GOVT"]),
                "emergency_contact_name": f"Emergency Contact {fam_idx+1}",
                "emergency_contact_mobile": f"987654{3220+fam_idx:04d}",
                "hospital_id": hospital_id,
                "visit_count": 0,
                "created_at": days_ago(random.randint(60, 365)).isoformat(),
            }

            # Add insurance for some patients
            if patient_doc["patient_category"] == "INSURANCE":
                patient_doc["insurance_provider"] = random.choice(["Star Health", "HDFC ERGO", "Niva Bupa", "Care Health"])
                patient_doc["insurance_policy_number"] = f"POL{random.randint(100000,999999)}"

            await db.patients.replace_one({"mrn": mrn}, patient_doc, upsert=True)
            total_patients += 1

            patient_id = str(pid)

            # OPD visits (3-5 per patient)
            num_visits = random.randint(3, 5)
            for v in range(num_visits):
                dept  = random.choice(DEPARTMENTS)
                doc   = random.choice(DOCTORS)
                visit_date = days_ago(random.randint(v*30, v*30+29))
                visit_doc = {
                    "_id": ObjectId(),
                    "patient_id": patient_id,
                    "patient_name": member["full_name"],
                    "mrn": mrn,
                    "mobile": mobile,
                    "hospital_id": hospital_id,
                    "department": dept,
                    "doctor_name": doc,
                    "visit_type": random.choice(["Consultation", "Follow-up", "Emergency"]),
                    "chief_complaint": random.choice(COMPLAINTS),
                    "visit_date": visit_date.isoformat(),
                    "status": random.choice(["Completed", "Completed", "Completed", "Waiting", "Cancelled"]),
                    "token_number": f"T{fam_idx*100+mem_idx*10+v+1:04d}",
                    "created_at": visit_date.isoformat(),
                }
                await db.patient_visits.replace_one(
                    {"patient_id": patient_id, "token_number": visit_doc["token_number"]},
                    visit_doc, upsert=True
                )
                total_visits += 1

                # Prescription for completed visits
                if visit_doc["status"] == "Completed":
                    rx_doc = {
                        "_id": ObjectId(),
                        "patient_id": patient_id,
                        "patient_name": member["full_name"],
                        "mrn": mrn,
                        "hospital_id": hospital_id,
                        "rx_number": f"RX-{fam_idx*1000+mem_idx*100+v+1:06d}",
                        "doctor_name": doc.replace("Dr. ", ""),
                        "department": dept,
                        "diagnosis": random.choice(DIAGNOSES),
                        "medications": random.choice(MEDICATIONS),
                        "visit_date": visit_date.isoformat(),
                        "created_at": visit_date.isoformat(),
                    }
                    await db.prescriptions.replace_one(
                        {"rx_number": rx_doc["rx_number"]},
                        rx_doc, upsert=True
                    )
                    total_prescriptions += 1

            # Lab orders (2 per patient)
            for l in range(2):
                order_date = days_ago(random.randint(10, 180))
                lab_doc = {
                    "_id": ObjectId(),
                    "patient_id": patient_id,
                    "patient_name": member["full_name"],
                    "mrn": mrn,
                    "hospital_id": hospital_id,
                    "order_number": f"LAB-{fam_idx*100+mem_idx*10+l+1:06d}",
                    "tests": random.choice(LAB_TESTS),
                    "doctor_name": random.choice(DOCTORS).replace("Dr. ", ""),
                    "order_date": order_date.isoformat(),
                    "status": random.choice(["Completed", "Completed", "Pending", "Processing"]),
                    "urgent": random.choice([True, False]),
                    "created_at": order_date.isoformat(),
                }
                await db.lab_orders.replace_one(
                    {"order_number": lab_doc["order_number"]},
                    lab_doc, upsert=True
                )
                total_lab_orders += 1

            # IPD admission for 1 member of each family
            if mem_idx == 0:
                adm_date = days_ago(random.randint(30, 200))
                dis_date = adm_date + timedelta(days=random.randint(3, 10))
                ipd_doc = {
                    "_id": ObjectId(),
                    "patient_id": patient_id,
                    "patient_name": member["full_name"],
                    "mrn": mrn,
                    "hospital_id": hospital_id,
                    "ipd_number": f"IPD-{fam_idx+1:04d}",
                    "admission_date": adm_date.isoformat(),
                    "discharge_date": dis_date.isoformat(),
                    "ward_name": random.choice(WARDS),
                    "bed_number": f"B{random.randint(1,50):03d}",
                    "diagnosis": random.choice(DIAGNOSES),
                    "status": "Discharged",
                    "doctor_name": random.choice(DOCTORS).replace("Dr. ",""),
                    "created_at": adm_date.isoformat(),
                }
                await db.ipd_admissions.replace_one(
                    {"ipd_number": ipd_doc["ipd_number"]},
                    ipd_doc, upsert=True
                )
                total_admissions += 1

            # Update visit_count on patient
            vc = await db.patient_visits.count_documents({"patient_id": patient_id})
            await db.patients.update_one({"_id": pid}, {"$set": {"visit_count": vc}})

            print(f"  ✓ {member['full_name']} ({mrn}) — {num_visits} visits")

    client.close()
    print(f"\n{'='*50}")
    print(f"Seeded successfully!")
    print(f"  Patients:      {total_patients}")
    print(f"  OPD Visits:    {total_visits}")
    print(f"  Prescriptions: {total_prescriptions}")
    print(f"  Lab Orders:    {total_lab_orders}")
    print(f"  IPD Admissions:{total_admissions}")
    print(f"{'='*50}")


if __name__ == "__main__":
    asyncio.run(seed())
