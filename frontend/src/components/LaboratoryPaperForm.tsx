import type { Dispatch, FormEvent, SetStateAction } from 'react';
import {
  Activity, ChevronLeft, ChevronRight, ClipboardList, FileText,
  FlaskConical, Plus, Send, ShieldCheck, Sparkles, Trash2, UserRound,
} from 'lucide-react';
import type { ClinicQueueItem, Patient, Priority, UserProfile } from '../types';
import { LAB_FORM_SECTIONS, type LabFormSection, type StandardLabTest } from '../utils/labPresets';
import LoadingButton from './LoadingButton';
import './LaboratoryPaperForm.css';

export interface LabRequestLine {
  testName: string;
  category: string;
  specimenType: string;
  unit?: string;
  referenceRange?: string;
  technologistInstructions: string;
}

interface LaboratoryPaperFormProps {
  selectedQueueItem: ClinicQueueItem;
  selectedPatient?: Patient;
  patientName: string;
  patientAge?: number;
  patientCode: string;
  currentUser: UserProfile | null;
  consultation: { diagnosis: string; clinicalNotes: string };
  labTests: LabRequestLine[];
  onTogglePreset: (preset: StandardLabTest) => void;
  onAddCustomTest: (line: LabRequestLine) => void;
  onUpdateInstruction: (index: number, value: string) => void;
  onRemoveTest: (index: number) => void;
  labTestName: string;
  setLabTestName: Dispatch<SetStateAction<string>>;
  labCategory: string;
  setLabCategory: Dispatch<SetStateAction<string>>;
  labSpecimenType: string;
  setLabSpecimenType: Dispatch<SetStateAction<string>>;
  labCustomUnit: string;
  setLabCustomUnit: Dispatch<SetStateAction<string>>;
  labCustomReferenceRange: string;
  setLabCustomReferenceRange: Dispatch<SetStateAction<string>>;
  labTechInstructions: string;
  setLabTechInstructions: Dispatch<SetStateAction<string>>;
  labPriority: Priority;
  setLabPriority: Dispatch<SetStateAction<Priority>>;
  labClinicalNotes: string;
  setLabClinicalNotes: Dispatch<SetStateAction<string>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
  actionLoading: 'lab' | 'pharmacy' | 'complete' | 'assessment' | 'referral' | null;
}

type FormPage = 1 | 2;

function sectionTests(category: string): LabFormSection[] {
  return LAB_FORM_SECTIONS.filter(section => section.category === category);
}

function selectedTest(line: LabRequestLine, preset: StandardLabTest) {
  return line.testName === preset.testName
    && line.category === preset.category
    && line.specimenType === preset.specimenType;
}

function splitReferenceRange(value: string) {
  const match = value.match(/^M:\s*(.*?)\s*·\s*F:\s*(.*)$/);
  return match ? { male: match[1], female: match[2] } : { male: value, female: value };
}

function referenceRows(category: string) {
  return sectionTests(category).flatMap(section => section.tests.flatMap(test => {
    if (!test.parameters || test.testName !== 'CBC/FBC') return [{ testName: test.testName, unit: test.defaultUnit, range: test.defaultRefRange }];
    return test.parameters.map(parameter => ({ testName: parameter.name, unit: parameter.unit, range: parameter.refRange }));
  }));
}

function CheckMark({ checked }: { checked: boolean }) {
  return <span className={`lab-paper-check ${checked ? 'is-checked' : ''}`} aria-hidden="true">{checked ? '✓' : ''}</span>;
}

function InvestigationSection({
  section,
  labTests,
  onTogglePreset,
  onAddCustomTest,
}: {
  section: LabFormSection;
  labTests: LabRequestLine[];
  onTogglePreset: (preset: StandardLabTest) => void;
}) {
  return (
    <section className="lab-paper-investigation-section">
      <div className="lab-paper-section-band">
        <span>{section.title}</span>
        <span className="lab-paper-section-hint">Mark requested tests</span>
      </div>
      <div className="lab-paper-test-table-wrap">
        <table className="lab-paper-test-table">
          <thead>
            <tr><th aria-label="Select" /><th>Tests</th><th>Units</th><th>Reference</th><th>Result</th></tr>
          </thead>
          <tbody>
            {section.tests.map(test => {
              const isSelected = labTests.some(line => selectedTest(line, test));
              return (
                <tr key={`${section.title}-${test.testName}`} className={isSelected ? 'is-requested' : ''}>
                  <td>
                    <button
                      type="button"
                      className="lab-paper-check-button"
                      onClick={() => onTogglePreset(test)}
                      aria-label={`${isSelected ? 'Remove' : 'Request'} ${test.testName}`}
                    >
                      <CheckMark checked={isSelected} />
                    </button>
                  </td>
                  <td className="lab-paper-test-name">{test.testName}</td>
                  <td>{test.defaultUnit}</td>
                  <td className="lab-paper-reference">{test.defaultRefRange}</td>
                  <td className="lab-paper-result-placeholder">{isSelected ? 'Requested' : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReferenceTable({ category }: { category: 'Hematology' | 'Biochemistry' }) {
  return (
    <table className="lab-paper-reference-table">
      <thead><tr><th>Tests</th><th>Units</th><th>Male</th><th>Female</th></tr></thead>
      <tbody>
        {referenceRows(category).map(row => {
          const range = splitReferenceRange(row.range);
          return <tr key={`${category}-${row.testName}`}><td>{row.testName}</td><td>{row.unit}</td><td>{range.male}</td><td>{range.female}</td></tr>;
        })}
      </tbody>
    </table>
  );
}

export default function LaboratoryPaperForm({
  selectedQueueItem,
  selectedPatient,
  patientName,
  patientAge,
  patientCode,
  currentUser,
  consultation,
  labTests,
  onTogglePreset,
  onUpdateInstruction,
  onRemoveTest,
  labTestName,
  setLabTestName,
  labCategory,
  setLabCategory,
  labSpecimenType,
  setLabSpecimenType,
  labCustomUnit,
  setLabCustomUnit,
  labCustomReferenceRange,
  setLabCustomReferenceRange,
  labTechInstructions,
  setLabTechInstructions,
  labPriority,
  setLabPriority,
  labClinicalNotes,
  setLabClinicalNotes,
  onSubmit,
  onBack,
  actionLoading,
}: LaboratoryPaperFormProps) {
  const [page, setPage] = useState<FormPage>(1);
  const hemaSections = sectionTests('Hematology');
  const bioSections = sectionTests('Biochemistry');
  const urineSections = sectionTests('Urinalysis');
  const serologySections = sectionTests('Serology');
  const microbiologySections = sectionTests('Microbiology');
  const parasitologySections = sectionTests('Parasitology');

  const addCustomTest = () => {
    if (!labTestName.trim()) return;
    onAddCustomTest({
      testName: labTestName.trim(),
      category: labCategory || 'Others',
      specimenType: labSpecimenType.trim() || 'Clinical Sample',
      defaultUnit: labCustomUnit.trim(),
      referenceRange: labCustomReferenceRange.trim() || 'Not specified on form',
      technologistInstructions: labTechInstructions.trim(),
    });
    setLabTestName('');
    setLabSpecimenType('');
    setLabCustomUnit('');
    setLabCustomReferenceRange('');
    setLabTechInstructions('');
  };

  return (
    <form className="lab-paper-form" onSubmit={onSubmit} noValidate>
      <div className="lab-paper-toolbar">
        <div className="lab-paper-toolbar-title">
          <span className="lab-paper-toolbar-icon"><FlaskConical size={18} /></span>
          <div><strong>General laboratory request and report form</strong><small>Electronic representation of the Borana University clinic form</small></div>
        </div>
        <div className="lab-paper-page-switcher" role="tablist" aria-label="Laboratory form pages">
          <button type="button" className={page === 1 ? 'is-active' : ''} onClick={() => setPage(1)}><ClipboardList size={14} /> Page 1 · Request</button>
          <button type="button" className={page === 2 ? 'is-active' : ''} onClick={() => setPage(2)}><Activity size={14} /> Page 2 · Ranges</button>
        </div>
      </div>

      <div className="lab-paper-sheet">
        <header className="lab-paper-header">
          <div className="lab-paper-logo" aria-label="Borana University clinic emblem"><ShieldCheck size={30} /><small>BU</small></div>
          <div className="lab-paper-title-block">
            <strong>BORANA UNIVERSITY</strong>
            <span>Student Service Clinic</span>
            <b>GENERAL LABORATORY REQUEST<br />AND REPORT FORM</b>
          </div>
          <div className="lab-paper-document-meta">
            <span><b>Doc No:</b> YGH/UALS/FS 4-001</span><span><b>Copy No:</b> 01</span>
            <span><b>Ver No:</b> 03</span><span><b>Effective Date:</b> 30-12-2011 EC</span>
            <span><b>Page:</b> {page} of 2</span>
          </div>
        </header>

        {page === 1 ? (
          <>
            <section className="lab-paper-patient-block">
              <div className="lab-paper-block-title"><UserRound size={14} /> Patient information</div>
              <div className="lab-paper-patient-grid">
                <div className="lab-paper-field"><b>*Name</b><span>{patientName}</span></div>
                <div className="lab-paper-field"><b>Age</b><span>{patientAge ?? '—'}</span></div>
                <div className="lab-paper-field"><b>*MRN</b><span>{patientCode || '—'}</span></div>
                <div className="lab-paper-lab-use">
                  <b>For lab use only</b><span>Cost: —</span><span>Log in: —</span><span>Log out: —</span><span>STAR: {labPriority === 'Critical' ? 'STAT' : '—'}</span>
                </div>
                <div className="lab-paper-field"><b>*Address</b><span>{selectedPatient?.address || '—'}</span></div>
                <div className="lab-paper-field"><b>Sex</b><span>{selectedPatient?.gender || '—'}</span></div>
                <div className="lab-paper-field"><b>*Ref unit</b><span>OPD</span></div>
                <div className="lab-paper-field"><b>Date</b><span>{new Date().toLocaleDateString()}</span></div>
                <div className="lab-paper-field lab-paper-notes"><b>Clinical notes</b><span>{consultation.clinicalNotes || selectedQueueItem.chiefComplaint || '—'}</span></div>
              </div>
            </section>

            <div className="lab-paper-selection-summary">
              <div><Sparkles size={15} /><strong>{labTests.length} investigation{labTests.length === 1 ? '' : 's'} selected</strong><span>Click the boxes below to reproduce the paper check marks.</span></div>
              <span className={`lab-paper-priority-chip priority-${labPriority.toLowerCase()}`}>{labPriority === 'Critical' ? 'STAT / Emergency' : labPriority === 'High' ? 'Urgent' : 'Routine'}</span>
            </div>

            <div className="lab-paper-investigation-grid">
              <div>{hemaSections.map(section => <InvestigationSection key={section.title} section={section} labTests={labTests} onTogglePreset={onTogglePreset} />)}</div>
              <div>{bioSections.map(section => <InvestigationSection key={section.title} section={section} labTests={labTests} onTogglePreset={onTogglePreset} />)}</div>
              <div>{urineSections.map(section => <InvestigationSection key={section.title} section={section} labTests={labTests} onTogglePreset={onTogglePreset} />)}</div>
              <div>{serologySections.map(section => <InvestigationSection key={section.title} section={section} labTests={labTests} onTogglePreset={onTogglePreset} />)}</div>
              <div>{microbiologySections.map(section => <InvestigationSection key={section.title} section={section} labTests={labTests} onTogglePreset={onTogglePreset} />)}</div>
              <div>{parasitologySections.map(section => <InvestigationSection key={section.title} section={section} labTests={labTests} onTogglePreset={onTogglePreset} />)}</div>
            </div>

            <section className="lab-paper-custom-block">
              <div className="lab-paper-section-band"><span>Others</span><span className="lab-paper-section-hint">For tests not listed on the form</span></div>
              <div className="lab-paper-custom-grid">
                <label>Test name<input value={labTestName} onChange={event => setLabTestName(event.target.value)} placeholder="Specify investigation" /></label>
                <label>Specimen<input value={labSpecimenType} onChange={event => setLabSpecimenType(event.target.value)} placeholder="Serum, stool, swab…" /></label>
                <label>Unit<input value={labCustomUnit} onChange={event => setLabCustomUnit(event.target.value)} placeholder="Unit" /></label>
                <label>Reference range<input value={labCustomReferenceRange} onChange={event => setLabCustomReferenceRange(event.target.value)} placeholder="Optional" /></label>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addCustomTest}><Plus size={14} /> Add</button>
              </div>
            </section>

            <section className="lab-paper-request-grid">
              <div className="lab-paper-selected-lines">
                <div className="lab-paper-mini-title"><FileText size={14} /> Selected investigations and technologist instructions</div>
                {labTests.length === 0 ? <span className="lab-paper-empty">No investigation selected yet.</span> : labTests.map((test, index) => (
                  <div className="lab-paper-selected-line" key={`${test.testName}-${index}`}>
                    <span className="lab-paper-line-number">{index + 1}</span><strong>{test.testName}</strong><small>{test.unit || '—'} · {test.referenceRange || 'See page 2'}</small>
                    <input value={test.technologistInstructions} onChange={event => onUpdateInstruction(index, event.target.value)} placeholder="Tech initials / what to look for" />
                    <button type="button" className="lab-paper-remove" onClick={() => onRemoveTest(index)} aria-label={`Remove ${test.testName}`}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
              <div className="lab-paper-order-details">
                <label><span>Clinical indication / presumptive diagnosis</span><textarea rows={3} value={labClinicalNotes} onChange={event => setLabClinicalNotes(event.target.value)} placeholder="Why are these tests needed?" /></label>
                <label><span>Priority / STAR</span><select value={labPriority} onChange={event => setLabPriority(event.target.value as Priority)}><option value="Medium">Routine</option><option value="High">Urgent</option><option value="Critical">STAT / Emergency</option></select></label>
              </div>
            </section>

            <div className="lab-paper-signatures">
              <div><b>Requesting Clinician</b><span>Name: {currentUser?.name || selectedQueueItem.assignedDoctorName || 'OPD clinician'}</span><span>Sign: {currentUser?.name || 'Digital signature'}</span></div>
              <div><b>Technologist / Lab use</b><span>Tech initials: __________________</span><span>Cost / Log in / Log out completed by laboratory</span></div>
            </div>
          </>
        ) : (
          <>
            <div className="lab-paper-page-heading"><h2>Biological reference ranges</h2><p>Reference values reproduced from page 2 of the Borana laboratory form.</p></div>
            <div className="lab-paper-reference-grid"><section><div className="lab-paper-reference-title">Hematology</div><ReferenceTable category="Hematology" /></section><section><div className="lab-paper-reference-title">Biochemistry</div><ReferenceTable category="Biochemistry" /></section></div>
            <section className="lab-paper-instructions">
              <h3>General instructions</h3>
              <ul>
                <li>All fields under “Patient information” and “Requesting Clinician” are required.</li>
                <li>Check boxes should be clearly marked for all tests requested.</li>
                <li>Referring clinicians should use the stamp of their respective unit.</li>
                <li>Tech initial is the initial of the laboratory personnel who performed the test.</li>
                <li>For emergency/urgent requests, use the STAT indication under patient information.</li>
                <li>For tests not listed, specify the test clearly under the “Others” section.</li>
                <li>Every information should be written in such a way that it is easy to read.</li>
              </ul>
              <p className="lab-paper-document-note">NB: Failure to follow these instructions could result in rejection of the request.</p>
            </section>
            <div className="lab-paper-authority">Authority for issue: YGHL · Controlled electronic form · Version 03</div>
          </>
        )}
      </div>

      <div className="lab-paper-actions">
        <button type="button" className="btn btn-secondary" onClick={onBack}><ChevronLeft size={15} /> Back to assessment</button>
        {page === 1 ? <button type="button" className="btn btn-secondary" onClick={() => setPage(2)}>View biological ranges <ChevronRight size={15} /></button> : <button type="button" className="btn btn-secondary" onClick={() => setPage(1)}><ChevronLeft size={15} /> Return to request</button>}
        <LoadingButton type="submit" className="btn btn-primary" disabled={(labTests.length === 0 && !labTestName.trim()) || Boolean(actionLoading && actionLoading !== 'lab')} loading={actionLoading === 'lab'} loadingLabel="Sending…">
          <Send size={15} /> Dispatch {labTests.length || 1} investigation{labTests.length === 1 ? '' : 's'} to Laboratory
        </LoadingButton>
      </div>
    </form>
  );
}
