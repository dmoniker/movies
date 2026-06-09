'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, Settings2 } from 'lucide-react';
import { fetchApiConfig, type ApiConfig } from './api-client';
import { enrichMoviesWithDirectors, fetchDiscoverBrowse } from './tmdb';
import {
  loadBrowseStreamingPrefs,
  loadSavedBrowseFilters,
  saveBrowseFilters,
  persistStreamingSelections,
} from './storage';
import BrowseMovieCard from './components/BrowseMovieCard';
import TmdbFilterPanel from './components/TmdbFilterPanel';
import { DEFAULT_BROWSE_FILTERS, FORMAT_FILTER_OPTIONS, GENRE_OPTIONS, OBSCURITY_LABELS, type BrowseLayout, type TmdbBrowseFilters } from './tmdb-browse';

export default function HiddenGemsApp() {
  const [browseFilters, setBrowseFilters] = useState<TmdbBrowseFilters>(DEFAULT_BROWSE_FILTERS);
  const [browseResults, setBrowseResults] = useState<Awaited<ReturnType<typeof fetchDiscoverBrowse>>['movies']>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseTotalPages, setBrowseTotalPages] = useState(1);
  const [browseTotalResults, setBrowseTotalResults] = useState(0);
  const [browseLayout, setBrowseLayout] = useState<BrowseLayout>('grid');
  const [browsePrefsLoaded, setBrowsePrefsLoaded] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [apiConfig, setApiConfig] = useState<ApiConfig>({ tmdb: false });
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    const savedFilters = loadSavedBrowseFilters();
    const streamingPrefs = loadBrowseStreamingPrefs();
    setBrowseFilters({
      ...savedFilters,
      watchRegion: streamingPrefs.watchRegion,
      watchProviderIds:
        streamingPrefs.selectionsByRegion[streamingPrefs.watchRegion] ??
        savedFilters.watchProviderIds,
      page: 1,
    });
    setBrowsePrefsLoaded(true);
    fetchApiConfig()
      .then(setApiConfig)
      .catch(() => setApiConfig({ tmdb: false }));
  }, []);

  useEffect(() => {
    if (!browsePrefsLoaded) return;
    const timer = setTimeout(() => {
      saveBrowseFilters(browseFilters);
      persistStreamingSelections(browseFilters.watchRegion, browseFilters.watchProviderIds);
    }, 400);
    return () => clearTimeout(timer);
  }, [browseFilters, browsePrefsLoaded]);

  useEffect(() => {
    if (!apiConfig.tmdb) {
      setCatalogError('Hidden Gems needs a TMDB API key configured on the server.');
      return;
    }
    if (!browsePrefsLoaded) return;

    let cancelled = false;
    let loadingTimer: ReturnType<typeof setTimeout> | null = null;

    const debounceTimer = setTimeout(() => {
      loadingTimer = setTimeout(() => {
        if (!cancelled) setBrowseLoading(true);
      }, 300);

      fetchDiscoverBrowse(browseFilters, [])
        .then(async (result) => {
          if (cancelled) return;
          const enriched = await enrichMoviesWithDirectors(result.movies);
          if (cancelled) return;
          setBrowseResults(enriched);
          setBrowseTotalPages(result.totalPages);
          setBrowseTotalResults(result.totalResults);
          setCatalogError(null);
        })
        .catch((error) => {
          if (!cancelled) {
            setBrowseResults([]);
            setBrowseTotalPages(1);
            setBrowseTotalResults(0);
            setCatalogError(error instanceof Error ? error.message : 'Failed to load movies');
          }
        })
        .finally(() => {
          if (loadingTimer) clearTimeout(loadingTimer);
          if (!cancelled) setBrowseLoading(false);
        });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(debounceTimer);
      if (loadingTimer) clearTimeout(loadingTimer);
    };
  }, [apiConfig.tmdb, browseFilters, browsePrefsLoaded]);

  const updateFilters = (patch: Partial<TmdbBrowseFilters>) => {
    setBrowseFilters((prev) => ({ ...prev, ...patch, page: 1 }));
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="w-full border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-violet-600 rounded-2xl flex items-center justify-center shrink-0">
            <span className="text-white text-xl sm:text-2xl">💎</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight truncate">Hidden Gem Movies</h1>
            <p className="text-xs sm:text-sm text-zinc-500 truncate">High quality • Low visibility</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 min-w-0 space-y-6">
        {catalogError ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-5 py-4 text-sm text-amber-900 dark:text-amber-200">
            {catalogError}
          </div>
        ) : null}

        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-start md:gap-8 gap-5">
            <div className="md:flex-1 min-w-0">
              <span className="text-xs uppercase tracking-widest text-zinc-400 block mb-3">Format</span>
              <div className="flex flex-wrap gap-2">
                {FORMAT_FILTER_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateFilters({ formatFilter: value })}
                    className={`px-3 py-1.5 text-sm font-medium rounded-full transition-all ${
                      browseFilters.formatFilter === value
                        ? 'bg-violet-600 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:flex-1 min-w-0 w-full">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-widest text-zinc-400">How obscure</span>
                <span className="text-xs font-mono text-violet-600 dark:text-violet-400">
                  {OBSCURITY_LABELS[browseFilters.obscurityLevel]}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                High quality, low visibility — slide toward total unknowns
              </p>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={browseFilters.obscurityLevel}
                onChange={(e) =>
                  updateFilters({
                    obscurityLevel: Number(e.target.value) as TmdbBrowseFilters['obscurityLevel'],
                  })
                }
                className="w-full accent-violet-600"
                aria-label="How obscure"
              />
            </div>
          </div>

          <div>
            <span className="text-xs uppercase tracking-widest text-zinc-400 block mb-3">Genre</span>
            <div className="flex flex-wrap gap-2">
              {GENRE_OPTIONS.map(({ id, name }) => {
                const selected = browseFilters.genreIds.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      const genreIds = selected
                        ? browseFilters.genreIds.filter((g) => g !== id)
                        : [...browseFilters.genreIds, id];
                      updateFilters({ genreIds });
                    }}
                    className={`px-3 py-1.5 text-sm font-medium rounded-full transition-all ${
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
            {browseFilters.genreIds.length === 0 ? (
              <p className="text-xs text-zinc-400 mt-3">
                {browseFilters.formatFilter === 'animated'
                  ? 'Optional — narrow animated hidden gems by genre.'
                  : 'Pick one or more genres — or leave blank for all.'}
              </p>
            ) : null}
          </div>
        </section>

        <section>
          <button
            type="button"
            onClick={() => setAdvancedOpen((open) => !open)}
            className="flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
          >
            <Settings2 className="w-4 h-4" />
            Advanced settings
            <ChevronDown className={`w-4 h-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
          </button>
          {advancedOpen ? (
            <div className="mt-4">
              <TmdbFilterPanel filters={browseFilters} onChange={setBrowseFilters} />
            </div>
          ) : null}
        </section>

        <section>
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2 min-w-0">
              <span className="truncate">Results</span>
              <span className="text-sm font-normal text-zinc-400 shrink-0">
                ({browseTotalResults.toLocaleString()})
              </span>
            </h2>
            <div className="flex gap-2 shrink-0">
              {(['grid', 'list'] as const).map((layout) => (
                <button
                  key={layout}
                  type="button"
                  onClick={() => setBrowseLayout(layout)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                    browseLayout === layout
                      ? 'bg-violet-600 text-white'
                      : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600'
                  }`}
                >
                  {layout === 'grid' ? 'Grid' : 'List'}
                </button>
              ))}
            </div>
          </div>

          {browseLoading ? (
            <div className="text-sm text-zinc-400">Finding hidden gems…</div>
          ) : browseResults.length > 0 ? (
            <>
              <div
                className={
                  browseLayout === 'grid'
                    ? 'grid grid-cols-2 md:grid-cols-3 gap-4 min-w-0'
                    : 'grid grid-cols-1 gap-4 min-w-0'
                }
              >
                {browseResults.map((movie) => (
                  <BrowseMovieCard key={movie.id} movie={movie} layout={browseLayout} />
                ))}
              </div>

              {browseTotalPages > 1 ? (
                <div className="flex items-center justify-center gap-4 mt-8">
                  <button
                    type="button"
                    disabled={browseFilters.page <= 1 || browseLoading}
                    onClick={() =>
                      setBrowseFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
                    }
                    className="px-4 py-2 text-sm font-medium rounded-xl border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-zinc-500">
                    Page {browseFilters.page} of {browseTotalPages}
                  </span>
                  <button
                    type="button"
                    disabled={browseFilters.page >= browseTotalPages || browseLoading}
                    onClick={() =>
                      setBrowseFilters((prev) => ({
                        ...prev,
                        page: Math.min(browseTotalPages, prev.page + 1),
                      }))
                    }
                    className="px-4 py-2 text-sm font-medium rounded-xl border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="bg-white dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl p-12 text-center">
              <p className="text-zinc-400 text-sm">
                No hidden gems match these filters. Try another genre or loosen advanced settings.
              </p>
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-6 px-4 text-center text-xs text-zinc-400 mt-10">
        <a
          href="https://hiddengemmovies.com"
          className="text-violet-600 hover:underline dark:text-violet-400"
        >
          hiddengemmovies.com
        </a>
        {' '}
        • Movie data from TMDB
      </footer>
    </div>
  );
}
