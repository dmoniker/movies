'use client';

import { ChevronDown, RotateCcw, Search, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { fetchWatchProviders, type WatchProvider } from '../tmdb';
import {
  loadBrowseStreamingPrefs,
  persistStreamingSelections,
  clearAllBrowsePrefs,
} from '../storage';
import {
  DEFAULT_BROWSE_FILTERS,
  FILTER_GROUPS,
  GENRE_OPTIONS,
  MONETIZATION_OPTIONS,
  RELEASE_WINDOW_OPTIONS,
  SORT_OPTIONS,
  WATCH_REGION_OPTIONS,
  filtersAreDefault,
  type TmdbBrowseFilters,
} from '../tmdb-browse';

interface TmdbFilterPanelProps {
  filters: TmdbBrowseFilters;
  onChange: (filters: TmdbBrowseFilters) => void;
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
  nullable = true,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  min: number;
  max: number;
  step: number;
  label: string;
  description?: string;
  formatValue?: (value: number | null) => string;
  nullable?: boolean;
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
          onChange(nullable !== false && next <= min ? null : next);
        }}
        className="w-full accent-violet-600"
      />
    </div>
  );
}

function ProviderChip({
  provider,
  selected,
  onToggle,
}: {
  provider: WatchProvider;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-full transition-all ${
        selected
          ? 'bg-violet-600 text-white'
          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
      }`}
    >
      {provider.logoPath ? (
        <span className="relative w-4 h-4 shrink-0 rounded overflow-hidden bg-zinc-200 dark:bg-zinc-700">
          <Image src={provider.logoPath} alt="" fill className="object-cover" unoptimized />
        </span>
      ) : null}
      {provider.name}
    </button>
  );
}

export default function TmdbFilterPanel({ filters, onChange }: TmdbFilterPanelProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(['hard', 'quality', 'mood', 'streaming'])
  );
  const [watchProviders, setWatchProviders] = useState<WatchProvider[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [providerSearch, setProviderSearch] = useState('');
  const [savedProviderNames, setSavedProviderNames] = useState<Record<string, string>>(() =>
    typeof window === 'undefined' ? {} : loadBrowseStreamingPrefs().providerNames
  );
  const atDefaults = filtersAreDefault(filters);

  useEffect(() => {
    let cancelled = false;
    setProvidersLoading(true);
    setProvidersError(null);

    fetchWatchProviders(filters.watchRegion)
      .then((providers) => {
        if (!cancelled) setWatchProviders(providers);
      })
      .catch((error) => {
        if (!cancelled) {
          setWatchProviders([]);
          setProvidersError(error instanceof Error ? error.message : 'Failed to load services');
        }
      })
      .finally(() => {
        if (!cancelled) setProvidersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filters.watchRegion]);

  useEffect(() => {
    if (watchProviders.length === 0) return;
    const names: Record<string, string> = {};
    for (const provider of watchProviders) {
      if (filters.watchProviderIds.includes(provider.id)) {
        names[String(provider.id)] = provider.name;
      }
    }
    if (Object.keys(names).length === 0) return;
    setSavedProviderNames((prev) => ({ ...prev, ...names }));
    persistStreamingSelections(filters.watchRegion, filters.watchProviderIds, names);
  }, [watchProviders, filters.watchProviderIds, filters.watchRegion]);

  const selectedProviders = useMemo((): WatchProvider[] => {
    return filters.watchProviderIds.map((id) => {
      const fromList = watchProviders.find((provider) => provider.id === id);
      if (fromList) return fromList;
      return {
        id,
        name: savedProviderNames[String(id)] ?? `Service ${id}`,
      };
    });
  }, [filters.watchProviderIds, watchProviders, savedProviderNames]);

  const searchResults = useMemo(() => {
    const query = providerSearch.trim().toLowerCase();
    if (!query) return [];
    return watchProviders.filter(
      (provider) =>
        !filters.watchProviderIds.includes(provider.id) &&
        provider.name.toLowerCase().includes(query)
    );
  }, [providerSearch, watchProviders, filters.watchProviderIds]);

  const update = (patch: Partial<TmdbBrowseFilters>) => {
    onChange({ ...filters, ...patch, page: 1 });
  };

  const toggleProvider = (provider: WatchProvider) => {
    const selected = filters.watchProviderIds.includes(provider.id);
    const watchProviderIds = selected
      ? filters.watchProviderIds.filter((id) => id !== provider.id)
      : [...filters.watchProviderIds, provider.id];

    const providerNames = { [String(provider.id)]: provider.name };
    setSavedProviderNames((prev) => ({ ...prev, ...providerNames }));
    persistStreamingSelections(filters.watchRegion, watchProviderIds, providerNames);
    update({ watchProviderIds });
  };

  const updateRegion = (watchRegion: string) => {
    persistStreamingSelections(filters.watchRegion, filters.watchProviderIds);
    const ids = loadBrowseStreamingPrefs().selectionsByRegion[watchRegion] ?? [];
    onChange({ ...filters, watchRegion, watchProviderIds: ids, page: 1 });
    setProviderSearch('');
  };

  const clearStreamingSelections = () => {
    persistStreamingSelections(filters.watchRegion, [], {});
    update({ watchProviderIds: [] });
    setProviderSearch('');
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
        if (field.key === 'oscarExcludeYears') {
          if (!filters.excludeOscarNomineesAndWinners) return null;
          return (
            <SliderField
              key={field.key}
              value={filters.oscarExcludeYears}
              onChange={(value) => update({ oscarExcludeYears: value ?? 1 })}
              min={field.min ?? 1}
              max={field.max ?? 25}
              step={field.step ?? 1}
              label={field.label}
              description={field.description}
              formatValue={(v) => `Last ${v ?? 1} years`}
              nullable={false}
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

  const renderStreamingField = (field: (typeof FILTER_GROUPS)[0]['fields'][0]) => {
    if (field.type === 'watchRegion') {
      return (
        <div key={field.key}>
          <span className="text-sm font-medium block mb-2">{field.label}</span>
          {field.description ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">{field.description}</p>
          ) : null}
          <select
            value={filters.watchRegion}
            onChange={(e) => updateRegion(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
          >
            {WATCH_REGION_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label} ({value})
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (field.type === 'watchProviders') {
      return (
        <div key={field.key}>
          <span className="text-sm font-medium block mb-2">{field.label}</span>
          {field.description ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">{field.description}</p>
          ) : null}

          {selectedProviders.length > 0 ? (
            <div className="mb-3">
              <span className="text-xs uppercase tracking-widest text-zinc-400 block mb-2">
                Selected
              </span>
              <div className="flex flex-wrap gap-2">
                {selectedProviders.map((provider) => (
                  <ProviderChip
                    key={provider.id}
                    provider={provider}
                    selected
                    onToggle={() => toggleProvider(provider)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div className="relative flex items-center gap-2 pl-3 pr-2 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl focus-within:border-violet-500 transition-colors">
            <Search className="w-4 h-4 text-zinc-400 shrink-0" />
            <input
              type="text"
              value={providerSearch}
              onChange={(e) => setProviderSearch(e.target.value)}
              placeholder="Search streaming services…"
              className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
            />
            {providerSearch ? (
              <button
                type="button"
                onClick={() => setProviderSearch('')}
                aria-label="Clear search"
                className="p-1 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>

          {providersLoading ? (
            <p className="text-xs text-zinc-400 mt-2">Loading services for {filters.watchRegion}…</p>
          ) : providersError ? (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">{providersError}</p>
          ) : providerSearch.trim() ? (
            searchResults.length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-3">
                {searchResults.map((provider) => (
                  <ProviderChip
                    key={provider.id}
                    provider={provider}
                    selected={false}
                    onToggle={() => toggleProvider(provider)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-400 mt-2">No services match &ldquo;{providerSearch.trim()}&rdquo;</p>
            )
          ) : (
            <p className="text-xs text-zinc-400 mt-2">
              Type to search Netflix, Prime, Disney+, and other services in {filters.watchRegion}.
            </p>
          )}

          {filters.watchProviderIds.length > 0 ? (
            <button
              type="button"
              onClick={clearStreamingSelections}
              className="mt-2 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Clear streaming filters
            </button>
          ) : null}
        </div>
      );
    }

    if (field.type === 'monetization') {
      return (
        <div key={field.key}>
          <span className="text-sm font-medium block mb-2">{field.label}</span>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
            Only applies when streaming services are selected
          </p>
          <div className="flex flex-wrap gap-2">
            {MONETIZATION_OPTIONS.map(({ value, label }) => {
              const selected = filters.watchMonetizationTypes.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  disabled={filters.watchProviderIds.length === 0}
                  onClick={() => {
                    const watchMonetizationTypes = selected
                      ? filters.watchMonetizationTypes.filter((type) => type !== value)
                      : [...filters.watchMonetizationTypes, value];
                    update({ watchMonetizationTypes });
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all disabled:opacity-40 ${
                    selected
                      ? 'bg-violet-600 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    return null;
  };

  const renderGroupField = (field: (typeof FILTER_GROUPS)[0]['fields'][0]) => {
    if (field.type === 'watchRegion' || field.type === 'watchProviders' || field.type === 'monetization') {
      return renderStreamingField(field);
    }
    return renderField(field);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl sm:rounded-3xl overflow-hidden min-w-0 max-w-full">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <h3 className="font-semibold text-sm sm:text-base">TMDB hard filters</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Query the catalog directly — no taste profile required
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={atDefaults}
            onClick={() => {
              clearAllBrowsePrefs();
              setSavedProviderNames({});
              setProviderSearch('');
              onChange(DEFAULT_BROWSE_FILTERS);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
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
              <div className="px-4 sm:px-6 pb-4 space-y-4">{group.fields.map(renderGroupField)}</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
