import { Database, FunctionSquare, Columns3, SlidersHorizontal, Braces, Sigma, type LucideIcon } from 'lucide-react';
import type { LineageStats } from '../lib/types';
import type { TranslationKey } from '../lib/i18n';

export type HighlightType = 'datasource' | 'calc' | 'raw' | 'parameter' | 'lod' | 'table_calc';

interface Props {
  stats: LineageStats;
  t: (k: TranslationKey) => string;
  selected: HighlightType | null;
  onSelect: (type: HighlightType) => void;
}

interface Card {
  type: HighlightType;
  label: string;
  value: number;
  Icon: LucideIcon;
  text: string;
  ring: string;
  selBg: string;
}

export function StatsGrid({ stats, t, selected, onSelect }: Props) {
  const cards: Card[] = [
    { type: 'datasource', label: t('dataSources'), value: stats.datasources, Icon: Database, text: 'text-violet-600', ring: 'ring-violet-200', selBg: 'bg-violet-50 ring-violet-400' },
    { type: 'calc', label: t('calculatedFields'), value: stats.calculated_fields, Icon: FunctionSquare, text: 'text-brand-600', ring: 'ring-brand-100', selBg: 'bg-brand-50 ring-brand-400' },
    { type: 'raw', label: t('rawFields'), value: stats.raw_fields, Icon: Columns3, text: 'text-emerald-600', ring: 'ring-emerald-200', selBg: 'bg-emerald-50 ring-emerald-400' },
    { type: 'parameter', label: t('parameters'), value: stats.parameters, Icon: SlidersHorizontal, text: 'text-pink-600', ring: 'ring-pink-200', selBg: 'bg-pink-50 ring-pink-400' },
    { type: 'lod', label: t('lodExpressions'), value: stats.lod_fields, Icon: Braces, text: 'text-fuchsia-700', ring: 'ring-fuchsia-200', selBg: 'bg-fuchsia-50 ring-fuchsia-400' },
    { type: 'table_calc', label: t('tableCalcs'), value: stats.table_calcs, Icon: Sigma, text: 'text-amber-600', ring: 'ring-amber-200', selBg: 'bg-amber-50 ring-amber-400' },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c, i) => {
          const isSel = selected === c.type;
          const disabled = c.value === 0;
          return (
            <button
              key={c.type}
              type="button"
              disabled={disabled}
              aria-pressed={isSel}
              onClick={() => onSelect(c.type)}
              style={{ animationDelay: `${i * 45}ms` }}
              className={`animate-scale-in rounded-2xl border border-border bg-white p-4 text-left shadow-sm ring-1 transition-all ${
                disabled
                  ? 'cursor-default opacity-60 ring-transparent'
                  : isSel
                    ? `cursor-pointer ${c.selBg} ring-2`
                    : `cursor-pointer ${c.ring} hover:-translate-y-0.5 hover:shadow-md`
              }`}
            >
              <div className="flex items-start justify-between">
                <span className={`text-3xl font-extrabold tabular-nums ${c.text}`}>{c.value}</span>
                <c.Icon className={`h-4 w-4 ${c.text} opacity-70`} aria-hidden />
              </div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{c.label}</div>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-center text-xs text-muted sm:text-left">
        Tip: click a metric to highlight those nodes in the graph.
      </p>
    </div>
  );
}
