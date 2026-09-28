from app.database.repositories.followup_repository import fetch_upcoming_reminders, mark_reminder_sent,followups_collection
from app.database import users_collection
from datetime import datetime
from app.utils.timezone_utils import get_ist_now
import smtplib  # Or use your email/push system
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# def send_email(to_email, subject, message):
#     # Implement your mail sending logic here (e.g., SMTP, Sendgrid, etc.)
#     pass
def send_email(to_email, subject, message, from_email="noreply@yourdomain.com", smtp_server="localhost", smtp_port=25, smtp_user=None, smtp_pass=None, use_tls=False):
    """
    Send an email using SMTP.

    :param to_email: Recipient's email address
    :param subject: Email subject line
    :param message: Email body (plain text)
    :param from_email: Sender's email address (default: noreply@yourdomain.com)
    :param smtp_server: SMTP server host (default: localhost)
    :param smtp_port: SMTP server port (default: 25)
    :param smtp_user: SMTP username (if authentication is needed)
    :param smtp_pass: SMTP password (if authentication is needed)
    :param use_tls: Whether to use TLS (default: False)
    """
    # Create the message
    msg = MIMEMultipart()
    msg['From'] = from_email
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(message, 'plain'))

    try:
        server = smtplib.SMTP(smtp_server, smtp_port, timeout=10)
        if use_tls:
            server.starttls()
        if smtp_user and smtp_pass:
            server.login(smtp_user, smtp_pass)
        server.send_message(msg)
        server.quit()
        print(f"Email sent to {to_email}")
        return True
    except Exception as e:
        print(f"Failed to send email to {to_email}: {e}")
        return False

def send_reminder_notification(reminder):
    user = users_collection.find_one({"id": reminder["assigned_to"]})
    if user and user.get("email"):
        subject = "CRM Follow-up Reminder"
        message = f"Reminder for lead {reminder['lead_id']}: {reminder['note']}\nDue at: {reminder['reminder_time']}"
        send_email(user["email"], subject, message)

def process_reminders():
    # This function could be scheduled to run every X minutes
    now = get_ist_now()
    due_reminders = list(followups_collection.find({
        "reminder_time": {"$lte": now},
        "sent": False
    }))
    for reminder in due_reminders:
        send_reminder_notification(reminder)
        mark_reminder_sent(reminder["id"])