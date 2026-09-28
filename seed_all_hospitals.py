"""
Comprehensive HIS Seed Script
Seeds ALL modules for HOSP-001, HOSP-002, HOSP-003:
  patients, appointments, opd_visits, ipd_admissions, prescriptions,
  lab_orders, pharmacy_medicines/bills/stock, hospital_bills, nursing_notes,
  doctors, doctor_schedules, departments, blood_bank_inventory, blood_requests,
  radiology_orders, ot_surgeries, insurance_companies, teleconsults

Run: python3 seed_all_hospitals.py
"""
import asyncio, random
from datetime import datetime, timedelta, date
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

MONGO_URI = "mongodb+srv://neelbert_test:Neelbert%40123.@cluster0.ijzzjo3.mongodb.net/?appName=Cluster0"
DB_NAME   = "hospital"

# ─── Hospital definitions ────────────────────────────────────────────────────
HOSPITALS = [
    {"hospital_id": "HOSP-001", "name": "Apollo Multispeciality Hospital",  "city": "Mumbai"},
    {"hospital_id": "HOSP-002", "name": "Medanta Heart Institute",           "city": "Gurugram"},
    {"hospital_id": "HOSP-003", "name": "Fortis Super Specialty Hospital",   "city": "Bangalore"},
]

# ─── Master data ─────────────────────────────────────────────────────────────
DEPARTMENTS_MASTER = [
    {"name": "General Medicine",  "code": "GM",  "beds": 30},
    {"name": "Cardiology",        "code": "CAR", "beds": 20},
    {"name": "Orthopaedics",      "code": "ORT", "beds": 25},
    {"name": "Neurology",         "code": "NEU", "beds": 15},
    {"name": "Gynaecology",       "code": "GYN", "beds": 20},
    {"name": "Paediatrics",       "code": "PAE", "beds": 18},
    {"name": "ENT",               "code": "ENT", "beds": 10},
    {"name": "Dermatology",       "code": "DER", "beds": 8},
    {"name": "Oncology",          "code": "ONC", "beds": 20},
    {"name": "Urology",           "code": "URO", "beds": 12},
    {"name": "Radiology",         "code": "RAD", "beds": 0},
    {"name": "Anaesthesia",       "code": "ANA", "beds": 0},
    {"name": "Emergency",         "code": "EMG", "beds": 10},
]

DOCTORS_PER_HOSP = {
    "HOSP-001": [
        {"name": "Dr. Rajesh Kumar",   "department": "General Medicine",  "qualification": "MBBS, MD"},
        {"name": "Dr. Priya Sharma",   "department": "Cardiology",        "qualification": "MBBS, DM"},
        {"name": "Dr. Amit Verma",     "department": "Orthopaedics",      "qualification": "MBBS, MS"},
        {"name": "Dr. Sana Khan",      "department": "Neurology",         "qualification": "MBBS, DM"},
        {"name": "Dr. Thomas Jose",    "department": "Gynaecology",       "qualification": "MBBS, MD"},
        {"name": "Dr. Nisha Rao",      "department": "Paediatrics",       "qualification": "MBBS, DCH"},
    ],
    "HOSP-002": [
        {"name": "Dr. Kiran Mehta",    "department": "Cardiology",        "qualification": "MBBS, DM"},
        {"name": "Dr. Suresh Nair",    "department": "General Medicine",  "qualification": "MBBS, MD"},
        {"name": "Dr. Anita Joshi",    "department": "Oncology",          "qualification": "MBBS, MD (Onco)"},
        {"name": "Dr. Vijay Patel",    "department": "Urology",           "qualification": "MBBS, MS, MCh"},
        {"name": "Dr. Leena Gupta",    "department": "Gynaecology",       "qualification": "MBBS, MS"},
        {"name": "Dr. Ravi Iyer",      "department": "Neurology",         "qualification": "MBBS, DM"},
    ],
    "HOSP-003": [
        {"name": "Dr. Arun Sharma",    "department": "Orthopaedics",      "qualification": "MBBS, MS (Ortho)"},
        {"name": "Dr. Deepa Pillai",   "department": "Neurology",         "qualification": "MBBS, DM"},
        {"name": "Dr. Rohit Bansal",   "department": "Urology",           "qualification": "MBBS, MCh"},
        {"name": "Dr. Meera Das",      "department": "Gynaecology",       "qualification": "MBBS, MD"},
        {"name": "Dr. Farhan Ali",     "department": "General Medicine",  "qualification": "MBBS, MD"},
        {"name": "Dr. Kavya Reddy",    "department": "Cardiology",        "qualification": "MBBS, DM"},
    ],
}

FAMILIES_PER_HOSP = {
    "HOSP-001": [
        {"mobile": "9810001001", "members": [
            {"full_name": "Ramesh Sharma",       "age": 45, "gender": "Male",   "blood_group": "B+",  "dob": "1980-03-15"},
            {"full_name": "Sunita Sharma",       "age": 42, "gender": "Female", "blood_group": "O+",  "dob": "1983-07-22"},
        ]},
        {"mobile": "9810001002", "members": [
            {"full_name": "Anil Mehta",          "age": 55, "gender": "Male",   "blood_group": "A+",  "dob": "1970-01-25"},
            {"full_name": "Kavita Mehta",        "age": 50, "gender": "Female", "blood_group": "B+",  "dob": "1975-04-30"},
        ]},
        {"mobile": "9810001003", "members": [
            {"full_name": "Priya Nair",          "age": 32, "gender": "Female", "blood_group": "O-",  "dob": "1992-12-05"},
            {"full_name": "Vikram Nair",         "age": 34, "gender": "Male",   "blood_group": "AB+", "dob": "1990-08-18"},
        ]},
        {"mobile": "9810001004", "members": [
            {"full_name": "Mohammad Irfan",      "age": 38, "gender": "Male",   "blood_group": "A-",  "dob": "1987-05-01"},
            {"full_name": "Fatima Irfan",        "age": 35, "gender": "Female", "blood_group": "O+",  "dob": "1990-09-14"},
        ]},
        {"mobile": "9810001005", "members": [
            {"full_name": "Suresh Patel",        "age": 60, "gender": "Male",   "blood_group": "B-",  "dob": "1965-06-10"},
        ]},
    ],
    "HOSP-002": [
        {"mobile": "9820002001", "members": [
            {"full_name": "Rajan Kapoor",        "age": 48, "gender": "Male",   "blood_group": "B+",  "dob": "1977-11-12"},
            {"full_name": "Seema Kapoor",        "age": 44, "gender": "Female", "blood_group": "A+",  "dob": "1981-05-20"},
        ]},
        {"mobile": "9820002002", "members": [
            {"full_name": "Pooja Bhatia",        "age": 30, "gender": "Female", "blood_group": "O+",  "dob": "1995-03-08"},
            {"full_name": "Sanjay Bhatia",       "age": 33, "gender": "Male",   "blood_group": "AB+", "dob": "1992-07-15"},
        ]},
        {"mobile": "9820002003", "members": [
            {"full_name": "Geeta Chauhan",       "age": 65, "gender": "Female", "blood_group": "B+",  "dob": "1960-02-14"},
            {"full_name": "Kishore Chauhan",     "age": 67, "gender": "Male",   "blood_group": "O+",  "dob": "1958-09-22"},
        ]},
        {"mobile": "9820002004", "members": [
            {"full_name": "Neha Agarwal",        "age": 28, "gender": "Female", "blood_group": "A+",  "dob": "1997-06-30"},
        ]},
        {"mobile": "9820002005", "members": [
            {"full_name": "Deepak Singhania",    "age": 42, "gender": "Male",   "blood_group": "B-",  "dob": "1983-12-01"},
        ]},
    ],
    "HOSP-003": [
        {"mobile": "9830003001", "members": [
            {"full_name": "Arjun Reddy",         "age": 36, "gender": "Male",   "blood_group": "O+",  "dob": "1989-04-17"},
            {"full_name": "Divya Reddy",         "age": 32, "gender": "Female", "blood_group": "B+",  "dob": "1993-08-25"},
        ]},
        {"mobile": "9830003002", "members": [
            {"full_name": "Lakshmi Iyer",        "age": 52, "gender": "Female", "blood_group": "AB-", "dob": "1973-11-03"},
            {"full_name": "Subramanian Iyer",    "age": 55, "gender": "Male",   "blood_group": "O+",  "dob": "1970-06-18"},
        ]},
        {"mobile": "9830003003", "members": [
            {"full_name": "Rahul Desai",         "age": 25, "gender": "Male",   "blood_group": "A+",  "dob": "2000-01-22"},
            {"full_name": "Sneha Desai",         "age": 23, "gender": "Female", "blood_group": "O+",  "dob": "2002-09-10"},
        ]},
        {"mobile": "9830003004", "members": [
            {"full_name": "Venkat Rao",          "age": 58, "gender": "Male",   "blood_group": "B+",  "dob": "1967-05-05"},
        ]},
        {"mobile": "9830003005", "members": [
            {"full_name": "Swati Joshi",         "age": 40, "gender": "Female", "blood_group": "A-",  "dob": "1985-02-28"},
        ]},
    ],
}

COMPLAINTS  = ["Fever and body ache", "Headache and nausea", "Chest pain", "Knee pain",
                "Stomach ache", "Cough and cold", "Back pain", "Dizziness", "Breathlessness",
                "Diabetes follow-up", "Hypertension control", "Skin rash", "Ear pain", "Eye irritation"]
DIAGNOSES   = ["Viral fever", "Hypertension", "Type 2 Diabetes", "Osteoarthritis",
                "Gastroenteritis", "Bronchitis", "Lumbar spondylosis", "Migraine",
                "Coronary artery disease", "Anaemia", "URTI", "Renal calculi"]
MEDICATIONS = [
    [{"name": "Paracetamol 500mg",     "dosage": "1-0-1", "days": 5, "qty": 10}],
    [{"name": "Amlodipine 5mg",        "dosage": "1-0-0", "days": 30, "qty": 30},
     {"name": "Telmisartan 40mg",      "dosage": "0-0-1", "days": 30, "qty": 30}],
    [{"name": "Metformin 500mg",       "dosage": "1-1-1", "days": 30, "qty": 90}],
    [{"name": "Ibuprofen 400mg",       "dosage": "1-1-1", "days": 7,  "qty": 21},
     {"name": "Pantoprazole 40mg",     "dosage": "1-0-0", "days": 7,  "qty": 7}],
    [{"name": "Cetirizine 10mg",       "dosage": "0-0-1", "days": 5,  "qty": 5}],
    [{"name": "Amoxicillin 500mg",     "dosage": "1-1-1", "days": 7,  "qty": 21}],
]
LAB_TESTS = [
    [{"test_name": "CBC",                          "test_code": "CBC001"}],
    [{"test_name": "Blood Sugar Fasting",          "test_code": "BS001"},
     {"test_name": "HbA1c",                        "test_code": "HB001"}],
    [{"test_name": "Lipid Profile",                "test_code": "LP001"}],
    [{"test_name": "Thyroid Profile (T3/T4/TSH)",  "test_code": "TH001"}],
    [{"test_name": "Urine Routine",                "test_code": "UR001"},
     {"test_name": "Creatinine",                   "test_code": "CR001"}],
    [{"test_name": "LFT",                          "test_code": "LFT001"}],
    [{"test_name": "ECG",                          "test_code": "ECG001"}],
]
WARDS = ["General Ward", "Private Room", "ICU", "Surgical Ward", "Maternity Ward",
         "Cardiology Ward", "Neurology Ward", "Orthopaedic Ward"]
VITALS_SAMPLES = [
    {"bp": "120/80", "pulse": 72, "temp": 98.6, "spo2": 98, "weight": 65, "height": 168},
    {"bp": "130/85", "pulse": 80, "temp": 99.0, "spo2": 97, "weight": 70, "height": 172},
    {"bp": "110/70", "pulse": 68, "temp": 98.2, "spo2": 99, "weight": 55, "height": 160},
    {"bp": "140/90", "pulse": 88, "temp": 99.5, "spo2": 96, "weight": 80, "height": 175},
]
NURSES = ["Sr. Anita Patel", "Sr. Rekha Devi", "Sr. Priya Thomas", "Sr. Jyoti Singh", "Sr. Kavya Rajan"]
BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
BLOOD_COMPONENTS = ["Whole Blood", "Packed RBC", "FFP", "Platelets", "Cryoprecipitate"]
RADIOLOGY_TESTS = [
    {"investigation": "X-Ray Chest PA",    "modality": "X-Ray",  "body_region": "Chest",   "amount": 300},
    {"investigation": "X-Ray KUB",         "modality": "X-Ray",  "body_region": "Abdomen",  "amount": 350},
    {"investigation": "USG Abdomen",        "modality": "USG",    "body_region": "Abdomen",  "amount": 600},
    {"investigation": "CT Brain Plain",     "modality": "CT",     "body_region": "Brain",    "amount": 3000},
    {"investigation": "MRI Lumbar Spine",   "modality": "MRI",    "body_region": "Spine",    "amount": 6000},
    {"investigation": "ECG",               "modality": "ECG",    "body_region": "Heart",    "amount": 200},
    {"investigation": "2D Echo",           "modality": "Echo",   "body_region": "Heart",    "amount": 1800},
]
SURGERIES = [
    {"name": "Appendicectomy",      "dept": "General Surgery",  "duration": 90,  "ot": "OT-1"},
    {"name": "Cataract Extraction", "dept": "Ophthalmology",    "duration": 45,  "ot": "OT-2"},
    {"name": "CABG",                "dept": "Cardiac Surgery",  "duration": 240, "ot": "OT-1"},
    {"name": "Knee Replacement",    "dept": "Orthopaedics",     "duration": 120, "ot": "OT-3"},
    {"name": "Cholecystectomy",     "dept": "General Surgery",  "duration": 75,  "ot": "OT-2"},
    {"name": "Hysterectomy",        "dept": "Gynaecology",      "duration": 100, "ot": "OT-3"},
    {"name": "TURP",                "dept": "Urology",          "duration": 90,  "ot": "OT-1"},
    {"name": "Lumbar Discectomy",   "dept": "Neurosurgery",     "duration": 150, "ot": "OT-2"},
]
MEDICINES_MASTER = [
    {"name": "Paracetamol 500mg",   "generic": "Paracetamol",    "category": "Tablet",   "mrp": 15.5,  "purchase_price": 8.0,  "gst": 12},
    {"name": "Amoxicillin 500mg",   "generic": "Amoxicillin",    "category": "Capsule",  "mrp": 45.0,  "purchase_price": 20.0, "gst": 12},
    {"name": "Metformin 500mg",     "generic": "Metformin",      "category": "Tablet",   "mrp": 30.0,  "purchase_price": 12.0, "gst": 12},
    {"name": "Amlodipine 5mg",      "generic": "Amlodipine",     "category": "Tablet",   "mrp": 20.0,  "purchase_price": 8.0,  "gst": 5},
    {"name": "Pantoprazole 40mg",   "generic": "Pantoprazole",   "category": "Tablet",   "mrp": 40.0,  "purchase_price": 15.0, "gst": 12},
    {"name": "Ibuprofen 400mg",     "generic": "Ibuprofen",      "category": "Tablet",   "mrp": 25.0,  "purchase_price": 10.0, "gst": 12},
    {"name": "Cetirizine 10mg",     "generic": "Cetirizine",     "category": "Tablet",   "mrp": 18.0,  "purchase_price": 7.0,  "gst": 12},
    {"name": "Azithromycin 500mg",  "generic": "Azithromycin",   "category": "Tablet",   "mrp": 60.0,  "purchase_price": 25.0, "gst": 12},
    {"name": "Dolo 650mg",          "generic": "Paracetamol",    "category": "Tablet",   "mrp": 28.0,  "purchase_price": 12.0, "gst": 12},
    {"name": "Calpol Syrup",        "generic": "Paracetamol",    "category": "Syrup",    "mrp": 55.0,  "purchase_price": 22.0, "gst": 12},
    {"name": "Normal Saline 500ml", "generic": "NaCl",           "category": "IV Fluid", "mrp": 80.0,  "purchase_price": 35.0, "gst": 5},
    {"name": "Ringer Lactate 500ml","generic": "RL",             "category": "IV Fluid", "mrp": 90.0,  "purchase_price": 40.0, "gst": 5},
    {"name": "Ondansetron 4mg",     "generic": "Ondansetron",    "category": "Tablet",   "mrp": 35.0,  "purchase_price": 14.0, "gst": 12},
    {"name": "Telmisartan 40mg",    "generic": "Telmisartan",    "category": "Tablet",   "mrp": 45.0,  "purchase_price": 18.0, "gst": 5},
    {"name": "Atorvastatin 10mg",   "generic": "Atorvastatin",   "category": "Tablet",   "mrp": 38.0,  "purchase_price": 15.0, "gst": 5},
]
INSURANCE_COMPANIES_MASTER = [
    {"name": "Star Health Insurance",   "code": "STAR",  "tpa": "Medi Assist", "contact": "1800-425-2255"},
    {"name": "HDFC ERGO Health",        "code": "HDFC",  "tpa": "Heritage",    "contact": "1800-2700-700"},
    {"name": "Niva Bupa Health",        "code": "NIVA",  "tpa": "Paramount",   "contact": "1860-500-8888"},
    {"name": "Care Health Insurance",   "code": "CARE",  "tpa": "FHPL",        "contact": "1800-102-4488"},
]

mrn_counter = [2026010001]

def nmrn():
    m = f"MRN-{mrn_counter[0]}"
    mrn_counter[0] += 1
    return m

def ago(n):
    return datetime.utcnow() - timedelta(days=n)

def rand_date_str(days_min=1, days_max=180):
    d = ago(random.randint(days_min, days_max))
    return d.strftime("%Y-%m-%d")

def future_date_str(days_min=1, days_max=30):
    d = datetime.utcnow() + timedelta(days=random.randint(days_min, days_max))
    return d.strftime("%Y-%m-%d")


async def seed():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]

    print("=" * 60)
    print("HIS Comprehensive Seed — All Hospitals")
    print("=" * 60)

    # ── Keep track of all patient records created per hospital ────────────────
    hospital_patients = {}   # hospital_id -> list of {pid, mrn, name, gender, age, mobile, blood_group}
    hospital_doctor_ids = {}  # hospital_id -> list of doctor ObjectIds
    hospital_med_ids    = {}  # hospital_id -> list of (medicine_id, medicine_name, mrp)
    hospital_ipd_regs   = {}  # hospital_id -> list of (ipd_reg_no, patient_name, ward, bed)

    # ─────────────────────────────────────────────────────────────────────────
    # 1. DEPARTMENTS (per hospital)
    # ─────────────────────────────────────────────────────────────────────────
    print("\n[1/14] Departments...")
    for hosp in HOSPITALS:
        hid = hosp["hospital_id"]
        hname = hosp["name"]
        for dept in DEPARTMENTS_MASTER:
            doc = {
                **dept,
                "hospital_id":   hid,
                "hospital_name": hname,
                "head":          f"HOD - {dept['name']}",
                "created_at":    ago(300),
            }
            await db.departments.update_one(
                {"code": dept["code"], "hospital_id": hid},
                {"$set": doc}, upsert=True
            )
    print("   ✓ departments seeded")

    # ─────────────────────────────────────────────────────────────────────────
    # 2. DOCTORS (per hospital, also update users' display)
    # ─────────────────────────────────────────────────────────────────────────
    print("\n[2/14] Doctors...")
    for hosp in HOSPITALS:
        hid   = hosp["hospital_id"]
        hname = hosp["name"]
        hospital_doctor_ids[hid] = []
        for dr in DOCTORS_PER_HOSP[hid]:
            doc = {
                "name":               dr["name"],
                "department":         dr["department"],
                "qualification":      dr["qualification"],
                "hospital_id":        hid,
                "hospital_name":      hname,
                "consultation_fee":   random.choice([500, 700, 800, 1000, 1200]),
                "available_slots":    "Mon-Sat 09:00-17:00",
                "status":             "Active",
                "created_at":         ago(200),
            }
            res = await db.doctors.update_one(
                {"name": dr["name"], "hospital_id": hid},
                {"$set": doc}, upsert=True
            )
            inserted = await db.doctors.find_one({"name": dr["name"], "hospital_id": hid})
            hospital_doctor_ids[hid].append(inserted["_id"])
    print("   ✓ doctors seeded")

    # ─────────────────────────────────────────────────────────────────────────
    # 3. DOCTOR SCHEDULES
    # ─────────────────────────────────────────────────────────────────────────
    print("\n[3/14] Doctor Schedules...")
    days_of_week = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
    for hosp in HOSPITALS:
        hid   = hosp["hospital_id"]
        hname = hosp["name"]
        for dr in DOCTORS_PER_HOSP[hid]:
            for day in random.sample(days_of_week, 5):
                doc = {
                    "doctor_name":   dr["name"],
                    "department":    dr["department"],
                    "day_of_week":   day,
                    "start_time":    random.choice(["08:00", "09:00", "10:00"]),
                    "end_time":      random.choice(["13:00", "14:00", "15:00"]),
                    "max_patients":  random.randint(15, 30),
                    "hospital_id":   hid,
                    "hospital_name": hname,
                    "is_active":     True,
                }
                await db.doctor_schedules.update_one(
                    {"doctor_name": dr["name"], "day_of_week": day, "hospital_id": hid},
                    {"$set": doc}, upsert=True
                )
    print("   ✓ doctor_schedules seeded")

    # ─────────────────────────────────────────────────────────────────────────
    # 4. PATIENTS
    # ─────────────────────────────────────────────────────────────────────────
    print("\n[4/14] Patients...")
    for hosp in HOSPITALS:
        hid   = hosp["hospital_id"]
        hname = hosp["name"]
        hospital_patients[hid] = []
        for fam in FAMILIES_PER_HOSP[hid]:
            for mem in fam["members"]:
                mrn = nmrn()
                pid = ObjectId()
                cat = random.choice(["GENERAL","GENERAL","GENERAL","INSURANCE","GOVT"])
                doc = {
                    "_id":                      pid,
                    "full_name":                mem["full_name"],
                    "name":                     mem["full_name"],
                    "mrn":                      mrn,
                    "age":                      mem["age"],
                    "gender":                   mem["gender"],
                    "date_of_birth":            mem["dob"],
                    "blood_group":              mem["blood_group"],
                    "mobile":                   fam["mobile"],
                    "phone":                    fam["mobile"],
                    "email":                    f"{mem['full_name'].lower().replace(' ','.')[:15]}@example.com",
                    "address":                  f"{random.randint(1,200)}, Sector {random.randint(1,30)}, {hosp['city']}",
                    "city":                     hosp["city"],
                    "patient_category":         cat,
                    "insurance_provider":       random.choice(["Star Health","HDFC ERGO","Niva Bupa","Care Health"]) if cat == "INSURANCE" else None,
                    "insurance_policy_number":  f"POL{random.randint(100000,999999)}" if cat == "INSURANCE" else None,
                    "allergies":                random.choice([[], ["Penicillin"], ["NSAIDs"], ["Sulfa"]]),
                    "chronic_conditions":       random.choice([[], ["Hypertension"], ["Diabetes"], ["Asthma"]]),
                    "emergency_contact_name":   f"Contact - {mem['full_name'].split()[0]}",
                    "emergency_contact_mobile": f"98{random.randint(10000000, 99999999)}",
                    "hospital_id":              hid,
                    "hospital_name":            hname,
                    "status":                   "Active",
                    "visit_count":              0,
                    "created_at":               ago(random.randint(30, 365)),
                }
                await db.patients.replace_one({"mrn": mrn}, doc, upsert=True)
                hospital_patients[hid].append({
                    "pid": str(pid), "mrn": mrn, "name": mem["full_name"],
                    "gender": mem["gender"], "age": mem["age"],
                    "mobile": fam["mobile"], "blood_group": mem["blood_group"],
                    "dob": mem["dob"],
                })
    total_patients = sum(len(v) for v in hospital_patients.values())
    print(f"   ✓ {total_patients} patients seeded across all hospitals")

    # ─────────────────────────────────────────────────────────────────────────
    # 5. APPOINTMENTS
    # ─────────────────────────────────────────────────────────────────────────
    print("\n[5/14] Appointments...")
    appt_count = 0
    for hosp in HOSPITALS:
        hid   = hosp["hospital_id"]
        hname = hosp["name"]
        doctors = DOCTORS_PER_HOSP[hid]
        for pat in hospital_patients[hid]:
            dr = random.choice(doctors)
            # 2 past + 1 upcoming per patient
            for offset, status in [
                (random.randint(20, 60), "Completed"),
                (random.randint(5, 15),  random.choice(["Completed","No Show"])),
                (-random.randint(2, 14), "Scheduled"),
            ]:
                appt_date = (datetime.utcnow() - timedelta(days=offset)).strftime("%Y-%m-%d")
                appt_time = random.choice(["09:00","09:30","10:00","10:30","11:00","11:30","14:00","14:30"])
                doc = {
                    "patient_id":      pat["pid"],
                    "patient_name":    pat["name"],
                    "patient_mobile":  pat["mobile"],
                    "patient_age":     pat["age"],
                    "patient_gender":  pat["gender"],
                    "mrn":             pat["mrn"],
                    "doctor_name":     dr["name"],
                    "department":      dr["department"],
                    "appointment_date": appt_date,
                    "appointment_time": appt_time,
                    "appointment_type": random.choice(["OPD","Follow-up"]),
                    "status":          status,
                    "notes":           random.choice(["Routine checkup", "Follow-up", "Review","Consultation"]),
                    "token_number":    random.randint(1, 50),
                    "hospital_id":     hid,
                    "hospital_name":   hname,
                    "created_at":      ago(random.randint(2, 70)),
                }
                await db.appointments.insert_one(doc)
                appt_count += 1
    print(f"   ✓ {appt_count} appointments seeded")

    # ─────────────────────────────────────────────────────────────────────────
    # 6. OPD VISITS
    # ─────────────────────────────────────────────────────────────────────────
    print("\n[6/14] OPD Visits...")
    opd_count = 0
    token_counter = {}
    for hosp in HOSPITALS:
        hid   = hosp["hospital_id"]
        hname = hosp["name"]
        doctors = DOCTORS_PER_HOSP[hid]
        token_counter[hid] = 1
        for pat in hospital_patients[hid]:
            dr = random.choice(doctors)
            num_visits = random.randint(3, 6)
            for v in range(num_visits):
                visit_date = ago(v * 25 + random.randint(0, 10))
                status = random.choice(["Completed","Completed","Completed","Waiting","Cancelled"])
                doc = {
                    "patient_id":     pat["pid"],
                    "patient_name":   pat["name"],
                    "mrn":            pat["mrn"],
                    "mobile":         pat["mobile"],
                    "doctor_name":    dr["name"],
                    "department":     dr["department"],
                    "visit_date":     visit_date.strftime("%Y-%m-%d"),
                    "visit_type":     random.choice(["Consultation","Follow-up","Emergency","Review"]),
                    "chief_complaint": random.choice(COMPLAINTS),
                    "diagnosis":      random.choice(DIAGNOSES) if status == "Completed" else "",
                    "vitals":         random.choice(VITALS_SAMPLES),
                    "status":         status,
                    "token_number":   token_counter[hid],
                    "payment_mode":   random.choice(["Cash","Card","UPI","Insurance"]),
                    "priority":       random.choice(["Normal","Normal","Normal","Urgent"]),
                    "hospital_id":    hid,
                    "hospital_name":  hname,
                    "created_at":     visit_date,
                }
                await db.opd_visits.insert_one(doc)
                token_counter[hid] += 1
                opd_count += 1

                # Prescriptions for completed visits
                if status == "Completed":
                    meds = random.choice(MEDICATIONS)
                    rx_doc = {
                        "patient_id":   pat["pid"],
                        "patient_name": pat["name"],
                        "mrn":          pat["mrn"],
                        "doctor_name":  dr["name"],
                        "department":   dr["department"],
                        "diagnosis":    random.choice(DIAGNOSES),
                        "medications":  meds,
                        "advice":       "Take medicines on time. Follow up after 2 weeks.",
                        "visit_date":   visit_date.strftime("%Y-%m-%d"),
                        "hospital_id":  hid,
                        "hospital_name":hname,
                        "created_at":   visit_date,
                    }
                    await db.prescriptions.insert_one(rx_doc)
    print(f"   ✓ {opd_count} OPD visits seeded")

    # ─────────────────────────────────────────────────────────────────────────
    # 7. IPD ADMISSIONS + NURSING NOTES
    # ─────────────────────────────────────────────────────────────────────────
    print("\n[7/14] IPD Admissions + Nursing Notes...")
    ipd_count = 0
    nursing_count = 0
    ipd_serial = {"HOSP-001": 1001, "HOSP-002": 2001, "HOSP-003": 3001}
    for hosp in HOSPITALS:
        hid   = hosp["hospital_id"]
        hname = hosp["name"]
        hospital_ipd_regs[hid] = []
        doctors = DOCTORS_PER_HOSP[hid]
        for i, pat in enumerate(hospital_patients[hid]):
            dr = random.choice(doctors)
            ward = random.choice(WARDS)
            bed  = f"BED-{random.randint(1,50):03d}"
            adm_days = random.randint(10, 120)
            adm_date = ago(adm_days)
            is_current = (i % 3 == 0)  # every 3rd patient still admitted
            dis_date   = None if is_current else adm_date + timedelta(days=random.randint(3, 12))
            status     = "Admitted" if is_current else "Discharged"
            ipd_num    = f"IPD-{hid[-3:]}-{ipd_serial[hid]:04d}"
            ipd_serial[hid] += 1
            doc = {
                "patient_id":            pat["pid"],
                "patient_name":          pat["name"],
                "mrn":                   pat["mrn"],
                "age":                   pat["age"],
                "gender":                pat["gender"],
                "doctor_name":           dr["name"],
                "department":            dr["department"],
                "ward":                  ward,
                "ward_name":             ward,
                "bed_number":            bed,
                "admission_date":        adm_date.strftime("%Y-%m-%d"),
                "discharge_date":        dis_date.strftime("%Y-%m-%d") if dis_date else None,
                "admission_reason":      random.choice(COMPLAINTS),
                "diagnosis":             random.choice(DIAGNOSES),
                "admission_type":        random.choice(["ELECTIVE","EMERGENCY","DAY_CARE"]),
                "patient_category":      random.choice(["PRIVATE","GENERAL","INSURANCE"]),
                "attendant_name":        f"Attendant of {pat['name'].split()[0]}",
                "attendant_mobile":      f"97{random.randint(10000000,99999999)}",
                "attendant_relation":    random.choice(["Spouse","Son","Daughter","Brother","Father"]),
                "status":                status,
                "ipd_reg_no":            ipd_num,
                "ipd_number":            ipd_num,
                "discharge_summary":     "Patient recovered well. Advised follow-up." if dis_date else None,
                "hospital_id":           hid,
                "hospital_name":         hname,
                "created_at":            adm_date,
            }
            await db.ipd_admissions.insert_one(doc)
            hospital_ipd_regs[hid].append({"ipd_num": ipd_num, "name": pat["name"], "ward": ward, "bed": bed, "pid": pat["pid"]})
            ipd_count += 1

            # Nursing notes (2-4 per admitted patient)
            if is_current:
                nurse = random.choice(NURSES)
                for n in range(random.randint(2, 4)):
                    note_date = ago(n)
                    n_doc = {
                        "patient_id":  pat["pid"],
                        "patient_name":pat["name"],
                        "mrn":         pat["mrn"],
                        "ipd_reg_no":  ipd_num,
                        "ward":        ward,
                        "bed_number":  bed,
                        "shift":       random.choice(["Morning","Evening","Night"]),
                        "nurse_name":  nurse,
                        "vitals":      random.choice(VITALS_SAMPLES),
                        "intake":      random.randint(400, 900),
                        "output":      random.randint(300, 800),
                        "note":        random.choice(["Patient comfortable. Vitals stable.",
                                                       "Slight fever. Doctor informed.",
                                                       "Patient resting. No complaints.",
                                                       "IV fluids running. Patient awake and alert."]),
                        "date":        note_date.strftime("%Y-%m-%d"),
                        "note_date":   note_date.strftime("%Y-%m-%d"),
                        "hospital_id": hid,
                        "hospital_name":hname,
                        "created_at":  note_date,
                    }
                    await db.nursing_notes.insert_one(n_doc)
                    nursing_count += 1
    print(f"   ✓ {ipd_count} IPD admissions, {nursing_count} nursing notes seeded")

    # ─────────────────────────────────────────────────────────────────────────
    # 8. LAB ORDERS
    # ─────────────────────────────────────────────────────────────────────────
    print("\n[8/14] Lab Orders...")
    lab_count = 0
    lab_serial = {"HOSP-001": 1001, "HOSP-002": 2001, "HOSP-003": 3001}
    for hosp in HOSPITALS:
        hid   = hosp["hospital_id"]
        hname = hosp["name"]
        doctors = DOCTORS_PER_HOSP[hid]
        for pat in hospital_patients[hid]:
            dr = random.choice(doctors)
            for _ in range(random.randint(2, 4)):
                order_date = ago(random.randint(1, 90))
                status = random.choice(["Completed","Completed","Pending","Processing"])
                order_num = f"LAB-{hid[-3:]}-{lab_serial[hid]:05d}"
                lab_serial[hid] += 1
                doc = {
                    "patient_id":   pat["pid"],
                    "patient_name": pat["name"],
                    "mrn":          pat["mrn"],
                    "doctor_name":  dr["name"],
                    "department":   dr["department"],
                    "tests":        random.choice(LAB_TESTS),
                    "order_number": order_num,
                    "order_date":   order_date.strftime("%Y-%m-%d"),
                    "status":       status,
                    "urgent":       random.choice([True, False, False]),
                    "sample_collected": status in ["Completed","Processing"],
                    "result":       "Within normal limits" if status == "Completed" else None,
                    "hospital_id":  hid,
                    "hospital_name":hname,
                    "created_at":   order_date,
                }
                await db.lab_orders.insert_one(doc)
                lab_count += 1
    print(f"   ✓ {lab_count} lab orders seeded")

    # ─────────────────────────────────────────────────────────────────────────
    # 9. RADIOLOGY ORDERS
    # ─────────────────────────────────────────────────────────────────────────
    print("\n[9/14] Radiology Orders...")
    rad_count = 0
    rad_serial = {"HOSP-001": 1001, "HOSP-002": 2001, "HOSP-003": 3001}
    for hosp in HOSPITALS:
        hid   = hosp["hospital_id"]
        hname = hosp["name"]
        doctors = DOCTORS_PER_HOSP[hid]
        for pat in hospital_patients[hid]:
            dr = random.choice(doctors)
            for _ in range(random.randint(1, 3)):
                order_date = ago(random.randint(1, 60))
                test = random.choice(RADIOLOGY_TESTS)
                status = random.choice(["Reported","Reported","Pending","Processing"])
                order_num = f"RAD-{hid[-3:]}-{rad_serial[hid]:04d}"
                rad_serial[hid] += 1
                doc = {
                    "patient_id":           pat["pid"],
                    "patient_name":         pat["name"],
                    "mrn":                  pat["mrn"],
                    "doctor_name":          dr["name"],
                    "department":           dr["department"],
                    "investigation":        test["investigation"],
                    "modality":             test["modality"],
                    "body_region":          test["body_region"],
                    "clinical_indication":  random.choice(COMPLAINTS),
                    "urgent":               random.choice([True, False, False]),
                    "status":               status,
                    "radiologist":          "Dr. Radiology",
                    "report":               "No significant abnormality detected." if status == "Reported" else None,
                    "order_number":         order_num,
                    "amount":               test["amount"],
                    "order_date":           order_date.strftime("%Y-%m-%d"),
                    "hospital_id":          hid,
                    "hospital_name":        hname,
                    "created_at":           order_date,
                }
                await db.radiology_orders.insert_one(doc)
                rad_count += 1
    print(f"   ✓ {rad_count} radiology orders seeded")

    # ─────────────────────────────────────────────────────────────────────────
    # 10. OT SURGERIES
    # ─────────────────────────────────────────────────────────────────────────
    print("\n[10/14] OT Surgeries...")
    ot_count = 0
    for hosp in HOSPITALS:
        hid   = hosp["hospital_id"]
        hname = hosp["name"]
        doctors = DOCTORS_PER_HOSP[hid]
        for pat in random.sample(hospital_patients[hid], min(4, len(hospital_patients[hid]))):
            dr       = random.choice(doctors)
            surgery  = random.choice(SURGERIES)
            surg_date = ago(random.randint(5, 90))
            status   = random.choice(["Completed","Completed","Scheduled"])
            doc = {
                "patient_id":        pat["pid"],
                "patient_name":      pat["name"],
                "mrn":               pat["mrn"],
                "surgeon_name":      dr["name"],
                "anaesthetist_name": "Dr. Kishore Nair",
                "department":        surgery["dept"],
                "ot_number":         surgery["ot"],
                "surgery_name":      surgery["name"],
                "surgery_type":      random.choice(["Elective","Emergency","Urgent"]),
                "surgery_date":      surg_date.strftime("%Y-%m-%d"),
                "surgery_time":      random.choice(["08:00","09:00","10:00","11:00","14:00"]),
                "duration_minutes":  surgery["duration"],
                "anaesthesia_type":  random.choice(["General","Spinal","Local","Epidural"]),
                "pre_op_diagnosis":  "Pre-operative evaluation done. Patient fit for surgery.",
                "post_op_diagnosis": "Surgery completed uneventfully." if status == "Completed" else "",
                "status":            status,
                "hospital_id":       hid,
                "hospital_name":     hname,
                "created_at":        surg_date,
            }
            await db.ot_surgeries.insert_one(doc)
            ot_count += 1
    print(f"   ✓ {ot_count} OT surgeries seeded")

    # ─────────────────────────────────────────────────────────────────────────
    # 11. PHARMACY MEDICINES + STOCK + BILLS
    # ─────────────────────────────────────────────────────────────────────────
    print("\n[11/14] Pharmacy (Medicines, Stock, Bills)...")
    med_count = 0
    bill_count = 0
    for hosp in HOSPITALS:
        hid   = hosp["hospital_id"]
        hname = hosp["name"]
        hospital_med_ids[hid] = []
        doctors = DOCTORS_PER_HOSP[hid]
        # Insert medicines
        for med in MEDICINES_MASTER:
            batch = f"BT{random.randint(10000000,99999999)}"
            expiry = (datetime.utcnow() + timedelta(days=random.randint(180, 730))).strftime("%Y-%m-%d")
            m_doc = {
                "name":             med["name"],
                "generic_name":     med["generic"],
                "brand_name":       med["name"].split()[0],
                "category":         med["category"],
                "manufacturer":     random.choice(["Sun Pharma","Cipla","Dr. Reddy's","GSK India","Pfizer India"]),
                "hsn_code":         "30049099",
                "gst_percent":      med["gst"],
                "unit":             "Strip" if med["category"] in ["Tablet","Capsule"] else "Bottle",
                "pack_size":        10,
                "mrp":              med["mrp"],
                "purchase_price":   med["purchase_price"],
                "selling_price":    round(med["mrp"] * 0.9, 2),
                "reorder_level":    50,
                "current_stock":    random.randint(100, 500),
                "batch_number":     batch,
                "expiry_date":      expiry,
                "rack_location":    f"{random.choice('ABCD')}{random.randint(1,5)}-R{random.randint(1,5)}",
                "is_active":        True,
                "is_controlled":    False,
                "schedule":         "OTC",
                "hospital_id":      hid,
                "hospital_name":    hname,
                "created_at":       ago(90),
                "updated_at":       ago(1),
            }
            res = await db.pharmacy_medicines.insert_one(m_doc)
            hospital_med_ids[hid].append((str(res.inserted_id), med["name"], med["mrp"], batch, expiry))
            med_count += 1

        # Pharmacy bills (3-4 per patient)
        bill_serial = {"HOSP-001": 1001, "HOSP-002": 2001, "HOSP-003": 3001}
        for pat in hospital_patients[hid]:
            dr = random.choice(doctors)
            for _ in range(random.randint(2, 4)):
                bill_date = ago(random.randint(1, 60))
                items_chosen = random.sample(hospital_med_ids[hid], random.randint(1, 4))
                items = []
                gross = 0
                gst_total = 0
                for mid, mname, mrp, batch, expiry in items_chosen:
                    qty   = random.randint(1, 3)
                    price = round(mrp * 0.9, 2)
                    line  = round(qty * price, 2)
                    gst   = round(line * 0.12, 2)
                    items.append({
                        "medicine_id":   mid,
                        "medicine_name": mname,
                        "batch_number":  batch,
                        "expiry_date":   expiry,
                        "quantity":      qty,
                        "unit_price":    price,
                        "line_total":    line,
                        "gst_amount":    gst,
                    })
                    gross     += line
                    gst_total += gst
                discount   = random.choice([0, 0, 5, 10])
                disc_amt   = round(gross * discount / 100, 2)
                net_payable = round(gross + gst_total - disc_amt, 2)
                bnum = f"PH{hid[-3:]}{bill_date.strftime('%Y%m%d')}{bill_serial[hid]:04d}"
                bill_serial[hid] += 1
                b_doc = {
                    "bill_number":      bnum,
                    "bill_date":        bill_date.strftime("%Y-%m-%d"),
                    "patient_id":       pat["pid"],
                    "patient_name":     pat["name"],
                    "patient_phone":    pat["mobile"],
                    "mrn":              pat["mrn"],
                    "doctor_name":      dr["name"],
                    "visit_type":       random.choice(["OPD","IPD"]),
                    "items":            items,
                    "gross_amount":     round(gross, 2),
                    "gst_amount":       round(gst_total, 2),
                    "discount_percent": discount,
                    "discount_amount":  disc_amt,
                    "net_payable":      net_payable,
                    "payment_mode":     random.choice(["Cash","Card","UPI"]),
                    "counter_location": "Main Pharmacy",
                    "dispensed_by":     "Pharmacist",
                    "status":           "Paid",
                    "hospital_id":      hid,
                    "hospital_name":    hname,
                    "created_at":       bill_date,
                }
                await db.pharmacy_bills.insert_one(b_doc)
                bill_count += 1
    print(f"   ✓ {med_count} medicines, {bill_count} pharmacy bills seeded")

    # ─────────────────────────────────────────────────────────────────────────
    # 12. HOSPITAL BILLS (Billing & Revenue)
    # ─────────────────────────────────────────────────────────────────────────
    print("\n[12/14] Hospital Bills (Billing)...")
    hbill_count = 0
    hbill_serial = {"HOSP-001": 10001, "HOSP-002": 20001, "HOSP-003": 30001}
    for hosp in HOSPITALS:
        hid   = hosp["hospital_id"]
        hname = hosp["name"]
        for pat in hospital_patients[hid]:
            for _ in range(random.randint(2, 4)):
                bill_date = ago(random.randint(1, 90))
                total     = random.randint(500, 30000)
                paid      = random.choice([total, total, random.randint(0, total)])
                pstatus   = "Paid" if paid >= total else ("Partial" if paid > 0 else "Unpaid")
                bnum      = f"BILL-{hid[-3:]}-{hbill_serial[hid]}"
                hbill_serial[hid] += 1
                doc = {
                    "patient_id":            pat["pid"],
                    "patient_name":          pat["name"],
                    "mrn":                   pat["mrn"],
                    "bill_number":           bnum,
                    "bill_date":             bill_date.strftime("%Y-%m-%d"),
                    "bill_type":             random.choice(["OPD","IPD","Lab","Radiology","Pharmacy"]),
                    "total_amount":          total,
                    "discount":              random.choice([0, 0, 500, 1000]),
                    "paid_amount":           paid,
                    "payment_status":        pstatus,
                    "payment_mode":          random.choice(["Cash","Card","UPI","Insurance"]),
                    "insurance_provider":    random.choice([None, "Star Health", "HDFC ERGO"]),
                    "insurance_claim_number":f"CLM{random.randint(100000,999999)}" if random.random() > 0.7 else None,
                    "hospital_id":           hid,
                    "hospital_name":         hname,
                    "created_at":            bill_date,
                    "created_by":            "Billing Staff",
                }
                await db.hospital_bills.insert_one(doc)
                hbill_count += 1
    print(f"   ✓ {hbill_count} hospital bills seeded")

    # ─────────────────────────────────────────────────────────────────────────
    # 13. BLOOD BANK (Inventory + Requests)
    # ─────────────────────────────────────────────────────────────────────────
    print("\n[13/14] Blood Bank...")
    bb_count = 0
    br_count = 0
    for hosp in HOSPITALS:
        hid   = hosp["hospital_id"]
        hname = hosp["name"]
        for bg in BLOOD_GROUPS:
            for comp in BLOOD_COMPONENTS:
                units = random.randint(0, 20)
                expiry = (datetime.utcnow() + timedelta(days=random.randint(7, 35))).strftime("%Y-%m-%d")
                doc = {
                    "blood_group":      bg,
                    "component":        comp,
                    "units_available":  units,
                    "units_reserved":   random.randint(0, min(2, units)),
                    "expiry_date":      expiry,
                    "last_updated":     ago(random.randint(0, 5)),
                    "status":           "Available" if units > 0 else "Out of Stock",
                    "units":            units,
                    "hospital_id":      hid,
                    "hospital_name":    hname,
                }
                await db.blood_bank_inventory.insert_one(doc)
                bb_count += 1

        # Blood requests (1-2 per patient)
        doctors = DOCTORS_PER_HOSP[hid]
        for pat in random.sample(hospital_patients[hid], min(5, len(hospital_patients[hid]))):
            dr = random.choice(doctors)
            req_date = ago(random.randint(1, 60))
            doc = {
                "patient_id":    pat["pid"],
                "patient_name":  pat["name"],
                "mrn":           pat["mrn"],
                "blood_group":   pat["blood_group"],
                "component":     random.choice(BLOOD_COMPONENTS),
                "units_required":random.randint(1, 4),
                "units_issued":  random.randint(0, 3),
                "reason":        random.choice(["Pre-operative","Emergency","Anaemia","Surgery","Trauma"]),
                "doctor_name":   dr["name"],
                "status":        random.choice(["Issued","Pending","Pending"]),
                "request_date":  req_date.strftime("%Y-%m-%d"),
                "hospital_id":   hid,
                "hospital_name": hname,
                "created_at":    req_date,
            }
            await db.blood_requests.insert_one(doc)
            br_count += 1
    print(f"   ✓ {bb_count} blood inventory entries, {br_count} blood requests seeded")

    # ─────────────────────────────────────────────────────────────────────────
    # 14. INSURANCE COMPANIES + CLAIMS
    # ─────────────────────────────────────────────────────────────────────────
    print("\n[14/14] Insurance Companies + Claims...")
    ic_count = 0
    claim_count = 0
    for hosp in HOSPITALS:
        hid   = hosp["hospital_id"]
        hname = hosp["name"]
        for ins in INSURANCE_COMPANIES_MASTER:
            doc = {
                "name":          ins["name"],
                "code":          ins["code"],
                "tpa_name":      ins["tpa"],
                "contact_number":ins["contact"],
                "email":         f"claims@{ins['code'].lower()}.com",
                "empanelled":    True,
                "hospital_id":   hid,
                "hospital_name": hname,
                "created_at":    ago(200),
            }
            await db.insurance_companies.update_one(
                {"code": ins["code"], "hospital_id": hid},
                {"$set": doc}, upsert=True
            )
            ic_count += 1

        # Insurance claims
        insured_patients = [p for p in hospital_patients[hid] if random.random() > 0.5]
        for pat in insured_patients:
            ins_co = random.choice(INSURANCE_COMPANIES_MASTER)
            claim_date = ago(random.randint(5, 60))
            claimed = random.randint(5000, 50000)
            approved = random.randint(0, claimed)
            doc = {
                "patient_id":       pat["pid"],
                "patient_name":     pat["name"],
                "mrn":              pat["mrn"],
                "insurance_company":ins_co["name"],
                "tpa_name":         ins_co["tpa"],
                "policy_number":    f"POL{random.randint(100000,999999)}",
                "claim_number":     f"CLM{random.randint(100000,999999)}",
                "claim_date":       claim_date.strftime("%Y-%m-%d"),
                "claim_type":       random.choice(["Cashless","Reimbursement"]),
                "diagnosis":        random.choice(DIAGNOSES),
                "claimed_amount":   claimed,
                "approved_amount":  approved,
                "status":           random.choice(["Approved","Pending","Rejected","Under Review"]),
                "hospital_id":      hid,
                "hospital_name":    hname,
                "created_at":       claim_date,
            }
            await db.insurance_claims.insert_one(doc)
            claim_count += 1
    print(f"   ✓ {ic_count} insurance companies, {claim_count} claims seeded")

    # ─────────────────────────────────────────────────────────────────────────
    # Update visit_count on patients
    # ─────────────────────────────────────────────────────────────────────────
    print("\nUpdating patient visit counts...")
    for hosp in HOSPITALS:
        hid = hosp["hospital_id"]
        for pat in hospital_patients[hid]:
            vc = await db.opd_visits.count_documents({"patient_id": pat["pid"]})
            await db.patients.update_one({"mrn": pat["mrn"]}, {"$set": {"visit_count": vc}})

    client.close()

    print("\n" + "=" * 60)
    print("ALL DONE! Summary:")
    print("=" * 60)
    print(f"  Patients:           {total_patients}")
    print(f"  Departments:        {len(DEPARTMENTS_MASTER) * 3} (per hospital × 3)")
    print(f"  Doctors:            {sum(len(v) for v in DOCTORS_PER_HOSP.values())}")
    print(f"  Appointments:       {appt_count}")
    print(f"  OPD Visits:         {opd_count}")
    print(f"  IPD Admissions:     {ipd_count}")
    print(f"  Nursing Notes:      {nursing_count}")
    print(f"  Lab Orders:         {lab_count}")
    print(f"  Radiology Orders:   {rad_count}")
    print(f"  OT Surgeries:       {ot_count}")
    print(f"  Pharmacy Medicines: {med_count}")
    print(f"  Pharmacy Bills:     {bill_count}")
    print(f"  Hospital Bills:     {hbill_count}")
    print(f"  Blood Inventory:    {bb_count}")
    print(f"  Blood Requests:     {br_count}")
    print(f"  Insurance Cos:      {ic_count}")
    print(f"  Insurance Claims:   {claim_count}")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(seed())
