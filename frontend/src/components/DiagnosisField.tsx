import { diagnosisSuggestions } from '../utils/diagnosis';

interface DiagnosisFieldProps {
  label: string;
  value: string;
  diagnoses: string[];
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}

export default function DiagnosisField({ label, value, diagnoses, onChange, required, placeholder }: DiagnosisFieldProps) {
  const suggestions = diagnosisSuggestions(value, diagnoses);

  return (
    <div className="form-group">
      <label className="form-label">{label}{required ? ' *' : ''}</label>
      <input
        required={required}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
      />
      {suggestions.length > 0 && (
        <div className="mt-2" role="group" aria-label="Possible existing diagnosis matches">
          <small className="text-muted d-block mb-1">Similar existing diagnoses. Verify before selecting:</small>
          <div className="d-flex flex-wrap" style={{ gap: '0.35rem' }}>
            {suggestions.map(suggestion => (
              <button
                key={suggestion}
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => onChange(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}