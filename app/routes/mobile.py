from fastapi import APIRouter, Depends, Body, HTTPException
from app.database.schemas.mobile_schema import LeadEntry, AttendanceCheckIn, DailyReport, NotificationRequest
from app.database import leads_collection, attendance_collection, daily_reports_collection, users_collection
import requests
import os

mobile_router = APIRouter(prefix="/api/mobile", tags=["mobile"])
# ---------- Lead Entry ----------
@mobile_router.post("/lead-entry")
async def lead_entry(lead: LeadEntry, collection=Depends(leads_collection)):
    collection.insert_one(lead.dict())
    return {"status": "success", "msg": "Lead saved"}

# ---------- Attendance Check-In ----------
@mobile_router.post("/attendance/checkin")
async def attendance_checkin(att: AttendanceCheckIn, collection=Depends(attendance_collection)):
    collection.insert_one(att.dict())
    return {"status": "success", "msg": "Attendance marked"}

# ---------- Daily Reporting ----------
@mobile_router.post("/daily-report")
async def daily_report(report: DailyReport, collection=Depends(daily_reports_collection)):
    collection.insert_one(report.dict())
    return {"status": "success", "msg": "Report submitted"}

# ---------- Push Notifications via FCM ----------
FCM_SERVER_KEY = os.getenv("FCM_SERVER_KEY")

def send_push_notification(token: str, title: str, body: str, data: dict):
    url = "https://fcm.googleapis.com/fcm/send"
    headers = {
        "Authorization": f"key={FCM_SERVER_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "to": token,
        "notification": {"title": title, "body": body},
        "data": data,
        "priority": "high"
    }
    response = requests.post(url, json=payload, headers=headers)
    return response.json()

@mobile_router.post("/push-notification")
async def push_notification(
    req: NotificationRequest,
    user_col=Depends(users_collection)
):
    if not FCM_SERVER_KEY:
        raise HTTPException(status_code=500, detail="FCM server key not configured")
    # Assume users_collection stores user_id and FCM token
    users = user_col.find({"user_id": {"$in": req.user_ids}})
    tokens = [u.get("fcm_token") for u in users if u.get("fcm_token")]
    results = []
    for token in tokens:
        res = send_push_notification(token, req.title, req.message, req.data or {})
        results.append(res)
    return {"status": "sent", "results": results}