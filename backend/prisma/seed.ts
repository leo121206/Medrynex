import { PrismaClient, UserRole, DoctorVerificationStatus, RecordCategory, RecordFileType, StorageStatus, RecordStatus, RelationshipType, RelationshipStatus, ConsentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { encryptWithEnvelope } from '../src/crypto/kms/envelopeEncryption';
import { uploadToIpfs } from '../src/services/ipfs.service';

const prisma = new PrismaClient();

interface SyntheticPatientDef {
  name: string;
  email: string;
  patientId: string;
  dob: string;
  gender: string;
  bloodGroup: string;
  phone: string;
  records: Array<{
    title: string;
    category: RecordCategory;
    fileType: RecordFileType;
    fileSize: string;
    description: string;
    issuingClinician: string;
    issuingHospital: string;
    recordDate: Date;
    reportContent: string;
  }>;
}

const SYNTHETIC_PATIENTS: SyntheticPatientDef[] = [
  {
    name: 'Aarav Sharma',
    email: 'aarav.sharma@medrynx.org',
    patientId: 'PT-1001',
    dob: '1988-04-12',
    gender: 'Male',
    bloodGroup: 'O+',
    phone: '+1 555-101-2001',
    records: [
      {
        title: 'Comprehensive Metabolic Panel (CMP)',
        category: RecordCategory.Laboratory,
        fileType: RecordFileType.PDF,
        fileSize: '1.2 MB',
        description: 'Complete venous blood serum evaluation of renal function, electrolytes, and liver enzymes.',
        issuingClinician: 'Dr. Marcus Vance, MD',
        issuingHospital: 'Mount Sinai Clinical Laboratory',
        recordDate: new Date('2026-03-10T09:30:00Z'),
        reportContent: `MEDRYNX CLINICAL LABORATORY REPORT
Patient Name: Aarav Sharma
Patient ID: PT-1001
DOB: 1988-04-12 | Gender: Male | Blood Group: O+
Collection Date: 2026-03-10
Panel: Comprehensive Metabolic Panel (CMP-14)

TEST RESULTS:
- Glucose (Fasting): 92 mg/dL [Reference: 70-99 mg/dL] - NORMAL
- Blood Urea Nitrogen (BUN): 14 mg/dL [Reference: 7-20 mg/dL] - NORMAL
- Serum Creatinine: 0.9 mg/dL [Reference: 0.7-1.3 mg/dL] - NORMAL
- eGFR (CKD-EPI): >90 mL/min/1.73m2 - NORMAL
- Sodium: 140 mEq/L [Reference: 136-145 mEq/L] - NORMAL
- Potassium: 4.2 mEq/L [Reference: 3.5-5.1 mEq/L] - NORMAL
- Chloride: 102 mEq/L [Reference: 98-107 mEq/L] - NORMAL
- Carbon Dioxide: 24 mEq/L [Reference: 22-29 mEq/L] - NORMAL
- Calcium: 9.4 mg/dL [Reference: 8.6-10.2 mg/dL] - NORMAL
- Total Protein: 7.1 g/dL [Reference: 6.0-8.3 g/dL] - NORMAL
- Albumin: 4.5 g/dL [Reference: 3.5-5.0 g/dL] - NORMAL
- Total Bilirubin: 0.6 mg/dL [Reference: 0.2-1.2 mg/dL] - NORMAL
- Alkaline Phosphatase: 65 U/L [Reference: 40-129 U/L] - NORMAL
- AST (SGOT): 22 U/L [Reference: 10-40 U/L] - NORMAL
- ALT (SGPT): 25 U/L [Reference: 7-56 U/L] - NORMAL

CLINICAL IMPRESSION:
Normative metabolic, renal, and hepatic profiles. Zero electrolyte abnormalities detected.
Verified by AES-256-GCM Cryptographic Envelope Integrity Anchor.`,
      },
      {
        title: 'Complete Blood Count (CBC) with Differential',
        category: RecordCategory.Laboratory,
        fileType: RecordFileType.PDF,
        fileSize: '950 KB',
        description: 'Quantitative cellular analysis of erythroid, myeloid, and thromboid lineages.',
        issuingClinician: 'Dr. Marcus Vance, MD',
        issuingHospital: 'Mount Sinai Hematology Center',
        recordDate: new Date('2026-03-12T11:15:00Z'),
        reportContent: `MEDRYNX HEMATOLOGY & CYTOLOGY REPORT
Patient Name: Aarav Sharma
Patient ID: PT-1001
Specimen: Whole Blood (K2-EDTA)
Date of Analysis: 2026-03-12

RESULTS:
- White Blood Cell Count (WBC): 6.8 x10^3/uL [Reference: 4.5-11.0] - NORMAL
- Red Blood Cell Count (RBC): 4.95 x10^6/uL [Reference: 4.30-5.90] - NORMAL
- Hemoglobin: 15.2 g/dL [Reference: 13.5-17.5 g/dL] - NORMAL
- Hematocrit: 45.1% [Reference: 41.0-50.0%] - NORMAL
- Mean Corpuscular Volume (MCV): 91.1 fL [Reference: 80.0-100.0 fL] - NORMAL
- Platelet Count: 245 x10^3/uL [Reference: 150-450 x10^3/uL] - NORMAL
- Absolute Neutrophils: 4.1 x10^3/uL (60%) - NORMAL
- Absolute Lymphocytes: 2.0 x10^3/uL (30%) - NORMAL
- Absolute Monocytes: 0.5 x10^3/uL (7%) - NORMAL
- Absolute Eosinophils: 0.15 x10^3/uL (2%) - NORMAL
- Absolute Basophils: 0.05 x10^3/uL (1%) - NORMAL

CLINICAL IMPRESSION:
Normocytic, normochromic erythrocyte morphology. Intact leukocytic and thrombocytic cellular parameters.`,
      },
      {
        title: '12-Lead Resting Electrocardiogram',
        category: RecordCategory.Cardiology,
        fileType: RecordFileType.PDF,
        fileSize: '1.4 MB',
        description: 'Standard 12-lead resting cardiac electrophysiological analysis.',
        issuingClinician: 'Dr. Marcus Vance, MD',
        issuingHospital: 'Mount Sinai Heart & Vascular Institute',
        recordDate: new Date('2026-03-15T14:00:00Z'),
        reportContent: `MEDRYNX CARDIOLOGY ELECTROPHYSIOLOGY REPORT
Patient Name: Aarav Sharma
Patient ID: PT-1001
Examination: 12-Lead Resting Electrocardiogram (ECG)
Record Date: 2026-03-15

MEASUREMENTS:
- Heart Rate: 68 bpm (Resting)
- Rhythm: Normal Sinus Rhythm
- PR Interval: 156 ms [Normal: 120-200 ms]
- QRS Duration: 88 ms [Normal: 80-120 ms]
- QT / QTc: 390 / 415 ms [Normal QTc: < 450 ms]
- Frontal P-QRS-T Axes: 48° / 52° / 45° (Normal Axis)

INTERPRETATION:
1. Normal sinus rhythm at 68 bpm.
2. Normal electrical conduction intervals.
3. No ST-segment elevations, depressions, or pathological Q-waves.
4. Normal baseline resting electrocardiogram.`,
      },
    ],
  },
  {
    name: 'Ananya Rao',
    email: 'ananya.rao@medrynx.org',
    patientId: 'PT-1002',
    dob: '1994-09-23',
    gender: 'Female',
    bloodGroup: 'B+',
    phone: '+1 555-101-2002',
    records: [
      {
        title: 'Brain & Cervical Spine 3T MRI Scan',
        category: RecordCategory.Imaging,
        fileType: RecordFileType.DICOM,
        fileSize: '4.8 MB',
        description: 'High-field 3 Tesla magnetic resonance imaging of cranial parenchyma and cervical neuro-axis.',
        issuingClinician: 'Dr. Evelyn Vance, MD',
        issuingHospital: 'Metro Health Advanced Neuroimaging',
        recordDate: new Date('2026-02-18T10:00:00Z'),
        reportContent: `MEDRYNX NEURORADIOLOGY IMAGING REPORT
Patient Name: Ananya Rao
Patient ID: PT-1002
Examination: MRI Brain and Cervical Spine 3.0 Tesla without IV Contrast
Date: 2026-02-18

FINDINGS:
- Brain Parenchyma: Normal gray-white differentiation. Zero acute ischemic infarct or intracranial hemorrhage.
- Ventricular System: Normal caliber and configuration for age. No midline shift.
- Cervical Spine: Normal alignment and lordosis. Vertebral body heights preserved.
- Disc Spaces: Mild C5-C6 disc space dehydration without disc herniation, spinal stenosis, or neural foraminal compromise.
- Spinal Cord: Normal caliber and homogenous intrinsic signal intensity.

IMPRESSION:
Normal cranial parenchymal MRI examination. Mild, non-compressive cervical C5-C6 degenerative disc desiccation.`,
      },
      {
        title: 'Post-Surgical Neurological Prescription Regimen',
        category: RecordCategory.Medication,
        fileType: RecordFileType.PDF,
        fileSize: '780 KB',
        description: 'Official clinical pharmacy medication directive and therapeutic regimen.',
        issuingClinician: 'Dr. Evelyn Vance, MD',
        issuingHospital: 'Metro Health Department of Neurology',
        recordDate: new Date('2026-02-22T13:30:00Z'),
        reportContent: `MEDRYNX PHARMACY DISCHARGE DIRECTIVE
Patient Name: Ananya Rao
Patient ID: PT-1002
Date Issued: 2026-02-22

ACTIVE MEDICATIONS PRESCRIBED:
1. Levetiracetam 500 mg Oral Tablet
   - Sig: 1 tablet by mouth twice daily (every 12 hours) with water.
   - Indication: Post-procedure neuro-stabilization prophylaxis.
   - Dispense: 60 tablets (30-day supply). Refills: 2.
2. Acetaminophen 500 mg Oral Tablet
   - Sig: 1 tablet by mouth every 6 hours as needed for mild tension discomfort.
   - Max Dose: Not to exceed 3,000 mg in 24 hours.
3. Ergocalciferol (Vitamin D2) 50,000 IU Oral Capsule
   - Sig: 1 capsule by mouth weekly for 8 weeks.

CLINICIAN SIGNATURE: Dr. Evelyn Vance, MD (License #NEURO-9401-NY)`,
      },
      {
        title: 'High-Resolution Contrast Chest CT Scan',
        category: RecordCategory.Imaging,
        fileType: RecordFileType.DICOM,
        fileSize: '5.2 MB',
        description: 'Multi-detector contrast-enhanced axial thoracic computed tomography.',
        issuingClinician: 'Dr. Evelyn Vance, MD',
        issuingHospital: 'Metro Health Diagnostic Radiology',
        recordDate: new Date('2026-02-25T15:45:00Z'),
        reportContent: `MEDRYNX THORACIC RADIOLOGY REPORT
Patient Name: Ananya Rao
Patient ID: PT-1002
Examination: CT Chest with Intravenous Non-Ionic Contrast (Isovue 370)
Date: 2026-02-25

OBSERVATIONS:
- Pulmonary Parenchyma: Clear bilateral lung fields without focal consolidation, atelectasis, or pleural effusions.
- Vascular: Pulmonary arterial tree opacifies symmetrically. No filling defect to suggest acute pulmonary embolism.
- Mediastinum & Hila: Subcarinal and paratracheal lymph nodes are within normal limits (< 10 mm short axis).
- Cardiac Silhouette: Normal chamber dimensions. Pericardium is unremarkable.

CONCLUSION:
Negative thoracic CT scan without evidence of acute pulmonary thromboembolism or parenchymal infectious infiltrate.`,
      },
    ],
  },
  {
    name: 'Rahul Verma',
    email: 'rahul.verma@medrynx.org',
    patientId: 'PT-1003',
    dob: '1981-11-05',
    gender: 'Male',
    bloodGroup: 'A+',
    phone: '+1 555-101-2003',
    records: [
      {
        title: 'Glycated Hemoglobin (HbA1c Diabetes Assessment)',
        category: RecordCategory.Laboratory,
        fileType: RecordFileType.PDF,
        fileSize: '890 KB',
        description: 'Glycemic biomarker evaluation for Type 2 diabetes therapeutic monitoring.',
        issuingClinician: 'Dr. Marcus Vance, MD',
        issuingHospital: 'Mount Sinai Diabetes Clinical Center',
        recordDate: new Date('2026-01-20T08:45:00Z'),
        reportContent: `MEDRYNX ENDOCRINOLOGY BIOCHEMICAL REPORT
Patient Name: Rahul Verma
Patient ID: PT-1003
Diagnosis: Type 2 Diabetes Mellitus
Specimen Date: 2026-01-20

ASSESSMENT:
- Hemoglobin A1c (HbA1c): 6.8% [ADA Treatment Target: < 7.0%] - CONTROLLED
- Estimated Average Glucose (eAG): 148 mg/dL
- Fasting Plasma Glucose: 122 mg/dL [Desirable: 70-130 mg/dL]
- Urine Albumin-to-Creatinine Ratio (UACR): 18.2 mg/g [Normal: < 30 mg/g] - NORMOALBUMINURIC

SUMMARY:
Stable glycemic control on current therapeutic regimen. Zero diabetic microvascular renal leakage.`,
      },
      {
        title: 'Fasting Lipid Profile & Cholesterol Panel',
        category: RecordCategory.Laboratory,
        fileType: RecordFileType.PDF,
        fileSize: '920 KB',
        description: 'Cardiovascular atherosclerotic lipid fractionation panel.',
        issuingClinician: 'Dr. Marcus Vance, MD',
        issuingHospital: 'Mount Sinai Clinical Laboratory',
        recordDate: new Date('2026-01-22T09:00:00Z'),
        reportContent: `MEDRYNX CARDIOVASCULAR RISK LIPID PANEL
Patient Name: Rahul Verma
Patient ID: PT-1003
Fasting Duration: 12 Hours
Date: 2026-01-22

VALUES:
- Total Cholesterol: 182 mg/dL [Desirable: < 200 mg/dL]
- Triglycerides: 145 mg/dL [Normal: < 150 mg/dL]
- HDL Cholesterol: 48 mg/dL [Desirable: > 40 mg/dL for men]
- LDL Cholesterol (Direct): 105 mg/dL [Near Optimal: 100-129 mg/dL]
- Non-HDL Cholesterol: 134 mg/dL
- Total / HDL Ratio: 3.79 [Target: < 4.5]

IMPRESSION:
Fasting lipid indices within targeted thresholds for diabetic secondary prevention.`,
      },
      {
        title: 'Endocrinologist Clinical Consultation Summary',
        category: RecordCategory.Clinical,
        fileType: RecordFileType.PDF,
        fileSize: '1.1 MB',
        description: 'Quarterly comprehensive endocrine and metabolic care management consultation.',
        issuingClinician: 'Dr. Marcus Vance, MD',
        issuingHospital: 'Mount Sinai Endocrine Care Center',
        recordDate: new Date('2026-01-25T11:30:00Z'),
        reportContent: `MEDRYNX CLINICAL CONSULTATION SUMMARY
Patient Name: Rahul Verma
Patient ID: PT-1003
Date of Encounter: 2026-01-25
Attending: Dr. Marcus Vance, MD

SUBJECTIVE:
Patient reports adherence to nutritional meal planning and regular 30-minute daily walking. No episodes of hypoglycemia, lightheadedness, or polyuria.

OBJECTIVE:
- BP: 122/78 mmHg | HR: 70 bpm | Weight: 78.4 kg | BMI: 25.6
- Eye / Fundoscopic: No diabetic retinopathy.
- Extremities: Peripheral pulses 2+ DP/PT bilaterally. Monofilament 10g sensory test normal (10/10 sites).

PLAN:
1. Continue Metformin Hydrochloride 850 mg PO BID with meals.
2. Maintain home fasting blood glucose logging.
3. Re-evaluate HbA1c in 3 months.`,
      },
    ],
  },
  {
    name: 'Priya Nair',
    email: 'priya.nair@medrynx.org',
    patientId: 'PT-1004',
    dob: '1990-07-19',
    gender: 'Female',
    bloodGroup: 'AB+',
    phone: '+1 555-101-2004',
    records: [
      {
        title: 'Exercise Treadmill Stress Echocardiogram',
        category: RecordCategory.Cardiology,
        fileType: RecordFileType.PDF,
        fileSize: '1.6 MB',
        description: 'Cardiovascular hemodynamic stress response and wall motion echocardiographic study.',
        issuingClinician: 'Dr. Marcus Vance, MD',
        issuingHospital: 'Mount Sinai Heart & Vascular Institute',
        recordDate: new Date('2026-02-05T10:15:00Z'),
        reportContent: `MEDRYNX STRESS ECHOCARDIOGRAPHY REPORT
Patient Name: Priya Nair
Patient ID: PT-1004
Protocol: Standard Bruce Treadmill Exercise Protocol
Total Exercise Time: 9 minutes 30 seconds (Achieved Stage 3, 9.5 METs)

HEMODYNAMICS:
- Resting BP: 124/80 mmHg | Peak Stress BP: 162/86 mmHg
- Resting HR: 72 bpm | Peak Stress HR: 168 bpm (94% Age-Predicted Max)
- Symptoms: Zero exertional angina or dyspnea during peak workload.

ECHOCARDIOGRAPHIC ASSESSMENT:
- Resting Left Ventricular Ejection Fraction (LVEF): 62%
- Post-Peak Stress LVEF: 70% (Hyperdynamic normal response)
- Wall Motion: Normal baseline left ventricular wall motion; no inducible ischemia.

CONCLUSION:
Hemodynamically normal exercise capacity. Negative stress echocardiogram for inducible myocardial ischemia.`,
      },
      {
        title: 'Holter 24-Hour Continuous Arrhythmia Telemetry',
        category: RecordCategory.Cardiology,
        fileType: RecordFileType.PDF,
        fileSize: '2.1 MB',
        description: 'Extended ambulatory 24-hour continuous dual-channel digital ECG telemetry.',
        issuingClinician: 'Dr. Marcus Vance, MD',
        issuingHospital: 'Mount Sinai Heart & Vascular Institute',
        recordDate: new Date('2026-02-10T14:30:00Z'),
        reportContent: `MEDRYNX 24-HOUR AMBULATORY HOLTER REPORT
Patient Name: Priya Nair
Patient ID: PT-1004
Recording Duration: 23 Hours 54 Minutes
Total Beats Analyzed: 99,412

SUMMARY STATISTICS:
- Dominant Rhythm: Sinus rhythm throughout recording
- Average Heart Rate: 74 bpm (Range: 54 bpm nocturnal nadir - 134 bpm daytime peak)
- Ventricular Ectopy: 14 single PVCs (<0.02% total beats). No couplets, triplets, or VT.
- Supraventricular Ectopy: 26 single PACs (<0.03% total beats). Zero SVT or atrial fibrillation.
- Pauses: Zero pauses > 2.0 seconds recorded.

CONCLUSION:
Essentially normal 24-hour ambulatory Holter recording. Rare, isolated benign ectopy without clinical arrhythmia.`,
      },
      {
        title: 'Antihypertensive & ACE Inhibitor Prescription',
        category: RecordCategory.Medication,
        fileType: RecordFileType.PDF,
        fileSize: '750 KB',
        description: 'Clinical cardiovascular medication management orders.',
        issuingClinician: 'Dr. Marcus Vance, MD',
        issuingHospital: 'Mount Sinai Cardiology Clinic',
        recordDate: new Date('2026-02-12T16:00:00Z'),
        reportContent: `MEDRYNX OUTPATIENT PRESCRIPTION ORDER
Patient Name: Priya Nair
Patient ID: PT-1004
Date: 2026-02-12

MEDICATIONS:
1. Lisinopril 10 mg Oral Tablet
   - Sig: Take 1 tablet daily by mouth every morning.
   - Dispense: 90 tablets (3-month supply). Refills: 3.
2. Coenzyme Q10 (Ubiquinol) 100 mg Softgel
   - Sig: Take 1 softgel daily with breakfast.

INSTRUCTIONS:
Log seated morning blood pressure 3 times per week. Target BP: < 125/80 mmHg.`,
      },
    ],
  },
  {
    name: 'Kiran Reddy',
    email: 'kiran.reddy@medrynx.org',
    patientId: 'PT-1005',
    dob: '1975-02-14',
    gender: 'Non-Binary',
    bloodGroup: 'O-',
    phone: '+1 555-101-2005',
    records: [
      {
        title: 'Weight-Bearing Lumbar Spine Radiograph (X-Ray)',
        category: RecordCategory.Imaging,
        fileType: RecordFileType.JPG,
        fileSize: '3.1 MB',
        description: 'Multi-view erect upright weight-bearing radiological study of the lumbosacral spine.',
        issuingClinician: 'Dr. Marcus Sterling, MD',
        issuingHospital: 'Mount Sinai Orthopedic Imaging Center',
        recordDate: new Date('2026-03-01T09:00:00Z'),
        reportContent: `MEDRYNX ORTHOPEDIC RADIOLOGY REPORT
Patient Name: Kiran Reddy
Patient ID: PT-1005
Examination: X-Ray Lumbar Spine 4 Views (AP, Lateral, Standing Flexion/Extension)
Date: 2026-03-01

FINDINGS:
- Curvature: Normal physiological lumbar lordosis. No scoliosis.
- Vertebral Bodies: Intact heights, margins, and density. No acute compression fractures.
- Intervertebral Discs: Mild disc space narrowing at L4-L5 level with mild anterior marginal spurring. L1-L4 and L5-S1 disc heights are well preserved.
- Dynamic Stability: Flexion and extension views demonstrate zero translation or subluxation (< 1 mm excursion).

IMPRESSION:
Mild isolated L4-L5 degenerative disc disease without spondylolisthesis or dynamic mechanical instability.`,
      },
      {
        title: 'Orthopedic Physical Therapy Rehabilitation Plan',
        category: RecordCategory.Clinical,
        fileType: RecordFileType.PDF,
        fileSize: '1.0 MB',
        description: 'Comprehensive musculoskeletal rehabilitation and core stabilization physical therapy directive.',
        issuingClinician: 'Dr. Marcus Sterling, MD',
        issuingHospital: 'Mount Sinai Rehabilitation Medicine',
        recordDate: new Date('2026-03-05T11:00:00Z'),
        reportContent: `MEDRYNX PHYSICAL REHABILITATION DIRECTIVE
Patient Name: Kiran Reddy
Patient ID: PT-1005
Diagnosis: Mechanical L4-L5 Lumbar Strain
Therapy Plan:
1. Lumbopelvic stabilization (dead bug, bird-dog, pelvic floor co-contraction) 3x/week.
2. Hamstring and hip flexor static stretching (30 sec holds, 3 repetitions).
3. Lumbar traction and aquatic non-weight-bearing conditioning.
Plan of Care: 2 clinic sessions weekly for 6 weeks, with daily home exercise regimen adherence.`,
      },
      {
        title: 'Musculoskeletal Joint Mobility Assessment',
        category: RecordCategory.Clinical,
        fileType: RecordFileType.PDF,
        fileSize: '890 KB',
        description: 'Physiatry functional movement and neurological reflex clinical examination.',
        issuingClinician: 'Dr. Marcus Sterling, MD',
        issuingHospital: 'Mount Sinai Orthopedic Institute',
        recordDate: new Date('2026-03-08T13:30:00Z'),
        reportContent: `MEDRYNX MUSCULOSKELETAL PHYSICAL EXAMINATION
Patient Name: Kiran Reddy
Patient ID: PT-1005
Clinical Findings:
- Lumbar Flexion: 75 degrees (mild end-range tightness, no radicular shooting pain).
- Straight Leg Raise (SLR): Negative bilaterally to 80 degrees.
- Neurological: Patellar (L4) 2+ bilateral; Achilles (S1) 2+ bilateral. Extensor hallucis longus 5/5 strength.
Impression: Intact lumbosacral nerve roots. Musculoskeletal axial strain secondary to mild L4-L5 degeneration.`,
      },
    ],
  },
  {
    name: 'Sneha Iyer',
    email: 'sneha.iyer@medrynx.org',
    patientId: 'PT-1006',
    dob: '1999-12-30',
    gender: 'Female',
    bloodGroup: 'A-',
    phone: '+1 555-101-2006',
    records: [
      {
        title: 'Comprehensive Pediatric Allergy IgE Panel',
        category: RecordCategory.Laboratory,
        fileType: RecordFileType.PDF,
        fileSize: '1.1 MB',
        description: 'Fluorescent enzyme immunoassay quantitative specific immunoglobulin E aeroallergen profile.',
        issuingClinician: 'Dr. Evelyn Vance, MD',
        issuingHospital: 'Metro Health Allergy & Immunology',
        recordDate: new Date('2026-02-14T10:00:00Z'),
        reportContent: `MEDRYNX ALLERGY & CLINICAL IMMUNOLOGY REPORT
Patient Name: Sneha Iyer
Patient ID: PT-1006
Test: Specific IgE Quantitative Allergen Screen

ASSESSMENT:
- Total Serum IgE: 165 kU/L [Reference: < 100 kU/L] - ELEVATED
- Dermatophagoides pteronyssinus (House Dust Mite): 18.2 kU/L [Class 4 - High Positive]
- Felis domesticus (Cat Dander): 4.8 kU/L [Class 3 - Moderate Positive]
- Phleum pratense (Timothy Grass Pollen): 8.5 kU/L [Class 3 - Moderate Positive]
- Arachis hypogaea (Peanut): < 0.10 kU/L [Class 0 - Negative]
- Gallus domesticus (Egg White): < 0.10 kU/L [Class 0 - Negative]

CONCLUSION:
Marked atopic sensitization to dust mite, feline dander, and grass pollens. Food panels negative.`,
      },
      {
        title: 'Inhaled Corticosteroid & Bronchodilator Prescription',
        category: RecordCategory.Medication,
        fileType: RecordFileType.PDF,
        fileSize: '820 KB',
        description: 'Pulmonary maintenance inhaler and rescue bronchospasm pharmacology protocol.',
        issuingClinician: 'Dr. Evelyn Vance, MD',
        issuingHospital: 'Metro Health Department of Pulmonology',
        recordDate: new Date('2026-02-16T14:15:00Z'),
        reportContent: `MEDRYNX PULMONARY CLINICAL PRESCRIPTION
Patient Name: Sneha Iyer
Patient ID: PT-1006
Date: 2026-02-16

MEDICATIONS:
1. Fluticasone Propionate / Salmeterol 100/50 mcg Diskus
   - Sig: Inhale 1 blister powder by mouth twice daily (every 12 hours). Rinse mouth thoroughly after inhalation.
   - Quantity: 1 Diskus (60 blisters). Refills: 3.
2. Albuterol Sulfate HFA Inhaler 90 mcg
   - Sig: Inhale 2 puffs every 4-6 hours as needed for wheezing, chest tightness, or prior to exercise.
3. Cetirizine 10 mg Tablet
   - Sig: 1 tablet daily at bedtime.`,
      },
      {
        title: 'Pulmonary Function & Spirometry Test Report',
        category: RecordCategory.Clinical,
        fileType: RecordFileType.PDF,
        fileSize: '1.3 MB',
        description: 'Pre and post-bronchodilator computerized spirometric flow-volume curve analysis.',
        issuingClinician: 'Dr. Evelyn Vance, MD',
        issuingHospital: 'Metro Health Pulmonology Lab',
        recordDate: new Date('2026-02-18T15:30:00Z'),
        reportContent: `MEDRYNX COMPUTERIZED SPIROMETRY REPORT
Patient Name: Sneha Iyer
Patient ID: PT-1006
Height: 165 cm | Weight: 56 kg | Effort: Excellent (ATS/ERS 2019 Criteria met)

RESULTS:
- FVC Pre: 3.45 L (98% Predicted) | Post: 3.52 L (100% Predicted)
- FEV1 Pre: 2.52 L (82% Predicted) | Post: 2.85 L (93% Predicted)
- FEV1/FVC Ratio Pre: 73.0% (Mild baseline obstructive airflow limitation)
- Post-Bronchodilator Reversibility: +13% improvement in FEV1 (+330 mL volume delta)

INTERPRETATION:
Reversible obstructive airway defect establishing diagnosis of moderate persistent bronchial asthma.`,
      },
    ],
  },
  {
    name: 'Arjun Mehta',
    email: 'arjun.mehta@medrynx.org',
    patientId: 'PT-1007',
    dob: '1986-06-08',
    gender: 'Male',
    bloodGroup: 'B-',
    phone: '+1 555-101-2007',
    records: [
      {
        title: 'Left Knee Arthroscopy Diagnostic Imaging Series',
        category: RecordCategory.Imaging,
        fileType: RecordFileType.DICOM,
        fileSize: '4.6 MB',
        description: 'High-resolution sagittal, coronal, and axial multi-sequence knee joint magnetic resonance imaging.',
        issuingClinician: 'Dr. Marcus Sterling, MD',
        issuingHospital: 'Mount Sinai Orthopedic Imaging Center',
        recordDate: new Date('2026-01-14T11:00:00Z'),
        reportContent: `MEDRYNX ORTHOPEDIC RADIOLOGY REPORT
Patient Name: Arjun Mehta
Patient ID: PT-1007
Examination: MRI Left Knee Joint without IV Contrast
Date: 2026-01-14

FINDINGS:
- Anterior Cruciate Ligament (ACL): Complete mid-substance disruption with hyperintense fluid signal and non-visualization of intact fibers.
- Posterior Cruciate Ligament (PCL): Normal contour and low signal.
- Menisci: Complex vertical tear involving the posterior horn of the medial meniscus extending to the inferior articular surface. Lateral meniscus is intact.
- Articular Cartilage: Mild chondromalacia patellae; femorotibial compartments intact.
- Effusion: Moderate joint effusion with hemarthrosis component.

IMPRESSION:
Complete acute anterior cruciate ligament rupture and medial meniscus posterior horn tear.`,
      },
      {
        title: 'Sports Medicine Post-Trauma Rehabilitation Evaluation',
        category: RecordCategory.Clinical,
        fileType: RecordFileType.PDF,
        fileSize: '1.2 MB',
        description: 'Pre-operative orthopedics and sports trauma physical conditioning evaluation.',
        issuingClinician: 'Dr. Marcus Sterling, MD',
        issuingHospital: 'Mount Sinai Sports Medicine Institute',
        recordDate: new Date('2026-01-18T14:00:00Z'),
        reportContent: `MEDRYNX SPORTS ORTHOPEDICS CLINICAL CONSULT
Patient Name: Arjun Mehta
Patient ID: PT-1007
History: 39-year-old active athletic patient sustained non-contact pivoting deceleration trauma to left knee.
Physical Exam:
- Positive Lachman test with soft end-point (Grade 3).
- Positive pivot-shift test. Joint line tenderness medial side.
Plan: Patient indicated for arthroscopic bone-patellar tendon-bone autograft ACL reconstruction and partial medial meniscectomy. Pre-habilitation quad strengthening initiated.`,
      },
      {
        title: 'Orthopedic Post-Operative Pain Management Prescription',
        category: RecordCategory.Medication,
        fileType: RecordFileType.PDF,
        fileSize: '810 KB',
        description: 'Surgical recovery pharmacological regimen and venous thromboembolism prophylaxis.',
        issuingClinician: 'Dr. Marcus Sterling, MD',
        issuingHospital: 'Mount Sinai Orthopedic Pharmacy',
        recordDate: new Date('2026-01-22T16:30:00Z'),
        reportContent: `MEDRYNX SURGICAL DISCHARGE PRESCRIPTION
Patient Name: Arjun Mehta
Patient ID: PT-1007
Date: 2026-01-22

DIRECTIVES:
1. Enoxaparin 40 mg / 0.4 mL Subcutaneous Solution
   - Sig: Inject 0.4 mL subcutaneously once daily in the abdomen for 10 days (DVT prevention).
2. Celecoxib 200 mg Capsule
   - Sig: 1 capsule by mouth once daily with breakfast for 14 days.
3. Acetaminophen 500 mg Tablet
   - Sig: 1-2 tablets by mouth every 6-8 hours as needed for mild-to-moderate discomfort.
Warning: Avoid NSAID combination. Strict adherence to weight-bearing brace limitations.`,
      },
    ],
  },
  {
    name: 'Kavya Patel',
    email: 'kavya.patel@medrynx.org',
    patientId: 'PT-1008',
    dob: '1992-08-17',
    gender: 'Female',
    bloodGroup: 'AB-',
    phone: '+1 555-101-2008',
    records: [
      {
        title: 'Hereditary Cancer Genomic Sequencing Panel',
        category: RecordCategory.Genomic,
        fileType: RecordFileType.JSON,
        fileSize: '2.4 MB',
        description: '48-gene targeted next-generation sequencing for hereditary oncological risk markers.',
        issuingClinician: 'Dr. Evelyn Vance, MD',
        issuingHospital: 'Metro Health Molecular Genetics Laboratory',
        recordDate: new Date('2026-03-02T10:30:00Z'),
        reportContent: `MEDRYNX NEXT-GENERATION MOLECULAR GENOMICS REPORT
Patient Name: Kavya Patel
Patient ID: PT-1008
Sequencing Methodology: Illumina NovaSeq 6000 Targeted Exon Sequencing (Mean Coverage: 420x)
Genes Screened: BRCA1, BRCA2, PALB2, TP53, PTEN, CDH1, STK11, CHEK2, ATM, MLH1, MSH2, MSH6, PMS2, EPCAM, RAD51C, RAD51D.

GENOMIC FINDINGS:
- Pathogenic / Likely Pathogenic Variants: NONE DETECTED.
- Variants of Uncertain Significance (VUS): NONE DETECTED.
- Analytical Sensitivity: >99.9% for single nucleotide variants (SNVs) and insertions/deletions < 20 bp.

INTERPRETATION:
Negative panel. No hereditary genomic mutation detected. Patient remains at general population baseline risk.`,
      },
      {
        title: 'Annual Preventative Oncology Clinical Consultation',
        category: RecordCategory.Clinical,
        fileType: RecordFileType.PDF,
        fileSize: '950 KB',
        description: 'Comprehensive preventative oncology health risk stratification encounter note.',
        issuingClinician: 'Dr. Evelyn Vance, MD',
        issuingHospital: 'Metro Health Preventative Medicine',
        recordDate: new Date('2026-03-05T13:00:00Z'),
        reportContent: `MEDRYNX PREVENTATIVE ONCOLOGY CONSULTATION
Patient Name: Kavya Patel
Patient ID: PT-1008
Date: 2026-03-05
Encounter Summary:
33-year-old female presents for preventative risk stratification following negative 48-gene hereditary cancer panel.
Assessment: Negative family history of early-onset malignancies. Gail Model 5-year risk calculated at 0.8% (average risk).
Recommendations: Standard population-based screening schedule. Maintain healthy diet and active lifestyle. Routine annual well-woman evaluation.`,
      },
      {
        title: 'Full-Field Digital Diagnostic Mammogram',
        category: RecordCategory.Imaging,
        fileType: RecordFileType.DICOM,
        fileSize: '5.1 MB',
        description: 'Bilateral full-field digital mammographic screening study with computerized CAD analysis.',
        issuingClinician: 'Dr. Evelyn Vance, MD',
        issuingHospital: 'Metro Health Women\'s Imaging Center',
        recordDate: new Date('2026-03-07T15:00:00Z'),
        reportContent: `MEDRYNX WOMEN'S HEALTH RADIOLOGY REPORT
Patient Name: Kavya Patel
Patient ID: PT-1008
Examination: Bilateral Digital Mammogram (CC and MLO Views)
Date: 2026-03-07

FINDINGS:
- Parenchymal Density: Scattered areas of fibroglandular density (BI-RADS Breast Composition Category B).
- Masses & Microcalcifications: Zero suspicious discrete solid masses, architectural distortions, or pleomorphic grouped microcalcifications.
- Axillary Lymph Nodes: Normal morphology without pathological cortical thickening.

IMPRESSION:
BI-RADS Category 1 - Negative bilateral screening mammogram. No radiologic sign of malignancy.`,
      },
    ],
  },
];

async function main() {
  console.log('🌱 Starting Medrynx Comprehensive Multi-Patient Database Seeding...');

  // 1. Ensure default healthcare organization
  const defaultOrg = await prisma.organization.upsert({
    where: { code: 'HOSP-DEFAULT' },
    update: {},
    create: {
      name: 'Medrynx Primary Healthcare Network',
      code: 'HOSP-DEFAULT',
      type: 'HOSPITAL',
      address: 'Central Healthcare Complex, New York, NY',
      contactEmail: 'compliance@medrynx.org',
      status: 'ACTIVE',
    },
  });
  console.log(`✅ Default Organization verified: ${defaultOrg.name} (${defaultOrg.id})`);

  const passwordHash = await bcrypt.hash('SecurePass123!', 10);

  // Clean up previous transient e2e test users and conflicting doctorId/patientId/adminId records
  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: { startsWith: 'e2e.' } },
        { doctorId: { in: ['d-514', 'd-515'] }, email: { notIn: ['doctor.vance@medrynx.org', 'doctor.evelyn@medrynx.org'] } },
        { adminId: 'adm-754', email: { not: 'admin@medrynx.org' } },
      ],
    },
  });

  // 2. Ensure verified clinicians & admins
  const doctorVance = await prisma.user.upsert({
    where: { email: 'doctor.vance@medrynx.org' },
    update: {
      passwordHash,
      doctorId: 'd-514',
      verificationStatus: DoctorVerificationStatus.VERIFIED,
      specialization: 'Cardiology',
      hospital: 'Mount Sinai Hospital',
    },
    create: {
      email: 'doctor.vance@medrynx.org',
      passwordHash,
      name: 'Dr. Marcus Vance',
      role: UserRole.DOCTOR,
      doctorId: 'd-514',
      licenseId: 'MD-59281-NY',
      specialization: 'Cardiology',
      hospital: 'Mount Sinai Hospital',
      verificationStatus: DoctorVerificationStatus.VERIFIED,
      phone: '+1 555-010-5001',
      organizationId: defaultOrg.id,
    },
  });

  const doctorEvelyn = await prisma.user.upsert({
    where: { email: 'doctor.evelyn@medrynx.org' },
    update: {
      passwordHash,
      doctorId: 'd-515',
      verificationStatus: DoctorVerificationStatus.VERIFIED,
      specialization: 'Neurology',
      hospital: 'Metro Health System',
    },
    create: {
      email: 'doctor.evelyn@medrynx.org',
      passwordHash,
      name: 'Dr. Evelyn Vance',
      role: UserRole.DOCTOR,
      doctorId: 'd-515',
      licenseId: 'MD-69482-NY',
      specialization: 'Neurology',
      hospital: 'Metro Health System',
      verificationStatus: DoctorVerificationStatus.VERIFIED,
      phone: '+1 555-010-5002',
      organizationId: defaultOrg.id,
    },
  });

  const doctorSterling = await prisma.user.upsert({
    where: { email: 'doctor.reg.1790703983032@medrynx.io' },
    update: {
      passwordHash,
      doctorId: 'd-667',
      verificationStatus: DoctorVerificationStatus.VERIFIED,
      specialization: 'Cardiology',
      hospital: 'Mount Sinai Clinical Center',
    },
    create: {
      email: 'doctor.reg.1790703983032@medrynx.io',
      passwordHash,
      name: 'Dr. Marcus Sterling',
      role: UserRole.DOCTOR,
      doctorId: 'd-667',
      licenseId: 'MD-99281-NY',
      specialization: 'Cardiology',
      hospital: 'Mount Sinai Clinical Center',
      verificationStatus: DoctorVerificationStatus.VERIFIED,
      phone: '+1 555-010-3030',
      organizationId: defaultOrg.id,
    },
  });

  const adminClara = await prisma.user.upsert({
    where: { email: 'admin@medrynx.org' },
    update: {
      passwordHash,
      adminId: 'adm-754',
      department: 'Clinical Governance',
    },
    create: {
      email: 'admin@medrynx.org',
      passwordHash,
      name: 'Admin Clara Vance',
      role: UserRole.ADMIN,
      adminId: 'adm-754',
      department: 'Clinical Governance',
      phone: '+1 555-010-4040',
      organizationId: defaultOrg.id,
    },
  });

  console.log(`✅ Verified clinicians & administrators initialized.`);

  // 3. Clean up previously generated timestamped duplicate test users from earlier runs
  await prisma.user.deleteMany({
    where: {
      email: {
        startsWith: 'e2e.patient.',
      },
    },
  });

  // 4. Seed each synthetic patient and their encrypted medical records
  let totalRecordsCreated = 0;

  for (const pDef of SYNTHETIC_PATIENTS) {
    const patientUser = await prisma.user.upsert({
      where: { email: pDef.email },
      update: {
        passwordHash,
        name: pDef.name,
        patientId: pDef.patientId,
        dob: pDef.dob,
        gender: pDef.gender,
        bloodGroup: pDef.bloodGroup,
        phone: pDef.phone,
      },
      create: {
        email: pDef.email,
        passwordHash,
        name: pDef.name,
        role: UserRole.PATIENT,
        patientId: pDef.patientId,
        dob: pDef.dob,
        gender: pDef.gender,
        bloodGroup: pDef.bloodGroup,
        phone: pDef.phone,
        organizationId: defaultOrg.id,
      },
    });

    console.log(`👤 Patient configured: ${patientUser.name} (${patientUser.patientId}) - ID: ${patientUser.id}`);

    // Create encrypted records for this specific patient
    for (const rDef of pDef.records) {
      // Check if record already exists by title and patientId
      const existingRecord = await prisma.recordMetadata.findFirst({
        where: {
          patientId: patientUser.id,
          title: rDef.title,
        },
      });

      if (!existingRecord) {
        // Real AES-256-GCM Envelope Encryption via KMS
        const plaintextBuffer = Buffer.from(rDef.reportContent, 'utf-8');
        const envelope = await encryptWithEnvelope(plaintextBuffer);

        // Upload encrypted blob to decentralized storage
        const ipfsResult = await uploadToIpfs(envelope.combinedBlob);

        // Create RecordMetadata
        const record = await prisma.recordMetadata.create({
          data: {
            patientId: patientUser.id,
            organizationId: defaultOrg.id,
            title: rDef.title,
            category: rDef.category,
            description: rDef.description,
            fileType: rDef.fileType,
            fileSize: rDef.fileSize,
            encryptedIpfsHash: ipfsResult.cid,
            sha256Hash: envelope.sha256Hash,
            isEncrypted: true,
            storageStatus: StorageStatus.ENCRYPTED_AND_ANCHORED,
            issuingClinician: rDef.issuingClinician,
            issuingHospital: rDef.issuingHospital,
            recordDate: rDef.recordDate,
            wrappedDek: envelope.wrappedDek,
            keyVersion: envelope.keyVersion,
            encryptionAlgorithm: 'AES-256-GCM+ENVELOPE',
            iv: envelope.iv,
            authTag: envelope.authTag,
            creatorId: doctorVance.id,
            currentVersion: 1,
            recordStatus: RecordStatus.ACTIVE,
          },
        });

        // Create immutable Version 1
        await prisma.recordVersion.create({
          data: {
            recordId: record.id,
            versionNumber: 1,
            title: rDef.title,
            fileType: rDef.fileType,
            fileSize: rDef.fileSize,
            encryptedIpfsHash: ipfsResult.cid,
            sha256Hash: envelope.sha256Hash,
            wrappedDek: envelope.wrappedDek,
            keyVersion: envelope.keyVersion,
            encryptionAlgorithm: 'AES-256-GCM+ENVELOPE',
            iv: envelope.iv,
            authTag: envelope.authTag,
            creatorId: doctorVance.id,
            organizationId: defaultOrg.id,
            changeSummary: 'Initial verified clinical record ingestion',
          },
        });

        totalRecordsCreated++;
      }
    }
  }

  // 5. Seed baseline T1/T2/T3 trust relationships for testing
  // Aarav Sharma (PT-1001) has T1 Verified Relationship with Dr. Marcus Vance
  const patientAarav = await prisma.user.findFirst({ where: { patientId: 'PT-1001' } });
  if (patientAarav) {
    const existingRelA = await prisma.trustRelationship.findFirst({
      where: { subjectId: patientAarav.id, targetUserId: doctorVance.id },
    });
    if (!existingRelA) {
      await prisma.trustRelationship.create({
        data: {
          subjectId: patientAarav.id,
          targetUserId: doctorVance.id,
          organizationId: defaultOrg.id,
          relationshipType: RelationshipType.PATIENT_PROVIDER,
          status: RelationshipStatus.ACTIVE,
          notes: 'Baseline outpatient clinical care link verified.',
        },
      });
    }
  }

  // Ananya Rao (PT-1002) has T2 Active Consent Grant for Imaging & Medication with Dr. Marcus Vance
  const patientAnanya = await prisma.user.findFirst({ where: { patientId: 'PT-1002' } });
  if (patientAnanya) {
    const existingRelB = await prisma.trustRelationship.findFirst({
      where: { subjectId: patientAnanya.id, targetUserId: doctorVance.id },
    });
    if (!existingRelB) {
      await prisma.trustRelationship.create({
        data: {
          subjectId: patientAnanya.id,
          targetUserId: doctorVance.id,
          organizationId: defaultOrg.id,
          relationshipType: RelationshipType.PATIENT_PROVIDER,
          status: RelationshipStatus.ACTIVE,
          notes: 'Neurological care provider relationship verified.',
        },
      });
    }

    const existingGrantB = await prisma.accessGrant.findFirst({
      where: { patientId: patientAnanya.id, doctorId: doctorVance.id, status: ConsentStatus.ACTIVE },
    });
    if (!existingGrantB) {
      await prisma.accessGrant.create({
        data: {
          patientId: patientAnanya.id,
          doctorId: doctorVance.id,
          recordType: 'Imaging, Medication',
          purpose: 'Diagnostic review and post-surgical monitoring',
          accessStart: new Date(),
          accessExpiry: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
          status: ConsentStatus.ACTIVE,
          scopeNote: 'Imaging, Medication',
        },
      });
    }
  }

  // Rahul Verma (PT-1003) has T3 Trusted Care Team with Dr. Marcus Vance
  const patientRahul = await prisma.user.findFirst({ where: { patientId: 'PT-1003' } });
  if (patientRahul) {
    const existingRelC = await prisma.trustRelationship.findFirst({
      where: { subjectId: patientRahul.id, targetUserId: doctorVance.id },
    });
    if (!existingRelC) {
      await prisma.trustRelationship.create({
        data: {
          subjectId: patientRahul.id,
          targetUserId: doctorVance.id,
          organizationId: defaultOrg.id,
          relationshipType: RelationshipType.PATIENT_CARE_TEAM,
          status: RelationshipStatus.ACTIVE,
          notes: 'Comprehensive multi-disciplinary diabetes care team.',
        },
      });
    }

    const existingGrantC = await prisma.accessGrant.findFirst({
      where: { patientId: patientRahul.id, doctorId: doctorVance.id, status: ConsentStatus.ACTIVE },
    });
    if (!existingGrantC) {
      await prisma.accessGrant.create({
        data: {
          patientId: patientRahul.id,
          doctorId: doctorVance.id,
          recordType: 'Laboratory, Clinical, Medication',
          purpose: 'Continuous endocrine and metabolic care management',
          accessStart: new Date(),
          accessExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          status: ConsentStatus.ACTIVE,
          scopeNote: 'Care team continuity of care',
        },
      });
    }
  }

  console.log(`✅ Multi-patient synthetic dataset initialized with AES-256-GCM envelope encryption.`);
  console.log(`   Patients: ${SYNTHETIC_PATIENTS.length} distinct patients.`);
  console.log(`   New encrypted records created in this pass: ${totalRecordsCreated}`);
}

main()
  .catch((e) => {
    console.error('Error during database initialization:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
