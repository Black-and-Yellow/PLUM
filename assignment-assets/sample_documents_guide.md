# Sample Medical Documents

## Document Types and Formats

Since we cannot provide actual medical document images, here are detailed descriptions of what typical OPD documents look like. You should create mock versions or use document generation to simulate these.

### 1. Medical Prescription Format

**Standard Elements:**
```
--------------------------------
[Clinic/Hospital Logo]
Dr. [Name], [Qualification]
Reg. No: [State]/[Number]/[Year]
[Clinic Address]
Phone: [Contact]
--------------------------------
Date: DD/MM/YYYY

Patient Name: ________________
Age/Sex: _____________________
Address: _____________________

Chief Complaints:
- [Symptom 1]
- [Symptom 2]

Diagnosis:
[Medical condition]

Rx (Prescription):
1. Tab. [Medicine Name] [Strength]
   [Dosage] x [Duration]
2. Syp. [Medicine Name]
   [Dosage] x [Duration]

Investigations Advised:
- [Test 1]
- [Test 2]

Follow-up: [Date]

[Doctor's Signature]
[Doctor's Stamp]
--------------------------------
```

### 2. Medical Bill/Invoice Format

**Standard Elements:**
```
--------------------------------
[Hospital/Clinic Name]
[Address]
GST No: [Number]
--------------------------------
Bill No: [Number]        Date: DD/MM/YYYY

Patient Details:
Name: ________________
Contact: ______________
Ref. By: Dr. __________

PARTICULARS               AMOUNT
--------------------------------
Consultation Fee          ₹ XXXX
Diagnostic Tests:
- Blood Test             ₹ XXXX
- X-Ray                  ₹ XXXX
Procedures:
- Dressing               ₹ XXXX
Medicines                ₹ XXXX
--------------------------------
Sub Total:               ₹ XXXX
GST (18%):              ₹ XXXX
--------------------------------
TOTAL:                   ₹ XXXX
Amount in Words: _____________

Payment Mode: Cash/Card/UPI
Transaction ID: ______________

[Authorized Signatory]
[Stamp]
--------------------------------
```

### 3. Diagnostic Test Report Format

**Standard Elements:**
```
--------------------------------
[Diagnostic Center Name]
[NABL/CAP Accreditation Number]
--------------------------------
Patient Name: _______________
Age/Sex: ___________________
Ref. By: Dr. _______________
Date: DD/MM/YYYY
Report ID: _________________

TEST NAME         RESULT    NORMAL RANGE
-----------------------------------------
COMPLETE BLOOD COUNT (CBC)
Hemoglobin        14.5      13-17 g/dL
WBC Count         7800      4000-11000
Platelets         250000    150000-450000

LIVER FUNCTION TEST
SGPT              35        10-40 U/L
SGOT              30        10-40 U/L

[Additional tests...]

Remarks: _____________________
Pathologist: Dr. _____________
[Digital Signature]
--------------------------------
```

### 4. Pharmacy Bill Format

**Standard Elements:**
```
--------------------------------
[Pharmacy Name]
Drug License No: [Number]
GST No: [Number]
--------------------------------
Bill No: [Number]    Date: DD/MM/YYYY

Patient: _______________
Doctor: ________________

S.No | Medicine Name | Batch | Exp | Qty | MRP | Amount
--------------------------------------------------------
1    | Paracetamol   | XX123 | 12/25| 10  | 5   | 50
2    | Amoxicillin   | YY456 | 06/25| 14  | 12  | 168

                           Total: ₹ 218
                           GST: ₹ 39
                           Net Amount: ₹ 257

[Pharmacist Signature]
[Stamp]
--------------------------------
```

## Sample Data Patterns to Generate

### Valid Doctor Registration Numbers:
- Karnataka: KA/12345/2015
- Maharashtra: MH/67890/2018
- Delhi: DL/34567/2020
- Tamil Nadu: TN/45678/2016

### Common Diagnoses (for testing):
- Viral fever
- Upper respiratory tract infection
- Gastroenteritis
- Hypertension
- Type 2 Diabetes
- Migraine
- Allergic rhinitis
- Lower back pain

### Common Medicines:
- Paracetamol 500mg/650mg
- Amoxicillin 500mg
- Azithromycin 500mg
- Omeprazole 20mg
- Cetirizine 10mg
- Metformin 500mg
- Amlodipine 5mg

### Common Diagnostic Tests:
- Complete Blood Count (CBC)
- Blood Sugar (Fasting/PP)
- Lipid Profile
- Liver Function Test (LFT)
- Kidney Function Test (KFT)
- Thyroid Profile
- Urine Routine
- X-Ray Chest
- ECG
- Ultrasound Abdomen

## Document Variations to Handle

1. **Handwritten prescriptions** - Some doctors still write by hand
2. **Multilingual documents** - Bills might be in English + regional language
3. **Different layouts** - Each hospital has unique bill format
4. **Quality issues** - Faded prints, photos taken at angles
5. **Multiple pages** - Long bills might span multiple pages
6. **Stamps and signatures** - May be overlapping text
7. **Corrections** - Manual corrections with pen
8. **Partial documents** - Sometimes users submit incomplete docs

## Tips for Creating Test Documents

1. Use tools like:
   - HTML/CSS to create bill layouts
   - Canvas API to add signatures/stamps
   - Python libraries (PIL, ReportLab) for PDF generation
   - Add realistic noise/blur for testing OCR

2. Create at least 20-30 different document variations to test your system thoroughly

3. Include edge cases:
   - Bills with multiple patients (family)
   - Partial payments
   - Cancelled items
   - Refunds
   - Package deals

4. Consider creating a document generator function that can create variations automatically