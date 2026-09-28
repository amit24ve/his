from datetime import datetime, timedelta

def check_sla(ticket, sla_hours=48):
    if ticket["status"] != "closed":
        created_at = ticket["created_at"]
        deadline = created_at + timedelta(hours=sla_hours)
        now = datetime.now()
        if now > deadline:
            return False  # SLA violated
    return True  