from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import os
from fpdf import FPDF
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from datetime import datetime
def generate_quotation_pdf(
    lead_id,
    amount,
    milestones,
    client_name=None,
    created_at=None,
    quotation_number=None,
    status=None,
    expiry_date=None,
    bank_no="123456789",
    bank_name="Bank of Bharat",
    pay_email="amit@gmail.com",
    pay_phone="+91-1234567890"
):
    pdf_dir = "static/pdfs"
    os.makedirs(pdf_dir, exist_ok=True)
    pdf_path = os.path.join(pdf_dir, f"quotation_{lead_id}.pdf")

    doc = SimpleDocTemplate(pdf_path, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    elements = []

    styles = getSampleStyleSheet()
    # Custom styles
    styles.add(ParagraphStyle(name='InvoiceTitle', fontSize=28, leading=34, textColor=colors.HexColor("#14A44D"), alignment=1, spaceAfter=18, fontName="Helvetica-Bold"))
    styles.add(ParagraphStyle(name='Header', fontSize=11, leading=13, spaceAfter=5, fontName="Helvetica"))
    styles.add(ParagraphStyle(name='SectionHeader', fontSize=12, leading=14, textColor=colors.HexColor("#14A44D"), fontName="Helvetica-Bold"))
    styles.add(ParagraphStyle(name='Bold', fontSize=11, leading=13, fontName="Helvetica-Bold"))
    styles.add(ParagraphStyle(name='Footer', fontSize=10, leading=12, textColor=colors.HexColor("#14A44D"), fontName="Helvetica-Bold"))
    styles.add(ParagraphStyle(name='Small', fontSize=9, leading=11, fontName="Helvetica"))
    styles.add(ParagraphStyle(name='Status', fontSize=12, leading=14, fontName="Helvetica-Bold", textColor=colors.HexColor("#14A44D"), alignment=1, spaceAfter=15))

    # --- Logo/Banner ---
    elements.append(Spacer(1, 12))
    elements.append(Paragraph('<font color="#14A44D" size=18><b>BHARAT ECOFUELS</b></font>', styles['Header']))
    elements.append(Spacer(1, 6))

    # --- Invoice Title ---
    elements.append(Paragraph("INVOICE", styles['InvoiceTitle']))

    # --- Status & Quotation Number ---
    if quotation_number or status:
        stxt = f"Status: <b>{status.title()}</b>" if status else ""
        qtxt = f"Quotation No: <b>{quotation_number}</b>" if quotation_number else ""
        info = f"{stxt}   {qtxt}"
        if info.strip():
            elements.append(Paragraph(info, styles['Status']))
        elements.append(Spacer(1, 5))

    # --- Invoice Info Row ---
    date_str = created_at.strftime("%d %B %Y") if created_at else datetime.now().strftime("%d %B %Y")
    exp_str = expiry_date.strftime("%d %B %Y") if expiry_date else "-"
    invoice_to = client_name or "Client"
    info_data = [
        [
            Paragraph(f"<b>Invoice Date :</b><br/>{date_str}", styles['Header']),
            Paragraph(f"<b>Expiry Date :</b><br/>{exp_str}", styles['Header']),
            Paragraph(f"<b>Invoice to :</b><br/>{invoice_to}", styles['Header']),
        ]
    ]
    info_table = Table(info_data, colWidths=[130, 130, 220])
    info_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 18))

    # --- Milestone Table: Only PAYMENT and STATUS ---
    table_data = [
        [
            Paragraph('<b>PAYMENT</b>', styles['SectionHeader']),
            Paragraph('<b>STATUS</b>', styles['SectionHeader']),
        ]
    ]
    for m in milestones:
        amt = m.get("amount", 0)
        paid = m.get("paid", False)
        table_data.append([
            Paragraph(f"Rs. {amt:,.0f}", styles['Header']),
            Paragraph("Paid" if paid else "Unpaid", styles['Header']),
        ])

    table = Table(table_data, colWidths=[160, 160])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#14A44D")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('ALIGN', (0,1), (-1,-1), 'CENTER'),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('LINEBELOW', (0,0), (-1,0), 2, colors.white),
        ('LINEABOVE', (0,-1), (-1,-1), 1, colors.HexColor("#14A44D")),
        ('GRID', (0,1), (-1,-1), 0.5, colors.black),
        ('BACKGROUND', (0,1), (-1,-1), colors.white),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 8),
    ]))
    elements.append(table)
    elements.append(Spacer(1, 18))

    # --- Totals Section ---
    paid_amount = sum(m.get("amount", 0) for m in milestones if m.get("paid"))
    remaining = amount - paid_amount
    totals_data = [
        [Paragraph('<b>Total Quotation Amount:</b>', styles['Header']), Paragraph(f"Rs. {amount:,.0f}", styles['Header'])],
        [Paragraph('<b>Total Paid:</b>', styles['Header']), Paragraph(f"Rs. {paid_amount:,.0f}", styles['Header'])],
        [Paragraph('<b>Remaining:</b>', styles['Header']), Paragraph(f"Rs. {remaining:,.0f}", styles['Header'])]
    ]
    totals_table = Table(totals_data, colWidths=[200, 120])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (1,0), (1,-1), 'RIGHT'),
        ('LINEBELOW', (0,-1), (-1,-1), 1, colors.HexColor("#14A44D")),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 20))

    # --- Footer: Payment & Contact Info ---
    payment_data = [
        [
            Paragraph('<b>SEND PAYMENT TO</b>', styles['Footer']),
            Paragraph('<b>CONTACT</b>', styles['Footer'])
        ],
        [
            Paragraph(
                f"Bank No: <b>{bank_no}</b><br/>Bank Name: <b>{bank_name}</b>",
                styles['Small']
            ),
            Paragraph(
                f"{pay_email}<br/>{pay_phone}",
                styles['Small']
            )
        ]
    ]
    payment_table = Table(payment_data, colWidths=[240, 240])
    payment_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))
    elements.append(payment_table)
    elements.append(Spacer(1, 10))

    doc.build(elements)
    return pdf_path

def generate_invoice_pdf(invoice_data):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    pdf.cell(200, 10, txt="GST Invoice", ln=True, align="C")
    pdf.output("invoice.pdf")
    return "path_or_url_to_invoice.pdf"