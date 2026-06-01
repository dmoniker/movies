'use client';

import { ChevronDown, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import {
  DEFAULT_BROWSE_FILTERS,
  FILTER_GROUPS,
  GENRE_OPTIONS,
  RELEASE_WINDOW_OPTIONS,
  SORT_OPTIONS,
  filtersAreDefault,
  type TmdbBrowseFilters,
} from '../tmdb-browse';

interface TmdbFilterPanelProps {
  filters: TmdbBrowseFilters;
  onChange: (filters: TmdbBrowseFilters) => void;
  loading?: boolean;
}

const PRIORITY_STYLES = {
  signature: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  core: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  v2: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  nice: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
};

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-10 h-6 rounded-full transition-colors ${
          checked ? 'bg-violet-600' : 'bg-zinc-300 dark:bg-zinc-600'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            checked ? 'translate-x-4' : ''
          }`}
        />
      </button>
      <span className="min-w-0">
        <span className="text-sm font-medium block">{label}</span>
        {description ? (
          <span className="text-xs text-zinc-500 dark:text-zinc-400 block mt-0.5">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

function SliderField({
  value,
  onChange,
  min,
  max,
  step,
  label,
  description,
  formatValue,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  min: number;
  max: number;
  step: number;
  label: string;
  description?: string;
  formatValue?: (value: number | null) => string;
}) {
  const display = formatValue ? formatValue(value) : value === null ? 'Any' : String(value);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs font-mono text-violet-600 dark:text-violet-400">{display}</span>
      </div>
      {description ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">{description}</p>
      ) : null}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value ?? min}
        onChange={(e) => {
          const next = Number(e.target.value);
          onChange(next <= min ? null : next);
        }}
        className="w-full accent-violet-600"
      />
    </div>
  );
}

export default function TmdbFilterPanel({ filters, onChange, loading }: TmdbFilterPanelProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(['hard', 'quality', 'mood'])
  );

  const update = (patch: Partial<TmdbBrowseFilters>) => {
    onChange({ ...filters, ...patch, page: 1 });
  };

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderField = (field: (typeof FILTER_GROUPS)[0]['fields'][0]) => {
    switch (field.type) {
      case 'toggle': {
        const key = field.key as 'excludeOscarNomineesAndWinners' | 'indieFocus' | 'excludeSequels' | 'excludeFranchise' | 'excludeAdult';
        return (
          <Toggle
            key={field.key}
            checked={Boolean(filters[key])}
            onChange={(value) => update({ [key]: value })}
            label={field.label}
            description={field.description}
          />
        );
      }
      case 'slider': {
        if (field.key === 'minVoteAverage') {
          return (
            <SliderField
              key={field.key}
              value={filters.minVoteAverage}
              onChange={(value) => update({ minVoteAverage: value ?? 0 })}
              min={field.min ?? 0}
              max={field.max ?? 10}
              step={field.step ?? 0.5}
              label={field.label}
              description={field.description}
              formatValue={(v) => (v === null ? 'Any' : v.toFixed(1))}
            />
          );
        }
        if (field.key === 'minVoteCount') {
          return (
            <SliderField
              key={field.key}
              value={filters.minVoteCount}
              onChange={(value) => update({ minVoteCount: value ?? 0 })}
              min={field.min ?? 0}
              max={field.max ?? 5000}
              step={field.step ?? 50}
              label={field.label}
              description={field.description}
            />
          );
        }
        if (field.key === 'maxRuntime') {
          return (
            <SliderField
              key={field.key}
              value={filters.maxRuntime}
              onChange={(value) => update({ maxRuntime: value })}
              min={field.min ?? 60}
              max={field.max ?? 240}
              step={field.step ?? 15}
              label={field.label}
              description={field.description}
              formatValue={(v) => (v === null ? 'Any' : `${v} min`)}
            />
          );
        }
        if (field.key === 'maxBudgetMillions') {
          return (
            <SliderField
              key={field.key}
              value={filters.maxBudgetMillions}
              onChange={(value) => update({ maxBudgetMillions: value })}
              min={field.min ?? 0}
              max={field.max ?? 200}
              step={field.step ?? 5}
              label={field.label}
              description={field.description}
              formatValue={(v) => (v === null ? 'Any' : `$${v}M`)}
            />
          );
        }
        return null;
      }
      case 'select':
        if (field.key === 'releaseWindow') {
          return (
            <div key={field.key}>
              <span className="text-sm font-medium block mb-2">{field.label}</span>
              {field.description ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">{field.description}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {RELEASE_WINDOW_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => update({ releaseWindow: value })}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                      filters.releaseWindow === value
                        ? 'bg-violet-600 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          );
        }
        return null;
      case 'genres':
        return (
          <div key={field.key}>
            <span className="text-sm font-medium block mb-2">{field.label}</span>
            <div className="flex flex-wrap gap-1.5">
              {GENRE_OPTIONS.map(({ id, name }) => {
                const selected = filters.genreIds.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      const genreIds = selected
                        ? filters.genreIds.filter((g) => g !== id)
                        : [...filters.genreIds, id];
                      update({ genreIds });
                    }}
                    className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all ${
                      selected
                        ? 'bg-violet-600 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl sm:rounded-3xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <h3 className="font-semibold text-sm sm:text-base">TMDB hard filters</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Query the catalog directly — no taste profile required
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!filtersAreDefault(filters) ? (
            <button
              type="button"
              onClick={() => onChange(DEFAULT_BROWSE_FILTERS)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          ) : null}
          {loading ? (
            <span className="text-xs text-zinc-400 animate-pulse">Updating…</span>
          ) : null}
        </div>
      </div>

      <div className="px-4 sm:px-6 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <span className="text-xs uppercase tracking-widest text-zinc-400 block mb-2">Sort by</span>
        <div className="flex flex-wrap gap-2">
          {SORT_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => update({ sortBy: value })}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                filters.sortBy === value
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {FILTER_GROUPS.map((group) => (
          <div key={group.id}>
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              className="w-full flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{group.title}</span>
                <span
                  className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${PRIORITY_STYLES[group.priority]}`}
                >
                  {group.priority === 'signature' ? 'Signature' : group.priority}
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-zinc-400 transition-transform ${
                  expandedGroups.has(group.id) ? 'rotate-180' : ''
                }`}
              />
            </button>
            {expandedGroups.has(group.id) ? (
              <div className="px-4 sm:px-6 pb-4 space-y-4">{group.fields.map(renderField)}</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
