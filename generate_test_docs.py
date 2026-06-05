import os
import sys

# Define all document templates
TC_DOCS = {
    "TC001": {
        "prescription": """------------------------------------------------
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
------------------------------------------------""",
        "bill": """------------------------------------------------
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
    },
    "TC002": {
        "prescription": """------------------------------------------------
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
------------------------------------------------""",
        "bill": """------------------------------------------------
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
    },
    "TC003": {
        "prescription": """------------------------------------------------
GENERAL HOSPITAL
Dr. Gupta, MD (Internal Medicine)
Reg No: DL/34567/2016
88, Ring Road, New Delhi - 110002
------------------------------------------------
Date: 2024-10-20

Patient Name: Amit Verma
Age/Sex: 42 / Male

Diagnosis: Gastroenteritis

Rx:
1. Tab. Antibiotic 500mg - twice daily for 5 days
2. Cap. Probiotics - once daily for 10 days
3. ORS sachet - in case of dehydration

[Signature & Stamp]
Dr. Gupta
------------------------------------------------""",
        "bill": """------------------------------------------------
GENERAL HOSPITAL & PHARMACY
88, Ring Road, New Delhi - 110002
------------------------------------------------
Bill No: GH-2024-7762          Date: 2024-10-20

Patient Name: Amit Verma
Ref By: Dr. Gupta

PARTICULARS                         AMOUNT
------------------------------------------------
Consultation Fee                    ₹ 2000.00
Pharmacy & Medicine charges         ₹ 5500.00
------------------------------------------------
TOTAL AMOUNT DUE:                  ₹ 7500.00
------------------------------------------------
Payment Status: PAID (Cash)
------------------------------------------------"""
    },
    "TC004": {
        # TC004 simulates a missing document (no prescription), so only the bill is generated!
        "bill": """------------------------------------------------
LOCAL HEALTH CLINIC
10, Station Road, Hyderabad - 500002
------------------------------------------------
Bill No: LC-5431               Date: 2024-10-25

Patient Name: Sneha Reddy
Ref By: Dr. Naidu

PARTICULARS                         AMOUNT
------------------------------------------------
Consultation Fee                    ₹ 1500.00
Pharmacy charges                    ₹  500.00
------------------------------------------------
TOTAL AMOUNT DUE:                  ₹ 2000.00
------------------------------------------------
Payment Status: PAID (UPI)
------------------------------------------------"""
    },
    "TC005": {
        "prescription": """------------------------------------------------
DIABETES CARE CENTER
Dr. Mehta, MD (Endocrinology)
Reg No: GJ/56789/2014
77, SG Highway, Ahmedabad, Gujarat - 380054
------------------------------------------------
Date: 2024-10-15

Patient Name: Vikram Joshi
Age/Sex: 55 / Male

Diagnosis: Type 2 Diabetes

Rx:
1. Tab. Metformin 500mg - twice daily with meals
2. Tab. Glimepiride 1mg - once daily before breakfast

[Signature & Stamp]
Dr. Mehta
------------------------------------------------""",
        "bill": """------------------------------------------------
DIABETES CARE CENTER
77, SG Highway, Ahmedabad, Gujarat - 380054
------------------------------------------------
Bill No: DCC-2499              Date: 2024-10-15

Patient Name: Vikram Joshi
Ref By: Dr. Mehta

PARTICULARS                         AMOUNT
------------------------------------------------
Endocrinologist Consultation        ₹ 1000.00
Pharmacy (Metformin & Glimepiride)  ₹ 2000.00
------------------------------------------------
TOTAL AMOUNT DUE:                  ₹ 3000.00
------------------------------------------------
Payment Status: PAID (Card)
------------------------------------------------"""
    },
    "TC006": {
        "prescription": """------------------------------------------------
AYURVEDA WELLNESS CENTER
Vaidya Krishnan, BAMS, MS (Ayurveda)
Reg No: AYUR/KL/2345/2019
99, Beach Road, Kochi, Kerala - 682001
------------------------------------------------
Date: 2024-10-28

Patient Name: Kavita Nair
Age/Sex: 45 / Female

Diagnosis: Chronic joint pain

Treatment Prescribed:
1. Panchakarma therapy - 3 sessions
2. Ayurvedic herbal oils for massage

[Signature & Stamp]
Vaidya Krishnan
------------------------------------------------""",
        "bill": """------------------------------------------------
AYURVEDA WELLNESS CENTER
99, Beach Road, Kochi, Kerala - 682001
------------------------------------------------
Bill No: AWC-4455              Date: 2024-10-28

Patient Name: Kavita Nair
Ref By: Vaidya Krishnan

PARTICULARS                         AMOUNT
------------------------------------------------
Ayurvedic Consultation Fee          ₹ 1000.00
Panchakarma Therapy charges         ₹ 3000.00
------------------------------------------------
TOTAL AMOUNT DUE:                  ₹ 4000.00
------------------------------------------------
Payment Status: PAID (Card)
------------------------------------------------"""
    },
    "TC007": {
        "prescription": """------------------------------------------------
SPINE & NEURO CLINIC
Dr. Rao, MS, MCh (Neurosurgery)
Reg No: AP/67890/2017
120, VIP Road, Visakhapatnam, AP - 530003
------------------------------------------------
Date: 2024-11-02

Patient Name: Suresh Patil
Age/Sex: 50 / Male

Diagnosis: Suspected lumbar disc herniation

Investigations Advised:
- MRI Lumbar Spine (Pre-authorization required if cost exceeds limit)

[Signature & Stamp]
Dr. Rao
------------------------------------------------""",
        "bill": """------------------------------------------------
IMAGING CENTER & DIAGNOSTICS
150, Beach Road, Visakhapatnam, AP - 530003
------------------------------------------------
Bill No: IC-9900               Date: 2024-11-02

Patient Name: Suresh Patil
Ref By: Dr. Rao

PARTICULARS                         AMOUNT
------------------------------------------------
MRI Lumbar Spine Scan               ₹ 15000.00
------------------------------------------------
TOTAL AMOUNT DUE:                  ₹ 15000.00
------------------------------------------------
Payment Status: PAID (Net Banking)
------------------------------------------------"""
    },
    "TC008": {
        "prescription": """------------------------------------------------
GENERAL HOSPITAL
Dr. Khan, MD (Neurology)
Reg No: UP/45678/2016
23, Civil Lines, Lucknow, UP - 226001
------------------------------------------------
Date: 2024-10-30

Patient Name: Ravi Menon
Age/Sex: 38 / Male

Diagnosis: Migraine

Rx:
1. Tab. Sumatriptan 50mg - twice daily as needed
2. Tab. Propranolol 40mg - once daily for 30 days

[Signature & Stamp]
Dr. Khan
------------------------------------------------""",
        "bill": """------------------------------------------------
GENERAL HOSPITAL & PHARMACY
23, Civil Lines, Lucknow, UP - 226001
------------------------------------------------
Bill No: GH-2024-1100          Date: 2024-10-30

Patient Name: Ravi Menon
Ref By: Dr. Khan

PARTICULARS                         AMOUNT
------------------------------------------------
Neurologist Consultation            ₹ 2000.00
Pharmacy (Sumatriptan/Propranolol)  ₹ 2800.00
------------------------------------------------
TOTAL AMOUNT DUE:                  ₹ 4800.00
------------------------------------------------
Payment Status: PAID (Card)
------------------------------------------------"""
    },
    "TC009": {
        "prescription": """------------------------------------------------
WEIGHT LOSS CLINIC
Dr. Banerjee, MD (Dietetics)
Reg No: WB/34567/2015
56, Park Street, Kolkata, WB - 700016
------------------------------------------------
Date: 2024-10-18

Patient Name: Anita Desai
Age/Sex: 31 / Female

Diagnosis: Obesity - BMI 35

Treatment Prescribed:
1. Bariatric consultation
2. Dietary counseling & Weight loss program

[Signature & Stamp]
Dr. Banerjee
------------------------------------------------""",
        "bill": """------------------------------------------------
WEIGHT LOSS CLINIC
56, Park Street, Kolkata, WB - 700016
------------------------------------------------
Bill No: WLC-8899              Date: 2024-10-18

Patient Name: Anita Desai
Ref By: Dr. Banerjee

PARTICULARS                         AMOUNT
------------------------------------------------
Bariatric Consultation Fee          ₹ 3000.00
Weight loss program (1 month)       ₹ 500.00
Dietary counseling fee             ₹ 4500.00
------------------------------------------------
TOTAL AMOUNT DUE:                  ₹ 8000.00
------------------------------------------------
Payment Status: PAID (UPI)
------------------------------------------------"""
    },
    "TC010": {
        "prescription": """------------------------------------------------
APOLLO HOSPITALS
Dr. Iyer, MD (Pulmonary Medicine)
Reg No: TN/56789/2013
21, Greams Road, Chennai, TN - 600006
------------------------------------------------
Date: 2024-11-03

Patient Name: Deepak Shah
Age/Sex: 29 / Male

Diagnosis: Acute bronchitis

Rx:
1. Tab. Antibiotics - twice daily for 7 days
2. Tab. Bronchodilators - three times daily for 5 days
3. Cough syrup - 10ml three times daily

[Signature & Stamp]
Dr. Iyer
------------------------------------------------""",
        "bill": """------------------------------------------------
APOLLO HOSPITALS
21, Greams Road, Chennai, TN - 600006
------------------------------------------------
Bill No: AH-54321              Date: 2024-11-03

Patient Name: Deepak Shah
Ref By: Dr. Iyer

PARTICULARS                         AMOUNT
------------------------------------------------
Consultation Fee (Pulmonology)      ₹ 1500.00
Pharmacy & Medication charges       ₹ 3000.00
------------------------------------------------
TOTAL AMOUNT DUE:                  ₹ 4500.00
------------------------------------------------
Payment Status: PENDING (Cashless Pre-Auth Requested)
------------------------------------------------"""
    }
}

def generate_pdfs():
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas
    except ImportError:
        print("[ERROR] ReportLab library not installed. Installing it now...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "reportlab"])
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas

    output_dir = "test_documents"
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"Generating test PDFs in ./{output_dir}...")
    
    count = 0
    for tc_name, docs in TC_DOCS.items():
        for doc_type, text in docs.items():
            filename = f"{output_dir}/{doc_type}_{tc_name.lower()}.pdf"
            c = canvas.Canvas(filename, pagesize=letter)
            width, height = letter
            y = height - 50
            
            c.setFont("Courier", 10)
            
            for line in text.split('\n'):
                if y < 50:
                    c.showPage()
                    c.setFont("Courier", 10)
                    y = height - 50
                c.drawString(50, y, line)
                y -= 15
                
            c.save()
            print(f"  [OK] Generated: {filename}")
            count += 1
            
    print(f"\n[OK] Success! Generated {count} test PDFs for all test cases (TC001 to TC010).")
    return True

if __name__ == "__main__":
    generate_pdfs()
