import os
import sys

# Text templates for the test cases
TC001_PRESCRIPTION = """------------------------------------------------
CITY CLINIC
Dr. Sharma, MBBS, MD (General Medicine)
Reg No: KA/45678/2015
12, MG Road, Bengaluru, Karnataka - 560001
------------------------------------------------
Date: 2024-11-01

Patient Name: Rajesh Kumar
Age/Sex: 34 / Male

Diagnosis: Viral fever

Rx:
1. Tab. Paracetamol 650mg - 1 tab three times a day for 5 days
2. Tab. Vitamin C 500mg - 1 tab once a day for 10 days

Investigations Advised:
- Complete Blood Count (CBC)
- Dengue Test

[Signature & Stamp]
Dr. Sharma
------------------------------------------------"""

TC001_BILL = """------------------------------------------------
CITY CLINIC & DIAGNOSTICS
12, MG Road, Bengaluru, Karnataka - 560001
------------------------------------------------
Bill No: CC-2024-9988          Date: 2024-11-01

Patient Name: Rajesh Kumar
Ref By: Dr. Sharma

PARTICULARS                         AMOUNT
------------------------------------------------
Consultation Fee                    ₹ 1000.00
Diagnostic Tests (CBC & Dengue)     ₹  500.00
------------------------------------------------
TOTAL AMOUNT DUE:                  ₹ 1500.00
------------------------------------------------
Payment Status: PAID (UPI Transaction)
------------------------------------------------"""

TC002_PRESCRIPTION = """------------------------------------------------
SMILE DENTAL CARE
Dr. Patel, MDS (Endodontics)
Reg No: MH/23456/2018
45, Linking Road, Mumbai, MH - 400050
------------------------------------------------
Date: 2024-10-15

Patient Name: Priya Singh
Age/Sex: 28 / Female

Diagnosis: Tooth decay requiring root canal

Treatment Advised:
1. Root canal treatment
2. Teeth whitening

[Signature & Stamp]
Dr. Patel
------------------------------------------------"""

TC002_BILL = """------------------------------------------------
SMILE DENTAL CARE
45, Linking Road, Mumbai, MH - 400050
------------------------------------------------
Bill No: SDC-1234              Date: 2024-10-15

Patient Name: Priya Singh
Ref By: Dr. Patel

PARTICULARS                         AMOUNT
------------------------------------------------
Root Canal Procedure                ₹  8000.00
Teeth Whitening (Cosmetic)          ₹  4000.00
------------------------------------------------
TOTAL AMOUNT DUE:                  ₹ 12000.00
------------------------------------------------
Payment Status: PAID (Card)
------------------------------------------------"""

def generate_pdfs():
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas
    except ImportError:
        print("ReportLab library not installed. Please install it using: pip install reportlab")
        return False

    os.makedirs("test_documents", exist_ok=True)
    
    docs = {
        "test_documents/prescription_tc001.pdf": TC001_PRESCRIPTION,
        "test_documents/bill_tc001.pdf": TC001_BILL,
        "test_documents/prescription_tc002.pdf": TC002_PRESCRIPTION,
        "test_documents/bill_tc002.pdf": TC002_BILL,
    }
    
    for filename, text in docs.items():
        c = canvas.Canvas(filename, pagesize=letter)
        width, height = letter
        y = height - 50
        
        # Use a monospaced font so lines align perfectly
        c.setFont("Courier", 10)
        
        for line in text.split('\n'):
            if y < 50:
                c.showPage()
                c.setFont("Courier", 10)
                y = height - 50
            c.drawString(50, y, line)
            y -= 15
            
        c.save()
        print(f"Generated: {filename}")
        
    print("\nSuccess! All test documents generated in the './test_documents' folder.")
    return True

if __name__ == "__main__":
    generate_pdfs()
