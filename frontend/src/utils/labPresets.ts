/**
 * Borana University Student Service Clinic — General Laboratory Request and
 * Report Form catalogue.
 *
 * The scanned paper form is the source for the section names, test labels,
 * units, and reference ranges below. Specimen names are the electronic form's
 * operational values because the paper form leaves specimen collection to the
 * laboratory workflow.
 */

export type LabFormCategory =
  | 'Hematology'
  | 'Biochemistry'
  | 'Urinalysis'
  | 'Parasitology'
  | 'Serology'
  | 'Microbiology'
  | 'Others';

export interface StandardLabTest {
  testName: string;
  category: LabFormCategory;
  formSection?: string;
  specimenType: string;
  defaultUnit: string;
  defaultRefRange: string;
  parameters?: Array<{ name: string; unit: string; refRange: string }>;
}

export interface LabFormSection {
  title: string;
  category: LabFormCategory;
  tests: StandardLabTest[];
}

const hematologySpecimen = 'EDTA whole blood';
const serumSpecimen = 'Serum';
const urineSpecimen = 'Urine';

const hematologyCbcTests: StandardLabTest[] = [
  {
    testName: 'CBC/FBC', category: 'Hematology', formSection: 'Hematology', specimenType: hematologySpecimen,
    defaultUnit: 'Panel', defaultRefRange: 'See WBC, RBC, HGB, HCT, MCV, MCH, MCHC, RDW and PLT',
    parameters: [
      { name: 'WBC', unit: 'k/µl', refRange: 'M: — · F: 4.0–11' },
      { name: 'RBC', unit: 'k/µl', refRange: 'M: 4.5–6.0 · F: 4.0–5.0' },
      { name: 'HGB', unit: 'g/dl', refRange: 'M: 14–18 · F: 12–16' },
      { name: 'HCT', unit: '%', refRange: 'M: 41–50 · F: 36–45' },
      { name: 'MCV', unit: 'fl', refRange: '80–96' },
      { name: 'MCH', unit: 'pg', refRange: '27–33' },
      { name: 'MCHC', unit: 'g/dl', refRange: '33–36' },
      { name: 'RDW', unit: '%', refRange: '11–14' },
      { name: 'PLT', unit: 'k/µl', refRange: '150–400' },
    ],
  },
  { testName: 'WBC', category: 'Hematology', formSection: 'CBC/FBC', specimenType: hematologySpecimen, defaultUnit: 'k/µl', defaultRefRange: 'M: — · F: 4.0–11' },
  { testName: 'RBC', category: 'Hematology', formSection: 'CBC/FBC', specimenType: hematologySpecimen, defaultUnit: 'k/µl', defaultRefRange: 'M: 4.5–6.0 · F: 4.0–5.0' },
  { testName: 'HGB', category: 'Hematology', formSection: 'CBC/FBC', specimenType: hematologySpecimen, defaultUnit: 'g/dl', defaultRefRange: 'M: 14–18 · F: 12–16' },
  { testName: 'HCT', category: 'Hematology', formSection: 'CBC/FBC', specimenType: hematologySpecimen, defaultUnit: '%', defaultRefRange: 'M: 41–50 · F: 36–45' },
  { testName: 'MCV', category: 'Hematology', formSection: 'CBC/FBC', specimenType: hematologySpecimen, defaultUnit: 'fl', defaultRefRange: '80–96' },
  { testName: 'MCH', category: 'Hematology', formSection: 'CBC/FBC', specimenType: hematologySpecimen, defaultUnit: 'pg', defaultRefRange: '27–33' },
  { testName: 'MCHC', category: 'Hematology', formSection: 'CBC/FBC', specimenType: hematologySpecimen, defaultUnit: 'g/dl', defaultRefRange: '33–36' },
  { testName: 'RDW', category: 'Hematology', formSection: 'CBC/FBC', specimenType: hematologySpecimen, defaultUnit: '%', defaultRefRange: '11–14' },
  { testName: 'PLT', category: 'Hematology', formSection: 'CBC/FBC', specimenType: hematologySpecimen, defaultUnit: 'k/µl', defaultRefRange: '150–400' },
];

const hematologyDifferentialTests: StandardLabTest[] = [
  { testName: 'Neutrophil', category: 'Hematology', formSection: 'WBC Differential', specimenType: hematologySpecimen, defaultUnit: '%', defaultRefRange: '40–70' },
  { testName: 'Eosinophil', category: 'Hematology', formSection: 'WBC Differential', specimenType: hematologySpecimen, defaultUnit: '%', defaultRefRange: '1.0–4.0' },
  { testName: 'Basophil', category: 'Hematology', formSection: 'WBC Differential', specimenType: hematologySpecimen, defaultUnit: '%', defaultRefRange: '0.5–1.0' },
  { testName: 'Monocyte', category: 'Hematology', formSection: 'WBC Differential', specimenType: hematologySpecimen, defaultUnit: '%', defaultRefRange: '2.0–6.0' },
  { testName: 'Lymphocyte', category: 'Hematology', formSection: 'WBC Differential', specimenType: hematologySpecimen, defaultUnit: '%', defaultRefRange: '25–40' },
  { testName: 'ESR', category: 'Hematology', formSection: 'WBC Differential', specimenType: 'Citrated whole blood', defaultUnit: 'mm/hr', defaultRefRange: '<20' },
  { testName: 'RBC Morphs', category: 'Hematology', formSection: 'WBC Differential', specimenType: hematologySpecimen, defaultUnit: 'N/A', defaultRefRange: 'Normocytic · Normochromic' },
];

const biochemistryTests: StandardLabTest[] = [
  { testName: 'RBS', category: 'Biochemistry', specimenType: serumSpecimen, defaultUnit: 'mg/dl', defaultRefRange: 'M: 70–110 · F: 70–110' },
  { testName: 'Urea', category: 'Biochemistry', specimenType: serumSpecimen, defaultUnit: 'mg/dl', defaultRefRange: 'M: 20–40 · F: 20–40' },
  { testName: 'Creat', category: 'Biochemistry', specimenType: serumSpecimen, defaultUnit: 'mg/dl', defaultRefRange: 'M: 0.7–1.4 · F: 0.6–1.1' },
  { testName: 'Uric A', category: 'Biochemistry', specimenType: serumSpecimen, defaultUnit: 'mg/dl', defaultRefRange: 'M: 3.5–7.2 · F: 2.6–6.0' },
  { testName: 'Pro-T', category: 'Biochemistry', specimenType: serumSpecimen, defaultUnit: 'g/dl', defaultRefRange: 'M: 6.0–8.0 · F: 6.0–8.0' },
  { testName: 'Alb', category: 'Biochemistry', specimenType: serumSpecimen, defaultUnit: 'g/dl', defaultRefRange: 'M: 3.5–5.0 · F: 3.5–5.0' },
  { testName: 'Bil-T', category: 'Biochemistry', specimenType: serumSpecimen, defaultUnit: 'mg/dl', defaultRefRange: 'M: 0.1–1.2 · F: 0.1–1.2' },
  { testName: 'Bil-D', category: 'Biochemistry', specimenType: serumSpecimen, defaultUnit: 'mg/dl', defaultRefRange: 'M: 0–0.4 · F: 0–0.4' },
  { testName: 'AST', category: 'Biochemistry', specimenType: serumSpecimen, defaultUnit: 'U/L', defaultRefRange: 'M: 10–39 · F: 6–32' },
  { testName: 'ALT', category: 'Biochemistry', specimenType: serumSpecimen, defaultUnit: 'U/L', defaultRefRange: 'M: 6–45 · F: 3–30' },
  { testName: 'ALP', category: 'Biochemistry', specimenType: serumSpecimen, defaultUnit: 'U/L', defaultRefRange: 'M: 52–237 · F: 52–237' },
  { testName: 'CK', category: 'Biochemistry', specimenType: serumSpecimen, defaultUnit: 'U/L', defaultRefRange: 'M: 38–174 · F: 30–135' },
  { testName: 'LDH', category: 'Biochemistry', specimenType: serumSpecimen, defaultUnit: 'U/L', defaultRefRange: 'M: 60–190 · F: 60–190' },
  { testName: 'LDL', category: 'Biochemistry', specimenType: serumSpecimen, defaultUnit: 'mg/dl', defaultRefRange: 'M: 70–135 · F: 71–164' },
  { testName: 'Chol', category: 'Biochemistry', specimenType: serumSpecimen, defaultUnit: 'mg/dl', defaultRefRange: 'M: 130–234 · F: 130–231' },
  { testName: 'HDL', category: 'Biochemistry', specimenType: serumSpecimen, defaultUnit: 'mg/dl', defaultRefRange: 'M: 31–63 · F: 37–83' },
  { testName: 'TG', category: 'Biochemistry', specimenType: serumSpecimen, defaultUnit: 'mg/dl', defaultRefRange: 'M: 45–204 · F: 42–159' },
  { testName: 'K', category: 'Biochemistry', specimenType: serumSpecimen, defaultUnit: 'mmol/L', defaultRefRange: 'M: 3.3–4.9 · F: 3.3–4.9' },
  { testName: 'Cl', category: 'Biochemistry', specimenType: serumSpecimen, defaultUnit: 'mmol/L', defaultRefRange: 'M: 98–107 · F: 98–107' },
  { testName: 'Na', category: 'Biochemistry', specimenType: serumSpecimen, defaultUnit: 'mmol/L', defaultRefRange: 'M: 135–145 · F: 135–145' },
];

const urinalysisChemicalTests: StandardLabTest[] = [
  { testName: 'pH', category: 'Urinalysis', formSection: 'Chemical', specimenType: urineSpecimen, defaultUnit: 'pH', defaultRefRange: '5.0–8.0' },
  { testName: 'SG', category: 'Urinalysis', formSection: 'Chemical', specimenType: urineSpecimen, defaultUnit: 'Ratio', defaultRefRange: '1.005–1.030' },
  { testName: 'Glucose', category: 'Urinalysis', formSection: 'Chemical', specimenType: urineSpecimen, defaultUnit: 'Qualitative', defaultRefRange: 'Negative' },
  { testName: 'Ketone', category: 'Urinalysis', formSection: 'Chemical', specimenType: urineSpecimen, defaultUnit: 'Qualitative', defaultRefRange: 'Negative' },
  { testName: 'Protein', category: 'Urinalysis', formSection: 'Chemical', specimenType: urineSpecimen, defaultUnit: 'Qualitative', defaultRefRange: 'Negative' },
  { testName: 'Nitrite', category: 'Urinalysis', formSection: 'Chemical', specimenType: urineSpecimen, defaultUnit: 'Qualitative', defaultRefRange: 'Negative' },
  { testName: 'Blood', category: 'Urinalysis', formSection: 'Chemical', specimenType: urineSpecimen, defaultUnit: 'Qualitative', defaultRefRange: 'Negative' },
  { testName: 'Leucocyte', category: 'Urinalysis', formSection: 'Chemical', specimenType: urineSpecimen, defaultUnit: 'Qualitative', defaultRefRange: 'Negative' },
  { testName: 'Bilirubin', category: 'Urinalysis', formSection: 'Chemical', specimenType: urineSpecimen, defaultUnit: 'Qualitative', defaultRefRange: 'Negative' },
];

const urinalysisMicroscopyTests: StandardLabTest[] = [
  { testName: 'Epithelial', category: 'Urinalysis', formSection: 'Microscopy', specimenType: urineSpecimen, defaultUnit: '/HPF', defaultRefRange: 'Few' },
  { testName: 'RBC', category: 'Urinalysis', formSection: 'Microscopy', specimenType: urineSpecimen, defaultUnit: '/HPF', defaultRefRange: '0–2' },
  { testName: 'WBC', category: 'Urinalysis', formSection: 'Microscopy', specimenType: urineSpecimen, defaultUnit: '/HPF', defaultRefRange: '0–5' },
  { testName: 'Casts', category: 'Urinalysis', formSection: 'Microscopy', specimenType: urineSpecimen, defaultUnit: '/LPF', defaultRefRange: 'None seen' },
  { testName: 'Crystals', category: 'Urinalysis', formSection: 'Microscopy', specimenType: urineSpecimen, defaultUnit: 'Microscopy', defaultRefRange: 'None seen' },
  { testName: 'parasites', category: 'Urinalysis', formSection: 'Microscopy', specimenType: urineSpecimen, defaultUnit: 'Microscopy', defaultRefRange: 'None seen' },
];

const serologyTests: StandardLabTest[] = [
  { testName: 'Syphilis test', category: 'Serology', specimenType: serumSpecimen, defaultUnit: 'Qualitative', defaultRefRange: 'Non-reactive' },
  { testName: 'HCG', category: 'Serology', specimenType: urineSpecimen, defaultUnit: 'Qualitative', defaultRefRange: 'Negative' },
  { testName: 'Rk39', category: 'Serology', specimenType: serumSpecimen, defaultUnit: 'Rapid test', defaultRefRange: 'Negative' },
  { testName: 'HCV', category: 'Serology', specimenType: serumSpecimen, defaultUnit: 'Qualitative', defaultRefRange: 'Non-reactive' },
  { testName: 'HBsAg', category: 'Serology', specimenType: serumSpecimen, defaultUnit: 'Qualitative', defaultRefRange: 'Non-reactive' },
  { testName: 'ASO', category: 'Serology', specimenType: serumSpecimen, defaultUnit: 'IU/ml', defaultRefRange: '<200' },
  { testName: 'RF', category: 'Serology', specimenType: serumSpecimen, defaultUnit: 'IU/ml', defaultRefRange: '<20' },
  { testName: 'Blood group', category: 'Serology', specimenType: 'Whole blood', defaultUnit: 'Typing', defaultRefRange: 'A / B / AB / O; Rh + / −' },
  { testName: 'H. pylori', category: 'Serology', specimenType: 'Serum or stool', defaultUnit: 'Qualitative', defaultRefRange: 'Negative' },
];

const microbiologyTests: StandardLabTest[] = [
  { testName: 'Gram stain', category: 'Microbiology', specimenType: 'Clinical specimen', defaultUnit: 'Microscopy', defaultRefRange: 'No significant pathogen seen' },
  { testName: 'KOH', category: 'Microbiology', specimenType: 'Skin or clinical specimen', defaultUnit: 'Microscopy', defaultRefRange: 'No fungal elements seen' },
  { testName: 'CSF analysis', category: 'Microbiology', specimenType: 'CSF', defaultUnit: 'Report', defaultRefRange: 'See laboratory report' },
];

const parasitologyTests: StandardLabTest[] = [
  { testName: 'Stool Microscopy', category: 'Parasitology', specimenType: 'Fresh stool', defaultUnit: 'Microscopy', defaultRefRange: 'No ova, cysts or parasites seen' },
  { testName: 'Blood film', category: 'Parasitology', specimenType: 'Whole blood', defaultUnit: 'Microscopy', defaultRefRange: 'No hemoparasites seen' },
];

export const LAB_FORM_SECTIONS: LabFormSection[] = [
  { title: 'Hematology · CBC/FBC', category: 'Hematology', tests: hematologyCbcTests },
  { title: 'Hematology · WBC Differential', category: 'Hematology', tests: hematologyDifferentialTests },
  { title: 'Biochemistry', category: 'Biochemistry', tests: biochemistryTests },
  { title: 'Chemical', category: 'Urinalysis', tests: urinalysisChemicalTests },
  { title: 'Microscopy', category: 'Urinalysis', tests: urinalysisMicroscopyTests },
  { title: 'Serology', category: 'Serology', tests: serologyTests },
  { title: 'Microbiology', category: 'Microbiology', tests: microbiologyTests },
  { title: 'Parasitology', category: 'Parasitology', tests: parasitologyTests },
];

export const LAB_PANELS: Record<string, StandardLabTest[]> = LAB_FORM_SECTIONS.reduce<Record<string, StandardLabTest[]>>((panels, section) => {
  panels[section.category] = [...(panels[section.category] || []), ...section.tests];
  return panels;
}, {});

export function findStandardLabTest(testName: string, category?: string): StandardLabTest | undefined {
  const normalized = testName.trim().toLowerCase();
  const lists = [
    ...(category && LAB_PANELS[category] ? [LAB_PANELS[category]] : []),
    ...Object.entries(LAB_PANELS).filter(([name]) => name !== category).map(([, tests]) => tests),
  ];
  for (const list of lists) {
    const match = list.find(test =>
      test.testName.toLowerCase() === normalized || test.testName.toLowerCase().includes(normalized),
    );
    if (match) return match;
  }
  return undefined;
}
