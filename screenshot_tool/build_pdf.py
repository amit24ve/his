#!/usr/bin/env python3
"""
CubeMed HIS — UI Screenshots PDF Builder
Assembles all captured screenshots into a clean, labelled PDF.
"""

import os
import glob
from PIL import Image
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white
from reportlab.platypus import (
    SimpleDocTemplate, Image as RLImage, Spacer, Paragraph,
    PageBreak, Table, TableStyle
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
import datetime

SHOTS_DIR = '/www/wwwroot/HIS/screenshot_tool/shots'
OUT_PDF   = '/www/wwwroot/HIS/CubeMed_HIS_UI_Screenshots.pdf'

DARK_NAVY = HexColor('#0f172a')
NAVY      = HexColor('#1e293b')
BLUE_600  = HexColor('#2563eb')
BLUE_400  = HexColor('#60a5fa')
TEAL_500  = HexColor('#14b8a6')
GRAY_100  = HexColor('#f1f5f9')
GRAY_500  = HexColor('#64748b')

# Page labels (filename_stem → nice title)
PAGE_TITLES = {
    '01_login':          'Login Screen',
    '02_dashboard':      'Dashboard — KPIs & Overview',
    '03_appointments':   'Appointments Management',
    '04_reception':      'Reception',
    '05_patient_reg':    'Patient Registration',
    '06_patient_portal': 'Patient Portal',
    '07_opd':            'OPD Management',
    '08_ipd':            'IPD / Ward Management',
    '09_emr':            'EMR / Prescriptions',
    '10_nursing':        'Nursing Station',
    '11_ot':             'OT Management',
    '12_teleconsult':    'Teleconsultation',
    '13_pharmacy':       'Pharmacy',
    '14_laboratory':     'Laboratory',
    '15_radiology':      'Radiology',
    '16_blood_bank':     'Blood Bank',
    '17_billing':        'Billing & Revenue',
    '18_insurance':      'Insurance / TPA',
    '19_certificates':   'Certificates',
    '20_doctors':        'Doctor Management',
    '21_departments':    'Department Management',
    '22_leads':          'Leads Management',
    '23_assigned_leads': 'Assigned Leads',
    '24_customers':      'Customers (CRM)',
    '25_loyalty':        'Loyalty Program',
    '26_franchise':      'Franchise Management',
    '27_hr_staff':       'HR & Staff Management',
    '28_attendance':     'Attendance Management',
    '29_leave_req':      'Leave Requests',
    '30_inventory':      'Stock / Inventory',
    '31_reports':        'MIS Reports & Analytics',
    '32_tasks':          'Task Management',
    '33_tickets':        'Support Tickets',
    '34_documents':      'Document Store',
    '35_users':          'User Management',
    '36_roles':          'Roles & Permissions',
    '37_hospitals':      'Hospital Management',
    '38_hierarchy':      'User Hierarchy Assignment',
    '39_notes':          'Notes',
    '40_followup':       'Follow-up Management',
}

def page_size_for_image(img_path, page_w, page_h, margin):
    """Compute drawing dimensions keeping aspect ratio, fitting within page."""
    with Image.open(img_path) as im:
        iw, ih = im.size
    avail_w = page_w - 2 * margin
    avail_h = page_h - 2 * margin - 20 * mm   # space for header bar
    ratio = min(avail_w / iw, avail_h / ih)
    return iw * ratio, ih * ratio


def on_page(canvas, doc):
    W, H = A4
    canvas.saveState()
    # Top accent bar
    canvas.setFillColor(BLUE_600)
    canvas.rect(0, H - 8*mm, W, 8*mm, fill=1, stroke=0)
    # Bottom footer
    canvas.setFillColor(DARK_NAVY)
    canvas.rect(0, 0, W, 12*mm, fill=1, stroke=0)
    canvas.setFillColor(BLUE_400)
    canvas.setFont('Helvetica-Bold', 7)
    canvas.drawString(12*mm, 4*mm, 'CubeMed HIS v6.0 — UI Documentation')
    canvas.setFillColor(HexColor('#64748b'))
    canvas.setFont('Helvetica', 7)
    canvas.drawRightString(W - 12*mm, 4*mm, f'Page {doc.page}')
    canvas.restoreState()


def on_cover(canvas, doc):
    W, H = A4
    canvas.saveState()
    canvas.setFillColor(DARK_NAVY)
    canvas.rect(0, 0, W, H, fill=1, stroke=0)
    # Top accent
    canvas.setFillColor(BLUE_600)
    canvas.rect(0, H - 40*mm, W, 40*mm, fill=1, stroke=0)
    canvas.setFillColor(TEAL_500)
    canvas.rect(0, H - 42*mm, W, 2*mm, fill=1, stroke=0)
    # Bottom bar
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, W, 35*mm, fill=1, stroke=0)
    canvas.restoreState()


def build_pdf():
    png_files = sorted(glob.glob(os.path.join(SHOTS_DIR, '*.png')))
    if not png_files:
        print(f'No PNG files found in {SHOTS_DIR}')
        return

    print(f'Found {len(png_files)} screenshots. Building PDF...')

    W, H = A4
    margin = 12 * mm

    doc = SimpleDocTemplate(
        OUT_PDF,
        pagesize=A4,
        leftMargin=margin,
        rightMargin=margin,
        topMargin=18*mm,
        bottomMargin=18*mm,
        title='CubeMed HIS — UI Screenshots',
        author='Kiro AI',
    )

    title_style = ParagraphStyle(
        'ts', fontSize=32, fontName='Helvetica-Bold',
        textColor=white, alignment=TA_CENTER, leading=38, spaceAfter=4
    )
    sub_style = ParagraphStyle(
        'ss', fontSize=13, fontName='Helvetica',
        textColor=BLUE_400, alignment=TA_CENTER, leading=18, spaceAfter=3
    )
    meta_style = ParagraphStyle(
        'ms', fontSize=9, fontName='Helvetica',
        textColor=GRAY_500, alignment=TA_CENTER, leading=13
    )
    page_label_style = ParagraphStyle(
        'pl', fontSize=13, fontName='Helvetica-Bold',
        textColor=DARK_NAVY, alignment=TA_LEFT, leading=17,
        spaceBefore=0, spaceAfter=4
    )
    toc_num_style = ParagraphStyle(
        'tn', fontSize=9, fontName='Helvetica-Bold',
        textColor=BLUE_600, leading=13, spaceAfter=0
    )
    toc_title_style = ParagraphStyle(
        'tt', fontSize=9, fontName='Helvetica',
        textColor=HexColor('#374151'), leading=13, spaceAfter=0
    )

    story = []

    # ── Cover page ────────────────────────────────────────────────────────
    story.append(Spacer(1, 38*mm))
    story.append(Paragraph('CubeMed HIS', title_style))
    story.append(Spacer(1, 5*mm))
    story.append(Paragraph('Hospital Information System', sub_style))
    story.append(Paragraph('Complete UI — Screen Captures', sub_style))
    story.append(Spacer(1, 12*mm))
    today = datetime.date.today().strftime('%B %d, %Y')
    story.append(Paragraph(f'Generated: {today}  ·  {len(png_files)} Screens  ·  v6.0', meta_style))
    story.append(Spacer(1, 8*mm))

    # Stats row on cover
    stats_data = [
        ['40', 'UI Screens', '15', 'Modules', '1440px', 'Resolution'],
    ]
    cover_table = Table(
        [[Paragraph(stats_data[0][i*2], ParagraphStyle('cv', fontSize=22, fontName='Helvetica-Bold', textColor=white, alignment=TA_CENTER)),
          Paragraph(stats_data[0][i*2+1], ParagraphStyle('cl', fontSize=9, fontName='Helvetica', textColor=BLUE_400, alignment=TA_CENTER))]
         for i in range(3)],
        colWidths=[28*mm, 28*mm, 28*mm, 28*mm, 28*mm, 28*mm]
    )
    cover_table = Table(
        [[ Paragraph(v, ParagraphStyle(f's{i}', fontSize=20 if i%2==0 else 8,
                                        fontName='Helvetica-Bold' if i%2==0 else 'Helvetica',
                                        textColor=white if i%2==0 else BLUE_400,
                                        alignment=TA_CENTER))
           for i, v in enumerate(stats_data[0]) ]],
        colWidths=[28*mm]*6
    )
    cover_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), NAVY),
        ('BOX',        (0,0), (-1,-1), 1, BLUE_400),
        ('INNERGRID',  (0,0), (-1,-1), 0.5, BLUE_400),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING',(0,0),(-1,-1), 10),
        ('ALIGN',      (0,0), (-1,-1), 'CENTER'),
    ]))
    story.append(cover_table)
    story.append(PageBreak())

    # ── Table of Contents ─────────────────────────────────────────────────
    toc_title_p = ParagraphStyle('toct', fontSize=20, fontName='Helvetica-Bold',
                                  textColor=DARK_NAVY, spaceAfter=8, leading=26)
    story.append(Spacer(1, 6*mm))
    story.append(Paragraph('Table of Contents', toc_title_p))

    # Divider
    from reportlab.platypus import HRFlowable
    story.append(HRFlowable(width='100%', thickness=2, color=BLUE_600, spaceAfter=8))

    toc_rows = []
    for i, f in enumerate(png_files):
        stem = os.path.splitext(os.path.basename(f))[0]
        title = PAGE_TITLES.get(stem, stem.replace('_', ' ').title())
        num   = str(i + 2)  # page 1=cover, 2=TOC, then screenshots from 3
        toc_rows.append([
            Paragraph(f'{i+1:02d}', toc_num_style),
            Paragraph(title, toc_title_style),
            Paragraph(f'pg. {i+3}', ParagraphStyle('pg', fontSize=9, fontName='Helvetica',
                      textColor=GRAY_500, alignment=TA_LEFT, leading=13)),
        ])

    # Split into 2 columns visually by making 2 sub-tables side by side
    mid = (len(toc_rows) + 1) // 2
    left_rows  = toc_rows[:mid]
    right_rows = toc_rows[mid:]
    # pad right side
    while len(right_rows) < len(left_rows):
        right_rows.append(['', '', ''])

    col_w = (W - 2*margin - 8*mm) / 2

    left_t  = Table(left_rows,  colWidths=[10*mm, col_w-26*mm, 16*mm])
    right_t = Table(right_rows, colWidths=[10*mm, col_w-26*mm, 16*mm])

    for t in (left_t, right_t):
        t.setStyle(TableStyle([
            ('ROWBACKGROUNDS', (0,0), (-1,-1), [white, HexColor('#f8fafc')]),
            ('TOPPADDING',     (0,0), (-1,-1), 5),
            ('BOTTOMPADDING',  (0,0), (-1,-1), 5),
            ('LEFTPADDING',    (0,0), (-1,-1), 6),
            ('RIGHTPADDING',   (0,0), (-1,-1), 4),
            ('LINEBELOW',      (0,0), (-1,-1), 0.3, HexColor('#e2e8f0')),
            ('VALIGN',         (0,0), (-1,-1), 'MIDDLE'),
        ]))

    toc_outer = Table([[left_t, Spacer(8*mm, 1), right_t]],
                      colWidths=[col_w, 8*mm, col_w])
    toc_outer.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING',  (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING',   (0,0), (-1,-1), 0),
        ('BOTTOMPADDING',(0,0), (-1,-1), 0),
    ]))
    story.append(toc_outer)
    story.append(PageBreak())

    # ── One screenshot per page ───────────────────────────────────────────
    label_bar_h = 10 * mm

    for i, f in enumerate(png_files):
        stem  = os.path.splitext(os.path.basename(f))[0]
        title = PAGE_TITLES.get(stem, stem.replace('_', ' ').title())
        num   = f'{i+1:02d}'

        # Label bar (colored rectangle + text via Table)
        label_data = [[
            Paragraph(f'<font color="#60a5fa">{num}</font>  {title}',
                      ParagraphStyle('lb', fontSize=12, fontName='Helvetica-Bold',
                                     textColor=DARK_NAVY, leading=15))
        ]]
        label_table = Table(label_data, colWidths=[W - 2*margin])
        label_table.setStyle(TableStyle([
            ('BACKGROUND',    (0,0), (-1,-1), HexColor('#f1f5f9')),
            ('LEFTPADDING',   (0,0), (-1,-1), 10),
            ('TOPPADDING',    (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('BOX',           (0,0), (-1,-1), 1,   HexColor('#e2e8f0')),
            ('LINERIGHT',     (0,0), (0,0),   4,   BLUE_600),
        ]))
        story.append(label_table)
        story.append(Spacer(1, 2*mm))

        # Image — fit to remaining page space
        try:
            dw, dh = page_size_for_image(f, W, H, margin)
            img = RLImage(f, width=dw, height=dh)
            story.append(img)
        except Exception as e:
            story.append(Paragraph(f'[Image error: {e}]', meta_style))

        story.append(PageBreak())

    doc.build(story, onFirstPage=on_cover, onLaterPages=on_page)
    print(f'\n✅ PDF saved: {OUT_PDF}')
    size_kb = os.path.getsize(OUT_PDF) / 1024
    print(f'   Size: {size_kb:.0f} KB  ({size_kb/1024:.1f} MB)')


if __name__ == '__main__':
    build_pdf()
