from typing import Any, Dict, Iterable, List


def _perm(key: str, label: str, group: str) -> Dict[str, Any]:
    return {"id": key, "key": key, "label": label, "group": group}


MODULE_PERMISSIONS: List[Dict[str, Any]] = [
    _perm("dashboard", "Dashboard", "Core"),
    _perm("appointments", "Appointments", "Patient Care"),
    _perm("patients", "Patient Management", "Patient Care"),
    _perm("reception", "Reception", "Patient Care"),
    _perm("patient_registration", "Patient Registration", "Patient Care"),
    _perm("patient_portal", "Patient Portal", "Patient Care"),
    _perm("opd", "OPD Management", "Patient Care"),
    _perm("ipd", "IPD / Ward", "Patient Care"),
    _perm("doctors", "Doctors", "Clinical"),
    _perm("doctor_roster", "Doctor Roster", "Clinical"),
    _perm("departments", "Departments", "Clinical"),
    _perm("emr", "EMR / Prescriptions", "Clinical"),
    _perm("nursing", "Nursing Station", "Clinical"),
    _perm("ot", "OT Management", "Clinical"),
    _perm("teleconsult", "Teleconsultation", "Clinical"),
    _perm("pharmacy", "Pharmacy", "Operations"),
    _perm("laboratory", "Laboratory", "Diagnostics"),
    _perm("radiology", "Radiology", "Diagnostics"),
    _perm("blood_bank", "Blood Bank", "Diagnostics"),
    _perm("billing", "Billing & Revenue", "Finance"),
    _perm("insurance", "Insurance / TPA", "Finance"),
    _perm("certificates", "Certificates", "Records"),
    _perm("hr", "HR & Staff", "Administration"),
    _perm("staff_management", "Staff Management", "Administration"),
    _perm("attendance", "My Attendance", "Administration"),
    _perm("leave_requests", "Leave Requests", "Administration"),
    _perm("inventory", "Stock Management", "Administration"),
    _perm("reports", "MIS Reports", "Administration"),
    _perm("analytics", "Analytics", "Administration"),
    _perm("users", "Users", "Administration"),
    _perm("roles", "Roles & Permissions", "Administration"),
    _perm("hospitals", "Hospitals", "Administration"),
    _perm("super_admin", "Super Admin", "Administration"),
]

MODULE_KEYS = {item["key"] for item in MODULE_PERMISSIONS}
PERMISSION_ALIASES = {
    "teleconsultation": "teleconsult",
    "hr_staff": "staff_management",
    "staff": "staff_management",
    "stock": "inventory",
    "lab": "laboratory",
    "ward": "ipd",
    "hospital": "hospitals",
}


def module_from_permission(permission: str) -> str:
    value = str(permission or "").strip().lower()
    if not value:
        return ""
    if ":" in value:
        value = value.split(":", 1)[0]
    if value.startswith("manage_"):
        value = value[7:]
    return PERMISSION_ALIASES.get(value, value)


def clean_module_permissions(permissions: Iterable[str]) -> List[str]:
    cleaned = []
    seen = set()
    for permission in permissions or []:
        key = module_from_permission(permission)
        if key in MODULE_KEYS and key not in seen:
            seen.add(key)
            cleaned.append(key)
    return cleaned
