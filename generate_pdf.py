#!/usr/bin/env python3
"""
CubeMed HIS - Complete UI Documentation PDF Generator
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import (
    HexColor, white, black, Color
)
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus.flowables import Flowable
import datetime

# ── Color Palette ──────────────────────────────────────────────────────────────
DARK_NAVY   = HexColor('#0f172a')
NAVY        = HexColor('#1e293b')
SLATE       = HexColor('#334155')
BLUE_600    = HexColor('#2563eb')
BLUE_400    = HexColor('#60a5fa')
TEAL_500    = HexColor('#14b8a6')
TEAL_100    = HexColor('#ccfbf1')
GRAY_50     = HexColor('#f8fafc')
GRAY_100    = HexColor('#f1f5f9')
GRAY_200    = HexColor('#e2e8f0')
GRAY_500    = HexColor('#64748b')
GRAY_700    = HexColor('#374151')
GREEN_600   = HexColor('#16a34a')
GREEN_100   = HexColor('#dcfce7')
ORANGE_600  = HexColor('#ea580c')
ORANGE_100  = HexColor('#ffedd5')
RED_600     = HexColor('#dc2626')
RED_100     = HexColor('#fee2e2')
PURPLE_600  = HexColor('#9333ea')
PURPLE_100  = HexColor('#f3e8ff')
INDIGO_600  = HexColor('#4f46e5')
YELLOW_600  = HexColor('#ca8a04')
YELLOW_100  = HexColor('#fef9c3')

OUTPUT_PATH = '/www/wwwroot/HIS/CubeMed_HIS_Documentation.pdf'

# ── Custom Flowables ───────────────────────────────────────────────────────────
class ColoredRect(Flowable):
    def __init__(self, width, height, color, radius=4):
        super().__init__()
        self.width = width
        self.height = height
        self.color = color
        self.radius = radius

    def draw(self):
        self.canv.setFillColor(self.color)
        self.canv.roundRect(0, 0, self.width, self.height, self.radius, fill=1, stroke=0)


class SectionBadge(Flowable):
    """Colored badge/tag for section headings."""
    def __init__(self, text, bg_color, text_color=white, width=None):
        super().__init__()
        self.text = text
        self.bg_color = bg_color
        self.text_color = text_color
        self.width = width or (len(text) * 7 + 24)
        self.height = 20

    def draw(self):
        c = self.canv
        c.setFillColor(self.bg_color)
        c.roundRect(0, 2, self.width, 16, 4, fill=1, stroke=0)
        c.setFillColor(self.text_color)
        c.setFont('Helvetica-Bold', 8)
        c.drawCentredString(self.width / 2, 6, self.text)


# ── Style Definitions ──────────────────────────────────────────────────────────
def make_styles():
    base = getSampleStyleSheet()

    styles = {
        'cover_title': ParagraphStyle(
            'cover_title', fontSize=32, fontName='Helvetica-Bold',
            textColor=white, alignment=TA_CENTER, spaceAfter=6, leading=38
        ),
        'cover_subtitle': ParagraphStyle(
            'cover_subtitle', fontSize=14, fontName='Helvetica',
            textColor=BLUE_400, alignment=TA_CENTER, spaceAfter=4, leading=18
        ),
        'cover_meta': ParagraphStyle(
            'cover_meta', fontSize=10, fontName='Helvetica',
            textColor=GRAY_500, alignment=TA_CENTER, spaceAfter=2, leading=14
        ),
        'toc_title': ParagraphStyle(
            'toc_title', fontSize=22, fontName='Helvetica-Bold',
            textColor=DARK_NAVY, spaceAfter=10, leading=26
        ),
        'toc_chapter': ParagraphStyle(
            'toc_chapter', fontSize=12, fontName='Helvetica-Bold',
            textColor=BLUE_600, spaceBefore=6, spaceAfter=2, leading=16,
            leftIndent=0
        ),
        'toc_section': ParagraphStyle(
            'toc_section', fontSize=10, fontName='Helvetica',
            textColor=GRAY_700, spaceBefore=1, spaceAfter=1, leading=14,
            leftIndent=16
        ),
        'chapter_title': ParagraphStyle(
            'chapter_title', fontSize=24, fontName='Helvetica-Bold',
            textColor=white, alignment=TA_CENTER, spaceAfter=8, leading=30
        ),
        'section_title': ParagraphStyle(
            'section_title', fontSize=16, fontName='Helvetica-Bold',
            textColor=DARK_NAVY, spaceBefore=16, spaceAfter=6, leading=20
        ),
        'subsection_title': ParagraphStyle(
            'subsection_title', fontSize=13, fontName='Helvetica-Bold',
            textColor=BLUE_600, spaceBefore=10, spaceAfter=4, leading=16
        ),
        'body': ParagraphStyle(
            'body', fontSize=10, fontName='Helvetica',
            textColor=GRAY_700, spaceBefore=3, spaceAfter=3, leading=14,
            alignment=TA_JUSTIFY
        ),
        'bullet': ParagraphStyle(
            'bullet', fontSize=10, fontName='Helvetica',
            textColor=GRAY_700, spaceBefore=2, spaceAfter=2, leading=14,
            leftIndent=12, bulletIndent=0
        ),
        'feature_label': ParagraphStyle(
            'feature_label', fontSize=9, fontName='Helvetica-Bold',
            textColor=BLUE_600, spaceBefore=0, spaceAfter=0, leading=12
        ),
        'feature_value': ParagraphStyle(
            'feature_value', fontSize=9, fontName='Helvetica',
            textColor=GRAY_700, spaceBefore=0, spaceAfter=0, leading=12
        ),
        'table_header': ParagraphStyle(
            'table_header', fontSize=9, fontName='Helvetica-Bold',
            textColor=white, alignment=TA_CENTER, leading=12
        ),
        'table_cell': ParagraphStyle(
            'table_cell', fontSize=9, fontName='Helvetica',
            textColor=GRAY_700, alignment=TA_LEFT, leading=12
        ),
        'caption': ParagraphStyle(
            'caption', fontSize=8, fontName='Helvetica',
            textColor=GRAY_500, alignment=TA_CENTER, spaceAfter=4
        ),
        'highlight_box': ParagraphStyle(
            'highlight_box', fontSize=10, fontName='Helvetica',
            textColor=DARK_NAVY, spaceBefore=3, spaceAfter=3, leading=14,
            leftIndent=10, rightIndent=10
        ),
        'route_path': ParagraphStyle(
            'route_path', fontSize=9, fontName='Courier-Bold',
            textColor=TEAL_500, spaceBefore=0, spaceAfter=0, leading=12
        ),
    }
    return styles

# ── Helper builders ────────────────────────────────────────────────────────────
def hr(color=GRAY_200, thickness=1, spaceB=6, spaceA=6):
    return HRFlowable(width='100%', thickness=thickness, color=color,
                      spaceAfter=spaceA, spaceBefore=spaceB)

def sp(n=6):
    return Spacer(1, n)

def module_table(modules, styles, cols=3):
    """Build a styled grid table for module cards."""
    # pad to fill last row
    while len(modules) % cols != 0:
        modules.append(('', '', ''))

    rows = []
    for i in range(0, len(modules), cols):
        row = []
        for m in modules[i:i+cols]:
            if m[0]:
                cell = [
                    Paragraph(m[0], styles['feature_label']),
                    Paragraph(m[1], styles['feature_value']),
                    Paragraph(f"Route: {m[2]}", styles['route_path']),
                ]
            else:
                cell = [Spacer(1, 1)]
            row.append(cell)
        rows.append(row)

    col_w = (A4[0] - 40*mm) / cols
    t = Table(rows, colWidths=[col_w]*cols, repeatRows=0)
    t.setStyle(TableStyle([
        ('BOX',         (0,0), (-1,-1), 0.5, GRAY_200),
        ('INNERGRID',   (0,0), (-1,-1), 0.5, GRAY_200),
        ('BACKGROUND',  (0,0), (-1,-1), GRAY_50),
        ('TOPPADDING',  (0,0), (-1,-1), 8),
        ('BOTTOMPADDING',(0,0),(-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING',(0,0), (-1,-1), 10),
        ('ROWBACKGROUNDS',(0,0),(-1,-1),[GRAY_50, GRAY_100]),
        ('VALIGN',      (0,0), (-1,-1), 'TOP'),
    ]))
    return t

def feature_table(rows_data, styles, col_widths=None):
    """Two-column feature table: Feature | Description."""
    if col_widths is None:
        col_widths = [60*mm, (A4[0]-40*mm-60*mm)]
    header = [
        Paragraph('Feature', styles['table_header']),
        Paragraph('Description', styles['table_header']),
    ]
    rows = [header]
    for feat, desc in rows_data:
        rows.append([
            Paragraph(feat, ParagraphStyle('fb', fontSize=9, fontName='Helvetica-Bold', textColor=GRAY_700, leading=12)),
            Paragraph(desc, styles['table_cell']),
        ])
    t = Table(rows, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (-1,0), BLUE_600),
        ('TEXTCOLOR',    (0,0), (-1,0), white),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[white, GRAY_50]),
        ('BOX',          (0,0), (-1,-1), 0.5, GRAY_200),
        ('INNERGRID',    (0,0), (-1,-1), 0.3, GRAY_200),
        ('TOPPADDING',   (0,0), (-1,-1), 5),
        ('BOTTOMPADDING',(0,0),(-1,-1), 5),
        ('LEFTPADDING',  (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('VALIGN',       (0,0), (-1,-1), 'TOP'),
    ]))
    return t


# ── Page Templates (Header/Footer) ────────────────────────────────────────────
def on_page(canvas, doc, title='CubeMed HIS Documentation'):
    canvas.saveState()
    W, H = A4
    # Footer bar
    canvas.setFillColor(DARK_NAVY)
    canvas.rect(0, 0, W, 18*mm, fill=1, stroke=0)
    canvas.setFillColor(BLUE_400)
    canvas.setFont('Helvetica-Bold', 8)
    canvas.drawString(15*mm, 7*mm, 'CubeMed HIS v6.0 — Confidential Documentation')
    canvas.setFillColor(GRAY_500)
    canvas.setFont('Helvetica', 8)
    canvas.drawRightString(W - 15*mm, 7*mm, f'Page {doc.page}')
    # Top thin bar
    canvas.setFillColor(BLUE_600)
    canvas.rect(0, H - 4*mm, W, 4*mm, fill=1, stroke=0)
    canvas.restoreState()

def on_cover_page(canvas, doc):
    canvas.saveState()
    W, H = A4
    # Full dark gradient background
    canvas.setFillColor(DARK_NAVY)
    canvas.rect(0, 0, W, H, fill=1, stroke=0)
    # Decorative top band
    canvas.setFillColor(BLUE_600)
    canvas.rect(0, H - 30*mm, W, 30*mm, fill=1, stroke=0)
    # Bottom band
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, W, 40*mm, fill=1, stroke=0)
    # Accent line
    canvas.setFillColor(TEAL_500)
    canvas.rect(0, H - 32*mm, W, 2*mm, fill=1, stroke=0)
    canvas.restoreState()


# ── Build Story ────────────────────────────────────────────────────────────────
def build_story():
    styles = make_styles()
    story = []
    today = datetime.date.today().strftime('%B %d, %Y')

    # ── COVER PAGE ──────────────────────────────────────────────────────────────
    story.append(Spacer(1, 35*mm))
    story.append(Paragraph('CubeMed HIS', styles['cover_title']))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph('Hospital Information System', styles['cover_subtitle']))
    story.append(Paragraph('Complete UI & Module Documentation', styles['cover_subtitle']))
    story.append(Spacer(1, 10*mm))
    story.append(Paragraph('Version 6.0 · React + FastAPI · Tailwind CSS', styles['cover_meta']))
    story.append(Paragraph(f'Generated: {today}', styles['cover_meta']))
    story.append(Spacer(1, 20*mm))

    # Modules count block
    info_data = [['Modules', 'Pages', 'Components', 'API Routes'],
                 ['25+', '70+', '100+', '50+']]
    info_table = Table(info_data, colWidths=[35*mm, 35*mm, 35*mm, 35*mm])
    info_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), NAVY),
        ('BACKGROUND', (0,1), (-1,1), SLATE),
        ('TEXTCOLOR',  (0,0), (-1,-1), white),
        ('ALIGN',      (0,0), (-1,-1), 'CENTER'),
        ('FONTNAME',   (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTNAME',   (0,1), (-1,1), 'Helvetica-Bold'),
        ('FONTSIZE',   (0,0), (-1,0), 9),
        ('FONTSIZE',   (0,1), (-1,1), 18),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING',(0,0),(-1,-1), 8),
        ('BOX',        (0,0), (-1,-1), 1, BLUE_400),
        ('INNERGRID',  (0,0), (-1,-1), 0.5, BLUE_400),
    ]))
    story.append(info_table)
    story.append(PageBreak())

    # ── TABLE OF CONTENTS ───────────────────────────────────────────────────────
    story.append(Spacer(1, 10*mm))
    story.append(Paragraph('Table of Contents', styles['toc_title']))
    story.append(hr(BLUE_600, 2))
    story.append(sp(4))

    toc = [
        ('1', 'Project Overview', [
            'System Architecture', 'Tech Stack', 'Authentication & Security',
        ]),
        ('2', 'Navigation & Layout', [
            'Top Header', 'Sidebar Navigation', 'Responsive Design', 'Mega Menu',
        ]),
        ('3', 'Dashboard', [
            'KPI Cards', 'Quick Actions', 'Recent Appointments', 'Module Grid',
        ]),
        ('4', 'Patient Management', [
            'Reception', 'Patient Registration', 'Patient Portal', 'OPD Management', 'IPD / Ward',
        ]),
        ('5', 'Clinical Modules', [
            'EMR / Prescriptions', 'Nursing Station', 'OT Management', 'Teleconsultation',
        ]),
        ('6', 'Diagnostics', [
            'Laboratory', 'Radiology', 'Blood Bank',
        ]),
        ('7', 'Pharmacy & Inventory', [
            'Pharmacy Management', 'Stock Management',
        ]),
        ('8', 'Billing & Finance', [
            'Billing & Revenue', 'Insurance / TPA', 'Quotations', 'Payments',
        ]),
        ('9', 'HR & Staff', [
            'Staff Management', 'Attendance', 'Leave Requests', 'Certificates',
        ]),
        ('10', 'CRM & Leads', [
            'Leads Management', 'Enquiry Tracking', 'Customers', 'Franchise', 'Loyalty Program',
        ]),
        ('11', 'Users & Roles', [
            'User Management', 'Roles & Permissions', 'Hospital Management', 'User Hierarchy',
        ]),
        ('12', 'Reports & Analytics', [
            'MIS Reports', 'Dashboard Analytics', 'Export Options',
        ]),
        ('13', 'Tasks, Tickets & Documents', [
            'Task Management', 'Support Tickets', 'Document Store',
        ]),
        ('14', 'Notifications & Reminders', [
            'Follow-up Notifications', 'Reminder System', 'Admin Reminder Dashboard',
        ]),
        ('15', 'Login & Registration', [
            'Login Screen', 'Register Screen', 'Profile Management',
        ]),
    ]
    for num, title, sections in toc:
        story.append(Paragraph(f'{num}. {title}', styles['toc_chapter']))
        for sec in sections:
            story.append(Paragraph(f'• {sec}', styles['toc_section']))
        story.append(sp(2))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════════
    # CHAPTER 1 — PROJECT OVERVIEW
    # ═══════════════════════════════════════════════════════════════════════════
    story.append(Spacer(1, 5*mm))
    story.append(Paragraph('Chapter 1 · Project Overview', styles['chapter_title']))
    story.append(hr(BLUE_400, 2))
    story.append(sp(6))

    story.append(Paragraph('System Overview', styles['section_title']))
    story.append(Paragraph(
        'CubeMed HIS (Hospital Information System) is a full-stack, multi-hospital SaaS platform '
        'designed for Indian healthcare institutions. The system integrates every department of a hospital — '
        'from patient registration and OPD/IPD management to pharmacy, billing, diagnostics, HR, and CRM — '
        'into a single, unified web interface. The platform is role-based, ensuring each user sees only '
        'the modules relevant to their function.',
        styles['body']
    ))
    story.append(sp(4))

    story.append(Paragraph('Tech Stack', styles['subsection_title']))
    story.append(feature_table([
        ('Frontend Framework', 'React 18 with Vite build tool — lazy-loaded pages for performance'),
        ('Styling', 'Tailwind CSS v3 with custom design system; Font Awesome icons'),
        ('Routing', 'React Router DOM v6 — protected routes with role-based access'),
        ('State Management', 'React hooks (useState, useEffect) + localStorage for session persistence'),
        ('Animations', 'Framer Motion for page transitions and card animations'),
        ('Notifications', 'React Toastify for toast alerts; custom reminder/bell system'),
        ('Backend', 'Python FastAPI — async REST API with SQLAlchemy ORM'),
        ('Database', 'PostgreSQL with async driver (asyncpg)'),
        ('Authentication', 'JWT Bearer tokens (access + refresh); token blacklist on logout'),
        ('Deployment', 'Linux server, Nginx reverse proxy, HTTPS via Let\'s Encrypt'),
        ('Integrations', 'Google Sheets, Google Drive, Meta Ads API'),
    ], styles))
    story.append(sp(6))

    story.append(Paragraph('Authentication & Security', styles['subsection_title']))
    story.append(feature_table([
        ('JWT Auth', 'Access tokens stored in localStorage; Authorization: Bearer header on all API calls'),
        ('Role-Based Access', 'Roles define permissions; sidebar and routes filter based on user permissions'),
        ('Token Blacklist', 'On logout, tokens are blacklisted server-side to prevent reuse'),
        ('Protected Routes', 'React ProtectedRoute wrapper redirects unauthenticated users to /login'),
        ('Multi-Hospital', 'Non-admin users are scoped to their hospital_id; admin sees all hospitals'),
        ('Permission Levels', 'Granular CRUD permissions (e.g., leads:read, leads:write) or wildcard *'),
    ], styles))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════════
    # CHAPTER 2 — NAVIGATION & LAYOUT
    # ═══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('Chapter 2 · Navigation & Layout', styles['chapter_title']))
    story.append(hr(BLUE_400, 2))
    story.append(sp(6))

    story.append(Paragraph('Application Shell', styles['section_title']))
    story.append(Paragraph(
        'The main application shell consists of three parts: a collapsible left Sidebar, '
        'a Top Header bar, and the main content area. The Layout component wraps all protected routes '
        'and provides the logout function down through props.',
        styles['body']
    ))
    story.append(sp(4))

    story.append(Paragraph('Top Header', styles['subsection_title']))
    story.append(feature_table([
        ('Hamburger Toggle', 'Collapses/expands the sidebar; on mobile shows overlay drawer'),
        ('Search Bar', 'Globally visible search input (UI ready; backend search hookable)'),
        ('Reminder Bell', 'Real-time follow-up reminder notifications with sound alerts'),
        ('User Avatar', 'Shows first 2 initials; displays username and current date-time on click'),
        ('Profile Dropdown', 'View Profile, Edit Profile, and Logout options'),
        ('Profile Card', 'Animated modal showing full name, email, roles, join date, active status'),
        ('Edit Profile', 'Inline form to update full name, email, and password via /api/auth/update'),
        ('Logout Flow', 'Shows animated success modal then clears localStorage and redirects to /login'),
        ('Follow-up Alert', 'Pops up when there are today\'s pending follow-up tasks for the user'),
    ], styles))
    story.append(sp(6))

    story.append(Paragraph('Sidebar Navigation', styles['subsection_title']))
    story.append(Paragraph(
        'The sidebar is a dark slate-900 panel with a background image overlay. '
        'It shows the CubeMed HIS logo, the logged-in user\'s name, role(s), and hospital. '
        'Menu items are filtered by the user\'s permission set computed from backend role data.',
        styles['body']
    ))
    story.append(feature_table([
        ('Collapsible', 'Collapses to icon-only mode on desktop; full drawer on mobile with overlay'),
        ('User Info', 'Shows avatar, full name, role(s), and hospital name below the logo'),
        ('Permission Filtering', 'Only shows menu items the user has permission for'),
        ('Submenu Support', 'Expandable submenus (e.g., Patient Management, Clinical, HR & Staff)'),
        ('Active Highlighting', 'Blue left border on active route; submenu auto-expands on navigate'),
        ('Mega Menu', 'Admin-only 3-column quick navigation panel with hospital cross-reference'),
        ('Role Detection', 'Reads roles from /api/auth/me and /api/roles/ on mount'),
        ('Hospital Badge', '🏥 Shows hospital name in green for non-admin users'),
    ], styles))
    story.append(sp(4))

    story.append(Paragraph('Sidebar Menu Structure', styles['subsection_title']))
    menu_modules = [
        ('Dashboard', 'Overview KPIs & quick links', '/dashboard'),
        ('Appointments', 'Schedule & manage appointments', '/appointments'),
        ('Patient Management', 'Reception, Registration, OPD, IPD', '/patients'),
        ('Doctors', 'Doctor roster & departments', '/doctors'),
        ('Clinical', 'EMR, Nursing, OT, Teleconsult', '/emr'),
        ('Pharmacy', 'Drug dispensing & stock', '/pharmacy'),
        ('Laboratory', 'Lab orders & results', '/laboratory'),
        ('Radiology', 'Imaging orders & reports', '/radiology'),
        ('Blood Bank', 'Blood inventory management', '/blood-bank'),
        ('Billing & Finance', 'Billing, revenue, insurance', '/billing'),
        ('Certificates', 'Medical & legal certificates', '/certificates'),
        ('HR & Staff', 'Staff, attendance, leaves', '/hr'),
        ('Stock Management', 'General inventory', '/inventory'),
        ('MIS Reports', 'Analytics & export', '/reports'),
        ('Users & Roles', 'Users, roles, hospitals', '/users'),
    ]
    story.append(module_table(menu_modules, styles, cols=3))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════════
    # CHAPTER 3 — DASHBOARD
    # ═══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('Chapter 3 · Dashboard', styles['chapter_title']))
    story.append(hr(BLUE_400, 2))
    story.append(sp(6))

    story.append(Paragraph('Overview', styles['section_title']))
    story.append(Paragraph(
        'The Dashboard is the first screen after login. It aggregates real-time KPIs from multiple '
        'backend services, provides quick-action shortcuts, shows recent appointments, and renders a '
        'full module navigation grid. Admins see an all-hospitals view with a hospital filter dropdown.',
        styles['body']
    ))
    story.append(sp(4))

    story.append(Paragraph('KPI Cards (8 Cards)', styles['subsection_title']))
    story.append(feature_table([
        ("Today's Appointments", "Total appointments booked for today — links to /appointments"),
        ('OPD Waiting', "Count of patients waiting in OPD queue — links to /opd"),
        ('Admitted Patients', "Currently admitted IPD patients — links to /ipd"),
        ('Bed Occupancy', "Percentage of beds occupied — calculated from IPD stats"),
        ("Today's Revenue", "Today's total billing revenue in ₹ — links to /billing"),
        ('Lab Orders Pending', "Pending lab test orders — links to /laboratory"),
        ('Pharmacy Low Stock', "Count of drugs below minimum stock level — links to /pharmacy"),
        ("Today's Surgeries", "Total OT procedures scheduled today — links to /ot"),
    ], styles))
    story.append(sp(4))

    story.append(Paragraph('Quick Actions (8 Buttons)', styles['subsection_title']))
    story.append(feature_table([
        ('New Appointment', 'Jumps to /appointments to create a new booking'),
        ('Register Patient', 'Jumps to /patients/registration for new patient intake'),
        ('OPD Queue', 'Opens OPD waiting list at /opd'),
        ('IPD Admissions', 'Opens inpatient management at /ipd'),
        ('Lab Orders', 'Opens laboratory module at /laboratory'),
        ('Billing', 'Opens billing & revenue at /billing'),
        ('Pharmacy', 'Opens pharmacy dispensing at /pharmacy'),
        ('Blood Bank', 'Opens blood bank inventory at /blood-bank'),
    ], styles))
    story.append(sp(4))

    story.append(Paragraph('Recent Appointments Table', styles['subsection_title']))
    story.append(Paragraph(
        'Shows the last 5 appointments with: Token #, MRN badge, Patient name & mobile, Doctor, '
        'Department, Date, Time, Type (color badge), and Status (color badge). '
        'Animated rows via Framer Motion. "View All" links to full appointments page.',
        styles['body']
    ))
    story.append(sp(4))

    story.append(Paragraph('Module Navigation Grid (14 modules)', styles['subsection_title']))
    story.append(Paragraph(
        'A responsive icon grid (3–7 columns depending on screen size) with colored icon tiles for '
        'all 14 hospital modules. Each tile is clickable and navigates to the module route.',
        styles['body']
    ))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════════
    # CHAPTER 4 — PATIENT MANAGEMENT
    # ═══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('Chapter 4 · Patient Management', styles['chapter_title']))
    story.append(hr(BLUE_400, 2))
    story.append(sp(6))

    story.append(Paragraph('Reception (/reception)', styles['section_title']))
    story.append(Paragraph(
        'Front-desk reception module for managing patient check-ins, token assignments, and '
        'day-to-day patient flow into the hospital.',
        styles['body']
    ))
    story.append(feature_table([
        ('Patient Check-In', 'Search and check-in registered patients; assign token numbers'),
        ('Queue Display', 'Live view of patients waiting at reception'),
        ('Walk-in Handling', 'Quick registration for unregistered walk-in patients'),
        ('Token Management', 'Generate and manage sequential token numbers per department'),
        ('Appointment Linking', 'Link check-in to pre-booked appointments'),
    ], styles))
    story.append(sp(6))

    story.append(Paragraph('Patient Registration (/patients/registration)', styles['section_title']))
    story.append(Paragraph(
        'Comprehensive patient registration module for capturing full demographic and medical history. '
        'Creates a unique MRN (Medical Record Number) for each patient.',
        styles['body']
    ))
    story.append(feature_table([
        ('MRN Generation', 'Auto-generates unique Medical Record Number on registration'),
        ('Demographics', 'Full name, DOB, age, gender, blood group, address, contact'),
        ('Insurance Info', 'Insurance provider, policy number, TPA details'),
        ('Emergency Contact', 'Next of kin name and contact information'),
        ('Document Upload', 'Upload ID proof, insurance card, previous records'),
        ('Duplicate Check', 'Warns if a patient with similar name/mobile already exists'),
        ('Consent Form', 'Digital consent form acknowledgement'),
        ('Hospital Assignment', 'Auto-assigns to user\'s hospital or admin selects'),
    ], styles))
    story.append(sp(6))

    story.append(Paragraph('Patient Portal (/patients/portal)', styles['section_title']))
    story.append(feature_table([
        ('Medical History', 'Full history of visits, diagnoses, prescriptions, and reports'),
        ('Lab Results', 'View and download laboratory test results'),
        ('Billing History', 'View past invoices and outstanding dues'),
        ('Appointment History', 'List of all past and upcoming appointments'),
        ('Prescription View', 'View EMR prescriptions digitally'),
    ], styles))
    story.append(sp(6))

    story.append(Paragraph('OPD Management (/opd)', styles['section_title']))
    story.append(feature_table([
        ('OPD Queue', 'Real-time waiting list with token numbers and queue position'),
        ('Doctor Assignment', 'Assign patients to specific doctors based on department'),
        ('Consultation Status', 'Track patient through: Waiting → In Consultation → Completed'),
        ('Stats Widget', 'Total OPD today, waiting count, completed consultations'),
        ('Filter by Doctor', 'Filter queue by specific doctor or department'),
        ('Priority Queue', 'Mark emergency/priority patients for expedited care'),
    ], styles))
    story.append(sp(6))

    story.append(Paragraph('IPD / Ward Management (/ipd)', styles['section_title']))
    story.append(feature_table([
        ('Bed Management', 'Visual bed map with occupancy status (available/occupied/reserved)'),
        ('Admissions', 'Admit patients with bed assignment, admitting doctor, diagnosis'),
        ('Discharge Process', 'Structured discharge with summary and billing clearance'),
        ('Bed Occupancy %', 'Real-time occupancy percentage displayed in dashboard'),
        ('Ward Details', 'Multi-ward support (General, ICU, NICU, Maternity, etc.)'),
        ('Patient Timeline', 'Full activity log of IPD stay — notes, orders, vitals'),
    ], styles))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════════
    # CHAPTER 5 — CLINICAL MODULES
    # ═══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('Chapter 5 · Clinical Modules', styles['chapter_title']))
    story.append(hr(BLUE_400, 2))
    story.append(sp(6))

    story.append(Paragraph('EMR / Prescriptions (/emr)', styles['section_title']))
    story.append(Paragraph(
        'Electronic Medical Records module for doctors to create, view, and manage patient prescriptions '
        'and clinical notes digitally.',
        styles['body']
    ))
    story.append(feature_table([
        ('Prescription Builder', 'Add medications with dosage, frequency, and duration'),
        ('Diagnosis Entry', 'ICD-10 based diagnosis coding and free-text notes'),
        ('Vitals Recording', 'BP, pulse, temperature, SpO2, weight, height'),
        ('Complaint History', 'Chief complaint and history of presenting illness'),
        ('Investigations', 'Order lab tests and radiology from within EMR'),
        ('Follow-up Date', 'Set next follow-up date with automatic reminder creation'),
        ('PDF Generation', 'Generate printable prescription PDF with hospital letterhead'),
        ('Patient Medical Report', 'PatientMedicalReport component renders full clinical history'),
    ], styles))
    story.append(sp(6))

    story.append(Paragraph('Nursing Station (/nursing)', styles['section_title']))
    story.append(feature_table([
        ('Vitals Monitoring', 'Record and track vitals every hour for admitted patients'),
        ('Medication Administration', 'Record drug administration times and doses given'),
        ('Nursing Notes', 'Free-text nursing observations and handover notes'),
        ('Patient Alerts', 'Flag critical patients for immediate doctor attention'),
        ('Shift Management', 'Nurse shift assignment and duty roster'),
    ], styles))
    story.append(sp(6))

    story.append(Paragraph('OT Management (/ot)', styles['section_title']))
    story.append(feature_table([
        ('OT Scheduling', 'Book operation theatres with surgeon, anaesthetist, and time slot'),
        ('Pre-op Checklist', 'Digital pre-operative checklist verification'),
        ('OT Status Board', 'Real-time OT occupancy and next procedure visibility'),
        ('Surgical Notes', 'Intra-operative notes and findings documentation'),
        ('Post-op Care', 'Link to IPD for post-operative ward monitoring'),
        ('Today\'s Count', 'Total surgeries today shown in dashboard KPI'),
    ], styles))
    story.append(sp(6))

    story.append(Paragraph('Teleconsultation (/teleconsult)', styles['section_title']))
    story.append(feature_table([
        ('Virtual Appointments', 'Schedule and manage video/audio teleconsultation sessions'),
        ('Doctor Availability', 'Set and view doctor availability for remote consultations'),
        ('Session Linking', 'Link teleconsultation notes to patient EMR'),
        ('Prescription', 'Generate digital prescriptions from teleconsult sessions'),
    ], styles))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════════
    # CHAPTER 6 — DIAGNOSTICS
    # ═══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('Chapter 6 · Diagnostics', styles['chapter_title']))
    story.append(hr(BLUE_400, 2))
    story.append(sp(6))

    story.append(Paragraph('Laboratory (/laboratory)', styles['section_title']))
    story.append(feature_table([
        ('Test Orders', 'Receive lab orders from OPD/IPD/EMR; track by status'),
        ('Sample Collection', 'Record sample collection time, type, and collector'),
        ('Result Entry', 'Enter test results with reference ranges; flag abnormals'),
        ('Report Generation', 'Generate PDF lab reports with hospital branding'),
        ('Pending Dashboard', 'Count of pending lab orders shown in main dashboard KPI'),
        ('Test Catalogue', 'Master list of available tests with pricing'),
        ('Result Dispatch', 'Mark results as dispatched to ward/OPD'),
    ], styles))
    story.append(sp(6))

    story.append(Paragraph('Radiology (/radiology)', styles['section_title']))
    story.append(feature_table([
        ('Imaging Orders', 'Receive X-ray, CT, MRI, USG orders from clinical modules'),
        ('Modality Queue', 'Queue management per imaging modality'),
        ('Report Entry', 'Radiologist enters findings and impression'),
        ('Image Management', 'Link/upload DICOM or image files to reports'),
        ('Report Dispatch', 'Send signed reports back to ordering doctor'),
    ], styles))
    story.append(sp(6))

    story.append(Paragraph('Blood Bank (/blood-bank)', styles['section_title']))
    story.append(feature_table([
        ('Inventory Management', 'Track blood units by blood group and component type'),
        ('Donor Management', 'Donor registration, donation history, and eligibility checks'),
        ('Crossmatch', 'Record crossmatch requests and results'),
        ('Issue & Return', 'Issue blood to wards; handle returned units'),
        ('Expiry Alerts', 'Notify when blood units are near expiry date'),
        ('Requisition', 'Process blood requisition from wards and OT'),
    ], styles))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════════
    # CHAPTER 7 — PHARMACY & INVENTORY
    # ═══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('Chapter 7 · Pharmacy & Inventory', styles['chapter_title']))
    story.append(hr(BLUE_400, 2))
    story.append(sp(6))

    story.append(Paragraph('Pharmacy (/pharmacy)', styles['section_title']))
    story.append(feature_table([
        ('Dispensing Counter', 'Process prescriptions and issue drugs to patients'),
        ('Drug Catalogue', 'Master list with generic/brand names, category, and pricing'),
        ('Stock Levels', 'Real-time stock with low-stock threshold alerts'),
        ('Low Stock Alert', 'Dashboard KPI shows count of drugs below minimum quantity'),
        ('Purchase Orders', 'Raise purchase orders to suppliers for restocking'),
        ('Batch Management', 'Track drugs by batch number and expiry date'),
        ('Return Management', 'Process drug returns from wards and patients'),
        ('Billing Integration', 'Auto-generate drug billing items on dispense'),
    ], styles))
    story.append(sp(6))

    story.append(Paragraph('Stock Management (/inventory)', styles['section_title']))
    story.append(feature_table([
        ('General Inventory', 'Track all non-drug hospital consumables and equipment'),
        ('Stock Schema', 'Items tracked by category, supplier, unit, quantity, reorder level'),
        ('Issue Vouchers', 'Issue stock to departments with digital approval workflow'),
        ('Stock Audit', 'Periodic physical stock verification and variance reporting'),
        ('Supplier Management', 'Supplier master with contact and payment terms'),
        ('Purchase History', 'Full purchase order history and GRN (Goods Received Note)'),
    ], styles))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════════
    # CHAPTER 8 — BILLING & FINANCE
    # ═══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('Chapter 8 · Billing & Finance', styles['chapter_title']))
    story.append(hr(BLUE_400, 2))
    story.append(sp(6))

    story.append(Paragraph('Billing & Revenue (/billing)', styles['section_title']))
    story.append(feature_table([
        ('Invoice Generation', 'Create itemized bills for OPD, IPD, lab, pharmacy, OT services'),
        ('Payment Collection', 'Record cash, card, UPI, and insurance payments'),
        ('Revenue Dashboard', "Today's revenue KPI in main dashboard"),
        ('Discount Management', 'Apply discounts with authorization workflow'),
        ('Advance Collection', 'Collect and adjust advance payments'),
        ('Bill Printing', 'Generate PDF invoices with hospital letterhead'),
        ('Outstanding Dues', 'Track unpaid bills and send payment reminders'),
        ('Daily Collections', 'Summary report of daily revenue by payment mode'),
    ], styles))
    story.append(sp(6))

    story.append(Paragraph('Insurance / TPA (/insurance)', styles['section_title']))
    story.append(feature_table([
        ('TPA Management', 'Register and manage Third Party Administrator details'),
        ('Claim Processing', 'Submit and track insurance claims per patient'),
        ('Authorization', 'Record pre-authorization numbers and limits'),
        ('Cashless', 'Mark bills as cashless and bill to insurance directly'),
        ('Settlement', 'Track claim settlements and payment reconciliation'),
    ], styles))
    story.append(sp(6))

    story.append(Paragraph('Quotations (/leads/quotations)', styles['section_title']))
    story.append(feature_table([
        ('Quote Builder', 'Create itemized treatment quotations for patients/leads'),
        ('Status Tracking', 'Draft → Sent → Accepted → Rejected workflow'),
        ('PDF Export', 'Generate professional quotation PDF documents'),
        ('Hierarchy View', 'QuotationsPageHierarchy shows quotes across hierarchy levels'),
        ('Conversion', 'Convert accepted quotations to payment orders'),
    ], styles))
    story.append(sp(6))

    story.append(Paragraph('Payments (/leads/payments)', styles['section_title']))
    story.append(feature_table([
        ('Payment Records', 'Track all payments received against leads/quotations'),
        ('Payment Schema', 'Amount, date, mode, reference, status, created_by'),
        ('Receipt Generation', 'Generate payment receipt PDFs'),
        ('Pending Payments', 'View and follow up on pending/partial payments'),
    ], styles))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════════
    # CHAPTER 9 — HR & STAFF
    # ═══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('Chapter 9 · HR & Staff', styles['chapter_title']))
    story.append(hr(BLUE_400, 2))
    story.append(sp(6))

    story.append(Paragraph('Staff Management (/hr)', styles['section_title']))
    story.append(Paragraph(
        'Comprehensive HR module with multiple components: EmployeeManagement, EmployeeList, '
        'EmployeeForm, EmployeeDetails, and HRStaffModule. Admin/HR role required for full access.',
        styles['body']
    ))
    story.append(feature_table([
        ('Employee Directory', 'Searchable and filterable list of all staff members'),
        ('Employee Profile', 'Full profile: personal info, department, designation, join date'),
        ('Employee Form', 'Create/edit employee with validation and document upload'),
        ('Department Filter', 'Filter employees by department or designation'),
        ('HR Staff Module', 'HRStaffModule includes tabbed view: Overview, Attendance, Leave'),
        ('Employee Dashboard', 'EmployeeDashboard shows leave balance, attendance summary'),
        ('Profile Management', 'Employees can update their own profile via self-service'),
        ('Document Store', 'Attach documents (offer letter, ID, contracts) to employee profile'),
    ], styles))
    story.append(sp(6))

    story.append(Paragraph('Attendance Management (/attendance)', styles['section_title']))
    story.append(feature_table([
        ('Daily Attendance', 'Mark present/absent/half-day for each employee'),
        ('Check-in/out', 'Record punch-in and punch-out times'),
        ('Attendance Report', 'Monthly summary per employee: days present, absent, late'),
        ('Holiday Calendar', 'Define public holidays; system excludes them from attendance count'),
        ('Admin View', 'HR/Admin sees full attendance; employees see only their own'),
    ], styles))
    story.append(sp(6))

    story.append(Paragraph('Leave Requests (/my-leave-requests, /leave-requests)', styles['section_title']))
    story.append(feature_table([
        ('Leave Application', 'Employees apply for leave with type, dates, and reason'),
        ('Leave Types', 'Casual, Sick, Earned, Maternity/Paternity, etc.'),
        ('Approval Workflow', 'Manager approves/rejects; auto notification on decision'),
        ('Leave Balance', 'View available vs consumed leave per type'),
        ('Admin Panel', '/leave-requests shows all leave requests with bulk approve/reject'),
        ('Leave Request Card', 'LeaveRequestCard component renders single request in card format'),
    ], styles))
    story.append(sp(6))

    story.append(Paragraph('Certificates (/certificates)', styles['section_title']))
    story.append(feature_table([
        ('Medical Certificates', 'Generate sickness/fitness certificates for patients'),
        ('Disability Cert', 'Issue disability and medical fitness certificates'),
        ('Employment Cert', 'Generate employment/experience certificates for staff'),
        ('Custom Templates', 'Hospital letterhead, doctor signature, and certificate number'),
    ], styles))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════════
    # CHAPTER 10 — CRM & LEADS
    # ═══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('Chapter 10 · CRM & Leads', styles['chapter_title']))
    story.append(hr(BLUE_400, 2))
    story.append(sp(6))

    story.append(Paragraph('Leads Management (/leads)', styles['section_title']))
    story.append(Paragraph(
        'Full CRM pipeline for managing enquiries and converting them to patients. '
        'Supports hierarchy-based lead assignment across multi-level sales teams.',
        styles['body']
    ))
    story.append(feature_table([
        ('Lead Dashboard', 'LeadsDashboard with KPIs: total leads, new today, converted, pipeline value'),
        ('All Leads Table', 'AllLeadsTable with search, filter, sort, and pagination'),
        ('New Leads', 'NewLeadsTable filtered to show recently imported/created leads'),
        ('Imported Leads', 'ImportedLeadsTable with CSV import via Google Sheets integration'),
        ('Lead Detail Page', 'Full lead profile: notes, follow-ups, timeline, quotation history'),
        ('Lead Activity', 'LeadActivityTimeline renders chronological activity log'),
        ('Lead Status', 'LeadStatus pill component: New, Contacted, Interested, Qualified, Converted, Lost'),
        ('Lead Filter', 'LeadFilter component: filter by status, source, assignee, date range'),
        ('Notes Section', 'Add and view notes on leads'),
        ('Follow-up Section', 'Schedule and view follow-up tasks from lead profile'),
        ('Duplicate Check', 'DuplicateLeadsSection flags potential duplicate entries'),
    ], styles))
    story.append(sp(6))

    story.append(Paragraph('Lead Assignment & Hierarchy (/assigned-leads, /hierarchy-assignment)', styles['section_title']))
    story.append(feature_table([
        ('Assign Leads', 'AssignLeads component — assign leads to team members'),
        ('Hierarchy Assignment', 'HierarchyAssignment page assigns leads through org hierarchy'),
        ('AssignLeadsHierarchy', 'Hierarchy-aware assignment with parent-child role structure'),
        ('HierarchyLeadsDashboard', 'View all leads grouped by hierarchy level'),
        ('HierarchyLeadView', 'Individual view of leads for a hierarchy node'),
        ('Subordinate Assignment', 'SubordinateAssignment page for team lead to assign down'),
    ], styles))
    story.append(sp(6))

    story.append(Paragraph('Enquiry Tracking (/enquiries/:id)', styles['section_title']))
    story.append(feature_table([
        ('Enquiry Profile', 'EnquiryProfileView — detailed view of a single enquiry/lead'),
        ('Enquiry Tracking', 'EnquiryTracking page lists all enquiries with status'),
        ('Communication Log', 'CommunicationLog component records all interactions'),
        ('Complaints', 'ComplaintsModule — log and resolve customer complaints'),
        ('Feedback System', 'FeedbackSystem component captures patient/lead satisfaction scores'),
    ], styles))
    story.append(sp(6))

    story.append(Paragraph('Customers (/customers)', styles['section_title']))
    story.append(feature_table([
        ('Customer List', 'All converted leads/patients in CRM customer view'),
        ('Customer Profile', 'Full profile with treatment history and payment history'),
        ('Customer Profile View', 'CustomerProfileView at /customers/:customer_id'),
        ('Loyalty Points', 'LoyaltyPoints component shows earned and redeemable points'),
    ], styles))
    story.append(sp(4))

    story.append(Paragraph('Franchise (/franchise)', styles['section_title']))
    story.append(feature_table([
        ('Franchise Management', 'Manage franchise partner information and agreements'),
        ('Franchise Card', 'FranchiseCard component renders franchise summary'),
        ('Partner Portal', 'Franchise partners see their own lead pipeline'),
    ], styles))
    story.append(sp(4))

    story.append(Paragraph('Loyalty Program (/loyalty)', styles['section_title']))
    story.append(feature_table([
        ('Points System', 'Award points on payments and engagements'),
        ('Redemption', 'Patients can redeem loyalty points against bills'),
        ('Tier Management', 'Bronze/Silver/Gold tiers with different benefit levels'),
    ], styles))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════════
    # CHAPTER 11 — USERS & ROLES
    # ═══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('Chapter 11 · Users & Roles', styles['chapter_title']))
    story.append(hr(BLUE_400, 2))
    story.append(sp(6))

    story.append(Paragraph('User Management (/users/list)', styles['section_title']))
    story.append(feature_table([
        ('Users Table', 'List all system users with search and filter'),
        ('Create User', 'Create new users with username, password, email, and role assignment'),
        ('Edit User', 'Update user details and role assignments'),
        ('Activate/Deactivate', 'Toggle user active status without deletion'),
        ('Hospital Assignment', 'Assign users to specific hospitals (multi-hospital support)'),
        ('Password Reset', 'Admin can reset user passwords'),
    ], styles))
    story.append(sp(6))

    story.append(Paragraph('Roles & Permissions (/users/roles)', styles['section_title']))
    story.append(feature_table([
        ('Roles Manager', 'RolesManager component — CRUD operations on roles'),
        ('Create Role', 'CreateRoleModal — define role name and select permissions'),
        ('Permission Matrix', 'Granular module-level permissions: dashboard, leads, billing, etc.'),
        ('CRUD Permissions', 'Supports read/write/delete per module (e.g., leads:read, leads:write)'),
        ('Wildcard', 'Assign * permission to grant all module access (super-admin)'),
        ('Role Assignment', 'Assign one or multiple roles to each user'),
    ], styles))
    story.append(sp(6))

    story.append(Paragraph('Hospital Management (/users/hospitals)', styles['section_title']))
    story.append(feature_table([
        ('Hospital List', 'View all registered hospitals with code, name, and status'),
        ('Create Hospital', 'Register new hospital with code, name, address, contact'),
        ('Edit Hospital', 'Update hospital details'),
        ('Hospital Scoping', 'All modules auto-filter data by hospital_id for non-admin users'),
        ('Admin Filter', 'Dashboard has hospital dropdown for admin to switch context'),
    ], styles))
    story.append(sp(6))

    story.append(Paragraph('User Hierarchy (/hierarchy-assignment)', styles['section_title']))
    story.append(feature_table([
        ('Org Hierarchy', 'Define multi-level user hierarchy (Manager → TL → Executive)'),
        ('Fix Service', 'fix_user_hierarchy_service.py repairs broken hierarchy links'),
        ('Hierarchy Helper', 'hierarchy_helper.py provides utilities for tree traversal'),
        ('Lead Visibility', 'Leads visible up the hierarchy — managers see team leads\' leads'),
        ('Assignment Flow', 'HierarchyAssignment UI allows drag-and-assign down the org chart'),
    ], styles))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════════
    # CHAPTER 12 — REPORTS & ANALYTICS
    # ═══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('Chapter 12 · Reports & Analytics', styles['chapter_title']))
    story.append(hr(BLUE_400, 2))
    story.append(sp(6))

    story.append(Paragraph('MIS Reports (/reports)', styles['section_title']))
    story.append(Paragraph(
        'The Reports module has multiple implementations: ReportsPage, ReportsEnhanced, Reports_new, '
        'Reports_old — the active one is ReportsPage. LeadReportsPage is for CRM-specific analytics.',
        styles['body']
    ))
    story.append(feature_table([
        ('Daily Reports', 'Appointments, admissions, discharges, revenue for selected date'),
        ('OPD/IPD Reports', 'Department-wise patient counts and doctor utilization'),
        ('Revenue Reports', 'Revenue by service category, doctor, and department'),
        ('Lead Reports', 'LeadReportsPage — lead conversion funnel, source analysis'),
        ('Attendance Report', 'HR attendance summary by month and department'),
        ('Stock Reports', 'Inventory levels, consumption, and purchase summary'),
        ('Custom Date Range', 'Filter all reports by custom date range'),
        ('Export Options', 'CSV/PDF export buttons throughout report pages'),
    ], styles))
    story.append(sp(4))

    story.append(Paragraph('Dashboard Analytics', styles['subsection_title']))
    story.append(Paragraph(
        'Real-time KPIs on the main dashboard pull from 7 separate backend API endpoints simultaneously '
        'using Promise.allSettled. Failed endpoints gracefully show "–" without breaking the UI. '
        'DashboardTable provides additional tabular analytics at /reports.',
        styles['body']
    ))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════════
    # CHAPTER 13 — TASKS, TICKETS & DOCUMENTS
    # ═══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('Chapter 13 · Tasks, Tickets & Documents', styles['chapter_title']))
    story.append(hr(BLUE_400, 2))
    story.append(sp(6))

    story.append(Paragraph('Task Management (/tasks)', styles['section_title']))
    story.append(feature_table([
        ('Task List', 'View all assigned tasks with priority and due date'),
        ('Task Schema', 'Title, description, assigned_to, due_date, priority, status'),
        ('Create Task', 'Create tasks and assign to users or teams'),
        ('Task Status', 'Pending → In Progress → Completed → Cancelled'),
        ('Overdue Alerts', 'Visual indicator for tasks past due date'),
    ], styles))
    story.append(sp(6))

    story.append(Paragraph('Support Tickets (/tickets)', styles['section_title']))
    story.append(feature_table([
        ('Ticket List', 'View and filter support tickets by status and priority'),
        ('Ticket Schema', 'Subject, description, category, priority, status, assigned_to'),
        ('Ticket Detail', 'TicketDetails page at /tickets/:ticket_id — full conversation thread'),
        ('Ticket Status', 'Open → In Progress → Resolved → Closed'),
        ('Priority Levels', 'Low / Medium / High / Critical'),
        ('Assignment', 'Assign tickets to support staff with email notification'),
    ], styles))
    story.append(sp(6))

    story.append(Paragraph('Document Store (/documents)', styles['section_title']))
    story.append(feature_table([
        ('Document Uploader', 'DocumentUploader component — drag-and-drop file upload to Google Drive'),
        ('Document Schema', 'File name, type, size, uploader, linked entity (patient/employee)'),
        ('Document List', 'View uploaded documents with download links'),
        ('Google Drive Integration', 'Files stored in Google Drive via service account'),
        ('Access Control', 'Documents visible only to users with document permission'),
    ], styles))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════════
    # CHAPTER 14 — NOTIFICATIONS & REMINDERS
    # ═══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('Chapter 14 · Notifications & Reminders', styles['chapter_title']))
    story.append(hr(BLUE_400, 2))
    story.append(sp(6))

    story.append(Paragraph('Reminder System', styles['section_title']))
    story.append(feature_table([
        ('useReminders Hook', 'useReminders.js — fetches pending reminders for current user'),
        ('ReminderService', 'ReminderService.jsx — manages reminder polling and sound alerts'),
        ('ReminderModal', 'ReminderModal.jsx — popup to view and act on a reminder'),
        ('ReminderPopup', 'Non-modal popup that shows reminder details with snooze/dismiss'),
        ('ReminderManager', 'ReminderManager.jsx — full CRUD for user\'s reminders'),
        ('RemindersDashboard', 'Full dashboard view of all reminders with filters'),
        ('AdminReminderDash', 'AdminReminderDashboard.jsx — admin view of all users\' reminders'),
        ('DashboardBell', 'DashboardReminderNotification — bell icon in header with badge count'),
        ('AllFollowUpsModal', 'AllFollowUpsModal.jsx — shows all today\'s follow-ups in one modal'),
    ], styles))
    story.append(sp(6))

    story.append(Paragraph('Follow-up Notifications', styles['section_title']))
    story.append(feature_table([
        ('FollowUpNotification', 'Popup shown on login if user has follow-ups due today'),
        ('FollowUpNotifications', 'Persistent component listing all upcoming follow-ups'),
        ('Sound Alert', 'soundUtils.js — plays notification chime for due reminders'),
        ('LoginNotification', 'LoginNotification.jsx — welcome message after successful login'),
        ('Background Notifier', 'remainder_notifier.py — backend job that sends push/email alerts'),
        ('Meta Scheduler', 'meta_scheduler.py — schedules Meta Ads lead sync at intervals'),
    ], styles))
    story.append(sp(6))

    story.append(Paragraph('Toast Notifications', styles['section_title']))
    story.append(feature_table([
        ('React Toastify', 'Global ToastContainer in App.jsx — top-right, 3s auto-close'),
        ('NotificationToast', 'Custom NotificationToast component for styled alerts'),
        ('Success/Error', 'Green success and red error toasts on all form submissions'),
        ('Follow-up Reminder', 'Special toast style for follow-up due reminders'),
    ], styles))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════════
    # CHAPTER 15 — LOGIN & REGISTRATION
    # ═══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('Chapter 15 · Login & Registration', styles['chapter_title']))
    story.append(hr(BLUE_400, 2))
    story.append(sp(6))

    story.append(Paragraph('Login Screen (/login)', styles['section_title']))
    story.append(feature_table([
        ('LoginForm', 'Centered card with username and password fields'),
        ('JWT Storage', 'Access token stored in localStorage on successful login'),
        ('Auth Hook', 'useAuth() in App.jsx manages isAuthenticated state'),
        ('Remember Session', 'Token persisted in localStorage survives browser refresh'),
        ('Redirect', 'Successful login redirects to /dashboard; failed shows error toast'),
        ('Register Link', '"Don\'t have an account?" toggles to RegisterForm'),
        ('Loading State', 'Button shows spinner during authentication request'),
    ], styles))
    story.append(sp(6))

    story.append(Paragraph('Register Screen', styles['section_title']))
    story.append(feature_table([
        ('RegisterForm', 'Registration form with name, username, email, password fields'),
        ('Validation', 'Client-side validation before submitting to /api/auth/register'),
        ('Auto Login', 'Successful registration auto-logs in the user'),
        ('Back to Login', '"Already have an account?" link returns to login'),
    ], styles))
    story.append(sp(6))

    story.append(Paragraph('Profile Management', styles['section_title']))
    story.append(feature_table([
        ('View Profile', 'ProfileCard in TopHeader fetches /api/auth/me for live data'),
        ('Edit Profile', 'EditProfileForm — update full name, email, password'),
        ('ProfileEditModal', 'ProfileEditModal.jsx — standalone modal for profile editing'),
        ('EditProfileForm', 'EditProfileForm.jsx in layout — inline form in header'),
        ('API Endpoint', 'POST /api/auth/update — updates user profile server-side'),
        ('Session Refresh', 'Page reloads after profile update to reflect new values'),
    ], styles))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════════════════════════
    # APPENDIX — COMPLETE ROUTE MAP
    # ═══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('Appendix · Complete Route Map', styles['chapter_title']))
    story.append(hr(BLUE_400, 2))
    story.append(sp(6))

    routes = [
        ('/login', 'LoginForm', 'Public'),
        ('/dashboard', 'Dashboard', 'All users'),
        ('/appointments', 'AppointmentsPage', 'appointments'),
        ('/reception', 'ReceptionPage', 'patients'),
        ('/patients/registration', 'PatientRegistrationPage', 'patients'),
        ('/patients/portal', 'PatientPortalPage', 'patients'),
        ('/opd', 'OPDManagementPage', 'opd'),
        ('/ipd', 'IPDWardPage', 'ipd'),
        ('/emr', 'EMRPage', 'emr'),
        ('/nursing', 'NursingStationPage', 'nursing'),
        ('/ot', 'OTManagementPage', 'ot'),
        ('/teleconsult', 'TeleconsultationPage', 'teleconsult'),
        ('/pharmacy', 'PharmacyPage', 'pharmacy'),
        ('/laboratory', 'LaboratoryPage', 'laboratory'),
        ('/radiology', 'RadiologyPage', 'radiology'),
        ('/blood-bank', 'BloodBankPage', 'blood_bank'),
        ('/billing', 'BillingRevenuePage', 'billing'),
        ('/insurance', 'InsuranceTpaPage', 'insurance'),
        ('/certificates', 'CertificatesPage', 'certificates'),
        ('/doctors', 'DoctorManagementPage', 'doctors'),
        ('/departments', 'DepartmentManagementPage', 'departments'),
        ('/leads', 'LeadsPage', 'leads'),
        ('/leads/quotations', 'QuotationPage', 'leads'),
        ('/leads/payments', 'PaymentsPage', 'leads'),
        ('/leads/:leadId', 'LeadDetailPage', 'leads'),
        ('/assigned-leads', 'AssignLeads', 'leads'),
        ('/hierarchy-assignment', 'HierarchyAssignment', 'leads'),
        ('/enquiries/:id', 'EnquiryProfileView', 'leads'),
        ('/customers', 'CustomersPage', 'leads'),
        ('/customers/:id', 'CustomerProfileView', 'leads'),
        ('/loyalty', 'LoyaltyPage', 'leads'),
        ('/franchise/*', 'FranchisePage', 'leads'),
        ('/hr/*', 'StaffManagementPage', 'hr'),
        ('/attendance', 'AttendancePage', 'hr'),
        ('/my-leave-requests', 'LeaveRequestsPage', 'hr'),
        ('/leave-requests', 'LeaveRequestCard', 'hr'),
        ('/inventory/*', 'StockManagementPage', 'inventory'),
        ('/billing/*', 'BillingRevenuePage', 'billing'),
        ('/tasks/*', 'TasksPage', 'All'),
        ('/tickets/*', 'TicketsPage', 'All'),
        ('/tickets/:id', 'TicketDetails', 'All'),
        ('/documents/*', 'DocumentsPage', 'All'),
        ('/reports/*', 'ReportsPage', 'reports'),
        ('/users/list', 'UsersPage', 'users'),
        ('/users/roles', 'RolesPage', 'roles'),
        ('/users/hospitals', 'HospitalManagementPage', 'admin'),
        ('/notes', 'NotesSection', 'All'),
        ('/follow-up', 'FollowUpSection', 'All'),
        ('/employee/:id', 'EmployeeDetail', 'hr'),
    ]
    header_row = [
        Paragraph('Route', styles['table_header']),
        Paragraph('Component', styles['table_header']),
        Paragraph('Permission', styles['table_header']),
    ]
    route_rows = [header_row]
    for path, comp, perm in routes:
        route_rows.append([
            Paragraph(path, ParagraphStyle('rp', fontSize=8, fontName='Courier', textColor=TEAL_500, leading=11)),
            Paragraph(comp, ParagraphStyle('cp', fontSize=8, fontName='Helvetica-Bold', textColor=GRAY_700, leading=11)),
            Paragraph(perm, ParagraphStyle('pp', fontSize=8, fontName='Helvetica', textColor=GRAY_500, leading=11)),
        ])

    rt = Table(route_rows,
               colWidths=[65*mm, 70*mm, 35*mm],
               repeatRows=1)
    rt.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (-1,0), DARK_NAVY),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[white, GRAY_50]),
        ('BOX',          (0,0), (-1,-1), 0.5, GRAY_200),
        ('INNERGRID',    (0,0), (-1,-1), 0.3, GRAY_200),
        ('TOPPADDING',   (0,0), (-1,-1), 4),
        ('BOTTOMPADDING',(0,0),(-1,-1), 4),
        ('LEFTPADDING',  (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('VALIGN',       (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(rt)
    story.append(sp(8))

    story.append(hr(GRAY_200))
    story.append(Paragraph(
        f'© {datetime.date.today().year} CubeMed HIS · avopay.pro · Document auto-generated {today}',
        styles['caption']
    ))

    return story


# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    doc = SimpleDocTemplate(
        OUTPUT_PATH,
        pagesize=A4,
        leftMargin=20*mm,
        rightMargin=20*mm,
        topMargin=22*mm,
        bottomMargin=22*mm,
        title='CubeMed HIS — Complete UI Documentation',
        author='Kiro AI',
        subject='Hospital Information System Documentation',
    )

    story = build_story()

    # Use two page templates: cover page (no header/footer) and normal pages
    def on_normal_page(canvas, doc):
        if doc.page == 1:
            on_cover_page(canvas, doc)
        else:
            on_page(canvas, doc)

    doc.build(story, onFirstPage=on_cover_page, onLaterPages=on_page)
    print(f'✅ PDF generated: {OUTPUT_PATH}')


if __name__ == '__main__':
    main()
