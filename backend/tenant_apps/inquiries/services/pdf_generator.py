"""
PDF Quote Generator for Inquiries

Generates professional PDF quotes from inquiry data using ReportLab.
"""
from io import BytesIO
from decimal import Decimal
from datetime import date

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable
)
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER


class InquiryPDFGenerator:
    """
    Generates PDF quotes from Inquiry objects.
    
    Usage:
        generator = InquiryPDFGenerator(inquiry)
        pdf_buffer = generator.generate()
    """
    
    def __init__(self, inquiry, tenant=None):
        """
        Initialize the PDF generator.
        
        Args:
            inquiry: The Inquiry model instance
            tenant: Optional tenant for company branding
        """
        self.inquiry = inquiry
        self.tenant = tenant or inquiry.tenant
        self.buffer = BytesIO()
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
    
    def _setup_custom_styles(self):
        """Set up custom paragraph styles for the PDF."""
        self.styles.add(ParagraphStyle(
            name='QuoteTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#1a365d'),
            spaceAfter=12,
            alignment=TA_CENTER,
        ))
        
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor('#2d3748'),
            spaceBefore=16,
            spaceAfter=8,
        ))
        
        self.styles.add(ParagraphStyle(
            name='InfoLabel',
            parent=self.styles['Normal'],
            fontSize=9,
            textColor=colors.HexColor('#718096'),
        ))
        
        self.styles.add(ParagraphStyle(
            name='InfoValue',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#2d3748'),
        ))
        
        self.styles.add(ParagraphStyle(
            name='TotalLabel',
            parent=self.styles['Normal'],
            fontSize=12,
            textColor=colors.HexColor('#2d3748'),
            alignment=TA_RIGHT,
        ))
        
        self.styles.add(ParagraphStyle(
            name='TotalValue',
            parent=self.styles['Normal'],
            fontSize=14,
            textColor=colors.HexColor('#1a365d'),
            fontName='Helvetica-Bold',
            alignment=TA_RIGHT,
        ))
        
        self.styles.add(ParagraphStyle(
            name='Footer',
            parent=self.styles['Normal'],
            fontSize=8,
            textColor=colors.HexColor('#a0aec0'),
            alignment=TA_CENTER,
        ))
        
        self.styles.add(ParagraphStyle(
            name='Notes',
            parent=self.styles['Normal'],
            fontSize=9,
            textColor=colors.HexColor('#4a5568'),
            spaceBefore=8,
        ))
    
    def _format_currency(self, value):
        """Format a decimal value as currency."""
        if value is None:
            return '-'
        return f"${value:,.2f}"
    
    def _format_date(self, dt):
        """Format a date for display."""
        if dt is None:
            return '-'
        if isinstance(dt, date):
            return dt.strftime('%B %d, %Y')
        return str(dt)
    
    def _build_header(self):
        """Build the document header with company info and quote title."""
        elements = []
        
        # Company name (from tenant or default)
        company_name = getattr(self.tenant, 'name', 'ProjectMeats')
        elements.append(Paragraph(company_name, self.styles['QuoteTitle']))
        elements.append(Spacer(1, 4))
        
        # Quote subtitle
        elements.append(Paragraph(
            f"Quote #{self.inquiry.inquiry_number}",
            self.styles['Heading2']
        ))
        elements.append(Spacer(1, 12))
        
        return elements
    
    def _build_info_section(self):
        """Build the quote info and contact sections."""
        elements = []
        
        # Create a two-column layout for quote info and contact
        left_col = []
        right_col = []
        
        # Quote info (left column)
        left_col.append(Paragraph("QUOTE INFORMATION", self.styles['SectionHeader']))
        
        quote_data = [
            ('Quote Date:', self._format_date(self.inquiry.inquiry_date or date.today())),
            ('Valid Until:', self._format_date(self.inquiry.valid_until)),
            ('Status:', self.inquiry.status.replace('_', ' ').title()),
        ]
        
        if self.inquiry.quoted_date:
            quote_data.append(('Quoted Date:', self._format_date(self.inquiry.quoted_date)))
        
        for label, value in quote_data:
            left_col.append(Paragraph(f"<b>{label}</b> {value}", self.styles['InfoValue']))
        
        # Contact info (right column)
        right_col.append(Paragraph("BILL TO", self.styles['SectionHeader']))
        
        if self.inquiry.contact_name:
            right_col.append(Paragraph(
                f"<b>{self.inquiry.contact_name}</b>",
                self.styles['InfoValue']
            ))
        
        if self.inquiry.contact_company:
            right_col.append(Paragraph(
                self.inquiry.contact_company,
                self.styles['InfoValue']
            ))
        
        if self.inquiry.contact_position:
            right_col.append(Paragraph(
                self.inquiry.contact_position,
                self.styles['InfoValue']
            ))
        
        if self.inquiry.contact_email:
            right_col.append(Paragraph(
                self.inquiry.contact_email,
                self.styles['InfoValue']
            ))
        
        if self.inquiry.contact_phone:
            right_col.append(Paragraph(
                self.inquiry.contact_phone,
                self.styles['InfoValue']
            ))
        
        # Create two-column table
        info_table = Table(
            [[left_col, right_col]],
            colWidths=[3.5 * inch, 3.5 * inch]
        )
        info_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ]))
        
        elements.append(info_table)
        elements.append(Spacer(1, 20))
        
        return elements
    
    def _build_products_table(self):
        """Build the products/line items table."""
        elements = []
        
        elements.append(Paragraph("LINE ITEMS", self.styles['SectionHeader']))
        elements.append(Spacer(1, 8))
        
        # Table headers
        headers = ['Product', 'Qty', 'UOM', 'Unit Price', 'Total']
        
        # Table data
        table_data = [headers]
        
        products = self.inquiry.products.all().select_related('product')
        
        for ip in products:
            product_name = (
                getattr(ip.product, 'name', None)
                or getattr(ip.product, 'product_code', None)
                or getattr(ip.product, 'description', None)
                or 'Unknown Product'
            )
            if len(product_name) > 40:
                product_name = product_name[:40] + '...'
            
            # Use actual values if available, otherwise desired
            qty = ip.actual_uom_value or ip.desired_uom_value or 0
            uom = ip.actual_uom or ip.desired_uom or '-'
            price = ip.actual_price_per_unit or ip.desired_price_per_unit
            total = ip.actual_total or ip.desired_total
            
            table_data.append([
                product_name,
                f"{qty:,.2f}" if qty else '-',
                uom,
                self._format_currency(price),
                self._format_currency(total),
            ])
        
        # Create table
        col_widths = [3 * inch, 0.7 * inch, 0.6 * inch, 1 * inch, 1 * inch]
        products_table = Table(table_data, colWidths=col_widths)
        
        # Table styling
        products_table.setStyle(TableStyle([
            # Header row
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a365d')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('TOPPADDING', (0, 0), (-1, 0), 10),
            
            # Data rows
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
            ('TOPPADDING', (0, 1), (-1, -1), 8),
            
            # Alignment
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            
            # Grid
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            
            # Alternating row colors
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7fafc')]),
        ]))
        
        elements.append(products_table)
        elements.append(Spacer(1, 16))
        
        return elements
    
    def _build_totals(self):
        """Build the totals section."""
        elements = []
        
        # Calculate totals
        total_desired = self.inquiry.total_desired or Decimal('0.00')
        total_actual = self.inquiry.total_actual or Decimal('0.00')
        
        # Use actual if available, otherwise desired
        display_total = total_actual if total_actual > 0 else total_desired
        
        # Totals table (right-aligned)
        totals_data = []
        
        if total_desired > 0 and total_actual > 0 and total_desired != total_actual:
            totals_data.append(['Original Quote:', self._format_currency(total_desired)])
            totals_data.append(['', ''])
        
        totals_data.append([
            Paragraph('<b>TOTAL:</b>', self.styles['TotalLabel']),
            Paragraph(f'<b>{self._format_currency(display_total)}</b>', self.styles['TotalValue'])
        ])
        
        totals_table = Table(totals_data, colWidths=[5 * inch, 1.5 * inch])
        totals_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        
        elements.append(totals_table)
        elements.append(Spacer(1, 20))
        
        return elements
    
    def _build_notes(self):
        """Build the notes section if there are notes."""
        elements = []
        
        if self.inquiry.notes:
            elements.append(Paragraph("NOTES & TERMS", self.styles['SectionHeader']))
            elements.append(Paragraph(self.inquiry.notes, self.styles['Notes']))
            elements.append(Spacer(1, 16))
        
        return elements
    
    def _build_footer(self):
        """Build the document footer."""
        elements = []
        
        elements.append(HRFlowable(
            width="100%",
            thickness=1,
            color=colors.HexColor('#e2e8f0'),
            spaceAfter=8,
        ))
        
        footer_text = (
            "This quote is valid until the date specified above. "
            "Prices are subject to change after the validity period. "
            "Thank you for your business!"
        )
        elements.append(Paragraph(footer_text, self.styles['Footer']))
        
        return elements
    
    def generate(self):
        """
        Generate the PDF document.
        
        Returns:
            BytesIO: Buffer containing the PDF data
        """
        doc = SimpleDocTemplate(
            self.buffer,
            pagesize=letter,
            rightMargin=0.75 * inch,
            leftMargin=0.75 * inch,
            topMargin=0.5 * inch,
            bottomMargin=0.5 * inch,
        )
        
        elements = []
        
        # Build document sections
        elements.extend(self._build_header())
        elements.extend(self._build_info_section())
        elements.extend(self._build_products_table())
        elements.extend(self._build_totals())
        elements.extend(self._build_notes())
        elements.extend(self._build_footer())
        
        # Build the PDF
        doc.build(elements)
        
        self.buffer.seek(0)
        return self.buffer
    
    def get_filename(self):
        """Get a suggested filename for the PDF."""
        return f"Quote-{self.inquiry.inquiry_number}.pdf"
