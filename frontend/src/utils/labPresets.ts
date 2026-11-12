/**
 * BruClinic — Clinical Laboratory Presets & Reference Formularies
 * Standard test panels, specimens, normal reference ranges, and units
 * for flexible clinical lab ordering and report generation.
 */

export interface StandardLabTest {
  testName: string;
  category: 'Hematology' | 'Biochemistry' | 'Urinalysis' | 'Parasitology' | 'Serology' | 'Microbiology';
  specimenType: string;
  defaultUnit: string;
  defaultRefRange: string;
  parameters?: Array<{ name: string; unit: string; refRange: string }>;
}

export const LAB_PANELS: Record<string, StandardLabTest[]> = {
  Hematology: [
    {
      testName: 'Complete Blood Count (CBC / Hemogram)',
      category: 'Hematology',
      specimenType: 'EDTA Whole Blood (Purple Top)',
      defaultUnit: 'Panel',
      defaultRefRange: 'See parameter breakdown',
      parameters: [
        { name: 'White Blood Cells (WBC)', unit: 'K/µL', refRange: '4.0 - 11.0' },
        { name: 'Red Blood Cells (RBC)', unit: 'K/µL', refRange: '4.5 - 6.0 (M) / 4.0 - 5.0 (F)' },
        { name: 'Hemoglobin (Hgb)', unit: 'g/dL', refRange: '14 - 18 (M) / 12 - 16 (F)' },
        { name: 'Hematocrit (Hct)', unit: '%', refRange: '41 - 50 (M) / 36 - 45 (F)' },
        { name: 'MCV', unit: 'fL', refRange: '80 - 96' },
        { name: 'MCH', unit: 'pg', refRange: '27 - 33' },
        { name: 'MCHC', unit: 'g/dL', refRange: '33 - 36' },
        { name: 'RDW', unit: '%', refRange: '11 - 14' },
        { name: 'Platelet Count (PLT)', unit: 'K/µL', refRange: '150 - 400' },
        { name: 'Neutrophils', unit: '%', refRange: '40 - 70' },
        { name: 'Eosinophils', unit: '%', refRange: '1.0 - 4.0' },
        { name: 'Basophils', unit: '%', refRange: '0.5 - 1.0' },
        { name: 'Monocytes', unit: '%', refRange: '2.0 - 6.0' },
        { name: 'Lymphocytes', unit: '%', refRange: '25 - 40' },
        { name: 'ESR', unit: 'mm/hr', refRange: '< 20' },
        { name: 'RBC Morphology', unit: 'N/A', refRange: 'Normocytic / Normochromic' },
      ],
    },
    {
      testName: 'Blood Film for Malaria (Giemsa Stain)',
      category: 'Hematology',
      specimenType: 'Capillary / EDTA Whole Blood',
      defaultUnit: 'Microscopy',
      defaultRefRange: 'No hemoparasites seen (Negative)',
    },
    {
      testName: 'Hemoglobin & Hematocrit (Hgb / Hct)',
      category: 'Hematology',
      specimenType: 'Whole Blood',
      defaultUnit: 'g/dL',
      defaultRefRange: '12.0 - 17.5 g/dL',
    },
    {
      testName: 'Erythrocyte Sedimentation Rate (ESR)',
      category: 'Hematology',
      specimenType: 'Citrated Whole Blood (Black Top)',
      defaultUnit: 'mm/hr',
      defaultRefRange: '0 - 15 (M) / 0 - 20 (F)',
    },
    {
      testName: 'ABO & Rh Blood Grouping',
      category: 'Hematology',
      specimenType: 'Whole Blood',
      defaultUnit: 'Typing',
      defaultRefRange: 'A / B / AB / O (Rh + / -)',
    },
  ],
  Biochemistry: [
    {
      testName: 'Random Blood Glucose (RBS)',
      category: 'Biochemistry',
      specimenType: 'Fluoride Oxalate / Serum',
      defaultUnit: 'mg/dL',
      defaultRefRange: '70 - 110 mg/dL (Male & Female)',
    },
    {
      testName: 'Fasting Blood Sugar (FBS)',
      category: 'Biochemistry',
      specimenType: 'Fluoride Oxalate / Serum',
      defaultUnit: 'mg/dL',
      defaultRefRange: '70 - 100 mg/dL',
    },
    {
      testName: 'Renal Function Test (Creatinine & Urea)',
      category: 'Biochemistry',
      specimenType: 'Serum (Gold / Red Top)',
      defaultUnit: 'mg/dL',
      defaultRefRange: 'Creatinine: 0.7 - 1.4 (M) / 0.6 - 1.1 (F); Urea: 20 - 40',
      parameters: [
        { name: 'Random Blood Sugar (RBS)', unit: 'mg/dL', refRange: '70 - 110' },
        { name: 'Urea', unit: 'mg/dL', refRange: '20 - 40' },
        { name: 'Serum Creatinine', unit: 'mg/dL', refRange: '0.7 - 1.4 (M) / 0.6 - 1.1 (F)' },
        { name: 'Uric Acid', unit: 'mg/dL', refRange: '3.5 - 7.2 (M) / 2.6 - 6.0 (F)' },
      ],
    },
    {
      testName: 'Liver Function Panel (ALT / AST / Bilirubin)',
      category: 'Biochemistry',
      specimenType: 'Serum (Gold Top)',
      defaultUnit: 'U/L',
      defaultRefRange: 'AST: 10 - 39 (M) / 6 - 32 (F); ALT: 6 - 45 (M) / 3 - 30 (F)',
      parameters: [
        { name: 'Total Protein', unit: 'g/dL', refRange: '6.0 - 8.0' },
        { name: 'Albumin', unit: 'g/dL', refRange: '3.5 - 5.0' },
        { name: 'Total Bilirubin', unit: 'mg/dL', refRange: '0.1 - 1.2' },
        { name: 'Direct Bilirubin', unit: 'mg/dL', refRange: '0 - 0.4' },
        { name: 'AST (SGOT)', unit: 'U/L', refRange: '10 - 39 (M) / 6 - 32 (F)' },
        { name: 'ALT (SGPT)', unit: 'U/L', refRange: '6 - 45 (M) / 3 - 30 (F)' },
        { name: 'Alkaline Phosphatase (ALP)', unit: 'U/L', refRange: '52 - 237' },
        { name: 'Creatine Kinase (CK)', unit: 'U/L', refRange: '38 - 174 (M) / 30 - 135 (F)' },
        { name: 'LDH', unit: 'U/L', refRange: '60 - 190' },
      ],
    },
    {
      testName: 'Lipid Profile (Cholesterol / Triglycerides)',
      category: 'Biochemistry',
      specimenType: 'Fasting Serum',
      defaultUnit: 'mg/dL',
      defaultRefRange: 'Total Chol < 200, Triglycerides < 150',
      parameters: [
        { name: 'Total Cholesterol', unit: 'mg/dL', refRange: '130 - 234 (M) / 130 - 231 (F)' },
        { name: 'LDL Cholesterol', unit: 'mg/dL', refRange: '70 - 135 (M) / 71 - 164 (F)' },
        { name: 'HDL Cholesterol', unit: 'mg/dL', refRange: '31 - 63 (M) / 37 - 83 (F)' },
        { name: 'Triglycerides', unit: 'mg/dL', refRange: '45 - 204 (M) / 42 - 159 (F)' },
      ],
    },
    {
      testName: 'Electrolytes (Na / K / Cl)',
      category: 'Biochemistry',
      specimenType: 'Serum',
      defaultUnit: 'mmol/L',
      defaultRefRange: 'Na: 135 - 145; K: 3.3 - 4.9; Cl: 98 - 107',
      parameters: [
        { name: 'Sodium (Na)', unit: 'mmol/L', refRange: '135 - 145' },
        { name: 'Potassium (K)', unit: 'mmol/L', refRange: '3.3 - 4.9' },
        { name: 'Chloride (Cl)', unit: 'mmol/L', refRange: '98 - 107' },
      ],
    },
  ],
  Urinalysis: [
    {
      testName: 'Routine Complete Urinalysis (Dipstick + Microscopy)',
      category: 'Urinalysis',
      specimenType: 'Clean Catch Mid-stream Urine',
      defaultUnit: 'Multi-stix',
      defaultRefRange: 'Straw/Yellow, Clear, Protein: Nil, Glucose: Nil',
      parameters: [
        { name: 'Color & Clarity', unit: 'Visual', refRange: 'Pale yellow, clear' },
        { name: 'Specific Gravity', unit: 'Ratio', refRange: '1.005 - 1.030' },
        { name: 'pH', unit: 'pH', refRange: '5.0 - 8.0' },
        { name: 'Protein / Albumin', unit: 'Qualitative', refRange: 'Negative / Nil' },
        { name: 'Glucose', unit: 'Qualitative', refRange: 'Negative / Nil' },
        { name: 'Ketones', unit: 'Qualitative', refRange: 'Negative' },
        { name: 'Microscopy (WBC / Pus Cells)', unit: '/HPF', refRange: '0 - 5 /HPF' },
        { name: 'Microscopy (RBC)', unit: '/HPF', refRange: '0 - 2 /HPF' },
      ],
    },
    {
      testName: 'Urine hCG Pregnancy Test',
      category: 'Urinalysis',
      specimenType: 'First Morning Urine',
      defaultUnit: 'Qualitative',
      defaultRefRange: 'Negative',
    },
  ],
  Parasitology: [
    {
      testName: 'Stool Direct Microscopic Examination (Ova & Parasite)',
      category: 'Parasitology',
      specimenType: 'Fresh Stool Specimen',
      defaultUnit: 'Microscopy',
      defaultRefRange: 'No ova, cysts, trophozoites seen (Normal)',
    },
    {
      testName: 'Stool for Occult Blood (FOBT)',
      category: 'Parasitology',
      specimenType: 'Fresh Stool',
      defaultUnit: 'Qualitative',
      defaultRefRange: 'Negative',
    },
  ],
  Serology: [
    {
      testName: 'Widal Agglutination Test (Typhoid Screen)',
      category: 'Serology',
      specimenType: 'Serum',
      defaultUnit: 'Titer',
      defaultRefRange: 'TO < 1:80, TH < 1:80 (Non-reactive)',
    },
    {
      testName: 'H. Pylori Stool Antigen Test',
      category: 'Serology',
      specimenType: 'Fresh Stool',
      defaultUnit: 'Chromatographic',
      defaultRefRange: 'Negative',
    },
    {
      testName: 'Hepatitis B Surface Antigen (HBsAg Rapid)',
      category: 'Serology',
      specimenType: 'Serum / Whole Blood',
      defaultUnit: 'Rapid Test',
      defaultRefRange: 'Non-reactive (Negative)',
    },
    {
      testName: 'VDRL / RPR Syphilis Serology',
      category: 'Serology',
      specimenType: 'Serum',
      defaultUnit: 'Flocculation',
      defaultRefRange: 'Non-reactive',
    },
  ],
  Microbiology: [
    {
      testName: 'Sputum AFB for Tuberculosis (Ziehl-Neelsen)',
      category: 'Microbiology',
      specimenType: 'Early Morning Deep Sputum',
      defaultUnit: 'Microscopy',
      defaultRefRange: 'No Acid-Fast Bacilli seen (Negative)',
    },
    {
      testName: 'Gram Stain & Wet Mount Microscopy',
      category: 'Microbiology',
      specimenType: 'Urethral / Vaginal / Wound Swab',
      defaultUnit: 'Microscopy',
      defaultRefRange: 'Normal flora, no clue cells or yeasts',
    },
  ],
};

export function findStandardLabTest(testName: string): StandardLabTest | undefined {
  for (const list of Object.values(LAB_PANELS)) {
    const match = list.find(t => t.testName.toLowerCase() === testName.toLowerCase() || t.testName.toLowerCase().includes(testName.toLowerCase()));
    if (match) return match;
  }
  return undefined;
}

