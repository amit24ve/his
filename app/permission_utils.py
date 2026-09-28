from typing import List, Dict, Any

MODULE_PERMISSIONS: List[Dict[str, Any]] = [
    {"id": "dashboard", "label": "Dashboard", "group": "Overview"},
    {"id": "appointments", "label": "Appointments", "group": "Clinical"},
    {"id": "reception", "label": "Reception", "group": "Clinical"},
    {"id": "patient_registration", "label": "Patient Registration", "group": "Clinical"},
    {"id": "patient_portal", "label": "Patient Portal", "group": "Clinical"},
    {"id": "opd", "label": "OPD Management", "group": "Clinical"},
    {"id": "ipd", "label": "IPD & Ward", "group": "Clinical"},
    {"id": "emr", "label": "EMR (Electronic Records)", "group": "Clinical"},
    {"id": "nursing", "label": "Nursing Station", "group": "Clinical"},
    {"id": "ot", "label": "OT Management", "group": "Clinical"},
    {"id": "teleconsultation", "label": "Teleconsultation", "group": "Clinical"},
    {"id": "pharmacy", "label": "Pharmacy", "group": "Diagnostics & Support"},
    {"id": "laboratory", "label": "Laboratory", "group": "Diagnostics & Support"},
    {"id": "radiology", "label": "Radiology", "group": "Diagnostics & Support"},
    {"id": "blood_bank", "label": "Blood Bank", "group": "Diagnostics & Support"},
    {"id": "billing", "label": "Billing & Revenue", "group": "Billing & Financial"},
    {"id": "insurance", "label": "Insurance & TPA", "group": "Billing & Financial"},
    {"id": "certificates", "label": "Certificates", "group": "Hospital Admin"},
    {"id": "doctors", "label": "Doctor Management", "group": "Hospital Admin"},
    {"id": "departments", "label": "Departments", "group": "Hospital Admin"},
    {"id": "leads", "label": "Leads CRM", "group": "CRM & Operations"},
    {"id": "assigned_leads", "label": "Assigned Leads", "group": "CRM & Operations"},
    {"id": "customers", "label": "Customers", "group": "CRM & Operations"},
    {"id": "loyalty", "label": "Loyalty & Rewards", "group": "CRM & Operations"},
    {"id": "franchise", "label": "Franchise Management", "group": "CRM & Operations"},
    {"id": "hr_staff", "label": "HR & Staff", "group": "Human Resources"},
    {"id": "attendance", "label": "Attendance", "group": "Human Resources"},
    {"id": "leave_requests", "label": "Leave Requests", "group": "Human Resources"},
    {"id": "inventory", "label": "Stock & Inventory", "group": "Logistics"},
    {"id": "reports", "label": "Reports & Analytics", "group": "Analytics"},
    {"id": "tasks", "label": "Task Manager", "group": "Tools"},
    {"id": "tickets", "label": "Support Tickets", "group": "Tools"},
    {"id": "documents", "label": "Documents", "group": "Tools"},
    {"id": "users", "label": "Users Management", "group": "System"},
    {"id": "roles", "label": "Roles & Permissions", "group": "System"},
    {"id": "hospitals", "label": "Hospital Profile", "group": "System"},
    {"id": "hierarchy", "label": "Hierarchy", "group": "System"},
    {"id": "notes", "label": "Notes", "group": "Tools"},
    {"id": "followup", "label": "Follow-ups", "group": "CRM & Operations"},
]

def clean_module_permissions(permissions: List[str]) -> List[str]:
    """Clean and filter module permissions against allowed list or return cleaned array"""
    valid_ids = {p["id"] for p in MODULE_PERMISSIONS}
    return [p.strip() for p in permissions if isinstance(p, str) and (p.strip() in valid_ids or ":" in p or p == "*")]
