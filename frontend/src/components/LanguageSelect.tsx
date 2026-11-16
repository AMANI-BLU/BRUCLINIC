import { Languages } from 'lucide-react';
import { LANGUAGE_OPTIONS, useLanguage } from '../context/LanguageContext';
import './LanguageSelect.css';

interface LanguageSelectProps {
  className?: string;
}

export default function LanguageSelect({ className = '' }: LanguageSelectProps) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <label className={`language-select ${className}`.trim()}>
      <Languages size={15} aria-hidden="true" />
      <span className="visually-hidden">{t('Language')}</span>
      <select
        aria-label={t('Language')}
        value={language}
        onChange={event => setLanguage(event.target.value as typeof language)}
      >
        {LANGUAGE_OPTIONS.map(option => (
          <option key={option.code} value={option.code}>{option.nativeName}</option>
        ))}
      </select>
    </label>
  );
}
