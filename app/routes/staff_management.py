# from fastapi import FastAPI, HTTPException, Depends, Path
# from fastapi import APIRouter
# from bson import ObjectId
# from typing import List
# from app.database.schemas.hr_staff_schema import (
#     EmployeeModel, 
#     AttendanceModel, 
#     DailyReportModel, 
#     LeaveRequestModel,
#     LeaveRequestUpdateModel,
#     DailyReportUpdateModel
# )
# from app.database import employees_collection, attendance_collection, daily_reports_collection, leave_requests_collection
# from datetime import datetime

# staff_router = APIRouter(prefix="/api/staff", tags=["roles"])

# def obj_id_to_str(doc):
#     doc["id"] = str(doc.pop("_id"))
#     return doc

# def get_initials(name):
#     if not name: return ""
#     return "".join([n[0] for n in name.split()][:2]).upper()

# # --- Sequence Helper for Employee ID ---
# def get_next_sequence(db, name):

#     counters = db["counters"]
#     ret = counters.find_one_and_update(
#         {"_id": name},
#         {"$inc": {"seq": 1}},
#         upsert=True,
#         return_document=True
#     )
#     return ret["seq"]


# def get_last_active(attendance):
#     present_dates = [
#         a.get("date")
#         for a in attendance
#         if a.get("status", "").lower() == "present"
#     ]
#     if not present_dates:
#         return "No recent activity"
#     try:
#         last = max(present_dates)
#         last_date = datetime.strptime(last, "%Y-%m-%d")
#         days_ago = (datetime.now() - last_date).days
#         return f"{days_ago} days ago" if days_ago > 0 else "Today"
#     except Exception:
#         return "Unknown"


# @staff_router.post("/", response_model=EmployeeModel)
# async def create_employee(employee: EmployeeModel):
#     emp = employee.dict(exclude_unset=True)

#     email = emp.get("email")
#     phone = emp.get("phone")
#     if not email or not phone:
#         raise HTTPException(status_code=400, detail="Email and phone are required to create employee.")

#     existing = employees_collection.find_one({
#         "$or": [
#             {"email": email},
#             {"phone": phone}
#         ]
#     })
#     if existing:
#         raise HTTPException(
#             status_code=409,
#             detail="Employee with this email or phone already exists."
#         )

#     # --- Use counter to generate unique employee_id like EMP-000001 ---
#     db = employees_collection.database  # Get the database from the collection instance
#     seq_num = get_next_sequence(db, "employeeid")
#     emp_id = f"EMP-{seq_num:06d}"  # Always at least 6 digits, zero-padded
#     emp["employee_id"] = emp_id

#     result = employees_collection.insert_one(emp)
#     emp["_id"] = str(result.inserted_id)
#     return EmployeeModel(**emp)

# @staff_router.get("/", response_model=List[EmployeeModel])
# async def list_employees():
#     employees = [obj_id_to_str(e) for e in employees_collection.find()]
#     return employees

# # --- Attendance APIs ---
# @staff_router.post("/attendance", response_model=AttendanceModel)
# async def mark_attendance(
#     attendance: AttendanceModel,
#     attendance_collection=Depends(attendance_collection)
# ):
#     att = attendance.dict(exclude_unset=True)
#     result = attendance_collection.insert_one(att)
#     att["attendance_id"] = str(result.inserted_id)
#     return att

# @staff_router.get("/attendance", response_model=List[AttendanceModel])
# async def list_attendance(attendance_collection=Depends(attendance_collection)):
#     attendance = [obj_id_to_str(a) for a in attendance_collection.find()]
#     return attendance

# # --- Daily Report APIs ---
# @staff_router.post("/reports", response_model=DailyReportModel)
# async def submit_daily_report(report: DailyReportModel, daily_reports_collection=Depends(daily_reports_collection)):
#     rep = report.dict(exclude_unset=True)
#     result = daily_reports_collection.insert_one(rep)
#     rep["report_id"] = str(result.inserted_id)
#     return rep

# @staff_router.get("/reports", response_model=List[DailyReportModel])
# async def list_reports(daily_reports_collection=Depends(daily_reports_collection)):
#     reports = []
#     for r in daily_reports_collection.find():
#         report = {
#             "report_id": str(r.get("_id", "")),
#             "employee_id": r.get("employee_id") or r.get("user_id") or "",
#             "date": (
#                 r.get("date")
#                 or (r.get("report_date").strftime("%Y-%m-%d") if r.get("report_date") else "")
#             ),
#             "content": r.get("content") or r.get("remarks") or "",
#             "timestamp": r.get("timestamp") if r.get("timestamp") else None
#         }
#         reports.append(report)
#     return reports

# @staff_router.patch("/reports/{report_id}", response_model=DailyReportModel)
# async def update_report_content(
#     report_id: str = Path(..., description="Report ID"),
#     update: DailyReportUpdateModel = ...,
#     daily_reports_collection=Depends(daily_reports_collection)
# ):
#     # Validate ObjectId
#     try:
#         oid = ObjectId(report_id)
#     except Exception:
#         raise HTTPException(status_code=400, detail="Invalid report_id")

#     # Update only the content field
#     result = daily_reports_collection.update_one(
#         {"_id": oid},
#         {"$set": {"content": update.content}}
#     )

#     if result.matched_count == 0:
#         raise HTTPException(status_code=404, detail="Report not found")

#     updated = daily_reports_collection.find_one({"_id": oid})
#     if not updated:
#         raise HTTPException(status_code=404, detail="Report not found")

#     # Compose response according to DailyReportModel
#     return DailyReportModel(
#         report_id=str(updated.get("_id", "")),
#         employee_id=updated.get("employee_id") or updated.get("user_id") or "",
#         date=updated.get("date") or (
#             updated.get("report_date").strftime("%Y-%m-%d") if updated.get("report_date") else ""
#         ),
#         content=updated.get("content") or updated.get("remarks") or "",
#         timestamp=updated.get("timestamp") if updated.get("timestamp") else None
#     )


# @staff_router.post("/leave-requests", response_model=LeaveRequestModel)
# async def request_leave(
#     leave: LeaveRequestModel,
#     leave_requests_collection=Depends(leave_requests_collection)
# ):
#     # Prevent duplicate/overlapping leave requests that are still pending or approved
#     start_date = leave.start_date
#     end_date = leave.end_date

#     # Only check for pending or approved requests for overlap
#     duplicate = leave_requests_collection.find_one({
#         "employee_id": leave.employee_id,
#         "status": {"$in": ["pending", "approved"]},
#         "start_date": leave.start_date,
#         "end_date": leave.end_date
#     })
#     if duplicate:
#         raise HTTPException(
#             status_code=409,
#             detail="Duplicate leave request: an overlapping leave (pending or approved) already exists for this employee."
#         )

#     lreq = leave.dict(exclude_unset=True)
#     result = leave_requests_collection.insert_one(lreq)
#     lreq["leave_id"] = str(result.inserted_id)
#     return lreq

# @staff_router.get("/leave-requests", response_model=List[LeaveRequestModel])
# async def list_leave_requests(leave_requests_collection=Depends(leave_requests_collection)):
#     leaves = [obj_id_to_str(l) for l in leave_requests_collection.find()]
#     return leaves

# @staff_router.patch("/leave-requests/{employee_id}", response_model=LeaveRequestModel)
# async def update_leave_request(
#     employee_id: str,
#     leave: LeaveRequestUpdateModel,
#     leave_requests_collection=Depends(leave_requests_collection)
# ):
#     update_data = leave.dict(exclude_unset=True)
#     if not update_data:
#         raise HTTPException(status_code=400, detail="No fields provided for update")
#     result = leave_requests_collection.update_one({"employee_id": employee_id}, {"$set": update_data})
#     if result.matched_count == 0:
#         raise HTTPException(status_code=404, detail="Leave request not found")
#     updated_leave = leave_requests_collection.find_one({"employee_id": employee_id})
#     return obj_id_to_str(updated_leave)

# @staff_router.get("/{employee_id}/history")
# async def get_employee_history(employee_id: str,attendance_collection=Depends(attendance_collection),daily_reports_collection=Depends(daily_reports_collection),leave_requests_collection=Depends(leave_requests_collection)):
#     profile = employees_collection.find_one({"employee_id": employee_id})
#     if not profile:
#         raise HTTPException(status_code=404, detail="Employee not found")
#     profile = obj_id_to_str(profile)

#     # Correct usage:
#     attendance = [obj_id_to_str(a) for a in attendance_collection.find({"employee_id": employee_id})]
#     reports = [obj_id_to_str(r) for r in daily_reports_collection.find({"employee_id": employee_id})]
#     leaves = [obj_id_to_str(l) for l in leave_requests_collection.find({"employee_id": employee_id})]
#     # Documents (dummy/static for now)
#     documents = [
#         {"name": "Resume.pdf", "uploaded": "2023-01-01", "url": "#"},
#         {"name": "Offer Letter.pdf", "uploaded": "2023-01-02", "url": "#"},
#     ]
#     # Assets (dummy/static for now)
#     assets = [
#         {"name": "Macbook Pro", "type": "Laptop", "issued": "2023-01-02", "status": "Active"},
#         {"name": "iPhone 13", "type": "Phone", "issued": "2023-01-15", "status": "Active"},
#     ]
#     # Tabs
#     tabs = ["Personal", "Salary", "Documents", "Asset", "Leaves", "Attendance"]

#     # Compose data as expected by frontend
#     data = {
#         "name": profile.get("name"),
#         "position": profile.get("position"),
#         "id": profile.get("employee_id"),   # for frontend
#         "employee_id": profile.get("employee_id"), # for backend/consistency
#         "phone": profile.get("phone"),
#         "email": profile.get("email"),
#         "location": profile.get("location"),
#         "lastActive": get_last_active(attendance),
#         "initials": get_initials(profile.get("name", "")),
#         "tabs": tabs,
#         "generalInfo": {
#             "joiningDate": profile.get("date_of_joining", ""),
#             "accessRole": "Admin",
#             "department": profile.get("department", "Product"),
#             "shift": "9am - 5pm",
#             "flexibility": "1 hour flexibility",
#             "manager": "Akram Durrani",
#             "employment": "On-Site",
#         },
#         "contactInfo": {
#             "contractType": "Fixed term",
#             "period": "2 years",
#         },
#         "salaryInfo": {
#             "ctc": f"${int(profile.get('salary', 0)):,}",
#             "variable": "$10,000",
#             "bonus": "$5,000",
#             "lastIncrement": "Mar 2024",
#             "nextIncrement": "Mar 2025"
#         },
#         "documents": documents,
#         "assets": assets,
#         "leaves": leaves,
#         "attendance": [
#             {"date": a.get("date", ""), "status": a.get("status", "")}
#             for a in attendance
#         ]
#     }
#     return data


# from fastapi import FastAPI, HTTPException, Depends, Path, UploadFile, File, Form
# import base64
# import json, os
# from bson import Binary
# from fastapi import APIRouter
# from bson import ObjectId
# from typing import List, Optional
# from app.database.schemas.hr_staff_schema import (
#     EmployeeModel, 
#     AttendanceModel, 
#     DailyReportModel, 
#     LeaveRequestModel,
#     LeaveRequestUpdateModel,
#     DailyReportUpdateModel,
#     GeneralInfoModel,
#     ContactInfoModel,
#     SalaryInfoModel,
#     DocumentModel,
#     AssetModel
# )
# from app.database import employees_collection, attendance_collection, daily_reports_collection, leave_requests_collection

# from datetime import datetime

# staff_router = APIRouter(prefix="/api/staff", tags=["roles"])

# def clean_bytes(obj):
#     # Recursively remove bytes/Binary from dicts/lists
#     if isinstance(obj, dict):
#         return {k: clean_bytes(v) for k, v in obj.items()}
#     elif isinstance(obj, list):
#         return [clean_bytes(v) for v in obj]
#     elif isinstance(obj, (bytes, Binary)):
#         return None
#     return obj

# def obj_id_to_str(doc):
#     doc["id"] = str(doc.pop("_id"))
#     return clean_bytes(doc)

# def get_initials(name):
#     if not name: return ""
#     return "".join([n[0] for n in name.split()][:2]).upper()

# def get_next_sequence(db, name):
#     counters = db["counters"]
#     ret = counters.find_one_and_update(
#         {"_id": name},
#         {"$inc": {"seq": 1}},
#         upsert=True,
#         return_document=True
#     )
#     return ret["seq"]

# def get_last_active(attendance):
#     present_dates = [
#         a.get("date")
#         for a in attendance
#         if a.get("status", "").lower() == "present"
#     ]
#     if not present_dates:
#         return "No recent activity"
#     try:
#         last = max(present_dates)
#         last_date = datetime.strptime(last, "%Y-%m-%d")
#         days_ago = (datetime.now() - last_date).days
#         return f"{days_ago} days ago" if days_ago > 0 else "Today"
#     except Exception:
#         return "Unknown"

# @staff_router.post("/", response_model=EmployeeModel)
# async def create_employee(
#     name: str = Form(...),
#     email: str = Form(...),
#     phone: str = Form(...),
#     position: str = Form(...),
#     salary: float = Form(...),
#     location: Optional[str] = Form(None),
#     date_of_joining: str = Form(...),
#     documents: Optional[List[UploadFile]] = File(None)
# ):
#     if not email or not phone:
#         raise HTTPException(status_code=400, detail="Email and phone are required to create employee.")

#     existing = employees_collection.find_one({
#         "$or": [
#             {"email": email},
#             {"phone": phone}
#         ]
#     })
#     if existing:
#         raise HTTPException(
#             status_code=409,
#             detail="Employee with this email or phone already exists."
#         )

#     # Handle file uploads
#     upload_dir = "employee_document"
#     os.makedirs(upload_dir, exist_ok=True)
#     saved_files = []
#     for file in documents or []:
#         file_path = os.path.join(upload_dir, file.filename)
#         with open(file_path, "wb") as f:
#             f.write(await file.read())
#         # Build the document metadata as required by DocumentModel
#         saved_files.append({
#             "name": file.filename,
#             "uploaded": datetime.now().strftime("%Y-%m-%d"),
#             "url": f"/employee_document/{file.filename}"
#         })

#     # Create employee document
#     db = employees_collection.database
#     seq_num = get_next_sequence(db, "employeeid")
#     emp_id = f"EMP-{seq_num:06d}"
#     emp = {
#         "employee_id": emp_id,
#         "name": name,
#         "email": email,
#         "phone": phone,
#         "position": position,
#         "salary": salary,
#         "location": location,
#         "date_of_joining": date_of_joining,
#         "documents": saved_files
#     }

#     result = employees_collection.insert_one(emp)
#     emp["id"] = str(result.inserted_id)
#     return EmployeeModel(**emp)

# @staff_router.get("/", response_model=List[EmployeeModel])
# async def list_employees():
#     employees = [obj_id_to_str(e) for e in employees_collection.find()]
#     return employees

# # --- Attendance APIs ---
# @staff_router.post("/attendance", response_model=AttendanceModel)
# async def mark_attendance(
#     attendance: AttendanceModel,
#     attendance_collection=Depends(attendance_collection)
# ):
#     att = attendance.dict(exclude_unset=True)
#     result = attendance_collection.insert_one(att)
#     att["attendance_id"] = str(result.inserted_id)
#     return att

# @staff_router.get("/attendance", response_model=List[AttendanceModel])
# async def list_attendance(attendance_collection=Depends(attendance_collection)):
#     attendance = [obj_id_to_str(a) for a in attendance_collection.find()]
#     return attendance

# # --- Daily Report APIs ---
# @staff_router.post("/reports", response_model=DailyReportModel)
# async def submit_daily_report(report: DailyReportModel, daily_reports_collection=Depends(daily_reports_collection)):
#     rep = report.dict(exclude_unset=True)
#     result = daily_reports_collection.insert_one(rep)
#     rep["report_id"] = str(result.inserted_id)
#     return rep

# @staff_router.get("/reports", response_model=List[DailyReportModel])
# async def list_reports(daily_reports_collection=Depends(daily_reports_collection)):
#     reports = []
#     for r in daily_reports_collection.find():
#         report = {
#             "report_id": str(r.get("_id", "")),
#             "employee_id": r.get("employee_id") or r.get("user_id") or "",
#             "date": (
#                 r.get("date")
#                 or (r.get("report_date").strftime("%Y-%m-%d") if r.get("report_date") else "")
#             ),
#             "content": r.get("content") or r.get("remarks") or "",
#             "timestamp": r.get("timestamp") if r.get("timestamp") else None
#         }
#         reports.append(report)
#     return reports

# @staff_router.patch("/reports/{report_id}", response_model=DailyReportModel)
# async def update_report_content(
#     report_id: str = Path(..., description="Report ID"),
#     update: DailyReportUpdateModel = ...,
#     daily_reports_collection=Depends(daily_reports_collection)
# ):
#     # Validate ObjectId
#     try:
#         oid = ObjectId(report_id)
#     except Exception:
#         raise HTTPException(status_code=400, detail="Invalid report_id")

#     result = daily_reports_collection.update_one(
#         {"_id": oid},
#         {"$set": {"content": update.content}}
#     )

#     if result.matched_count == 0:
#         raise HTTPException(status_code=404, detail="Report not found")

#     updated = daily_reports_collection.find_one({"_id": oid})
#     if not updated:
#         raise HTTPException(status_code=404, detail="Report not found")

#     return DailyReportModel(
#         report_id=str(updated.get("_id", "")),
#         employee_id=updated.get("employee_id") or updated.get("user_id") or "",
#         date=updated.get("date") or (
#             updated.get("report_date").strftime("%Y-%m-%d") if updated.get("report_date") else ""
#         ),
#         content=updated.get("content") or updated.get("remarks") or "",
#         timestamp=updated.get("timestamp") if updated.get("timestamp") else None
#     )

# @staff_router.get("/{employee_id}/reports", response_model=List[DailyReportModel])
# async def get_employee_reports(employee_id: str, daily_reports_collection=Depends(daily_reports_collection)):
#     reports = []
#     for r in daily_reports_collection.find({"employee_id": employee_id}):
#         report = {
#             "report_id": str(r.get("_id", "")),
#             "employee_id": r.get("employee_id") or r.get("user_id") or "",
#             "date": (
#                 r.get("date")
#                 or (r.get("report_date").strftime("%Y-%m-%d") if r.get("report_date") else "")
#             ),
#             "content": r.get("content") or r.get("remarks") or "",
#             "timestamp": r.get("timestamp") if r.get("timestamp") else None
#         }
#         reports.append(report)
#     return reports


# @staff_router.post("/leave-requests", response_model=LeaveRequestModel)
# async def request_leave(
#     leave: LeaveRequestModel,
#     leave_requests_collection=Depends(leave_requests_collection)
# ):
#     start_date = leave.start_date
#     end_date = leave.end_date

#     duplicate = leave_requests_collection.find_one({
#         "employee_id": leave.employee_id,
#         "status": {"$in": ["pending", "approved"]},
#         "start_date": leave.start_date,
#         "end_date": leave.end_date
#     })
#     if duplicate:
#         raise HTTPException(
#             status_code=409,
#             detail="Duplicate leave request: an overlapping leave (pending or approved) already exists for this employee."
#         )

#     lreq = leave.dict(exclude_unset=True)
#     result = leave_requests_collection.insert_one(lreq)
#     lreq["leave_id"] = str(result.inserted_id)
#     return lreq


# @staff_router.get("/{employee_id}/attendance", response_model=List[AttendanceModel])
# async def get_employee_attendance(employee_id: str, attendance_collection=Depends(attendance_collection)):
#     attendance = [obj_id_to_str(a) for a in attendance_collection.find({"employee_id": employee_id})]
#     return attendance

# @staff_router.get("/leave-requests", response_model=List[LeaveRequestModel])
# async def list_leave_requests(leave_requests_collection=Depends(leave_requests_collection)):
#     leaves = [obj_id_to_str(l) for l in leave_requests_collection.find()]
#     return leaves

# @staff_router.patch("/leave-requests/{employee_id}", response_model=LeaveRequestModel)
# async def update_leave_request(
#     employee_id: str,
#     leave: LeaveRequestUpdateModel,
#     leave_requests_collection=Depends(leave_requests_collection)
# ):
#     update_data = leave.dict(exclude_unset=True)
#     if not update_data:
#         raise HTTPException(status_code=400, detail="No fields provided for update")
#     result = leave_requests_collection.update_one({"employee_id": employee_id}, {"$set": update_data})
#     if result.matched_count == 0:
#         raise HTTPException(status_code=404, detail="Leave request not found")
#     updated_leave = leave_requests_collection.find_one({"employee_id": employee_id})
#     return obj_id_to_str(updated_leave)

# @staff_router.get("/{employee_id}/leave-requests", response_model=List[LeaveRequestModel])
# async def get_employee_leaves(employee_id: str, leave_requests_collection=Depends(leave_requests_collection)):
#     leaves = [obj_id_to_str(l) for l in leave_requests_collection.find({"employee_id": employee_id})]
#     return leaves

# @staff_router.get("/{employee_id}/history", response_model=EmployeeModel)
# async def get_employee_history(
#     employee_id: str,
#     attendance_collection=Depends(attendance_collection),
#     daily_reports_collection=Depends(daily_reports_collection),
#     leave_requests_collection=Depends(leave_requests_collection)
# ):
#     profile = employees_collection.find_one({"employee_id": employee_id})
#     if not profile:
#         raise HTTPException(status_code=404, detail="Employee not found")
#     profile = obj_id_to_str(profile)

#     attendance = [obj_id_to_str(a) for a in attendance_collection.find({"employee_id": employee_id})]
#     leaves = [obj_id_to_str(l) for l in leave_requests_collection.find({"employee_id": employee_id})]
#     documents = profile.get("documents", [
#         {"name": "Resume.pdf", "uploaded": "2023-01-01", "url": "#"},
#         {"name": "Offer Letter.pdf", "uploaded": "2023-01-02", "url": "#"},
#     ])
#     assets = [
#         {"name": "Macbook Pro", "type": "Laptop", "issued": "2023-01-02", "status": "Active"},
#         {"name": "iPhone 13", "type": "Phone", "issued": "2023-01-15", "status": "Active"},
#     ]
#     tabs = ["Personal", "Salary", "Documents", "Asset", "Leaves", "Attendance"]

#     data = EmployeeModel(
#         name=profile.get("name"),
#         position=profile.get("position"),
#         employee_id=profile.get("employee_id"),
#         phone=profile.get("phone"),
#         email=profile.get("email"),
#         location=profile.get("location"),
#         lastActive=get_last_active(attendance),
#         initials=get_initials(profile.get("name", "")),
#         tabs=tabs,
#         generalInfo=GeneralInfoModel(
#             joiningDate=profile.get("date_of_joining", ""),
#             accessRole="Admin",
#             department=profile.get("department", "Product"),
#             shift="9am - 5pm",
#             flexibility="1 hour flexibility",
#             manager="Akram Durrani",
#             employment="On-Site"
#         ),
#         contactInfo=ContactInfoModel(
#             contractType="Fixed term",
#             period="2 years"
#         ),
#         salaryInfo=SalaryInfoModel(
#             ctc=f"${int(profile.get('salary', 0)):,}",
#             variable="$10,000",
#             bonus="$5,000",
#             lastIncrement="Mar 2024",
#             nextIncrement="Mar 2025"
#         ),
#         documents=[DocumentModel(**doc) for doc in documents],
#         assets=[AssetModel(**asset) for asset in assets],
#         leaves=[LeaveRequestModel(**l) for l in leaves],
#         attendance=[
#             AttendanceModel(
#                 attendance_id=a.get("attendance_id"),
#                 employee_id=a.get("employee_id"),
#                 date=a.get("date", ""),
#                 status=a.get("status", ""),
#                 geo_lat=a.get("geo_lat"),
#                 geo_long=a.get("geo_long"),
#                 location=a.get("location"),
#                 timestamp=a.get("timestamp", datetime.now())
#             )
#             for a in attendance
#         ]
#     )
#     return data



from fastapi import FastAPI, HTTPException, Depends, Path, UploadFile, File, Form, APIRouter, Body
import os
from bson import Binary, ObjectId
from typing import List, Optional
from app.database.schemas.hr_staff_schema import (
    EmployeeModel, AttendanceModel, DailyReportModel, LeaveRequestModel,
    LeaveRequestUpdateModel, DailyReportUpdateModel, GeneralInfoModel,
    ContactInfoModel, SalaryInfoModel, DocumentModel, AssetModel
)
from app.database import employees_collection, attendance_collection, daily_reports_collection, leave_requests_collection
from datetime import datetime

staff_router = APIRouter(prefix="/api/staff", tags=["roles"])

def clean_bytes(obj):
    if isinstance(obj, dict):
        return {k: clean_bytes(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_bytes(v) for v in obj]
    elif isinstance(obj, (bytes, Binary)):
        return None
    return obj

def obj_id_to_str(doc):
    doc["id"] = str(doc.pop("_id"))
    return clean_bytes(doc)

def get_initials(name):
    if not name: return ""
    return "".join([n[0] for n in name.split()][:2]).upper()

def get_next_sequence(db, name):
    counters = db["counters"]
    ret = counters.find_one_and_update(
        {"_id": name},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    return ret["seq"]

def get_last_active(attendance):
    present_dates = [
        a.get("date")
        for a in attendance
        if a.get("status", "").lower() == "present"
    ]
    if not present_dates:
        return "No recent activity"
    try:
        last = max(present_dates)
        last_date = datetime.strptime(last, "%Y-%m-%d")
        days_ago = (datetime.now() - last_date).days
        return f"{days_ago} days ago" if days_ago > 0 else "Today"
    except Exception:
        return "Unknown"

# --- Employee CRUD ---
@staff_router.post("/", response_model=EmployeeModel)
async def create_employee(
    name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    position: str = Form(...),
    salary: float = Form(...),
    location: Optional[str] = Form(...),
    date_of_joining: str = Form(...),
    shift:str=Form(...),
    gender: Optional[str] = Form(...),
    documents: Optional[List[UploadFile]] = File(...)
):
    if not email or not phone:
        raise HTTPException(status_code=400, detail="Email and phone are required to create employee.")
    existing = employees_collection.find_one({
        "$or": [
            {"email": email},
            {"phone": phone}
        ]
    })
    if existing:
        raise HTTPException(
            status_code=409,
            detail="Employee with this email or phone already exists."
        )
    upload_dir = "employee_document"
    os.makedirs(upload_dir, exist_ok=True)
    saved_files = []
    for file in documents or []:
        file_path = os.path.join(upload_dir, file.filename)
        with open(file_path, "wb") as f:
            f.write(await file.read())
        saved_files.append({
            "name": file.filename,
            "uploaded": datetime.now().strftime("%Y-%m-%d"),
            "url": f"/employee_document/{file.filename}"
        })
    db = employees_collection.database
    seq_num = get_next_sequence(db, "employeeid")
    emp_id = f"EMP-{seq_num:06d}"
    emp = {
        "employee_id": emp_id,
        "name": name,
        "email": email,
        "phone": phone,
        "position": position,
        "salary": salary,
        "location": location,
        "date_of_joining": date_of_joining,
        "shift": shift,
        "gender": gender,
        "documents": saved_files
    }
    result = employees_collection.insert_one(emp)
    emp["id"] = str(result.inserted_id)
    return EmployeeModel(**emp)

@staff_router.get("/", response_model=List[EmployeeModel])
async def list_employees():
    employees = [obj_id_to_str(e) for e in employees_collection.find()]
    return employees

# --- Attendance APIs ---
@staff_router.post("/attendance", response_model=AttendanceModel)
async def mark_attendance(
    attendance: AttendanceModel,
    attendance_collection=Depends(attendance_collection)
):
    att = attendance.dict(exclude_unset=True)
    result = attendance_collection.insert_one(att)
    att["attendance_id"] = str(result.inserted_id)
    return att

@staff_router.get("/attendance", response_model=List[AttendanceModel])
async def list_attendance(attendance_collection=Depends(attendance_collection)):
    attendance = [obj_id_to_str(a) for a in attendance_collection.find()]
    return attendance

@staff_router.get("/{employee_id}/attendance", response_model=List[AttendanceModel])
async def get_employee_attendance(employee_id: str, attendance_collection=Depends(attendance_collection)):
    attendance = [obj_id_to_str(a) for a in attendance_collection.find({"employee_id": employee_id})]
    return attendance

# --- Reports APIs ---
@staff_router.post("/reports", response_model=DailyReportModel)
async def submit_daily_report(report: DailyReportModel, daily_reports_collection=Depends(daily_reports_collection)):
    rep = report.dict(exclude_unset=True)
    result = daily_reports_collection.insert_one(rep)
    rep["report_id"] = str(result.inserted_id)
    return rep

@staff_router.get("/reports", response_model=List[DailyReportModel])
async def list_reports(daily_reports_collection=Depends(daily_reports_collection)):
    reports = []
    for r in daily_reports_collection.find():
        report = {
            "report_id": str(r.get("_id", "")),
            "employee_id": r.get("employee_id") or r.get("user_id") or "",
            "date": (
                r.get("date")
                or (r.get("report_date").strftime("%Y-%m-%d") if r.get("report_date") else "")
            ),
            "content": r.get("content") or r.get("remarks") or "",
            "timestamp": r.get("timestamp") if r.get("timestamp") else None
        }
        reports.append(report)
    return reports

@staff_router.get("/{employee_id}/reports", response_model=List[DailyReportModel])
async def get_employee_reports(employee_id: str, daily_reports_collection=Depends(daily_reports_collection)):
    reports = []
    for r in daily_reports_collection.find({"employee_id": employee_id}):
        report = {
            "report_id": str(r.get("_id", "")),
            "employee_id": r.get("employee_id") or r.get("user_id") or "",
            "date": (
                r.get("date")
                or (r.get("report_date").strftime("%Y-%m-%d") if r.get("report_date") else "")
            ),
            "content": r.get("content") or r.get("remarks") or "",
            "timestamp": r.get("timestamp") if r.get("timestamp") else None
        }
        reports.append(report)
    return reports

@staff_router.patch("/reports/{report_id}", response_model=DailyReportModel)
async def update_report_content(
    report_id: str = Path(..., description="Report ID"),
    update: DailyReportUpdateModel = ...,
    daily_reports_collection=Depends(daily_reports_collection)
):
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid report_id")
    result = daily_reports_collection.update_one(
        {"_id": oid},
        {"$set": {"content": update.content}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    updated = daily_reports_collection.find_one({"_id": oid})
    if not updated:
        raise HTTPException(status_code=404, detail="Report not found")
    return DailyReportModel(
        report_id=str(updated.get("_id", "")),
        employee_id=updated.get("employee_id") or updated.get("user_id") or "",
        date=updated.get("date") or (
            updated.get("report_date").strftime("%Y-%m-%d") if updated.get("report_date") else ""
        ),
        content=updated.get("content") or updated.get("remarks") or "",
        timestamp=updated.get("timestamp") if updated.get("timestamp") else None
    )

# --- Leave Request APIs ---

def clean_mongo_document(doc, id_field="leave_id"):
    if not doc:
        return None
    doc = dict(doc)
    # Remove all _id and make it string
    if "_id" in doc:
        doc[id_field] = str(doc.pop("_id"))
    # Remove any bytes/Binary fields if present
    for k, v in doc.items():
        if isinstance(v, (bytes, Binary)):
            doc[k] = None
    return doc


# @staff_router.post("/leave-requests", response_model=LeaveRequestModel)
# async def request_leave(
#     leave: LeaveRequestModel,
#     leave_requests_collection=Depends(leave_requests_collection)
# ):
#     start_date = leave.start_date
#     end_date = leave.end_date
#     duplicate = leave_requests_collection.find_one({
#         "employee_id": leave.employee_id,
#         "status": {"$in": ["pending", "approved"]},
#         "start_date": leave.start_date,
#         "end_date": leave.end_date
#     })
#     if duplicate:
#         raise HTTPException(
#             status_code=409,
#             detail="Duplicate leave request: an overlapping leave (pending or approved) already exists for this employee."
#         )
#     lreq = leave.dict(exclude_unset=True)
#     result = leave_requests_collection.insert_one(lreq)
#     lreq["leave_id"] = str(result.inserted_id)
#     return lreq

@staff_router.post("/leave-requests", response_model=LeaveRequestModel)
async def request_leave(
    leave: LeaveRequestModel,
    leave_requests_collection=Depends(leave_requests_collection)
):
    # ... your duplicate check ...
    lreq = leave.dict(exclude_unset=True)
    result = leave_requests_collection.insert_one(lreq)
    mongo_doc = leave_requests_collection.find_one({"_id": result.inserted_id})
    clean_doc = clean_mongo_document(mongo_doc, id_field="leave_id")
    return LeaveRequestModel(**clean_doc)

# @staff_router.get("/leave-requests", response_model=List[LeaveRequestModel])
# async def list_leave_requests(leave_requests_collection=Depends(leave_requests_collection)):
#     leaves = [obj_id_to_str(l) for l in leave_requests_collection.find()]
#     return leaves

@staff_router.get("/leave-requests", response_model=List[LeaveRequestModel])
async def list_leave_requests(leave_requests_collection=Depends(leave_requests_collection)):
    leaves = []
    for l in leave_requests_collection.find():
        clean_doc = clean_mongo_document(l, id_field="leave_id")
        # Only add if all required fields present
        try:
            leaves.append(LeaveRequestModel(**clean_doc))
        except Exception as e:
            print("Invalid leave record skipped:", clean_doc, e)
    return leaves

@staff_router.get("/{employee_id}/leave-requests", response_model=List[LeaveRequestModel])
async def get_employee_leaves(employee_id: str, leave_requests_collection=Depends(leave_requests_collection)):
    leaves = [obj_id_to_str(l) for l in leave_requests_collection.find({"employee_id": employee_id})]
    return leaves

@staff_router.patch("/leave-requests/{employee_id}", response_model=LeaveRequestModel)
async def update_leave_request(
    employee_id: str,
    leave: LeaveRequestUpdateModel,
    leave_requests_collection=Depends(leave_requests_collection)
):
    update_data = leave.dict(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided for update")
    result = leave_requests_collection.update_one({"employee_id": employee_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Leave request not found")
    updated_leave = leave_requests_collection.find_one({"employee_id": employee_id})
    return obj_id_to_str(updated_leave)


def safe_model_cast(model, data):
    # Removes extra fields and avoids double-wrapping Pydantic models
    if isinstance(data, model):
        return data
    if isinstance(data, dict):
        try:
            return model.model_validate(data)  # Pydantic v2
        except Exception:
            # fallback for v1
            return model(**{k: v for k, v in data.items() if k in model.model_fields})
    raise ValueError("Cannot cast to model")


# @staff_router.get("/{employee_id}/history", response_model=EmployeeModel)
# async def get_employee_history(
#     employee_id: str,
#     attendance_collection=Depends(attendance_collection),
#     daily_reports_collection=Depends(daily_reports_collection),
#     leave_requests_collection=Depends(leave_requests_collection)
# ):
#     profile = employees_collection.find_one({"employee_id": employee_id})
#     if not profile:
#         raise HTTPException(status_code=404, detail="Employee not found")
#     profile = obj_id_to_str(profile)

#     attendance_raw = [obj_id_to_str(a) for a in attendance_collection.find({"employee_id": employee_id})]
#     leaves_raw = [obj_id_to_str(l) for l in leave_requests_collection.find({"employee_id": employee_id})]
#     documents = profile.get("documents", [])
#     assets = [
#         {"name": "Macbook Pro", "type": "Laptop", "issued": "2023-01-02", "status": "Active"},
#         {"name": "iPhone 13", "type": "Phone", "issued": "2023-01-15", "status": "Active"},
#     ]
#     tabs = ["Personal", "Salary", "Documents", "Asset", "Leaves", "Attendance"]

#     # Defensive model creation with logging
#     valid_leaves = []
#     for i, l in enumerate(leaves_raw):
#         try:
#             # Validate that the data can be converted to LeaveRequestModel
#             # but store as dict for EmployeeModel to convert later
#             if isinstance(l, dict):
#                 LeaveRequestModel(**l)  # Just validate, don't store the instance
#                 valid_leaves.append(l)  # Store the original dict
#             else:
#                 print(f"Leave record {i} is not a dict: {type(l)} - {l}")
#         except Exception as e:
#             print(f"Invalid leave record {i} skipped:", l)
#             print("Error:", e)

#     valid_attendance = []
#     for i, a in enumerate(attendance_raw):
#         try:
#             # Validate that the data can be converted to AttendanceModel
#             # but store as dict for EmployeeModel to convert later
#             if isinstance(a, dict):
#                 AttendanceModel(**a)  # Just validate, don't store the instance
#                 valid_attendance.append(a)  # Store the original dict
#             else:
#                 print(f"Attendance record {i} is not a dict: {type(a)} - {a}")
#         except Exception as e:
#             print(f"Invalid attendance record {i} skipped:", a)
#             print("Error:", e)
    
#     # Additional validation for documents and assets
#     valid_documents = []
#     for i, doc in enumerate(documents):
#         try:
#             if isinstance(doc, dict):
#                 DocumentModel(**doc)  # Just validate
#                 valid_documents.append(doc)
#             else:
#                 print(f"Document {i} is not a dict: {type(doc)} - {doc}")
#         except Exception as e:
#             print(f"Invalid document {i} skipped:", doc)
#             print("Error:", e)
    
#     valid_assets = []
#     for i, asset in enumerate(assets):
#         try:
#             if isinstance(asset, dict):
#                 AssetModel(**asset)  # Just validate
#                 valid_assets.append(asset)
#             else:
#                 print(f"Asset {i} is not a dict: {type(asset)} - {asset}")
#         except Exception as e:
#             print(f"Invalid asset {i} skipped:", asset)
#             print("Error:", e)

#     print(f"Creating EmployeeModel for {employee_id}")
#     print(f"Valid leaves count: {len(valid_leaves)}")
#     print(f"Valid attendance count: {len(valid_attendance)}")
#     print(f"Valid documents count: {len(valid_documents)}")
#     print(f"Valid assets count: {len(valid_assets)}")
    
#     try:
#         data = EmployeeModel(
#             name=profile.get("name"),
#             position=profile.get("position"),
#             employee_id=profile.get("employee_id"),
#             phone=profile.get("phone"),
#             email=profile.get("email"),
#             location=profile.get("location"),
#             lastActive=get_last_active(attendance_raw),
#             initials=get_initials(profile.get("name", "")),
#             tabs=tabs,
#             generalInfo=GeneralInfoModel(
#                 joiningDate=profile.get("date_of_joining", ""),
#                 accessRole="Admin",
#                 department=profile.get("department", "Product"),
#                 shift="9am - 5pm",
#                 flexibility="1 hour flexibility",
#                 manager="Akram Durrani",
#                 employment="On-Site"
#             ),
#             contactInfo=ContactInfoModel(
#                 contractType="Fixed term",
#                 period="2 years"
#             ),
#             salaryInfo=SalaryInfoModel(
#                 ctc=f"{int(profile.get('salary', 0)):,}",
#                 variable="10,000",
#                 bonus="5,000",
#                 lastIncrement="Mar 2024",
#                 nextIncrement="Mar 2025"
#             ),
#             documents=valid_documents,  # Use validated documents
#             assets=valid_assets,        # Use validated assets
#             leaves=valid_leaves,
#             attendance=valid_attendance,
#         )
#         print("EmployeeModel created successfully")
#         return data
#     except Exception as e:
#         print(f"Error creating EmployeeModel: {e}")
#         print(f"Error type: {type(e)}")
#         import traceback
#         traceback.print_exc()
#         raise

@staff_router.get("/{employee_id}/history")
async def get_employee_history(
    employee_id: str,
    attendance_collection=Depends(attendance_collection),
    leave_requests_collection=Depends(leave_requests_collection)
):
    profile = employees_collection.find_one({"employee_id": employee_id})
    if not profile:
        raise HTTPException(status_code=404, detail="Employee not found")
    profile = obj_id_to_str(profile)

    attendance_raw = [obj_id_to_str(a) for a in attendance_collection.find({"employee_id": employee_id})]
    leaves_raw = [obj_id_to_str(l) for l in leave_requests_collection.find({"employee_id": employee_id})]
    documents = profile.get("documents", [])
    assets = profile.get("assets", [])

    # Only return database fields
    result = {
        "employee_id": profile.get("employee_id"),
        "name": profile.get("name"),
        "email": profile.get("email"),
        "phone": profile.get("phone"),
        "position": profile.get("position"),
        "salary": profile.get("salary"),
        "location": profile.get("location"),
        "date_of_joining": profile.get("date_of_joining"),
        "shift": profile.get("shift"),
        "gender": profile.get("gender"),
        "documents": documents,
        "assets": assets,
        "leaves": leaves_raw,
        "attendance": attendance_raw
    }
    return result    



@staff_router.patch("/{employee_id}", response_model=EmployeeModel)
async def update_employee_general(
    employee_id: str,
    data: dict = Body(...),  # Accepts arbitrary fields to update
):
    existing = employees_collection.find_one({"employee_id": employee_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Employee not found")
    # Remove keys that shouldn't be updated directly
    data.pop("employee_id", None)
    data.pop("id", None)
    # Update the record
    result = employees_collection.update_one(
        {"employee_id": employee_id},
        {"$set": data}
    )
    # Return updated document
    updated = employees_collection.find_one({"employee_id": employee_id})
    if not updated:
        raise HTTPException(status_code=404, detail="Employee not found after update")
    updated["id"] = str(updated.pop("_id"))
    return EmployeeModel(**updated)