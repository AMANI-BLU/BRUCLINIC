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
        { name: 'White Blood Cells (WBC)', unit: '×10³/µL', refRange: '4.5 - 11.0' },
        { name: 'Hemoglobin (Hgb)', unit: 'g/dL', refRange: '13.5 - 17.5 (M) / 12.0 - 15.5 (F)' },
        { name: 'Hematocrit (Hct)', unit: '%', refRange: '38.8 - 50.0 (M) / 34.9 - 44.5 (F)' },
        { name: 'Platelet Count', unit: '×10³/µL', refRange: '150 - 450' },
        { name: 'Red Blood Cells (RBC)', unit: '×10⁶/µL', refRange: '4.35 - 5.65' },
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
      defaultRefRange: '70 - 140 mg/dL',
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
      defaultRefRange: 'Creatinine: 0.7 - 1.3, Urea: 15 - 45',
      parameters: [
        { name: 'Serum Creatinine', unit: 'mg/dL', refRange: '0.7 - 1.3' },
        { name: 'Blood Urea Nitrogen (BUN)', unit: 'mg/dL', refRange: '7 - 20' },
      ],
    },
    {
      testName: 'Liver Function Panel (ALT / AST / Bilirubin)',
      category: 'Biochemistry',
      specimenType: 'Serum (Gold Top)',
      defaultUnit: 'U/L',
      defaultRefRange: 'ALT: 7 - 56, AST: 10 - 40',
      parameters: [
        { name: 'ALT (SGPT)', unit: 'U/L', refRange: '7 - 56' },
        { name: 'AST (SGOT)', unit: 'U/L', refRange: '10 - 40' },
        { name: 'Total Bilirubin', unit: 'mg/dL', refRange: '0.1 - 1.2' },
      ],
    },
    {
      testName: 'Lipid Profile (Cholesterol / Triglycerides)',
      category: 'Biochemistry',
      specimenType: 'Fasting Serum',
      defaultUnit: 'mg/dL',
      defaultRefRange: 'Total Chol < 200, Triglycerides < 150',
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

