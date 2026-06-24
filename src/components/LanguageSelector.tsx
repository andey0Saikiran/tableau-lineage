import { Globe, ChevronDown } from 'lucide-react';
import { LANGUAGES, type Language } from '../lib/i18n';

interface Props {
  value: Language;
  onChange: (lang: Language) => void;
}

/**
 * Native <select> — fully keyboard- and screen-reader-accessible by default,
 * styled to match the toolbar. Standard affordance over a custom listbox.
 */
export function LanguageSelector({ value, onChange }: Props) {
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Language</span>
      <Globe className="pointer-events-none absolute left-3 h-4 w-4 text-muted" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Language)}
        className="appearance-none rounded-lg border border-border bg-white py-2 pl-9 pr-8 text-sm font-medium text-ink shadow-sm transition-colors hover:border-brand-500 focus:border-brand-500"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.flag} {l.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 h-4 w-4 text-muted" />
    </label>
  );
}
